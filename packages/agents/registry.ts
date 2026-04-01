/**
 * @ginkgo/agents — registry.ts
 * Loads tool definitions from the database (tool_registry table).
 * KI-6: ToolSpec is the single source of truth for authorization.
 */

import { getClient } from './db';
import type { ToolSpec, AgentType, ToolHandler, RegisteredTool } from './types';
import { ToolNotFoundError } from './errors';

/** In-memory registry of tool handlers (code-side) */
const handlerRegistry = new Map<string, ToolHandler>();

/** Cached tool specs from database */
let specCache: Map<string, ToolSpec> | null = null;
let specCacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Register a tool handler in the local code registry.
 * Called at boot time by each tool module.
 */
export function registerToolHandler(name: string, handler: ToolHandler): void {
  handlerRegistry.set(name, handler);
}

/**
 * Load all tool specs from the tool_registry table in Supabase.
 * Caches results for CACHE_TTL_MS.
 */
export async function loadToolSpecs(): Promise<Map<string, ToolSpec>> {
  const now = Date.now();

  if (specCache && now - specCacheTimestamp < CACHE_TTL_MS) {
    return specCache;
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('tool_registry')
    .select('*')
    .eq('enabled', true);

  if (error) {
    throw new Error(`[REGISTRY] Failed to load tool_registry: ${error.message}`);
  }

  const specs = new Map<string, ToolSpec>();

  for (const row of data ?? []) {
    specs.set(row.name as string, {
      name: row.name as string,
      description: (row.description as string) ?? '',
      agentsAllowed: (row.agents_allowed as AgentType[]) ?? [],
      inputSchema: (row.input_schema as Record<string, unknown>) ?? {},
      outputSchema: (row.output_schema as Record<string, unknown>) ?? {},
      permissions: (row.permissions as string[]) ?? [],
      timeoutMs: (row.timeout_ms as number) ?? 5000,
      retries: (row.retries as number) ?? 3,
      readOnly: (row.read_only as boolean) ?? true,
      enabled: true,
    });
  }

  specCache = specs;
  specCacheTimestamp = now;

  return specs;
}

/**
 * Get a registered tool (spec + handler).
 * Throws ToolNotFoundError if tool doesn't exist.
 */
export async function getTool(name: string): Promise<RegisteredTool> {
  const specs = await loadToolSpecs();
  const spec = specs.get(name);

  if (!spec) {
    throw new ToolNotFoundError(name);
  }

  const handler = handlerRegistry.get(name);
  if (!handler) {
    throw new ToolNotFoundError(name);
  }

  return { spec, handler };
}

/**
 * Get all tool specs available for a specific agent type.
 */
export async function getToolsForAgent(agentType: AgentType): Promise<ToolSpec[]> {
  const specs = await loadToolSpecs();
  const results: ToolSpec[] = [];

  for (const spec of specs.values()) {
    if (spec.agentsAllowed.includes(agentType)) {
      results.push(spec);
    }
  }

  return results;
}

/**
 * Clear the spec cache (useful for testing or hot-reload).
 */
export function clearSpecCache(): void {
  specCache = null;
  specCacheTimestamp = 0;
}
