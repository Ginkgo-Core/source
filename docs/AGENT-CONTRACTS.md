# AGENT-CONTRACTS.md — Ginkgo Source v1.0.0
## Contratos Tipados para Agentes Especialistas

> **Versão:** 1.0.0 | **Data:** Abril 2026  
> **Status:** Definitivo / Executável  
> **Princípio:** Agente sem contrato é síndico sem condomínio. Cada agente é uma unidade operacional com inputs, outputs e guardrails claros.

---

## 1. Visão Geral dos Contratos de Agentes

Para garantir a robustez e a previsibilidade do Ginkgo Source, cada agente especialista deve operar sob um contrato formal. Este contrato define as expectativas de entrada e saída, as ferramentas que pode utilizar, as ações que não pode realizar, e os mecanismos de tratamento de falhas e escalonamento humano. Isso transforma cada agente em um **módulo plugável e auditável** dentro do sistema.

**Objetivo:** Eliminar ambiguidades na operação dos agentes, garantir a segurança, facilitar a orquestração e permitir a telemetria precisa de cada etapa da execução.

---

## 2. Estrutura Padrão do Contrato de Agente

Cada contrato de agente deve seguir a seguinte estrutura, tipada para validação automática:

```json
{
  "agent_name": "string", // Nome único do agente (ex: "source_intake")
  "purpose": "string",    // Descrição concisa da função do agente
  "input_schema": {       // JSON Schema para validação da entrada
    "type": "object",
    "properties": {},
    "required": []
  },
  "output_schema": {      // JSON Schema para validação da saída
    "type": "object",
    "properties": {},
    "required": []
  },
  "allowed_tools": ["array_of_strings"], // Lista de tool_names permitidas
  "forbidden_actions": ["array_of_strings"], // Lista de ações explicitamente proibidas
  "preconditions": ["array_of_strings"], // Condições que devem ser verdadeiras antes da execução
  "postconditions": ["array_of_strings"], // Condições que devem ser verdadeiras após a execução bem-sucedida
  "timeout_ms": "integer", // Tempo máximo de execução em milissegundos
  "success_criteria": ["array_of_strings"], // Critérios objetivos para considerar a execução bem-sucedida
  "failure_conditions": ["array_of_strings"], // Condições que caracterizam uma falha
  "retry_policy": {       // Política de retry em caso de falha
    "max_retries": "integer",
    "delay_ms": "integer" // Atraso entre retries
  },
  "human_handoff_rules": ["array_of_strings"], // Regras para escalonamento humano
  "estimated_cost_per_run_usd": "float", // Custo médio estimado por execução
  "risk_level": "low|medium|high" // Nível de risco operacional da ação do agente
}
```

---

## 3. Contratos Específicos dos Agentes-Base

### 3.1. Source Intake Agent

**`agent_name`: `source_intake`**

-   **Purpose:** Normalizar a entrada bruta do cliente e preparar para triagem.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "raw_input": {"type": "string", "description": "Texto bruto ou evento do canal"},
        "channel": {"type": "string", "enum": ["site", "whatsapp", "form", "chat", "api", "internal"]},
        "client_metadata": {"type": "object", "description": "Metadados do cliente/lead (IP, user-agent, etc.)"}
      },
      "required": ["raw_input", "channel"]
    }
    ```
-   **Output Schema:** (Objeto `demand_object` conforme `ROUTING-POLICY.md`)
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "source_channel": {"type": "string"},
        "client_type": {"type": "string", "enum": ["lead", "cliente", "parceiro", "interno"]},
        "business_context": {"type": "string"},
        "raw_request": {"type": "string"},
        "interpreted_goal": {"type": "string"},
        "urgency_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "budget_signal": {"type": "string", "enum": ["low", "medium", "high", "unknown"]},
        "category_hint": {"type": "array", "items": {"type": "string"}},
        "attachments": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["captured"]}
      },
      "required": ["request_id", "source_channel", "raw_request", "status"]
    }
    ```
-   **Allowed Tools:** `nlp_processor.interpret_intent`, `knowledge_base.search_keywords`.
-   **Forbidden Actions:** Arquitetar soluções profundas, definir stack complexa.
-   **Preconditions:** N/A.
-   **Postconditions:** `demand_object` válido e com `status='captured'`.
-   **Timeout:** 5000ms.
-   **Success Criteria:** `demand_object` gerado com `interpreted_goal` e `category_hint` preenchidos (mesmo que com incerteza).
-   **Failure Conditions:** Falha na normalização do input, erro na interpretação básica.
-   **Retry Policy:** `max_retries: 1`, `delay_ms: 1000`.
-   **Human Handoff Rules:** Se `raw_input` for ilegível ou em idioma não suportado.
-   **Estimated Cost per Run:** 0.005 USD.
-   **Risk Level:** Low.

### 3.2. Source Discovery Agent

**`agent_name`: `source_discovery`**

-   **Purpose:** Refinar o problema real, reduzir ambiguidade e organizar o problema em um briefing técnico-comercial.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "demand_object": {"$ref": "#/definitions/demand_object"}, // Referência ao schema do Intake
        "client_history": {"type": "object", "description": "Histórico de interações com o cliente"}
      },
      "required": ["demand_object"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "problem_statement": {"type": "string"},
        "desired_outcome": {"type": "string"},
        "current_process": {"type": "string"},
        "pain_points": {"type": "array", "items": {"type": "string"}},
        "channels_involved": {"type": "array", "items": {"type": "string"}},
        "tools_involved": {"type": "array", "items": {"type": "string"}},
        "solution_type": {"type": "string", "enum": ["ready", "adapted", "custom"]},
        "estimated_scope": {"type": "string", "enum": ["small", "medium", "large"]},
        "estimated_complexity": {"type": "string", "enum": ["low", "medium", "high"]},
        "required_capabilities": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "success_metrics": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["diagnosed"]}
      },
      "required": ["request_id", "problem_statement", "desired_outcome", "solution_type", "status"]
    }
    ```
-   **Allowed Tools:** `knowledge_base.search_solutions`, `crm.get_client_profile`, `nlp_processor.clarify_ambiguity`.
-   **Forbidden Actions:** Gerar proposta comercial final, iniciar construção de artefatos.
-   **Preconditions:** `demand_object.status` = `captured`.
-   **Postconditions:** Briefing técnico-comercial gerado com `status='diagnosed'`.
-   **Timeout:** 15000ms.
-   **Success Criteria:** Briefing completo e sem ambiguidades, `solution_type` definido.
-   **Failure Conditions:** Incapacidade de refinar a demanda após interações, `interpreted_goal` permanece vago.
-   **Retry Policy:** `max_retries: 0` (escalar para humano diretamente).
-   **Human Handoff Rules:** Se a ambiguidade persistir após `nlp_processor.clarify_ambiguity` ou se o cliente solicitar intervenção humana.
-   **Estimated Cost per Run:** 0.02 USD.
-   **Risk Level:** Medium.

### 3.3. Source Architect Agent

**`agent_name`: `source_architect`**

-   **Purpose:** Desenhar a solução macro, definir a composição e o plano de implementação.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "briefing": {"$ref": "#/definitions/discovery_briefing"}, // Referência ao schema do Discovery
        "asset_library": {"type": "object", "description": "Catálogo de blueprints e templates existentes"},
        "client_context": {"type": "object", "description": "Contexto detalhado do cliente"}
      },
      "required": ["briefing"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "solution_summary": {"type": "string"},
        "modules": {"type": "array", "items": {"type": "string"}},
        "dependencies": {"type": "array", "items": {"type": "string"}},
        "delivery_plan": {"type": "array", "items": {"type": "object"}},
        "estimated_timeline_days": {"type": "integer"},
        "estimated_cost_usd": {"type": "float"},
        "status": {"type": "string", "enum": ["architected"]}
      },
      "required": ["request_id", "solution_summary", "modules", "delivery_plan", "status"]
    }
    ```
-   **Allowed Tools:** `knowledge_base.search_blueprints`, `tool_registry.list_tools`, `agent_registry.list_agents`, `pricing_engine.calculate_proposal`.
-   **Forbidden Actions:** Gerar código ou artefatos finais, interagir diretamente com o cliente sem aprovação.
-   **Preconditions:** `briefing.status` = `diagnosed`.
-   **Postconditions:** Arquitetura proposta gerada com `status='architected'`.
-   **Timeout:** 30000ms.
-   **Success Criteria:** Plano de solução completo, modular e com dependências claras.
-   **Failure Conditions:** Incapacidade de compor uma arquitetura viável com base no briefing, dependências críticas não resolvidas.
-   **Retry Policy:** `max_retries: 0` (escalar para humano).
-   **Human Handoff Rules:** Se a complexidade da solução exceder um limite pré-definido ou se não houver blueprints compatíveis.
-   **Estimated Cost per Run:** 0.05 USD.
-   **Risk Level:** High.

### 3.4. Source Builder Flow Agent

**`agent_name`: `source_builder_flow`**

-   **Purpose:** Construir lógica operacional, workflows e automações.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "architecture_plan": {"$ref": "#/definitions/architect_output"}, // Referência ao schema do Architect
        "flow_spec": {"type": "object", "description": "Especificação detalhada do fluxo a ser construído"},
        "asset_library": {"type": "object", "description": "Biblioteca de workflows e snippets existentes"}
      },
      "required": ["architecture_plan", "flow_spec"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "workflow_id": {"type": "string"},
        "workflow_blueprint": {"type": "string", "description": "JSON ou XML do workflow"},
        "integration_checklist": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["built_flow"]}
      },
      "required": ["request_id", "workflow_id", "workflow_blueprint", "status"]
    }
    ```
-   **Allowed Tools:** `n8n.create_workflow`, `n8n.update_workflow`, `supabase.insert_data`, `evolution_api.send_message`.
-   **Forbidden Actions:** Publicar workflow em produção sem aprovação de QA, modificar workflows críticos sem versionamento.
-   **Preconditions:** `architecture_plan.status` = `architected`.
-   **Postconditions:** Workflow funcional gerado com `status='built_flow'`.
-   **Timeout:** 60000ms.
-   **Success Criteria:** Workflow gerado conforme `flow_spec`, passando em testes unitários.
-   **Failure Conditions:** Erros de sintaxe no workflow, falha na integração com ferramentas externas.
-   **Retry Policy:** `max_retries: 2`, `delay_ms: 5000`.
-   **Human Handoff Rules:** Se o workflow exigir lógica complexa não coberta por templates ou se houver falhas persistentes na construção.
-   **Estimated Cost per Run:** 0.10 USD.
-   **Risk Level:** Medium.

### 3.5. Source Builder Interface Agent

**`agent_name`: `source_builder_interface`**

-   **Purpose:** Produzir interfaces de uso (landing pages, dashboards, apps leves).
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "architecture_plan": {"$ref": "#/definitions/architect_output"},
        "interface_spec": {"type": "object", "description": "Especificação detalhada da interface"},
        "asset_library": {"type": "object", "description": "Biblioteca de layouts e componentes"}
      },
      "required": ["architecture_plan", "interface_spec"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "interface_id": {"type": "string"},
        "frontend_code_repo": {"type": "string", "description": "URL do repositório de código"},
        "preview_url": {"type": "string", "format": "uri"},
        "status": {"type": "string", "enum": ["built_interface"]}
      },
      "required": ["request_id", "interface_id", "frontend_code_repo", "status"]
    }
    ```
-   **Allowed Tools:** `vercel.deploy_project`, `github.create_repo`, `code_editor.write_file`, `canva.generate_design`.
-   **Forbidden Actions:** Publicar em domínio de produção sem aprovação de QA, acessar dados sensíveis do cliente.
-   **Preconditions:** `architecture_plan.status` = `architected`.
-   **Postconditions:** Interface gerada e disponível em URL de preview com `status='built_interface'`.
-   **Timeout:** 90000ms.
-   **Success Criteria:** Interface funcional, responsiva e conforme `interface_spec`.
-   **Failure Conditions:** Erros de build, layout quebrado, falha no deploy.
-   **Retry Policy:** `max_retries: 1`, `delay_ms: 10000`.
-   **Human Handoff Rules:** Se o design exigir criatividade visual complexa ou se houver falhas persistentes no deploy.
-   **Estimated Cost per Run:** 0.20 USD.
-   **Risk Level:** Medium.

### 3.6. Source Content Agent

**`agent_name`: `source_content`**

-   **Purpose:** Criar ativos de comunicação (copy, roteiros, posts, criativos).
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "briefing": {"$ref": "#/definitions/discovery_briefing"},
        "content_spec": {"type": "object", "description": "Especificação detalhada do conteúdo"},
        "brand_guidelines": {"type": "object", "description": "Diretrizes de marca e tom de voz"}
      },
      "required": ["briefing", "content_spec"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "content_id": {"type": "string"},
        "generated_assets": {"type": "array", "items": {"type": "string", "format": "uri"}},
        "status": {"type": "string", "enum": ["content_generated"]}
      },
      "required": ["request_id", "content_id", "generated_assets", "status"]
    }
    ```
-   **Allowed Tools:** `openai.generate_text`, `elevenlabs.text_to_speech`, `canva.generate_design`, `blotato.generate_video`.
-   **Forbidden Actions:** Publicar conteúdo sem aprovação de QA, gerar conteúdo ofensivo ou ilegal.
-   **Preconditions:** `briefing.status` = `diagnosed`.
-   **Postconditions:** Ativos de comunicação gerados com `status='content_generated'`.
-   **Timeout:** 45000ms.
-   **Success Criteria:** Conteúdo gerado conforme `content_spec` e `brand_guidelines`.
-   **Failure Conditions:** Conteúdo irrelevante, fora do tom, ou falha na geração de mídia.
-   **Retry Policy:** `max_retries: 1`, `delay_ms: 5000`.
-   **Human Handoff Rules:** Se o conteúdo exigir criatividade artística complexa ou nuances culturais específicas.
-   **Estimated Cost per Run:** 0.08 USD.
-   **Risk Level:** Medium.

### 3.7. Source QA Agent

**`agent_name`: `source_qa`**

-   **Purpose:** Auditar consistência, clareza, segurança e viabilidade da solução.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "solution_artifacts": {"type": "array", "items": {"type": "object", "description": "Lista de artefatos gerados pelos Builders"}},
        "briefing": {"$ref": "#/definitions/discovery_briefing"},
        "architecture_plan": {"$ref": "#/definitions/architect_output"},
        "policies": {"type": "object", "description": "Políticas de segurança e governança"}
      },
      "required": ["solution_artifacts", "briefing", "architecture_plan", "policies"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "qa_result": {"type": "string", "enum": ["approved", "approved_with_adjustments", "rejected"]},
        "feedback": {"type": "string", "description": "Detalhes do feedback ou ajustes necessários"},
        "status": {"type": "string", "enum": ["qa_completed"]}
      },
      "required": ["request_id", "qa_result", "status"]
    }
    ```
-   **Allowed Tools:** `code_analyzer.run_tests`, `security_scanner.run_scan`, `policy_engine.validate_compliance`, `nlp_processor.check_coherence`.
-   **Forbidden Actions:** Modificar artefatos diretamente, aprovar soluções com falhas críticas.
-   **Preconditions:** Todos os `solution_artifacts` relevantes foram gerados.
-   **Postconditions:** `qa_result` e `feedback` gerados com `status='qa_completed'`.
-   **Timeout:** 60000ms.
-   **Success Criteria:** `qa_result` é `approved` ou `approved_with_adjustments`.
-   **Failure Conditions:** Falha na validação de segurança, inconsistência lógica, não conformidade com briefing.
-   **Retry Policy:** `max_retries: 0` (escalar para humano).
-   **Human Handoff Rules:** Se `qa_result` for `rejected` ou se o feedback exigir análise complexa.
-   **Estimated Cost per Run:** 0.07 USD.
-   **Risk Level:** High.

### 3.8. Source Success Agent

**`agent_name`: `source_success`**

-   **Purpose:** Fechar o ciclo operacional, garantir continuidade, onboarding e expansão do cliente.
-   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "qa_result": {"$ref": "#/definitions/qa_output"}, // Referência ao schema do QA
        "solution_artifacts": {"type": "array", "items": {"type": "object"}},
        "client_profile": {"type": "object", "description": "Perfil detalhado do cliente"}
      },
      "required": ["qa_result", "solution_artifacts", "client_profile"]
    }
    ```
-   **Output Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "request_id": {"type": "string", "format": "uuid"},
        "onboarding_plan": {"type": "string"},
        "maintenance_plan": {"type": "string"},
        "upsell_recommendations": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["deployed", "monitoring"]}
      },
      "required": ["request_id", "onboarding_plan", "status"]
    }
    ```
-   **Allowed Tools:** `crm.update_client_status`, `billing.activate_subscription`, `docs_generator.create_handover_doc`, `email_sender.send_onboarding_email`.
-   **Forbidden Actions:** Modificar a solução sem aprovação, prometer funcionalidades não existentes.
-   **Preconditions:** `qa_result.qa_result` = `approved` ou `approved_with_adjustments`.
-   **Postconditions:** Plano de continuidade gerado e cliente em `status='deployed'` ou `monitoring'`.
-   **Timeout:** 20000ms.
-   **Success Criteria:** Cliente onboarded, solução ativa, plano de manutenção e upsell gerados.
-   **Failure Conditions:** Falha na ativação da solução, erro no envio de documentação.
-   **Retry Policy:** `max_retries: 2`, `delay_ms: 3000`.
-   **Human Handoff Rules:** Se o cliente exigir suporte personalizado durante o onboarding ou se houver problemas críticos na ativação.
-   **Estimated Cost per Run:** 0.03 USD.
-   **Risk Level:** Low.

---

*Ginkgo AI Systems — docs/AGENT-CONTRACTS.md v1.0.0 — Abril 2026*
