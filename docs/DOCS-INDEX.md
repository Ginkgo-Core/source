# Índice da Documentação — Ginkgo AI Systems

Este é o ponto de entrada central para toda a documentação técnica do ecossistema Ginkgo. Os documentos estão organizados por categoria para facilitar a navegação e a consulta.

---

## 1. Estratégia e Visão Geral

| Documento | Descrição |
|---|---|
| [**MANUAL_SAAS.md**](MANUAL_SAAS.md) | O manual definitivo. Visão completa da arquitetura, stack, modelo de dados, deploy e boas práticas. **Comece por aqui.** |
| [**GINKGO-SYSTEM-DIAGRAM.md**](GINKGO-SYSTEM-DIAGRAM.md) | Diagrama técnico completo da plataforma, mostrando a interação entre todos os componentes. |
| [**GINKGO-BUILD-ORDER.md**](GINKGO-BUILD-ORDER.md) | A ordem oficial de construção, do zero ao primeiro cliente, dividida em 4 fases com gates de validação. |
| [**SPRINT-1-EXECUTION.md**](SPRINT-1-EXECUTION.md) | Plano de execução detalhado para o Sprint 1 (Semanas 1-2), com a divisão de tarefas entre agentes e o operador. |

---

## 2. Infraestrutura e Deploy

| Documento | Descrição |
|---|---|
| [**INFRA-SETUP.md**](INFRA-SETUP.md) | Guia operacional completo para configurar a infraestrutura de produção: VPS, Cloudflare, Vercel, Docker e serviços. |

---

## 3. Backend e Agentes

| Documento | Descrição |
|---|---|
| [**API-ROUTES.md**](API-ROUTES.md) | O contrato completo da API principal (`apps/api`), com todas as rotas, schemas de request/response e códigos de erro. |
| [**WORKER-QUEUE.md**](WORKER-QUEUE.md) | Arquitetura do sistema de filas e workers assíncronos (Redis + BullMQ), com exemplos de jobs e implementação. |
| [**AGENT-KERNEL.md**](AGENT-KERNEL.md) | Esqueleto técnico do `packages/agents`, o kernel que governa a execução segura e monitorada de todas as tools. |

---

## 4. Frontend e Autenticação

| Documento | Descrição |
|---|---|
| [**NEXTJS-AUTH-FLOW.md**](NEXTJS-AUTH-FLOW.md) | Fluxo de autenticação completo no Next.js 14 com Supabase SSR, middleware, layouts e componentes de cliente/servidor. |
| [**SUPABASE-AUTH-CONFIG.md**](SUPABASE-AUTH-CONFIG.md) | Checklist de configuração do Supabase Auth, incluindo URLs, email, OAuth, JWT, triggers e RLS. |

---

## 5. Serviços e Integrações

| Documento | Descrição |
|---|---|
| [**EMAIL-TRANSACIONAL.md**](EMAIL-TRANSACIONAL.md) | Guia para configuração de emails transacionais com Resend e React Email, incluindo templates para os principais eventos. |
