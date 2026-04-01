/**
 * @ginkgo/agents — agents/index.ts
 * Agent configuration barrel.
 */

export { BRANN_CONFIG } from './brann/config';
export { BRANN_SYSTEM_PROMPT, buildBrannPrompt } from './brann/prompt';
export { BRANN_TOOL_DEFINITIONS } from './brann/tools';

// Future agents:
// export { ALFRED_CONFIG } from './alfred/config';
// export { NYRA_CONFIG } from './nyra/config';
// export { COMMAND_CONFIG } from './command/config';
