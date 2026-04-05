# ROUTING-POLICY.md — Ginkgo Source v1.0.0
## Especificação de Roteamento e Políticas do Agentic Router

> **Versão:** 1.0.0 | **Data:** Abril 2026  
> **Status:** Definitivo / Executável  
> **Princípio:** O router pensa pouco, delega bem e consolida certo. Ele não é o superagente.

---

## 1. Visão Geral do Agentic Router

O Agentic Router é o cérebro tático do Ginkgo Source, responsável por interpretar a demanda inicial, classificá-la, decompor em subtarefas e delegar a execução aos agentes especialistas corretos. Sua função primária é a **orquestração inteligente**, garantindo que cada solicitação siga o pipeline mais eficiente e governado.

**Objetivo:** Transformar uma demanda bruta em uma sequência de execução otimizada, minimizando a ambiguidade e maximizando a rastreabilidade.

---

## 2. Input Signals e Classificação da Demanda

O router recebe um objeto de demanda normalizado (`demand_object`) da Camada de Entrada e o utiliza para tomar decisões de roteamento.

**Estrutura Mínima do `demand_object`:**

```json
{
  "request_id": "uuid",
  "source_channel": "site|whatsapp|form|internal",
  "client_type": "lead|cliente|parceiro|interno",
  "business_context": "string",
  "raw_request": "string",
  "interpreted_goal": "string",
  "urgency_level": "low|medium|high",
  "budget_signal": "low|medium|high|unknown",
  "category_hint": ["array_of_strings"], // Ex: ["atendimento", "marketing"]
  "attachments": [],
  "status": "captured"
}
```

**Regras de Classificação (Prioridade Decrescente):**

1.  **`category_hint`:** Se presente e validado, define a categoria principal.
2.  **`interpreted_goal`:** Análise semântica para inferir categoria e complexidade.
3.  **`raw_request`:** Análise de palavras-chave e padrões para categorização inicial.

**Categorias de Demanda (Taxonomia Oficial):**

-   `atendimento`
-   `marketing`
-   `social`
-   `vendas`
-   `operação`
-   `interface`
-   `software`
-   `analytics`
-   `custom_ai`

---

## 3. Políticas de Roteamento e Sequência de Agentes

O router utiliza um conjunto de regras objetivas para determinar a sequência de agentes e a paralelização de tarefas. A decisão é baseada na categoria da demanda, complexidade, urgência e tipo de cliente.

**3.1. Definição de Complexidade:**

| Nível de Complexidade | Critérios Objetivos |
|---|---|
| **Baixa** | Demanda se encaixa em `solução pronta` (pacote padronizado). `interpreted_goal` claro, `attachments` mínimos, `budget_signal` `low` ou `medium`. |
| **Média** | Demanda se encaixa em `solução híbrida` (pacote + adaptação). `interpreted_goal` com requisitos adicionais, `attachments` moderados, `budget_signal` `medium` ou `high`. |
| **Alta** | Demanda se encaixa em `solução personalizada` (projeto bespoke). `interpreted_goal` vago ou com requisitos muito específicos, múltiplos `category_hint`, `attachments` complexos, `budget_signal` `high` ou `unknown`. |

**3.2. Sequência de Agentes Padrão (Pipeline):**

Todos os jobs seguem a sequência lógica: `Intake` → `Discovery` → `Architect` → `Builder(s)` → `QA` → `Success`.

**3.3. Regras de Condição para Agentes:**

-   **`Source Intake`:** **Sempre obrigatório.** Primeiro agente a processar qualquer `demand_object`.
-   **`Source Discovery`:**
    *   **Obrigatório se:** `complexity` é `Média` ou `Alta`, OU `interpreted_goal` é ambíguo (> 70% de incerteza na classificação semântica), OU `category_hint` está vazio.
    *   **Pode ser pulado se:** `complexity` é `Baixa` E `interpreted_goal` é claro E `category_hint` é único e validado.
-   **`Source Architect`:**
    *   **Obrigatório se:** `complexity` é `Alta`, OU `solution_type` é `custom`, OU múltiplos `category_hint` são identificados.
    *   **Pode ser pulado se:** `complexity` é `Baixa` E `solution_type` é `ready`.
-   **`Source Builder Flow` / `Source Builder Interface` / `Source Content`:**
    *   **Paralelização:** Podem rodar em paralelo se o `Source Architect` (ou `Source Discovery` em casos simples) definir dependências claras e independentes entre os artefatos a serem construídos.
    *   **Ordem:** A ordem de execução entre eles é definida pelo `Source Architect` com base nas dependências do `delivery_plan`.
-   **`Source QA`:** **Sempre obrigatório.** Bloqueia a transição para `deployment_ready` se reprovado.
-   **`Source Success`:** **Sempre obrigatório.** Último agente a atuar antes e durante a implantação.

---

## 4. Bloqueios e Escalonamentos

O router gerencia bloqueios e escalonamentos para garantir a fluidez do pipeline e a intervenção humana quando necessária.

**4.1. Condições de Bloqueio Automático:**

-   **`status` = `blocked`:**
    *   `Source QA` reprova uma entrega.
    *   `Policy Engine` detecta violação de segurança ou governança (`forbidden_action`).
    *   `Tool Executor` falha após `max_retries`.
    *   `Agent Runtime` atinge `timeout` sem resposta válida.
-   **`status` = `human_review_required`:**
    *   `Policy Engine` exige confirmação humana para `sensitive_action`.
    *   `Agent` solicita `escalation_to_human` (ex: ambiguidade crítica, necessidade de criatividade não-determinística).

**4.2. Regras de Escalonamento:**

-   **Bloqueio por QA:** Notificar `Source Architect` e `Source Success`. O `Source Architect` é responsável por iniciar a correção.
-   **Violação de Política:** Notificar `Security Officer` e `Source Architect`. O job permanece `blocked` até resolução manual.
-   **Falha de Tool/Runtime:** Notificar `Ops Team` e `Source Architect`. Tentativas de `retry` são automáticas antes do bloqueio.
-   **`human_review_required`:** Notificar `Source Success` (para cliente) ou `Product Owner` (para interno). O job aguarda aprovação.

**Quem pode mover o estado `blocked`:** Apenas `Product Owner` ou `Ops Team` via interface administrativa, após resolução da causa raiz.

---

## 5. Custo por Execução e Telemetria

Cada execução de agente e tool call gera um custo estimado que é registrado para telemetria e billing.

**Registro de `execution_event`:**

```json
{
  "execution_id": "uuid",
  "request_id": "uuid",
  "tenant_id": "uuid",
  "agent_id": "string",
  "skill_id": "string",
  "tool_used": "string",
  "cost_usd": "float",
  "latency_ms": "int",
  "status": "success|failure",
  "timestamp": "datetime"
}
```

**Propagação do `execution_id`:** O `execution_id` deve ser propagado por todo o sistema, desde o `Agent Runtime` até o `Tool Executor` e `Audit Logger`, garantindo rastreabilidade completa do custo e da performance de cada etapa.

---

*Ginkgo AI Systems — docs/ROUTING-POLICY.md v1.0.0 — Abril 2026*
