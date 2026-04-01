/**
 * @ginkgo/agents — errors.ts
 * Typed error classes for the agent kernel.
 */

/** Base kernel error */
export class KernelError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'KernelError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Tool not found in registry */
export class ToolNotFoundError extends KernelError {
  constructor(toolName: string) {
    super(
      `Tool "${toolName}" not found in registry.`,
      'TOOL_NOT_FOUND',
      404
    );
    this.name = 'ToolNotFoundError';
  }
}

/** Agent not authorized to use this tool (KI-6) */
export class ToolNotAuthorizedError extends KernelError {
  constructor(toolName: string, agentType: string) {
    super(
      `Agent "${agentType}" is not authorized to use tool "${toolName}".`,
      'TOOL_NOT_AUTHORIZED',
      403
    );
    this.name = 'ToolNotAuthorizedError';
  }
}

/** Policy violation — subscription, balance, or scope */
export class PolicyViolationError extends KernelError {
  public readonly policyCode: string;

  constructor(reason: string, policyCode: string) {
    super(reason, 'POLICY_VIOLATION', 402);
    this.name = 'PolicyViolationError';
    this.policyCode = policyCode;
  }
}

/** Tool execution failed */
export class ToolExecutionError extends KernelError {
  public readonly toolName: string;

  constructor(toolName: string, message: string) {
    super(
      `Tool "${toolName}" execution failed: ${message}`,
      'TOOL_EXECUTION_FAILED',
      500
    );
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
  }
}

/** Input validation failed */
export class ValidationError extends KernelError {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/** Execution timeout */
export class ExecutionTimeoutError extends KernelError {
  constructor(toolName: string, timeoutMs: number) {
    super(
      `Tool "${toolName}" timed out after ${timeoutMs}ms.`,
      'EXECUTION_TIMEOUT',
      408
    );
    this.name = 'ExecutionTimeoutError';
  }
}
