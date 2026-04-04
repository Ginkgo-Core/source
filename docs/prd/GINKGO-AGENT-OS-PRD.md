# PRD Técnico — Ginkgo Agent OS
## Infraestrutura central de agentes da Ginkgo AI Systems

> **Versão:** 1.0.0 | **Data:** Abril 2026  
> **Status:** Definitivo / MVP Scope  
> **Princípio:** O código é invariante. A configuração é o produto.

---

## 1. Visão do Produto

O **Ginkgo Agent OS** é a camada central que transforma os agentes da Ginkgo em uma infraestrutura operacional unificada, multi-tenant, auditável e expansível. Ele funciona como um **sistema operacional de agentes**, onde cada agente é um módulo inteligente com identidade, memória, skills, ferramentas, permissões e telemetria.

Ele sustenta os produtos:
- **Leaf** → atendimento, vendas, CRM conversacional.
- **Wave** → operações, análise, tráfego e execução.
- **Pyre** → criação, calendário, publicação e performance criativa.

---

## 2. Objetivos Principais

Construir uma base única para que qualquer agente da Ginkgo possa:
1. Receber eventos de múltiplos canais (WhatsApp, Web, API, etc.).
2. Entender contexto e intenção de forma padronizada.
3. Consultar memória hierárquica e conhecimento (RAG Laplace).
4. Usar ferramentas com segurança e governança (Tool Bus).
5. Executar ações e responder no formato ideal para o canal.
6. Registrar tudo para auditoria, analytics e prova de ROI.

---

## 3. Problemas que Resolve

1. **Fragmentação:** Elimina agentes criados como "gambiarras" isoladas com prompts e lógicas espalhadas.
2. **Falta de Governança:** Define quem autorizou a ação, o que o agente pode fazer e por que respondeu de certa forma.
3. **Memória Ruim:** Resolve o problema de agentes que esquecem contexto ou misturam informações de clientes diferentes.
4. **Integrações Caóticas:** Padroniza payloads, autenticação e logs de todas as ferramentas externas.
5. **Sem Prova de Valor:** Fornece telemetria para medir ROI, economia de tempo e eficácia operacional.

---

## 4. Arquitetura Lógica

```text
[Canais]
  ├─ WhatsApp (Evolution API)
  ├─ Dashboard Web (Next.js)
  ├─ Telegram / API / Webchat
        ↓
[Input Normalizer] -> Transforma entradas em JSON comum
        ↓
[Intent Router] -> Decide agente, skill e necessidade de tools
        ↓
[Policy Engine] -> Valida permissões (read, suggest, autonomous)
        ↓
[Agent Runtime]
        ├─ Memory Loader (Session, User, Tenant, Org)
        ├─ Skill Resolver (Mapeia intenção para capacidade)
        ├─ Tool Executor (Executa via Tool Bus)
        ├─ Response Composer (Adapta ao tom e canal)
        └─ Audit Logger (Trilha de auditoria completa)
        ↓
[Memory System] -> Hierárquico e Multi-tenant
        ↓
[Tool Bus] -> Conectores padronizados (Stripe, ClickUp, Meta, etc.)
        ↓
[Analytics + Audit + Observability]
```

---

## 5. Módulos Centrais

### 5.1 Core Runtime
Responsável pela execução padronizada, isolamento por tenant e rastreabilidade completa. Recebe o input estruturado e coordena os demais módulos.

### 5.2 Input Normalizer
Transforma texto, áudio transcrito, imagens (OCR) e eventos de sistema em um payload JSON padrão contendo `tenant_id`, `workspace_id`, `agent_id` e metadados.

### 5.3 Intent Router & Policy Engine
O **Router** decide o fluxo (agente/skill), enquanto o **Policy Engine** aplica regras de segurança:
- **Níveis:** `read` | `suggest` | `confirm_required` | `autonomous`.
- Valida limites por canal, ferramenta e sensibilidade da ação.

### 5.4 Memory System (Hierárquico)
- **Org Memory:** Regras globais da Ginkgo.
- **Tenant Memory:** Dados e políticas do cliente.
- **Workspace Memory:** Contexto do produto (Leaf/Wave/Pyre).
- **Agent/User Memory:** Contexto funcional e preferências do operador.
- **Session Memory:** Contexto efêmero da conversa atual.

### 5.5 Tool Bus
Padroniza integrações externas com contrato explícito: `tool_name`, `input_schema`, `output_schema`, `permission_scope` e `audit_level`.

---

## 6. Entidades e Fluxos Prioritários

### 6.1 Entidades Principais
- `Tenant` | `Workspace` | `Agent` | `Skill` | `Tool` | `Policy` | `Contact` | `Conversation`.

### 6.2 Fluxos de MVP
1. **Brann (Atendimento):** Entrada WhatsApp → Qualificação → Agendamento → Atualização CRM.
2. **Alfred (Operação):** Comando Usuário → Análise de Dados → Recomendação → Execução Assistida.
3. **Nyra (Conteúdo):** Input Criativo → Brand Memory → Geração de Copy/Calendário → Agendamento Social.

---

## 7. Stack Tecnológica Recomendada

- **Persistência:** Postgres / Supabase (RLS obrigatório).
- **Sessão/Cache:** Redis.
- **Busca Vetorial:** Supabase Vector / Qdrant (768 dims).
- **Orquestração:** n8n.
- **Runtime:** Node.js / FastAPI.
- **Arquivos:** Supabase Storage.

---

## 8. Princípios Invioláveis

1. **Multi-tenant por padrão:** Vazamento de dados é falha crítica zero.
2. **Canal desacoplado do cérebro:** O core é o mesmo para qualquer interface.
3. **Toda ação relevante é auditável:** Sem log, não há confiança.
4. **Analytics desde o início:** Produto sem métrica é misticismo.

---
*Ginkgo AI Systems — GINKGO-AGENT-OS-PRD v1.0.0 — Abril 2026*
