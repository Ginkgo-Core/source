# GITHUB-GEMS.md
## Ferramentas Open-Source para a Plataforma Ginkgo
### Varredura GitHub — O que adotar, estudar e ignorar

> **Versão:** 1.0.0 | **Data:** Março 2026  
> **Base:** Análise Manus AI (github-gem-seeker) + pesquisa direta  
> **Regra:** A Ginkgo não deve ser um Frankenstein de 30 repositórios.  
> **Princípio:** Poucas peças centrais bem encaixadas + catálogo crescente de skills.

---

## Stack Open-Source Oficial Recomendado

```
NÚCLEO
  OpenClaw              runtime central de agentes
  n8n                   automação procedural
  Supabase              auth + banco operacional + storage
  Redis                 cache + filas + sessões
  pgvector              embeddings RAG (dentro do Supabase)

ATENDIMENTO
  Chatwoot              inbox omnichannel + handoff humano

OBSERVABILIDADE
  Langfuse              tracing de LLMs, custo, latência por tenant

MEMÓRIA VETORIAL (P2)
  Qdrant                vetor store dedicado, alternativa ao pgvector em escala

DOCUMENTOS / RAG
  Docling               extração de PDFs, DOCX, tabelas (moderno)
  Unstructured          ecossistema robusto para ingestão em escala

CONTEÚDO / PUBLICAÇÃO
  Postiz                social scheduler open-source, multi-tenant nativo

BROWSER AUTOMATION (P2)
  browser-use           agente que opera sistemas sem API
  Playwright MCP        automação de browser via MCP

INTEGRAÇÃO DE DADOS (P2)
  Airbyte               sync de fontes externas para o Data Hub

OFFICE VISUAL (P3)
  WorkAdventure         espaço virtual para agentes (Office estilo Habbo)
```

---

## Categoria A — Atendimento / Inbox / CRM Conversacional

### Chatwoot (`chatwoot/chatwoot`)
**Stars:** 18k+ | **Tier:** Legendary

```
Por que importa:
  Inbox omnichannel open-source maduro
  Resolve 90% dos requisitos de um inbox enterprise
  Handoff humano com histórico, colaboração e SLA
  API robusta para integração

Uso na Ginkgo:
  Brann atende via OpenClaw
  Casos humanos escalam para Chatwoot
  Timeline e colaboração ficam nele
  Notificações de handoff via Evolution API

Localização no monorepo:
  Serviço Docker: chat.ginkgosystems.tech
  Integração: apps/api/src/modules/integrations/chatwoot/

Veredito: OBRIGATÓRIO para o módulo de atendimento.
  Não reconstruir do zero — seria meses de trabalho por uma qualidade inferior.
```

---

## Categoria B — Orquestração e Automação

### n8n (`n8n-io/n8n`)
**Stars:** 45k+ | **Tier:** Legendary

```
Complementos relevantes:
  Zie619/n8n-workflows    → biblioteca de workflows prontos
  enescingoz/awesome-n8n-templates → templates testados pela comunidade

Uso na Ginkgo (o que fica aqui):
  Webhook do WhatsApp/Instagram
  ETL e sync de dados
  Lead capture e enriquecimento
  Publicação e pós-publicação
  Email transacional
  Handoff Chatwoot
  Alertas Telegram/WhatsApp
  Sincronização com Supabase/CRM/Stripe
  Retries simples e jobs agendados

O que NÃO vai para n8n:
  Raciocínio → OpenClaw
  Decisão adaptativa → OpenClaw
  Coordenação entre agentes → OpenClaw

Segurança CRÍTICA:
  CVE-2026-21858 (Ni8mare) — gravidade crítica — patch em versão específica
  Regra: versão pinada no docker-compose, nunca :latest
  Regra: endpoints n8n nunca públicos — só acesso interno + autenticação
  Política: atualizar n8n a cada release de segurança (monitorar releases)

Veredito: JÁ ESTÁ NA ARQUITETURA. Não é o cérebro. É o sistema reflexo.
```

---

## Categoria C — Observabilidade de Agentes

### Langfuse (`langfuse/langfuse`)
**Stars:** 8k+ | **Tier:** Excellent

```
SDKs disponíveis:
  langfuse/langfuse-python → para workers Python (video-processor)
  langfuse/langfuse-js     → para apps/api e packages/agents

Por que importa:
  Tracing de LLMs com latência, tokens, custo por call
  Observabilidade de prompts, tool calls e sessões
  Detecção de prompt drift (quando o agente começa a sair do tom)
  Análise de custo por tenant (quem está consumindo quanto e por quê)
  A/B testing de prompts com métricas reais

Uso na Ginkgo:
  Plugar no packages/agents/ledger.ts (ao lado do Supabase)
  Dashboard de AgentOps por tenant no admin
  Alertas de custo anormal (tenant consumindo 3x mais que a média)
  Base para o "loop de qualidade" de agentes (gap identificado no MARKET-REPORT)

Dados que o Langfuse captura:
  execution_id (já gerado pelo kernel v1.5)
  tool_name, input, output, latency_ms, tokens_used
  prompt_version (já versionado no banco)
  agent_type, tenant_id

Veredito: ALTÍSSIMA PRIORIDADE. Sem isso, a Ginkgo opera às cegas.
  Sem AgentOps, não dá para melhorar agentes em produção com confiança.
```

---

## Categoria D — Memória Vetorial

### pgvector (`pgvector/pgvector`)
**Stars:** 12k+ | **Tier:** Legendary

```
Status: JÁ NA STACK — extensão do Supabase
  INDEX hnsw em knowledge_chunks (migration 003)
  Busca híbrida (vetorial + full-text)
  Isolamento por tenant via RLS

Quando manter pgvector:
  P1 e P2 completos (suficiente para milhares de documentos por tenant)

Quando considerar Qdrant:
  Quando o volume por tenant ultrapassar ~500k chunks
  Quando precisar de filtragem vetorial mais complexa
  Quando pgvector mostrar degradação de latência
```

### Qdrant (`qdrant/qdrant`)
**Stars:** 20k+ | **Tier:** Legendary

```
Complementos:
  qdrant/qdrant-client   → SDK Python/TypeScript
  qdrant/mcp-server-qdrant → integração via MCP

Por que importa:
  Vetor store dedicado, mais performático que pgvector em escala
  Suporte nativo a payload filtering (filtros complexos por metadado)
  API mais rica para operações de memória

Uso futuro na Ginkgo:
  Camada de memória vetorial separada do banco operacional
  Quando pgvector não for mais suficiente
  Possível ponte MCP para agentes acessarem memória diretamente

Veredito: P2/P3. Manter pgvector no P1. Avaliar Qdrant na transição de escala.
```

---

## Categoria E — Ingestão Documental

### Docling (`docling-project/docling`)
**Stars:** 15k+ | **Tier:** Excellent

```
Complementos:
  docling-project/docling-serve → API REST para ingestão
  docling-project/docling-mcp   → integração via MCP

Por que importa:
  Pipeline moderno de extração: PDF, DOCX, HTML, tabelas, imagens
  Qualidade de extração superior ao pdf-parse simples
  Suporte a documentos complexos (contratos, catálogos, planilhas)
  Serve como base de um RAG menos burro

Uso na Ginkgo:
  worker-ingestion substituindo pdf-parse básico
  Ingestão de FAQs, contratos, tabelas, catálogos, docs internos
  Base para Alfred e Brann responderem com lastro real

Comparação com Unstructured:
  Docling: mais moderno, pipeline mais controlado, MIT license
  Unstructured: ecossistema maior, ingestão em escala, mais APIs

Veredito: Testar Docling como padrão oficial. Fallback para Unstructured se necessário.
  Definir um padrão — não misturar os dois no mesmo pipeline.
```

---

## Categoria F — Referência Estrutural (estudar, não usar como base)

### Dify (`langgenius/dify`)
**Stars:** 52k+ | **Tier:** Legendary

```
Complementos:
  langgenius/dify-plugins   → catálogo de plugins
  svcvit/Awesome-Dify-Workflow → workflows da comunidade

Por que NÃO usar como base da Ginkgo:
  Força a Ginkgo a se adaptar ao produto deles
  Não tem isolamento multi-tenant real
  Billing e governança precisariam ser reconstruídos por cima

Por que ESTUDAR:
  Sistema de plugins muito bem desenhado → inspirar Skill Marketplace
  Agent workflows visuais → referência de UX para Studio
  Plugin catalog → modelo para criar o SDK de skills da Ginkgo
  Organização de runtime + tool layer → referência arquitetural

Veredito: Laboratório de ideias e padrões. Não coração do produto.
```

---

## Categoria G — Browser Automation (P2)

### browser-use (`browser-use/browser-use`)
**Stars:** 40k+ | **Tier:** Excellent

### Playwright MCP (`microsoft/playwright-mcp`)
**Stars:** 8k+ | **Tier:** Excellent**

```
Por que importam:
  Quando o cliente quer "o agente operar sistema legado"
  Login, clique, coleta, cadastro, scraping controlado, backoffice
  Alfred operador em painéis sem API

Casos de uso reais na Ginkgo:
  Alfred preenchendo fichas em sistemas de imobiliária
  Brann consultando status de pedido em Shopee (sem API)
  Nyra baixando relatórios de anúncios em formato proprietário
  Automações em painéis de parceiros sem API documentada

Riscos reais:
  Superpoder = super dor de cabeça
  Site que muda layout → automação quebra
  Anti-bot de plataformas pode banir o IP do tenant
  Precisa sandbox, limites, timeout e auditoria por execução

Mitigação obrigatória:
  Executar em container isolado por job
  Timeout máximo de 5 minutos por tarefa
  Screenshot em caso de falha (debug)
  Aprovação humana antes de ações destrutivas

Veredito: Excelente diferencial, mas ENTRA DEPOIS do núcleo estável.
  Não antes da Sprint 3 no mínimo.
```

---

## Categoria H — Integração de Dados / Data Hub

### Airbyte (`airbytehq/airbyte`)
**Stars:** 14k+ | **Tier:** Excellent

```
Por que importa:
  Traz dados externos para dentro do Data Hub da Ginkgo
  300+ conectores nativos (Shopify, Notion, Google Sheets, HubSpot, etc.)
  Sync incremental e full refresh
  Reverse ETL disponível

Uso ideal na Ginkgo:
  Sincronizar CRM do cliente → Ginkgo contacts
  Sincronizar pedidos Shopify → Ginkgo orders
  Sincronizar planilhas → base RAG do Alfred
  Alimentar o Data Hub canônico com fontes externas

Alternativa mais leve:
  Para poucos conectores, implementar sync direto no worker-sync
  Airbyte justifica quando o cliente tem muitas fontes diversas

Veredito: Muito útil para virar "camada unificadora de dados real".
  Avaliar para clientes Scale com múltiplas fontes externas.
```

---

## Categoria I — Publicação Social

### Postiz (`gitroomhq/postiz-app`)
**Stars:** 14k+ | **Tier:** Excellent

```
Complementos:
  gitroomhq/postiz-n8n    → integração nativa com n8n
  gitroomhq/postiz-agent  → agente de publicação

Por que importa:
  Social scheduler open-source com arquitetura multi-tenant nativa
  25+ canais suportados
  Auto-hospedado → zero custo de API de publicação
  Integração n8n nativa

Decisão Postiz vs Blotato:
  Blotato  → padrão (SaaS gerenciado, API simples, zero setup)
  Postiz   → alternativa para clientes Scale com > 200 posts/mês
              onde o custo Blotato supera o custo de rodar Postiz

Fluxo com Postiz:
  Nyra cria → humano aprova no Studio → Postiz agenda/publica
  n8n sincroniza status e analytics de volta para o banco

Veredito: Interessante para o módulo de conteúdo em escala.
  Adicionar ao docker-compose quando necessário (ver WORKER-QUEUE.md).
```

---

## Categoria J — Office Visual

### WorkAdventure (`workadventure/workadventure`)
**Stars:** 8k+ | **Tier:** Excellent

```
Por que importa:
  Base mais próxima da visão "Ginkgo Office estilo Habbo"
  Espaço virtual com presença, alertas e interação
  Open-source, self-hosted

Uso ideal na Ginkgo:
  Camada opcional de visualização (não substituir UI funcional)
  Status dos agentes (idle, trabalhando, fila, erro, tokens)
  "Cartões" clicáveis que abrem execução/resultado
  Alertas visuais (lead quente, handoff, post aguardando aprovação)

Alternativa leve (P1):
  ginkgo-office.html atual (visualização isométrica CSS/JS)
  Supabase Realtime lendo tool_executions
  Não precisa WorkAdventure até P3

Regra importante:
  Office não deve ser o único caminho para operar
  UI tradicional eficiente precisa existir em paralelo

Veredito: Diferencial de UX, não núcleo operacional. Entra no P3.
```

---

## Categoria K — Catálogo e Referência

### Awesome MCP Servers (`punkpeye/awesome-mcp-servers`)

```
Por que importa:
  Mapa de ferramentas plugáveis via MCP
  Curadoria de capacidades para o futuro marketplace de skills
  Atalho para descobrir integrações prontas

Uso na Ginkgo:
  Referência para SDK de skills próprio
  Acelerar integrações experimentais
  Base para curadoria do marketplace (P3)

Veredito: Mapa do tesouro, não o tesouro em si.
```

---

## Tabela de Prioridade de Adoção

| Ferramenta | Categoria | P1 | P2 | P3 | Decisão |
|------------|-----------|----|----|----|----|
| n8n | Automação | ✅ | ✅ | ✅ | Já na stack |
| Chatwoot | Atendimento | ✅ | ✅ | ✅ | Já na stack |
| pgvector | RAG | ✅ | ✅ | ✅ | Já na stack |
| Langfuse | Observabilidade | ✅ | ✅ | ✅ | **Adotar agora** |
| Docling | Ingestão | ✅ | ✅ | ✅ | **Testar antes do P-10** |
| Postiz | Publicação | — | ✅ | ✅ | Alternativa ao Blotato em escala |
| Qdrant | Memória vetorial | — | ✅ | ✅ | Avaliar quando pgvector degradar |
| Airbyte | Data Hub | — | ✅ | ✅ | Para clientes com muitas fontes |
| browser-use | Browser agent | — | — | ✅ | Após núcleo estável |
| Playwright MCP | Browser agent | — | — | ✅ | Junto com browser-use |
| WorkAdventure | Office visual | — | — | ✅ | P3 apenas |
| Dify | Referência | — | — | — | Estudar, não usar |

---

## O que NÃO reconstruir do zero

```
❌ Inbox omnichannel      → usar Chatwoot
❌ Social scheduler       → usar Postiz ou Blotato
❌ Parser documental      → usar Docling ou Unstructured
❌ LLM observability      → usar Langfuse
❌ Vector store           → usar pgvector (depois Qdrant)
❌ Automation canvas      → usar n8n

✅ O que construir do zero:
  Ginkgo Core (auth, billing, tenants, policies)
  Agent Kernel (packages/agents)
  Agent Spec (config + prompt + tools por agente)
  Tool Registry (catálogo e governança)
  Data Hub canônico (modelo de objetos + identity resolution)
  Office visual básico (CSS/JS sobre Supabase Realtime)
  Skill SDK (para marketplace P3)
```

---

*Ginkgo AI Systems — docs/prd/GITHUB-GEMS.md v1.0.0 — Março 2026*  
*A Ginkgo é a cola que une essas peças — não mais uma peça.*
