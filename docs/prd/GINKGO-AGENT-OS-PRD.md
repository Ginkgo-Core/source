# PRD Técnico — Ginkgo Agent OS v2.0.0
## Infraestrutura Central de Agentes da Ginkgo AI Systems

> **Versão:** 2.0.0 | **Data:** Abril 2026  
> **Status:** Definitivo / Executável  
> **Princípio:** O Ginkgo Agent OS é a consciência operacional da empresa, transformando contexto em prioridade e prioridade em ação, com governança e observabilidade.

---

## 1. Visão do Produto: Ginkgo Agent OS

O **Ginkgo Agent OS** é a camada central que transforma os agentes da Ginkgo em uma infraestrutura operacional unificada, multi-tenant, auditável e expansível. Ele funciona como um **sistema operacional de agentes**, onde cada agente é um módulo inteligente com identidade, memória, skills, ferramentas, permissões e telemetria.

Ele sustenta a linha de produtos **Leaf by Ginkgo**, que engloba todas as soluções de atendimento, vendas, CRM conversacional, operações, análise, tráfego, execução, criação de conteúdo, calendário, publicação e performance criativa.

A proposta não é criar “mais um bot”. A proposta é criar um **sistema operacional de agentes**, onde cada agente funciona como um módulo inteligente com:

- identidade
- memória
- skills
- ferramentas
- permissões
- telemetria

---

## 2. Objetivos Principais

Construir uma base única para que qualquer agente da Ginkgo possa:

1.  Receber inputs de múltiplos canais (WhatsApp, Web, API, etc.).
2.  Entender contexto e intenção de forma padronizada.
3.  Consultar memória hierárquica e conhecimento (RAG Laplace).
4.  Usar ferramentas com segurança e governança (Tool Bus).
5.  Executar ações e responder no formato ideal para o canal.
6.  Registrar tudo para auditoria, analytics e prova de ROI.
7.  Integrar uma **Camada de Observabilidade e Controle Humano (Human Oversight Layer)** para intervenção orientada por risco.
8.  Ser orquestrado por um **CEO Fantasma** que atua como Chief of Staff autônomo.

---

## 3. Problemas que Resolve

1.  **Fragmentação:** Elimina agentes criados como "gambiarras" isoladas com prompts e lógicas espalhadas.
2.  **Falta de Governança:** Define quem autorizou a ação, o que o agente pode fazer e por que respondeu de certa forma, com a HOL.
3.  **Memória Ruim:** Resolve o problema de agentes que esquecem contexto ou misturam informações de clientes diferentes, com memória hierárquica.
4.  **Integrações Caóticas:** Padroniza payloads, autenticação e logs de todas as ferramentas externas via Tool Bus.
5.  **Sem Prova de Valor:** Fornece telemetria para medir ROI, economia de tempo e eficácia operacional.
6.  **Risco de Autonomia Excessiva:** A HOL garante que a autonomia da IA seja proporcional ao risco da ação, com checkpoints e aprovações humanas.
7.  **Gargalos Humanos:** O CEO Fantasma otimiza a intervenção humana, focando-a nos pontos de maior impacto e valor.

---

## 4. Arquitetura Lógica Unificada

O Ginkgo Agent OS integra o CEO Fantasma e a Human Oversight Layer para criar um sistema robusto e adaptativo.

```mermaid
graph TD
    subgraph 
    CEO Fantasma
    subgraph Human Oversight Layer
        Policy Engine
        Approval Gates
        Anomaly Detection
        Human Feedback Loop
    end
    subgraph Ginkgo Agent OS Core
        Input Normalizer
        Intent Router
        Agent Runtime
        Memory System
        Tool Bus
        Audit Logger
        Analytics Layer
    end

    Canais --> Input Normalizer
    Input Normalizer --> Intent Router
    Intent Router --> Policy Engine
    Policy Engine --> Agent Runtime
    Agent Runtime --> Memory System
    Agent Runtime --> Tool Bus
    Agent Runtime --> Audit Logger
    Audit Logger --> Analytics Layer
    Policy Engine --> Approval Gates
    Audit Logger --> Anomaly Detection
    Approval Gates --> CEO Fantasma
    Anomaly Detection --> CEO Fantasma
    Human Feedback Loop --> CEO Fantasma
    CEO Fantasma --> Agent Runtime
    CEO Fantasma --> Policy Engine
    CEO Fantasma --> Approval Gates
    CEO Fantasma --> Human Feedback Loop

    style CEO Fantasma fill:#f9f,stroke:#333,stroke-width:2px
    style Human Oversight Layer fill:#ccf,stroke:#333,stroke-width:2px
    style Ginkgo Agent OS Core fill:#afa,stroke:#333,stroke-width:2px
```

**Explicação da Arquitetura Unificada:**

-   **Canais:** Ponto de entrada de todas as interações (WhatsApp, Web, API, etc.).
-   **Input Normalizer:** Transforma inputs heterogêneos em um payload JSON padrão.
-   **Intent Router:** Decide qual agente, skill e fluxo são necessários.
-   **Policy Engine:** Aplica regras de segurança e governança, consultando a Human Oversight Layer.
-   **Agent Runtime:** Orquestra a execução do agente, carregando memória, resolvendo skills e executando ferramentas.
-   **Memory System:** Gerencia a memória hierárquica e multi-tenant.
-   **Tool Bus:** Padroniza a interação com ferramentas externas.
-   **Audit Logger:** Registra todas as ações para trilha de auditoria.
-   **Analytics Layer:** Transforma dados de auditoria em métricas de negócio.
-   **Human Oversight Layer:** Camada de governança humana com Policy Engine, Approval Gates, Anomaly Detection e Human Feedback Loop.
-   **CEO Fantasma:** O orquestrador executivo central, que lê continuamente a operação, prioriza decisões, coordena agentes e utiliza a Human Oversight Layer para intervenção humana orientada por risco.

---

## 5. Módulos Centrais (Revisitado)

### 5.1 Core Runtime
Responsável pela execução padronizada, isolamento por tenant e rastreabilidade completa. Recebe o input estruturado e coordena os demais módulos, sob a orquestração do CEO Fantasma.

### 5.2 Input Normalizer
Transforma texto, áudio transcrito, imagens (OCR) e eventos de sistema em um payload JSON padrão contendo `tenant_id`, `workspace_id`, `agent_id` e metadados.

### 5.3 Intent Router & Policy Engine
O **Router** decide o fluxo (agente/skill), enquanto o **Policy Engine** aplica regras de segurança e governança, consultando a **Human Oversight Layer** para determinar o nível de autonomia permitido.

-   **Níveis de Autonomia:** `read` | `suggest` | `confirm_required` | `limited_autonomous_execution` | `full_autonomous_execution`.
-   **Validações:** Escopo do tenant, sensibilidade da ação, permissão por ferramenta, permissão por agente, confirmação humana obrigatória, limites por canal.

### 5.4 Memory System (Hierárquico e Multi-tenant)

-   **Org Memory:** Regras e padrões globais da Ginkgo.
-   **Tenant Memory:** Dados, políticas e contexto do cliente.
-   **Workspace Memory:** Contexto do produto ou ambiente específico (ex: Leaf do Cliente A).
-   **Agent Memory:** Contexto funcional do agente (ex: Brann = atendimento e venda).
-   **User Memory:** Preferências do operador humano.
-   **Session Memory:** Contexto efêmero da conversa ou execução atual.

**Tipos de Memória:** Relacional (clientes, leads), Documental (SOPs, FAQs), Vetorial (RAG, embeddings 768 dims), Efêmera (sessão, variáveis temporárias).

### 5.5 Tool Bus
Padroniza integrações externas com contrato explícito: `tool_name`, `description`, `permission_scope`, `input_schema`, `output_schema`, `timeout`, `retry_policy` e `audit_level`.

### 5.6 Response Composer
Monta a saída final de forma compatível com o canal e com o agente, respeitando o tom e destacando a ação principal.

### 5.7 Audit Logger
Registra tudo o que teve impacto operacional: input bruto, input normalizado, decisão de roteamento, memória consultada, skill escolhida, ferramentas chamadas, outputs, confirmação humana, falhas, timestamps, custo estimado.

### 5.8 Analytics Layer
Transforma uso operacional em métricas de produto e negócio: volume de mensagens, tempo médio de resposta, taxa de resolução, skills mais usadas, leads qualificados, reuniões agendadas, horas economizadas, custo operacional por fluxo.

---

## 6. Entidades e Fluxos Prioritários (Leaf by Ginkgo)

### 6.1 Entidades Principais
- `Tenant` | `Workspace` | `Agent` | `Skill` | `Tool` | `Policy` | `Contact` | `Conversation` | `Memory Entry` | `Tool Execution` | `Audit Event` | `Metric Event` | `Approval` | `Job`.

### 6.2 Fluxos de MVP (Leaf by Ginkgo)

1.  **Brann (Atendimento):** Entrada WhatsApp → Qualificação → Agendamento → Atualização CRM.
2.  **Alfred (Operação):** Comando Usuário → Análise de Dados → Recomendação → Execução Assistida.
3.  **Nyra (Conteúdo):** Input Criativo → Brand Memory → Geração de Copy/Calendário → Agendamento Social.

---

## 7. Stack Tecnológica Recomendada

-   **Persistência:** Postgres / Supabase (RLS obrigatório).
-   **Sessão/Cache:** Redis.
-   **Busca Vetorial:** Supabase Vector / Qdrant (768 dims).
-   **Orquestração:** n8n.
-   **Runtime:** Node.js / FastAPI.
-   **Arquivos:** Supabase Storage.
-   **LLM Core:** Claude Opus 4.6 (para CEO Fantasma e decisões estratégicas), modelos menores para tarefas de baixo custo.

---

## 8. Princípios Invioláveis

1.  **Multi-tenant por padrão:** Vazamento de dados é falha crítica zero.
2.  **Canal desacoplado do cérebro:** O core é o mesmo para qualquer interface.
3.  **Toda ação relevante é auditável:** Sem log, não há confiança.
4.  **Toda ferramenta deve seguir contrato:** Integração sem padrão vira sabotagem futura.
5.  **Memória precisa de escopo:** Toda memória deve carregar tenant, workspace, agente e contexto.
6.  **Analytics desde o início:** Produto sem métrica é misticismo.
7.  **Humano no Loop:** A autonomia da IA é sempre proporcional ao risco da ação e à capacidade de observabilidade, correção e intervenção humana.
8.  **CEO Fantasma como Maestro:** O orquestrador executivo central que transforma contexto em prioridade e prioridade em ação.

---

*Ginkgo AI Systems — GINKGO-AGENT-OS-PRD v2.0.0 — Abril 2026*
