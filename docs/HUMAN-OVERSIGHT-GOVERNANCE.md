# HUMAN-OVERSIGHT-GOVERNANCE.md — Ginkgo Agent OS v1.0.0
## Camada de Observabilidade, Controle Humano e Governança por Risco

> **Versão:** 1.0.0 | **Data:** Abril 2026  
> **Status:** Definitivo / Executável  
> **Princípio:** A autonomia da IA no Ginkgo Agent OS é sempre proporcional ao risco da ação e à capacidade de observabilidade, correção e intervenção humana.

---

## 1. Visão Geral da Human Oversight Layer

A Human Oversight Layer (HOL) é uma camada arquitetural formal do Ginkgo Agent OS, projetada para garantir a segurança, a qualidade e a adaptabilidade do sistema. Ela reconhece que a IA não é infalível e que inconsistências, desvios e erros ocorrerão. Em vez de tentar eliminar a falha, a HOL foca em detectá-la cedo, conter seu impacto, corrigi-la com precisão e transformar erros recorrentes em aprendizado operacional.

**Objetivo:** Transformar a inconsistência da IA em um evento operacional observável, classificável e corrigível, com intervenção humana orientada por risco, evitando que a automação se torne um gargalo ou um risco descontrolado.

---

## 2. Níveis de Risco e Autonomia

Cada ação executada por um agente é classificada em um dos três níveis de risco, que determinam o grau de autonomia permitido e a necessidade de intervenção humana.

| Nível de Risco | Descrição | Autonomia da IA | Intervenção Humana |
|---|---|---|---|
| **Nível 1 - Baixo Risco** | Ações com impacto mínimo ou reversível. | **Quase Autônoma** | Revisão amostral ou por exceção. |
| **Nível 2 - Médio Risco** | Ações com impacto moderado, mas que exigem validação. | **Assistida (Checkpoint)** | Aprovação humana seletiva em pontos críticos. |
| **Nível 3 - Alto Risco** | Ações com impacto irreversível, financeiro ou legal significativo. | **Proibida sem Aprovação** | Aprovação humana obrigatória e explícita. |

**Exemplos de Ações por Nível de Risco:**

| Nível | Exemplos de Ações |
|---|---|
| **Baixo** | Rascunho de copy, estrutura inicial de landing page, briefing interno, organização de tarefas, documentação preliminar, respostas a FAQs. |
| **Médio** | Proposta comercial, workflow com integrações, texto final para cliente, classificação de demanda, recomendação de arquitetura, agendamento de reuniões. |
| **Alto** | Deploy em produção, alteração crítica em fluxo ativo, exclusão/sobrescrita de dados, envio massivo de comunicação, mudança de billing, decisões contratuais, permissões sensíveis. |

---

## 3. Componentes da Human Oversight Layer

A HOL é composta por módulos que garantem a observabilidade, o controle e o aprendizado contínuo.

### 3.1. Execution Logger

-   **Função:** Registrar cada etapa da execução de um job, incluindo ações de agentes, tool calls, decisões do router e eventos do sistema.
-   **Integração:** Utiliza o `Execution Ledger` especificado em [STATE-MACHINE-AUDIT.md](STATE-MACHINE-AUDIT.md).

### 3.2. Policy Engine (Revisitado)

-   **Função:** Avaliar o nível de risco de cada ação e aplicar as políticas de autonomia e aprovação correspondentes.
-   **Regras:** Baseado em `agent_contracts`, `user_permissions`, `action_context` e `risk_level`.
-   **Decisões:** `allow_autonomous`, `require_confirmation`, `block_action`, `escalate_to_human`.

### 3.3. Confidence Score

-   **Função:** Cada agente deve reportar um `confidence_score` (0-1) sobre a qualidade e certeza de sua saída.
-   **Uso:** O `Policy Engine` pode usar este score para ajustar o `risk_level` dinamicamente (ex: `medium_risk` + `low_confidence` = `high_risk`).

### 3.4. Approval Gates

-   **Função:** Pontos de parada obrigatórios no pipeline onde a execução só prossegue após aprovação humana explícita.
-   **Configuração:** Definidos por `risk_level` e `action_type` no `ROUTING-POLICY.md` e `AGENT-CONTRACTS.md`.
-   **Interface:** Dashboard de aprovações para o `Product Owner` ou `Ops Team`.

### 3.5. Anomaly Detection & Alerting

-   **Função:** Monitorar o `Execution Ledger` e o `Monitoring System` para identificar desvios de comportamento, falhas recorrentes ou violações de política.
-   **Alertas:** Disparar notificações para os responsáveis (Ops Team, Product Owner) com contexto detalhado.

### 3.6. Human Feedback Loop

-   **Função:** Capturar feedback humano sobre as saídas dos agentes e as decisões do sistema.
-   **Mecanismo:** Interface para `rotular erros`, `sugerir correções` e `validar resultados`.
-   **Aprendizado:** Cada feedback é um dado que alimenta a melhoria de prompts, políticas de roteamento, templates, checklists e critérios de QA.

### 3.7. Assisted Correction & Rework

-   **Função:** Fornecer ferramentas para que humanos possam corrigir saídas de agentes de forma eficiente.
-   **Capacidades:** `retry_with_guidance`, `rollback_to_previous_state`, `edit_artifact_directly`.
-   **Registro:** Toda correção humana é registrada no `Execution Ledger` como um evento de aprendizado.

---

## 4. Fluxo de Intervenção Humana Orientada por Risco

1.  **Detecção:** Um evento (falha de agente, baixa confiança, anomalia, ação de alto risco) é detectado.
2.  **Classificação de Risco:** O `Policy Engine` avalia o `risk_level` da ação/evento.
3.  **Decisão de Intervenção:**
    *   **Baixo Risco:** `allow_autonomous` (registro para revisão amostral).
    *   **Médio Risco:** `require_confirmation` (job pausado, notificação para aprovação humana).
    *   **Alto Risco:** `block_action` e `escalate_to_human` (job bloqueado, notificação urgente para intervenção).
4.  **Intervenção Humana:** O humano revisa o contexto, o `Execution Ledger` e o `confidence_score`.
5.  **Ação Humana:** O humano pode `aprovar`, `rejeitar`, `corrigir` ou `escalar` novamente.
6.  **Aprendizado:** A ação humana e seu resultado são registrados, alimentando o `Human Feedback Loop` para refinar o sistema.

---

## 5. Integração com o CEO Fantasma

A Human Oversight Layer é o braço executivo do CEO Fantasma para garantir a governança. O CEO Fantasma utiliza os dados da HOL para:

-   **Monitoramento:** Exibir o `Painel Executivo` com alertas de risco e aprovações pendentes.
-   **Priorização:** Incluir jobs `blocked` ou `human_review_required` nas prioridades do dia.
-   **Tomada de Decisão:** Fornecer contexto detalhado para o fundador/gestor em casos de escalonamento.
-   **Melhoria Contínua:** Analisar padrões de falha e sugerir ajustes em políticas, prompts ou agentes.

---

*Ginkgo AI Systems — docs/HUMAN-OVERSIGHT-GOVERNANCE.md v1.0.0 — Abril 2026*
