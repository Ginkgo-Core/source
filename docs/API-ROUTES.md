# API-ROUTES.md
## Contrato Completo da API — Ginkgo AI Systems
### apps/api (Fastify + TypeScript)

> **Base URL produção:** `https://api.ginkgosystems.tech`  
> **Base URL local:** `http://localhost:3001`  
> **Auth:** Bearer JWT (Supabase) em todo endpoint autenticado  
> **Tenant:** `X-Tenant-ID` header obrigatório em rotas de tenant

---

## Middleware Global

```typescript
// Toda request autenticada passa por:
// 1. validateJWT()      → verifica token Supabase
// 2. resolveTenant()    → extrai tenant_id do JWT ou header
// 3. checkEntitlement() → valida plano para rotas premium
// 4. rateLimit()        → 100 req/min por IP (public), 300 req/min (auth)
```

---

## Auth

### POST /auth/register
Cria tenant, profile, membership, token balance e Stripe customer.

```typescript
// Request
{
  userId:       string  // auth.users.id do Supabase
  email:        string
  businessName: string
  segment:      string  // imobiliaria | clinica | ecommerce | servico | outro
  phone?:       string
}

// Response 201
{
  tenant_id:    string
  slug:         string
  onboarding_url: string  // '/onboarding'
}

// Errors
401 → JWT inválido
409 → email já existe
422 → campos obrigatórios ausentes
```

### POST /auth/complete-profile
Chamado após signup para adicionar dados extras do onboarding.

```typescript
// Request (autenticado)
{
  whatsapp_number?: string
  segment?:         string
  city?:            string
}

// Response 200
{ updated: true }
```

---

## Dashboard

### GET /dashboard/kpis
KPIs em tempo real para o overview do dashboard.

```typescript
// Headers: Authorization, X-Tenant-ID
// Query: ?period=today|7d|30d (default: today)

// Response 200
{
  conversations:  number   // conversas no período
  leads:          number   // leads capturados
  hot_leads:      number   // score >= 70
  handoffs:       number   // transferências para humano
  tokens_used:    number   // tokens consumidos
  cost_brl:       number   // custo estimado em R$
  handoff_rate:   number   // % de conversas com handoff
  rag_hit_rate:   number   // % de buscas com similarity >= 0.70
}
```

### GET /dashboard/activity
Dados para o gráfico de atividade (últimos 7 ou 30 dias).

```typescript
// Query: ?days=7|30 (default: 7)

// Response 200
{
  data: [
    {
      date:       string   // YYYY-MM-DD
      messages:   number
      leads:      number
      handoffs:   number
    }
  ]
}
```

### GET /dashboard/feed
Últimas mensagens para o feed ao vivo.

```typescript
// Query: ?limit=20&channel=whatsapp|telegram|all

// Response 200
{
  items: [
    {
      id:           string
      contact_name: string
      contact_phone: string
      message:      string
      channel:      string
      score:        number
      tier:         string   // hot | warm | cold
      agent:        string
      created_at:   string
    }
  ]
}
```

### GET /dashboard/alerts
Alertas ativos: leads quentes sem resposta, handoffs pendentes, incidentes.

```typescript
// Response 200
{
  alerts: [
    {
      type:        string   // hot_lead | pending_handoff | incident
      severity:    string   // high | medium | low
      message:     string
      resource_id: string
      created_at:  string
    }
  ]
}
```

---

## Canais

### GET /channels
Lista todos os canais do tenant com status.

```typescript
// Response 200
{
  channels: [
    {
      id:          string
      type:        string   // whatsapp | telegram | instagram | webchat
      name:        string
      status:      string   // active | disconnected | error
      config:      object   // sem secrets
      messages_today: number
      last_seen_at: string
    }
  ]
}
```

### GET /channels/:id/status
Status em tempo real de um canal (útil para polling do dashboard).

```typescript
// Response 200
{
  id:         string
  type:       string
  status:     string
  qr_code?:   string   // base64 — só quando type=whatsapp e status=connecting
  error?:     string
}
```

### POST /channels/:id/reconnect
Força reconexão do canal (especialmente WhatsApp).

```typescript
// Response 200
{ reconnecting: true, qr_url?: string }
```

---

## Conversas

### GET /conversations
Lista conversas com filtros e paginação.

```typescript
// Query:
//   status=open|handoff|closed|all (default: open)
//   channel=whatsapp|telegram|all
//   agent=brann|alfred|human|all
//   tier=hot|warm|cold|all
//   page=1, limit=20

// Response 200
{
  conversations: [
    {
      id:             string
      contact:        { id, name, phone, tags, score, tier }
      channel:        string
      assigned_agent: string
      status:         string
      last_message:   string
      opened_at:      string
      updated_at:     string
    }
  ],
  total:    number
  page:     number
  has_more: boolean
}
```

### GET /conversations/:id
Detalhe completo de uma conversa com histórico de mensagens.

```typescript
// Response 200
{
  conversation: {
    id, status, channel, assigned_agent, opened_at, closed_at
    contact: { id, name, phone, email, tags, score, tier, reason_json }
    messages: [
      { id, sender_type, content, content_type, created_at }
    ]
    tool_calls: [
      { tool_name, success, latency_ms, created_at }
    ]
  }
}
```

### POST /conversations/:id/handoff
Força handoff manual de uma conversa.

```typescript
// Request
{ reason: string, summary?: string }

// Response 200
{ handoff_id: string, chatwoot_ticket_id: string }
```

### POST /conversations/:id/close
Fecha uma conversa.

```typescript
// Response 200
{ closed: true, closed_at: string }
```

---

## Leads

### GET /leads
Lista leads com filtros e ordenação.

```typescript
// Query:
//   tier=hot|warm|cold|all
//   channel=whatsapp|all
//   from=YYYY-MM-DD, to=YYYY-MM-DD
//   sort=score|created_at (default: score)
//   page=1, limit=20

// Response 200
{
  leads: [
    {
      id:          string
      name:        string
      phone:       string
      email?:      string
      tags:        string[]
      score:       number
      tier:        string
      channel:     string
      agent:       string
      reason_json: object
      last_seen_at: string
      created_at:  string
    }
  ],
  total: number
}
```

### GET /leads/:id
Detalhe do lead com histórico de score e conversas.

```typescript
// Response 200
{
  contact:      { ...campos completos }
  score_history: [{ score, tier, reason_json, updated_at }]
  conversations: [{ id, status, channel, opened_at }]
}
```

---

## Knowledge (RAG)

### GET /knowledge
Lista documentos da base de conhecimento.

```typescript
// Query: ?status=indexed|pending|error|all, ?page=1, ?limit=20

// Response 200
{
  assets: [
    {
      id:            string
      title:         string
      type:          string   // pdf | md | url | txt
      status:        string
      chunks_count:  number
      file_size_bytes: number
      created_at:    string
      indexed_at?:   string
      error_message?: string
    }
  ],
  total: number
}
```

### POST /knowledge/upload
Faz upload de um documento e inicia pipeline de ingestão.

```typescript
// Content-Type: multipart/form-data
// Fields:
//   file:  File (PDF, DOC, TXT, MD — max 10MB)
//   title: string

// Response 202 (Accepted — processamento async)
{
  asset_id: string
  status:   'processing'
  job_id:   string
}
```

### POST /knowledge/ingest-url
Indexa uma URL pública.

```typescript
// Request
{ url: string, title: string }

// Response 202
{ asset_id: string, status: 'processing', job_id: string }
```

### POST /knowledge/ingest-text
Indexa texto puro (FAQ, catálogo, etc.).

```typescript
// Request
{ title: string, content: string, tags?: string[] }

// Response 202
{ asset_id: string, status: 'processing', job_id: string }
```

### DELETE /knowledge/:id
Remove documento e todos os chunks associados.

```typescript
// Response 200
{ deleted: true, chunks_removed: number }
```

### GET /knowledge/search
Testa busca RAG (útil para validação no dashboard).

```typescript
// Query: ?q=string&top_k=5

// Response 200
{
  results: [
    {
      chunk_id:    string
      asset_title: string
      chunk_text:  string
      similarity:  number
    }
  ]
}
```

---

## Agentes

### GET /agents
Lista agentes do tenant com status e config.

```typescript
// Response 200
{
  agents: [
    {
      id:             string
      type:           string   // brann | alfred | nyra | command
      name:           string
      enabled:        boolean
      model:          string
      temperature:    number
      prompt_version: string
      tools_enabled:  string[]
      token_health:   number   // 0-100 (% do saldo)
      status:         string   // working | idle | tired | sleeping | error
      stats_today:    { messages, tool_calls, avg_latency_ms }
    }
  ]
}
```

### PUT /agents/:type
Atualiza configuração de um agente.

```typescript
// Request
{
  enabled?:     boolean
  temperature?: number
  max_tokens?:  number
  tools_enabled?: string[]
  config_json?: object
}

// Response 200
{ updated: true, agent: { ...campos atualizados } }
```

### GET /agents/:type/prompts
Lista versões de prompt de um agente.

```typescript
// Response 200
{
  versions: [
    { id, version, active, changelog, created_at }
  ]
}
```

### POST /agents/:type/prompts
Cria nova versão de prompt.

```typescript
// Request
{ content: string, changelog?: string, activate?: boolean }

// Response 201
{ version_id: string, version: string, active: boolean }
```

### POST /agents/:type/prompts/:version/activate
Ativa uma versão específica de prompt.

```typescript
// Response 200
{ activated: true, version: string }
```

---

## Billing

### GET /billing/plan
Plano atual e status da assinatura.

```typescript
// Response 200
{
  plan:          string
  status:        string   // trialing | active | past_due | canceled
  trial_ends_at?: string
  period_start:  string
  period_end:    string
  token_balance: number
  token_used:    number
  token_included: number
}
```

### GET /billing/usage
Uso detalhado do período atual.

```typescript
// Response 200
{
  messages_count:  number
  documents_count: number
  tool_calls:      number
  handoffs:        number
  tokens_used:     number
  cost_usd:        number
  cost_brl:        number
  period:          string   // YYYY-MM
}
```

### GET /billing/invoices
Histórico de faturas.

```typescript
// Response 200
{
  invoices: [
    { id, period, amount_brl, status, pdf_url, paid_at }
  ]
}
```

### POST /billing/checkout
Cria sessão de checkout Stripe para upgrade de plano.

```typescript
// Request
{ plan: 'starter' | 'business' | 'scale' }

// Response 200
{ checkout_url: string }   // redirect para Stripe Checkout
```

### POST /billing/portal
Cria sessão do Stripe Customer Portal (gerenciar assinatura).

```typescript
// Response 200
{ portal_url: string }
```

### POST /billing/tokens
Cria sessão de checkout para pacote de tokens.

```typescript
// Request
{ package: 'starter' | 'growth' | 'scale' }
// starter: 500k tokens R$79 | growth: 2M R$249 | scale: 10M R$890

// Response 200
{ checkout_url: string }
```

---

## Integrações OAuth

### GET /integrations
Lista integrações do tenant com status.

```typescript
// Response 200
{
  integrations: [
    {
      provider:       string
      status:         string   // connected | expired | error | disconnected
      connected_at?:  string
      last_sync_at?:  string
      metadata:       object   // page_id, ig_account_id, etc — sem tokens
    }
  ]
}
```

### GET /oauth/:provider/connect
Inicia fluxo OAuth. Redireciona para o provider.

```
GET /oauth/google/connect   → Google consent screen
GET /oauth/meta/connect     → Meta Login
GET /oauth/tiktok/connect   → TikTok OAuth
GET /oauth/linkedin/connect → LinkedIn OAuth
```

### GET /oauth/:provider/callback
Callback OAuth. Troca code por tokens, salva criptografado.

```typescript
// Query: ?code=string&state=string
// Response: redirect para /settings/integrations
```

### DELETE /integrations/:provider
Desconecta integração e remove tokens.

```typescript
// Response 200
{ disconnected: true }
```

---

## Webhooks Externos

### POST /webhooks/stripe
Recebe eventos do Stripe.

```typescript
// Headers: stripe-signature (validado com STRIPE_WEBHOOK_SECRET)

// Eventos tratados:
//   checkout.session.completed
//   invoice.paid
//   customer.subscription.deleted
//   payment_intent.succeeded
//   invoice.payment_failed

// Response 200 (sempre — Stripe exige 200 mesmo em erro interno)
{ received: true }
```

### POST /webhooks/evolution
Recebe eventos da Evolution API (mensagens WhatsApp).

```typescript
// Headers: x-webhook-secret (validado com WEBHOOK_SECRET)

// Eventos tratados:
//   messages.upsert     → processar mensagem
//   connection.update   → atualizar status do canal

// Response 200
{ received: true }
```

---

## Health

### GET /health
Status geral da API.

```typescript
// Response 200
{
  status:    'ok'
  version:   string
  timestamp: string
}
```

### GET /health/db
Status da conexão com Supabase.

```typescript
// Response 200
{ status: 'ok', tables: number, latency_ms: number }
// Response 503 se falhar
```

### GET /health/redis
Status do Redis.

```typescript
// Response 200
{ status: 'ok', latency_ms: number }
```

---

## Códigos de erro padrão

| Código | Significado |
|--------|-------------|
| 400 | Payload inválido |
| 401 | JWT ausente ou expirado |
| 402 | Plano não inclui este recurso |
| 403 | Sem permissão (role insuficiente) |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: email já existe) |
| 422 | Campos obrigatórios ausentes |
| 429 | Rate limit excedido |
| 500 | Erro interno — sempre loga em `incidents` |
| 503 | Dependência externa indisponível |

---

*Ginkgo AI Systems — API-ROUTES.md v1.0.0 — Março 2026*
