# WORKER-QUEUE.md
## Sistema de Filas e Workers — Ginkgo AI Systems
### Redis LPUSH + Worker Loop (P1) → BullMQ (P2+)

> **Decisão P1:** Redis LPUSH simples — sem dependência extra, suficiente para o volume inicial.  
> **Migração P2+:** BullMQ quando precisar de retry visual, delay, priority e dashboard.

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

*Ginkgo AI Systems — WORKER-QUEUE.md v1.0.0 — Março 2026*
