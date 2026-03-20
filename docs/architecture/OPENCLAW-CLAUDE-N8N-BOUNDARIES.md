# OPENCLAW-CLAUDE-N8N-BOUNDARIES.md
## Fronteiras de Execução — OpenClaw · Claude Agent SDK · n8n · Ginkgo Core
### Onde cada peça começa e termina

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Decisão central:** Quatro camadas distintas com responsabilidades não sobrepostas.  
> **Regra de ouro:** Confusão de fronteiras = bugs invisíveis, custo explosivo e sistema não auditável.

---

## 1. Hierarquia das Quatro Camadas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GINKGO CORE                                  │
│  Auth · Tenants · Billing · Policies · Provisioning                 │
│  Observability · Token Health · Skill Governance · Dashboard        │
│  "O sistema operacional — governa tudo, não executa nada"           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       OPENCLAW RUNTIME                              │
│  Agent Registry · Session Runtime · Tool Router                     │
│  Memory Bridge · Policy Layer · Telemetry                           │
│  "O coração operacional — gerencia agentes e sessões"               │
└──────────┬───────────────────────────────────────────┬──────────────┘
           │                                           │
           │ (tarefas selecionadas de alto raciocínio) │
           ▼                                           ▼
┌──────────────────────────┐              ┌────────────────────────────┐
│   CLAUDE AGENT SDK       │              │       n8n                  │
│                          │              │                            │
│  Motor premium de        │              │  Automação procedural      │
│  raciocínio profundo      │              │  Webhooks · ETL · Sync    │
│  Multi-step · MCP tools  │              │  Jobs lineares · Alertas  │
│  Web search · Análise    │              │  Integrações previsíveis   │
│  "O piloto automático     │              │  "O sistema nervoso        │
│   para missões complexas" │              │   periférico"              │
└──────────────────────────┘              └────────────────────────────┘
```

---

## 2. Ginkgo Core — O que nunca sai daqui

```
RESPONSABILIDADE EXCLUSIVA DO CORE:

auth/
  Criação e validação de JWT (Supabase Auth)
  Gerenciamento de sessão (cookie ginkgo-workspace)
  OAuth com plataformas externas

tenants/
  Provisionamento de tenant (tenant + membership + subscription)
  Multi-workspace (WorkspaceSwitcher, cookie, memberships)
  Limites por plano (plan_limits table)

billing/
  Tokenização com markup (custo real × 2.5 = tokens cobrados)
  Débito atômico (debit_tokens_atomic SQL function)
  Stripe webhooks (invoice.paid, subscription.deleted)
  Pacotes de tokens e upgrades

policies/
  Tool Registry (o que pode ser executado por quem)
  Entitlements (quais skills o tenant tem ativas)
  Rate limits por tenant e por tool

observability/
  tool_executions (ledger completo de toda execução)
  incidents (falhas, alertas, severidade)
  usage_events (metering para billing)
  Token health por tenant

provisioning/
  worker-provisioning (Evolution instance + Chatwoot inbox)
  Seed de agentes e skills base por novo tenant

REGRA ABSOLUTA:
  OpenClaw NÃO provísiona tenants
  OpenClaw NÃO acessa billing diretamente
  OpenClaw NÃO gerencia skills
  n8n NÃO cria tenants
  n8n NÃO acessa token_balances diretamente
  Claude Agent SDK NÃO sabe que tokens existem
  Claude Agent SDK NÃO conhece o tenant — só recebe contexto
```

---

## 3. OpenClaw — O coração operacional

### O que é responsabilidade do OpenClaw

```
Agent Registry
  Lista de agentes ativos por tenant
  Config carregada do banco (AgentConfig)
  Cache em Redis (TTL 5min)

Session Runtime
  Sessões por conversa/canal/usuário
  Histórico em memória (Redis, TTL 2h)
  Fallback para Supabase messages

Tool Router
  Recebe tool_call do LLM
  Roteia para packages/agents/executor
  TODA execução passa pelo kernel — sem bypass

Memory Bridge
  Contexto curto prazo (últimas N mensagens)
  Contexto longo prazo (RAG via search_knowledge)
  Contexto do tenant (config, preferências)

Policy Layer
  Verifica se agente pode executar a tool
  Verifica subscription ativa
  Verifica token balance
  Delega para packages/agents/policy.ts

Telemetry
  Usa packages/agents/ledger.ts
  Não duplica — o kernel já loga tudo
```

### O que OpenClaw faz por agente

```
BRANN (atendimento):
  Casos que saem do fluxo simples (perguntas inesperadas)
  Qualificação complexa (SPIN Selling com contexto acumulado)
  Decisão de handoff (avaliar score + contexto + sentimento)
  Resposta personalizada com RAG

ALFRED (operações):
  Análise de relatórios e identificação de padrões
  Proposta de ações baseada em dados
  Interpretação de pedidos em linguagem natural
  Delegação de subtarefas para workers/n8n

NYRA (conteúdo):
  Interpretação de briefings não estruturados
  Estruturação de roteiros e narrativas
  Decisão de formato por canal e audiência
  Análise de performance e ajuste de estratégia

COMMAND (assistente):
  Entendimento de comandos ambíguos via Telegram/Web
  Delegação para Brann/Alfred/Nyra conforme contexto
  Execução de ordens cross-platform
  Respostas a perguntas complexas sobre a plataforma
```

### O que NÃO é responsabilidade do OpenClaw

```
❌ Receber webhook do Evolution API diretamente
❌ Salvar mensagens no banco (isso é o n8n/worker)
❌ Enviar respostas via Evolution API (isso é o n8n)
❌ Sincronizar dados de redes sociais (isso é o worker-sync)
❌ Processar vídeos (isso é o video-worker Python)
❌ Enviar emails (isso é o worker-notifications + Resend)
❌ Calcular lead score simples (isso é o Lead-Score-Engine no n8n)
```

---

## 4. Claude Agent SDK — Motor Premium Seletivo

### O que é e o que não é

```
O QUE É:
  Biblioteca TypeScript/Python que expõe o loop de agente do Claude
  Ferramentas nativas: file ops, web search, MCP tools, comandos
  Raciocínio multi-step com contexto persistido na sessão
  Suporte a ferramentas externas via MCP

O QUE NÃO É:
  Substituto para OpenClaw (que gerencia agentes e sessões)
  Substituto para n8n (que orquestra fluxos procedurais)
  Substituto para o kernel (que governa execução e billing)
  Uma API de chat — é um runtime de agente completo
```

### Quando usar Claude Agent SDK (e quando não usar)

```
USAR QUANDO:
  ✅ A tarefa exige raciocínio profundo multi-step
     "Alfred, analise estes 3 relatórios e identifique por que o ROAS caiu"
     
  ✅ Web search é necessário para completar a resposta
     "Command, o que está acontecendo no mercado imobiliário hoje?"
     
  ✅ Análise de documentos longos (PDFs, contratos, relatórios)
     "Alfred, revise este contrato de fornecedor e sinalize riscos"
     
  ✅ Execução de tarefas técnicas complexas
     "Nyra, analise os últimos 50 posts e identifique padrões de engajamento"
     
  ✅ Tarefas que exigem MCP tools combinadas
     "Alfred, consulte o Drive, cruze com os dados do CRM e gere o relatório"

NÃO USAR QUANDO:
  ❌ Resposta simples de FAQ ou catálogo → search_knowledge é suficiente
  ❌ CRUD de leads, mensagens, tarefas → workers ou n8n direto
  ❌ Cálculos de lead score → fórmula simples no n8n
  ❌ Envio de notificações → worker-notifications
  ❌ Sincronização de dados → worker-sync
  ❌ Agendamento de posts → Postiz/Blotato via n8n
  ❌ Todo atendimento Brann → gpt-4o direto via OpenClaw é suficiente e 10x mais barato
```

### Custo — Por que seletividade é obrigatória

```
Claude Agent SDK chama o modelo premium com:
  - Contexto maior
  - Loop de raciocínio multi-step
  - Tool calls encadeadas

Custo estimado por execução complexa:
  Análise de relatório (Alfred): ~5.000–15.000 tokens = R$0,30–R$0,90
  Pesquisa com web search (Command): ~8.000–20.000 tokens = R$0,50–R$1,20
  Atendimento Brann simples: ~800–2.000 tokens = R$0,05–R$0,12

Conclusão:
  Usar SDK para atendimento Brann = 10x mais caro sem ganho
  Usar SDK para análise Alfred = custo justificado pelo valor entregue
  
REGRA DE PRICING:
  Execuções com Claude Agent SDK → billing_impact = 'high'
  Cobrar markup maior (custo real × 3 mínimo)
  Separar no token_transactions como source_type = 'agent_sdk'
```

### Integração com OpenClaw

```typescript
// openclaw/agents/alfred/agent-sdk-runner.ts
// OpenClaw chama o SDK apenas quando a tarefa justifica

import Anthropic from '@anthropic-ai/sdk'

export async function runWithAgentSDK(params: {
  task:        string
  context:     string
  tools?:      Anthropic.Tool[]
  tenant_id:   string
  execution_id: string
}): Promise<{ result: string; tokens_used: number }> {

  const client = new Anthropic()

  // O SDK não sabe sobre tenant_id — recebe apenas contexto
  const response = await client.messages.create({
    model:      'claude-opus-4-6',     // modelo premium para raciocínio
    max_tokens: 4096,
    system:     `Você é Alfred, assistente de operações da Ginkgo.
                 Contexto do negócio: ${params.context}
                 Execute a tarefa com precisão e cite fontes quando possível.`,
    messages: [{ role: 'user', content: params.task }],
    tools:    params.tools ?? []
  })

  const tokens_used = response.usage.input_tokens + response.usage.output_tokens
  const result      = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('\n')

  // Retorna para o OpenClaw — que debita tokens via kernel
  return { result, tokens_used }
}

// IMPORTANTE: quem debita os tokens é o OpenClaw via packages/agents/ledger.ts
// O SDK não tem acesso ao billing — essa lógica é do kernel
```

---

## 5. n8n — O sistema nervoso periférico

### O que é responsabilidade do n8n

```
GATILHOS E ENTRADA DE DADOS:
  Webhook Evolution API (mensagens WhatsApp/Instagram)
  Webhook Stripe (payment events)
  Webhook de formulários/landing pages
  Polling de APIs externas (quando não há webhook)

ETL E SINCRONIZAÇÃO:
  Google Drive → Supabase (ingestão de documentos)
  Shopify → Supabase (sync de pedidos e clientes)
  Meta Insights → meta_metrics table
  Google Analytics → analytics_metrics table
  worker-sync jobs (cron a cada 4h)

FLUXOS LINEARES DE ATENDIMENTO:
  WA-Receiver-Base (receber → filtrar → rotear)
  Persistência de mensagens no banco
  Envio de resposta via Evolution API
  Typing delay (1200ms antes de enviar)
  Sanitização de markdown (remove **, ##)

AUTOMAÇÕES SIMPLES:
  Lead-Score-Engine (cálculo por regra fixa)
  Handoff-Chatwoot (criar ticket com campos estruturados)
  RAG-Ingestion-Pipeline (trigger para worker-ingestion)
  Daily-Summary (CRON 08h → metrics → WhatsApp operador)
  Incident-Handler (Error Workflow global do n8n)

NOTIFICAÇÕES E ALERTAS:
  Alerta WhatsApp para lead score >= 70
  Notificação Telegram para Command
  Email transacional (delega para worker-notifications)
  Alerta de saldo baixo de tokens

PÓS-PROCESSAMENTO:
  Salvar URL do post publicado no banco
  Atualizar status de job de vídeo
  Confirmar recebimento de webhook (200 imediato)
  Log de sincronização concluída
```

### O que NÃO é responsabilidade do n8n

```
❌ Raciocinar sobre o que responder → OpenClaw/LLM
❌ Decidir qual tool chamar → OpenClaw/Tool Router
❌ Gerenciar sessão de conversa → OpenClaw/Session Runtime
❌ Acessar token_balances para debitar → kernel
❌ Criar tenants ou memberships → Ginkgo Core API
❌ Processar vídeos com FFmpeg → video-worker Python
❌ Analisar relatórios complexos → Claude Agent SDK via OpenClaw
```

### O nó que conecta n8n ↔ OpenClaw

```javascript
// Nó "Code" no n8n — chamada ao OpenClaw quando caso exige inteligência

const conversationId = $input.first().json.conversation_id
const message        = $input.first().json.message
const tenantId       = $input.first().json.tenant_id

// n8n chama o OpenClaw via HTTP interno
const response = await $http.request({
  method:  'POST',
  url:     'http://openclaw-runtime:8080/v1/execute',
  headers: {
    'Authorization': `Bearer ${$env.OPENCLAW_MASTER_TOKEN}`,
    'Content-Type':  'application/json'
  },
  body: {
    tenant_id:       tenantId,
    agent_type:      'brann',
    session_id:      conversationId,
    user_message:    message,
    channel:         'whatsapp',
    context: { conversation_id: conversationId }
  }
})

// n8n recebe a resposta e continua o fluxo
// (persistência, typing delay, envio via Evolution)
return [{ json: { response: response.body.response,
                  tokens_used: response.body.tokens_used } }]
```

---

## 6. Tabela de Decisão Rápida

| Tarefa | Ginkgo Core | OpenClaw | Claude Agent SDK | n8n |
|--------|-------------|----------|------------------|-----|
| Criar tenant | ✅ | — | — | — |
| Verificar token balance | ✅ | via kernel | — | — |
| Provisionar Evolution | ✅ via worker | — | — | — |
| Receber webhook WA | — | — | — | ✅ |
| Salvar mensagem no banco | — | — | — | ✅ |
| Enviar resposta WA | — | — | — | ✅ |
| Calcular lead score simples | — | — | — | ✅ |
| Sync Meta Insights | — | — | — | ✅ |
| Alerta WhatsApp operador | — | — | — | ✅ |
| Resposta Brann (FAQ) | — | ✅ | — | — |
| Qualificação de lead | — | ✅ | — | — |
| Decisão de handoff | — | ✅ | — | — |
| Geração de post (Nyra) | — | ✅ | — | — |
| Relatório simples (Alfred) | — | ✅ | — | — |
| Análise de relatório complexo | — | ✅ chama→ | ✅ | — |
| Pesquisa com web search | — | ✅ chama→ | ✅ | — |
| Análise de PDF longo | — | ✅ chama→ | ✅ | — |
| Cruzamento multi-fonte | — | ✅ chama→ | ✅ | — |
| Processar vídeo | — | — | — | video-worker |
| Agendar post | — | — | — | ✅ via Postiz |

---

## 7. O que nunca deve acontecer

```
PROIBIDO — violações de fronteira que quebram a arquitetura:

❌ n8n fazendo INSERT direto em contacts sem passar pelo executor
   → Viola KI-2 (ledger não registra) e KI-3 (tool fora do executor)

❌ OpenClaw acessando stripe diretamente para cobrar
   → Billing é responsabilidade exclusiva do Ginkgo Core

❌ Claude Agent SDK sabendo de tenant_id, token_balance ou pricing
   → O SDK recebe contexto preparado, não acessa infraestrutura

❌ n8n criando tenants ou memberships diretamente no banco
   → Provisionamento é responsabilidade exclusiva do Ginkgo Core

❌ Ginkgo Core chamando OpenAI diretamente para responder mensagens
   → O Core não pensa — delega para OpenClaw

❌ OpenClaw executando FFmpeg ou processamento de vídeo
   → CPU intensivo vai para workers dedicados Python

❌ n8n acumulando lógica de negócio complexa (if/else aninhados)
   → Quando um workflow n8n tem > 3 condições de raciocínio,
     a lógica pertence ao OpenClaw, não ao n8n
```

---

## 8. Fronteira Claude Agent SDK — Versão de lançamento

```
P1 (MVP Leaf — agora):
  Claude Agent SDK NÃO entra ainda
  gpt-4o direto via packages/agents/executor é suficiente para Brann
  Custo menor, latência menor, governança mais simples

P2 (Workspace Completo):
  Claude Agent SDK entra para Alfred (análise complexa)
  Casos de uso: relatórios multi-fonte, análise de performance
  Budget separado no billing: source_type = 'agent_sdk'

P3 (Plataforma):
  Claude Agent SDK para Command + Nyra em tarefas premium
  MCP tools configuradas por tenant (skills premium)
  Marketplace: skills que usam SDK cobradas com markup maior

REGRA DE ATIVAÇÃO:
  Claude Agent SDK entra em um agente quando:
    1. Caso de uso específico e justificado documentado
    2. Custo aprovado no billing_impact da skill/feature
    3. Teste em sandbox com métricas reais antes de produção
  
  NÃO entra por padrão, nunca como "IA mais poderosa por padrão".
```

---

## 9. Diagrama Final — Fluxo de uma mensagem WhatsApp

```
1. WhatsApp (Evolution)
   → webhook POST /webhooks/evolution
   
2. n8n: WA-Receiver-Base
   → valida WEBHOOK_SECRET
   → extrai phone, message, pushName
   → responde 200 imediato (não bloqueia)
   → busca/cria conversa no Supabase
   → decide rota: simples ou cognitiva
   
3a. Rota simples (FAQ, saudação, fora de horário):
    n8n responde diretamente
    → sanitiza markdown
    → typing delay 1200ms
    → envia via Evolution API
    → salva mensagem no banco
    
3b. Rota cognitiva (qualificação, dúvidas complexas, fora do script):
    n8n chama OpenClaw/Brann (HTTP interno)
    
4. OpenClaw: Session Runtime
   → carrega histórico da sessão (Redis → Supabase)
   → carrega prompt ativo do banco
   → chama Memory Bridge (RAG se necessário)
   
5. OpenClaw: Tool Router
   → monta prompt completo (system + RAG + histórico + mensagem)
   → chama gpt-4o via API (não via Agent SDK — caso padrão Brann)
   → interpreta tool_calls se houver
   → executa tools via packages/agents/executor
   
   [se caso complexo Alfred/Command]:
   → OpenClaw chama Claude Agent SDK como sub-task
   → SDK executa raciocínio profundo, web search, MCP tools
   → retorna resultado para OpenClaw
   → OpenClaw continua o fluxo com o resultado
   
6. packages/agents/executor
   → valida input (AJV)
   → verifica policy (subscription + balance + agent scope)
   → executa tool (create_lead, search_knowledge, etc.)
   → loga em tool_executions (KI-1, KI-2)
   → debita tokens via debit_tokens_atomic (KI-4)
   
7. OpenClaw retorna resposta para n8n
   
8. n8n: pós-processamento
   → sanitiza markdown
   → typing delay 1200ms
   → envia resposta via Evolution API
   → salva mensagem no banco
   → dispara Lead-Score-Engine
   → verifica threshold de handoff
   → envia alertas se necessário
```

---

*Ginkgo AI Systems — OPENCLAW-CLAUDE-N8N-BOUNDARIES.md v1.0.0 — Março 2026*  
*Confusão de fronteiras = bugs invisíveis + custo explosivo + sistema não auditável.*  
*Quatro camadas. Responsabilidades únicas. Sem sobreposição.*
