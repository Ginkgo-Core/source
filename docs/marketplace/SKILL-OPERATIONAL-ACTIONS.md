# SKILL — leaf-operational-actions
## Skill de Ações Operacionais — Configurável por Tenant e Actor
### A mesma skill vira agendamento de clínica, pedido de pizzaria, reserva de restaurante, chamado de suporte...

> **Skill ID:** `leaf-operational-actions`  
> **Agentes:** Brann · Leaf · qualquer actor configurado  
> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Princípio:** O código é invariante. A configuração é o produto.

---

## 1. O Conceito

A mesma arquitetura de 7 tools serve para qualquer negócio.
O que muda é o **config.json** do tenant — não o código.

```
MESMO CÓDIGO                    CONFIGURAÇÃO DIFERENTE
─────────────────────           ────────────────────────────────
check_entity_exists         →   "Verificar se cliente existe no CRM"
                                "Verificar se usuário tem conta"
                                "Verificar se mesa está reservada"

register_entity             →   "Cadastrar novo paciente"
                                "Cadastrar novo cliente"
                                "Registrar novo pedido"

check_availability          →   "Verificar horários livres"
                                "Verificar mesas disponíveis"
                                "Verificar estoque do produto"

create_record               →   "Marcar consulta"
                                "Registrar pedido"
                                "Fazer reserva"
                                "Abrir chamado"

get_records                 →   "Consultar agendamentos"
                                "Ver pedidos do dia"
                                "Listar reservas da noite"

update_record               →   "Reagendar consulta"
                                "Atualizar pedido"
                                "Modificar reserva"

delete_record               →   "Cancelar consulta"
                                "Cancelar pedido"
                                "Liberar mesa"
```

---

## 2. Exemplos de Configuração por Nicho

### Clínica / Consultório

```json
{
  "skill_id": "leaf-operational-actions",
  "actor_name": "Ana",
  "entity_name": "consulta",
  "entity_plural": "consultas",
  "entity_icon": "🏥",
  "identifier_field": "phone",
  "identifier_label": "telefone",

  "availability_source": "google_calendar",
  "availability_config": {
    "calendar_id": "medico@clinica.com",
    "slot_duration_minutes": 60,
    "working_hours": "08:00-18:00",
    "working_days": [1,2,3,4,5]
  },

  "record_fields": [
    { "key": "appointment_type", "label": "Tipo de consulta",    "type": "select",
      "options": ["Clínica Geral", "Retorno", "Avaliação"] },
    { "key": "start_datetime",   "label": "Data e horário",      "type": "datetime" },
    { "key": "notes",            "label": "Observações",         "type": "text", "optional": true }
  ],

  "destination": "supabase_appointments",

  "prompts": {
    "greeting":     "Clínica {company_name}, fala com {actor_name}! Como posso te ajudar?",
    "ask_id":       "Pode me informar seu telefone para eu verificar seu cadastro?",
    "new_entity":   "Gostaria de marcar uma consulta?",
    "ask_slot":     "Qual seria o melhor dia e horário para você?",
    "confirm":      "Vou confirmar: {appointment_type} em {datetime}. Posso confirmar?",
    "success":      "Consulta marcada! Te esperamos em {datetime}. 😊",
    "cancel_ask":   "Tem certeza que deseja cancelar a consulta de {datetime}?"
  },

  "claims": [
    { "claim": "Nunca confirmar horário sem verificar disponibilidade", "severity": "hard" },
    { "claim": "Sempre consultar agendamentos antes de atualizar ou cancelar", "severity": "hard" },
    { "claim": "Nunca dar orientações médicas ou diagnósticos", "severity": "hard" }
  ]
}
```

---

### Pizzaria / Delivery

```json
{
  "skill_id": "leaf-operational-actions",
  "actor_name": "Maria",
  "entity_name": "pedido",
  "entity_plural": "pedidos",
  "entity_icon": "🍕",
  "identifier_field": "phone",
  "identifier_label": "telefone",

  "availability_source": "catalog_stock",
  "availability_config": {
    "check_stock": true,
    "max_items_per_order": 10,
    "delivery_areas": ["Centro", "Zona Norte", "Zona Sul"]
  },

  "record_fields": [
    { "key": "items",           "label": "Itens do pedido",     "type": "multiselect",
      "options_source": "catalog" },
    { "key": "delivery_address","label": "Endereço de entrega", "type": "text" },
    { "key": "payment_method",  "label": "Forma de pagamento",  "type": "select",
      "options": ["Dinheiro", "Cartão na entrega", "Pix"] },
    { "key": "notes",           "label": "Observações do pedido","type": "text", "optional": true }
  ],

  "destination": "supabase_records + google_sheets",
  "sheets_config": {
    "spreadsheet_id": "1XBdn...",
    "sheet_name": "Pedidos do Dia",
    "columns": ["Hora", "Cliente", "Telefone", "Itens", "Endereço", "Pagamento", "Status"]
  },

  "prompts": {
    "greeting":   "Pizzaria {company_name}, aqui é a {actor_name}! Qual vai ser o pedido hoje?",
    "ask_id":     "Já pediu com a gente antes? Me passa seu número para eu verificar. 😊",
    "new_entity": "Vou anotar seu pedido! O que você vai querer?",
    "ask_slot":   "Para qual endereço vai ser a entrega?",
    "confirm":    "Confirmando: {items} — entrega em {delivery_address} — pagamento {payment_method}. Tá certo?",
    "success":    "Pedido anotado! Tempo estimado: 40 minutos. Qualquer dúvida, é só chamar! 🍕",
    "cancel_ask": "Quer cancelar o pedido das {datetime}?"
  },

  "claims": [
    { "claim": "Nunca confirmar item sem verificar se está disponível no cardápio", "severity": "hard" },
    { "claim": "Sempre confirmar endereço de entrega antes de finalizar", "severity": "hard" },
    { "claim": "Nunca prometer prazo de entrega abaixo de 30 minutos", "severity": "soft" }
  ]
}
```

---

### Restaurante / Reservas

```json
{
  "skill_id": "leaf-operational-actions",
  "actor_name": "Sofia",
  "entity_name": "reserva",
  "entity_plural": "reservas",
  "entity_icon": "🍽️",
  "identifier_field": "phone",
  "identifier_label": "telefone",

  "availability_source": "table_availability",
  "availability_config": {
    "total_tables": 20,
    "max_party_size": 12,
    "turn_duration_minutes": 90,
    "service_hours": ["12:00-15:00", "19:00-23:00"]
  },

  "record_fields": [
    { "key": "party_size",    "label": "Número de pessoas",   "type": "number" },
    { "key": "date_time",     "label": "Data e horário",       "type": "datetime" },
    { "key": "occasion",      "label": "Ocasião especial",     "type": "select",
      "options": ["Nenhuma", "Aniversário", "Casamento", "Confraternização"],
      "optional": true },
    { "key": "restrictions",  "label": "Restrições alimentares","type": "text", "optional": true }
  ],

  "destination": "supabase_records",

  "prompts": {
    "greeting":   "Restaurante {company_name}, fala com {actor_name}! Em que posso ajudar?",
    "ask_id":     "Já esteve com a gente antes? Me passa seu telefone.",
    "new_entity": "Vamos fazer uma reserva!",
    "ask_slot":   "Para quantas pessoas e em qual data você prefere?",
    "confirm":    "Mesa para {party_size} pessoas em {datetime}. Posso confirmar?",
    "success":    "Reserva confirmada! Te esperamos em {datetime}. 🍽️",
    "cancel_ask": "Confirma o cancelamento da reserva de {datetime}?"
  },

  "claims": [
    { "claim": "Nunca confirmar reserva sem verificar disponibilidade de mesas", "severity": "hard" },
    { "claim": "Sempre perguntar número de pessoas antes de verificar disponibilidade", "severity": "hard" }
  ]
}
```

---

### Suporte Técnico / Help Desk

```json
{
  "skill_id": "leaf-operational-actions",
  "actor_name": "Carlos",
  "entity_name": "chamado",
  "entity_plural": "chamados",
  "entity_icon": "🛠️",
  "identifier_field": "email",
  "identifier_label": "e-mail",

  "availability_source": "none",

  "record_fields": [
    { "key": "category",    "label": "Categoria",          "type": "select",
      "options": ["Bug", "Dúvida", "Melhoria", "Urgente"] },
    { "key": "description", "label": "Descrição do problema","type": "text" },
    { "key": "priority",    "label": "Prioridade",          "type": "select",
      "options": ["Baixa", "Média", "Alta", "Crítica"] }
  ],

  "destination": "supabase_records + clickup",
  "clickup_config": {
    "list_id": "abc123",
    "assignee": "auto"
  },

  "prompts": {
    "greeting":   "Suporte {company_name}, aqui é o {actor_name}! Como posso ajudar?",
    "ask_id":     "Qual seu e-mail cadastrado?",
    "new_entity": "Vou abrir um chamado. Pode descrever o problema?",
    "confirm":    "Chamado: {category} — {description}. Vou registrar assim?",
    "success":    "Chamado #{ticket_id} aberto! Retornaremos em até {sla}. 🛠️",
    "cancel_ask": "Confirma o encerramento do chamado #{ticket_id}?"
  },

  "claims": [
    { "claim": "Nunca prometer prazo de resolução sem consultar a equipe técnica", "severity": "hard" },
    { "claim": "Chamados Críticos sempre escalar para humano imediatamente", "severity": "hard",
      "auto_action": "handoff" }
  ]
}
```

---

## 3. Destinos de Dados Suportados

```typescript
// A skill salva o record onde o cliente configurar

export type DataDestination =
  | 'supabase_appointments'   // tabela appointments (default clínicas)
  | 'supabase_records'        // tabela genérica operational_records
  | 'google_sheets'           // planilha configurada pelo cliente
  | 'google_sheets+supabase'  // ambos (pizzaria: sheets p/ operador + supabase p/ histórico)
  | 'clickup'                 // tasks no ClickUp
  | 'notion'                  // database no Notion
  | 'webhook'                 // POST para URL externa (qualquer sistema)
```

---

## 4. Tabela Genérica — operational_records

```sql
-- Migration 002_leaf.sql — tabela genérica que serve todos os destinos supabase_records

CREATE TABLE IF NOT EXISTS operational_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  record_type   TEXT NOT NULL,
  -- 'appointment' | 'order' | 'reservation' | 'ticket' | custom

  status        TEXT DEFAULT 'pending',
  -- pending | confirmed | completed | cancelled | no_show

  scheduled_at  TIMESTAMPTZ,    -- para registros com data/hora
  ends_at       TIMESTAMPTZ,

  fields_json   JSONB DEFAULT '{}',
  -- todos os campos configurados: { appointment_type, items, party_size, etc. }

  external_refs JSONB DEFAULT '{}',
  -- { calendar_event_id, sheets_row, clickup_task_id, notion_page_id }

  notes         TEXT,
  created_by    TEXT DEFAULT 'brann',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_op_records_tenant    ON operational_records(tenant_id, record_type, status);
CREATE INDEX idx_op_records_contact   ON operational_records(contact_id, created_at DESC);
CREATE INDEX idx_op_records_scheduled ON operational_records(tenant_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

ALTER TABLE operational_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON operational_records FOR ALL
  USING (tenant_id = current_tenant_id());
```

---

## 5. As 7 Tools Genéricas

```typescript
// packages/agents/tools/operational/index.ts

export const toolMap = {
  check_entity_exists: checkEntityExists,
  register_entity:     registerEntity,
  check_availability:  checkAvailability,
  create_record:       createRecord,
  get_records:         getRecords,
  update_record:       updateRecord,
  delete_record:       deleteRecord,
}
```

### check_entity_exists (genérica)

```typescript
export const checkEntityExists: ToolFunction = async (input, ctx) => {
  const { identifier } = input as { identifier: string }
  const { tenant_id, supabase } = ctx

  const config = await getSkillConfig(tenant_id, supabase)
  const field  = config.identifier_field  // 'phone' | 'email' | 'cpf'

  const normalizedId = field === 'phone'
    ? identifier.replace(/\D/g, '')
    : identifier.toLowerCase().trim()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, phone, email, metadata_json')
    .eq('tenant_id', tenant_id)
    .eq(field, normalizedId)
    .single()

  if (!contact) {
    return {
      success: true,
      output: {
        exists:  false,
        entity:  null,
        message: config.prompts?.not_found ?? `${config.identifier_label} não encontrado. Vou fazer seu cadastro!`
      }
    }
  }

  // Buscar último registro
  const { data: lastRecord } = await supabase
    .from('operational_records')
    .select('record_type, status, scheduled_at, fields_json')
    .eq('tenant_id', tenant_id)
    .eq('contact_id', contact.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    success: true,
    output: {
      exists:      true,
      entity:      { contact_id: contact.id, name: contact.name },
      last_record: lastRecord ?? null,
      message:     contact.name
        ? `Olá, ${contact.name.split(' ')[0]}! ${lastRecord ? `Seu último ${config.entity_name}: ${JSON.stringify(lastRecord.fields_json)}` : 'Primeira vez por aqui!'}`
        : 'Cadastro encontrado!'
    }
  }
}
```

### create_record (genérica)

```typescript
export const createRecord: ToolFunction = async (input, ctx) => {
  const { contact_id, fields, scheduled_at, ends_at } = input as {
    contact_id:   string
    fields:       Record<string, unknown>  // campos configurados no manifest
    scheduled_at?: string
    ends_at?:      string
  }
  const { tenant_id, supabase, execution_id } = ctx
  const config = await getSkillConfig(tenant_id, supabase)

  // 1. Salvar no Supabase (sempre)
  const { data: record, error } = await supabase
    .from('operational_records')
    .insert({
      tenant_id,
      contact_id,
      conversation_id: ctx.context?.conversation_id,
      record_type:     config.entity_name,
      status:          'confirmed',
      scheduled_at:    scheduled_at ?? null,
      ends_at:         ends_at ?? null,
      fields_json:     fields,
      created_by:      ctx.agent,
      external_refs:   {}
    })
    .select('id')
    .single()

  if (error || !record) {
    return { success: false, output: { error: 'Falha ao registrar' } }
  }

  const externalRefs: Record<string, string> = {}

  // 2. Google Calendar (se configurado)
  if (config.availability_source === 'google_calendar' && scheduled_at) {
    const calId = await createCalendarEvent(config, contact_id, fields, scheduled_at, ends_at!, supabase, tenant_id)
    if (calId) {
      externalRefs.calendar_event_id = calId
    }
  }

  // 3. Google Sheets (se configurado)
  if (config.destination?.includes('google_sheets')) {
    const sheetRow = await appendToSheet(config, fields, record.id, supabase, tenant_id)
    if (sheetRow) externalRefs.sheets_row = sheetRow
  }

  // 4. ClickUp (se configurado)
  if (config.destination?.includes('clickup')) {
    const taskId = await createClickUpTask(config, fields, supabase, tenant_id)
    if (taskId) externalRefs.clickup_task_id = taskId
  }

  // 5. Webhook externo (se configurado)
  if (config.webhook_url) {
    await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_id: record.id, fields, tenant_id, execution_id })
    })
  }

  // 6. Atualizar external_refs no banco
  if (Object.keys(externalRefs).length > 0) {
    await supabase.from('operational_records')
      .update({ external_refs: externalRefs })
      .eq('id', record.id)
  }

  // Formatar mensagem de sucesso interpolando campos
  const successMsg = interpolate(
    config.prompts?.success ?? `${config.entity_name} registrado com sucesso!`,
    { ...fields, scheduled_at, record_id: record.id }
  )

  return {
    success: true,
    output: {
      record_id:    record.id,
      external_refs: externalRefs,
      status:       'confirmed',
      message:      successMsg
    }
  }
}
```

---

## 6. Geração Automática do Prompt por Configuração

```typescript
// apps/api/src/modules/provisioning/generate-operational-prompt.ts

export async function generateOperationalPrompt(
  basePrompt:  string,
  skillConfig: SkillOperationalConfig
): Promise<string> {

  const config = skillConfig

  // Bloco de habilidades injetado no prompt do actor
  const skillBlock = `
[HABILIDADES OPERACIONAIS — ${config.entity_name.toUpperCase()}]

${config.actor_name} pode gerenciar ${config.entity_plural} diretamente pelo WhatsApp.

ENTIDADE: ${config.entity_name} ${config.entity_icon}
CAMPOS NECESSÁRIOS: ${config.record_fields.map(f => f.label + (f.optional ? ' (opcional)' : '')).join(', ')}

FLUXO OBRIGATÓRIO:
  1. Verificar se ${config.identifier_label} está cadastrado (check_entity_exists)
  2. Se não → cadastrar (register_entity) coletando: nome e ${config.identifier_label}
  3. Para criar → ${config.availability_source !== 'none' ? 'verificar disponibilidade → ' : ''}coletar campos → confirmar → registrar (create_record)
  4. Para atualizar/cancelar → consultar registros (get_records) primeiro

CAMPOS PARA COLETAR:
${config.record_fields.map(f =>
  `  • ${f.label}${f.optional ? ' (opcional)' : ''}: ${f.type === 'select' ? 'opções: ' + f.options?.join(', ') : f.type}`
).join('\n')}

EXEMPLOS DE ABORDAGEM:
${config.prompts.new_entity && `  Cliente: "Quero ${config.entity_name === 'pedido' ? 'fazer um pedido' : `marcar um(a) ${config.entity_name}`}"
  ${config.actor_name}: "${config.prompts.ask_id}"`}

REGRAS:
${config.claims?.map(c => `  → ${c.claim}`).join('\n') ?? '  → Sempre confirmar antes de finalizar'}

MENSAGENS PADRÃO:
  Boas-vindas: "${config.prompts.greeting.replace('{actor_name}', config.actor_name)}"
  Sucesso: "${config.prompts.success}"
  Cancelamento: "${config.prompts.cancel_ask}"
`

  return basePrompt + '\n\n' + skillBlock
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(data[key] ?? ''))
}
```

---

## 7. Onboarding Wizard da Skill

O cliente configura tudo pelo dashboard sem escrever código:

```
Dashboard → Skills → + Adicionar → Ações Operacionais

[PASSO 1 — Tipo de operação]
  O que o assistente vai fazer?
  ○ Agendamentos / Consultas    → pré-preenche configuração de clínica
  ○ Pedidos / Delivery          → pré-preenche configuração de pizzaria
  ○ Reservas                    → pré-preenche configuração de restaurante
  ○ Chamados / Suporte          → pré-preenche configuração de help desk
  ○ Personalizado               → formulário em branco

[PASSO 2 — Nome da operação]
  Como se chama o registro?
  Nome singular: [consulta         ] (ex: consulta, pedido, reserva, chamado)
  Nome plural:   [consultas        ]
  Ícone:         [🏥               ] (emoji)

[PASSO 3 — Campos do registro]
  + Adicionar campo
  Nome do campo: [Tipo de consulta ]
  Tipo:          [▼ Seleção única  ]
  Opções:        [Geral, Retorno, Avaliação]
  Obrigatório:   ● Sim ○ Não

  + Adicionar campo
  Nome do campo: [Data e horário   ]
  Tipo:          [▼ Data e hora    ]
  Obrigatório:   ● Sim ○ Não

[PASSO 4 — Disponibilidade]
  Como verificar disponibilidade?
  ○ Google Calendar              → conectar calendário
  ○ Verificar estoque/cardápio   → usar base de conhecimento (RAG)
  ○ Não precisa verificar        → registrar direto

[PASSO 5 — Onde salvar]
  ✅ Supabase (sempre incluído)
  ☐ Google Sheets → [URL da planilha]
  ☐ ClickUp → [ID da lista]
  ☐ Webhook → [URL para receber os dados]

[PASSO 6 — Mensagens do assistente]
  Cumprimento: [Pizzaria X, aqui é a {actor_name}! Qual vai ser o pedido?]
  Sucesso:     [Pedido anotado! Chegará em ~40 min. 🍕                   ]
  Cancelamento:[Confirma o cancelamento do pedido?                        ]

[PASSO 7 — Regras do assistente]
  + Adicionar regra
  Regra: [Nunca confirmar item sem checar disponibilidade no cardápio]
  Tipo:  ● Inviolável ○ Diretriz

[Ativar skill →]
```

---

## 8. Integração com Actor System

A skill herda o actor do tenant automaticamente. O `{actor_name}` nos prompts é substituído pelo nome configurado (Ana, Maria, Carlos, etc.).

```typescript
// Quando a skill é ativada para um tenant com actor configurado:

const actor  = await getActorProfile(tenant_id, 'brann', supabase)
const config = await getSkillConfig(tenant_id, supabase)

// Substituir actor_name nas mensagens da skill
const resolvedConfig = {
  ...config,
  actor_name: actor?.actor_name ?? config.actor_name ?? 'Assistente',
  prompts: Object.fromEntries(
    Object.entries(config.prompts ?? {}).map(([k, v]) => [
      k,
      (v as string).replace('{actor_name}', actor?.actor_name ?? 'Assistente')
    ])
  )
}

// Gerar prompt combinado: actor base + skill block
const actorPrompt = await getActivePrompt(tenant_id, 'brann', supabase)
const fullPrompt  = await generateOperationalPrompt(actorPrompt, resolvedConfig)

// Salvar como nova versão de prompt
await savePromptVersion(tenant_id, 'brann', fullPrompt, 'skill-operational-added')
```

---

## 9. Tool Registry Genérico — INSERT SQL

```sql
-- 7 tools genéricas — entram no tool_registry uma vez, servem todos os tenants

INSERT INTO tool_registry
  (name, description, agents_allowed, input_schema, read_only, billing_impact, timeout_ms, max_retries, enabled)
VALUES
(
  'check_entity_exists',
  'Verifica se o contato já existe no CRM usando o identificador configurado (telefone, email, etc.).',
  ARRAY['brann'],
  '{"type":"object","properties":{"identifier":{"type":"string","description":"Valor do identificador (telefone, email, etc.)"}},"required":["identifier"]}',
  true, 'none', 5000, 2, true
),
(
  'register_entity',
  'Cadastra um novo contato no CRM com nome e identificador. Usar somente após confirmar que não existe.',
  ARRAY['brann'],
  '{"type":"object","properties":{"name":{"type":"string"},"identifier":{"type":"string"},"extra_fields":{"type":"object"}},"required":["name","identifier"]}',
  false, 'low', 5000, 2, true
),
(
  'check_availability',
  'Verifica disponibilidade para o tipo de operação configurado (horários, mesas, estoque).',
  ARRAY['brann'],
  '{"type":"object","properties":{"date":{"type":"string"},"time_start":{"type":"string"},"time_end":{"type":"string"},"quantity":{"type":"number"}},"required":["date"]}',
  true, 'none', 8000, 2, true
),
(
  'create_record',
  'Cria um novo registro operacional (consulta, pedido, reserva, chamado). Salva em todos os destinos configurados.',
  ARRAY['brann'],
  '{"type":"object","properties":{"contact_id":{"type":"string"},"fields":{"type":"object","description":"Campos configurados no manifest da skill"},"scheduled_at":{"type":"string"},"ends_at":{"type":"string"}},"required":["contact_id","fields"]}',
  false, 'low', 15000, 2, true
),
(
  'get_records',
  'Consulta registros existentes do contato. Chamar antes de atualizar ou cancelar.',
  ARRAY['brann'],
  '{"type":"object","properties":{"contact_id":{"type":"string"},"date_from":{"type":"string"},"date_to":{"type":"string"},"status":{"type":"string"}},"required":["contact_id"]}',
  true, 'none', 5000, 2, true
),
(
  'update_record',
  'Atualiza um registro existente. Consultar registros antes de chamar esta tool.',
  ARRAY['brann'],
  '{"type":"object","properties":{"record_id":{"type":"string"},"fields":{"type":"object"},"scheduled_at":{"type":"string"},"ends_at":{"type":"string"}},"required":["record_id"]}',
  false, 'low', 10000, 2, true
),
(
  'delete_record',
  'Cancela/remove um registro. Consultar registros antes de chamar esta tool.',
  ARRAY['brann'],
  '{"type":"object","properties":{"record_id":{"type":"string"},"reason":{"type":"string"}},"required":["record_id"]}',
  false, 'low', 10000, 2, true
);
```

---

## 10. A Diferença de Mentalidade

```
ANTES (skill de clínica):
  Código específico para agendamento médico
  Novo cliente = novo código

AGORA (skill configurável):
  Código genérico → configuração específica
  Novo cliente = nova configuração
  Novo nicho = novo template de configuração

IMPACTO:
  ✅ Uma skill, infinitos negócios
  ✅ Marketplace: qualquer dev cria template de configuração, não código
  ✅ Onboarding: cliente configura pelo dashboard, sem dev
  ✅ Actor + Skill = persona + comportamento = produto completo
  ✅ Dados isolados por tenant (RLS) — Ana da pizzaria não vê dados da clínica
```

---

## 11. Templates Prontos para o Marketplace

```
skills/leaf-operational-actions/
  templates/
    clinica.json          → agendamento de consultas
    pizzaria.json         → pedidos e delivery
    restaurante.json      → reservas de mesa
    salao.json            → agendamento de serviços estéticos
    imobiliaria.json      → visitas a imóveis
    academia.json         → avaliações físicas + matriculas
    pet-shop.json         → banho e tosa
    mecanica.json         → ordens de serviço
    suporte.json          → chamados de help desk
    escola.json           → matrículas e reuniões
```

Cada template é um `config.json` de 50 linhas.
O código não muda. O template é o produto.

---

*Ginkgo AI Systems — skills/leaf-operational-actions v1.0.0 — Março 2026*  
*Uma skill. Infinitos negócios. O template é o produto.*
