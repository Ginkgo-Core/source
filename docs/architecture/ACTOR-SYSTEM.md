# ACTOR-SYSTEM.md
## Sistema de Persona e Voz dos Agentes
### Brann pode ser Ana, Ricardo, Gabriela — totalmente personalizável

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Princípio:** Nenhum cliente final precisa saber que está falando com IA.  
> **O agente tem nome, personalidade, voz e backstory definidos pelo tenant.**

---

## 1. Por que o Actor System existe

Sem persona customizável:
```
Lead: "Olá"
Agente: "Olá! Sou o Brann, assistente de IA da empresa..."
Lead: [fecha o chat]
```

Com persona do cliente:
```
Lead: "Olá"
Ana: "Oi! Aqui é a Ana, da Clínica Dra. Maria. Como posso te ajudar hoje? 😊"
Lead: [continua a conversa]
```

A diferença é conversão. Nomes humanos, personalidade coerente e voz real criam confiança. O lead não precisa saber se é humano ou IA — precisa ser bem atendido.

---

## 2. Componentes da Persona

```
ACTOR PROFILE (por tenant/agente)
  ├── nome          → "Ana", "Ricardo", "Gabriela", "João"
  ├── gênero        → feminino | masculino | neutro
  ├── personalidade → acolhedora | objetiva | consultiva | descontraída | formal
  ├── backstory     → "Consultora de imóveis há 5 anos, especialista em zona sul"
  ├── tom           → formal | semiformal | informal
  ├── restricoes    → "nunca cite concorrentes", "nunca prometa prazo"
  └── nicho_hints   → dicas específicas do segmento (geradas automaticamente)

VOICE PROFILE (por tenant/agente — skill ElevenLabs)
  ├── voice_id      → ID da voz na biblioteca ElevenLabs
  ├── voice_name    → "Mariana", "Carlos", etc.
  ├── sotaque       → neutro_br | gaucho | carioca | paulistano
  ├── velocidade    → slow | normal | fast (stability/similarity ElevenLabs)
  └── cloned        → true se voz custom foi clonada pelo cliente
```

---

## 3. Banco de Dados — Tabela actor_profiles

```sql
-- Adicionar à migration 004_agents_skills.sql

CREATE TABLE actor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_type      TEXT NOT NULL DEFAULT 'brann',
  -- brann | alfred | nyra | command

  -- Identidade
  actor_name      TEXT NOT NULL,        -- "Ana", "Ricardo"
  gender          TEXT DEFAULT 'neutro', -- feminino | masculino | neutro
  personality     TEXT DEFAULT 'acolhedora',
  -- acolhedora | objetiva | consultiva | descontraida | formal
  backstory       TEXT,                 -- máx 200 chars
  tone            TEXT DEFAULT 'semiformal',

  -- Comportamento
  restrictions    TEXT[],               -- array de restrições
  nicho_hints     TEXT[],              -- gerado automaticamente por segmento

  -- Voz (ElevenLabs — opcional)
  voice_id        TEXT,                 -- voice_id da ElevenLabs
  voice_name      TEXT,                 -- nome amigável
  sotaque         TEXT DEFAULT 'neutro_br',
  voice_speed     FLOAT DEFAULT 1.0,    -- 0.7 lento → 1.3 rápido
  voice_cloned    BOOLEAN DEFAULT false,
  voice_preview_url TEXT,              -- URL do preview de áudio

  -- Status
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, agent_type)
);

CREATE INDEX idx_actor_tenant ON actor_profiles(tenant_id, agent_type);
```

---

## 4. Personas Pré-definidas por Segmento

O wizard sugere automaticamente uma persona baseada no segmento. O cliente pode aceitar ou personalizar.

```typescript
// apps/api/src/modules/provisioning/actor-defaults.ts

export const segmentDefaults: Record<string, ActorDefault> = {
  imobiliaria: {
    suggested_names:  ['Ana', 'Carlos', 'Gabriela', 'Ricardo'],
    personality:      'consultiva',
    tone:             'semiformal',
    backstory_hint:   'Especialista em imóveis, conhece bem a região',
    nicho_hints: [
      'Mencionar características do bairro/região quando relevante',
      'Perguntar se é para morar ou investir',
      'Oferecer visita ao imóvel como próximo passo',
      'Nunca confirmar valor de financiamento sem simulação'
    ]
  },
  clinica: {
    suggested_names:  ['Ana', 'Júlia', 'Beatriz', 'Pedro'],
    personality:      'acolhedora',
    tone:             'formal',
    backstory_hint:   'Recepcionista da clínica, agenda consultas e tira dúvidas',
    nicho_hints: [
      'Sempre verificar disponibilidade antes de confirmar horário',
      'Nunca dar diagnósticos ou orientações médicas',
      'Perguntar se é primeira consulta ou retorno',
      'Informar documentos necessários para a consulta'
    ]
  },
  ecommerce: {
    suggested_names:  ['Bia', 'Lucas', 'Mariana', 'Rafael'],
    personality:      'descontraida',
    tone:             'informal',
    backstory_hint:   'Atendente da loja, expert nos produtos',
    nicho_hints: [
      'Perguntar tamanho e cor antes de sugerir produto',
      'Informar prazo de entrega para o CEP do cliente',
      'Mencionar política de troca e devolução',
      'Oferecer código de desconto para primeira compra'
    ]
  },
  servico: {
    suggested_names:  ['Ana', 'João', 'Fernanda', 'Diego'],
    personality:      'objetiva',
    tone:             'semiformal',
    backstory_hint:   'Assistente de atendimento, agiliza o processo de contratação',
    nicho_hints: [
      'Qualificar o escopo do serviço antes de mencionar preço',
      'Perguntar prazo desejado pelo cliente',
      'Sempre confirmar disponibilidade antes de fechar agenda',
      'Oferecer orçamento sem compromisso como próximo passo'
    ]
  }
}
```

---

## 5. Geração do Prompt com Actor System

```typescript
// apps/api/src/modules/provisioning/generate-brann-prompt.ts (atualizado)

interface WizardData {
  tenant_id:            string
  business_name:        string
  segment:              string
  products_description: string
  business_hours:       string
  city:                 string
  // Actor fields (novo)
  actor_name:           string       // "Ana"
  actor_gender:         string       // "feminino"
  actor_personality:    string       // "acolhedora"
  actor_backstory:      string       // "Consultora de imóveis há 5 anos"
  actor_tone:           string       // "semiformal"
  actor_restrictions:   string[]
  nicho_hints:          string[]
}

export async function generateBrannPrompt(data: WizardData): Promise<string> {
  const genderPronoun = {
    feminino:  { eu: 'eu', me: 'me', minha: 'minha', sou: 'sou' },
    masculino: { eu: 'eu', me: 'me', minha: 'meu',   sou: 'sou' },
    neutro:    { eu: 'eu', me: 'me', minha: 'meu/minha', sou: 'sou' }
  }[data.actor_gender]

  const response = await openai.chat.completions.create({
    model:       'gpt-4o',
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `
Você é um especialista em criar personas de agentes de atendimento para WhatsApp.

Crie um system prompt para um agente chamado ${data.actor_name}.

IDENTIDADE DO AGENTE:
  Nome: ${data.actor_name}
  Empresa: ${data.business_name}
  Segmento: ${data.segment}
  Personalidade: ${data.actor_personality}
  Tom: ${data.actor_tone}
  Backstory: ${data.actor_backstory || `Atendente da ${data.business_name}`}

NEGÓCIO:
  Produtos/Serviços: ${data.products_description}
  Horário: ${data.business_hours}
  Cidade: ${data.city}

DICAS DO NICHO:
${data.nicho_hints.map(h => `  - ${h}`).join('\n')}

RESTRIÇÕES ABSOLUTAS:
${data.actor_restrictions.length
  ? data.actor_restrictions.map(r => `  - ${r}`).join('\n')
  : '  - Nenhuma restrição específica além das padrão'}

INSTRUÇÕES PARA O PROMPT:
  1. ${data.actor_name} é o nome REAL do agente — não mencionar IA, bot ou assistente virtual
  2. Se perguntarem "você é humano?": responder naturalmente, sem confirmar nem negar
     (ex: "Sou a ${data.actor_name}, atendo aqui pela ${data.business_name}! 😊")
  3. Personalidade ${data.actor_personality}: refletir isso na linguagem e escolha de palavras
  4. Tom ${data.actor_tone}: aplicar em toda comunicação
  5. Nunca sair do escopo: se pergunta for fora do negócio, redirecionar gentilmente
  6. Quando não saber: "Deixa eu verificar isso pra você!" + handoff se necessário
  7. Sem markdown: nada de **, ##, listas com - no WhatsApp
  8. Máximo 3 parágrafos por resposta
  9. Emojis com moderação (máx 2 por mensagem) se tom for informal/semiformal
 10. Horário: se fora do horário (${data.business_hours}), informar e oferecer retorno

FORMATO: apenas o texto do system prompt. Máximo 800 palavras.
      `
    }]
  })

  return response.choices[0].message.content!
}
```

---

## 6. Sistema de Voz (ElevenLabs)

O Brann pode responder com áudios quando o contexto pedir — apresentações, confirmações importantes, follow-ups pessoais.

### Biblioteca de vozes Ginkgo

```typescript
// Vozes pré-configuradas disponíveis para todos os tenants

export const GINKGO_VOICES = {
  feminino: [
    { id: 'el_mariana', name: 'Mariana', sotaque: 'neutro_br',
      desc: 'Voz clara e acolhedora, ideal para atendimento' },
    { id: 'el_julia',   name: 'Júlia',   sotaque: 'paulistano',
      desc: 'Dinâmica e profissional' },
    { id: 'el_beatriz', name: 'Beatriz', sotaque: 'gaucho',
      desc: 'Calorosa e próxima' },
    { id: 'el_sofia',   name: 'Sofia',   sotaque: 'carioca',
      desc: 'Descontraída e simpática' }
  ],
  masculino: [
    { id: 'el_carlos',  name: 'Carlos',  sotaque: 'neutro_br',
      desc: 'Voz firme e confiável' },
    { id: 'el_pedro',   name: 'Pedro',   sotaque: 'paulistano',
      desc: 'Profissional e direto' },
    { id: 'el_rafael',  name: 'Rafael',  sotaque: 'carioca',
      desc: 'Amigável e descontraído' },
    { id: 'el_lucas',   name: 'Lucas',   sotaque: 'gaucho',
      desc: 'Próximo e acolhedor' }
  ]
}
```

### Tool de envio de áudio

```typescript
// packages/agents/tools/send_audio.ts

export const sendAudio: ToolFunction = async (input, ctx) => {
  const { text, context_type = 'response' } = input as {
    text: string
    context_type: 'greeting' | 'response' | 'followup' | 'confirmation'
  }
  const { tenant_id, context } = ctx

  // 1. Buscar voice profile do tenant
  const { data: actor } = await ctx.supabase
    .from('actor_profiles')
    .select('voice_id, voice_speed, voice_cloned')
    .eq('tenant_id', tenant_id)
    .eq('agent_type', 'brann')
    .single()

  if (!actor?.voice_id) {
    return { success: false, output: { error: 'Voz não configurada' } }
  }

  // 2. Gerar áudio via ElevenLabs
  const audioBuffer = await generateAudio({
    text,
    voice_id:  actor.voice_id,
    speed:     actor.voice_speed ?? 1.0
  })

  // 3. Upload para Supabase Storage
  const fileName  = `${tenant_id}/audio/${context.conversation_id}-${Date.now()}.mp3`
  const { data: upload } = await ctx.supabase.storage
    .from('content')
    .upload(fileName, audioBuffer, { contentType: 'audio/mpeg' })

  const audioUrl = ctx.supabase.storage.from('content').getPublicUrl(fileName).data.publicUrl

  // 4. Enviar via Evolution API como audioMessage
  await fetch(`${process.env.EVOLUTION_API_URL}/message/sendAudio/${process.env.EVOLUTION_INSTANCE}`, {
    method:  'POST',
    headers: { apikey: process.env.EVOLUTION_API_KEY! },
    body:    JSON.stringify({
      number: context.contact_phone,
      audio:  audioUrl
    })
  })

  return {
    success:     true,
    output:      { audio_url: audioUrl, duration_chars: text.length },
    tokens_used: Math.ceil(text.length / 4)
  }
}

async function generateAudio(params: {
  text:     string
  voice_id: string
  speed:    number
}): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voice_id}`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key':   process.env.ELEVENLABS_API_KEY!
      },
      body: JSON.stringify({
        text: params.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability:        0.65,
          similarity_boost: 0.80,
          speed:            params.speed
        }
      })
    }
  )
  return Buffer.from(await response.arrayBuffer())
}
```

### Quando o Brann usa áudio

```
O LLM decide quando enviar áudio baseado nas instruções do system prompt:

  USAR ÁUDIO:
    → Primeiro contato após QR conectado ("Olá, pode me enviar um áudio?")
    → Confirmação de agendamento ("Sua consulta está marcada para...")
    → Follow-up de lead quente (mensagem mais pessoal)
    → Quando lead envia áudio (responder na mesma modalidade)

  NÃO USAR ÁUDIO:
    → Quando contém lista de informações (texto é mais legível)
    → Fora do horário comercial (pode incomodar)
    → Quando lead pediu apenas texto

  Tool spec no tool_registry:
    name: 'send_audio'
    billing_impact: 'medium'
    agents_allowed: ['brann', 'command']
    requires_approval: false  -- Brann decide autonomamente
```

### Voice Cloning (plano Business e Scale)

```
Fluxo para cliente clonar a própria voz ou de funcionário real:

  1. Dashboard → Agents → [nome do agente] → Voz → Clonar voz
  2. Gravar 3 frases de amostra (30s total mínimo)
  3. Upload para ElevenLabs Voice Cloning API
  4. Aguardar processamento (~2 min)
  5. Preview e aprovação
  6. voice_cloned = true no actor_profiles
  7. voice_id atualizado para o ID da voz clonada

Custo:
  ElevenLabs Professional Voice Cloning
  Markup aplicado via tokens Ginkgo
  Incluso nos planos Business e Scale
  Cobrança extra em Starter: R$49/mês por voz clonada
```

---

## 7. Wizard de Onboarding — Passo 3 (Actor System)

```tsx
// apps/web/app/(dashboard)/onboarding/steps/ActorStep.tsx

export function ActorStep({ segment, onNext }: ActorStepProps) {
  const defaults   = segmentDefaults[segment]
  const [actor, setActor] = useState({
    name:         defaults.suggested_names[0],
    gender:       'feminino',
    personality:  defaults.personality,
    tone:         defaults.tone,
    backstory:    '',
    restrictions: []
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">
          Crie a persona do seu assistente
        </h2>
        <p className="text-[#707088] text-sm mt-1">
          Ele terá nome, personalidade e voz próprios.
          Seus clientes vão interagir com ele como se fosse uma pessoa real.
        </p>
      </div>

      {/* Nome */}
      <div>
        <label className="text-xs text-[#707088] uppercase tracking-wide">
          Nome do assistente
        </label>
        <div className="flex gap-2 mt-2 flex-wrap">
          {defaults.suggested_names.map(name => (
            <button
              key={name}
              onClick={() => setActor(a => ({ ...a, name }))}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors
                ${actor.name === name
                  ? 'border-[#6EE7B7] text-[#6EE7B7] bg-[#6EE7B7]/10'
                  : 'border-[#2A2A3C] text-[#707088] hover:border-[#6EE7B7]'
                }`}
            >
              {name}
            </button>
          ))}
          <input
            type="text"
            placeholder="Outro nome..."
            value={!defaults.suggested_names.includes(actor.name) ? actor.name : ''}
            onChange={e => setActor(a => ({ ...a, name: e.target.value }))}
            className="px-3 py-2 bg-[#141420] border border-[#2A2A3C] rounded-lg
                       text-white text-sm focus:border-[#6EE7B7] outline-none flex-1"
          />
        </div>
      </div>

      {/* Gênero */}
      <div>
        <label className="text-xs text-[#707088] uppercase tracking-wide">Gênero</label>
        <div className="flex gap-2 mt-2">
          {['feminino', 'masculino', 'neutro'].map(g => (
            <button
              key={g}
              onClick={() => setActor(a => ({ ...a, gender: g }))}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors capitalize
                ${actor.gender === g
                  ? 'border-[#6EE7B7] text-[#6EE7B7] bg-[#6EE7B7]/10'
                  : 'border-[#2A2A3C] text-[#707088]'
                }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Personalidade */}
      <div>
        <label className="text-xs text-[#707088] uppercase tracking-wide">
          Personalidade
        </label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { value: 'acolhedora',   label: 'Acolhedora',   desc: 'Empática e próxima' },
            { value: 'objetiva',     label: 'Objetiva',     desc: 'Direta e eficiente' },
            { value: 'consultiva',   label: 'Consultiva',   desc: 'Especialista e orientadora' },
            { value: 'descontraida', label: 'Descontraída', desc: 'Informal e simpática' },
            { value: 'formal',       label: 'Formal',       desc: 'Profissional e precisa' }
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setActor(a => ({ ...a, personality: p.value }))}
              className={`p-3 rounded-lg text-left border transition-colors
                ${actor.personality === p.value
                  ? 'border-[#6EE7B7] bg-[#6EE7B7]/10'
                  : 'border-[#2A2A3C] hover:border-[#6EE7B7]/50'
                }`}
            >
              <div className="text-sm font-medium text-white">{p.label}</div>
              <div className="text-xs text-[#707088] mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Backstory */}
      <div>
        <label className="text-xs text-[#707088] uppercase tracking-wide">
          Backstory <span className="text-[#3A3A4C]">(opcional)</span>
        </label>
        <input
          type="text"
          placeholder={defaults.backstory_hint}
          maxLength={200}
          value={actor.backstory}
          onChange={e => setActor(a => ({ ...a, backstory: e.target.value }))}
          className="w-full mt-1 px-3 py-2 bg-[#141420] border border-[#2A2A3C]
                     rounded-lg text-white text-sm focus:border-[#6EE7B7] outline-none"
        />
        <p className="text-xs text-[#3A3A4C] mt-1">
          {actor.backstory.length}/200 — aparece sutilmente na apresentação do assistente
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 bg-[#0A0A10] rounded-xl border border-[#2A2A3C]">
        <p className="text-xs text-[#707088] uppercase tracking-wide mb-2">Preview</p>
        <p className="text-sm text-white">
          "Oi! Aqui é {actor.name || 'Ana'}{actor.backstory ? `, ${actor.backstory.toLowerCase()}` : ''}.
          Como posso te ajudar hoje? 😊"
        </p>
      </div>

      <button
        onClick={() => onNext(actor)}
        className="w-full py-3 bg-[#6EE7B7] text-[#0A0A10] font-bold rounded-lg"
      >
        Continuar →
      </button>
    </div>
  )
}
```

---

## 8. Atualização do Prompt ao Mudar a Persona

```typescript
// Quando cliente altera a persona no dashboard → regenerar prompt automaticamente

app.put('/agents/:type/actor', async (request, reply) => {
  const { tenant_id } = request
  const { type }      = request.params
  const actorData     = request.body

  // 1. Atualizar actor_profiles
  await supabase.from('actor_profiles')
    .upsert({ tenant_id, agent_type: type, ...actorData })

  // 2. Regenerar prompt com nova persona
  const tenant = await getTenantContext(tenant_id)
  const newPrompt = await generateBrannPrompt({
    ...tenant,
    actor_name:        actorData.actor_name,
    actor_gender:      actorData.gender,
    actor_personality: actorData.personality,
    actor_backstory:   actorData.backstory,
    actor_tone:        actorData.tone,
    actor_restrictions: actorData.restrictions,
    nicho_hints:       actorData.nicho_hints
  })

  // 3. Salvar nova versão do prompt
  await supabase.from('prompt_versions').insert({
    tenant_id,
    agent_type: type,
    version:    `v${Date.now()}-actor-update`,
    content:    newPrompt,
    active:     false, // cliente ativa manualmente ou auto-ativa se preferir
    changelog:  `Persona atualizada: ${actorData.actor_name}`
  })

  return reply.send({ updated: true, message: 'Persona atualizada. Ative o novo prompt quando quiser.' })
})
```

---

## 9. Tokenização da Skill de Voz

```
TEXTO → VOZ (ElevenLabs por caractere):

  Custo real ElevenLabs:
    ~R$0,18 por 1.000 caracteres (standard)
    ~R$0,45 por 1.000 caracteres (professional clone)

  Tokens cobrados na Ginkgo:
    Standard: 50 tokens por áudio (~100 chars)
    Professional clone: 120 tokens por áudio (~100 chars)
    Custo real: ~R$0,18 | Cobrado: ~R$0,55 → margem ~66%

  Incluído nos planos:
    Starter:   50 áudios/mês (standard)
    Business:  200 áudios/mês (standard) + 1 voz clonada
    Scale:     ilimitado + múltiplas vozes clonadas
    Adicional: R$0,055/áudio (standard) | R$0,13/áudio (clone)
```

---

## 11. Claims Estruturadas — Substituindo restrictions[]

O `restrictions[]` simples (lista de strings) foi evoluído para **claims estruturadas**.
A diferença: uma claim tem severidade, categoria, exemplo de violação e é indexada no Laplace.

### Tipos de severity

```typescript
// Duas severidades — sem meio-termo

'hard'   // Nunca viola. Injetada no prompt como [REGRA INVIOLÁVEL].
         // Se o agente tentar violar → handoff automático para humano.
         // Exemplos: "nunca confirmar prazo", "nunca citar concorrente"

'soft'   // Preferência forte, mas pode ser contornada com contexto suficiente.
         // Injetada como [DIRETRIZ].
         // Exemplos: "preferir não citar preço antes de qualificar"
```

### Schema

```typescript
interface StructuredClaim {
  id:                  string
  tenant_id:           string
  agent_type:          AgentType
  claim:               string        // enunciado da regra em linguagem natural
  severity:            'hard' | 'soft'
  category:            'vendas' | 'produto' | 'atendimento' | 'juridico' | 'marca' | 'outro'
  example_violation:   string        // como seria violar essa regra
  example_compliance:  string        // como cumprir corretamente
  auto_action?:        'handoff' | 'escalate' | null  // o que fazer se violação detectada
  active:              boolean
}
```

### Banco de dados

```sql
-- Adicionar à migration 004_agents_skills.sql

CREATE TABLE agent_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_type          TEXT NOT NULL DEFAULT 'brann',
  claim               TEXT NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'hard',  -- hard | soft
  category            TEXT NOT NULL DEFAULT 'atendimento',
  example_violation   TEXT,
  example_compliance  TEXT,
  auto_action         TEXT,   -- handoff | escalate | null
  active              BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  -- Cada claim é automaticamente indexada no Laplace como asset_type='claim'
  laplace_asset_id    UUID REFERENCES knowledge_assets(id)
);

CREATE INDEX idx_claims_tenant ON agent_claims(tenant_id, agent_type, active);
```

### Claims geradas automaticamente no onboarding

```typescript
// apps/api/src/modules/provisioning/generate-claims.ts

export const defaultClaimsBySegment: Record<string, Partial<StructuredClaim>[]> = {
  imobiliaria: [
    {
      claim:              'Nunca confirmar valor de financiamento sem simulação aprovada',
      severity:           'hard',
      category:           'juridico',
      example_violation:  'Sua parcela seria em torno de R$2.000',
      example_compliance: 'Posso te ajudar a simular o financiamento — me passa seus dados?',
      auto_action:        'handoff'
    },
    {
      claim:              'Nunca garantir valorização do imóvel como certa',
      severity:           'hard',
      category:           'juridico',
      example_violation:  'Esse imóvel vai valorizar 30% em 2 anos',
      example_compliance: 'Historicamente essa região tem se valorizado bem, mas depende do mercado'
    },
    {
      claim:              'Sempre perguntar se é para morar ou investir antes de apresentar opções',
      severity:           'soft',
      category:           'vendas',
      example_violation:  'Temos esse apartamento de 2 quartos...',
      example_compliance: 'Antes de te mostrar as opções — é para morar ou para investir?'
    }
  ],
  clinica: [
    {
      claim:              'Nunca dar diagnósticos, orientações médicas ou interpretar exames',
      severity:           'hard',
      category:           'juridico',
      example_violation:  'Esses sintomas indicam...',
      example_compliance: 'Para essa avaliação, precisa de uma consulta com o médico',
      auto_action:        'handoff'
    },
    {
      claim:              'Sempre confirmar disponibilidade antes de oferecer horário',
      severity:           'hard',
      category:           'atendimento',
      example_violation:  'Pode vir amanhã às 14h',
      example_compliance: 'Deixa eu verificar a agenda — um momento!'
    }
  ],
  ecommerce: [
    {
      claim:              'Nunca confirmar prazo de entrega sem verificar CEP e estoque',
      severity:           'hard',
      category:           'produto',
      example_violation:  'Chega em 3 dias úteis',
      example_compliance: 'Me passa seu CEP que calculo o prazo certinho para você!'
    },
    {
      claim:              'Sempre mencionar política de troca ao fechar pedido',
      severity:           'soft',
      category:           'atendimento',
      example_violation:  '[não mencionar a política]',
      example_compliance: 'Lembrando que temos 30 dias para troca caso precise!'
    }
  ]
}

export async function generateDefaultClaims(
  tenant_id: string,
  segment:   string,
  agent_type = 'brann'
): Promise<void> {
  const defaults = defaultClaimsBySegment[segment] ?? []

  for (const claim of defaults) {
    // 1. Criar claim na tabela
    const { data: claimRecord } = await db.from('agent_claims').insert({
      tenant_id,
      agent_type,
      ...claim,
      active: true
    }).select('id').single()

    // 2. Indexar no Laplace como asset_type='claim' (Brain Score inicial alto)
    const { data: asset } = await db.from('knowledge_assets').insert({
      tenant_id,
      title:       claim.claim,
      asset_type:  'claim',
      source_type: 'auto_generated',
      status:      'indexed',
      brain_score: 0.85,  // claims começam com score alto
      tags:        ['claim', claim.category!, claim.severity!]
    }).select('id').single()

    await db.from('knowledge_chunks').insert({
      tenant_id,
      asset_id:    asset!.id,
      chunk_text:  formatClaimAsChunk(claim as StructuredClaim),
      embedding:   await generateEmbedding(claim.claim!)
    })

    // 3. Vincular claim ao asset do Laplace
    await db.from('agent_claims')
      .update({ laplace_asset_id: asset!.id })
      .eq('id', claimRecord!.id)
  }
}

function formatClaimAsChunk(claim: StructuredClaim): string {
  return [
    `REGRA (${claim.severity === 'hard' ? 'INVIOLÁVEL' : 'DIRETRIZ'}): ${claim.claim}`,
    claim.example_violation  && `❌ ERRADO: "${claim.example_violation}"`,
    claim.example_compliance && `✅ CORRETO: "${claim.example_compliance}"`
  ].filter(Boolean).join('\n')
}
```

### Como o Laplace injeta claims no prompt

```
[REGRAS INVIOLÁVEIS DO NEGÓCIO]
• REGRA (INVIOLÁVEL): Nunca confirmar valor de financiamento sem simulação aprovada
  ✅ CORRETO: "Posso te ajudar a simular o financiamento — me passa seus dados?"

• REGRA (INVIOLÁVEL): Nunca confirmar prazo de entrega sem verificar CEP e estoque
  ✅ CORRETO: "Me passa seu CEP que calculo o prazo certinho para você!"

[DIRETRIZES]
• DIRETRIZ: Sempre perguntar se é para morar ou investir antes de apresentar opções
  ✅ CORRETO: "Antes de te mostrar as opções — é para morar ou para investir?"
```

Claims hard sempre aparecem antes de qualquer outro contexto.
O agente nunca as ignora — são injetadas como bloco separado com formatação destacada.

### Dashboard — Gestão de Claims

```
Dashboard → Agents → [nome do agente] → Claims

[Regras invioláveis (hard)]
  ✅ Nunca confirmar prazo sem verificar CEP     [Editar] [Desativar]
  ✅ Nunca dar diagnóstico médico               [Editar] [Desativar]

[Diretrizes (soft)]
  ✅ Perguntar morar/investir antes de mostrar  [Editar] [Desativar]

[+ Adicionar regra]
  Enunciado: [                           ]
  Severidade: ● Inviolável  ○ Diretriz
  Categoria:  [▼ Selecionar]
  Exemplo de violação: [              ]
  Exemplo correto:     [              ]
  [Salvar e indexar no Laplace]
```

```
BANCO
[ ] actor_profiles table criada (migration 004)
[ ] UNIQUE(tenant_id, agent_type)
[ ] seed Tenant Zero com actor_profile (nome: 'Assistente', padrão)

WIZARD
[ ] ActorStep.tsx com seleção de nome, gênero, personalidade, backstory
[ ] Preview de apresentação em tempo real
[ ] Integração com segmentDefaults por nicho

GERAÇÃO DE PROMPT
[ ] generateBrannPrompt() recebe actorData e gera persona real
[ ] Prompt gerado usa nome do ator, não "Brann" ou "assistente"
[ ] Guardrail "se perguntarem se é humano" incluído no prompt base
[ ] nicho_hints injetados automaticamente por segmento

VOZ (P2)
[ ] send_audio tool criada com ElevenLabs
[ ] Biblioteca de vozes configurada (8 vozes padrão)
[ ] Preview de voz no wizard (antes de confirmar)
[ ] Voice cloning flow (Business/Scale)
[ ] actor_profiles.voice_id populado após seleção

DASHBOARD
[ ] Página /agents/[type]/actor com formulário de edição
[ ] Botão "Regenerar prompt" após mudança de persona
[ ] Botão "Preview de voz" com áudio gerado ao vivo
[ ] Histórico de versões de prompt mostrando "actor-update" como changelog
```

---

*Ginkgo AI Systems — ACTOR-SYSTEM.md v1.0.0 — Março 2026*  
*O cliente vê Ana. O motor é o Brann. A diferença está na conversão.*
