/**
 * @ginkgo/agents — tools/ping.ts
 * Kernel validation tool.
 * Used to verify the kernel is operational end-to-end.
 */

import { registerToolHandler } from '../registry';
import type { ToolResult, ExecutionContext } from '../types';

/**
 * Ping tool — validates that the full execution pipeline works:
 * registry → policy → executor → ledger
 */
export async function ping(
  input: Record<string, unknown>,
  context: ExecutionContext
): Promise<ToolResult> {
  return {
    success: true,
    data: {
      pong: true,
      executionId: context.executionId,
      tenantId: context.tenantId,
      agentType: context.agentType,
      timestamp: new Date().toISOString(),
      message: input['message'] ?? 'Kernel operational.',
    },
    tokensUsed: 0,
  };
}

// Register handler at module load
registerToolHandler('ping', ping);
