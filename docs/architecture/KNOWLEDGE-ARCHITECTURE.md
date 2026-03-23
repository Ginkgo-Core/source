# KNOWLEDGE-ARCHITECTURE.md
## Arquitetura de Conhecimento — Laplace RAG
### Estrutura hierárquica, tipos de asset, Brain Score e saúde do grafo

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Nome do serviço RAG:** Laplace (o cérebro compartilhado de todos os agentes)  
> **Princípio:** Conhecimento estruturado como grafo navegável — não saco de chunks.  
> **Baseado em:** Skill Graph (eusoier/OpenClaw) adaptado para multi-tenant SaaS.

---

## 1. Por que Laplace, não "RAG simples"

RAG simples:
```
pergunta → embed → busca cosine → top-5 chunks → injeta no prompt
```

Problema: todos os chunks têm o mesmo peso. Um chunk de política de cancelamento
compete com um chunk de FAQ de preço. Sem hierarquia, sem contexto de navegação,
sem aprendizado sobre o que funciona.

Laplace:
```
pergunta → classifica intenção → navega hierarquia → filtra por tipo + score
→ top-5 chunks rankeados por relevância E Brain Score → injeta com contexto
```

A diferença é a mesma entre uma pilha de papéis e um arquivo organizado.

---

## 2. Os 6 Tipos de Knowledge Asset

Todo conhecimento indexado no Laplace pertence a um destes tipos:

```
INDEX       → ponto de entrada do cofre do tenant
              mapeia o que existe e direciona atenção
              1 por tenant, atualizado automaticamente

MOC         → Map of Content
              organiza um cluster temático por área
              (ex: "tudo sobre imóveis", "tudo sobre financiamento")
              5–10 por tenant em média

CLAIM       → princípio inviolável do negócio
              regras que o agente nunca questiona
              (ex: "nunca confirmar prazo sem checar estoque")
              baixo volume, alto impacto

METHOD      → como fazer algo
              playbooks, processos, respostas padronizadas
              (ex: "como explicar o pacote Business", "como lidar com objeção de preço")
              o tipo mais comum

FAQ         → perguntas e respostas diretas
              indexadas com a pergunta como título
              alta frequência de retrieval

CATALOG     → produtos, serviços, preços, condições
              sempre com tag catalog
              atualizado quando produtos mudam
```

---

## 3. Schema — Atualização da Tabela knowledge_assets

```sql
-- Adicionar à migration 003_rag.sql

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  asset_type TEXT DEFAULT 'faq';
  -- index | moc | claim | method | faq | catalog

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  parent_asset_id UUID REFERENCES knowledge_assets(id);
  -- MOC aponta para claims/methods relacionados
  -- claim/method aponta para o MOC pai

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  tags TEXT[] DEFAULT '{}';
  -- ['catalog', 'objecao', 'financiamento', 'urgente']

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  brain_score FLOAT DEFAULT 0.5;
  -- 0.0 a 1.0 — calculado semanalmente pelo worker-sync

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  retrieval_count INTEGER DEFAULT 0;
  -- incrementado a cada uso em retrieval_logs

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  conversion_impact FLOAT DEFAULT 0.0;
  -- % de conversas que usaram este asset e resultaram em lead/handoff

ALTER TABLE knowledge_assets ADD COLUMN IF NOT EXISTS
  last_retrieved_at TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_assets_type
  ON knowledge_assets(tenant_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_assets_brain_score
  ON knowledge_assets(tenant_id, brain_score DESC);
```

---

## 4. Brain Score — Fórmula de Relevância

```
Brain Score = (conversion_impact × 0.40)
            + (usage_frequency_norm × 0.30)
            + (recency_score × 0.20)
            + (cross_agent_usage × 0.10)

Onde:
  conversion_impact     = % conversas com este asset que geraram lead/deal
  usage_frequency_norm  = retrieval_count normalizado (0–1) no período 30d
  recency_score         = decay exponencial desde last_retrieved_at
  cross_agent_usage     = quantos agentes diferentes usaram (brann/alfred/nyra)

Exemplos:
  chunk sobre "objeção de preço" → muito usado + alta conversão = score 0.92
  chunk sobre política interna antiga → nunca usado = score 0.05
  
Interpretação:
  0.80–1.00 → Elite — injetar sempre quando relevante
  0.60–0.79 → Ativo — injetar normalmente
  0.40–0.59 → Médio — injetar se threshold de similaridade for alto
  0.20–0.39 → Baixo — candidato a reescrita
  0.00–0.19 → Obsoleto — candidato a arquivo ou remoção
```

---

## 5. Hierarquia de Navegação (Progressive Disclosure)

Inspirado no Skill Graph do @eusoier: o agente não carrega tudo de uma vez.
Ele navega da hierarquia mais ampla para o específico.

```
TENANT KNOWLEDGE GRAPH

index
  └── MOC: atendimento
  │     ├── CLAIM: nunca confirmar prazo sem checar
  │     ├── METHOD: como explicar plano Business
  │     ├── METHOD: como lidar com objeção de preço
  │     └── FAQ: quais são as formas de pagamento?
  │
  └── MOC: produtos
  │     ├── CATALOG: plano Starter (R$97)
  │     ├── CATALOG: plano Business (R$197)
  │     └── CATALOG: plano Scale (R$397)
  │
  └── MOC: empresa
        ├── METHOD: nossa história e diferenciais
        ├── CLAIM: nunca citar concorrentes pelo nome
        └── FAQ: qual o horário de atendimento?
```

---

## 6. Retrieval Hierárquico (Laplace v2)

```typescript
// packages/rag/laplace.ts

export async function hierarchicalSearch(params: {
  query:     string
  tenant_id: string
  agent:     AgentType
  top_k:     number
  threshold: number
}): Promise<LaplaceResult> {
  const { query, tenant_id, agent, top_k, threshold } = params
  const db = getClient()

  // 1. Classificar intenção da query
  const intent = await classifyIntent(query)
  // intent: 'product_question' | 'objection' | 'scheduling' | 'complaint' | 'general'

  // 2. Mapear intenção para tipos relevantes
  const typesByIntent: Record<string, string[]> = {
    product_question: ['catalog', 'faq', 'method'],
    objection:        ['claim', 'method', 'faq'],
    scheduling:       ['method', 'faq'],
    complaint:        ['claim', 'method'],
    general:          ['faq', 'method', 'catalog']
  }
  const relevantTypes = typesByIntent[intent] ?? ['faq', 'method', 'catalog']

  // 3. Gerar embedding da query
  const embedding = await generateEmbedding(query)

  // 4. Busca vetorial filtrada por tipo + Brain Score
  const { data: chunks } = await db.rpc('laplace_search', {
    p_tenant_id:    tenant_id,
    p_embedding:    embedding,
    p_asset_types:  relevantTypes,
    p_top_k:        top_k * 3,       // busca mais para filtrar depois
    p_threshold:    threshold * 0.9  // threshold ligeiramente menor para o filtro inicial
  })

  if (!chunks || chunks.length === 0) {
    // Fallback: busca sem filtro de tipo
    return await fallbackSearch({ query, tenant_id, embedding, top_k, threshold })
  }

  // 5. Re-rankar por Brain Score combinado com similaridade
  const reranked = chunks
    .map((c: any) => ({
      ...c,
      final_score: (c.similarity * 0.65) + (c.brain_score * 0.35)
    }))
    .sort((a: any, b: any) => b.final_score - a.final_score)
    .slice(0, top_k)

  // 6. Separar CLAIMS (sempre injetar se relevantes)
  const claims   = reranked.filter((c: any) => c.asset_type === 'claim')
  const others   = reranked.filter((c: any) => c.asset_type !== 'claim')

  // 7. Formatar contexto para o prompt
  const context = formatContext(claims, others)

  // 8. Logar retrieval com brain_score para atualização futura
  await logRetrieval({
    tenant_id, agent, query,
    chunks_used: reranked.map(c => ({
      chunk_id:    c.id,
      asset_id:    c.asset_id,
      asset_type:  c.asset_type,
      similarity:  c.similarity,
      brain_score: c.brain_score,
      final_score: c.final_score
    })),
    intent,
    score_avg: reranked.reduce((s, c) => s + c.final_score, 0) / reranked.length
  })

  return { context, chunks: reranked, intent, claims_injected: claims.length }
}

function formatContext(claims: any[], others: any[]): string {
  const parts = []

  // Claims sempre aparecem primeiro e com destaque
  if (claims.length > 0) {
    parts.push('[REGRAS INVIOLÁVEIS DO NEGÓCIO]')
    parts.push(claims.map(c => `• ${c.chunk_text}`).join('\n'))
    parts.push('')
  }

  // Demais chunks por tipo
  if (others.length > 0) {
    parts.push('[CONHECIMENTO RELEVANTE]')
    parts.push(others.map(c => {
      const label = {
        catalog: '📦 Produto/Serviço',
        method:  '📋 Processo',
        faq:     '❓ FAQ',
        moc:     '🗂️ Contexto',
        index:   '📌 Referência'
      }[c.asset_type] || '📄'
      return `${label}: ${c.chunk_text}`
    }).join('\n\n'))
  }

  return parts.join('\n')
}
```

---

## 7. SQL Function — laplace_search

```sql
-- Adicionar à migration 003_rag.sql

CREATE OR REPLACE FUNCTION laplace_search(
  p_tenant_id    UUID,
  p_embedding    vector(1536),
  p_asset_types  TEXT[],
  p_top_k        INT DEFAULT 15,
  p_threshold    FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id          UUID,
  asset_id    UUID,
  asset_type  TEXT,
  chunk_text  TEXT,
  metadata_json JSONB,
  similarity  FLOAT,
  brain_score FLOAT
) AS $$
  SELECT
    kc.id,
    kc.asset_id,
    ka.asset_type,
    kc.chunk_text,
    kc.metadata_json,
    1 - (kc.embedding <=> p_embedding) AS similarity,
    COALESCE(ka.brain_score, 0.5)       AS brain_score
  FROM knowledge_chunks kc
  JOIN knowledge_assets ka ON ka.id = kc.asset_id
  WHERE kc.tenant_id   = p_tenant_id
    AND ka.status       = 'indexed'
    AND ka.asset_type   = ANY(p_asset_types)
    AND 1 - (kc.embedding <=> p_embedding) >= p_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_top_k;
$$ LANGUAGE sql;
```

---

## 8. Knowledge Health Worker

Job semanal que mantém a saúde do grafo de conhecimento de cada tenant.

```typescript
// workers/sync/knowledge-health.ts

// Roda toda segunda-feira às 06h
cron.schedule('0 6 * * 1', async () => {
  const tenants = await getAllActiveTenants()

  for (const tenant of tenants) {
    await runKnowledgeHealth(tenant.id)
  }
})

async function runKnowledgeHealth(tenant_id: string) {
  const db = getClient()

  // 1. Atualizar Brain Score de todos os assets
  const { data: assets } = await db
    .from('knowledge_assets')
    .select('id, retrieval_count, conversion_impact, last_retrieved_at')
    .eq('tenant_id', tenant_id)
    .eq('status', 'indexed')

  for (const asset of assets ?? []) {
    const recency = calculateRecencyScore(asset.last_retrieved_at)
    const usageNorm = normalizeUsage(asset.retrieval_count, assets!)
    const crossAgent = await getCrossAgentUsage(asset.id, tenant_id)

    const brain_score = (
      (asset.conversion_impact ?? 0) * 0.40 +
      usageNorm * 0.30 +
      recency * 0.20 +
      crossAgent * 0.10
    )

    await db.from('knowledge_assets')
      .update({ brain_score })
      .eq('id', asset.id)
  }

  // 2. Detectar "chunks mortos" (nunca usados em 30 dias)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: dead } = await db
    .from('knowledge_assets')
    .select('id, title, asset_type')
    .eq('tenant_id', tenant_id)
    .eq('status', 'indexed')
    .lt('brain_score', 0.15)
    .or(`last_retrieved_at.is.null,last_retrieved_at.lt.${thirtyDaysAgo}`)

  // 3. Detectar perguntas sem resposta (RAG miss rate alto)
  const { data: misses } = await db
    .from('retrieval_logs')
    .select('query_text, score_avg')
    .eq('tenant_id', tenant_id)
    .lt('score_avg', 0.60)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20)

  // Agregar perguntas frequentes sem boa resposta
  const missGroups = groupSimilarQueries(misses ?? [])

  // 4. Detectar Memory Compression candidates
  // Clusters de chunks com alta similaridade entre si
  const compressionCandidates = await findSimilarChunks(tenant_id, 0.95)

  // 5. Gerar relatório de saúde e salvar
  const healthReport = {
    tenant_id,
    week_of:             new Date().toISOString().split('T')[0],
    total_assets:        assets?.length ?? 0,
    dead_assets:         dead?.length ?? 0,
    dead_asset_ids:      dead?.map(d => d.id) ?? [],
    miss_patterns:       missGroups.slice(0, 5),
    compression_groups:  compressionCandidates.length,
    avg_brain_score:     assets
      ? assets.reduce((s, a) => s + (a as any).brain_score ?? 0.5, 0) / assets.length
      : 0
  }

  await db.from('knowledge_health_reports').insert(healthReport)

  // 6. Notificar tenant se saúde estiver abaixo do threshold
  if (healthReport.avg_brain_score < 0.40 || missGroups.length >= 5) {
    await enqueue('notifications', 'send_knowledge_health_alert', tenant_id, {
      dead_count:   healthReport.dead_assets,
      miss_count:   missGroups.length,
      avg_score:    healthReport.avg_brain_score,
      suggestion:   buildHealthSuggestion(healthReport)
    })
  }
}

function buildHealthSuggestion(report: any): string {
  const suggestions = []

  if (report.dead_assets > 0) {
    suggestions.push(`${report.dead_assets} documento(s) não foram usados nos últimos 30 dias — considere atualizar ou remover`)
  }

  if (report.miss_patterns.length > 0) {
    const topMiss = report.miss_patterns[0]?.query
    suggestions.push(`Pergunta frequente sem boa resposta: "${topMiss}" — adicione conteúdo sobre isso`)
  }

  return suggestions.join('. ')
}
```

---

## 9. Tabela knowledge_health_reports

```sql
-- Adicionar à migration 005_observability.sql

CREATE TABLE knowledge_health_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  week_of             DATE NOT NULL,
  total_assets        INTEGER DEFAULT 0,
  dead_assets         INTEGER DEFAULT 0,
  dead_asset_ids      UUID[] DEFAULT '{}',
  miss_patterns       JSONB DEFAULT '[]',
  compression_groups  INTEGER DEFAULT 0,
  avg_brain_score     FLOAT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, week_of)
);
```

---

## 10. Memory Compression

Quando o grafo envelhece, chunks similares se acumulam. A compressão funde duplicatas.

```typescript
// workers/sync/memory-compression.ts

// Roda todo primeiro do mês
cron.schedule('0 7 1 * *', async () => {
  const tenants = await getAllActiveTenants()

  for (const tenant of tenants) {
    const groups = await findSimilarChunks(tenant.id, 0.95)

    for (const group of groups) {
      if (group.chunks.length < 3) continue // mínimo 3 para valer comprimir

      // Fundir via LLM
      const merged = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Estes ${group.chunks.length} trechos contêm informação similar.
Funda-os em 1 único trecho claro, completo e sem redundância.
Mantenha TODA informação relevante. Máximo 300 palavras.

Trechos:
${group.chunks.map((c: any, i: number) => `[${i+1}] ${c.chunk_text}`).join('\n\n')}`
        }]
      })

      const mergedText = merged.choices[0].message.content!

      // Substituir chunks originais pelo fundido
      await db.from('knowledge_chunks')
        .delete()
        .in('id', group.chunks.map((c: any) => c.id))

      await db.from('knowledge_chunks').insert({
        tenant_id:   tenant.id,
        asset_id:    group.chunks[0].asset_id,
        chunk_text:  mergedText,
        embedding:   await generateEmbedding(mergedText),
        metadata_json: {
          merged:           true,
          merged_from:      group.chunks.length,
          merged_at:        new Date().toISOString()
        }
      })
    }
  }
})
```

---

## 11. Dashboard — Aba Knowledge

O tenant vê a saúde do seu Laplace no dashboard:

```
Dashboard → Knowledge

[Visão geral]
  Total de documentos: 47
  Brain Score médio: 0.71 (bom ✅)
  Documentos sem uso (30d): 3 ⚠️
  Perguntas sem resposta: 2 ⚠️

[Documentos com alto Brain Score]
  "Como explicar financiamento" — score 0.94 — 87 usos
  "Objeção: está caro" — score 0.91 — 64 usos

[Alertas de melhoria]
  ⚠️ "Qual o prazo de entrega?" foi perguntada 18x sem boa resposta
     → [Adicionar resposta]
  ⚠️ "Política de garantia.pdf" não foi usado em 45 dias
     → [Atualizar] [Arquivar]

[Tipos de documento]
  FAQ: 18 | Method: 12 | Catalog: 8 | Claim: 5 | MOC: 3 | Index: 1
```

---

## 12. Cross-Learning entre Agentes

```typescript
// Quando Nyra identifica que um hook performou bem:
await db.from('learning_events').insert({
  tenant_id,
  source_agent:   'nyra',
  target_agent:   'brann',
  event_type:     'high_performance_hook',
  insight:        `Hook emocional "Você já perdeu um cliente por demora no atendimento?" teve CTR 4.2x acima da média`,
  confidence:     0.87,
  action:         'Incorporar abordagem similar na qualificação SPIN',
  asset_id:       hookAssetId   // referência ao method no Laplace
})

// Alfred detecta padrão de churn:
await db.from('learning_events').insert({
  tenant_id,
  source_agent:   'alfred',
  target_agent:   'nyra',
  event_type:     'churn_segment_detected',
  insight:        'Clientes do segmento ecommerce têm taxa de churn 3x maior após 45 dias',
  confidence:     0.79,
  action:         'Criar conteúdo de retenção específico para ecommerce',
  asset_id:       null
})
```

```sql
-- Tabela learning_events (adicionar à migration 004_agents_skills.sql)
CREATE TABLE learning_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_agent TEXT NOT NULL,
  target_agent TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  insight      TEXT NOT NULL,
  confidence   FLOAT DEFAULT 0.5,
  action       TEXT,
  asset_id     UUID REFERENCES knowledge_assets(id),
  applied      BOOLEAN DEFAULT false,
  applied_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 13. Integração com o Prompt Builder

```typescript
// Atualizar packages/agents/agent-runtime.ts

// Substituir chamada simples de RAG por Laplace hierárquico
const laplaceResult = await hierarchicalSearch({
  query:     user_message,
  tenant_id,
  agent,
  top_k:     config.rag_top_k,
  threshold: config.rag_threshold
})

// Injetar contexto com Claims separados
const systemPrompt = systemPromptBase
  .replace('{company_name}', tenant?.name ?? 'empresa')
  .replace('{rag_context}',  laplaceResult.context)  // já formatado com [REGRAS] e [CONHECIMENTO]
  .replace('{conversation_history}', formatHistory(history))
  .replace('{current_datetime}', new Date().toLocaleString('pt-BR'))
```

---

## 14. Checklist de Implementação

```
BANCO
[ ] ALTER knowledge_assets: asset_type, parent_asset_id, tags, brain_score,
    retrieval_count, conversion_impact, last_retrieved_at
[ ] CREATE TABLE knowledge_health_reports
[ ] CREATE TABLE learning_events
[ ] CREATE FUNCTION laplace_search() (substitui match_chunks())

CÓDIGO
[ ] packages/rag/laplace.ts com hierarchicalSearch()
[ ] classifyIntent() — intenção da query (pode usar LLM ou regras simples)
[ ] formatContext() — Claims separados + outros chunks
[ ] workers/sync/knowledge-health.ts — CRON segunda 06h
[ ] workers/sync/memory-compression.ts — CRON dia 1 de cada mês

DASHBOARD
[ ] Aba Knowledge com Brain Score, alertas, tipos
[ ] Botão "Adicionar resposta" para miss patterns
[ ] Indicador de saúde do Laplace no header

SEED
[ ] Tenant Zero: criar index.md, 3 MOCs, 3 claims de exemplo
[ ] Wizard: perguntar tipo ao fazer upload (ou classificar automaticamente)
```

---

*Ginkgo AI Systems — KNOWLEDGE-ARCHITECTURE.md (Laplace) v1.0.0 — Março 2026*  
*"Por fora, alfaiate. Por dentro, fábrica." — o Laplace é a fábrica invisível.*
