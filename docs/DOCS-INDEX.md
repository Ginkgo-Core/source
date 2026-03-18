# Índice da Documentação — Ginkgo AI Systems

Este é o ponto de entrada central para toda a documentação técnica do ecossistema Ginkgo. Os documentos estão organizados por categoria para facilitar a navegação e a consulta.

> **Última atualização:** Março 2026 — 9 novos documentos adicionados.

---

## 1. Estratégia e Visão Geral

| Documento | Descrição |
|---|---|
| [**MANUAL_SAAS.md**](MANUAL_SAAS.md) | O manual definitivo. Visão completa da arquitetura, stack, modelo de dados, deploy e boas práticas. **Comece por aqui.** |
| [**GINKGO-SYSTEM-DIAGRAM.md**](GINKGO-SYSTEM-DIAGRAM.md) | Diagrama técnico completo da plataforma, mostrando a interação entre todos os componentes. |
| [**GINKGO-BUILD-ORDER.md**](GINKGO-BUILD-ORDER.md) | A ordem oficial de construção, do zero ao primeiro cliente, dividida em 4 fases com gates de validação. |
| [**SPRINT-1-EXECUTION.md**](SPRINT-1-EXECUTION.md) | Plano de execução detalhado para o Sprint 1 (Semanas 1-2), com a divisão de tarefas entre agentes e o operador. |

---

## 2. Produto e Estratégia

| Documento | Descrição |
|---|---|
| [**prd/GINKGO-WORKSPACE-PRD.md**](prd/GINKGO-WORKSPACE-PRD.md) | PRD completo do Ginkgo Workspace. Visão de produto, 4 agentes, 5 áreas de interface, modelo de tokenização, assinaturas, skills e fases de execução. |
| [**prd/PRD-ANALYSIS.md**](prd/PRD-ANALYSIS.md) | Análise estratégica e técnica do PRD. Benchmarking competitivo (SimilarWeb) e mapeamento de gems open-source por funcionalidade (GitHub Gem Seeker). |
| [**prd/MARKET-INTELLIGENCE.md**](prd/MARKET-INTELLIGENCE.md) | **NOVO** — Análise de mercado, dores, concorrência e blueprint ideal da plataforma. Mapeia os 4 mercados em convergência, as 6 dores latentes, a análise competitiva por categoria e as 5 lacunas críticas a preencher para escalar. |

---

## 3. Arquitetura de Sistema

| Documento | Descrição |
|---|---|
| [**architecture/OPENCLAW-ARCHITECTURE.md**](architecture/OPENCLAW-ARCHITECTURE.md) | **NOVO** — Posicionamento definitivo do OpenClaw como runtime cognitivo central. Define a fronteira OpenClaw × n8n, os 5 blocos internos do runtime (Agent Registry, Session Runtime, Tool Router, Memory Bridge, Policy Layer), o fluxo completo de atendimento Brann e as regras de observabilidade. |

---

## 4. Infraestrutura e Deploy

| Documento | Descrição |
|---|---|
| [**INFRA-SETUP.md**](INFRA-SETUP.md) | Guia operacional v1.0 para configurar a infraestrutura de produção: VPS, Cloudflare, Vercel, Docker e serviços. |
| [**workers/INFRA-SETUP-V2.md**](workers/INFRA-SETUP-V2.md) | **NOVO** — v2.0 do setup de infraestrutura com configurações refinadas, docker-compose completo atualizado, script `deploy.sh` e checklist binário de go-live por categoria. |
| [**workers/MIGRATIONS-GUIDE.md**](workers/MIGRATIONS-GUIDE.md) | **NOVO** — Guia completo de migrations do banco de dados (000 a 009 + seed). Inclui o SQL completo de todas as tabelas: `tenants`, `profiles`, `memberships`, `channels`, `contacts`, `conversations`, `messages`, `lead_scores`, `knowledge_assets`, `knowledge_chunks`, `agents`, `skills`, `subscriptions`, `token_balances`, `audit_logs` e RLS policies. |

---

## 5. Backend e Agentes

| Documento | Descrição |
|---|---|
| [**API-ROUTES.md**](API-ROUTES.md) | O contrato completo da API principal (`apps/api`), com todas as rotas, schemas de request/response e códigos de erro. |
| [**AGENT-KERNEL.md**](AGENT-KERNEL.md) | Kernel de governança de execução de agentes (`packages/agents`) — v1.5 Hardened Industrial. Inclui singleton Supabase, `execution_id`, idempotência e débito atômico de tokens. |
| [**AGENT-SPEC.md**](AGENT-SPEC.md) | Contrato de declaração de agentes. Define como criar Brann, Alfred, Nyra e Command via `config.ts`, `prompt.ts` e `tools.ts` sem tocar no kernel. Inclui o `agent-runtime.ts` completo. |

---

## 6. Workers e Filas

| Documento | Descrição |
|---|---|
| [**WORKER-QUEUE.md**](WORKER-QUEUE.md) | Arquitetura v1.0 do sistema de filas e workers assíncronos (Redis LPUSH + BullMQ). |
| [**workers/WORKER-QUEUE-V2.md**](workers/WORKER-QUEUE-V2.md) | **NOVO** — v2.0 completo do sistema de filas. Inclui implementação detalhada de todos os 5 workers: `provisioning`, `ingestion`, `sync` (CRON), `metering` e `notifications`. Decisão de migração Redis LPUSH → BullMQ documentada. |
| [**workers/VIDEO-PROCESSOR-INFRA.md**](workers/VIDEO-PROCESSOR-INFRA.md) | **NOVO** — Infraestrutura completa do worker de processamento de vídeo (skill `nyra-content-recycler`). Inclui estimativas de recursos por job, limite de concorrência (2 jobs simultâneos na VPS 4GB), Dockerfile, `docker-compose.yml` e código Python completo com yt-dlp, Whisper, GPT-4o, FFmpeg e MoviePy. |

---

## 7. Frontend e Autenticação

| Documento | Descrição |
|---|---|
| [**NEXTJS-AUTH-FLOW.md**](NEXTJS-AUTH-FLOW.md) | Fluxo de autenticação completo no Next.js 14 com Supabase SSR, middleware, layouts e componentes de cliente/servidor. |
| [**SUPABASE-AUTH-CONFIG.md**](SUPABASE-AUTH-CONFIG.md) | Checklist de configuração do Supabase Auth v1.0 — URLs, email, OAuth, JWT, triggers e RLS. |
| [**auth/SUPABASE-AUTH-CONFIG-V2.md**](auth/SUPABASE-AUTH-CONFIG-V2.md) | **NOVO** — v2.0 do Supabase Auth Config com configurações refinadas de OAuth (Google + Meta), templates de email customizados, JWT settings e trigger `on_auth_user_created` corrigido para o modelo multi-workspace (sem `tenant_id` no profile). |
| [**auth/MULTI-WORKSPACE-AUTH.md**](auth/MULTI-WORKSPACE-AUTH.md) | **NOVO** — Especificação completa de autenticação multi-workspace. Decisão de modelo (1 email → N tenants via memberships), JWT strategy com cookie `ginkgo-workspace`, API `GET /api/workspaces`, `middleware.ts` atualizado com workspace check, `get-tenant.ts`, componente `WorkspaceSwitcher` e regras de billing multi-workspace (plano Scale). |

---

## 8. Marketplace e Compliance

| Documento | Descrição |
|---|---|
| [**marketplace/SKILLS-COMPLIANCE.md**](marketplace/SKILLS-COMPLIANCE.md) | **NOVO** — Política de compliance e LGPD para skills. Classifica skills por risco (alto/médio/baixo), define base legal por tipo, política de retenção de dados, campos obrigatórios no manifest, onboarding modal de aceite, regras para marketplace de terceiros e jobs de limpeza automática. |
| [**marketplace/MARKETPLACE-REVENUE.md**](marketplace/MARKETPLACE-REVENUE.md) | **NOVO** — Modelo de receita do marketplace. Revshare 70/30, 3 tipos de billing (assinatura, por execução, pagamento único), cálculo real em 3 cenários, implementação Stripe Connect Express, worker de revshare (CRON dia 5), dashboard do desenvolvedor e projeção de receita por fase. |

---

## 9. Serviços e Integrações

| Documento | Descrição |
|---|---|
| [**EMAIL-TRANSACIONAL.md**](EMAIL-TRANSACIONAL.md) | Guia para configuração de emails transacionais com Resend e React Email, incluindo templates para os principais eventos. |

---

## Mapa de Dependências

```
MANUAL_SAAS.md
  └── GINKGO-BUILD-ORDER.md
        └── SPRINT-1-EXECUTION.md
              ├── workers/MIGRATIONS-GUIDE.md   ← banco de dados
              ├── workers/INFRA-SETUP-V2.md     ← VPS + Docker
              ├── auth/SUPABASE-AUTH-CONFIG-V2.md
              ├── auth/MULTI-WORKSPACE-AUTH.md
              ├── API-ROUTES.md
              ├── AGENT-KERNEL.md
              │     └── AGENT-SPEC.md
              └── architecture/OPENCLAW-ARCHITECTURE.md
                    └── workers/WORKER-QUEUE-V2.md
                          └── workers/VIDEO-PROCESSOR-INFRA.md

prd/GINKGO-WORKSPACE-PRD.md
  └── prd/PRD-ANALYSIS.md
        ├── marketplace/SKILLS-COMPLIANCE.md
        └── marketplace/MARKETPLACE-REVENUE.md
```

---

*Ginkgo AI Systems — Documentação Técnica Interna — Março 2026*
