# GINKGO-SYSTEM-DIAGRAM.md
## Diagrama Técnico Completo da Plataforma
### A planta da empresa

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Status:** Referência canônica  
> **Regra:** Todo novo componente deve aparecer aqui antes de ser construído.

---

## 1. Visão Macro — A Árvore Tecnológica

```
USUÁRIOS / CLIENTES / OPERADORES
         │
         ▼
    CLOUDFLARE
  CDN · WAF · DDoS
         │
    ┌────┴────┐
    │         │
  VERCEL    HOSTINGER VPS
  apps/web   apps/api
  Next.js    Fastify
    │         │
    └────┬────┘
         │
    API CORE (Fastify)
  Auth · Tenants · Billing
  RAG · Agents · Tools
  Webhooks · Skills
         │
    ┌────┼────┐
    │         │
WORKERS    DATA LAYER
Async      Supabase
Jobs       pgvector
           Redis
         │
    SERVIÇOS EXTERNOS
  Evolution · Chatwoot · OpenClaw
  Stripe · OpenAI · Perplexity
  Meta · Google · TikTok · Shopify
```

---

## 2. Diagrama Completo de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE (Edge Layer)                             │
│  DNS · CDN · WAF · DDoS · SSL · Rate Limit · Bot Protection                 │
│                                                                              │
│  ginkgosystems.tech  app.*  api.*  n8n.*  wa.*  chat.*  hooks.*             │
└──────────────┬───────────────────────────────────┬──────────────────────────┘
               │                                   │
               ▼                                   ▼
  ┌────────────────────────┐         ┌─────────────────────────────┐
  │        VERCEL          │         │      HOSTINGER VPS          │
  │                        │         │      Docker + Traefik       │
  │  apps/web              │         │                             │
  │  ├ (auth)/             │         │  ┌─────────────────────┐   │
  │  │  login              │         │  │   apps/api          │   │
  │  │  register           │         │  │   Fastify + TS      │   │
  │  │  callback           │         │  │                     │   │
  │  ├ (dashboard)/        │         │  │  modules/           │   │
  │  │  overview           │         │  │  ├ auth             │   │
  │  │  conversations      │         │  │  ├ tenants          │   │
  │  │  leads              │         │  │  ├ billing          │   │
  │  │  channels           │         │  │  ├ agents           │   │
  │  │  content            │         │  │  ├ rag              │   │
  │  │  agents             │         │  │  ├ tools            │   │
  │  │  knowledge          │         │  │  ├ skills           │   │
  │  │  billing            │         │  │  ├ integrations     │   │
  │  │  settings           │         │  │  └ webhooks         │   │
  │  └ api/ (BFF)          │         │  └─────────────────────┘   │
  │                        │         │                             │
  │  lib/                  │         │  ┌─────────────────────┐   │
  │  ├ supabase/server     │         │  │       n8n           │   │
  │  ├ supabase/client     │         │  │  (Workflows)        │   │
  │  └ get-tenant          │         │  │                     │   │
  │                        │         │  │  WA-Brann-Atend.   │   │
  │  components/           │         │  │  Lead-Score        │   │
  │  ├ ui/ (shadcn)        │         │  │  Handoff-Chatwoot  │   │
  │  ├ charts/ (Recharts)  │         │  │  RAG-Ingestion     │   │
  │  ├ feeds/ (Realtime)   │         │  │  Daily-Summary     │   │
  │  └ skills/ (UI ext)    │         │  │  Nyra-Reels        │   │
  └────────────────────────┘         │  │  Alfred-Reports    │   │
                                     │  └─────────────────────┘   │
                                     │                             │
                                     │  ┌─────────────────────┐   │
                                     │  │  Evolution API      │   │
                                     │  │  WhatsApp connector │   │
                                     │  │  multi-instância    │   │
                                     │  └─────────────────────┘   │
                                     │                             │
                                     │  ┌─────────────────────┐   │
                                     │  │     Chatwoot        │   │
                                     │  │  Human inbox        │   │
                                     │  │  + sidekiq worker   │   │
                                     │  └─────────────────────┘   │
                                     │                             │
                                     │  ┌─────────────────────┐   │
                                     │  │      Redis          │   │
                                     │  │  cache · sessions   │   │
                                     │  │  queues · pub/sub   │   │
                                     │  └─────────────────────┘   │
                                     └─────────────────────────────┘
```

---

## 3. Data Layer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE CLOUD                                     │
│                                                                              │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │    POSTGRES 15   │  │    pgvector     │  │   SUPABASE AUTH            │ │
│  │                  │  │                 │  │                            │ │
│  │  LOTE 1 (core)   │  │  knowledge_     │  │  auth.users                │ │
│  │  tenants         │  │  chunks         │  │  JWT + cookies             │ │
│  │  profiles        │  │  VECTOR(1536)   │  │  OAuth providers           │ │
│  │  memberships     │  │                 │  │  Email templates           │ │
│  │  plan_limits     │  │  INDEX hnsw     │  │                            │ │
│  │  audit_logs      │  │  (cosine ops)   │  │  Trigger:                  │ │
│  │                  │  │                 │  │  on_auth_user_created      │ │
│  │  LOTE 2 (leaf)   │  │  INDEX gin      │  │  → profiles INSERT         │ │
│  │  channels        │  │  (full-text PT) │  │  → pg_notify API           │ │
│  │  contacts        │  │                 │  └────────────────────────────┘ │
│  │  conversations   │  └─────────────────┘                                 │
│  │  messages        │                       ┌────────────────────────────┐ │
│  │  lead_scores     │  ┌─────────────────┐  │   SUPABASE STORAGE         │ │
│  │  appointments    │  │  LOTE 3 (rag)   │  │                            │ │
│  │                  │  │  knowledge_     │  │  /{tenant_id}/             │ │
│  │  LOTE 4 (agents) │  │  sources        │  │    knowledge/              │ │
│  │  agents          │  │  knowledge_     │  │    content/                │ │
│  │  prompt_versions │  │  assets         │  │    uploads/                │ │
│  │  tool_registry   │  │  knowledge_     │  │                            │ │
│  │  tool_executions │  │  chunks ←───────┼──┤  Buckets isolados          │ │
│  │  skills          │  │  retrieval_logs │  │  por tenant_id             │ │
│  │  tenant_skills   │  │  ingestion_jobs │  └────────────────────────────┘ │
│  │                  │  └─────────────────┘                                 │
│  │  LOTE 5 (obs)    │                                                       │
│  │  incidents       │  RLS ATIVO EM:                                        │
│  │  usage_events    │  contacts · conversations · messages                  │
│  │  metering_summ.  │  knowledge_chunks · knowledge_assets                  │
│  │  [4 views]       │  lead_scores · token_balances                         │
│  │                  │  token_transactions · tool_executions                 │
│  │  LOTE 6 (billing)│  incidents                                            │
│  │  subscriptions   │                                                       │
│  │  token_balances  │  TOTAL: 40+ tabelas · 9 lotes migration               │
│  │  token_txns      │                                                       │
│  │  invoices        │                                                       │
│  │                  │                                                       │
│  │  LOTE 7 (integr) │                                                       │
│  │  integrations    │                                                       │
│  │  meta_metrics    │                                                       │
│  │  gmb_metrics     │                                                       │
│  │  tiktok_metrics  │                                                       │
│  │  ads_metrics     │                                                       │
│  │  news_items      │                                                       │
│  │  editorial_cal.  │                                                       │
│  └──────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                               REDIS                                         │
│                                                                              │
│  Sessões de agentes    │  Filas de workers      │  Cache de dados           │
│  rate limiting         │  queue:provisioning    │  token_balances cache     │
│  pub/sub eventos       │  queue:ingestion       │  prompt_versions cache    │
│                        │  queue:sync            │  session context          │
│                        │  queue:metering        │                           │
│                        │  queue:notifications   │                           │
│                        │  queue:*:failed        │  (dead letter)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Agent Runtime — Fluxo Completo

```
CANAL DE ENTRADA
  WhatsApp (Evolution)  Telegram (OpenClaw)  Webchat (OpenClaw)
         │                      │                    │
         └──────────────────────┼────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   WEBHOOK GATEWAY     │
                    │  (apps/api)           │
                    │                       │
                    │  POST /webhooks/      │
                    │  evolution            │
                    │                       │
                    │  Valida:              │
                    │  WEBHOOK_SECRET       │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   TENANT RESOLVER     │
                    │                       │
                    │  instance_name        │
                    │  → tenant_id          │
                    │  → channel_id         │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   SESSION MANAGER     │
                    │                       │
                    │  SELECT messages      │
                    │  WHERE conv_id = $x   │
                    │  ORDER BY created ASC │
                    │  LIMIT 12             │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   AGENT RESOLVER      │
                    │                       │
                    │  channel → agent type │
                    │  whatsapp → brann     │
                    │  telegram → command   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │    POLICY CHECK       │
                    │                       │
                    │  plan entitlement?    │
                    │  tool permitted?      │
                    │  token balance > 0?   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   PROMPT BUILDER      │
                    │                       │
                    │  SELECT content FROM  │
                    │  prompt_versions      │
                    │  WHERE active=true    │
                    │                       │
                    │  + context (12 msgs)  │
                    │  + RAG chunks (top-5) │
                    │  + tool specs (JSON)  │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │     LLM CALL          │
                    │                       │
                    │  OpenAI gpt-4o        │
                    │  temperature: 0.4     │
                    │  max_tokens: 800      │
                    │  tools: [...]         │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┴──────────────────┐
              │                                    │
        text response                        tool_calls
              │                                    │
              │                     ┌──────────────▼──────────────┐
              │                     │      TOOL DISPATCHER        │
              │                     │                             │
              │                     │  search_knowledge           │
              │                     │  create_lead                │
              │                     │  fetch_catalog              │
              │                     │  handoff_human              │
              │                     │  schedule_appointment       │
              │                     └──────────────┬──────────────┘
              │                                    │
              │                     ┌──────────────▼──────────────┐
              │                     │      TOOL EXECUTOR          │
              │                     │                             │
              │                     │  validate input schema      │
              │                     │  check tenant scope         │
              │                     │  execute function           │
              │                     │  INSERT tool_executions     │
              │                     └──────────────┬──────────────┘
              │                                    │
              │                     reinject result as role=tool
              │                                    │
              │                     ← max 1 reinject → LLM again
              │
    ┌─────────▼─────────┐
    │  RESPONSE FORMAT  │
    │                   │
    │  Strip markdown   │
    │  (WhatsApp)       │
    │  sanitize output  │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │   CANAL SAÍDA     │
    │                   │
    │  Evolution API    │
    │  sendText         │
    │  + typing delay   │
    │  1200ms           │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │    METERING       │
    │                   │
    │  UPDATE           │
    │  token_balances   │
    │  balance -= used  │
    │                   │
    │  INSERT           │
    │  token_txns       │
    │  usage_events     │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  OBSERVABILITY    │
    │                   │
    │  INSERT           │
    │  tool_executions  │
    │  { tenant_id      │
    │    agent_type     │
    │    tool_name      │
    │    latency_ms     │
    │    tokens_used    │
    │    success }      │
    └───────────────────┘
```

---

## 5. RAG Pipeline — Ingestão e Retrieval

```
INGESTÃO
─────────────────────────────────────────────────────────

FONTE                         WORKER-INGESTION
  PDF upload                      │
  URL pública          POST /webhook/ingest-document
  Google Docs    ───►  INSERT knowledge_assets (pending)
  FAQ texto            enqueue('ingestion', ...)
                                  │
                    ┌─────────────▼──────────────┐
                    │      EXTRACT               │
                    │                            │
                    │  PDF  → pdf-parse          │
                    │  URL  → fetch + strip HTML │
                    │  DOC  → mammoth            │
                    │  Audio → Whisper API       │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      NORMALIZE             │
                    │                            │
                    │  encoding UTF-8            │
                    │  remove null bytes         │
                    │  collapse whitespace       │
                    │  detect language           │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      CHUNK                 │
                    │                            │
                    │  target: 600 tokens        │
                    │  overlap: 100 tokens       │
                    │  split: para > sent > fixed│
                    │                            │
                    │  metadata per chunk:       │
                    │  { tenant_id              │
                    │    asset_id               │
                    │    chunk_index            │
                    │    title, section, page } │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      EMBED (batch 20)      │
                    │                            │
                    │  OpenAI                    │
                    │  text-embedding-3-small    │
                    │  1536 dimensions           │
                    │                            │
                    │  retry: backoff 5s         │
                    │  on rate limit             │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      INDEX (pgvector)      │
                    │                            │
                    │  INSERT knowledge_chunks   │
                    │  WITH embedding VECTOR     │
                    │                            │
                    │  INDEX hnsw                │
                    │  (cosine ops)              │
                    │  m=16, ef_construction=64  │
                    └─────────────┬──────────────┘
                                  │
                    UPDATE knowledge_assets
                    status = 'indexed'


RETRIEVAL
─────────────────────────────────────────────────────────

QUERY DO AGENTE
  "Quais são os planos?"
         │
         ▼
  EMBED QUERY
  text-embedding-3-small
  → vector[1536]
         │
    ┌────┴────┐
    │         │
VETORIAL   LEXICAL
pgvector   Postgres
cosine     full-text
top-20     top-20
    │         │
    └────┬────┘
         │
    MERGE + DEDUP
    por chunk_id
         │
    FILTROS
    WHERE tenant_id = $tenant
    AND status = 'indexed'
    AND sensitivity <= $level
         │
    RERANK
    score combinado
    vetorial * 0.7 + lexical * 0.3
         │
    TOP-K FINAL
    Brann: 5 chunks
    Alfred/Command: 8 chunks
         │
    FORMAT CONTEXT
    "[Fonte: {title}]\n{chunk_text}\n"
         │
    INSERT retrieval_logs
    { query, top_chunks jsonb,
      score_avg, agent }
         │
    INJECT INTO PROMPT
    como role: "system" adicional
```

---

## 6. Worker Queue — Fluxo Completo

```
PRODUCERS                    REDIS QUEUES              WORKERS
─────────                    ────────────              ───────

API /auth/register    ──►  queue:provisioning  ──►  worker-provisioning
                                                    ├ create Evolution instance
                                                    ├ create Chatwoot inbox
                                                    ├ seed agent config
                                                    └ enqueue welcome email

POST /knowledge/upload ──►  queue:ingestion    ──►  worker-ingestion
RAG webhook           ──►                          ├ extract text
                                                    ├ normalize
                                                    ├ chunk (600 tok)
                                                    ├ embed (batch 20)
                                                    └ insert pgvector

CRON 4h worker-sync   ──►  queue:sync         ──►  worker-sync (cron)
                                                    ├ meta_metrics
                                                    ├ gmb_metrics
                                                    ├ tiktok_metrics
                                                    ├ perplexity news feed
                                                    └ refresh OAuth tokens

tool_executions       ──►  queue:metering     ──►  worker-metering
stripe webhooks       ──►                          ├ debit token_balances
                                                    ├ refill on invoice.paid
                                                    └ alert on balance < 20%

incidents severity≥md ──►  queue:notifications──►  worker-notifications
trial expiring        ──►                          ├ send_whatsapp (operator)
balance low           ──►                          ├ send_welcome_email
                                                    ├ send_low_balance_alert
                                                    └ send_daily_summary

                           queue:*:failed          (dead letter — 3 attempts)
                                ▼
                           incidents table
                           + operator alert
```

---

## 7. Billing — Fluxo Stripe

```
USUÁRIO                  STRIPE                    SUPABASE
───────                  ──────                    ────────

Escolhe plano ──► POST /billing/checkout
                       │
               Stripe Checkout Session
               (redirect)
                       │
               Pagamento realizado
                       │
               webhook: checkout.session.completed
                       │─────────────────────────►  subscriptions
                                                    status = 'active'
                       │─────────────────────────►  token_balances
                                                    balance += plan_tokens
                       │─────────────────────────►  token_transactions
                                                    type = 'plan_refill'

Mensal         ──► webhook: invoice.paid
                       │─────────────────────────►  token_balances
                                                    balance = plan_tokens
                                                    used_period = 0

Cancela        ──► webhook: subscription.deleted
                       │─────────────────────────►  subscriptions
                                                    status = 'canceled'
                       │                            agents paused

Compra tokens  ──► POST /billing/tokens
                       │
               Payment Intent
                       │
               webhook: payment_intent.succeeded
                       │─────────────────────────►  token_balances
                                                    balance += tokens
                       │─────────────────────────►  token_transactions
                                                    type = 'purchase'

CONSUMO (a cada execução de agente)
                  tool_executions INSERT
                       │
                  worker-metering
                       │─────────────────────────►  token_balances
                                                    balance -= used
                       │─────────────────────────►  usage_events
                                                    quantity = tokens
```

---

## 8. Tenant Provisioning — Fluxo Completo

```
USUÁRIO preenche formulário de registro
  name, email, password, businessName, segment
         │
         ▼
[1] Supabase Auth.signUp()
  → INSERT auth.users
  → TRIGGER on_auth_user_created dispara:
      INSERT profiles (id = auth.user_id, email, name)
      pg_notify('new_user_registered', payload)
         │
         ▼
[2] API POST /auth/register
  (chamado pelo frontend após signUp)
         │
  ┌──────▼──────────────────────────────────┐
  │          TRANSACTION                    │
  │                                         │
  │  a. INSERT tenants                      │
  │     { name, slug, plan='starter',       │
  │       status='trialing' }               │
  │                                         │
  │  b. UPDATE profiles                     │
  │     SET tenant_id = new_tenant.id       │
  │                                         │
  │  c. INSERT memberships                  │
  │     { tenant_id, profile_id,            │
  │       role = 'owner' }                  │
  │                                         │
  │  d. INSERT subscriptions                │
  │     { tenant_id, plan='starter',        │
  │       status='trialing',                │
  │       stripe_customer_id (Stripe API) } │
  │                                         │
  │  e. INSERT token_balances               │
  │     { balance = 600000 }                │
  │                                         │
  │  f. INSERT tenant_skills                │
  │     { skill_id = leaf-core.id }         │
  │                                         │
  └──────┬──────────────────────────────────┘
         │
         ▼
[3] enqueue('provisioning', 'create_tenant_resources')
  → ASYNC worker-provisioning:
      POST Evolution API /instance/create
      POST Chatwoot /inboxes
      INSERT channels { type='whatsapp', status='connecting' }
      enqueue('notifications', 'send_welcome_email')
         │
         ▼
[4] response: { tenant_id, onboarding_url: '/onboarding' }
         │
         ▼
[5] ONBOARDING WIZARD (apps/web/app/(dashboard)/onboarding)
  Passo 1: Conectar WhatsApp (QR Evolution)
  Passo 2: Upload FAQ / catálogo
  Passo 3: Preview Brann respondendo
  Passo 4: Dashboard ativo
         │
         ▼
TENANT ATIVO — Brann operando
```

---

## 9. Integrações — Mapa Completo

```
CANAIS DE ATENDIMENTO
┌─────────────────────────────────────────────────────────────┐
│  WhatsApp           Evolution API      webhook → n8n        │
│  Telegram           OpenClaw           per-tenant instance  │
│  Webchat            OpenClaw           embedded widget      │
│  Instagram DM       Meta Graph API     webhook              │
│  Chatwoot           REST API           handoff inbox        │
└─────────────────────────────────────────────────────────────┘

REDES SOCIAIS (OAuth 2.0 → integrations table)
┌─────────────────────────────────────────────────────────────┐
│  Instagram     Meta OAuth    insights, posts, reels         │
│  Facebook      Meta OAuth    page insights, posts, ads      │
│  TikTok        TikTok OAuth  views, trends, sounds          │
│  YouTube       Google OAuth  views, watch time, subs        │
│  LinkedIn      LinkedIn OAuth impressions, followers         │
│  X (Twitter)   X OAuth 2.0  impressões, mentions           │
│  Threads       Meta OAuth    impressões, replies            │
└─────────────────────────────────────────────────────────────┘

TRÁFEGO PAGO (worker-sync a cada 4–6h → ads_metrics)
┌─────────────────────────────────────────────────────────────┐
│  Meta Ads      Meta Marketing API   spend, ROAS, CPC        │
│  TikTok Ads    TikTok Ads API       spend, plays, CPM       │
│  Google Ads    Google Ads API       CPC, CPA, quality score │
└─────────────────────────────────────────────────────────────┘

NEGÓCIO LOCAL
┌─────────────────────────────────────────────────────────────┐
│  Google My Business  Google OAuth   views, cliques, reviews │
│  Google Analytics 4  Google OAuth   sessões, conversões     │
└─────────────────────────────────────────────────────────────┘

PRODUTIVIDADE (RAG + automação)
┌─────────────────────────────────────────────────────────────┐
│  Google Drive   Google OAuth   docs → RAG ingestion         │
│  Google Docs    Google OAuth   docs → RAG ingestion         │
│  Gmail          Google OAuth   emails → RAG ingestion       │
│  Calendar       Google OAuth   agendamentos                 │
│  ClickUp        OAuth          tasks, projetos, status      │
└─────────────────────────────────────────────────────────────┘

E-COMMERCE
┌─────────────────────────────────────────────────────────────┐
│  Shopify        OAuth + webhook  pedidos, produtos, clientes│
│  Shopee         API Key          pedidos, produtos          │
│  AliExpress     API Key          catálogo, fornecedores     │
└─────────────────────────────────────────────────────────────┘

CRIAÇÃO DE CONTEÚDO (Nyra skills)
┌─────────────────────────────────────────────────────────────┐
│  ElevenLabs     API Key    voz IA para narração             │
│  HeyGen         API Key    avatar IA em vídeo               │
│  Gamma AI       API Key    apresentações automáticas        │
│  Blotato        API Key    social cards + publicação multi  │
└─────────────────────────────────────────────────────────────┘

LLM PROVIDERS
┌─────────────────────────────────────────────────────────────┐
│  OpenAI gpt-4o             agentes (function calling)       │
│  text-embedding-3-small    RAG embeddings (1536 dims)       │
│  Whisper                   transcrição de áudio             │
│  Perplexity sonar-pro      news feed + insights             │
│  Claude API                documentação longa (opcional)    │
└─────────────────────────────────────────────────────────────┘

BILLING + INFRA
┌─────────────────────────────────────────────────────────────┐
│  Stripe         checkout, subscriptions, webhooks, Connect  │
│  Resend         email transacional (boas-vindas, alertas)   │
│  Cloudflare     DNS, CDN, WAF, DDoS, SSL                   │
│  Vercel         deploy frontend (Next.js)                   │
│  Hostinger VPS  backend + workers + n8n + Evolution         │
│  Supabase       banco, auth, storage, pgvector              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Failure Modes — Árvore de Decisão

```
FALHA DETECTADA
      │
      ▼
  Qual componente?
      │
  ┌───┼───────────────────────────────────────────────┐
  │   │                                               │
  ▼   ▼                                               ▼
LLM  EVOLUTION                                    SUPABASE
      │                                               │
retry?  │  instância offline?                   banco down?
  │   │         │                                    │
  ▼   │    alerta op.                          parar operações
  1x  │    pausar flows                        incident crítico
  │   │    handoff manual                      tela manutenção
  │   │
fail  │
  │   ▼
  ▼  CHATWOOT offline?
fallback     │
ao usuário   handoff_pending
  │          resumo em log
  │
INSERT
incidents
severity='high'
  │
  ▼
ALERTA
WhatsApp
operador
< 5 min

PROMPT QUEBRADO
  │
rollback prompt_versions
agente volta versão anterior
incident + alerta

TOKEN EXHAUSTED
  │
  ├── plano permite overage?
  │   ├── sim → cobrar via Stripe metered
  │   └── não → bloquear + email alerta + dashboard warning
  │
  └── balance <= 0 → agentes pausam automaticamente
```

---

## 11. Monorepo — Estrutura Completa

```
/ginkgo-leaf
│
├── apps/
│   ├── web/                    Vercel → app.ginkgosystems.tech
│   │   ├── app/
│   │   │   ├── (auth)/         login · register · callback
│   │   │   ├── (dashboard)/    overview · conversations · leads
│   │   │   │                   channels · agents · knowledge
│   │   │   │                   billing · settings · content
│   │   │   └── api/            BFF routes (auth, billing, oauth)
│   │   ├── components/
│   │   │   ├── ui/             shadcn/ui customizado
│   │   │   ├── charts/         Recharts (dark theme)
│   │   │   ├── feeds/          Supabase Realtime
│   │   │   └── skills/         UI extensions de skills
│   │   └── lib/
│   │       ├── supabase/       server.ts + client.ts
│   │       └── get-tenant.ts   helper RSC
│   │
│   └── api/                    Railway → api.ginkgosystems.tech
│       └── src/
│           ├── modules/        auth · tenants · billing · agents
│           │                   rag · tools · skills · integrations
│           │                   webhooks (stripe, evolution)
│           ├── middleware/     auth · tenant · ratelimit
│           └── plugins/        supabase · redis · stripe
│
├── packages/
│   ├── db/                     schema + migrations + generated types
│   │   ├── migrations/         000_extensions → 009_rls
│   │   ├── seed/               tenant_zero.sql
│   │   ├── check-schema.sql
│   │   └── types/              database.types.ts (supabase gen types)
│   ├── auth/                   helpers compartilhados
│   ├── billing/                lógica agnóstica de billing
│   ├── rag/                    chunkText · embedInBatches · hybridSearch
│   ├── agents/                 Brann · Alfred · Nyra runtime
│   ├── integrations/           meta/ · google/ · tiktok/ · shopify/
│   └── shared/
│       ├── queue.ts            enqueue() helper
│       ├── worker-loop.ts      runWorker() com retry
│       └── emails/             Resend + React Email templates
│
├── workers/                    Railway → background jobs
│   ├── provisioning/           create_tenant_resources
│   ├── ingestion/              RAG pipeline
│   ├── sync/                   CRON + OAuth refresh
│   ├── metering/               token debit/refill
│   └── notifications/          WhatsApp · email alerts
│
├── skills/                     Skills oficiais da Ginkgo
│   ├── leaf-core/
│   ├── alfred-sql/
│   ├── nyra-reels/
│   ├── command-core/
│   └── _template/              base para novas skills
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml  Traefik · n8n · Evolution · Chatwoot · Redis
│   │   ├── .env.example
│   │   └── deploy.sh
│   └── scripts/
│       ├── provision-tenant.sh
│       ├── ingest-doc.sh
│       ├── rollback-prompt.sh
│       └── rag-quality-test.sh
│
├── n8n/
│   └── workflows/
│       ├── WA-Brann-Atendimento.json
│       ├── Lead-Score-Engine.json
│       ├── Handoff-Chatwoot.json
│       ├── RAG-Ingestion-Pipeline.json
│       ├── Daily-Summary.json
│       ├── Incident-Handler.json
│       ├── Alfred-Report-Daily.json
│       ├── Nyra-Reels-Pipeline.json
│       └── Nyra-Ads-Sync.json
│
└── docs/
    ├── architecture/
    │   ├── GINKGO-SYSTEM-DIAGRAM.md   ← você está aqui
    │   └── TOOL-REGISTRY-v1.md
    ├── prd/
    │   ├── MANUAL_SAAS_1.md
    │   ├── ginkgo-permanent-context.md
    │   ├── GINKGO-BUILD-ORDER.md
    │   └── ENV-MATRIX.md
    └── ops/
        ├── TENANT-PROVISIONING.md
        ├── FAILURE-MODES.md
        ├── MIGRATIONS-GUIDE.md
        ├── WORKFLOWS-GUIDE.md
        ├── ENV-VARIABLES-GUIDE.md
        ├── INFRA-SETUP.md
        ├── API-ROUTES.md
        ├── WORKER-QUEUE.md
        ├── EMAIL-TRANSACIONAL.md
        ├── NEXTJS-AUTH-FLOW.md
        ├── SUPABASE-AUTH-CONFIG.md
        └── go-live-checklist.md
```

---

## 12. Resumo — Um por Linha

```
Usuário entra          → Vercel (app.ginkgosystems.tech)
Autentica              → Supabase Auth (JWT + cookies SSR)
Tenant criado          → API /auth/register → transaction → worker-provisioning
WhatsApp conectado     → Evolution API (QR scan) → canal ativo
Mensagem recebida      → Evolution webhook → n8n → Brann flow
Brann processa         → OpenAI gpt-4o (function calling)
RAG consultado         → pgvector cosine + Postgres full-text → top-5 chunks
Lead capturado         → tool: create_lead → contacts + lead_scores
Score calculado        → Lead-Score-Engine → tier hot/warm/cold
Handoff ativado        → tool: handoff_human → Chatwoot ticket + WhatsApp alert
Tokens debitados       → worker-metering → token_balances
Métricas coletadas     → worker-sync → meta_metrics, gmb_metrics, ads_metrics
News feed atualizado   → worker-sync → Perplexity API → news_items
Alerta disparado       → worker-notifications → WhatsApp operador
Resumo diário          → Daily-Summary CRON 08h → WhatsApp
Billing processado     → Stripe webhook → subscriptions + token refill
Falha detectada        → incidents table + alerta severity-based
```

---

*Ginkgo AI Systems — GINKGO-SYSTEM-DIAGRAM.md v1.0.0 — Março 2026*  
*Este documento é a planta da empresa. Toda adição ao sistema começa aqui.*
