# AGENT-KERNEL.md
## `packages/agents` — Execution Governance Kernel
### Versão 1.5 — Hardened Industrial

> **Decisão arquitetural final:**  
> Closed Core (executor, policy, ledger) + Open Boundary (tool registry extensível via Skill SDK)  
> A governança é invariante. O catálogo é plugável.

---

## Estrutura de arquivos

```
packages/agents/
  ├── package.json
  ├── tsconfig.json
  ├── index.ts                  ← exports públicos
  │
  ├── db.ts                     ← singleton Supabase (NEW v1.5)
  ├── executor.ts               ← único ponto de execução
  ├── registry.ts               ← carrega specs do tool_registry
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
  │   ├── schedule_appointment.ts
  │   └── ping.ts               ← tool de validação do kernel
  │
  ├── types.ts
  └── errors.ts
```

## 4 hardenings v1.5

### 1. db.ts — Singleton

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

export function getClient(): SupabaseClient {
  if (!instance) {
    instance = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return instance
}

export function _resetClient() { instance = null } // para testes
```

### 2. execution_id — rastreabilidade total

```typescript
// executor.ts — gerado no início, propagado para tudo
const execution_id = randomUUID()

// propagado para:
// ledger.write({ execution_id, ... })
// ledger.incident(..., execution_id)
// ledger.debit(..., execution_id)
// ToolContext { execution_id }  ← tools podem usar
// ToolResult { execution_id }   ← sempre retornado
```

### 3. idempotency_key — sem duplicatas

```typescript
// ExecuteParams aceita:
idempotency_key?: string

// executor.ts — lookup ANTES de executar:
if (idempotency_key) {
  const existing = await ledger.findByIdempotencyKey(tenant_id, idempotency_key)
  if (existing) {
    return { execution_id: existing.execution_id, success: true,
             output: existing.output_json, cached: true }
  }
}

// SQL index obrigatório:
// CREATE INDEX idx_tool_exec_idempotency
//   ON tool_executions(tenant_id, idempotency_key)
//   WHERE idempotency_key IS NOT NULL;
```

### 4. debit_tokens_atomic — contabilidade consistente

```sql
-- migration 006_billing.sql — adicionar esta função

CREATE OR REPLACE FUNCTION debit_tokens_atomic(
  p_tenant_id    UUID,
  p_amount       BIGINT,
  p_source_id    TEXT,
  p_execution_id UUID
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE token_balances
  SET balance     = balance - p_amount,
      used_period = used_period + p_amount,
      updated_at  = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO token_transactions
    (tenant_id, type, amount, source_type, source_id, description)
  VALUES
    (p_tenant_id, 'consumption', -p_amount, 'tool', p_source_id,
     'exec:' || p_execution_id::text);

  INSERT INTO usage_events (tenant_id, event_type, quantity, unit)
  VALUES (p_tenant_id, 'token', p_amount, 'token');
END;
$$;
```

---

## executor.ts — completo v1.5

```typescript
import { randomUUID }  from 'crypto'
import Ajv             from 'ajv'
import addFormats      from 'ajv-formats'
import { getClient }   from './db'
import { registry }    from './registry'
import { policy }      from './policy'
import { ledger }      from './ledger'
import { toolMap }     from './tools/index'
import {
  ToolNotFoundError, ToolValidationError,
  ToolExecutionError, ToolTimeoutError
} from './errors'
import type { ExecuteParams, ToolResult } from './types'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

export async function execute(params: ExecuteParams): Promise<ToolResult> {
  const { tool, input, tenant_id, agent, context = {}, idempotency_key } = params
  const execution_id = randomUUID()
  const start        = Date.now()

  // 0. Idempotency check
  if (idempotency_key) {
    const existing = await ledger.findByIdempotencyKey(tenant_id, idempotency_key)
    if (existing) {
      return { execution_id: existing.execution_id, success: true,
               output: existing.output_json, cached: true }
    }
  }

  // 1. Carregar spec (verifica enabled no banco, não só no cache)
  const spec = await registry.load(tool)
  if (!spec) throw new ToolNotFoundError(tool)

  // 2. Validar input (AJV)
  const validate = ajv.compile(spec.input_schema)
  if (!validate(input)) {
    await ledger.write({ execution_id, tenant_id, agent_type: agent,
      tool_name: tool, conversation_id: context.conversation_id,
      input_json: input, output_json: {}, success: false,
      latency_ms: Date.now()-start, tokens_used: 0,
      error_message: JSON.stringify(validate.errors), idempotency_key })
    throw new ToolValidationError(validate.errors ?? [])
  }

  // 3. Policy check (subscription + balance + agent scope + skill ativa)
  try {
    await policy.check({ tenant_id, tool, spec, agent })
  } catch (policyErr) {
    await ledger.write({ execution_id, tenant_id, agent_type: agent,
      tool_name: tool, conversation_id: context.conversation_id,
      input_json: input, output_json: {}, success: false,
      latency_ms: Date.now()-start, tokens_used: 0,
      error_message: (policyErr as Error).message, idempotency_key })
    throw policyErr
  }

  // 4. Executar com timeout + retry exponencial
  const toolFn  = toolMap[tool]
  if (!toolFn) throw new ToolNotFoundError(tool)

  let lastError: Error | null = null
  let output: Omit<ToolResult,'execution_id'> | null = null

  for (let attempt = 1; attempt <= spec.max_retries; attempt++) {
    try {
      output = await Promise.race([
        toolFn(input, { tenant_id, context, supabase: getClient(), execution_id }),
        new Promise<never>((_,reject) =>
          setTimeout(() => reject(new ToolTimeoutError(tool, spec.timeout_ms)), spec.timeout_ms)
        )
      ])
      break
    } catch (err) {
      lastError = err as Error
      if (attempt < spec.max_retries) await sleep(Math.pow(3, attempt-1) * 1000)
    }
  }

  // 5. Falha após todas as tentativas
  if (!output) {
    const latency  = Date.now()-start
    const severity = (spec.billing_impact === 'high' || latency > 10000) ? 'high' : 'medium'
    await ledger.write({ execution_id, tenant_id, agent_type: agent,
      tool_name: tool, conversation_id: context.conversation_id,
      input_json: input, output_json: {}, success: false,
      latency_ms: latency, tokens_used: 0,
      error_message: lastError?.message, idempotency_key })
    await ledger.incident(tenant_id, severity,
      `'${tool}' falhou após ${spec.max_retries} tentativas: ${lastError?.message}`,
      tool, execution_id)
    throw new ToolExecutionError(tool, spec.max_retries, lastError!)
  }

  // 6. Logar sucesso
  const latency = Date.now()-start
  await ledger.write({ execution_id, tenant_id, agent_type: agent,
    tool_name: tool, conversation_id: context.conversation_id,
    input_json: input, output_json: output.output,
    success: true, latency_ms: latency,
    tokens_used: output.tokens_used ?? 0, idempotency_key })

  // 7. Debitar tokens (transacional — BEGIN/COMMIT no SQL)
  if (output.tokens_used && output.tokens_used > 0) {
    await ledger.debit(tenant_id, output.tokens_used, tool, execution_id)
  }

  return { execution_id, success: true, output: output.output,
           tokens_used: output.tokens_used, cached: false, metadata: output.metadata }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
```

---

## tools/ping.ts — validação do kernel

```typescript
import type { ToolFunction } from '../types'

export const ping: ToolFunction = async (input, ctx) => {
  const { message } = input as { message: string }
  return {
    success: true,
    output: {
      echoed:       message,
      execution_id: ctx.execution_id,  // confirma propagação
      tenant_id:    ctx.tenant_id,
      timestamp:    new Date().toISOString()
    },
    tokens_used: 0
  }
}

/*
INSERT INTO tool_registry
  (name, description, agents_allowed, input_schema,
   read_only, billing_impact, timeout_ms, max_retries, enabled)
VALUES (
  'ping',
  'Valida que o kernel está funcionando. Ecoa a mensagem de entrada.',
  ARRAY['brann','alfred','nyra','command'],
  '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"]}',
  true, 'none', 3000, 1, true
);
*/
```

---

## Sprint de validação — 5 testes obrigatórios

```typescript
// Rodar nos 3 runtimes: API Fastify + worker + n8n Code node
// Se os 5 passarem nos 3 ambientes → kernel isolado e funcionando

// T1 — Execução básica
const r = await execute({ tool:'ping', input:{message:'kernel check'},
  tenant_id: TENANT_ZERO_ID, agent:'brann' })
assert(r.execution_id)
assert(r.output.echoed === 'kernel check')
assert(!r.cached)

// T2 — Idempotência
const key = 'idem-001'
const r1 = await execute({ ...params, idempotency_key: key })
const r2 = await execute({ ...params, idempotency_key: key })
assert(r2.cached === true)
assert(r2.execution_id === r1.execution_id)

// T3 — Policy block (zerar token_balances temporariamente)
await expect(execute({ tool:'search_knowledge', ... }))
  .rejects.toBeInstanceOf(ToolPolicyError)
// E ledger tem entry com success=false

// T4 — Ledger em toda execução
const countBefore = await db.from('tool_executions').select('count').single()
await execute({ tool:'ping', ... })
const countAfter = await db.from('tool_executions').select('count').single()
assert(countAfter.count === countBefore.count + 1)

// T5 — Debit transacional (verificar atomicidade)
const balanceBefore = await getBalance(TENANT_ZERO_ID)
await execute({ tool:'search_knowledge', input:{query:'teste'}, ... })
const balanceAfter = await getBalance(TENANT_ZERO_ID)
const txn = await getLastTransaction(TENANT_ZERO_ID)
assert(balanceAfter === balanceBefore - txn.amount)
```

---

## Ordem de construção atualizada

```
P-01: Infra Docker + VPS
P-02: Schema + SQL functions (match_chunks + debit_tokens_atomic + idempotency index)
P-03: packages/agents completo (db, executor, registry, policy, ledger, tools, ping)
P-04: 5 testes de ping nos 3 runtimes — GATE: todos passam
P-05: WhatsApp webhook → Brann via kernel
P-06: Tools reais (create_lead, handoff, search_knowledge)
```

---

## Checklist v1.5

```
SINGLETON
[ ] db.ts com getClient() — sem múltiplos createClient()
[ ] Todos os módulos importam getClient(), não createClient()

EXECUTION ID
[ ] randomUUID() gerado no início do executor
[ ] Propagado para ledger.write, incident, debit, ToolContext
[ ] Retornado em TODA ToolResult (sucesso e falha)

IDEMPOTENCY
[ ] idempotency_key em ExecuteParams
[ ] findByIdempotencyKey() no ledger
[ ] Lookup antes de executar → cached: true se encontrado
[ ] Índice SQL criado
[ ] T2 passando

DEBIT TRANSACIONAL
[ ] debit_tokens_atomic SQL function criada
[ ] BEGIN/COMMIT cobrindo UPDATE + 2 INSERTs
[ ] ledger.debit() chama RPC, não 3 chamadas separadas
[ ] T5 passando

POLICY HARDENED
[ ] spec.enabled revalidado no banco (não só cache)
[ ] Third-party: tenant_skills.status verificado
[ ] Falha de policy → ledger entry success=false

ENFORCEMENT
[ ] Fastify: zero db.from().insert() direto em módulos de agentes
[ ] n8n: zero INSERT direto — apenas via execute()
[ ] Workers: todos passam pelo executor

VALIDAÇÃO
[ ] ping INSERT no tool_registry
[ ] 5 testes passando em API + worker + n8n
```

---

*Ginkgo AI Systems — AGENT-KERNEL.md v1.5 — Março 2026*
*Closed Core. Open Boundary. Governance invariante.*
