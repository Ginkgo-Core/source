/**
 * @ginkgo/agents — agents/brann/config.ts
 * Configuration defaults for Brann — Atendimento e Vendas agent.
 */

import type { AgentType } from '../../types';

export const BRANN_CONFIG = {
  type: 'brann' as AgentType,
  name: 'Brann',
  description: 'Agente de atendimento e vendas via WhatsApp',
  model: 'gpt-4o',
  temperature: 0.4,
  maxTokens: 800,
  maxContextMessages: 12,
  ragTopK: 5,
  handoffThresholdScore: 70,
  typingIndicator: true,
  typingDelayMs: 1200,

  /** Default tools enabled for Brann */
  toolsEnabled: [
    'search_knowledge',
    'create_lead',
    'update_contact',
    'fetch_catalog',
    'handoff_human',
    'schedule_appointment',
  ] as const,

  /** Channel this agent primarily serves */
  channel: 'whatsapp' as const,
} as const;

export type BrannConfig = typeof BRANN_CONFIG;
