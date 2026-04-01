/**
 * @ginkgo/agents — policy.ts
 * Policy engine: subscription + balance + scope checks.
 * Runs BEFORE every tool execution.
 */

import { getClient } from './db';
import type { AgentType, PolicyResult, TenantSubscription, ToolSpec } from './types';
import { PolicyViolationError } from './errors';

/**
 * Check if a tenant can execute a tool based on:
 * 1. Active subscription
 * 2. Positive token balance
 * 3. Agent scope (ToolSpec.agentsAllowed — KI-6)
 */
export async function checkPolicy(
  tenantId: string,
  agentType: AgentType,
  toolSpec: ToolSpec
): Promise<PolicyResult> {
  // 1. Check agent scope (KI-6: ToolSpec is the sole authority)
  if (!toolSpec.agentsAllowed.includes(agentType)) {
    return {
      allowed: false,
      reason: `Agent "${agentType}" is not authorized for tool "${toolSpec.name}".`,
      code: 'NO_SCOPE',
    };
  }

  // 2. Load subscription + balance
  const subscription = await loadTenantSubscription(tenantId);

  if (!subscription) {
    return {
      allowed: false,
      reason: 'No active subscription found.',
      code: 'NO_SUBSCRIPTION',
    };
  }

  // 3. Check subscription status
  const activeStatuses = new Set(['trialing', 'active']);
  if (!activeStatuses.has(subscription.status)) {
    return {
      allowed: false,
      reason: `Subscription status is "${subscription.status}".`,
      code: 'NO_SUBSCRIPTION',
    };
  }

  // 4. Check token balance (KI-4 enforces atomic debit later)
  if (subscription.balance <= 0) {
    return {
      allowed: false,
      reason: 'Token balance exhausted.',
      code: 'NO_BALANCE',
    };
  }

  return { allowed: true, code: 'OK' };
}

/**
 * Enforce policy — throws PolicyViolationError if not allowed.
 */
export async function enforcePolicy(
  tenantId: string,
  agentType: AgentType,
  toolSpec: ToolSpec
): Promise<void> {
  const result = await checkPolicy(tenantId, agentType, toolSpec);

  if (!result.allowed) {
    throw new PolicyViolationError(
      result.reason ?? 'Policy check failed.',
      result.code ?? 'NO_SCOPE'
    );
  }
}

/**
 * Load tenant subscription + token balance from database.
 */
async function loadTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  const supabase = getClient();

  // Fetch tenant info
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, plan, status')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    return null;
  }

  // Fetch token balance
  const { data: balance } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('tenant_id', tenantId)
    .single();

  return {
    tenantId,
    plan: tenant.plan as string,
    status: tenant.status as TenantSubscription['status'],
    balance: (balance?.balance as number) ?? 0,
  };
}
