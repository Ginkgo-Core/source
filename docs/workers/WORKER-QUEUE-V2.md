# WORKER-QUEUE.md
## Sistema de Filas e Workers — Ginkgo AI Systems
### Redis LPUSH + Worker Loop (P1) → BullMQ (P2 — content-recycler)

> **Decisão P1:** Redis LPUSH simples — sem dependência extra, suficiente para provisioning,
> ingestion, metering, sync e notifications.
>
> **Migração BullMQ:** Quando a skill `nyra-content-recycler` entrar em construção (P2).
> Processamento de vídeo com FFmpeg é longa duração e precisa de retry visual,
> progress tracking e priority queue — Redis LPUSH não entrega isso.
>
> **BullMQ** (`taskforcesh/bullmq` — 4.5k+ stars) é o padrão Node.js/TypeScript para filas
> Redis com retry, delay, prioridade e dashboard visual. Mesmo Redis, mesma infraestrutura —
> só a camada de abstração muda.

---

## Arquitetura

```
API / n8n / Trigger
  ↓ redis.lpush('queue:{nome}', JSON.stringify(job))
  
REDIS
  ├── queue:provisioning   → worker-provisioning
  ├── queue:ingestion      → worker-ingestion
  ├── queue:sync           → worker-sync (cron)
  ├── queue:metering       → worker-metering
  └── queue:notifications  → worker-notifications

WORKERS (processos Node.js independentes)
  Cada worker: loop infinito + BRPOP bloqueante
  → processa job → loga resultado → aguarda próximo
```

---

## Estrutura de um Job

```typescript
// Interface padrão para todo job
interface Job {
  id:         string    // uuid — para idempotência
  type:       string    // tipo do job
  tenant_id:  string    // sempre presente
  payload:    object    // dados específicos do job
  attempts:   number    // tentativas (começa em 0)
  max_attempts: number  // default: 3
  created_at: string    // ISO timestamp
}

// Exemplo: job de ingestão
{
  id:         "job_abc123",
  type:       "ingest_document",
  tenant_id:  "f47ac10b-...",
  payload: {
    asset_id:    "asset_xyz",
    source_type: "pdf",
    file_url:    "https://storage.supabase.co/..."
  },
  attempts:     0,
  max_attempts: 3,
  created_at:   "2026-03-15T08:00:00Z"
}
```

---

## Helper: enfileirar job

```typescript
// packages/shared/queue.ts

import { createClient } from 'redis'
import { v4 as uuid } from 'uuid'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

export async function enqueue(
  queue: string,
  type: string,
  tenant_id: string,
  payload: object,
  maxAttempts = 3
): Promise<string> {
  const job = {
    id:           uuid(),
    type,
    tenant_id,
    payload,
    attempts:     0,
    max_attempts: maxAttempts,
    created_at:   new Date().toISOString()
  }
  await redis.lPush(`queue:${queue}`, JSON.stringify(job))
  return job.id
}

// Uso:
// await enqueue('provisioning', 'create_tenant', tenant_id, { slug, segment })
// await enqueue('ingestion', 'ingest_document', tenant_id, { asset_id, file_url })
// await enqueue('notifications', 'send_whatsapp', tenant_id, { phone, message })
```

---

## Helper: loop de worker

```typescript
// packages/shared/worker-loop.ts

export async function runWorker(
  queueName: string,
  handler: (job: Job) => Promise<void>,
  options = { timeout: 30 }
) {
  console.log(`Worker [${queueName}] iniciado`)

  while (true) {
    try {
      // BRPOP: bloqueia até ter job (timeout em segundos)
      const result = await redis.brPop(`queue:${queueName}`, options.timeout)
      if (!result) continue

      const job: Job = JSON.parse(result.element)
      console.log(`[${queueName}] processando job ${job.id} (tipo: ${job.type})`)

      try {
        await handler(job)
        console.log(`[${queueName}] job ${job.id} concluído`)

      } catch (err: any) {
        job.attempts++
        console.error(`[${queueName}] job ${job.id} falhou (tentativa ${job.attempts}/${job.max_attempts}): ${err.message}`)

        if (job.attempts < job.max_attempts) {
          // Backoff: 5s, 15s, 45s entre tentativas
          const delay = Math.pow(3, job.attempts) * 5000
          setTimeout(() => {
            redis.lPush(`queue:${queueName}`, JSON.stringify(job))
          }, delay)
        } else {
          // Dead letter: mover para fila de falhas
          await redis.lPush(`queue:${queueName}:failed`, JSON.stringify({
            ...job,
            failed_at: new Date().toISOString(),
            error: err.message
          }))
          // Logar incidente
          await supabase.from('incidents').insert({
            tenant_id:   job.tenant_id,
            severity:    'medium',
            category:    'worker_failure',
            description: `Worker ${queueName} falhou após ${job.max_attempts} tentativas: ${err.message}`
          })
        }
      }
    } catch (err) {
      console.error(`[${queueName}] erro no loop:`, err)
      await sleep(2000) // aguardar antes de reiniciar
    }
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
```

---

## worker-provisioning

**Arquivo:** `workers/provisioning/index.ts`  
**Fila:** `queue:provisioning`  
**Job types:** `create_tenant_resources`

```typescript
import { runWorker, enqueue } from '@ginkgo/shared/queue'

runWorker('provisioning', async (job) => {
  const { tenant_id, slug, segment } = job.payload

  // 1. Criar instância Evolution API
  const instance = await fetch(`${process.env.EVOLUTION_API_URL}/instance/create`, {
    method: 'POST',
    headers: { apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({
      instanceName: slug,
      token: generateToken(),
      webhook: {
        url: `${process.env.API_URL}/webhooks/evolution`,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']
      }
    })
  })

  // 2. Criar inbox no Chatwoot
  const inbox = await fetch(`${process.env.CHATWOOT_URL}/api/v1/accounts/1/inboxes`, {
    method: 'POST',
    headers: { api_access_token: process.env.CHATWOOT_API_TOKEN! },
    body: JSON.stringify({ name: slug, channel: { type: 'api' } })
  })
  const { id: chatwoot_inbox_id } = await inbox.json()

  // 3. Atualizar canal no banco
  await supabase.from('channels').insert({
    tenant_id,
    type: 'whatsapp',
    name: 'WhatsApp Principal',
    config_json: {
      evolution_instance: slug,
      webhook_url: `${process.env.API_URL}/webhooks/evolution`,
      chatwoot_inbox_id
    },
    status: 'connecting'
  })

  // 4. Enfileirar email de boas-vindas
  await enqueue('notifications', 'send_welcome_email', tenant_id, {
    email: job.payload.email,
    name: job.payload.name,
    onboarding_url: `${process.env.APP_URL}/onboarding`
  })

  console.log(`Tenant ${slug} provisionado com sucesso`)
})
```

---

## worker-ingestion

**Arquivo:** `workers/ingestion/index.ts`  
**Fila:** `queue:ingestion`  
**Job types:** `ingest_document`

```typescript
runWorker('ingestion', async (job) => {
  const { asset_id, source_type, file_url, raw_text } = job.payload
  const { tenant_id } = job

  // Atualizar status
  await supabase.from('knowledge_assets')
    .update({ status: 'extracting' })
    .eq('id', asset_id)

  // 1. Extrair texto
  let text = ''
  if (source_type === 'pdf') {
    const buf = await downloadFile(file_url)
    text = await extractPdf(buf)
  } else if (source_type === 'url') {
    text = await fetchAndStripHtml(file_url!)
  } else {
    text = raw_text!
  }

  // 2. Normalizar
  text = normalize(text)

  await supabase.from('knowledge_assets')
    .update({ status: 'chunking' })
    .eq('id', asset_id)

  // 3. Chunking
  const chunks = chunkText(text, { targetTokens: 600, overlap: 100 })

  // 4. Embeddings em batch de 20
  await supabase.from('knowledge_assets')
    .update({ status: 'embedding' })
    .eq('id', asset_id)

  const embeddings = await embedInBatches(chunks.map(c => c.text), 20)

  // 5. Salvar chunks
  const rows = chunks.map((chunk, i) => ({
    tenant_id,
    asset_id,
    chunk_index:   i,
    total_chunks:  chunks.length,
    chunk_text:    chunk.text,
    embedding:     embeddings[i],
    metadata_json: chunk.metadata
  }))

  await supabase.from('knowledge_chunks').insert(rows)

  // 6. Marcar como indexado
  await supabase.from('knowledge_assets')
    .update({ status: 'indexed', indexed_at: new Date().toISOString() })
    .eq('id', asset_id)

  // 7. Registrar job concluído
  await supabase.from('ingestion_jobs').insert({
    tenant_id, asset_id,
    status: 'completed',
    chunks_created: chunks.length,
    completed_at: new Date().toISOString()
  })
})
```

---

## worker-sync

**Arquivo:** `workers/sync/index.ts`  
**Modo:** CRON — não usa fila, roda em intervalos fixos

```typescript
import cron from 'node-cron'

// Meta metrics: a cada 4h
cron.schedule('0 */4 * * *', async () => {
  const tenants = await getTenantsWithIntegration('meta')
  for (const tenant of tenants) {
    await syncMetaMetrics(tenant.id)
  }
})

// GMB metrics: a cada 6h
cron.schedule('0 */6 * * *', async () => {
  const tenants = await getTenantsWithIntegration('google')
  for (const tenant of tenants) {
    await syncGmbMetrics(tenant.id)
  }
})

// TikTok metrics: a cada 6h
cron.schedule('30 */6 * * *', async () => {
  const tenants = await getTenantsWithIntegration('tiktok')
  for (const tenant of tenants) {
    await syncTiktokMetrics(tenant.id)
  }
})

// Perplexity news feed: a cada 4h
cron.schedule('0 2,6,10,14,18,22 * * *', async () => {
  const tenants = await getAllActiveTenantsWithPlan(['business', 'scale'])
  for (const tenant of tenants) {
    await refreshNewsFeed(tenant.id, tenant.config_json.segment)
  }
})

// Renovar tokens OAuth expirados: a cada 1h
cron.schedule('0 * * * *', async () => {
  await refreshExpiredOAuthTokens()
})
```

---

## worker-metering

**Arquivo:** `workers/metering/index.ts`  
**Fila:** `queue:metering`  
**Job types:** `debit_tokens`, `refill_tokens`, `check_balance`

```typescript
runWorker('metering', async (job) => {
  if (job.type === 'debit_tokens') {
    const { tenant_id, amount, source_type, source_id } = job.payload

    // Debitar com verificação de saldo
    const { data: balance } = await supabase
      .from('token_balances')
      .select('balance')
      .eq('tenant_id', tenant_id)
      .single()

    if (!balance || balance.balance < amount) {
      // Notificar tenant sobre saldo insuficiente
      await enqueue('notifications', 'send_low_balance_alert', tenant_id, {})
      return
    }

    await supabase.from('token_balances')
      .update({
        balance:     balance.balance - amount,
        used_period: supabase.rpc('increment', { amount })
      })
      .eq('tenant_id', tenant_id)

    await supabase.from('token_transactions').insert({
      tenant_id, type: 'consumption',
      amount: -amount,
      balance_after: balance.balance - amount,
      source_type, source_id
    })
  }

  if (job.type === 'refill_tokens') {
    const { tenant_id, amount, plan } = job.payload
    await supabase.from('token_balances')
      .update({ balance: amount, used_period: 0 })
      .eq('tenant_id', tenant_id)

    await supabase.from('token_transactions').insert({
      tenant_id, type: 'plan_refill',
      amount, description: `Recarga plano ${plan}`
    })
  }
})
```

---

## worker-notifications

**Arquivo:** `workers/notifications/index.ts`  
**Fila:** `queue:notifications`  
**Job types:** `send_whatsapp`, `send_welcome_email`, `send_low_balance_alert`, `send_daily_summary`

```typescript
runWorker('notifications', async (job) => {

  if (job.type === 'send_whatsapp') {
    const { phone, message } = job.payload
    await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/ginkgo-zero`, {
      method: 'POST',
      headers: { apikey: process.env.EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: phone, text: message })
    })
  }

  if (job.type === 'send_welcome_email') {
    const { email, name, onboarding_url } = job.payload
    await resend.emails.send({
      from: 'Ginkgo AI <oi@ginkgosystems.tech>',
      to: email,
      subject: 'Bem-vindo à Ginkgo! Seu trial começa agora',
      html: welcomeEmailTemplate({ name, onboarding_url })
    })
  }

  if (job.type === 'send_low_balance_alert') {
    const { tenant_id } = job
    const tenant = await getTenantById(tenant_id)
    await enqueue('notifications', 'send_whatsapp', tenant_id, {
      phone:   process.env.OPERATOR_WHATSAPP,
      message: `⚡ Saldo baixo — tenant: ${tenant.name}`
    })
  }

  if (job.type === 'send_daily_summary') {
    // chamado pelo CRON 08h BRT via worker-sync
    const { tenant_id, metrics } = job.payload
    const msg = formatDailySummary(metrics)
    await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/ginkgo-zero`, {
      method: 'POST',
      headers: { apikey: process.env.EVOLUTION_API_KEY! },
      body: JSON.stringify({ number: process.env.OPERATOR_WHATSAPP, text: msg })
    })
  }
})
```

---

## Monitoramento das filas

```typescript
// Verificar tamanho das filas (útil para alertas)
export async function getQueueSizes() {
  const queues = ['provisioning','ingestion','sync','metering','notifications']
  const sizes = await Promise.all(
    queues.map(async (q) => ({
      queue: q,
      pending:  await redis.lLen(`queue:${q}`),
      failed:   await redis.lLen(`queue:${q}:failed`)
    }))
  )
  return sizes
}

// Alerta se fila acumular > 50 jobs
// (verificar a cada 5 min no worker-sync)
```

---

## Variáveis de ambiente dos workers

```bash
# workers/.env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
OPENAI_API_KEY=
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
CHATWOOT_URL=
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=1
RESEND_API_KEY=
APP_URL=https://app.ginkgosystems.tech
API_URL=https://api.ginkgosystems.tech
OPERATOR_WHATSAPP=+5553991214817
TENANT_ZERO_ID=f47ac10b-58cc-4372-a567-000000000000
```

---

## Migração para BullMQ — Quando e Como

### Quando migrar

```
TRIGGER: construção da skill nyra-content-recycler (P2)

Por quê o content-recycler exige BullMQ e não Redis LPUSH:
  - FFmpeg + MoviePy podem durar 5–20 minutos por job
  - Precisa de progress tracking (0% → 25% → 50% → 100%)
  - Precisa de priority (cliente Scale > cliente Starter)
  - Precisa de delay (publicação agendada)
  - Precisa de retry granular (falhou no crop? refaz só o crop)
  - Dashboard visual para operador monitorar fila de vídeos
```

### O que muda na arquitetura

```
P1 (Redis LPUSH)           P2 (BullMQ sobre mesmo Redis)
────────────────           ──────────────────────────────
redis.lpush(queue, job)    queue.add(type, payload, opts)
BRPOP bloqueante           worker.process(concurrency, fn)
retry manual (nosso loop)  retry automático com backoff
sem progress               job.updateProgress(pct)
sem priority               { priority: 1|2|3 }
sem delay                  { delay: ms }
sem dashboard              Bull Dashboard ou Arena UI
```

### Filas que migram para BullMQ

```
queue:video-processing   ← NOVA — só existe com content-recycler
  jobs: cut_clip, crop_video, add_captions, generate_thumbnail
  concurrency: 2 (VPS tem limite de CPU)
  priority: scale=1, business=2, starter=3
  timeout: 25min por job
  retry: 2 tentativas com backoff 60s

queue:content-publish    ← NOVA — publicação agendada (Postiz/Blotato)
  jobs: publish_reel, publish_post, publish_story
  delay: calculado pela data de agendamento
  retry: 3 tentativas com backoff 30s
```

### Filas que FICAM em Redis LPUSH

```
queue:provisioning     → jobs curtos (~10s) — não precisa BullMQ
queue:ingestion        → jobs médios (~2min) — LPUSH suficiente
queue:sync             → cron, não fila — permanece em node-cron
queue:metering         → operações rápidas — LPUSH suficiente
queue:notifications    → envio simples — LPUSH suficiente
```

### Instalação quando chegar a hora

```bash
pnpm add bullmq
# Mesmo Redis — zero mudança de infraestrutura
# Só adicionar o worker e a fila no código
```

---

## Postiz vs Blotato — Decisão de Agendamento

### Contexto

Dois caminhos para publicação multi-canal:

```
BLOTATO (SaaS)                    POSTIZ (Open Source)
──────────────                    ────────────────────
API simples                       Self-hosted no VPS
Pago por uso (~$0,01/post)        Zero custo de API
Gerenciado (sem manutenção)       Manutenção própria
25+ canais                        25+ canais
Não personaliza UI                UI personalizável
Disponível hoje                   Setup ~2h

GitHub: —                         github.com/gitroomhq/postiz-app
                                  14k+ stars · multi-tenant nativo
```

### Decisão adotada

```
PADRÃO: Blotato
  → Clientes entram com Blotato por default
  → Zero setup, funciona no onboarding imediato
  → Custo repassado nos tokens (markup 60%)

ALTERNATIVA: Postiz auto-hospedado
  → Para clientes Scale com volume alto de posts
  → Onde o custo Blotato supera o custo de rodar Postiz na VPS
  → Ou onde o cliente quer controle total da publicação

PONTO DE VIRADA:
  Se cliente publica > 200 posts/mês → Postiz economiza
  Abaixo de 200/mês → Blotato é mais simples

IMPLEMENTAÇÃO Postiz:
  Adicionar ao docker-compose.yml quando necessário:
  
  postiz:
    image: ghcr.io/gitroomhq/postiz-app:latest
    restart: always
    environment:
      - DATABASE_URL=${POSTIZ_DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=https://postiz.ginkgosystems.tech
      - JWT_SECRET=${POSTIZ_JWT_SECRET}
    networks: [ginkgo-net]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.postiz.rule=Host(`postiz.ginkgosystems.tech`)"
      - "traefik.http.routers.postiz.tls.certresolver=le"
```

---

*Ginkgo AI Systems — WORKER-QUEUE.md v1.1.0 — Março 2026*
*BullMQ entra com content-recycler. Postiz como alternativa ao Blotato em alto volume.*
