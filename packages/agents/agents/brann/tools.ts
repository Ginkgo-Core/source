/**
 * @ginkgo/agents — agents/brann/tools.ts
 * OpenAI function calling tool definitions for Brann.
 * These are passed to the LLM as available functions.
 */

export const BRANN_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_knowledge',
      description:
        'Busca na base de conhecimento RAG do tenant. Use ANTES de responder sobre produtos, serviços, preços ou procedimentos.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Pergunta ou termo de busca na base de conhecimento.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filtrar por tags específicas (opcional).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_lead',
      description:
        'Registra ou atualiza um lead no CRM. Use quando nome, telefone e intenção estiverem confirmados.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do lead.' },
          phone: { type: 'string', description: 'Telefone com DDD.' },
          email: { type: 'string', description: 'Email (opcional).' },
          intention: { type: 'string', description: 'Intenção principal do lead.' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags para categorizar o lead.',
          },
        },
        required: ['name', 'phone', 'intention'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_contact',
      description:
        'Atualiza dados de um contato existente. Use quando receber informações novas durante a conversa.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Telefone do contato (identificador).' },
          name: { type: 'string', description: 'Novo nome (opcional).' },
          email: { type: 'string', description: 'Novo email (opcional).' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags adicionais.',
          },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'fetch_catalog',
      description:
        'Busca informações sobre planos, preços e serviços disponíveis do tenant.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'O que o cliente quer saber sobre o catálogo.',
          },
          category: {
            type: 'string',
            description: 'Categoria específica para filtrar (opcional).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'handoff_human',
      description:
        'Transfere a conversa para um atendente humano via Chatwoot. Use em caso de urgência, pedido explícito do cliente, ou após 2 falhas consecutivas.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Motivo da transferência.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Prioridade do ticket.',
          },
          context_summary: {
            type: 'string',
            description: 'Resumo do contexto da conversa para o atendente.',
          },
        },
        required: ['reason', 'context_summary'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_appointment',
      description:
        'Cria um agendamento quando o lead aceitar agendar um horário.',
      parameters: {
        type: 'object',
        properties: {
          datetime: {
            type: 'string',
            description: 'Data e hora no formato ISO 8601.',
          },
          duration_min: {
            type: 'number',
            description: 'Duração em minutos (padrão: 30).',
          },
          notes: {
            type: 'string',
            description: 'Observações sobre o agendamento.',
          },
        },
        required: ['datetime'],
      },
    },
  },
] as const;
