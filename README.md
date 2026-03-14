# Ginkgo Leaf
## Sistema Operacional para Automação Inteligente

> A plataforma principal da Ginkgo AI Systems para construir, implantar e gerenciar assistentes comerciais autônomos em escala.  
> **Versão:** 2.0.0 | **Data:** Março 2026  
> **Filosofia:** Por fora, alfaiate. Por dentro, fábrica.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Estrutura do Monorepo](#4-estrutura-do-monorepo)
5. [Agentes e Skills](#5-agentes-e-skills)
6. [Integrações](#6-integrações)
7. [Módulos Principais](#7-módulos-principais)
8. [Modelo de Dados](#8-modelo-de-dados)
9. [Skill SDK — Criação de Skills Customizadas](#9-skill-sdk--criação-de-skills-customizadas)
10. [Guia de Instalação e Setup](#10-guia-de-instalação-e-setup)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Observabilidade](#12-observabilidade)
13. [Roadmap de Expansão](#13-roadmap-de-expansão)

---

## 1. Visão Geral

Ginkgo Leaf é uma plataforma **multi-tenant** e **agent-first**, projetada para ser a espinha dorsal de operações de IA para PMEs brasileiras. Ela fornece a infraestrutura, ferramentas e abstrações necessárias para escalar a entrega de agentes de IA com foco em atendimento, vendas, operação, conteúdo e gestão de tráfego pago.

A filosofia central é **"por fora, alfaiate; por dentro, fábrica"**. Cada cliente recebe uma instância configurada para suas necessidades específicas, mas todas operam sobre uma arquitetura-mãe robusta, observável e replicável.

### O que a plataforma oferece

```
Atendimento 24h no WhatsApp           → Brann (n8n + Evolution API)
Gestão operacional conversacional     → Alfred (n8n + Supabase)
Criação de conteúdo para redes sociais → Nyra (n8n + APIs de mídia)
Assistente unificado Telegram/Web     → Command (OpenClaw)
Dashboard com dados de todos os canais → Web (Next.js + Supabase)
Billing automático por uso             → Stripe
Base de conhecimento pesquisável      → RAG (pgvector)
Marketplace de skills instaláveis     → Skill Registry (fase 3+)
```

---

## 2. Arquitetura do Sistema

### 2.1 Diagrama macro

```
┌──────────────────────────────────────────────────────────────────────┐
│                      CLIENTES / OPERADORES                           │
│         Dashboard Web · Telegram · WhatsApp · API direta             │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼───────────────────────────────────────────┐
│                  CLOUDFLARE (CDN + DDoS + WAF)                       │
│  ginkgosystems.tech · app · api · n8n · evolution · chatwoot         │
└──────────┬────────────────────────────────────────┬──────────────────┘
           │                                        │
    ┌──────▼──────┐                         ┌──────▼──────┐
    │   Vercel    │                         │  Railway /  │
    │  apps/web   │                         │  VPS Docker │
    │  Next.js    │                         │  apps/api   │
    └──────┬──────┘                         └──────┬──────┘
           └──────────────────┬─────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                        API CORE (Fastify)                            │
│  Auth · Tenants · Billing · RAG · Agent Runtime · Tool Registry      │
│  Webhook Gateway · Skill Runtime · Integrations Layer                │
└──────┬──────────────────────┬──────────────────────┬─────────────────┘
       │                      │                      │
┌──────▼───────┐    ┌─────────▼────────┐   ┌────────▼────────┐
│  AGENT LAYER │    │  WORKERS ASYNC   │   │  DATA LAYER     │
│              │    │  provisioning    │   │  Supabase PG    │
│  Brann (n8n) │    │  ingestion       │   │  pgvector       │
│  Alfred (n8n)│    │  sync            │   │  Redis          │
│  Nyra (n8n)  │    │  metering        │   │  Supabase       │
│  Command     │    │  notifications   │   │  Storage        │
│  (OpenClaw)  │    └──────────────────┘   └─────────────────┘
└──────┬───────┘
       │
┌──────▼────────────────────────────────────────────────────────────────┐
│                      SERVIÇOS EXTERNOS                                │
│                                                                       │
│  ATENDIMENTO        CONTEÚDO/MÍDIA       NEGÓCIO/DADOS               │
│  Evolution API      Meta Graph API       Stripe                      │
│  Chatwoot           Instagram API        Google My Business          │
│  OpenClaw           YouTube Data API     Google Analytics            │
│  Telegram Bot API   TikTok API           Shopify / Shopee            │
│                     Threads API          ClickUp                     │
│  CRIAÇÃO            X (Twitter) API      Google Drive/Docs           │
│  Gamma AI           LinkedIn API         Google Calendar             │
│  Blotato            Facebook API         Gmail                       │
│  ElevenLabs                                                           │
│  HeyGen             LLMs                                             │
│  Canva API          OpenAI (gpt-4o)                                  │
│                     Claude API                                       │
│                     Whisper (áudio)                                  │
│                     text-embedding-3-small                           │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de execução de mensagem

```
Mensagem recebida (WhatsApp / Telegram / Web)
  → Webhook Gateway (identificar tenant + canal)
    → Session Manager (carregar contexto da conversa)
      → Agent Resolver (qual agente para este canal/contexto?)
        → Policy Check (o agente tem permissão?)
          → Prompt Builder (system + contexto + chunks RAG + tool specs)
            → LLM Call (OpenAI gpt-4o com function calling)
              → Tool Dispatcher (se finish_reason = tool_calls)
                → Tool Executor (com log obrigatório)
                  → Response Formatter (sanitizar por canal)
                    → Canal de saída (Evolution / OpenClaw / API)
                      → Metering (debitar tokens do tenant)
                        → Observability Log (latência, custo, evidências)
```

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui | Dashboard multi-tenant, onboarding, billing UI |
| **Backend** | Fastify, TypeScript | API core de alta performance |
| **Banco de dados** | Supabase (Postgres) | Multi-tenant, Auth, RLS, Storage |
| **Banco vetorial** | pgvector (Supabase) | Embeddings e busca semântica RAG |
| **Cache / Filas** | Redis | Sessões, rate limit, jobs, cache |
| **Orquestração** | n8n (self-hosted) | Workflows de agentes, automações, glue layer |
| **Canal WhatsApp** | Evolution API | Conector multi-instância WhatsApp |
| **Inbox humano** | Chatwoot | Handoff, histórico, SLA |
| **Assistente unificado** | OpenClaw | Command Agent via Telegram / Webchat |
| **Billing** | Stripe | Subscriptions, tokens, revshare marketplace |
| **LLM principal** | OpenAI gpt-4o | Agentes (function calling) |
| **Embeddings** | text-embedding-3-small | RAG pipeline |
| **Transcrição** | OpenAI Whisper | Áudio → texto |
| **Deploy web** | Vercel | Frontend |
| **Deploy backend** | Railway / VPS Docker | API, workers, n8n, Evolution, Chatwoot |
| **CDN / DNS / WAF** | Cloudflare | Segurança, performance, SSL |
| **Criação de conteúdo** | Gamma AI, Blotato, ElevenLabs, HeyGen | Skills de Nyra |
| **Infra local** | Docker, Traefik | Dev e produção em VPS |
| **Monorepo** | pnpm workspaces | Gerenciamento de dependências |

---

## 4. Estrutura do Monorepo

```
/ginkgo-leaf
├── apps/
│   ├── web/                        # Dashboard Next.js 14
│   │   ├── app/
│   │   │   ├── (auth)/             # login, register, oauth callbacks
│   │   │   ├── (dashboard)/        # área logada
│   │   │   │   ├── page.tsx        # overview + KPIs
│   │   │   │   ├── conversations/  # inbox unificado
│   │   │   │   ├── leads/          # CRM + lead score
│   │   │   │   ├── channels/       # canais + OAuth status
│   │   │   │   ├── content/        # performance Meta, TikTok, GMB, YouTube
│   │   │   │   ├── agents/         # configuração de agentes + skills
│   │   │   │   ├── knowledge/      # base RAG + upload
│   │   │   │   ├── billing/        # planos, tokens, faturas
│   │   │   │   └── settings/       # tenant, membros, integrações
│   │   │   └── api/                # BFF routes (Next.js API)
│   │   ├── components/
│   │   │   ├── ui/                 # design system base (shadcn)
│   │   │   ├── charts/             # Recharts customizado
│   │   │   ├── feeds/              # realtime via Supabase
│   │   │   └── skills/             # UI extensions de skills
│   │   └── lib/
│   │       ├── supabase.ts
│   │       └── stripe.ts
│   │
│   └── api/                        # Fastify + TypeScript
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   ├── tenants/
│           │   ├── billing/
│           │   ├── agents/
│           │   ├── rag/
│           │   ├── tools/
│           │   ├── skills/
│           │   ├── integrations/
│           │   └── webhooks/
│           ├── middleware/
│           │   ├── auth.ts
│           │   ├── tenant.ts
│           │   └── ratelimit.ts
│           └── plugins/
│               ├── supabase.ts
│               ├── redis.ts
│               └── stripe.ts
│
├── packages/
│   ├── db/                         # Schema, migrations (9 lotes), tipos gerados
│   ├── auth/                       # Helpers de autenticação
│   ├── billing/                    # Lógica de billing agnóstica
│   ├── rag/                        # Pipeline de ingestão e retrieval
│   ├── agents/                     # Runtime: Brann, Alfred, Nyra, Command
│   ├── integrations/               # Connectors por provider
│   │   ├── meta/
│   │   ├── google/
│   │   ├── tiktok/
│   │   ├── shopify/
│   │   ├── stripe/
│   │   ├── gamma/
│   │   ├── blotato/
│   │   └── clickup/
│   └── shared/                     # Tipos, constantes, utils
│
├── workers/
│   ├── provisioning/               # Onboarding automático de tenant
│   ├── ingestion/                  # Pipeline RAG assíncrono
│   ├── sync/                       # Sync com APIs externas (Meta, GMB, TikTok)
│   ├── metering/                   # Contagem de uso e tokens
│   └── notifications/              # Alertas WhatsApp / email
│
├── skills/                         # Skills oficiais da Ginkgo (formato padrão)
│   ├── leaf-core/                  # Atendimento base (Brann)
│   ├── nyra-reels/                 # Criação de Reels e posts (Nyra)
│   ├── nyra-ads/                   # Gestão de tráfego pago (Nyra)
│   ├── alfred-sql/                 # SQL Agent read-only (Alfred)
│   ├── alfred-reports/             # Relatórios automáticos (Alfred)
│   ├── command-core/               # Command Assistant (OpenClaw)
│   └── _template/                  # Template para criar nova skill
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml      # n8n, Evolution, Chatwoot, Redis, Traefik
│   ├── deploy/
│   └── scripts/
│       ├── provision-tenant.sh
│       ├── ingest-doc.sh
│       ├── rollback-prompt.sh
│       └── rag-quality-test.sh
│
├── n8n/
│   └── workflows/
│       ├── WA-Brann-Atendimento.json
│       ├── Lead-Score-Engine.json
│       ├── RAG-Ingestion-Pipeline.json
│       ├── Nyra-Reels-Pipeline.json
│       ├── Nyra-Posts-Pipeline.json
│       ├── Nyra-Ads-Sync.json
│       ├── Alfred-Report-Daily.json
│       ├── Daily-Summary.json
│       └── Handoff-Chatwoot.json
│
└── docs/
    ├── architecture/
    │   └── master.md
    ├── prd/
    └── ops/
        ├── sop-update-prompt.md
        ├── sop-check-logs.md
        ├── sop-handoff-manual.md
        └── go-live-checklist.md
```

---

## 5. Agentes e Skills

### 5.1 Visão geral dos agentes

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │    BRANN     │  │    ALFRED    │  │     NYRA     │         │
│  │  Atendimento │  │  Operações   │  │  Conteúdo    │         │
│  │  WhatsApp    │  │  Dados / BI  │  │  Mídia / Ads │         │
│  │  via n8n     │  │  via n8n     │  │  via n8n     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    COMMAND                              │   │
│  │          Assistente Unificado / Gestor                  │   │
│  │          Telegram + Web via OpenClaw                    │   │
│  │          Acesso a todos os agentes e skills             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Brann — Atendimento e Vendas

**Canal:** WhatsApp (Evolution API)  
**Orquestração:** n8n  
**Modelo:** gpt-4o (temperature 0.4)

**Responsabilidades:**
- Atendimento 24h em linguagem natural
- Qualificação por SPIN Selling (Situação → Problema → Implicação → Necessidade)
- Captura de lead (nome, telefone, intenção)
- Busca RAG na base documental do tenant
- Lead score em tempo real
- Handoff para humano (Chatwoot) com contexto completo
- Agendamento direto

**Tools disponíveis:**

| Tool | Trigger | Efeito |
|---|---|---|
| `search_knowledge` | Antes de responder sobre produto/serviço | RAG → injeta contexto |
| `create_lead` | Nome + telefone + intenção confirmados | Upsert contacts + lead_scores |
| `update_contact` | Dados novos durante a conversa | Update contacts |
| `fetch_catalog` | Pergunta sobre planos/preços/serviços | Chunks com tag catalog |
| `handoff_human` | Urgência / humano pedido / 2 falhas | Ticket Chatwoot + alerta operador |
| `schedule_appointment` | Lead aceita agendar | Insert appointments |

**Workflows n8n:**
```
WA-Brann-Atendimento.json   → fluxo principal de atendimento
Lead-Score-Engine.json       → pontuação após cada mensagem
Handoff-Chatwoot.json        → criação de ticket com contexto
RAG-Ingestion-Pipeline.json  → ingestão de documentos do tenant
```

---

### 5.3 Alfred — Operações e Dados

**Canal:** Dashboard / API interna  
**Orquestração:** n8n  
**Modelo:** gpt-4o (temperature 0.2)

**Responsabilidades:**
- SQL Agent read-only sobre banco do cliente
- Geração de relatórios operacionais e executivos
- Parsing e extração de campos de documentos e PDFs
- Monitoramento de métricas e filas
- Sync com ClickUp (tarefas e projetos)

**Tools disponíveis:**

| Tool | Descrição |
|---|---|
| `query_sql_readonly` | SQL read-only validado com limite de linhas |
| `generate_report` | Relatório estruturado em texto/markdown |
| `parse_pdf` | Extração de texto e campos de PDFs |
| `extract_document_fields` | Schema-guided field extraction |
| `clickup_create_task` | Criar tarefa no ClickUp do tenant |
| `clickup_list_tasks` | Listar tarefas por lista/status |

**Workflows n8n:**
```
Alfred-Report-Daily.json     → relatório diário automático
```

**Skills do Alfred:**
- `alfred-sql` → SQL Agent com validação e rate limit
- `alfred-reports` → Relatórios agendados e sob demanda

---

### 5.4 Nyra — Conteúdo, Mídia e Tráfego

**Canal:** Dashboard / n8n pipelines  
**Orquestração:** n8n  
**Modelo:** gpt-4o (temperature 0.7)

**Responsabilidades:**
- Criação de Reels e posts (roteiro, legenda, hashtags, CTA)
- Pipeline de conteúdo para múltiplos canais
- Gestão e análise de tráfego pago (Meta Ads, TikTok Ads, Google Ads)
- Calendário editorial
- Pesquisa de mercado e tendências
- Preparação de reuniões e briefs

#### Nyra — Pipeline de Reels e Posts

```
FLUXO: Nyra Reels Pipeline
─────────────────────────────────────────────────────

INPUT (via dashboard ou Command)
  tema / produto / objetivo / referências

  ↓
PESQUISA (Nyra + n8n)
  buscar tendências via TikTok API (trending sounds/hashtags)
  buscar performance de posts anteriores (Meta Graph API)
  buscar referências de conteúdo relevante

  ↓
BRIEFING (gpt-4o)
  gerar roteiro estruturado:
    hook (0–3s)
    desenvolvimento (3–25s)
    CTA (25–30s)
  gerar legenda com hashtags otimizadas por plataforma
  gerar variações A/B (2 versões de hook)

  ↓
GERAÇÃO DE ATIVOS
  Avatar/Narração → ElevenLabs (voz) + HeyGen (avatar IA)
  Apresentação   → Gamma AI (slides automáticos)
  Layout visual  → Blotato (social cards, thumbnails)
  Áudio         → sugestão de trilha via tendências TikTok

  ↓
APROVAÇÃO (dashboard)
  preview do roteiro + legenda
  [Aprovar] [Editar] [Regenerar]

  ↓
PUBLICAÇÃO (via Blotato ou API direta)
  Instagram Reels
  TikTok
  YouTube Shorts
  Facebook Reels
  Threads
  LinkedIn (versão adaptada)
  X (versão adaptada)

  ↓
ANÁLISE (D+1)
  buscar métricas via APIs de cada plataforma
  salvar em meta_metrics / tiktok_metrics / youtube_metrics
  exibir no dashboard Content
```

**Workflows n8n:**
```
Nyra-Reels-Pipeline.json    → pipeline completo de Reels
Nyra-Posts-Pipeline.json    → posts estáticos multi-plataforma
Nyra-Ads-Sync.json          → sync de métricas de ads
```

**Tools disponíveis:**

| Tool | API utilizada |
|---|---|
| `research_trends` | TikTok API + Meta Graph |
| `generate_script` | OpenAI gpt-4o |
| `generate_voice` | ElevenLabs API |
| `generate_avatar_video` | HeyGen API |
| `generate_presentation` | Gamma AI API |
| `generate_social_card` | Blotato API |
| `publish_content` | Blotato API (multi-canal) |
| `fetch_content_metrics` | Meta / TikTok / YouTube / LinkedIn |
| `manage_editorial_calendar` | Supabase (editorial_calendar) |
| `draft_ad_copy` | OpenAI gpt-4o |
| `fetch_ads_performance` | Meta Ads API + TikTok Ads API + Google Ads API |

**Skills do Nyra:**
- `nyra-reels` → Pipeline completo de Reels/Shorts
- `nyra-ads` → Gestão e análise de tráfego pago
- `nyra-editorial` → Calendário editorial + posting schedule

---

### 5.5 Command — Assistente Unificado / Gestor

**Canal:** Telegram (OpenClaw) + Webchat  
**Runtime:** OpenClaw (instância por tenant)  
**Modelo:** gpt-4o (temperature 0.4)

**Responsabilidades:**
- Interface conversacional unificada para o gestor do negócio
- Acesso a todos os agentes do tenant (Brann, Alfred, Nyra)
- Consulta à biblioteca RAG completa
- Ações com aprovação humana (publish, delete, send)
- LAPLACE routing: delegar subtarefas para o agente correto
- Auditoria completa de toda ação executada

**Casos de uso típicos (via Telegram):**
```
"Quantos leads quentes hoje?"
  → Alfred consulta lead_scores + metrics

"Cria um Reel sobre o lançamento do produto X"
  → Nyra inicia pipeline de Reels

"Como está a taxa de handoff esta semana?"
  → Alfred consulta vw_handoff_rate

"Pausa a campanha do Instagram"
  → Nyra chama Meta Ads API (com aprovação)

"Qual foi a última pergunta que não soube responder?"
  → Alfred consulta retrieval_logs com found=false

"Adiciona esse PDF na base do Brann"
  → Inicia ingestion_job via worker
```

**Tools disponíveis:**
Acesso a todas as tools de Brann, Alfred e Nyra, com policy mais restritiva — ações destrutivas sempre exigem confirmação explícita.

---

### 5.6 Resumo de agentes por canal e plano

| Agente | Canal | Plano mínimo | Orquestração |
|---|---|---|---|
| Brann | WhatsApp | Básico | n8n + Evolution API |
| Alfred | Dashboard / API | Avançado | n8n |
| Nyra | Dashboard / n8n | Avançado | n8n + APIs externas |
| Command | Telegram / Web | Futurista | OpenClaw |

---

## 6. Integrações

### 6.1 Arquitetura de integração

Todos os agentes falam entidades internas. As integrações fazem a tradução:

```
API EXTERNA          CONECTOR           ENTIDADE INTERNA
─────────────────────────────────────────────────────────
Meta Graph API    →  meta connector  →  contact / message / metric
Instagram API     →  meta connector  →  content_asset / metric
TikTok API        →  tiktok connector→  metric / trend
Google My Business→  google connector→  review / metric / location
YouTube Data API  →  google connector→  metric / content_asset
Shopify           →  shopify connector→  order / product / customer
ClickUp           →  clickup connector→  task / project
Google Drive      →  google connector→  knowledge_asset
Gmail             →  google connector→  knowledge_asset / message
Stripe            →  stripe connector→  subscription / payment
Evolution API     →  evolution conn  →  message / channel
OpenClaw          →  openclaw conn   →  session / command
```

### 6.2 Integrações por categoria

#### Canais de Atendimento

| Integração | Propósito | Autenticação | Plano |
|---|---|---|---|
| Evolution API | WhatsApp multi-instância | API Key | Básico+ |
| Chatwoot | Inbox humano + handoff | API Token | Básico+ |
| OpenClaw | Telegram / Webchat | Token por tenant | Futurista |
| Telegram Bot API | Notificações + Command | Bot Token | Futurista |

#### Redes Sociais e Conteúdo

| Integração | Propósito | Autenticação | Dados disponíveis |
|---|---|---|---|
| Meta Graph API | Instagram + Facebook | OAuth 2.0 | Alcance, impressões, engajamento, comentários, DMs |
| Instagram API | Posts, Reels, Stories | Meta OAuth | Insights por post, stories ativos, audience |
| Facebook API | Página, grupos, posts | Meta OAuth | Page insights, post performance |
| Threads API | Posts e engajamento | Meta OAuth | Impressões, likes, replies |
| TikTok API | Métricas e tendências | OAuth 2.0 | Views, shares, trending sounds, hashtags |
| YouTube Data API | Canal e vídeos | Google OAuth | Views, watch time, subscribers, comments |
| LinkedIn API | Página corporativa | OAuth 2.0 | Impressões, cliques, followers, posts |
| X (Twitter) API | Posts e menções | OAuth 2.0 | Impressões, engajamento, mentions |

#### Criação de Conteúdo

| Integração | Propósito | Como usa |
|---|---|---|
| Gamma AI | Apresentações automáticas | API → gerar slides de briefing/relatório |
| Blotato | Social cards + agendamento multi-canal | API → gerar imagens + publicar em todos os canais |
| ElevenLabs | Geração de voz IA | API → narração de Reels, áudio de conteúdo |
| HeyGen | Avatar IA em vídeo | API → vídeo com apresentador digital |
| Canva API (opcional) | Templates visuais | API → personalizar templates de marca |

#### Tráfego Pago

| Integração | Propósito | Dados disponíveis |
|---|---|---|
| Meta Ads API | Campanhas Facebook + Instagram | Impressões, cliques, CPC, ROAS, conversões |
| TikTok Ads API | Campanhas TikTok | Impressões, plays, CPA, ROAS |
| Google Ads API | Search + Display + YouTube Ads | CPC, CPA, conversões, quality score |

#### Negócio e Dados

| Integração | Propósito | Dados disponíveis |
|---|---|---|
| Google My Business | Presença local | Visualizações, cliques, avaliações, perguntas |
| Google Analytics 4 | Tráfego do site | Sessões, conversões, origem de tráfego |
| Google Drive / Docs | Base RAG | Documentos para indexação |
| Gmail | Base RAG + automações | E-mails para indexação |
| Google Calendar | Agendamentos | Eventos, disponibilidade |
| Shopify | E-commerce | Pedidos, produtos, clientes |
| Shopee | E-commerce BR | Pedidos, produtos |
| ClickUp | Gestão de tarefas | Tasks, projetos, status |
| Stripe | Billing da plataforma | Subscriptions, invoices, usage |

### 6.3 Padrão de conector (interface TypeScript)

```typescript
interface Connector {
  provider: string
  
  // OAuth
  connect(tenantId: string, authCode: string): Promise<Credentials>
  refresh(tenantId: string): Promise<Credentials>
  
  // Dados
  pull(tenantId: string, since?: Date): Promise<ExternalData[]>
  push(tenantId: string, data: InternalEntity): Promise<void>
  
  // Webhook
  handleWebhook(payload: unknown): Promise<void>
  
  // Normalização
  normalize(external: unknown): InternalEntity
}
```

### 6.4 Fluxo OAuth por provider

```
GOOGLE (GMB + Drive + YouTube + Ads)
  Scopes: business.manage, drive.readonly, youtube.readonly, adwords
  Callback: /api/oauth/google/callback
  Refresh: automático via worker-sync

META (Instagram + Facebook + Threads + Ads)
  Scopes: pages_show_list, instagram_basic, instagram_manage_insights,
          pages_messaging, ads_read, ads_management
  Token: long-lived (60 dias) + refresh automático
  Callback: /api/oauth/meta/callback

TIKTOK
  Scopes: user.info.basic, video.list, data.basic, ads.read
  Callback: /api/oauth/tiktok/callback

LINKEDIN
  Scopes: r_organization_social, r_ads_reporting
  Callback: /api/oauth/linkedin/callback

GOOGLE ADS
  Scopes: adwords
  Callback: parte do Google OAuth acima
```

### 6.5 Worker de sincronização

```
worker-sync executa por tenant:
  Meta metrics    → a cada 4h
  TikTok metrics  → a cada 6h
  YouTube metrics → a cada 6h
  LinkedIn metrics→ a cada 12h
  GMB metrics     → a cada 6h
  Google Analytics→ a cada 24h
  Shopify orders  → a cada 1h
  ClickUp tasks   → a cada 30min (webhook + polling)
  Google Drive    → a cada 24h (detectar novos docs para RAG)
```

---

## 7. Módulos Principais

### 7.1 Auth e Multi-Tenant

Supabase Auth com RLS. Toda query inclui `WHERE tenant_id = $tenant`.

```
Roles:
  owner    → tudo
  admin    → agents.* · knowledge.* · channels.* · billing.view
  operator → conversations.* · leads.* · handoff.*
  viewer   → dashboard.view · reports.view

Isolamento:
  RLS ativo em todas as tabelas sensíveis
  Secrets criptografados com pgcrypto antes de salvar
  Storage por prefixo: /{tenant_id}/...
  Workers usam service_role com tenant_id explícito
```

### 7.2 Agent Runtime

Fábrica de agentes. Controla execução, tools, policies e logs.

```typescript
// Fluxo de execução do runtime
async function executeAgent(event: InboundEvent): Promise<void> {
  const tenant = await resolveTenant(event)
  const session = await SessionManager.get(event.conversationId)
  const agent = await AgentResolver.pick(event.channel, tenant)
  await PolicyEngine.check(agent, event)
  const prompt = await PromptBuilder.build(agent, session, tenant)
  const response = await LLMClient.call(prompt, agent.tools)
  if (response.tool_calls) {
    for (const call of response.tool_calls) {
      const result = await ToolExecutor.run(call, tenant)
      session.injectToolResult(result)
    }
    return executeAgent({ ...event, reinject: true })
  }
  await ResponseFormatter.send(response, event.channel)
  await Metering.debit(tenant, response.usage)
  await ObservabilityLog.write(event, response)
}
```

### 7.3 RAG Core

Pipeline completo de ingestão e retrieval híbrido.

```
INGESTÃO (worker-ingestion):
  captura → extração → normalização → chunking (600 tokens, overlap 100)
  → embedding (text-embedding-3-small, batch 20) → pgvector → summary

RETRIEVAL (packages/rag):
  query → embed → vetorial (top-20) + lexical (top-20)
  → merge → filtros (tenant + roles + sensitivity)
  → rerank → top-k (5 Brann / 8 Alfred+Command)
  → contexto → retrieval_logs
```

### 7.4 Tool Registry

```typescript
// Toda tool registrada aqui antes de ser usada
interface Tool {
  name: string
  description: string       // lido pelo LLM para decisão de uso
  agents_allowed: string[]
  input_schema: JSONSchema
  output_schema: JSONSchema
  permissions: string[]
  timeout_ms: number
  retries: number
  read_only: boolean        // false = requer confirmação explícita
  log: boolean              // sempre true em produção
}
```

### 7.5 Billing e Entitlements

```
Camadas:
  1. Subscription Stripe  → plano mensal recorrente
  2. Add-ons oficiais     → skills Ginkgo ou pacotes de token
  3. Marketplace (fase 3) → skills comunidade com revshare 70/30

Fluxo de token:
  plan_refill → token_balances.balance += tokens_do_plano
  execução    → token_balances.balance -= tokens_consumidos
  compra      → token_transactions INSERT (type='purchase')
  overage     → bloquear (Básico) ou cobrar extra (Avançado+)

Entitlement check antes de qualquer operação premium:
  1. subscription.status = 'active'?
  2. plano inclui o módulo/skill?
  3. token_balances.balance > 0?
  → se não: 402 com payload de upgrade
```

### 7.6 Observabilidade

```
Logs → tool_executions + audit_logs (Supabase)
Dashboard → Metabase / Supabase Studio
Alertas → n8n → WhatsApp operador

Métricas críticas por tenant:
  custo_por_conversa     (meta: < R$ 0,50)
  latencia_media_ms      (meta: < 5.000)
  taxa_handoff_pct       (meta: < 20%)
  taxa_erro_pct          (meta: < 2%)
  rag_hit_rate_pct       (meta: > 80%)

Daily Summary: n8n cron 08h BRT →
  "📊 Ginkgo {data} | 💬 {msgs} | 👤 {leads} | 🔥 {hot} | R${custo}"
  → WhatsApp operador
```

---

## 8. Modelo de Dados

### 8.1 Lotes de migration (ordem de execução)

```
Lote 0  → Extensions (pgvector, pgcrypto, uuid-ossp)
Lote 1  → Platform Core (tenants, profiles, memberships, plan_limits, audit_logs)
Lote 2  → Leaf (channels, contacts, conversations, messages, lead_scores, appointments)
Lote 3  → RAG (knowledge_sources, knowledge_assets, knowledge_chunks, retrieval_logs, ingestion_jobs)
Lote 4  → Agents e Skills (agents, prompt_versions, tool_registry, tool_executions, skills, tenant_skills)
Lote 5  → Observabilidade (incidents, usage_events, metering_summaries + views)
Lote 6  → Billing (subscriptions, token_balances, token_transactions, invoices)
Lote 7  → Integrações (integrations, meta_metrics, gmb_metrics, tiktok_metrics, youtube_metrics)
Lote 8  → Marketplace (skill_versions, skill_permissions, skill_reviews — schema preparatório)
```

### 8.2 Entidades principais

**Platform Core**
```
tenants            id · name · slug · plan · status · timezone · config_json
profiles           id (→auth.users) · tenant_id · role · name · email
memberships        tenant_id · profile_id · role
plan_limits        plan PK · max_messages · max_docs · max_agents · rag_enabled
audit_logs         tenant_id · actor · event_type · payload_json · ip
```

**Leaf (Atendimento)**
```
channels           tenant_id · type · config_json · status
contacts           tenant_id · phone UNIQUE · name · email · tags
conversations      tenant_id · contact_id · channel_id · assigned_agent · status
messages           conversation_id · sender_type · content · content_type
lead_scores        contact_id UNIQUE · score · tier · reason_json
appointments       contact_id · datetime · status · notes
```

**RAG**
```
knowledge_sources  tenant_id · type · config_json · sync_enabled
knowledge_assets   tenant_id · source_id · type · title · file_url · status
knowledge_chunks   tenant_id · asset_id · chunk_text · embedding VECTOR(1536) · metadata_json
knowledge_summaries tenant_id · asset_id · summary_text · key_topics
retrieval_logs     tenant_id · agent · query_text · top_chunks · score_avg
ingestion_jobs     tenant_id · asset_id · status · stage · attempts
```

**Agents e Skills**
```
agents             tenant_id · type · enabled · model · config_json · tools_enabled · prompt_version
prompt_versions    tenant_id · agent_type · version · content · active
tool_registry      name UNIQUE · description · agents_allowed · input_schema · read_only
tool_executions    tenant_id · agent_type · tool_name · conversation_id · success · latency_ms · tokens_used
skills             slug UNIQUE · name · category · author · manifest_json · requires_plan · price_brl
tenant_skills      tenant_id · skill_id UNIQUE per tenant · status · config_json
skill_usage_events tenant_id · skill_id · event_type · tokens_used
```

**Observabilidade**
```
incidents          tenant_id · severity · category · description · resolved
usage_events       tenant_id · event_type · quantity · unit · agent
metering_summaries tenant_id · period UNIQUE · messages_count · tokens_used · cost_usd
```

**Billing**
```
subscriptions      tenant_id UNIQUE · stripe_customer_id · stripe_subscription_id · plan · status
token_balances     tenant_id PK · balance · used_period · refill_at
token_transactions tenant_id · type · amount · balance_after · source_id
invoices           tenant_id · stripe_invoice_id · amount_brl · period · status
```

**Integrações**
```
integrations       tenant_id · provider UNIQUE · access_token_enc · refresh_token_enc · metadata_json
meta_metrics       tenant_id · date · account_id · impressions · reach · top_posts
tiktok_metrics     tenant_id · date · account_id · views · shares · trending_sounds
youtube_metrics    tenant_id · date · channel_id · views · watch_time · subscribers
gmb_metrics        tenant_id · date · location_id · views_maps · clicks_call · new_reviews
ads_metrics        tenant_id · date · platform · campaign_id · impressions · clicks · spend · roas
editorial_calendar tenant_id · scheduled_at · platform · content_type · status · asset_id
```

**Total: 40+ tabelas**

---

## 9. Skill SDK — Criação de Skills Customizadas

### 9.1 O que é uma skill

Uma skill é um pacote instalável que estende as capacidades de um agente.

```
skill/
  manifest.json      → declaração da skill
  prompts/           → instruções adicionais por agente
  tools/             → tools TypeScript
  workflows/         → n8n workflows exportados
  ui/                → extensões React para o dashboard
  docs/              → documentação
```

### 9.2 Manifest

```json
{
  "id": "minha-skill",
  "name": "Minha Skill",
  "version": "1.0.0",
  "author": "dev@empresa.com",
  "category": "ecommerce | marketing | ops | content | custom",
  "agents": ["brann", "alfred", "nyra", "command"],
  "requires": {
    "integrations": ["shopify"],
    "plan": "avancado"
  },
  "permissions": ["orders.read", "reports.write"],
  "tools": ["minha_tool_1", "minha_tool_2"],
  "billing": {
    "model": "subscription | one_time | usage",
    "price_brl": 49,
    "trial_days": 7
  },
  "revshare": {
    "developer": 0.70,
    "platform": 0.30
  }
}
```

### 9.3 Criando uma tool de skill

```typescript
// skills/minha-skill/tools/minha_tool_1.ts
import { SkillTool, ToolContext } from '@ginkgo/skill-sdk'

export const minhaTool: SkillTool = {
  name: 'minha_tool_1',
  description: 'Descrição clara do que faz e quando usar (lida pelo LLM)',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    },
    required: ['query']
  },
  readOnly: true,
  
  async execute(input: { query: string }, ctx: ToolContext) {
    // ctx.tenantId garante isolamento
    // ctx.supabase é o client com tenant_id injetado
    // ctx.log registra em tool_executions automaticamente
    
    const result = await ctx.supabase
      .from('minhas_entidades')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .ilike('nome', `%${input.query}%`)
    
    return { items: result.data }
  }
}
```

### 9.4 Regras obrigatórias para skills

```
✅ Usar SDK da plataforma (@ginkgo/skill-sdk)
✅ Declarar todas as permissões no manifest.json
✅ Respeitar ctx.tenantId em toda query
✅ Nunca acessar Supabase diretamente (usar ctx.supabase)
✅ Nunca acessar secrets sem ser via ctx.secrets

❌ Queries sem filtro de tenant_id
❌ Acesso direto ao Postgres
❌ Bypass de policies do Tool Registry
❌ Coleta de dados cross-tenant
❌ Requests para domínios não declarados no manifest
```

### 9.5 Skills oficiais da Ginkgo

| Skill | Agente | Plano | Propósito |
|---|---|---|---|
| `leaf-core` | Brann | Básico | Atendimento + lead capture + handoff |
| `alfred-sql` | Alfred | Avançado | SQL Agent read-only |
| `alfred-reports` | Alfred | Avançado | Relatórios agendados |
| `nyra-reels` | Nyra | Avançado | Pipeline de Reels/Shorts |
| `nyra-ads` | Nyra | Avançado | Gestão e análise de tráfego pago |
| `nyra-editorial` | Nyra | Avançado | Calendário editorial + publicação |
| `command-core` | Command | Futurista | Assistente unificado via OpenClaw |

---

## 10. Guia de Instalação e Setup

### Pré-requisitos

- Docker e Docker Compose
- pnpm (`npm install -g pnpm`)
- Supabase CLI (`npm install -g supabase`)
- Conta Supabase, Stripe, OpenAI
- VPS com 4GB RAM mínimo (Hostinger KVM ou similar)

### 1. Clonar o repositório

```bash
gh repo clone ginkgosystems/ginkgo-leaf
cd ginkgo-leaf
```

### 2. Configurar ambiente

```bash
cp .env.example .env
# Preencher variáveis — ver seção 11
```

### 3. Infraestrutura local (Docker)

```bash
cd infra/docker
docker-compose up -d
# Serviços: n8n, Evolution API, Chatwoot, Redis, Traefik
```

### 4. Banco de dados

```bash
supabase login
supabase link --project-ref <project-id>
supabase db push  # aplica todos os lotes de migration em ordem
```

### 5. Seed do Tenant Zero

```bash
# Após migrations aplicadas
psql $DATABASE_URL -f packages/db/seed/tenant_zero.sql
```

### 6. Instalar dependências e rodar

```bash
cd ../..
pnpm install
pnpm dev
```

### 7. Importar workflows n8n

```bash
# Acessar n8n.localhost:5678
# Settings → Import → selecionar arquivos de n8n/workflows/
# Ativar os workflows na ordem:
#   1. WA-Brann-Atendimento
#   2. Lead-Score-Engine
#   3. Handoff-Chatwoot
#   4. RAG-Ingestion-Pipeline
#   5. Daily-Summary
```

### 8. Validação do ambiente

```
Dashboard Web: http://localhost:3000
API Core:      http://localhost:3001
n8n:           http://localhost:5678
Chatwoot:      http://localhost:3002
Evolution:     http://localhost:8080
```

### 9. Deploy em produção

```bash
# DNS: criar registros A no Cloudflare
#   app.ginkgosystems.tech  → IP da VPS
#   n8n.ginkgosystems.tech  → IP da VPS
#   evolution.ginkgosystems.tech → IP da VPS
#   chatwoot.ginkgosystems.tech  → IP da VPS

# VPS
bash infra/scripts/deploy.sh

# Frontend
vercel deploy --prod  # ou push para main (auto-deploy)

# Backend
railway up  # ou push para main
```

---

## 11. Variáveis de Ambiente

```bash
# ─── SUPABASE ───────────────────────────────────────────────────────
SUPABASE_URL=                        # https://xxxx.supabase.co
SUPABASE_ANON_KEY=                   # chave pública (frontend)
SUPABASE_SERVICE_ROLE_KEY=           # chave privada (backend/workers)
NEXT_PUBLIC_SUPABASE_URL=            # = SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # = SUPABASE_ANON_KEY

# ─── OPENAI ─────────────────────────────────────────────────────────
OPENAI_API_KEY=
OPENAI_MODEL_DEFAULT=gpt-4o
OPENAI_MODEL_EMBEDDING=text-embedding-3-small

# ─── STRIPE ─────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # = STRIPE_PUBLISHABLE_KEY

# ─── EVOLUTION API (WHATSAPP) ───────────────────────────────────────
EVOLUTION_API_URL=https://evolution.ginkgosystems.tech
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_DEFAULT=ginkgo-zero

# ─── CHATWOOT ───────────────────────────────────────────────────────
CHATWOOT_URL=https://chatwoot.ginkgosystems.tech
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=1

# ─── OPENCLAW (COMMAND AGENT) ───────────────────────────────────────
OPENCLAW_URL=
OPENCLAW_MASTER_TOKEN=

# ─── REDIS ──────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── N8N ────────────────────────────────────────────────────────────
N8N_WEBHOOK_BASE_URL=https://n8n.ginkgosystems.tech
N8N_ENCRYPTION_KEY=                  # openssl rand -hex 32
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=

# ─── OPERACIONAL ────────────────────────────────────────────────────
OPERATOR_WHATSAPP=+5553991214817     # alertas de incidente
TENANT_ZERO_ID=f47ac10b-58cc-4372-a567-000000000000
WEBHOOK_SECRET=                      # validação de webhooks recebidos

# ─── META (INSTAGRAM / FACEBOOK / THREADS / ADS) ────────────────────
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=

# ─── GOOGLE (GMB / DRIVE / YOUTUBE / ADS) ───────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.ginkgosystems.tech/api/oauth/google/callback

# ─── TIKTOK ─────────────────────────────────────────────────────────
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://app.ginkgosystems.tech/api/oauth/tiktok/callback

# ─── LINKEDIN ───────────────────────────────────────────────────────
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# ─── CRIAÇÃO DE CONTEÚDO ────────────────────────────────────────────
ELEVENLABS_API_KEY=
HEYGEN_API_KEY=
GAMMA_API_KEY=
BLOTATO_API_KEY=

# ─── TRAEFIK / INFRA ────────────────────────────────────────────────
ACME_EMAIL=gabriel@ginkgosystems.tech
DOMAIN=ginkgosystems.tech

# ─── CHATWOOT DATABASE (Supabase pool) ──────────────────────────────
CHATWOOT_DATABASE_URL=               # postgresql://...supabase.co:5432/chatwoot
CHATWOOT_SECRET_KEY_BASE=            # openssl rand -hex 64

# ─── EVOLUTION DATABASE (Supabase pool) ─────────────────────────────
EVOLUTION_DATABASE_URL=              # postgresql://...supabase.co:5432/evolution
```

---

## 12. Observabilidade

### O que é logado em toda execução

```typescript
{
  tenant_id, agent, conversation_id,
  prompt_version, tools_used,
  input_tokens, output_tokens,
  latency_ms, cost_usd,
  rag_chunks_used, rag_scores,
  success, error, handoff
}
// → INSERT tool_executions
```

### Alertas

```
severity high   → WhatsApp imediato (< 5 min)
severity medium → WhatsApp (< 30 min)
severity low    → daily summary 08h BRT

Triggers high:
  OpenAI timeout após 3 retries
  Evolution desconectada
  token_balances.balance = 0 com assinatura ativa
  Supabase connection failure
```

### Dashboard de métricas

Acessível em `app.ginkgosystems.tech/dashboard`

```
KPIs em tempo real:
  conversas hoje | leads capturados | leads quentes (≥70)
  handoffs | tokens usados | custo estimado R$

Gráficos:
  atividade 7 dias (msgs / leads / handoffs)
  performance de conteúdo por plataforma
  spend vs ROAS de campanhas
  distribuição de score de leads

Feeds ao vivo:
  mensagens WhatsApp (Brann)
  mensagens Telegram (Command)
  alertas ativos
```

---

## 13. Roadmap de Expansão

### Fase 1 — MVP (meses 1–3)

```
✅ Platform Core (auth, tenants, billing)
✅ Leaf: Brann + WhatsApp + Chatwoot
✅ RAG v1 (PDF, markdown, FAQ)
✅ Dashboard com KPIs
✅ Stripe Checkout
✅ Tenant Zero
✅ Primeiro cliente pagante
```

### Fase 2 — Expansão (meses 3–6)

```
→ Alfred: SQL Agent + relatórios
→ Nyra: pipeline de Reels + posts
→ Nyra: gestão de tráfego pago
→ Command Assistant (OpenClaw + Telegram)
→ OAuth Meta + Google + TikTok
→ Dashboard Content (métricas de redes sociais)
→ Skills internas como módulos plugáveis
```

### Fase 3 — Plataforma (meses 6–12)

```
→ Skill Registry + Skill Installer
→ GitHub import para skills externas
→ Marketplace com monetização 70/30
→ RAG v2 (multimodal, Google Drive, áudio)
→ Integrações Shopify + ClickUp completas
→ Command com LAPLACE routing avançado
→ Stripe Connect para revshare de skills
```

### Fase 4 — Ecossistema (mês 12+)

```
→ RAG v3 (graph memory, CRAG, recomendações proativas)
→ Marketplace comunitário aberto
→ White-label para agências
→ Enterprise (banco dedicado por tenant)
→ Mobile app para Command
```

---

*Este documento é a referência técnica oficial do Ginkgo Leaf.*  
*Toda alteração de arquitetura deve ser versionada aqui antes de ser implementada.*

---

**Ginkgo AI Systems**  
`Ginkgo_Leaf.md v2.0.0 — Março 2026`
