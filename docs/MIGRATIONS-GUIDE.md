# MIGRATIONS-GUIDE.md
## Guia Completo de Migrations — Ginkgo AI Systems

> **Localização:** `packages/db/`  
> **Banco:** Supabase (Postgres 15 + pgvector)  
> **Regra absoluta:** Uma migration por lote lógico. Nunca um arquivo monstro.

---

## Ordem de execução

```
000_extensions.sql        ← pré-requisito de tudo
001_platform_core.sql     ← sistema operacional da plataforma
002_leaf.sql              ← atendimento (MVP)
003_rag.sql               ← memória empresarial
004_agents_skills.sql     ← runtime de agentes
005_observability.sql     ← logs, métricas, views
006_billing.sql           ← tokens e assinaturas
007_integrations.sql      ← OAuth e métricas externas
008_marketplace.sql       ← schema preparatório (sem lógica ainda)
009_rls.sql               ← Row Level Security em tudo sensível
seed/tenant_zero.sql      ← ambiente interno de referência
```

**Comando para aplicar:**
```bash
supabase link --project-ref <project-id>
supabase db push
# ou aplicar manualmente em ordem no SQL Editor do Supabase
```

---

## 000_extensions.sql

```sql
-- Pré-requisito de TUDO. Rodar primeiro.
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: embeddings RAG
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- criptografia de tokens OAuth
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- geração de UUIDs
```

---

## 001_platform_core.sql

```sql
-- ── TENANTS ──────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'starter',
  -- starter | business | scale
  status      TEXT NOT NULL DEFAULT 'trialing',
  -- trialing | active | suspended | churned
  timezone    TEXT DEFAULT 'America/Sao_Paulo',
  language    TEXT DEFAULT 'pt-BR',
  config_json JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── PROFILES (identidade global do usuário — SEM tenant_id) ──────────
-- DECISÃO: profiles é identidade global. A relação com tenants
-- vive em memberships. Um usuário pode pertencer a N tenants.
-- Nunca adicionar tenant_id aqui — quebra multi-workspace.
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SEM tenant_id — relação está em memberships
  name       TEXT,
  email      TEXT,
  avatar_url TEXT,
  locale     TEXT DEFAULT 'pt-BR',
  timezone   TEXT DEFAULT 'America/Sao_Paulo',
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
  -- NOTA: last_active_tenant_id NÃO entra aqui no P1.
  -- Se necessário no futuro, adicionar como preferência de UX,
  -- nunca como relação estrutural de ownership.
);

-- ── MEMBERSHIPS (vínculo profile ↔ tenant, com role) ─────────────────
-- É aqui que vive a relação. profiles ↔ memberships ↔ tenants.
-- is_primary = true indica o workspace padrão do usuário.
CREATE TABLE memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'operator',
  -- owner | admin | operator | viewer
  is_primary  BOOLEAN DEFAULT false,
  -- true = workspace padrão deste usuário (apenas 1 por profile)
  status      TEXT NOT NULL DEFAULT 'active',
  -- active | invited | suspended
  invited_by  UUID REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);

-- Garantir que cada profile tem no máximo 1 membership is_primary
CREATE UNIQUE INDEX idx_memberships_primary
  ON memberships(profile_id)
  WHERE is_primary = true;

-- Índice para listar todos os tenants de um usuário (WorkspaceSwitcher)
CREATE INDEX idx_memberships_profile
  ON memberships(profile_id, tenant_id);

CREATE INDEX idx_memberships_tenant
  ON memberships(tenant_id, role);

-- ── PLAN LIMITS ───────────────────────────────────────────────────────
CREATE TABLE plan_limits (
  plan                 TEXT PRIMARY KEY,
  max_messages_mo      INTEGER,
  max_documents        INTEGER,
  max_agents           INTEGER,
  max_channels         INTEGER,
  max_members          INTEGER DEFAULT 3,
  rag_enabled          BOOLEAN DEFAULT false,
  sql_agent_enabled    BOOLEAN DEFAULT false,
  skills_enabled       BOOLEAN DEFAULT false,
  marketplace_enabled  BOOLEAN DEFAULT false,
  token_included       BIGINT  DEFAULT 0
);

INSERT INTO plan_limits VALUES
  ('starter',  500,   50,  1, 2, 2,  false, false, false, false, 600000),
  ('business', 2000,  200, 3, 4, 5,  true,  true,  true,  false, 2400000),
  ('scale',    99999, 500, 4, 8, 20, true,  true,  true,  true,  10000000);

-- ── AUDIT LOGS (imutável) ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id      UUID,
  event_type    TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  payload_json  JSONB DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
```

---

## 002_leaf.sql

```sql
-- ── CHANNELS ──────────────────────────────────────────────────────────
CREATE TABLE channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  -- whatsapp | telegram | webchat | email | instagram
  name          TEXT,
  config_json   JSONB DEFAULT '{}',
  -- instance_name, webhook_url, token, etc
  status        TEXT DEFAULT 'active',
  -- active | disconnected | error
  connected_at  TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_channels_tenant ON channels(tenant_id, type);

-- ── CONTACTS ──────────────────────────────────────────────────────────
CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  external_id   TEXT,
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  avatar_url    TEXT,
  tags          TEXT[] DEFAULT '{}',
  metadata_json JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone  ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_tags   ON contacts USING GIN(tags);

-- ── CONVERSATIONS ─────────────────────────────────────────────────────
CREATE TABLE conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id     UUID REFERENCES contacts(id),
  channel_id     UUID REFERENCES channels(id),
  assigned_agent TEXT DEFAULT 'brann',
  -- brann | alfred | nyra | command | human
  status         TEXT DEFAULT 'open',
  -- open | handoff | closed | waiting
  handoff_reason TEXT,
  opened_at      TIMESTAMPTZ DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  metadata_json  JSONB DEFAULT '{}'
);

CREATE INDEX idx_conv_tenant  ON conversations(tenant_id, status);
CREATE INDEX idx_conv_contact ON conversations(contact_id);

-- ── MESSAGES ──────────────────────────────────────────────────────────
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL,
  -- user | agent | human | system
  sender_id       TEXT,
  content         TEXT,
  content_type    TEXT DEFAULT 'text',
  -- text | audio | image | document
  media_url       TEXT,
  metadata_json   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conv   ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_tenant ON messages(tenant_id, created_at DESC);

-- ── LEAD SCORES ───────────────────────────────────────────────────────
CREATE TABLE lead_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE,
  score       INTEGER DEFAULT 0,
  tier        TEXT DEFAULT 'cold',
  -- hot (>=70) | warm (40-69) | cold (<40)
  reason_json JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, contact_id)
);

CREATE INDEX idx_scores_tenant ON lead_scores(tenant_id, score DESC);

-- ── APPOINTMENTS ──────────────────────────────────────────────────────
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  datetime        TIMESTAMPTZ NOT NULL,
  duration_min    INTEGER DEFAULT 30,
  status          TEXT DEFAULT 'scheduled',
  -- scheduled | confirmed | cancelled | completed
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appt_tenant ON appointments(tenant_id, datetime);
```

---

## 003_rag.sql

```sql
-- ── KNOWLEDGE SOURCES (configuração da fonte) ─────────────────────────
CREATE TABLE knowledge_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  -- upload | google_drive | url | notion | integration
  name           TEXT,
  config_json    JSONB DEFAULT '{}',
  sync_enabled   BOOLEAN DEFAULT false,
  sync_frequency TEXT DEFAULT 'manual',
  last_sync_at   TIMESTAMPTZ,
  status         TEXT DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── KNOWLEDGE ASSETS (arquivo/documento bruto) ────────────────────────
CREATE TABLE knowledge_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES knowledge_sources(id),
  type            TEXT NOT NULL,
  -- pdf | docx | txt | md | url | audio | image
  title           TEXT,
  file_url        TEXT,
  file_size_bytes INTEGER,
  language        TEXT DEFAULT 'pt',
  tags            TEXT[] DEFAULT '{}',
  sensitivity     TEXT DEFAULT 'internal',
  -- public | internal | confidential
  status          TEXT DEFAULT 'pending',
  -- pending | extracting | chunking | indexed | error
  error_message   TEXT,
  version         INTEGER DEFAULT 1,
  metadata_json   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  indexed_at      TIMESTAMPTZ
);

CREATE INDEX idx_assets_tenant ON knowledge_assets(tenant_id, status);
CREATE INDEX idx_assets_tags   ON knowledge_assets USING GIN(tags);

-- ── KNOWLEDGE CHUNKS (vetores para RAG) ──────────────────────────────
CREATE TABLE knowledge_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id      UUID REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  chunk_index   INTEGER,
  total_chunks  INTEGER,
  chunk_text    TEXT NOT NULL,
  embedding     VECTOR(1536),
  tokens        INTEGER,
  metadata_json JSONB DEFAULT '{}',
  -- { section, page, source, title, language, tags }
  access_roles  TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Índice HNSW para busca vetorial rápida
CREATE INDEX idx_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índice full-text para busca híbrida (português)
CREATE INDEX idx_chunks_fts ON knowledge_chunks
  USING GIN (to_tsvector('portuguese', chunk_text));

CREATE INDEX idx_chunks_tenant ON knowledge_chunks(tenant_id);

-- ── KNOWLEDGE SUMMARIES ───────────────────────────────────────────────
CREATE TABLE knowledge_summaries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id     UUID REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  summary_text TEXT,
  key_topics   TEXT[],
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── RETRIEVAL LOGS ────────────────────────────────────────────────────
CREATE TABLE retrieval_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent           TEXT,
  query_text      TEXT,
  top_chunks      JSONB,
  -- [{ chunk_id, score, text_preview }]
  score_avg       FLOAT,
  chunks_returned INTEGER,
  used_in_msg_id  UUID REFERENCES messages(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_retrieval_tenant ON retrieval_logs(tenant_id, created_at DESC);

-- ── INGESTION JOBS (controle do pipeline) ────────────────────────────
CREATE TABLE ingestion_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id      UUID REFERENCES knowledge_assets(id),
  status        TEXT DEFAULT 'queued',
  -- queued | running | completed | failed
  stage         TEXT,
  -- extract | normalize | chunk | embed | index
  attempts      INTEGER DEFAULT 0,
  max_attempts  INTEGER DEFAULT 3,
  error_message TEXT,
  chunks_created INTEGER,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_status ON ingestion_jobs(status, created_at);
```

---

## 004_agents_skills.sql

```sql
-- ── AGENTS (instâncias por tenant) ───────────────────────────────────
CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  -- brann | alfred | nyra | command
  name           TEXT,
  enabled        BOOLEAN DEFAULT false,
  model          TEXT DEFAULT 'gpt-4o',
  temperature    FLOAT DEFAULT 0.4,
  max_tokens     INTEGER DEFAULT 800,
  config_json    JSONB DEFAULT '{}',
  tools_enabled  TEXT[] DEFAULT '{}',
  prompt_version TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, type)
);

-- ── PROMPT VERSIONS ───────────────────────────────────────────────────
CREATE TABLE prompt_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_type  TEXT NOT NULL,
  version     TEXT NOT NULL,
  content     TEXT NOT NULL,
  changelog   TEXT,
  active      BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, agent_type, version)
);

CREATE INDEX idx_prompts_active ON prompt_versions(tenant_id, agent_type, active);

-- ── TOOL REGISTRY (catálogo global) ──────────────────────────────────
CREATE TABLE tool_registry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT UNIQUE NOT NULL,
  description    TEXT,
  agents_allowed TEXT[] DEFAULT '{}',
  input_schema   JSONB DEFAULT '{}',
  output_schema  JSONB DEFAULT '{}',
  permissions    TEXT[] DEFAULT '{}',
  timeout_ms     INTEGER DEFAULT 5000,
  retries        INTEGER DEFAULT 3,
  read_only      BOOLEAN DEFAULT true,
  enabled        BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Tools P1 obrigatórias
INSERT INTO tool_registry (name, description, agents_allowed, read_only) VALUES
  ('search_knowledge', 'Busca na base RAG do tenant', ARRAY['brann','alfred','command'], true),
  ('create_lead',      'Cria ou atualiza lead no CRM', ARRAY['brann'], false),
  ('update_contact',   'Atualiza dados do contato',   ARRAY['brann'], false),
  ('fetch_catalog',    'Busca planos e serviços',      ARRAY['brann'], true),
  ('handoff_human',    'Transfere para humano',        ARRAY['brann'], false),
  ('schedule_appointment', 'Cria agendamento',         ARRAY['brann'], false);

-- ── TOOL EXECUTIONS (log obrigatório de toda tool) ────────────────────
CREATE TABLE tool_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_type      TEXT,
  tool_name       TEXT,
  conversation_id UUID REFERENCES conversations(id),
  input_json      JSONB DEFAULT '{}',
  output_json     JSONB DEFAULT '{}',
  success         BOOLEAN,
  latency_ms      INTEGER,
  tokens_used     INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tool_exec_tenant ON tool_executions(tenant_id, created_at DESC);
CREATE INDEX idx_tool_exec_name   ON tool_executions(tenant_id, tool_name);

-- ── SKILLS (catálogo global) ──────────────────────────────────────────
CREATE TABLE skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  author       TEXT DEFAULT 'ginkgo',
  version      TEXT DEFAULT '1.0.0',
  manifest_json JSONB NOT NULL DEFAULT '{}',
  status       TEXT DEFAULT 'draft',
  -- draft | review | published | deprecated
  official     BOOLEAN DEFAULT false,
  requires_plan TEXT DEFAULT 'business',
  price_brl    NUMERIC DEFAULT 0,
  trial_days   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Skills oficiais P1
INSERT INTO skills (slug, name, category, official, requires_plan, price_brl, status, manifest_json)
VALUES
  ('leaf-core',    'Leaf Core',    'atendimento', true, 'starter',  0, 'published', '{}'),
  ('alfred-sql',   'Alfred SQL',   'operacao',    true, 'business', 0, 'published', '{}'),
  ('nyra-reels',   'Nyra Reels',   'conteudo',    true, 'business', 0, 'published', '{}'),
  ('command-core', 'Command Core', 'assistente',  true, 'scale',    0, 'published', '{}');

-- ── TENANT SKILLS (skills instaladas) ────────────────────────────────
CREATE TABLE tenant_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  skill_id    UUID REFERENCES skills(id),
  status      TEXT DEFAULT 'active',
  config_json JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  UNIQUE(tenant_id, skill_id)
);
```

---

## 005_observability.sql

```sql
-- ── INCIDENTS ─────────────────────────────────────────────────────────
CREATE TABLE incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  severity    TEXT DEFAULT 'low',
  -- low | medium | high | critical
  category    TEXT,
  -- agent_error | tool_failure | rag_miss | billing | integration
  description TEXT NOT NULL,
  workflow    TEXT,
  agent       TEXT,
  resolved    BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_incidents_open ON incidents(tenant_id, resolved, created_at DESC);

-- ── USAGE EVENTS (granular para metering) ────────────────────────────
CREATE TABLE usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  -- message | token | document | tool_call | handoff | skill_run
  quantity      BIGINT DEFAULT 1,
  unit          TEXT DEFAULT 'count',
  agent         TEXT,
  skill_id      UUID REFERENCES skills(id),
  metadata_json JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_tenant ON usage_events(tenant_id, event_type, created_at DESC);

-- ── METERING SUMMARIES (agregados mensais) ────────────────────────────
CREATE TABLE metering_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  period          TEXT NOT NULL,
  -- YYYY-MM
  messages_count  INTEGER DEFAULT 0,
  tokens_used     BIGINT DEFAULT 0,
  documents_count INTEGER DEFAULT 0,
  tool_calls      INTEGER DEFAULT 0,
  handoffs        INTEGER DEFAULT 0,
  cost_usd        NUMERIC DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, period)
);

-- ── VIEWS PARA DASHBOARD ──────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_daily_activity AS
SELECT
  DATE(created_at) AS dia,
  tenant_id,
  COUNT(*) FILTER (WHERE sender_type = 'user')  AS msgs_user,
  COUNT(*) FILTER (WHERE sender_type = 'agent') AS msgs_agent
FROM messages
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW vw_hot_leads AS
SELECT
  c.id, c.name, c.phone, c.tags, c.tenant_id,
  ls.score, ls.tier, ls.updated_at
FROM contacts c
JOIN lead_scores ls ON ls.contact_id = c.id
WHERE ls.score >= 70
ORDER BY ls.score DESC;

CREATE OR REPLACE VIEW vw_handoff_rate AS
SELECT
  tenant_id,
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE status = 'handoff')           AS handoffs,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'handoff') * 100.0
    / NULLIF(COUNT(*), 0), 1
  ) AS pct
FROM conversations
WHERE opened_at >= now() - interval '30 days'
GROUP BY tenant_id;

CREATE OR REPLACE VIEW vw_cost_per_day AS
SELECT
  tenant_id,
  DATE(created_at) AS dia,
  COUNT(DISTINCT (input_json->>'conversation_id')) AS conversas,
  SUM((output_json->>'tokens_used')::int)          AS tokens,
  ROUND(
    SUM((output_json->>'tokens_used')::int) * 0.000015, 4
  ) AS custo_usd_estimado
FROM tool_executions
WHERE tool_name = 'brann_response'
  AND created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 2 DESC;
```

---

## 006_billing.sql

```sql
-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan                   TEXT NOT NULL,
  status                 TEXT DEFAULT 'trialing',
  -- trialing | active | past_due | canceled | unpaid
  trial_ends_at          TIMESTAMPTZ,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at              TIMESTAMPTZ,
  canceled_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- ── TOKEN BALANCES (saldo atual) ──────────────────────────────────────
CREATE TABLE token_balances (
  tenant_id   UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance     BIGINT DEFAULT 0,
  used_period BIGINT DEFAULT 0,
  refill_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── TOKEN TRANSACTIONS (histórico completo) ───────────────────────────
CREATE TABLE token_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  -- purchase | plan_refill | consumption | bonus | refund | expiry
  amount       BIGINT NOT NULL,
  balance_after BIGINT,
  source_type  TEXT,
  source_id    TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_token_txn ON token_transactions(tenant_id, created_at DESC);

-- ── INVOICES ──────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  amount_brl        NUMERIC,
  period            TEXT,
  status            TEXT,
  -- draft | open | paid | void
  pdf_url           TEXT,
  issued_at         TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## 007_integrations.sql

```sql
-- ── INTEGRATIONS (tokens OAuth) ───────────────────────────────────────
CREATE TABLE integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  -- google | meta | tiktok | shopify | evolution | openclaw | clickup
  status           TEXT DEFAULT 'connected',
  access_token_enc TEXT,
  -- pgp_sym_encrypt(token, key)
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[],
  metadata_json    JSONB DEFAULT '{}',
  connected_at     TIMESTAMPTZ DEFAULT now(),
  last_sync_at     TIMESTAMPTZ,
  UNIQUE(tenant_id, provider)
);

-- ── META METRICS ──────────────────────────────────────────────────────
CREATE TABLE meta_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  account_type TEXT,
  account_id   TEXT,
  impressions  INTEGER DEFAULT 0,
  reach        INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  messages_in  INTEGER DEFAULT 0,
  top_posts    JSONB DEFAULT '[]',
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, date, account_id)
);

CREATE INDEX idx_meta_tenant ON meta_metrics(tenant_id, date DESC);

-- ── GMB METRICS ───────────────────────────────────────────────────────
CREATE TABLE gmb_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  location_id     TEXT,
  views_maps      INTEGER DEFAULT 0,
  views_search    INTEGER DEFAULT 0,
  clicks_call     INTEGER DEFAULT 0,
  clicks_website  INTEGER DEFAULT 0,
  clicks_directions INTEGER DEFAULT 0,
  rating_avg      FLOAT,
  review_count    INTEGER DEFAULT 0,
  new_reviews     JSONB DEFAULT '[]',
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, date, location_id)
);

-- ── TIKTOK METRICS ────────────────────────────────────────────────────
CREATE TABLE tiktok_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  account_id  TEXT,
  views       INTEGER DEFAULT 0,
  shares      INTEGER DEFAULT 0,
  likes       INTEGER DEFAULT 0,
  comments    INTEGER DEFAULT 0,
  followers   INTEGER DEFAULT 0,
  synced_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, date, account_id)
);

-- ── ADS METRICS ───────────────────────────────────────────────────────
CREATE TABLE ads_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  platform    TEXT,
  -- meta | tiktok | google
  campaign_id TEXT,
  campaign_name TEXT,
  impressions INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  spend_brl   NUMERIC DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  roas        FLOAT,
  synced_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ads_tenant ON ads_metrics(tenant_id, date DESC, platform);

-- ── NEWS ITEMS (Perplexity feed) ──────────────────────────────────────
CREATE TABLE news_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type        TEXT,
  -- news | trend | alert | opportunity | mention
  title       TEXT,
  summary     TEXT,
  source_url  TEXT,
  source_name TEXT,
  relevance   FLOAT,
  tags        TEXT[] DEFAULT '{}',
  read        BOOLEAN DEFAULT false,
  saved       BOOLEAN DEFAULT false,
  fetched_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_tenant ON news_items(tenant_id, fetched_at DESC);

-- ── EDITORIAL CALENDAR ────────────────────────────────────────────────
CREATE TABLE editorial_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  platform     TEXT,
  content_type TEXT,
  status       TEXT DEFAULT 'draft',
  -- draft | approved | scheduled | published | failed
  asset_id     UUID REFERENCES knowledge_assets(id),
  metadata_json JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 008_marketplace.sql

```sql
-- Schema preparatório — sem lógica de negócio ainda.
-- Marketplace é fase 3 da plataforma.

CREATE TABLE skill_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id     UUID REFERENCES skills(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,
  changelog    TEXT,
  manifest_json JSONB NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  UNIQUE(skill_id, version)
);

CREATE TABLE skill_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id    UUID REFERENCES skills(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL,
  required    BOOLEAN DEFAULT true,
  description TEXT
);

CREATE TABLE skill_reviews (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id  UUID REFERENCES skills(id),
  tenant_id UUID REFERENCES tenants(id),
  rating    INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment   TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(skill_id, tenant_id)
);

CREATE TABLE skill_revenue_share (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id         UUID REFERENCES skills(id),
  tenant_id        UUID REFERENCES tenants(id),
  period           TEXT,
  gross_brl        NUMERIC,
  developer_pct    FLOAT DEFAULT 0.70,
  platform_pct     FLOAT DEFAULT 0.30,
  developer_brl    NUMERIC,
  platform_brl     NUMERIC,
  stripe_transfer_id TEXT,
  status           TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## 009_rls.sql

```sql
-- Row Level Security para isolamento multi-tenant.
-- Service role ignora RLS — workers usam service_role com tenant_id explícito.

ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_assets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         ENABLE ROW LEVEL SECURITY;

-- Função helper: lê tenant_id do cookie/sessão (não do JWT — JWT não carrega tenant_id)
-- O tenant ativo vem do cookie ginkgo-workspace, setado via app.tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.tenant_id', true))::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Função helper: verifica se o usuário autenticado tem acesso ao tenant
-- Usada em policies que precisam validar membership (não só tenant_id)
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    JOIN profiles p ON p.id = m.profile_id
    WHERE p.id = auth.uid()   -- profiles.id = auth.users.id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policy padrão — aplicar em cada tabela habilitada
-- Exemplo para contacts (replicar padrão para as demais):
CREATE POLICY tenant_isolation ON contacts
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON conversations
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON messages
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON knowledge_chunks
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON knowledge_assets
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON lead_scores
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON token_balances
  FOR ALL
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation ON tool_executions
  FOR ALL
  USING (tenant_id = current_tenant_id());
```

---

## seed/tenant_zero.sql

```sql
-- Tenant Zero — ambiente interno de referência.
-- Tudo novo passa por aqui antes de cliente externo.
-- Modelo correto: profiles → memberships → tenants (sem tenant_id no profile)

-- 1. Criar tenant
INSERT INTO tenants (id, name, slug, plan, status, config_json)
VALUES (
  'f47ac10b-58cc-4372-a567-000000000000',
  'Ginkgo AI Systems (Interno)',
  'ginkgo-internal',
  'scale',
  'active',
  '{"timezone":"America/Sao_Paulo","language":"pt-BR","segment":"automation_saas"}'
);

-- 2. Criar profile do owner (assumindo que auth.users já tem o registro)
-- Em produção: substituir 'owner-user-id-aqui' pelo UUID real do auth.users
INSERT INTO profiles (id, name, email, locale, timezone)
VALUES (
  'owner-profile-id-placeholder',   -- substituir pelo UUID real
  'Gabriel Schaun',
  'gabriel@ginkgosystems.tech',
  'pt-BR',
  'America/Sao_Paulo'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Criar membership owner (vínculo profile → tenant)
INSERT INTO memberships (tenant_id, profile_id, role, is_primary, status, accepted_at)
VALUES (
  'f47ac10b-58cc-4372-a567-000000000000',
  'owner-profile-id-placeholder',   -- mesmo UUID do profiles acima
  'owner',
  true,                              -- workspace padrão para este usuário
  'active',
  now()
)
ON CONFLICT (tenant_id, profile_id) DO NOTHING;

-- Canal WhatsApp
INSERT INTO channels (tenant_id, type, name, config_json, status)
VALUES (
  'f47ac10b-58cc-4372-a567-000000000000',
  'whatsapp',
  'WhatsApp Principal',
  '{
    "evolution_instance": "ginkgo-zero",
    "webhook_url": "https://n8n.ginkgosystems.tech/webhook/whatsapp-t0",
    "typing_delay_ms": 1200
  }',
  'active'
);

-- Agente Brann ativo
INSERT INTO agents (tenant_id, type, enabled, model, temperature, max_tokens, config_json, tools_enabled, prompt_version)
VALUES (
  'f47ac10b-58cc-4372-a567-000000000000',
  'brann',
  true,
  'gpt-4o',
  0.4,
  800,
  '{
    "max_context_messages": 12,
    "rag_top_k": 5,
    "typing_indicator": true,
    "handoff_threshold_score": 70
  }',
  ARRAY[
    'search_knowledge',
    'create_lead',
    'update_contact',
    'handoff_human',
    'fetch_catalog',
    'schedule_appointment'
  ],
  'brann-t0-v1.0'
);

-- Saldo inicial de tokens
INSERT INTO token_balances (tenant_id, balance)
VALUES ('f47ac10b-58cc-4372-a567-000000000000', 10000000);
```

---

## check-schema.sql

```sql
-- Validação pós-migration.
-- Esperado: 38 tabelas retornadas.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'tenants','profiles','memberships','plan_limits','audit_logs',
    'channels','contacts','conversations','messages','lead_scores','appointments',
    'knowledge_sources','knowledge_assets','knowledge_chunks',
    'knowledge_summaries','retrieval_logs','ingestion_jobs',
    'agents','prompt_versions','tool_registry','tool_executions',
    'skills','tenant_skills',
    'incidents','usage_events','metering_summaries',
    'subscriptions','token_balances','token_transactions','invoices',
    'integrations','meta_metrics','gmb_metrics','tiktok_metrics',
    'ads_metrics','news_items','editorial_calendar',
    'skill_versions','skill_permissions','skill_reviews','skill_revenue_share'
  )
ORDER BY table_name;

-- Validar Tenant Zero:
SELECT id, name, plan, status
FROM tenants
WHERE id = 'f47ac10b-58cc-4372-a567-000000000000';

-- Validar isolamento RLS (deve retornar 0):
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';
SELECT count(*) FROM contacts;
-- Esperado: 0
```

---

## Critério de Pronto

```
[ ] supabase db push sem erro
[ ] check-schema.sql retorna 38+ tabelas
[ ] seed/tenant_zero.sql insere sem erro
[ ] Tenant Zero: SELECT retorna 1 linha
[ ] RLS test: query com tenant falso retorna 0 rows
[ ] Índice HNSW criado em knowledge_chunks
[ ] pgvector ativo: SELECT vector_dims(embedding) FROM knowledge_chunks LIMIT 1
```

---

*Ginkgo AI Systems — packages/db/ — v3.0.0*
