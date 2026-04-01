/**
 * @ginkgo/agents — executor.ts
 * KI-1: Every execution generates a unique execution_id (randomUUID at the start).
 * KI-2: Every execution generates a ledger entry — success OR failure.
 * KI-3: No tool runs outside this executor.
 * KI-4: Token debit is atomic.
 * KI-6: ToolSpec is the single source of truth for authorization.
 *
 * This is the ONLY entry point for tool execution in the entire system.
 */

import { randomUUID } from 'node:crypto';
import { getTool } from './registry';
import { enforcePolicy } from './policy';
import { writeLedgerEntry, debitTokens, recordIncident } from './ledger';
import type { AgentType, ExecutionContext, ToolResult, LedgerEntry } from './types';
import {
  ToolExecutionError,
  ToolNotFoundError,
  ToolNotAuthorizedError,
  ExecutionTimeoutError,
} from './errors';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export interface ExecuteToolParams {
  tenantId: string;
  agentType: AgentType;
  toolName: string;
  input: Record<string, unknown>;
  conversationId?: string;
  profileId?: string;
}

/**
 * Execute a tool with full kernel invariant enforcement.
 *
 * Flow:
 * 1. Generate execution_id (KI-1)
 * 2. Resolve tool from registry
 * 3. Enforce policy (KI-6)
 * 4. Validate input against schema
 * 5. Execute with timeout
 * 6. Write ledger entry (KI-2)
 * 7. Debit tokens (KI-4)
 */
export async function executeTool(params: ExecuteToolParams): Promise<ToolResult> {
  // KI-1: Every execution generates execution_id unique
  const executionId = randomUUID();

  const context: ExecutionContext = {
    executionId,
    tenantId: params.tenantId,
    agentType: params.agentType,
    conversationId: params.conversationId,
    profileId: params.profileId,
  };

  const startTime = Date.now();
  let result: ToolResult;

  try {
    // 1. Resolve tool from registry
    const { spec, handler } = await getTool(params.toolName);

    // 2. Enforce policy (KI-6: ToolSpec is sole authority)
    await enforcePolicy(params.tenantId, params.agentType, spec);

    // 3. Validate input against schema (if schema exists)
    if (spec.inputSchema && Object.keys(spec.inputSchema).length > 0) {
      const validate = ajv.compile(spec.inputSchema);
      if (!validate(params.input)) {
        const errors = validate.errors;
        throw new ToolExecutionError(
          params.toolName,
          `Input validation failed: ${JSON.stringify(errors)}`
        );
      }
    }

    // 4. Execute with timeout
    result = await executeWithTimeout(
      handler(params.input, context),
      spec.timeoutMs,
      params.toolName
    );

    // 5. KI-2: Write ledger entry (success)
    const latencyMs = Date.now() - startTime;
    const entry: LedgerEntry = {
      executionId,
      tenantId: params.tenantId,
      agentType: params.agentType,
      toolName: params.toolName,
      conversationId: params.conversationId,
      inputJson: params.input,
      outputJson: result.data as Record<string, unknown>,
      success: true,
      latencyMs,
      tokensUsed: result.tokensUsed ?? 0,
    };
    await writeLedgerEntry(entry);

    // 6. KI-4: Debit tokens atomically
    if (result.tokensUsed && result.tokensUsed > 0) {
      await debitTokens(context, result.tokensUsed, params.toolName);
    }

    return result;
  } catch (error) {
    // KI-2: Ledger entry for FAILURE
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    const entry: LedgerEntry = {
      executionId,
      tenantId: params.tenantId,
      agentType: params.agentType,
      toolName: params.toolName,
      conversationId: params.conversationId,
      inputJson: params.input,
      outputJson: {},
      success: false,
      latencyMs,
      tokensUsed: 0,
      errorMessage,
    };
    await writeLedgerEntry(entry);

    // Record incident for non-trivial errors
    if (
      !(error instanceof ToolNotFoundError) &&
      !(error instanceof ToolNotAuthorizedError)
    ) {
      await recordIncident(
        params.tenantId,
        'medium',
        'tool_failure',
        `Tool ${params.toolName} failed: ${errorMessage}`,
        params.agentType
      );
    }

    // Re-throw if it's a kernel error, otherwise wrap
    if (error instanceof ToolExecutionError) throw error;
    if (error instanceof ToolNotFoundError) throw error;
    if (error instanceof ToolNotAuthorizedError) throw error;

    throw new ToolExecutionError(params.toolName, errorMessage);
  }
}

/**
 * Execute a promise with a timeout.
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ExecutionTimeoutError(toolName, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
