# INDEX.md
## Índice da Documentação — Ginkgo AI Systems
### Ponto de entrada central para toda a documentação técnica

> **Versão:** 2.0.0 | **Última atualização:** Março 2026  
> **Regra:** Todo novo documento entra aqui antes de ser referenciado em outros arquivos.

---

## 1. Estratégia e Visão

| Documento | Descrição |
|-----------|-----------|
| `README.md` | Referência técnica oficial do repositório. Stack, arquitetura, agentes, integrações, modelo de dados e roadmap. **Comece aqui.** |
| `docs/GINKGO-SOURCE-MANUAL.md` | **NOVO** — Manual Técnico Operacional do Ginkgo Source. Visão, arquitetura, agentes, produtos, jornada do cliente, governança e roadmap. |
| `docs/MANUAL_SAAS_1.md` | Manual definitivo em 9 seções. Visão completa de produto, stack, deploy e boas práticas. |
| `docs/GINKGO-SYSTEM-DIAGRAM.md` | Planta técnica da empresa em 12 diagramas ASCII. Todos os componentes e seus fluxos. |
| `docs/GINKGO-BUILD-ORDER.md` | Ordem oficial de construção do zero ao primeiro cliente. 4 fases com gates binários. |
| `docs/SPRINT-1-EXECUTION.md` | Plano de execução detalhado do Sprint 1. Claude Code vs AIOX vs Ralph Loop. |
| `docs/ginkgo-permanent-context.md` | Contexto permanente para o Antigravity. Colar no topo de toda sessão de build. |

---

## 2. Produto e Mercado

| Documento | Descrição |
|-----------|-----------|
| `docs/prd/GINKGO-AGENT-OS-PRD.md` | **NOVO** — PRD Técnico do Ginkgo Agent OS. Runtime unificado, memória hierárquica, barramento de ferramentas, políticas de governança e auditoria. |
| `docs/prd/GINKGO-WORKSPACE-PRD.md` | PRD completo do Ginkgo Workspace. 4 agentes, 5 áreas de interface, tokenização, skills, fases. |
| `docs/prd/MARKET-REPORT.md` | Relatório de mercado completo. Panorama, dores, concorrência, gaps e blueprint ideal. |
| `docs/prd/GITHUB-GEMS.md` | Mapeamento de ferramentas open-source por categoria. Stack recomendado e prioridades P1/P2/P3. |
| `docs/prd/MARKETPLACE-REVENUE.md` | Modelo de receita do marketplace. Revshare 70/30, Stripe Connect, projeções por fase. |
| `docs/prd/ENV-MATRIX.md` | Matriz oficial de variáveis de ambiente por serviço e ambiente. |

---

## 3. Arquitetura de Sistema

| Documento | Descrição |
|-----------|-----------|
| `docs/architecture/OPENCLAW-ARCHITECTURE.md` | Posicionamento do OpenClaw como runtime cognitivo central. Fronteira OpenClaw × n8n, blocos internos, fluxos por agente. |
| `docs/architecture/AGENT-KERNEL.md` | Kernel de governança v1.5 Hardened. db singleton, execution_id, idempotência, debit atômico. |
| `docs/architecture/AGENT-SPEC.md` | Contrato de declaração de agentes. config.ts + prompt.ts + tools.ts sem tocar no kernel. |
| `docs/architecture/TOOL-REGISTRY-v1.md` | Catálogo oficial de tools v1. Specs, permissões, billing impact, critérios de aprovação. |
| `docs/architecture/MULTI-WORKSPACE-AUTH.md` | Especificação de autenticação multi-workspace. Cookie strategy, WorkspaceSwitcher, billing consolidado. |
| `docs/architecture/OPENCLAW-CLAUDE-N8N-BOUNDARIES.md` | Fronteiras definitivas entre as 4 camadas: Ginkgo Core, OpenClaw, Claude Agent SDK e n8n. Regras de custo, código de integração e tabela de decisão. |
| `docs/architecture/KNOWLEDGE-ARCHITECTURE.md` | **NOVO** — Arquitetura Laplace RAG. 6 tipos de asset (INDEX/MOC/CLAIM/METHOD/FAQ/CATALOG), Brain Score, retrieval hierárquico, SQL `laplace_search` e Knowledge Health Worker. |
| `docs/architecture/ACTOR-SYSTEM.md` | **NOVO** — Sistema de Persona e Voz dos Agentes. Tabela `actor_profiles`, personas por segmento, geração de prompt com GPT-4o e integração ElevenLabs para respostas em áudio. |

---

## 4. Infraestrutura e Deploy

| Documento | Descrição |
|-----------|-----------|
| `docs/INFRA-SETUP.md` | Setup operacional completo. VPS + Cloudflare + Vercel + Docker Compose + fluxo de signup. |
| `docs/ENV-VARIABLES-GUIDE.md` | 50+ variáveis de ambiente documentadas por serviço e fase (P1/P2/P3). |

---

## 5. Banco de Dados

| Documento | Descrição |
|-----------|-----------|
| `docs/MIGRATIONS-GUIDE.md` | 9 lotes SQL completos (000–009) + seed Tenant Zero + RLS + check-schema. Modelo correto: `profiles ↔ memberships ↔ tenants`. |

---

## 6. Backend e API

| Documento | Descrição |
|-----------|-----------|
| `docs/API-ROUTES.md` | Contrato completo da API Fastify. 35+ rotas com request/response tipados. |
| `docs/WORKER-QUEUE.md` | Sistema de filas v1.1. Redis LPUSH (P1) → BullMQ (P2 com content-recycler). Decisão Postiz vs Blotato. |
| `docs/workers/VIDEO-PROCESSOR-INFRA.md` | Infraestrutura do worker de vídeo. FFmpeg + MoviePy + concurrency limits + Dockerfile Python. |

---

## 7. Frontend e Autenticação

| Documento | Descrição |
|-----------|-----------|
| `docs/NEXTJS-AUTH-FLOW.md` | Auth flow completo Next.js 14. Supabase SSR, middleware, layouts, WorkspaceSwitcher. |
| `docs/SUPABASE-AUTH-CONFIG.md` | Checklist do painel Supabase. URLs, OAuth, JWT, trigger on_auth_user_created (sem tenant_id no profile). |

---

## 8. Workflows e Integrações

| Documento | Descrição |
|-----------|-----------|
| `docs/WORKFLOWS-GUIDE.md` | 8 workflows n8n nó por nó com critérios de aceite. |
| `docs/EMAIL-TRANSACIONAL.md` | Resend + React Email. 5 templates + CRONs de alertas proativos. |

---

## 9. Operações

| Documento | Descrição |
|-----------|-----------|
| `docs/ops/TENANT-PROVISIONING.md` | Fluxo oficial de provisionamento de tenant. 10 etapas + idempotência + rollback. |
| `docs/ops/FAILURE-MODES.md` | Modos de falha previsíveis. Detecção, fallback, retry, alerta e critérios de severidade. |

---

## 10. Marketplace e Compliance

| Documento | Descrição |
|-----------|-----------|
| `docs/marketplace/SKILLS-COMPLIANCE.md` | Política LGPD para skills. Risco por categoria, retenção, modal de aceite, jobs de limpeza. |
| `docs/marketplace/MARKETPLACE-REVENUE.md` | Modelo de receita. Revshare 70/30, Stripe Connect Express, projeções por fase. |
| `docs/marketplace/SKILL-OPERATIONAL-ACTIONS.md` | **NOVO** — Skill genérica de ações operacionais. 7 tools invariantes + config.json por nicho. Clínica, pizzaria, restaurante, suporte. O template é o produto. |

---

## Mapa de dependências

```
README.md
  └── docs/MANUAL_SAAS_1.md
        └── docs/GINKGO-BUILD-ORDER.md
              └── docs/SPRINT-1-EXECUTION.md
                    ├── docs/MIGRATIONS-GUIDE.md
                    ├── docs/INFRA-SETUP.md
                    ├── docs/SUPABASE-AUTH-CONFIG.md
                    ├── docs/architecture/MULTI-WORKSPACE-AUTH.md
                    ├── docs/API-ROUTES.md
                    ├── docs/architecture/AGENT-KERNEL.md
                    │     └── docs/architecture/AGENT-SPEC.md
                    ├── docs/architecture/OPENCLAW-ARCHITECTURE.md
                    ├── docs/architecture/OPENCLAW-CLAUDE-N8N-BOUNDARIES.md
                    ├── docs/architecture/KNOWLEDGE-ARCHITECTURE.md
                    ├── docs/architecture/ACTOR-SYSTEM.md
                    └── docs/WORKER-QUEUE.md
                          └── docs/workers/VIDEO-PROCESSOR-INFRA.md

docs/prd/GINKGO-WORKSPACE-PRD.md
  ├── docs/prd/MARKET-REPORT.md
  ├── docs/prd/GITHUB-GEMS.md
  ├── docs/marketplace/SKILLS-COMPLIANCE.md
  └── docs/marketplace/MARKETPLACE-REVENUE.md
```

---

*Ginkgo AI Systems — docs/INDEX.md v2.4.0 — Abril 2026*
