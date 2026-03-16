# SPRINT-1-EXECUTION.md
## Plano de Execução Enxuto — Sprint 1
### O que entra onde: Claude Code · AIOX · Ralph Loop

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Escopo:** Semanas 1–2 apenas. Nada além disso.  
> **Resultado esperado:** Brann respondendo no WhatsApp com logs, lead score e handoff.

---

## Divisão de responsabilidades

```
CLAUDE CODE   → escreve código, migrations, configs, scripts
AIOX          → orquestra agentes, executa tools, valida outputs
RALPH LOOP    → NÃO ENTRA NO SPRINT 1
               (só depois que Sprint 1 estiver firme e testado)
```

---

## Por que Ralph não entra agora

Ralph Loop (generate → test → fix → optimize → commit) presume que o ambiente já existe: testes rodando, CI configurado, banco populado, containers saudáveis. No Sprint 1, o ambiente ainda está sendo construído. Colocar Ralph antes de ter chão firme é auto-melhorar algo que ainda não existe. Ele entra na Sprint 2 ou 3, quando houver código real para otimizar.

---

## Sprint 1 — Tarefas por ferramenta

### P-01 — Infra Docker + VPS

```
CLAUDE CODE faz:
  Arquivo: infra/docker/docker-compose.yml
  Arquivo: infra/docker/.env.example
  Arquivo: infra/docker/deploy.sh
  Arquivo: docs/ops/README-infra.md

VOCÊ executa (manual — não delegar):
  SSH na VPS
  cp .env.example .env && nano .env
  docker compose run --rm chatwoot bundle exec rails db:chatwoot_prepare
  bash deploy.sh

GATE antes de avançar:
  docker compose ps → todos healthy
  curl https://n8n.ginkgosystems.tech/healthz → 200
  redis-cli ping → PONG
```

---

### P-02 — Schema + Seed

```
CLAUDE CODE faz:
  supabase/migrations/000_extensions.sql
  supabase/migrations/001_platform_core.sql
  supabase/migrations/002_leaf.sql
  supabase/migrations/003_rag.sql
  supabase/migrations/004_agents_skills.sql
  supabase/migrations/005_observability.sql
  supabase/migrations/006_billing.sql
  supabase/migrations/007_integrations.sql
  supabase/migrations/008_marketplace.sql
  supabase/migrations/009_rls.sql
  supabase/seed/tenant_zero.sql
  supabase/check-schema.sql

Referência para o Claude Code:
  MIGRATIONS-GUIDE.md (SQL exato por lote)
  TENANT-PROVISIONING.md (seed do Tenant Zero)

VOCÊ executa:
  supabase link --project-ref <id>
  supabase db push
  psql $DB_URL -f supabase/seed/tenant_zero.sql
  psql $DB_URL -f supabase/check-schema.sql

GATE:
  check-schema.sql → 38+ tabelas
  SELECT * FROM tenants WHERE id = 'f47ac10b...' → 1 linha
  RLS: SET LOCAL app.tenant_id = 'fake-uuid';
       SELECT count(*) FROM contacts; → 0
```

---

### P-03 — Canal WhatsApp + Webhook n8n

```
CLAUDE CODE faz:
  scripts/setup-evolution.sh
  scripts/test-webhook.sh
  n8n/workflows/WA-Receiver-Base.json

AIOX valida:
  Estrutura do payload Evolution
  Campos extraídos corretamente (phone, message, pushName)
  Log em tool_executions após recebimento

VOCÊ executa:
  bash scripts/setup-evolution.sh
  Escanear QR no painel Evolution
  bash scripts/test-webhook.sh

GATE:
  Evolution: status = open (QR conectado)
  test-webhook.sh → 200
  SELECT tool_name, input_json FROM tool_executions
  WHERE tool_name = 'webhook_received' → phone e message presentes
```

---

### P-04 — Brann Flow Completo

```
CLAUDE CODE faz:
  n8n/workflows/WA-Brann-Atendimento.json
    (webhook → contact upsert → conversation → context → OpenAI → Evolution → log)
  utils/sanitize-whatsapp.js

AIOX valida:
  Fluxo de nós está na ordem correta
  Variáveis de env referenciadas (não hardcoded)
  Sanitização remove ** __ ## antes de enviar
  tool_executions salvo com latency_ms e tokens_used

GATE:
  Enviar "Olá" → resposta em < 5s
  SELECT sender_type FROM messages ORDER BY created_at DESC LIMIT 2
    → ['agent', 'user']
  Nenhum markdown na resposta WhatsApp
  tool_executions com success=true
```

---

### P-05 — Tools: create_lead + fetch_catalog + handoff_human

```
CLAUDE CODE faz:
  Atualiza WA-Brann-Atendimento.json com:
    function specs (OpenAI tools array)
    nós executores por tool
    reinjeção de tool result

AIOX valida:
  Function specs corretas (JSON Schema válido)
  Cada tool retorna o output correto
  Reinjeção não cria loop infinito (máx 1 reinject)
  handoff_human cria ticket no Chatwoot com campos certos

Referência para Claude Code:
  TOOL-REGISTRY-v1.md (specs de cada tool)
  WORKFLOWS-GUIDE.md (executores nó a nó)

GATE:
  T-lead: nome+telefone+interesse → contacts.tags inclui 'lead'
  T-catalog: pergunta planos → resposta usa chunks, não memória
  T-handoff: "falar com pessoa" →
    ticket Chatwoot com summary
    alerta WhatsApp operador < 30s
    conversations.status = 'handoff'
```

---

### P-06/07/08 — Prompt + Lead Score + Incidents

```
CLAUDE CODE faz:
  INSERT SQL: prompt_versions (brann-t0-v1.0)
  scripts/rollback-prompt.sh
  n8n/workflows/Lead-Score-Engine.json
  n8n/workflows/Incident-Handler.json

AIOX valida:
  Prompt está no banco com active=true
  Score calculado corretamente por regra
  Alerta de lead quente chega no WhatsApp
  Incident criado quando OpenAI falha
  Fallback ao usuário < 10s após falha

Referência para Claude Code:
  FAILURE-MODES.md §3.1 (LLM timeout)
  WORKFLOWS-GUIDE.md §Lead-Score-Engine

GATE:
  SELECT content FROM prompt_versions
    WHERE active=true AND agent_type='brann' → conteúdo correto
  rollback-prompt.sh → muda versão sem reiniciar n8n
  Score >= 70 → alerta WhatsApp < 30s
  OPENAI_API_KEY inválida:
    usuário recebe fallback
    incidents com severity='high'
    operador alertado < 30s
```

---

## Checklist final Sprint 1 — Gate obrigatório

```
INFRA
[ ] docker compose ps → 6 containers healthy/running
[ ] SSL ativo nos 5 subdomínios (padlock no browser)
[ ] curl n8n → 200 · redis ping → PONG

BANCO
[ ] 38+ tabelas · Tenant Zero · RLS validado
[ ] Trigger on_auth_user_created criado
[ ] check-schema.sql sem erros

CANAL
[ ] Evolution conectado (QR escaneado)
[ ] webhook_received aparece em tool_executions

BRANN
[ ] Responde em < 5s
[ ] Sem markdown no WhatsApp
[ ] create_lead salva contato
[ ] fetch_catalog usa base, não memória
[ ] handoff chega no Chatwoot com contexto
[ ] Lead score calculado e alerta disparado
[ ] Falha → fallback + incident + alerta

TENANT ZERO
[ ] 24h de operação sem intervenção manual
→ Sprint 2 só começa com todos marcados
```

---

## Quando Ralph Loop entra

```
Sprint 1  → NÃO
Sprint 2  → NÃO (RAG ainda sendo construído)
Sprint 3  → SIM, para:
              refatorar utils/sanitize-whatsapp.js
              otimizar chunking do RAG
              melhorar query de retrieval híbrido
              test loop nos executores de tools
```

---

## Protocolo de sessão com Claude Code

```
1. Abrir nova sessão
2. Colar ginkgo-permanent-context.md
3. Separar com ---
4. Colar o prompt do task atual (P-01, P-02, etc.)
5. Receber o plano do agente
6. Enviar para revisão antes de aplicar
7. Executar somente após aprovação
8. Validar gate
9. Só avançar com gate 100% marcado
```

---

*Ginkgo AI Systems — SPRINT-1-EXECUTION.md v1.0.0 — Março 2026*  
*Congelar aqui. Executar P-01.*
