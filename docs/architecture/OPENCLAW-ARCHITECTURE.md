# OPENCLAW-ARCHITECTURE.md
## OpenClaw como Runtime Cognitivo Central da Ginkgo
### Fronteiras, fluxos, contratos e observabilidade

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Decisão central:** OpenClaw = cérebro. n8n = sistema nervoso periférico. Ginkgo = sistema operacional.  
> **Regra de ouro:** Se exige raciocínio, contexto ou decisão → OpenClaw. Se é sequência previsível → n8n.

---

## 1. Posicionamento Revisado

### Antes (incorreto)
```
Ginkgo → usa OpenClaw como detalhe de implementação
n8n    → parecia o centro da orquestração
```

### Agora (correto)
```
Ginkgo     → sistema operacional (auth, billing, dados, governança, UI)
OpenClaw   → runtime cognitivo central (raciocínio, sessões, tools, memória)
n8n        → automação procedural (webhooks, ETL, syncs, jobs previsíveis)
```

**Em uma frase:**
> OpenClaw é o coração vivo. n8n é o sistema reflexo. Ginkgo é o sistema operacional que governa tudo.

---

## 2. Arquitetura Completa Revisada

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INTERFACE                                     │
│  Dashboard Web · Office Visual · Telegram · WhatsApp · Web Widget     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                       GINKGO CORE                                     │
│  Auth · Tenant · Billing · Entitlements · Integrations Registry       │
│  Observability · Token Health · Provisioning · Skill Governance       │
│                    (apps/api — Fastify)                               │
└──────────┬────────────────────────────────────────┬──────────────────┘
           │                                        │
           ▼                                        ▼
┌──────────────────────┐                ┌─────────────────────────────┐
│   OPENCLAW RUNTIME   │                │       n8n AUTOMATION        │
│                      │                │                             │
│  Agent Registry      │                │  Webhooks (Evolution, etc.) │
│  Session Runtime     │                │  ETL e sync de dados        │
│  Tool Router         │◄──────────────►│  Jobs previsíveis           │
│  Memory Bridge (RAG) │                │  Notificações e alertas     │
│  Policy Layer        │                │  Integração procedural      │
│  Telemetry           │                │  Pós-processamento          │
│                      │                │                             │
│  Brann · Alfred      │                │  WA-Receiver-Base           │
│  Nyra · Command      │                │  Lead-Score-Engine          │
└──────────┬───────────┘                │  Handoff-Chatwoot           │
           │                            │  RAG-Ingestion              │
           ▼                            │  Daily-Summary              │
┌──────────────────────────────────────┴─────────────────────────────┐
│                      EXECUTION LAYER                                 │
│  Workers (provisioning, ingestion, sync, metering, video)            │
│  Redis Queue (LPUSH → BullMQ para vídeo)                             │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                       DATA + EXTERNAL                               │
│  Supabase (Postgres + pgvector + Auth + Storage)                    │
│  Stripe · Evolution API · Chatwoot                                  │
│  Google APIs · Meta · TikTok · Shopify                              │
│  ElevenLabs · HeyGen · Gamma · Blotato · Postiz                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fronteira OpenClaw × n8n — Regra de Decisão

### O que vai para OpenClaw

Qualquer operação que exige:

```
✅ Raciocínio          → "qual a melhor resposta para este lead?"
✅ Contexto            → "considerando as últimas 12 mensagens..."
✅ Escolha de tool     → "preciso de search_knowledge ou create_lead?"
✅ Memória             → "este lead perguntou sobre preço antes"
✅ Decisão             → "handoff agora ou tentar mais uma vez?"
✅ Coordenação         → "delegar subtarefa para Alfred"
✅ Adaptação           → "tom mais formal porque empresa grande"
```

Exemplos concretos:
```
Alfred analisando relatório e propondo ação baseada em padrão
Nyra interpretando um briefing e estruturando um roteiro
Command entendendo "pausa a campanha do Instagram se ROAS < 2"
Brann saindo do script quando lead faz pergunta inesperada
```

### O que vai para n8n

Qualquer operação que é:

```
✅ Gatilho             → "chegou mensagem no WhatsApp"
✅ Sequência fixa      → "salvar mensagem → buscar conversa → atualizar"
✅ Integração linear   → "Google Drive → extrair → salvar Supabase"
✅ Sincronização       → "a cada 4h, buscar métricas do Meta"
✅ Job agendado        → "todo dia 08h, gerar daily summary"
✅ Pós-processamento   → "após publicar, salvar URL no banco"
✅ Alerta/notificação  → "score >= 70 → WhatsApp operador"
```

Exemplos concretos:
```
Webhook Evolution receber mensagem → salvar → decidir rota
Lead Score Engine calcular e aplicar tags após cada mensagem
Handoff Chatwoot criar ticket com dados estruturados
RAG Ingestion Pipeline processar documento em chunks
Daily Summary agregar métricas e enviar WhatsApp
```

### Zona cinza — como decidir

```
PERGUNTA: "Este workflow precisa raciocinar sobre o que fazer?"
  SIM → OpenClaw
  NÃO → n8n

PERGUNTA: "Este workflow pode ser descrito como um fluxograma fixo?"
  SIM → n8n
  NÃO → OpenClaw (ou n8n chama OpenClaw para a parte cognitiva)
```

---

## 4. Fluxo de Atendimento (Brann) — Divisão Correta

```
ENTRADA (Canal WhatsApp)
      │
      ▼
  n8n: WA-Receiver-Base
    - Recebe webhook Evolution
    - Filtra fromMe, tipos inválidos
    - Extrai phone, message, pushName
    - Responde 200 imediato
      │
      ▼
  n8n: Decide rota
    ┌─────────────────────────────────────────┐
    │ Fluxo fixo?  (FAQ simples, saudação)    │
    │   → n8n responde direto (sem OpenClaw)  │
    └─────────────────────────────────────────┘
    ┌─────────────────────────────────────────┐
    │ Precisa de raciocínio?                  │
    │   → n8n chama OpenClaw/Brann            │
    └─────────────────────────────────────────┘
      │
      ▼ (caso cognitivo)
  OpenClaw: Brann Runtime
    - Carrega contexto da sessão
    - Busca RAG se relevante
    - Monta prompt com histórico
    - Chama LLM (gpt-4o)
    - Decide tool calls
    - Executa tools via Tool Registry
    - Formata resposta
      │
      ▼
  n8n: Persistência e envio
    - Salva mensagem no banco
    - Aplica sanitização WhatsApp
    - Aguarda typing delay (1200ms)
    - Envia via Evolution API
    - Loga em tool_executions
      │
      ▼
  n8n: Pós-processamento
    - Dispara Lead Score Engine
    - Verifica threshold de handoff
    - Envia alertas se necessário
```

**Princípio:** n8n controla o canal e a persistência. OpenClaw controla a inteligência. n8n nunca toma decisões cognitivas.

---

## 5. Blocos Internos do OpenClaw Runtime

### 5.1 Agent Registry

```typescript
// openclaw/agent-registry.ts
// Lista dos agentes ativos por tenant, com config carregada do banco

interface AgentRegistration {
  tenant_id:    string
  agent_type:   AgentType
  enabled:      boolean
  config:       AgentConfig       // do packages/agents/agents/{type}/config.ts
  prompt:       string            // do banco (prompt_versions) ou fallback local
  tools:        AgentToolConfig[] // tools autorizadas para este agente/tenant
  openclaw_instance_id?: string   // ID da instância OpenClaw se já provisionada
}

// Carregado na inicialização, atualizado via webhook quando banco muda
export const agentRegistry = new Map<string, AgentRegistration>()
// key: `${tenant_id}:${agent_type}`
```

### 5.2 Session Runtime

```typescript
// openclaw/session-runtime.ts
// Gerencia sessões de conversa com contexto persistido

interface AgentSession {
  session_id:      string        // uuid da sessão
  tenant_id:       string
  agent_type:      AgentType
  conversation_id: string
  context:         Message[]     // histórico em memória (rápido)
  metadata:        Record<string, unknown>
  created_at:      Date
  last_active:     Date
}

// Sessões vivem no Redis (TTL 2h de inatividade)
// Histórico completo persiste no Supabase (messages table)
// OpenClaw sempre carrega do Redis primeiro, fallback para Supabase
```

### 5.3 Tool Router

```typescript
// openclaw/tool-router.ts
// Recebe tool_call do LLM → valida → executa via packages/agents/executor

import { execute } from '@ginkgo/agents'

export async function routeTool(
  tool_name: string,
  input:     Record<string, unknown>,
  context:   { tenant_id: string; agent: AgentType; session_id: string }
): Promise<ToolResult> {
  // Toda execução passa pelo kernel — sem bypass
  return execute({
    tool:      tool_name,
    input,
    tenant_id: context.tenant_id,
    agent:     context.agent,
    context:   { session_id: context.session_id }
  })
}
```

### 5.4 Memory Bridge

```typescript
// openclaw/memory-bridge.ts
// Conecta OpenClaw com RAG, histórico e contexto do tenant

export const memoryBridge = {

  // Contexto de curto prazo (últimas N mensagens)
  async getConversationContext(
    conversation_id: string,
    limit = 12
  ): Promise<Message[]> {
    // 1. Tentar Redis (sessão ativa)
    // 2. Fallback: Supabase messages table
  },

  // Contexto de longo prazo (RAG)
  async getSemanticContext(
    query:     string,
    tenant_id: string,
    top_k = 5
  ): Promise<string> {
    const result = await execute({
      tool: 'search_knowledge',
      input: { query, top_k },
      tenant_id, agent: 'brann',
      context: {}
    })
    return result.output.context as string ?? ''
  },

  // Contexto do tenant (config, preferências)
  async getTenantContext(tenant_id: string): Promise<TenantContext> {
    // Cache Redis 5min → Supabase tenants
  }
}
```

### 5.5 Policy Layer

```typescript
// openclaw/policy-layer.ts
// Validações antes de qualquer execução no OpenClaw

export const policyLayer = {

  async canExecute(params: {
    tenant_id:  string
    agent_type: AgentType
    tool_name?: string
    token_cost?: number
  }): Promise<{ allowed: boolean; reason?: string }> {

    // 1. Agente ativo para este tenant?
    // 2. Subscription ativa?
    // 3. Token balance suficiente?
    // 4. Tool permitida para este agente?
    // 5. Skill ativa (se tool pertence a skill paga)?
    // 6. Limite de tool calls/dia não atingido?

    // Delega para packages/agents/policy.ts
  }
}
```

### 5.6 Telemetry

```typescript
// openclaw/telemetry.ts
// Registra execuções OpenClaw → tool_executions + incidents

// Já implementado em packages/agents/ledger.ts
// OpenClaw usa o ledger diretamente — sem duplicação

import { ledger } from '@ginkgo/agents'

export const telemetry = {
  trackAgentRun: ledger.write,
  trackIncident: ledger.incident,
  trackTokens:   ledger.debit
}
```

---

## 6. Fluxo por Agente

### Brann — Atendimento

```
Canal → n8n (webhook, persistência, envio)
     ↕ (casos cognitivos)
     OpenClaw/Brann (raciocínio, tools, RAG)

n8n faz: 90% dos jobs de atendimento
OpenClaw faz: a parte que exige inteligência
```

### Alfred — Operações

```
Trigger → n8n (webhook, cron, sync)
        → OpenClaw/Alfred (análise, SQL agent, relatório)
        → n8n (publicar resultado, enviar email, criar task)

OpenClaw faz: 70% do peso cognitivo
n8n faz: gatilhos + pós-processamento
```

### Nyra — Conteúdo

```
Briefing → OpenClaw/Nyra (interpretação, roteiro, copy, hashtags)
         → Workers (yt-dlp, FFmpeg, MoviePy, Whisper)
         → OpenClaw/Nyra (análise do output, aprovação automática)
         → n8n / Blotato / Postiz (publicação agendada)

OpenClaw faz: interpretação + geração de texto
Workers fazem: processamento de mídia (CPU intensivo)
n8n faz: distribuição e agendamento
```

### Command — Assistente Unificado

```
Telegram / Web → OpenClaw/Command (100% cognitivo)
              → OpenClaw delega para Brann/Alfred/Nyra se necessário
              → n8n para ações periféricas (alertas, syncs)

OpenClaw faz: praticamente tudo
n8n faz: apenas gatilhos e ações atômicas
```

---

## 7. Estrutura no Monorepo

```
/ginkgo-leaf
│
├── apps/
│   ├── web/                    ← Dashboard Next.js (sem mudança)
│   └── api/                    ← Ginkgo Core Fastify (sem mudança)
│
├── packages/
│   ├── agents/                 ← Kernel (executor, policy, ledger)
│   ├── openclaw-bridge/        ← ← ← NOVO
│   │   ├── index.ts            ← exports públicos
│   │   ├── client.ts           ← HTTP client para OpenClaw API
│   │   ├── session.ts          ← gerencia sessões via OpenClaw
│   │   └── types.ts            ← interfaces do bridge
│   ├── db/
│   ├── rag/
│   └── shared/
│
├── openclaw/                   ← ← ← NOVO (se self-hosted)
│   ├── agents/
│   │   ├── brann/
│   │   │   ├── config.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts
│   │   ├── alfred/
│   │   ├── nyra/
│   │   └── command/
│   ├── skills/                 ← skills cognitivas (não procedurais)
│   ├── prompts/                ← prompts base versionados
│   └── configs/                ← configs por tenant (cache)
│
├── workers/                    ← sem mudança (provisioning, ingestion, etc.)
├── infra/docker/               ← adicionar openclaw-runtime ao compose
├── n8n/workflows/              ← sem mudança
└── docs/
```

---

## 8. OpenClaw no Docker Compose

```yaml
# infra/docker/docker-compose.yml — adicionar

  openclaw-runtime:
    image: openclaw/runtime:latest   # ou build local se self-hosted
    restart: always
    environment:
      - OPENCLAW_MASTER_TOKEN=${OPENCLAW_MASTER_TOKEN}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379
      - GINKGO_API_URL=http://api:3001   # comunicação interna
    networks:
      - ginkgo-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.openclaw.rule=Host(`cmd.ginkgosystems.tech`)"
      - "traefik.http.routers.openclaw.entrypoints=websecure"
      - "traefik.http.routers.openclaw.tls.certresolver=le"
    depends_on:
      - redis
```

---

## 9. Contract entre Ginkgo Core e OpenClaw

### Ginkgo → OpenClaw

```typescript
// packages/openclaw-bridge/client.ts

export interface OpenClawRequest {
  tenant_id:       string
  agent_type:      AgentType
  session_id?:     string        // se conversa contínua
  user_message:    string
  channel:         string        // whatsapp | telegram | web | api
  context?: {
    conversation_id?: string
    contact_id?:      string
    metadata?:        Record<string, unknown>
  }
  idempotency_key?: string
}

export interface OpenClawResponse {
  execution_id:  string          // sempre presente (KI-1)
  session_id:    string
  response:      string
  tools_called:  string[]
  tokens_used:   number
  latency_ms:    number
  cached:        boolean
}

export async function callOpenClaw(req: OpenClawRequest): Promise<OpenClawResponse> {
  const res = await fetch(`${process.env.OPENCLAW_URL}/v1/execute`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENCLAW_MASTER_TOKEN}`
    },
    body: JSON.stringify(req)
  })
  return res.json()
}
```

### OpenClaw → Ginkgo (callbacks)

```typescript
// OpenClaw notifica Ginkgo sobre eventos relevantes
// via webhook interno (HTTP → api/src/modules/openclaw/webhook.ts)

interface OpenClawEvent {
  type: 'execution_complete' | 'handoff_triggered' | 'error' | 'approval_required'
  execution_id: string
  tenant_id:    string
  agent_type:   AgentType
  payload:      Record<string, unknown>
}

// Ginkgo processa e:
// → atualiza tool_executions (já feito pelo kernel)
// → dispara n8n workflow se necessário
// → notifica dashboard via Supabase Realtime
```

---

## 10. Billing e Observabilidade no Modelo OpenClaw-First

```
FLUXO DE TOKENS com OpenClaw como centro:

  1. Ginkgo Core verifica token_balance ANTES de autorizar chamada OpenClaw
  2. OpenClaw executa — usa packages/agents/executor internamente
  3. Executor debita tokens via ledger.debit() (atômico)
  4. Ginkgo Core recebe evento de completion com tokens_used
  5. Dashboard atualiza token health em tempo real (Supabase Realtime)

OBSERVABILIDADE:
  Toda execução OpenClaw → execution_id gerado (KI-1)
  Toda execução → tool_executions INSERT (KI-2)
  Latência e tokens → metering_summaries atualizado
  Falha → incident criado + alerta operador

Os 6 Kernel Invariants continuam valendo —
OpenClaw usa o mesmo executor, não contorna a governança.
```

---

## 11. Fase de Implementação

```
P1 (MVP Leaf — agora):
  OpenClaw usado APENAS para Command (Telegram)
  Brann ainda via n8n + packages/agents diretamente
  Razão: P1 não tem Command; n8n é suficiente para Brann MVP

P2 (Expansão):
  OpenClaw como runtime principal de Alfred e Nyra
  Brann migrado para OpenClaw (casos complexos)
  n8n continua para webhooks, syncs, notificações

P3 (Plataforma):
  OpenClaw = runtime central de TODOS os agentes
  n8n = exclusivamente automação procedural
  openclaw-bridge = package estável e documentado
  Marketplace de skills cognitivas via OpenClaw
```

---

## 12. O que NÃO muda

```
KERNEL (packages/agents):
  executor.ts, policy.ts, ledger.ts, db.ts
  Os 6 Kernel Invariants
  OpenClaw usa o kernel — não bypassa

BANCO DE DADOS:
  Schema Supabase inalterado
  tool_executions registra execuções OpenClaw normalmente
  RLS e isolamento multi-tenant inalterados

BILLING:
  Tokenização permanece na Ginkgo
  OpenClaw consome tokens do balance do tenant
  Ginkgo cobra o markup — OpenClaw não sabe o custo real

GOVERNANÇA:
  OpenClaw não tem acesso direto ao billing
  OpenClaw não provisiona tenants
  OpenClaw não gerencia skills
  Tudo isso permanece na Ginkgo Core
```

---

## 13. Regra de Ouro — Resumo

```
"O que vai para OpenClaw vs n8n?"

  OPENCLAW                    n8n
  ─────────────────────       ─────────────────────────
  Raciocínio                  Gatilho (webhook recebido)
  Contexto e memória          Sequência fixa de passos
  Escolha de tool             Integração procedural
  Interpretação               Sincronização periódica
  Geração de conteúdo         Job agendado (cron)
  Decisão adaptativa          Notificação / alerta
  Coordenação entre agentes   Persistência de dados simples
  Delegação inteligente       Pós-processamento de mídia
```

---

*Ginkgo AI Systems — OPENCLAW-ARCHITECTURE.md v1.0.0 — Março 2026*  
*OpenClaw = coração vivo. n8n = sistema reflexo. Ginkgo = sistema operacional.*
