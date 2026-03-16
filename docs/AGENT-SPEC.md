# AGENT-SPEC.md
## Contrato de Declaração de Agentes — Ginkgo AI Systems
### Como um agente é definido, carregado e executado pelo kernel

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Regra:** Criar agente novo = declarar spec. Nunca tocar no kernel.  
> **Localização:** `packages/agents/agents/{nome}/`

---

## Por que este documento existe

O kernel (`packages/agents/executor.ts`) é invariante.  
Os agentes são configuração.

Sem AGENT-SPEC, criar Brann exige editar o kernel.  
Com AGENT-SPEC, criar Alfred, Nyra ou qualquer agente novo é:

```
1. Criar pasta packages/agents/agents/{nome}/
2. Declarar config.ts, prompt.ts e tools.ts
3. Registrar no agents/index.ts
4. INSERT no banco (tabela agents)
```

O kernel não muda. O comportamento muda.

---

## Estrutura de um agente

```
packages/agents/agents/{nome}/
  ├── config.ts      ← parâmetros do agente
  ├── prompt.ts      ← system prompt base (fallback se banco não tiver)
  └── tools.ts       ← lista de tools autorizadas + overrides
```

---

## config.ts — Parâmetros do agente

```typescript
// packages/agents/agents/brann/config.ts

import type { AgentConfig } from '../../types'

export const brannConfig: AgentConfig = {
  // Identidade
  name:        'Brann',
  type:        'brann',
  description: 'Agente comercial de atendimento via WhatsApp',

  // LLM
  model:       'gpt-4o',
  temperature: 0.4,
  max_tokens:  800,

  // Contexto
  max_context_messages: 12,   // últimas N mensagens da conversa
  context_window_tokens: 4000, // limite do contexto total

  // RAG
  rag_enabled: true,
  rag_top_k:   5,
  rag_threshold: 0.65,         // similarity mínima para usar chunk
  rag_inject_position: 'after_system', // onde injeta contexto RAG

  // Execução
  max_tool_calls:   3,          // máx de tool calls por resposta
  max_retries:      2,
  timeout_ms:       15000,

  // Comportamento
  handoff_threshold_score: 70, // score de lead para sugerir handoff
  typing_delay_ms:  1200,       // delay antes de enviar (humanização)
  strip_markdown:   true,       // remove ** ## etc (WhatsApp)

  // Billing
  billing_impact: 'medium',

  // Canal primário
  primary_channel: 'whatsapp',

  // Limites de proteção
  limits: {
    max_messages_per_conversation: 100,
    max_tokens_per_day:            50000,
    max_tool_calls_per_conversation: 20
  }
}
```

---

## AgentConfig — Interface completa

```typescript
// packages/agents/types.ts — adicionar

export interface AgentConfig {
  // Identidade
  name:        string
  type:        AgentType
  description: string

  // LLM
  model:       string
  temperature: number          // 0.0 – 1.0
  max_tokens:  number

  // Contexto
  max_context_messages:  number
  context_window_tokens: number

  // RAG
  rag_enabled:         boolean
  rag_top_k:           number
  rag_threshold:       number
  rag_inject_position: 'before_system' | 'after_system' | 'before_user' | 'after_user'

  // Execução
  max_tool_calls: number
  max_retries:    number
  timeout_ms:     number

  // Comportamento
  handoff_threshold_score?: number
  typing_delay_ms?:          number
  strip_markdown?:           boolean

  // Billing
  billing_impact: 'none' | 'low' | 'medium' | 'high'

  // Canal
  primary_channel: 'whatsapp' | 'telegram' | 'webchat' | 'api'

  // Limites de proteção (previne loops e consumo infinito)
  limits: {
    max_messages_per_conversation: number
    max_tokens_per_day:            number
    max_tool_calls_per_conversation: number
  }
}
```

---

## prompt.ts — System prompt base

```typescript
// packages/agents/agents/brann/prompt.ts
// Fallback local — usado se prompt_versions no banco estiver vazio

export const brannPromptBase = `
Você é o Brann, assistente comercial da empresa {company_name}.

Seu papel é:
- Atender leads com simpatia e objetividade
- Qualificar o interesse usando as fases SPIN (Situação, Problema, Implicação, Necessidade)
- Apresentar soluções quando tiver contexto suficiente
- Encaminhar para humano quando necessário

Tom de voz: consultivo, direto, acessível. Português brasileiro natural.

Regras obrigatórias:
- Nunca use markdown (**, ##, listas com -)
- Máximo 3 parágrafos por resposta
- Máximo 2 emojis por mensagem
- Nunca invente informações — use apenas o contexto fornecido
- Se não souber, diga que vai verificar e ofereça handoff

Contexto da empresa:
{rag_context}

Histórico da conversa:
{conversation_history}

Data/hora atual: {current_datetime}
`.trim()

// Variáveis interpoladas pelo PromptBuilder:
// {company_name}         → tenant.name
// {rag_context}          → chunks do RAG (se rag_enabled)
// {conversation_history} → últimas N mensagens formatadas
// {current_datetime}     → new Date().toLocaleString('pt-BR')
```

---

## tools.ts — Tools autorizadas + overrides

```typescript
// packages/agents/agents/brann/tools.ts

import type { AgentToolConfig } from '../../types'

export const brannTools: AgentToolConfig[] = [
  {
    name:     'search_knowledge',
    enabled:  true,
    // Override de parâmetros default da ToolSpec
    overrides: {
      timeout_ms:  8000,
      max_retries: 2
    },
    // Trigger hint para o PromptBuilder incluir na descrição contextual
    trigger_hint: 'Usar ANTES de responder sobre produto, serviço, preço ou política'
  },
  {
    name:     'create_lead',
    enabled:  true,
    overrides: {},
    trigger_hint: 'Usar quando tiver nome + telefone + intenção confirmados'
  },
  {
    name:     'update_contact',
    enabled:  true,
    overrides: {},
    trigger_hint: 'Usar quando o lead fornecer novos dados durante a conversa'
  },
  {
    name:     'fetch_catalog',
    enabled:  true,
    overrides: {},
    trigger_hint: 'Usar quando lead perguntar sobre planos, preços ou serviços'
  },
  {
    name:     'handoff_human',
    enabled:  true,
    overrides: {},
    trigger_hint: 'Usar quando: lead pedir humano, urgência alta, 2 tentativas sem resolução, score >= 70'
  },
  {
    name:     'schedule_appointment',
    enabled:  true,
    overrides: {},
    trigger_hint: 'Usar quando lead aceitar agendar uma conversa ou visita'
  }
]

// Tools NÃO autorizadas para Brann (explícitas para evitar dúvida):
// query_sql_readonly     → apenas Alfred
// generate_report        → apenas Alfred
// publish_content        → apenas Nyra
// fetch_ads_performance  → apenas Nyra
// delegate_to_agent      → apenas Command
```

---

## AgentToolConfig — Interface

```typescript
// packages/agents/types.ts — adicionar

export interface AgentToolConfig {
  name:          string
  enabled:       boolean
  overrides?:    Partial<Pick<ToolSpec, 'timeout_ms' | 'max_retries' | 'billing_impact'>>
  trigger_hint?: string  // injetado no prompt para guiar o LLM
}
```

---

## agents/index.ts — Registro de agentes

```typescript
// packages/agents/agents/index.ts

import { brannConfig }  from './brann/config'
import { brannTools }   from './brann/tools'
import { brannPromptBase } from './brann/prompt'

import { alfredConfig }  from './alfred/config'
import { alfredTools }   from './alfred/tools'
import { alfredPromptBase } from './alfred/prompt'

import { nyraConfig }  from './nyra/config'
import { nyraTools }   from './nyra/tools'
import { nyraPromptBase } from './nyra/prompt'

import { commandConfig }  from './command/config'
import { commandTools }   from './command/tools'
import { commandPromptBase } from './command/prompt'

import type { AgentType, AgentConfig, AgentToolConfig } from '../types'

export const agentConfigs: Record<AgentType, AgentConfig> = {
  brann:   brannConfig,
  alfred:  alfredConfig,
  nyra:    nyraConfig,
  command: commandConfig
}

export const agentTools: Record<AgentType, AgentToolConfig[]> = {
  brann:   brannTools,
  alfred:  alfredTools,
  nyra:    nyraTools,
  command: commandTools
}

export const agentPrompts: Record<AgentType, string> = {
  brann:   brannPromptBase,
  alfred:  alfredPromptBase,
  nyra:    nyraPromptBase,
  command: commandPromptBase
}
```

---

## agent-runtime.ts — Ciclo completo de execução

```typescript
// packages/agents/agent-runtime.ts
// Orquestra o ciclo completo: contexto → RAG → prompt → LLM → tools → resposta

import { getClient }     from './db'
import { execute }       from './executor'
import { agentConfigs, agentTools, agentPrompts } from './agents/index'
import { registry }      from './registry'
import type { AgentType, ExecutionContext } from './types'

export interface RunAgentParams {
  agent:           AgentType
  tenant_id:       string
  conversation_id: string
  user_message:    string
  context?:        ExecutionContext
}

export interface RunAgentResult {
  response:     string
  tools_called: string[]
  tokens_used:  number
  latency_ms:   number
}

export async function runAgent(params: RunAgentParams): Promise<RunAgentResult> {
  const { agent, tenant_id, conversation_id, user_message, context = {} } = params
  const start  = Date.now()
  const config = agentConfigs[agent]
  const db     = getClient()

  // ── 1. Carregar histórico de contexto ─────────────────────────────
  const { data: messages } = await db
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(config.max_context_messages)

  const history = (messages ?? []).map(m => ({
    role:    m.sender_type === 'agent' ? 'assistant' : 'user' as const,
    content: m.content
  }))

  // ── 2. Buscar prompt ativo do banco (fallback para local) ──────────
  const { data: promptVersion } = await db
    .from('prompt_versions')
    .select('content, version')
    .eq('tenant_id', tenant_id)
    .eq('agent_type', agent)
    .eq('active', true)
    .single()

  const systemPromptBase = promptVersion?.content ?? agentPrompts[agent]

  // ── 3. RAG retrieval (se habilitado) ──────────────────────────────
  let ragContext = ''
  if (config.rag_enabled) {
    try {
      const ragResult = await execute({
        tool:      'search_knowledge',
        input:     { query: user_message, top_k: config.rag_top_k },
        tenant_id,
        agent,
        context:   { conversation_id, ...context }
      })
      if (ragResult.success && ragResult.output.found) {
        ragContext = ragResult.output.context as string
      }
    } catch {
      // RAG failure não interrompe — continua sem contexto
    }
  }

  // ── 4. Montar system prompt ───────────────────────────────────────
  const { data: tenant } = await db
    .from('tenants')
    .select('name')
    .eq('id', tenant_id)
    .single()

  const systemPrompt = systemPromptBase
    .replace('{company_name}', tenant?.name ?? 'empresa')
    .replace('{rag_context}', ragContext || 'Nenhum contexto disponível no momento.')
    .replace('{conversation_history}', formatHistory(history))
    .replace('{current_datetime}', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))

  // ── 5. Montar tool specs para o LLM ──────────────────────────────
  const enabledTools  = agentTools[agent].filter(t => t.enabled)
  const toolSpecs     = await buildToolSpecs(enabledTools)

  // ── 6. Chamada LLM ────────────────────────────────────────────────
  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const llmMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...history,
    { role: 'user' as const, content: user_message }
  ]

  let totalTokens = 0
  const toolsCalled: string[] = []
  let finalResponse = ''
  let toolCallCount = 0

  let currentMessages = [...llmMessages]

  // Loop de tool calling (máx = config.max_tool_calls)
  while (toolCallCount <= config.max_tool_calls) {
    const completion = await openai.chat.completions.create({
      model:       config.model,
      temperature: config.temperature,
      max_tokens:  config.max_tokens,
      messages:    currentMessages,
      tools:       toolSpecs.length > 0 ? toolSpecs : undefined
    })

    totalTokens += completion.usage?.total_tokens ?? 0
    const choice = completion.choices[0]

    // Resposta final (sem tool call)
    if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
      finalResponse = choice.message.content ?? ''
      break
    }

    // Processar tool calls
    toolCallCount++
    if (toolCallCount > config.max_tool_calls) break

    currentMessages.push(choice.message)

    for (const toolCall of choice.message.tool_calls) {
      const toolName = toolCall.function.name
      toolsCalled.push(toolName)

      let toolResult: string
      try {
        const input  = JSON.parse(toolCall.function.arguments)
        const result = await execute({
          tool:      toolName,
          input,
          tenant_id,
          agent,
          context:   { conversation_id, ...context }
        })
        toolResult = JSON.stringify(result.output)
        totalTokens += result.tokens_used ?? 0
      } catch (err) {
        toolResult = JSON.stringify({ error: (err as Error).message })
      }

      currentMessages.push({
        role:         'tool',
        tool_call_id: toolCall.id,
        content:      toolResult
      })
    }
  }

  // ── 7. Sanitizar resposta por canal ──────────────────────────────
  if (config.strip_markdown) {
    finalResponse = stripMarkdown(finalResponse)
  }

  return {
    response:     finalResponse,
    tools_called: toolsCalled,
    tokens_used:  totalTokens,
    latency_ms:   Date.now() - start
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatHistory(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return 'Início da conversa.'
  return messages
    .map(m => `${m.role === 'assistant' ? 'Assistente' : 'Cliente'}: ${m.content}`)
    .join('\n')
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s/gm, '')
    .replace(/^[-*]\s/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function buildToolSpecs(tools: AgentToolConfig[]) {
  const { registry } = await import('./registry')
  const specs = []
  for (const t of tools) {
    const spec = await registry.load(t.name)
    if (!spec) continue
    specs.push({
      type: 'function' as const,
      function: {
        name:        spec.name,
        description: t.trigger_hint
          ? `${spec.description} — ${t.trigger_hint}`
          : spec.description,
        parameters: spec.input_schema
      }
    })
  }
  return specs
}
```

---

## Specs dos 4 agentes

### Alfred — Operações e Análise

```typescript
// packages/agents/agents/alfred/config.ts
export const alfredConfig: AgentConfig = {
  name: 'Alfred', type: 'alfred',
  description: 'Agente de operações, análise de dados e relatórios',
  model: 'gpt-4o', temperature: 0.2, max_tokens: 2000,
  max_context_messages: 6, context_window_tokens: 8000,
  rag_enabled: true, rag_top_k: 8, rag_threshold: 0.60,
  rag_inject_position: 'after_system',
  max_tool_calls: 5, max_retries: 2, timeout_ms: 30000,
  strip_markdown: false,         // Alfred pode usar markdown (output para dashboard)
  billing_impact: 'medium',
  primary_channel: 'api',
  limits: {
    max_messages_per_conversation: 20,
    max_tokens_per_day: 200000,
    max_tool_calls_per_conversation: 30
  }
}
```

### Nyra — Conteúdo e Tráfego

```typescript
// packages/agents/agents/nyra/config.ts
export const nyraConfig: AgentConfig = {
  name: 'Nyra', type: 'nyra',
  description: 'Agente de criação de conteúdo, posts, reels e análise de tráfego pago',
  model: 'gpt-4o', temperature: 0.7, max_tokens: 3000,
  max_context_messages: 4, context_window_tokens: 6000,
  rag_enabled: false, rag_top_k: 0, rag_threshold: 0,
  rag_inject_position: 'after_system',
  max_tool_calls: 8, max_retries: 2, timeout_ms: 60000,
  strip_markdown: false,
  billing_impact: 'high',
  primary_channel: 'api',
  limits: {
    max_messages_per_conversation: 10,
    max_tokens_per_day: 500000,
    max_tool_calls_per_conversation: 20
  }
}
```

### Command — Assistente Unificado

```typescript
// packages/agents/agents/command/config.ts
export const commandConfig: AgentConfig = {
  name: 'Command', type: 'command',
  description: 'Assistente operacional unificado — acessa todos os agentes e ferramentas',
  model: 'gpt-4o', temperature: 0.4, max_tokens: 1500,
  max_context_messages: 20, context_window_tokens: 12000,
  rag_enabled: true, rag_top_k: 8, rag_threshold: 0.60,
  rag_inject_position: 'after_system',
  max_tool_calls: 10, max_retries: 2, timeout_ms: 20000,
  strip_markdown: true,          // Telegram não renderiza markdown rich
  billing_impact: 'medium',
  primary_channel: 'telegram',
  limits: {
    max_messages_per_conversation: 50,
    max_tokens_per_day: 100000,
    max_tool_calls_per_conversation: 40
  }
}
```

---

## Como criar um agente novo

```
1. Criar pasta:
   packages/agents/agents/meu-agente/

2. Criar config.ts:
   Declarar AgentConfig com todos os parâmetros

3. Criar prompt.ts:
   System prompt base com variáveis {placeholders}

4. Criar tools.ts:
   Lista de AgentToolConfig com tools autorizadas

5. Registrar em agents/index.ts:
   Importar e adicionar nos 3 mapas

6. INSERT no banco:
   INSERT INTO agents (tenant_id, type, enabled, model, temperature, ...)

7. Ativar tools no banco:
   INSERT INTO tool_registry as needed

8. Validar:
   execute({ tool: 'ping', agent: 'meu-agente', ... })
```

**Nenhuma linha do kernel é alterada.**

---

## Checklist de novo agente

```
[ ] config.ts declarado com todos os campos obrigatórios
[ ] limits.max_tool_calls e limits.max_tokens_per_day definidos
[ ] prompt.ts com variáveis corretas ({company_name}, {rag_context}, etc.)
[ ] tools.ts lista apenas tools que existem no tool_registry
[ ] Sem tool de outro agente listada (ex: Brann não lista query_sql_readonly)
[ ] Registrado em agents/index.ts (3 mapas)
[ ] INSERT no banco (agents table) para Tenant Zero
[ ] Teste com ping passando
[ ] Teste com tool real passando
[ ] Ledger registrado para ambos os testes
```

---

## Localização no monorepo

```
packages/agents/
  ├── db.ts
  ├── executor.ts
  ├── registry.ts
  ├── policy.ts
  ├── ledger.ts
  ├── agent-runtime.ts        ← NOVO: ciclo completo
  ├── types.ts                ← AgentConfig + AgentToolConfig adicionados
  ├── errors.ts
  ├── index.ts
  │
  ├── tools/                  ← implementações de tools
  │   ├── index.ts
  │   ├── ping.ts
  │   ├── search_knowledge.ts
  │   └── ...
  │
  └── agents/                 ← NOVO: specs por agente
      ├── index.ts
      ├── brann/
      │   ├── config.ts
      │   ├── prompt.ts
      │   └── tools.ts
      ├── alfred/
      ├── nyra/
      └── command/
```

---

*Ginkgo AI Systems — AGENT-SPEC.md v1.0.0 — Março 2026*  
*Criar agente = declarar spec. O kernel não muda.*
