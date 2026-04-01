/**
 * @ginkgo/agents — ledger.ts
 * KI-2: Every execution generates a ledger entry — success OR failure.
 * KI-4: Token debit is atomic (debit_tokens_atomic SQL function).
 */

import { getClient } from './db';
import type { LedgerEntry, ExecutionContext } from './types';

/**
 * Write a ledger entry to tool_executions table.
 * Called for EVERY tool execution — success or failure (KI-2).
 */
export async function writeLedgerEntry(entry: LedgerEntry): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase.from('tool_executions').insert({
    id: entry.executionId,
    tenant_id: entry.tenantId,
    agent_type: entry.agentType,
    tool_name: entry.toolName,
    conversation_id: entry.conversationId ?? null,
    input_json: entry.inputJson,
    output_json: entry.outputJson,
    success: entry.success,
    latency_ms: entry.latencyMs,
    tokens_used: entry.tokensUsed,
    error_message: entry.errorMessage ?? null,
  });

  if (error) {
    // Ledger write failure is critical — log but don't throw
    // (we never want ledger failure to prevent the response)
    console.error('[LEDGER] Failed to write entry:', error.message, {
      executionId: entry.executionId,
      tenantId: entry.tenantId,
      toolName: entry.toolName,
    });
  }
}

/**
 * Record an incident in the incidents table.
 */
export async function recordIncident(
  tenantId: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  category: string,
  description: string,
  agent?: string
): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase.from('incidents').insert({
    tenant_id: tenantId,
    severity,
    category,
    description,
    agent: agent ?? null,
  });

  if (error) {
    console.error('[LEDGER] Failed to record incident:', error.message);
  }
}

/**
 * Atomic token debit using debit_tokens_atomic SQL function (KI-4).
 * Returns the new balance, or throws if insufficient.
 */
export async function debitTokens(
  context: ExecutionContext,
  tokensUsed: number,
  sourceType: string
): Promise<number> {
  const supabase = getClient();

  const { data, error } = await supabase.rpc('debit_tokens_atomic', {
    p_tenant_id: context.tenantId,
    p_amount: tokensUsed,
    p_source_type: sourceType,
    p_source_id: context.executionId,
    p_description: `${context.agentType}:${sourceType}`,
  });

  if (error) {
    console.error('[LEDGER] Token debit failed:', error.message);
    throw new Error(`Token debit failed: ${error.message}`);
  }

  return data as number;
}
