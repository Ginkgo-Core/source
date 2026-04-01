/**
 * @ginkgo/agents — index.ts
 * Public API for the agent kernel v1.5
 */

// Register all built-in tools
import './tools/index';

// Core
export { getClient, getTenantClient } from './db';
export { executeTool } from './executor';
export type { ExecuteToolParams } from './executor';

// Registry
export {
  registerToolHandler,
  loadToolSpecs,
  getTool,
  getToolsForAgent,
  clearSpecCache,
} from './registry';

// Policy
export { checkPolicy, enforcePolicy } from './policy';

// Ledger
export { writeLedgerEntry, recordIncident, debitTokens } from './ledger';

// Types
export type {
  ExecutionId,
  AgentType,
  ToolResult,
  ToolSpec,
  ToolHandler,
  RegisteredTool,
  ExecutionContext,
  AgentConfig,
  LedgerEntry,
  PolicyResult,
  SubscriptionStatus,
  TenantSubscription,
} from './types';

// Errors
export {
  KernelError,
  ToolNotFoundError,
  ToolNotAuthorizedError,
  PolicyViolationError,
  ToolExecutionError,
  ValidationError,
  ExecutionTimeoutError,
} from './errors';

// Agents
export {
  BRANN_CONFIG,
  BRANN_SYSTEM_PROMPT,
  buildBrannPrompt,
  BRANN_TOOL_DEFINITIONS,
} from './agents/index';

// Tools
export { ping } from './tools/index';
