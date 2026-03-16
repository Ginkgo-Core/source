# GINKGO-BUILD-ORDER.md
## Ordem Oficial de Construção — Ginkgo AI Systems
### Do zero ao primeiro cliente pagante

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Referência:** Todos os documentos do kit fundador  
> **Regra:** Nenhuma etapa começa antes do gate da anterior passar.

---

## Visão geral

```
FASE 0 — Pré-build (antes de qualquer código)
  → Configurações externas: Supabase, Cloudflare, Vercel, Stripe

FASE 1 — Fundação (Semanas 1–2)
  → Infra VPS + banco + canal WhatsApp + Brann básico

FASE 2 — Produto (Semanas 3–4)
  → RAG + lead score + handoff + dashboard + testes

FASE 3 — Onboarding e Venda (Semanas 5–6)
  → Frontend auth + billing + primeiro cliente

FASE 4 — Tração (Semanas 7–13)
  → 5 clientes + otimização + expansão
```

---

## FASE 0 — Pré-build

> **Ferramenta:** Manual (painel de cada serviço)  
> **Duração:** Meio dia  
> **Bloqueador:** Tudo depende disso

### 0.1 Supabase

```
[ ] Criar projeto no Supabase Cloud
[ ] Copiar: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
[ ] Anotar: project-ref (usado no supabase link)
[ ] Criar banco "chatwoot" e banco "evolution" via SQL:
    CREATE DATABASE chatwoot;
    CREATE DATABASE evolution;
[ ] Habilitar extensão pgvector:
    CREATE EXTENSION IF NOT EXISTS vector;

Referência: SUPABASE-AUTH-CONFIG.md §1–2
```

### 0.2 Cloudflare

```
[ ] Transferir ou apontar ginkgosystems.tech para Cloudflare
[ ] Criar 7 registros DNS (ver INFRA-SETUP.md §2)
[ ] SSL/TLS → Full (strict)
[ ] app. → proxy OFF (DNS only)
[ ] Todos os demais → proxy ON
[ ] Aguardar propagação: dig +short n8n.ginkgosystems.tech
```

### 0.3 Stripe

```
[ ] Criar conta Stripe
[ ] Criar 3 produtos (Starter R$97, Business R$197, Scale R$397)
[ ] Criar 3 produtos de token (500k R$79, 2M R$249, 10M R$890)
[ ] Anotar: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
[ ] Criar webhook endpoint: https://api.ginkgosystems.tech/webhooks/stripe
[ ] Eventos: checkout.session.completed, invoice.paid,
             customer.subscription.deleted, payment_intent.succeeded
[ ] Anotar: STRIPE_WEBHOOK_SECRET
```

### 0.4 OpenAI

```
[ ] Criar conta + projeto no OpenAI Platform
[ ] Gerar API key com permissões: chat, embeddings
[ ] Anotar: OPENAI_API_KEY
[ ] Configurar limites de gasto mensais (recomendado: $50/mês inicialmente)
```

### 0.5 Resend (email)

```
[ ] Criar conta em resend.com
[ ] Verificar domínio ginkgosystems.tech (adicionar registros DNS)
[ ] Anotar: RESEND_API_KEY
[ ] Testar envio de email de teste

Referência: EMAIL-TRANSACIONAL.md §2
```

### Gate 0 ✅

```
[ ] Supabase: projeto ativo, extensão pgvector habilitada
[ ] Cloudflare: 7 registros DNS propagados
[ ] Stripe: produtos criados, webhook configurado
[ ] OpenAI: API key com limite de gasto
[ ] Resend: domínio verificado
→ Se tudo marcado: avançar para Fase 1
```

---

## FASE 1 — Fundação

> **Ferramenta:** Antigravity (prompts P-01, P-02, P-03, P-04, P-05, P-06)  
> **Duração:** Semanas 1–2  
> **Resultado:** Brann respondendo no WhatsApp com logs

### Sprint 1 — Infra e Banco

#### P-01 — Docker Compose + VPS

```
Prompt para Antigravity:
  [permanent-context] + [P-01 do sprint-prompts-v2.md]

O que o agente constrói:
  docker-compose.yml (Traefik + n8n + Evolution + Chatwoot + Redis)
  .env.example
  deploy.sh
  README-infra.md

Você executa:
  SSH na VPS → preencher .env → bash deploy.sh
  docker compose run --rm chatwoot bundle exec rails db:chatwoot_prepare

Gate P-01:
  [ ] docker compose ps → todos healthy/running
  [ ] curl https://n8n.ginkgosystems.tech/healthz → 200
  [ ] docker compose exec redis redis-cli ping → PONG
  [ ] SSL ativo nos 5 subdomínios

Referência: INFRA-SETUP.md §5–8
```

#### P-02 — Schema Supabase + Seed

```
Prompt para Antigravity:
  [permanent-context] + [P-02]

O que o agente constrói:
  supabase/migrations/000 a 009
  supabase/seed/tenant_zero.sql
  supabase/check-schema.sql

Você executa:
  supabase link --project-ref <id>
  supabase db push
  psql $DB_URL -f supabase/seed/tenant_zero.sql

Gate P-02:
  [ ] check-schema.sql → 38+ tabelas
  [ ] SELECT * FROM tenants WHERE id = 'f47ac10b...' → 1 linha
  [ ] Trigger on_auth_user_created criado
  [ ] RLS testado: query com tenant falso → 0 rows

Referência: MIGRATIONS-GUIDE.md | TENANT-PROVISIONING.md
```

#### P-03 — Canal WhatsApp + Webhook

```
Prompt para Antigravity:
  [permanent-context] + [P-03]

O que o agente constrói:
  scripts/setup-evolution.sh
  scripts/test-webhook.sh
  n8n/workflows/WA-Receiver-Base.json

Você executa:
  bash scripts/setup-evolution.sh
  Escanear QR no painel Evolution
  bash scripts/test-webhook.sh

Gate P-03:
  [ ] Instância Evolution conectada (status: open)
  [ ] bash scripts/test-webhook.sh → 200
  [ ] SELECT tool_name FROM tool_executions WHERE tool_name='webhook_received' → 1+ linhas
  [ ] phone e message extraídos corretamente

Referência: WORKFLOWS-GUIDE.md §WA-Receiver-Base
```

---

### Sprint 2 — Brann Core

#### P-04 — Fluxo de Atendimento

```
Prompt para Antigravity:
  [permanent-context] + [P-04]

O que o agente constrói:
  n8n/workflows/WA-Brann-Atendimento.json (sem tools ainda)
  utils/sanitize-whatsapp.js

Gate P-04:
  [ ] Enviar "Olá" → Brann responde em < 5s
  [ ] SELECT * FROM messages ORDER BY created_at DESC LIMIT 2
      → 1 user + 1 agent
  [ ] tool_executions logado com latency_ms e tokens_used
  [ ] Nenhum ** ou ## na resposta

Referência: WORKFLOWS-GUIDE.md §WA-Brann-Atendimento
```

#### P-05 — Tools: create_lead, fetch_catalog, handoff_human

```
Prompt para Antigravity:
  [permanent-context] + [P-05]

O que o agente constrói:
  Atualização do WA-Brann-Atendimento.json com tools
  Executores de cada tool

Gate P-05:
  [ ] T-lead: conversa com nome+telefone+interesse
      → contato em contacts com tags=['lead']
  [ ] T-catalog: "Quais são os planos?"
      → resposta usa dados do catalog, não memória do modelo
  [ ] T-handoff: "quero falar com uma pessoa"
      → ticket no Chatwoot + alerta WhatsApp operador < 30s
      → conversations.status = 'handoff'
  [ ] audit_logs com event_type='handoff_initiated'

Referência: TOOL-REGISTRY-v1.md §4 | WORKFLOWS-GUIDE.md §tools
```

#### P-06 — System Prompt + Lead Score + Incidents

```
Prompt para Antigravity:
  [permanent-context] + [P-06] + [P-07] + [P-08] (podem ser um único prompt)

O que o agente constrói:
  INSERT prompt_versions (brann-t0-v1.0)
  scripts/rollback-prompt.sh
  n8n/workflows/Lead-Score-Engine.json
  n8n/workflows/Incident-Handler.json (Error Workflow global)

Gate P-06:
  [ ] Prompt ativo no banco (active=true)
  [ ] rollback-prompt.sh funciona sem reiniciar n8n
  [ ] Lead score calculado após mensagens
  [ ] Score >= 70 → alerta WhatsApp em < 30s
  [ ] Falha OpenAI → fallback ao usuário + incident criado + alerta

Referência: FAILURE-MODES.md §3.1 | WORKFLOWS-GUIDE.md
```

### Gate Fase 1 ✅

```
[ ] Brann responde no WhatsApp < 5s
[ ] Lead capturado após qualificação mínima
[ ] Score calculado e tags aplicadas
[ ] Handoff chega no Chatwoot com contexto
[ ] Falha gera incident + alerta ao operador
[ ] Tenant Zero operando 24h sem intervenção
→ Se tudo marcado: avançar para Fase 2
```

---

## FASE 2 — Produto

> **Ferramenta:** Antigravity (P-10, P-11, P-12, P-13, P-14)  
> **Duração:** Semanas 3–4  
> **Resultado:** RAG funcionando + 7 testes passando + dashboard de métricas

### Sprint 3 — RAG

#### P-10 — Pipeline de Ingestão

```
Prompt para Antigravity:
  [permanent-context] + [P-10]

O que o agente constrói:
  n8n/workflows/RAG-Ingestion-Pipeline.json
  scripts/ingest-doc.sh
  scripts/check-chunks.sh

Gate P-10:
  [ ] bash scripts/ingest-doc.sh "FAQ" text "$(cat faq.md)"
      → asset status='indexed'
  [ ] SELECT count(*) FROM knowledge_chunks WHERE tenant_id='f47ac10b...'
      → > 5
  [ ] Embeddings não nulos: SELECT count(*) WHERE embedding IS NULL → 0
  [ ] Falha parcial → retry automático + incident se 3 falhas

Referência: MIGRATIONS-GUIDE.md §003_rag | WORKFLOWS-GUIDE.md §RAG-Ingestion
```

#### P-11 + P-12 — search_knowledge + Base Tenant Zero

```
Prompt para Antigravity:
  [permanent-context] + [P-11] + [P-12]

O que o agente constrói:
  Tool search_knowledge no WA-Brann-Atendimento.json
  docs/knowledge/faq-ginkgo.md
  docs/knowledge/catalogo-ginkgo.md
  scripts/rag-quality-test.sh

Gate P-11+12:
  [ ] "Quais são os planos?" → Brann usa search_knowledge
  [ ] retrieval_logs com score_avg > 0.70
  [ ] bash scripts/rag-quality-test.sh → 9+/10 perguntas passando
  [ ] Pergunta fora da base → Brann não inventa

Referência: WORKFLOWS-GUIDE.md §search_knowledge
```

---

### Sprint 4 — Dashboard e Validação

#### P-13 — 7 Testes End-to-End

```
Execução manual — não é prompt do Antigravity

Testes:
  T-01: atendimento básico
  T-02: qualificação de lead
  T-03: busca RAG
  T-04: handoff humano
  T-05: alerta lead quente
  T-06: isolamento de tenant
  T-07: comportamento em falha

Documentar em: docs/ops/validation-report.md

Gate P-13:
  [ ] 7/7 testes passando
  [ ] Zero issues críticos em aberto
→ BLOQUEADOR ABSOLUTO: não avançar com issues críticos

Referência: MANUAL_SAAS_1.md §6.6
```

#### P-14 — Dashboard de Métricas

```
Prompt para Antigravity:
  [permanent-context] + [P-14]

O que o agente constrói:
  Views SQL: vw_daily_activity, vw_hot_leads, vw_handoff_rate, vw_cost_per_day
  n8n/workflows/Daily-Summary.json (CRON 08h BRT)

Gate P-14:
  [ ] 4 views retornando dados reais
  [ ] Daily Summary chegando no WhatsApp do operador (forçar execução)
  [ ] Metabase ou Supabase Studio mostrando métricas

Referência: MIGRATIONS-GUIDE.md §005_observability
```

### Gate Fase 2 ✅

```
[ ] 7/7 testes passando (sem exceção)
[ ] FAQ e catálogo indexados (20+ chunks)
[ ] RAG quality test: 9+/10
[ ] Daily summary chegando às 08h
[ ] Tenant Zero 48h estável
→ Se tudo marcado: avançar para Fase 3
```

---

## FASE 3 — Onboarding e Venda

> **Ferramenta:** Antigravity (FE-01, FE-02, FE-03) + Manual (primeiro cliente)  
> **Duração:** Semanas 5–6  
> **Resultado:** Frontend + billing + primeiro cliente pagante

### Sprint 5 — Frontend

#### FE-01 — Next.js + Auth + Layout

```
Prompt para Antigravity:
  [permanent-context] + [FE-01]

Antes de rodar o prompt:
  [ ] Configurar Auth no painel Supabase (SUPABASE-AUTH-CONFIG.md §1–5)
  [ ] Criar trigger on_auth_user_created no SQL Editor
  [ ] Adicionar Site URL e Redirect URLs

O que o agente constrói:
  apps/web/lib/supabase/server.ts + client.ts
  apps/web/middleware.ts (proteção de rotas + trial check)
  apps/web/app/(auth)/login/page.tsx
  apps/web/app/(auth)/register/page.tsx
  apps/web/app/(dashboard)/layout.tsx
  apps/web/app/auth/callback/route.ts
  apps/web/lib/get-tenant.ts

Gate FE-01:
  [ ] /dashboard sem auth → redirect /login
  [ ] Login → redirect /dashboard
  [ ] Register → tenant criado + redirect /onboarding
  [ ] Logout → redirect /login
  [ ] Trial expirado → redirect /billing
  [ ] pnpm build sem erro TypeScript

Referência: NEXTJS-AUTH-FLOW.md | TENANT-PROVISIONING.md
```

#### FE-03 — Billing + Stripe

```
Prompt para Antigravity:
  [permanent-context] + [FE-03]

O que o agente constrói:
  apps/web/app/(dashboard)/billing/page.tsx
  apps/web/app/api/billing/checkout/route.ts
  apps/web/app/api/billing/portal/route.ts
  apps/web/app/api/billing/tokens/route.ts
  apps/api/src/modules/webhooks/stripe.ts

Gate FE-03:
  [ ] Clicar "Fazer upgrade" → redirect Stripe Checkout
  [ ] Webhook stripe → subscriptions.status atualizado
  [ ] Comprar tokens → token_balances.balance incrementado
  [ ] Tabela de faturas mostrando histórico Stripe
  [ ] Token meter refletindo saldo real

Referência: API-ROUTES.md §Billing | WORKER-QUEUE.md §worker-metering
```

#### FE-02 — Dashboard KPIs + Feed ao Vivo

```
Prompt para Antigravity:
  [permanent-context] + [FE-02]

O que o agente constrói:
  apps/web/app/(dashboard)/page.tsx (overview)
  apps/web/components/dashboard/kpi-card.tsx
  apps/web/components/dashboard/live-feed.tsx
  apps/web/components/dashboard/activity-chart.tsx
  apps/web/components/dashboard/alert-list.tsx

Gate FE-02:
  [ ] Dashboard carrega com dados reais
  [ ] Mensagem WhatsApp → aparece no feed em < 5s (Supabase Realtime)
  [ ] 6 KPIs mostrando valores reais
  [ ] Gráfico de atividade renderizando sem erro

Referência: API-ROUTES.md §Dashboard
```

---

### Sprint 6 — Primeiro Cliente

#### P-15 — Provision + Go-Live

```
Prompt para Antigravity:
  [permanent-context] + [P-15]

O que o agente constrói:
  infra/scripts/provision-tenant.sh
  docs/ops/go-live-checklist.md
  docs/ops/onboarding-call-script.md
  docs/ops/sop-update-prompt.md
  docs/ops/sop-check-logs.md
  docs/ops/sop-manual-handoff.md
  docs/ops/sop-brann-not-responding.md

Você executa:
  bash infra/scripts/provision-tenant.sh "Cliente Piloto" business "+55..." "+55..."
  Indexar base de conhecimento do cliente
  Call de onboarding (30min)
  Monitorar 48h

Gate P-15:
  [ ] provision-tenant.sh sem erro para cliente real
  [ ] Brann do cliente responde em < 5s
  [ ] 48h sem incident severity=high
  [ ] Pelo menos 1 lead capturado
  [ ] Daily summary do cliente chegando às 08h
  [ ] Retrospective preenchida em docs/ops/retrospective-client-01.md

Referência: INFRA-SETUP.md §9 | TENANT-PROVISIONING.md
```

### Gate Fase 3 ✅

```
[ ] Frontend auth funcionando end-to-end
[ ] Checkout Stripe processando
[ ] Primeiro cliente em produção 48h
[ ] Onboarding replicável documentado
[ ] MRR inicial: R$197–R$450
→ Se tudo marcado: avançar para Fase 4
```

---

## FASE 4 — Tração (Semanas 7–13)

> **Ferramenta:** Misto — Antigravity para features, manual para comercial  
> **Meta:** 5 clientes pagantes, MRR > R$2.000, onboarding < 3 dias

### Semana 7 — Dashboard Completo

```
Builds:
  [ ] Página /conversations (inbox unificado)
  [ ] Página /leads (CRM com filtros e score)
  [ ] Página /channels (status + OAuth connect)
  [ ] Página /agents (config Brann + prompt editor)
  [ ] Página /knowledge (upload + busca RAG)

Prompt sugerido: [FE-completo] — novo prompt cobrindo essas páginas
```

### Semanas 8–9 — Clientes 2 e 3

```
Comercial:
  [ ] 10 contatos qualificados nos segmentos prioritários
  [ ] 2–3 demos agendadas
  [ ] 2 clientes fechados e onboardados
  [ ] Ajustes de prompt com base em conversas reais
  [ ] RAG dos clientes indexado com base deles

Métricas alvo:
  [ ] Taxa de handoff < 20% por cliente
  [ ] RAG hit rate > 80%
  [ ] Custo por conversa < R$0,50
```

### Semanas 10–11 — Clientes 4 e 5

```
Build adicional:
  [ ] OAuth Meta (Instagram/Facebook) para clientes que pedem
  [ ] OAuth Google (GMB) para clientes que pedem
  [ ] Dashboard Content (métricas sociais básicas)
  [ ] worker-sync ativo para integrações conectadas

Comercial:
  [ ] Mais 2 clientes fechados
  [ ] Onboarding em < 3 dias (processo refinado)
  [ ] Upsell: pacote de tokens ou plan upgrade
```

### Semanas 12–13 — Consolidação

```
Operacional:
  [ ] 5 clientes estáveis há pelo menos 2 semanas
  [ ] Zero churn
  [ ] MRR > R$2.000
  [ ] Custo operacional < R$800/mês
  [ ] Margem bruta > 70%

Documentação:
  [ ] Retrospective de cada cliente (docs/ops/retrospective-client-0X.md)
  [ ] O que mudou no prompt em relação à v1
  [ ] Principais perguntas não respondidas (base RAG a melhorar)
  [ ] Roadmap P2 baseado em pedidos reais dos clientes
```

### Gate Fase 4 ✅

```
[ ] MRR >= R$2.000
[ ] 5 clientes ativos
[ ] Churn = 0
[ ] Onboarding < 3 dias
[ ] Operação autônoma (sem intervenção manual diária)
→ Fase 5: Alfred, Command, Nyra, Wave, Pyre, Marketplace
```

---

## Protocolo de uso do Antigravity

```
Para todo prompt de sprint:

1. Abrir nova sessão no Antigravity
2. Colar o bloco completo de ginkgo-permanent-context.md
3. Separar com ---
4. Colar o prompt do sprint atual
5. Aguardar o plano do agente
6. Enviar o plano aqui para revisão antes de executar
7. Executar somente após aprovação
8. Validar gate antes de avançar
```

---

## Referência de documentos por etapa

| Etapa | Documentos de referência |
|-------|--------------------------|
| Fase 0 | SUPABASE-AUTH-CONFIG.md, INFRA-SETUP.md, ENV-MATRIX.md |
| P-01 | INFRA-SETUP.md §5–8, ENV-VARIABLES-GUIDE.md |
| P-02 | MIGRATIONS-GUIDE.md, TENANT-PROVISIONING.md |
| P-03 | WORKFLOWS-GUIDE.md §WA-Receiver-Base |
| P-04 | WORKFLOWS-GUIDE.md §WA-Brann-Atendimento |
| P-05 | TOOL-REGISTRY-v1.md, WORKFLOWS-GUIDE.md §tools |
| P-06/07/08 | FAILURE-MODES.md, WORKFLOWS-GUIDE.md §Incident-Handler |
| P-10/11/12 | MIGRATIONS-GUIDE.md §003_rag, WORKFLOWS-GUIDE.md §RAG |
| P-13 | MANUAL_SAAS_1.md §6.6 |
| P-14 | MIGRATIONS-GUIDE.md §005_observability |
| FE-01 | NEXTJS-AUTH-FLOW.md, SUPABASE-AUTH-CONFIG.md |
| FE-02 | API-ROUTES.md §Dashboard |
| FE-03 | API-ROUTES.md §Billing, WORKER-QUEUE.md §metering |
| P-15 | INFRA-SETUP.md §9, TENANT-PROVISIONING.md |

---

## Kit fundador completo — 15 documentos

```
Arquitetura e produto:
  README.md                    ← referência técnica principal
  MANUAL_SAAS_1.md             ← manual completo 9 seções
  docs/architecture/TOOL-REGISTRY-v1.md

Banco e dados:
  MIGRATIONS-GUIDE.md          ← 9 lotes SQL

Infra e deploy:
  INFRA-SETUP.md               ← VPS + DNS + Vercel + signup

Backend:
  API-ROUTES.md                ← 35+ rotas com contratos
  WORKER-QUEUE.md              ← 5 workers + sistema de filas

Frontend:
  NEXTJS-AUTH-FLOW.md          ← SSR + middleware + auth pages

Configuração:
  ENV-VARIABLES-GUIDE.md       ← 50+ variáveis por serviço
  ENV-MATRIX.md                ← matriz oficial de variáveis
  SUPABASE-AUTH-CONFIG.md      ← painel + triggers + OAuth

Workflows:
  WORKFLOWS-GUIDE.md           ← 8 workflows n8n nó por nó

Operação:
  docs/ops/TENANT-PROVISIONING.md
  docs/ops/FAILURE-MODES.md
  docs/prd/ginkgo-permanent-context.md ← contexto do Antigravity

Este arquivo:
  GINKGO-BUILD-ORDER.md        ← você está aqui
```

---

*Ginkgo AI Systems — GINKGO-BUILD-ORDER.md v1.0.0 — Março 2026*  
*Não há mais nada para arquitetar. O próximo passo é executar a Fase 0.*
