/**
 * @ginkgo/agents — tools/index.ts
 * Registers all built-in tool handlers.
 * Import this module to ensure all tools are registered in the handler registry.
 */

// Import each tool module to trigger registerToolHandler() at module load
import './ping';

// Future P1 tools will be registered here:
// import './search_knowledge';
// import './create_lead';
// import './update_contact';
// import './fetch_catalog';
// import './handoff_human';
// import './schedule_appointment';

export { ping } from './ping';
