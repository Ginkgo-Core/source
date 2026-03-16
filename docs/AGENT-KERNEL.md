# AGENT-KERNEL.md
## Esqueleto Técnico Completo — `packages/agents`
### O kernel que governa toda execução de agentes na Ginkgo

> **Localização:** `packages/agents/`  
> **Exportado como:** `@ginkgo/agents`  
> **Regra absoluta:** Nenhuma tool é executada fora do executor. Nenhum agente acessa o banco diretamente.

---

## Estrutura de arquivos

```
packages/agents/
  ├── package.json
  ├── tsconfig.json
  ├── index.ts                  ← exports públicos
  │
  ├── executor.ts               ← único ponto de execução de tools
  ├── registry.ts               ← carrega specs do tool_registry (banco)
  ├── policy.ts                 ← valida plano + tokens + permissão
  ├── ledger.ts                 ← logs, incidents, metering
  │
  ├── tools/
  │   ├── index.ts              ← mapa name → função
  │   ├── search_knowledge.ts
  │   ├── create_lead.ts
  │   ├── update_contact.ts
  │   ├── fetch_catalog.ts
  │   ├── handoff_human.ts
  │   └── schedule_appointment.ts
  │
  ├── types.ts                  ← interfaces compartilhadas
  └── errors.ts                 ← erros tipados do kernel
```

---

## package.json

```json
{
  "name": "@ginkgo/agents",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "ajv": "^8",
    "ajv-formats": "^3"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

---

## types.ts

```typescript
// Todos os tipos do kernel em um lugar

export interface ExecuteParams {
  tool:      string
  input:     Record<string, unknown>
  tenant_id: string
  agent:     AgentType
  context?:  ExecutionContext
}

export interface ExecutionContext {
  conversation_id?:  string
  message_id?:       string
  prompt_version?:   string
  session_id?:       string
}

export interface ToolResult {
  success:      boolean
  output:       Record<string, unknown>
  tokens_used?: number
  metadata?:    Record<string, unknown>
}

export interface ToolSpec {
  name:           string
  description:    string
  agents_allowed: AgentType[]
  input_schema:   Record<string, unknown>  // JSON Schema
  output_schema:  Record<string, unknown>
  read_only:      boolean
  requires_approval: boolean
  billing_impact: 'none' | 'low' | 'medium' | 'high'
  timeout_ms:     number
  max_retries:    number
  enabled:        boolean
}

export interface LedgerEntry {
  tenant_id:       string
  agent_type:      AgentType
  tool_name:       string
  conversation_id?: string
  input_json:      Record<string, unknown>
  output_json:     Record<string, unknown>
  success:         boolean
  latency_ms:      number
  tokens_used:     number
  error_message?:  string
}

export interface PolicyContext {
  tenant_id: string
  tool:      string
  spec:      ToolSpec
  agent:     AgentType
}

export type AgentType = 'brann' | 'alfred' | 'nyra' | 'command'

export type ToolFunction = (
  input:     Record<string, unknown>,
  ctx:       ToolContext
) => Promise<ToolResult>

export interface ToolContext {
  tenant_id: string
  context:   ExecutionContext
  supabase:  ReturnType<typeof import('@supabase/supabase-js').createClient>
}
```

---

## errors.ts

```typescript
// Erros tipados — o caller sabe exatamente o que falhou

export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool '${toolName}' não encontrada no registry`)
    this.name = 'ToolNotFoundError'
  }
}

export class ToolValidationError extends Error {
  public errors: unknown[]
  constructor(errors: unknown[]) {
    super('Input inválido para a tool')
    this.name = 'ToolValidationError'
    this.errors = errors
  }
}

export class ToolPolicyError extends Error {
  public reason: 'plan_limit' | 'token_exhausted' | 'role_denied' | 'tool_disabled'
  constructor(reason: ToolPolicyError['reason'], message: string) {
    super(message)
    this.name = 'ToolPolicyError'
    this.reason = reason
  }
}

export class ToolExecutionError extends Error {
  public tool:      string
  public attempt:   number
  constructor(tool: string, attempt: number, cause: Error) {
    super(`Falha ao executar '${tool}' (tentativa ${attempt}): ${cause.message}`)
    this.name = 'ToolExecutionError'
    this.tool = tool
    this.attempt = attempt
    this.cause = cause
  }
}

export class ToolTimeoutError extends Error {
  constructor(tool: string, timeout_ms: number) {
    super(`Tool '${tool}' excedeu timeout de ${timeout_ms}ms`)
    this.name = 'ToolTimeoutError'
  }
}
```

---

## registry.ts

```typescript
import { createClient } from '@supabase/supabase-js'
import type { ToolSpec } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cache em memória — TTL 5 min
const cache = new Map<string, { spec: ToolSpec; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

export const registry = {

  async load(toolName: string): Promise<ToolSpec | null> {
    const now = Date.now()
    const cached = cache.get(toolName)

    if (cached && cached.expires > now) {
      return cached.spec
    }

    const { data, error } = await supabase
      .from('tool_registry')
      .select('*')
      .eq('name', toolName)
      .eq('enabled', true)
      .single()

    if (error || !data) return null

    const spec = data as ToolSpec
    cache.set(toolName, { spec, expires: now + CACHE_TTL })
    return spec
  },

  async loadAll(): Promise<ToolSpec[]> {
    const { data } = await supabase
      .from('tool_registry')
      .select('*')
      .eq('enabled', true)

    return (data ?? []) as ToolSpec[]
  },

  // Invalida cache (ex: após update no banco)
  invalidate(toolName?: string) {
    if (toolName) cache.delete(toolName)
    else cache.clear()
  }
}
```

---

## policy.ts

```typescript
import { createClient } from '@supabase/supabase-js'
import {
  ToolPolicyError,
  type PolicyContext
} from './errors'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const policy = {

  async check(ctx: PolicyContext): Promise<void> {
    const { tenant_id, tool, spec, agent } = ctx

    // 1. Tool habilitada para este agente?
    if (!spec.agents_allowed.includes(agent)) {
      throw new ToolPolicyError(
        'role_denied',
        `Agente '${agent}' não tem permissão para usar '${tool}'`
      )
    }

    // 2. Subscription ativa?
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, plan')
      .eq('tenant_id', tenant_id)
      .single()

    if (!sub || !['active', 'trialing'].includes(sub.status)) {
      throw new ToolPolicyError(
        'plan_limit',
        'Assinatura inativa ou expirada'
      )
    }

    // 3. Token balance > 0? (skip para tools read_only de baixo impacto)
    if (spec.billing_impact !== 'none') {
      const { data: balance } = await supabase
        .from('token_balances')
        .select('balance')
        .eq('tenant_id', tenant_id)
        .single()

      if (!balance || balance.balance <= 0) {
        throw new ToolPolicyError(
          'token_exhausted',
          'Saldo de tokens insuficiente'
        )
      }
    }

    // 4. Skill necessária está ativa no tenant?
    // (Para tools de skills pagas — verificar tenant_skills)
    // Extensível conforme skills são adicionadas
  }
}
```

---

## ledger.ts

```typescript
import { createClient } from '@supabase/supabase-js'
import type { LedgerEntry } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const ledger = {

  async write(entry: LedgerEntry): Promise<void> {
    await supabase.from('tool_executions').insert({
      tenant_id:       entry.tenant_id,
      agent_type:      entry.agent_type,
      tool_name:       entry.tool_name,
      conversation_id: entry.conversation_id,
      input_json:      entry.input_json,
      output_json:     entry.output_json,
      success:         entry.success,
      latency_ms:      entry.latency_ms,
      tokens_used:     entry.tokens_used,
      error_message:   entry.error_message
    })
  },

  async incident(
    tenant_id: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    tool?: string
  ): Promise<void> {
    await supabase.from('incidents').insert({
      tenant_id,
      severity,
      category:    'tool_failure',
      description,
      workflow:    tool ?? 'unknown'
    })
  },

  async debit(
    tenant_id:  string,
    tokens:     number,
    tool_name:  string
  ): Promise<void> {
    // Debitar saldo
    await supabase.rpc('debit_tokens', {
      p_tenant_id: tenant_id,
      p_amount:    tokens
    })

    // Registrar transação
    await supabase.from('token_transactions').insert({
      tenant_id,
      type:        'consumption',
      amount:      -tokens,
      source_type: 'tool',
      source_id:   tool_name
    })

    // Registrar evento de uso
    await supabase.from('usage_events').insert({
      tenant_id,
      event_type: 'token',
      quantity:   tokens,
      unit:       'token'
    })
  }
}

// SQL function necessária no Supabase (adicionar à migration 006):
/*
CREATE OR REPLACE FUNCTION debit_tokens(p_tenant_id UUID, p_amount BIGINT)
RETURNS void AS $$
  UPDATE token_balances
  SET balance     = balance - p_amount,
      used_period = used_period + p_amount,
      updated_at  = now()
  WHERE tenant_id = p_tenant_id;
$$ LANGUAGE sql;
*/
```

---

## executor.ts

```typescript
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { createClient } from '@supabase/supabase-js'
import { registry }    from './registry'
import { policy }      from './policy'
import { ledger }      from './ledger'
import { toolMap }     from './tools/index'
import {
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionError,
  ToolTimeoutError
} from './errors'
import type { ExecuteParams, ToolResult } from './types'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function execute(params: ExecuteParams): Promise<ToolResult> {
  const { tool, input, tenant_id, agent, context = {} } = params
  const start = Date.now()

  // ── 1. Carregar spec ──────────────────────────────────────────────
  const spec = await registry.load(tool)
  if (!spec) {
    throw new ToolNotFoundError(tool)
  }

  // ── 2. Validar input ──────────────────────────────────────────────
  const validate = ajv.compile(spec.input_schema)
  const valid    = validate(input)
  if (!valid) {
    await ledger.write({
      tenant_id, agent_type: agent, tool_name: tool,
      conversation_id: context.conversation_id,
      input_json: input, output_json: {},
      success: false, latency_ms: Date.now() - start,
      tokens_used: 0,
      error_message: JSON.stringify(validate.errors)
    })
    throw new ToolValidationError(validate.errors ?? [])
  }

  // ── 3. Policy check ───────────────────────────────────────────────
  await policy.check({ tenant_id, tool, spec, agent })
  // lança ToolPolicyError se plano/token/role inválido

  // ── 4. Executar com timeout e retries ─────────────────────────────
  const toolFn = toolMap[tool]
  if (!toolFn) throw new ToolNotFoundError(tool)

  let lastError: Error | null = null
  let output: ToolResult | null = null

  for (let attempt = 1; attempt <= spec.max_retries; attempt++) {
    try {
      output = await Promise.race([
        toolFn(input, { tenant_id, context, supabase }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new ToolTimeoutError(tool, spec.timeout_ms)),
            spec.timeout_ms
          )
        )
      ])
      break // sucesso — sair do loop
    } catch (err) {
      lastError = err as Error
      if (attempt < spec.max_retries) {
        // Backoff: 1s, 3s, 9s
        await sleep(Math.pow(3, attempt - 1) * 1000)
      }
    }
  }

  // ── 5. Tratar falha após todas as tentativas ──────────────────────
  if (!output) {
    const latency = Date.now() - start
    await ledger.write({
      tenant_id, agent_type: agent, tool_name: tool,
      conversation_id: context.conversation_id,
      input_json: input, output_json: {},
      success: false, latency_ms: latency,
      tokens_used: 0,
      error_message: lastError?.message
    })
    await ledger.incident(
      tenant_id,
      latency > 10000 ? 'high' : 'medium',
      `Tool '${tool}' falhou após ${spec.max_retries} tentativas: ${lastError?.message}`,
      tool
    )
    throw new ToolExecutionError(tool, spec.max_retries, lastError!)
  }

  // ── 6. Logar execução bem-sucedida ────────────────────────────────
  const latency = Date.now() - start
  await ledger.write({
    tenant_id, agent_type: agent, tool_name: tool,
    conversation_id: context.conversation_id,
    input_json:  input,
    output_json: output.output,
    success:     true,
    latency_ms:  latency,
    tokens_used: output.tokens_used ?? 0
  })

  // ── 7. Debitar tokens ─────────────────────────────────────────────
  if (output.tokens_used && output.tokens_used > 0) {
    await ledger.debit(tenant_id, output.tokens_used, tool)
  }

  return output
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
```

---

## tools/index.ts

```typescript
import type { ToolFunction } from '../types'
import { searchKnowledge }      from './search_knowledge'
import { createLead }           from './create_lead'
import { updateContact }        from './update_contact'
import { fetchCatalog }         from './fetch_catalog'
import { handoffHuman }         from './handoff_human'
import { scheduleAppointment }  from './schedule_appointment'

// Mapa canônico: name (como está no tool_registry) → função
export const toolMap: Record<string, ToolFunction> = {
  search_knowledge:     searchKnowledge,
  create_lead:          createLead,
  update_contact:       updateContact,
  fetch_catalog:        fetchCatalog,
  handoff_human:        handoffHuman,
  schedule_appointment: scheduleAppointment,
}
```

---

## tools/search_knowledge.ts

```typescript
import type { ToolFunction } from '../types'
import { openai }           from '../lib/openai'

export const searchKnowledge: ToolFunction = async (input, ctx) => {
  const { query, top_k = 5 } = input as { query: string; top_k?: number }
  const { tenant_id, supabase } = ctx

  // 1. Gerar embedding da query
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  })
  const vector = embedding.data[0].embedding

  // 2. Busca vetorial (pgvector cosine)
  const { data: vectorResults } = await supabase.rpc('match_chunks', {
    p_tenant_id:  tenant_id,
    p_embedding:  vector,
    p_top_k:      top_k * 2,  // busca mais, depois filtra
    p_threshold:  0.65
  })

  // 3. Busca lexical (full-text)
  const { data: lexicalResults } = await supabase
    .from('knowledge_chunks')
    .select('id, chunk_text, metadata_json')
    .eq('tenant_id', tenant_id)
    .textSearch('chunk_text', query.split(' ').join(' & '), {
      type:   'plain',
      config: 'portuguese'
    })
    .limit(top_k * 2)

  // 4. Merge e dedup
  const seen = new Set<string>()
  const merged = [
    ...(vectorResults ?? []).map((r: any) => ({ ...r, source: 'vector' })),
    ...(lexicalResults ?? []).map((r: any) => ({ ...r, score: 0.6, source: 'lexical' }))
  ].filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  // 5. Top-k final
  const topChunks = merged
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, top_k)

  if (topChunks.length === 0) {
    return { success: true, output: { found: false, context: '', sources: [] } }
  }

  // 6. Formatar contexto para injeção no prompt
  const context = topChunks
    .map(c => `[${c.metadata_json?.title ?? 'Conhecimento'}]\n${c.chunk_text}`)
    .join('\n\n---\n\n')

  // 7. Logar em retrieval_logs
  await supabase.from('retrieval_logs').insert({
    tenant_id,
    agent:          ctx.context?.session_id ? 'brann' : 'unknown',
    query_text:     query,
    top_chunks:     topChunks.map(c => ({
      chunk_id:     c.id,
      score:        c.score,
      text_preview: c.chunk_text.slice(0, 100)
    })),
    score_avg:      topChunks.reduce((s, c) => s + (c.score ?? 0), 0) / topChunks.length,
    chunks_returned: topChunks.length
  })

  return {
    success:     true,
    output:      { found: true, context, sources: topChunks.map(c => c.metadata_json?.title) },
    tokens_used: Math.ceil(context.length / 4)  // estimativa
  }
}

// SQL function necessária (migration 003):
/*
CREATE OR REPLACE FUNCTION match_chunks(
  p_tenant_id UUID,
  p_embedding vector(1536),
  p_top_k     INT DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id            UUID,
  chunk_text    TEXT,
  metadata_json JSONB,
  score         FLOAT
) AS $$
  SELECT
    id, chunk_text, metadata_json,
    1 - (embedding <=> p_embedding) AS score
  FROM knowledge_chunks
  WHERE tenant_id = p_tenant_id
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_top_k;
$$ LANGUAGE sql;
*/
```

---

## tools/create_lead.ts

```typescript
import type { ToolFunction } from '../types'

export const createLead: ToolFunction = async (input, ctx) => {
  const { name, phone, intent, source = 'whatsapp' } = input as {
    name: string; phone: string; intent: string; source?: string
  }
  const { tenant_id, supabase } = ctx

  // UPSERT contact
  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert({
      tenant_id,
      phone:        phone.replace(/\D/g, ''),
      name,
      tags:         ['lead'],
      metadata_json: { intent, source, last_intent_at: new Date().toISOString() }
    }, {
      onConflict:    'tenant_id,phone',
      ignoreDuplicates: false
    })
    .select('id')
    .single()

  if (error || !contact) {
    return {
      success: false,
      output:  { error: error?.message ?? 'Falha ao criar lead' }
    }
  }

  // UPSERT lead_score inicial
  await supabase.from('lead_scores').upsert({
    tenant_id,
    contact_id:  contact.id,
    score:       20,  // ponto base por qualificação mínima
    tier:        'cold',
    reason_json: { initial: true, intent, source }
  }, {
    onConflict: 'tenant_id,contact_id',
    ignoreDuplicates: true  // não sobrescrever score já calculado
  })

  return {
    success: true,
    output:  { contact_id: contact.id, status: 'created' }
  }
}
```

---

## tools/fetch_catalog.ts

```typescript
import type { ToolFunction } from '../types'

export const fetchCatalog: ToolFunction = async (input, ctx) => {
  const { query } = input as { query: string }
  const { tenant_id, supabase } = ctx

  // Buscar chunks com tag 'catalog'
  const { data: chunks } = await supabase
    .from('knowledge_chunks')
    .select('chunk_text, metadata_json')
    .eq('tenant_id', tenant_id)
    .contains('metadata_json', { tags: ['catalog'] })
    .limit(5)

  if (!chunks || chunks.length === 0) {
    // Fallback: buscar sem tag se não houver catálogo indexado
    const { data: fallback } = await supabase
      .from('knowledge_chunks')
      .select('chunk_text')
      .eq('tenant_id', tenant_id)
      .textSearch('chunk_text', 'plano valor preço serviço', {
        type: 'plain', config: 'portuguese'
      })
      .limit(3)

    return {
      success: true,
      output:  {
        items: fallback?.map(c => c.chunk_text) ?? [],
        found: (fallback?.length ?? 0) > 0
      }
    }
  }

  return {
    success: true,
    output:  {
      items: chunks.map(c => c.chunk_text),
      found: true
    }
  }
}
```

---

## tools/handoff_human.ts

```typescript
import type { ToolFunction } from '../types'

export const handoffHuman: ToolFunction = async (input, ctx) => {
  const {
    reason,
    summary,
    urgency = 'medium'
  } = input as { reason: string; summary: string; urgency?: string }
  const { tenant_id, context, supabase } = ctx

  // 1. Atualizar status da conversa
  if (context.conversation_id) {
    await supabase
      .from('conversations')
      .update({
        status:         'handoff',
        assigned_agent: 'human',
        handoff_reason: reason
      })
      .eq('id', context.conversation_id)
  }

  // 2. Buscar contato para criar ticket no Chatwoot
  let chatwoot_ticket_id: string | null = null
  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id, contacts(name, phone), channels(config_json)')
      .eq('id', context.conversation_id!)
      .single()

    if (conv) {
      // Criar conversa no Chatwoot via API
      const chatwootRes = await fetch(
        `${process.env.CHATWOOT_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations`,
        {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            'api_access_token': process.env.CHATWOOT_API_TOKEN!
          },
          body: JSON.stringify({
            inbox_id: process.env.CHATWOOT_INBOX_ID,
            additional_attributes: {
              motivo:          reason,
              resumo:          summary,
              urgencia:        urgency,
              tenant_id,
              conversation_id: context.conversation_id
            }
          })
        }
      )
      const chatwootData = await chatwootRes.json()
      chatwoot_ticket_id = chatwootData.id?.toString() ?? null
    }
  } catch {
    // Chatwoot offline — registrar mas não bloquear o handoff
  }

  // 3. Alerta ao operador via Evolution
  try {
    await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE_DEFAULT}`,
      {
        method:  'POST',
        headers: { apikey: process.env.EVOLUTION_API_KEY! },
        body:    JSON.stringify({
          number: process.env.OPERATOR_WHATSAPP,
          text: `👤 Handoff — ${urgency.toUpperCase()}\nMotivo: ${reason}\nResumo: ${summary}`
        })
      }
    )
  } catch {
    // Evolution offline — não bloquear
  }

  // 4. Audit log
  await supabase.from('audit_logs').insert({
    tenant_id,
    event_type:    'handoff_initiated',
    resource_type: 'conversation',
    resource_id:   context.conversation_id,
    payload_json:  { reason, summary, urgency, chatwoot_ticket_id }
  })

  return {
    success: true,
    output:  {
      status:             'handoff_initiated',
      chatwoot_ticket_id: chatwoot_ticket_id ?? 'unavailable'
    }
  }
}
```

---

## tools/update_contact.ts

```typescript
import type { ToolFunction } from '../types'

export const updateContact: ToolFunction = async (input, ctx) => {
  const { contact_id, ...fields } = input as {
    contact_id: string
    name?: string
    email?: string
    tags?: string[]
  }
  const { tenant_id, supabase } = ctx

  const { error } = await supabase
    .from('contacts')
    .update({ ...fields, last_seen_at: new Date().toISOString() })
    .eq('id', contact_id)
    .eq('tenant_id', tenant_id)  // RLS reforçado programaticamente

  return {
    success: !error,
    output:  error ? { error: error.message } : { updated: true }
  }
}
```

---

## tools/schedule_appointment.ts

```typescript
import type { ToolFunction } from '../types'

export const scheduleAppointment: ToolFunction = async (input, ctx) => {
  const { contact_id, datetime, notes } = input as {
    contact_id: string
    datetime:   string
    notes?:     string
  }
  const { tenant_id, context, supabase } = ctx

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id,
      contact_id,
      conversation_id: context.conversation_id,
      datetime:        new Date(datetime).toISOString(),
      notes,
      status:          'scheduled'
    })
    .select('id')
    .single()

  return {
    success: !error,
    output:  error
      ? { error: error.message }
      : { appointment_id: data!.id, status: 'scheduled', datetime }
  }
}
```

---

## index.ts — Exports públicos

```typescript
// API pública de @ginkgo/agents

export { execute }           from './executor'
export { registry }          from './registry'
export { policy }            from './policy'
export { ledger }            from './ledger'
export { toolMap }           from './tools/index'

export type {
  ExecuteParams,
  ExecutionContext,
  ToolResult,
  ToolSpec,
  ToolContext,
  AgentType,
  ToolFunction,
  LedgerEntry,
  PolicyContext
} from './types'

export {
  ToolNotFoundError,
  ToolValidationError,
  ToolPolicyError,
  ToolExecutionError,
  ToolTimeoutError
} from './errors'
```

---

## Como os runtimes usam o kernel

### API Fastify (apps/api)

```typescript
import { execute } from '@ginkgo/agents'

app.post('/agents/execute', async (req, reply) => {
  const { tool, input, agent, context } = req.body
  const tenant_id = req.tenantId  // injetado pelo middleware

  try {
    const result = await execute({ tool, input, tenant_id, agent, context })
    return reply.send(result)
  } catch (err) {
    if (err instanceof ToolPolicyError) {
      return reply.status(402).send({ error: err.message, reason: err.reason })
    }
    return reply.status(500).send({ error: 'Falha interna' })
  }
})
```

### n8n (Code node)

```javascript
// Nó "Execute Tool" em qualquer workflow
const { execute } = require('@ginkgo/agents')

const result = await execute({
  tool:      'search_knowledge',
  input:     { query: $input.first().json.message },
  tenant_id: $env.TENANT_ID,
  agent:     'brann',
  context:   { conversation_id: $input.first().json.conversation_id }
})

return [{ json: result }]
```

### Worker (background job)

```typescript
import { execute } from '@ginkgo/agents'

runWorker('agent_tasks', async (job) => {
  const result = await execute({
    tool:      job.payload.tool,
    input:     job.payload.input,
    tenant_id: job.tenant_id,
    agent:     job.payload.agent,
    context:   job.payload.context
  })
  // resultado já logado pelo kernel
})
```

---

## Checklist de implementação

```
[ ] package.json criado com @ginkgo/agents
[ ] types.ts com todas as interfaces
[ ] errors.ts com 5 tipos de erro
[ ] registry.ts com cache TTL 5min
[ ] policy.ts validando subscription + balance + agent scope
[ ] ledger.ts com write + incident + debit
[ ] executor.ts com timeout + retry + ledger automático
[ ] tools/index.ts com mapa name → função
[ ] 6 tools implementadas (search, create_lead, update, catalog, handoff, schedule)
[ ] SQL: function match_chunks criada no Supabase
[ ] SQL: function debit_tokens criada no Supabase
[ ] Fastify importa execute() — não acessa banco diretamente
[ ] n8n usa Code node com execute() — não insere mensagens diretamente
[ ] Worker usa execute() — não chama Evolution API diretamente
[ ] Teste: ToolPolicyError lançado com token_balance = 0
[ ] Teste: ToolValidationError lançado com input inválido
[ ] Teste: ledger.write chamado em TODA execução (sucesso e falha)
[ ] Teste: debit_tokens decrementou balance no banco
```

---

*Ginkgo AI Systems — AGENT-KERNEL.md v1.0.0 — Março 2026*  
*Este é o kernel. Todo o resto é adapter.*
