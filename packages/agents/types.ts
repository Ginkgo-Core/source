/**
 * @ginkgo/agents — types.ts
 * Core types for the agent kernel v1.5
 */

/** Unique identifier for every agent execution (KI-1) */
export type ExecutionId = string;

/** Supported agent types */
export type AgentType = 'brann' | 'alfred' | 'nyra' | 'command';

/** Tool execution result */
export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

/** Tool specification — single source of truth for authorization (KI-6) */
export interface ToolSpec {
  name: string;
  description: string;
  agentsAllowed: AgentType[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: string[];
  timeoutMs: number;
  retries: number;
  readOnly: boolean;
  enabled: boolean;
}

/** Tool implementation function signature */
export type ToolHandler = (
  input: Record<string, unknown>,
  context: ExecutionContext
) => Promise<ToolResult>;

/** Registered tool with spec + handler */
export interface RegisteredTool {
  spec: ToolSpec;
  handler: ToolHandler;
}

/** Execution context passed to every tool */
export interface ExecutionContext {
  executionId: ExecutionId;
  tenantId: string;
  agentType: AgentType;
  conversationId?: string;
  profileId?: string;
}

/** Agent configuration from the database */
export interface AgentConfig {
  id: string;
  tenantId: string;
  type: AgentType;
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  configJson: Record<string, unknown>;
  toolsEnabled: string[];
  promptVersion: string;
}

/** Ledger entry — recorded for every execution (KI-2) */
export interface LedgerEntry {
  executionId: ExecutionId;
  tenantId: string;
  agentType: AgentType;
  toolName: string;
  conversationId?: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  success: boolean;
  latencyMs: number;
  tokensUsed: number;
  errorMessage?: string;
}

/** Policy check result */
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  code?: 'OK' | 'NO_SUBSCRIPTION' | 'NO_BALANCE' | 'NO_SCOPE' | 'AGENT_DISABLED';
}

/** Subscription status */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

/** Tenant subscription info for policy checks */
export interface TenantSubscription {
  tenantId: string;
  plan: string;
  status: SubscriptionStatus;
  balance: number;
}
