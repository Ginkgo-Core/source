# Manual Definitivo para Construção de SaaS com o Ecossistema Ginkgo

> **Versão:** 1.0 | **Data:** Março 2026
> **Autores:** Manus AI & Gabriel, Ginkgo AI Systems
> **Filosofia:** Por fora, alfaiate. Por dentro, fábrica.

---

Este manual consolida a arquitetura, stack, processos e validações para a construção de aplicações SaaS multi-tenant e agent-first, com base no ecossistema e na filosofia da Ginkgo AI Systems. O objetivo é fornecer um guia de referência, técnico e auto-validado para acelerar o desenvolvimento e garantir a escalabilidade e manutenibilidade das soluções.

## Índice

1.  **Visão Geral e Modelo de Negócio**
2.  **Arquitetura de Referência**
3.  **Stack Tecnológica e Gems Recomendadas**
4.  **Estrutura do Projeto (Monorepo)**
5.  **Modelo de Dados e Schema SQL**
6.  **Guia de Setup e Deploy (Auto-Validado)**
7.  **Agentes e Skills**
8.  **Plano de Execução (90 Dias)**
9.  **Referências e Boas Práticas**

---



## 1. Visão Geral e Modelo de Negócio

A plataforma Ginkgo é um sistema operacional para automação inteligente, projetado como uma solução **multi-tenant** e **agent-first**. O core do modelo de negócio é estruturado em três pilares: uma **plataforma base** com mensalidade fixa, **add-ons** de agentes e skills com mensalidades próprias, e um sistema de **tokens** para consumo sob demanda.

### Estrutura de Pricing

O modelo de monetização foi desenhado para permitir uma entrada acessível e escalar conforme o valor gerado para o cliente.

| Camada | Modelo | Descrição |
| :--- | :--- | :--- |
| **Plataforma Base** | Assinatura Mensal | Acesso ao Dashboard, observabilidade, integrações e um feed de notícias via Perplexity AI. Planos (Starter, Business, Scale) variam em limites e funcionalidades. |
| **Add-ons de Agentes** | Assinatura Mensal | Módulos de agentes especializados como **Brann** (Atendimento WhatsApp), **Command** (Gestor via Telegram), e **Nyra** (Criação de Conteúdo). |
| **Add-ons de Skills** | Assinatura Mensal | Skills específicas que expandem as capacidades dos agentes, como `RAG Base`, `Shopify Intelligence` e `ClickUp Sync`. |
| **Tokens** | Consumo (Pay-as-you-go) | Tokens são debitados a cada execução de agente, com uma cota incluída no plano base e pacotes adicionais disponíveis para compra. |

### Jornada do Cliente

A jornada é projetada para demonstrar valor rapidamente e incentivar o upsell gradual:

1.  **Trial (7 dias):** O cliente conecta suas contas (Instagram, GMB, WhatsApp) e obtém valor imediato com um dashboard populado com seus próprios dados e um news feed personalizado, sem custo.
2.  **Conversão para Starter:** O primeiro passo pago, liberando mais integrações e funcionalidades.
3.  **Adoção de Agentes:** O cliente adiciona agentes como o **Brann**, que começa a automatizar o atendimento e a capturar leads, gerando um ROI claro.
4.  **Expansão com Skills:** Conforme a necessidade, o cliente adiciona skills para resolver dores específicas (e-commerce, gestão de projetos, etc.), aumentando o ticket médio.

> O objetivo é atingir um **ticket médio maduro entre R$ 500 e R$ 800/mês** por cliente, combinando o plano base com múltiplos add-ons.

---


## 2. Arquitetura de Referência

A arquitetura da plataforma é desenhada para ser modular, escalável e segura, separando as responsabilidades em camadas bem definidas. O fluxo de dados vai desde a interface do cliente, passa por uma camada de borda para segurança, atinge o backend e seus serviços, e se conecta a um data layer robusto e a serviços externos.

### Diagrama Macro da Arquitetura

O diagrama a seguir ilustra a interação entre os principais componentes do sistema.

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
│  Evolution API, Stripe, OpenAI, Meta/Google APIs, Chatwoot, etc.      │
└───────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Execução de Mensagem

O processamento de uma mensagem de um canal de cliente (ex: WhatsApp) segue um fluxo orquestrado para garantir consistência, segurança e observabilidade.

1.  **Recepção:** A mensagem chega no `Webhook Gateway`, que identifica o `tenant_id` e o canal de origem.
2.  **Sessão e Contexto:** O `Session Manager` carrega o histórico da conversa.
3.  **Resolução do Agente:** O `Agent Resolver` determina qual agente (Brann, Alfred, etc.) deve tratar a mensagem.
4.  **Políticas:** O `Policy Check` valida se o agente tem permissão para executar a ação no contexto do plano do tenant.
5.  **Construção do Prompt:** O `Prompt Builder` monta o prompt final, injetando o system prompt, o histórico da conversa, chunks de conhecimento do RAG e as especificações das `Tools` disponíveis.
6.  **Chamada LLM:** Uma chamada é feita para o LLM (ex: OpenAI GPT-4o) com o prompt construído.
7.  **Despacho de Tool:** Se o LLM decidir usar uma ferramenta (`finish_reason: tool_calls`), o `Tool Dispatcher` a invoca.
8.  **Execução da Tool:** O `Tool Executor` executa a função da ferramenta (ex: buscar no banco, chamar uma API externa) e registra a execução.
9.  **Formatação e Envio:** A resposta é formatada para o canal de destino e enviada.
10. **Metering e Log:** O consumo de tokens é debitado da conta do tenant e um log completo de observabilidade é gerado (latência, custo, etc.).

---


## 3. Stack Tecnológica e Gems Recomendadas

A seleção de tecnologias para a plataforma Ginkgo prioriza ecossistemas maduros, produtividade do desenvolvedor, escalabilidade e uma forte base em open source. A tabela abaixo detalha a stack por camada e inclui "Gems" — projetos de código aberto altamente recomendados e validados pela comunidade.

### Stack por Camada

| Camada | Tecnologia Principal | Propósito e Justificativa |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui | Construção do dashboard multi-tenant, UI de onboarding e portal de billing. Next.js oferece SSR e uma excelente DX. |
| **Backend (API Core)** | Fastify, TypeScript | API de alta performance para os serviços centrais, escolhido por sua velocidade e baixo overhead. |
| **Banco de Dados** | Supabase (Postgres) | Solução completa para banco de dados relacional, autenticação, Row Level Security (RLS) e armazenamento de arquivos. |
| **Banco Vetorial** | pgvector (em Supabase) | Armazenamento e busca de embeddings para o sistema de Retrieval-Augmented Generation (RAG). |
| **Cache e Filas** | Redis | Gerenciamento de sessões, rate limiting, processamento de jobs assíncronos e cache de dados. |
| **Orquestração** | n8n (self-hosted) | Motor para os workflows dos agentes, automações complexas e a "cola" que une diferentes serviços. |
| **Canal WhatsApp** | Evolution API | Conector robusto e multi-instância para a API do WhatsApp, permitindo escalar o atendimento. |
| **Inbox Humano** | Chatwoot | Plataforma de handoff para atendimento humano, com histórico de conversas e SLA. |
| **Assistente Unificado** | OpenClaw | Agente de comando para operadores via Telegram e Webchat, orquestrando outros agentes e ferramentas. |
| **Billing** | Stripe | Processamento de assinaturas, cobrança por uso (tokens) e futuro marketplace de skills. |
| **LLM Principal** | OpenAI GPT-4o | Modelo de linguagem de ponta para os agentes, com forte capacidade de function calling. |
| **Deploy (Infra)** | Docker, Traefik | Conteinerização dos serviços para desenvolvimento e produção, com Traefik gerenciando o roteamento e SSL. |
| **Hospedagem** | Vercel (Frontend), Railway / VPS (Backend) | Combinação otimizada para deploy de aplicações Next.js e serviços conteinerizados. |

### Gems do GitHub — Ferramentas Recomendadas

A filosofia "não reinvente a roda" é central. Os projetos abaixo são soluções de alta qualidade e alinhadas à nossa stack, recomendadas para acelerar o desenvolvimento.

| Categoria | Gem Recomendada | Repositório | Por que usar? |
| :--- | :--- | :--- | :--- |
| **n8n Self-Hosting** | `AiratTop/n8n-self-hosted` | [github.com/AiratTop/n8n-self-hosted](https://github.com/AiratTop/n8n-self-hosted) | Um template Docker Compose production-ready para n8n, incluindo Caddy para HTTPS automático, configuração de workers e scripts de backup. Acelera drasticamente o setup seguro. |
| **Evolution API** | `EvolutionAPI/evolution-api` | [github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api) | A implementação de referência da API. Essencial para entender todas as funcionalidades, webhooks e a gestão de múltiplas instâncias do WhatsApp. |
| **Chatwoot** | `chatwoot/chatwoot` | [github.com/chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | A documentação oficial e o `docker-compose.production.yaml` são o ponto de partida canônico para um deploy self-hosted estável e seguro. |
| **Boilerplate SaaS** | `rcrdk/nextjs-fastify-saas-rbac` | [github.com/rcrdk/nextjs-fastify-saas-rbac](https://github.com/rcrdk/nextjs-fastify-saas-rbac) | Um boilerplate que une Next.js e Fastify com multi-tenancy e RBAC, servindo como uma excelente referência para a estrutura inicial do nosso `API Core` e `apps/web`. |
| **Supabase Multi-Tenancy** | `vvalchev/supabase-multitenancy-rbac` | [github.com/vvalchev/supabase-multitenancy-rbac](https://github.com/vvalchev/supabase-multitenancy-rbac) | Um template fundamental para implementar multi-tenancy com Role-Based Security em Supabase, alinhado com nosso modelo de dados e políticas de RLS. |
| **RAG com pgvector** | `encore.dev/articles/how-to-build-rag-pipeline` | [Encore Blog](https://encore.dev/articles/how-to-build-rag-pipeline) | Um guia passo a passo detalhado para construir um pipeline de RAG com TypeScript e pgvector, servindo como base para nosso `rag-worker`. |

---


## 4. Estrutura do Projeto (Monorepo)

Para gerenciar a complexidade e promover o reuso de código, o projeto é organizado em um **monorepo** gerenciado com `pnpm workspaces`. Essa abordagem permite que diferentes aplicações (frontend, backend, workers) e pacotes compartilhados (tipos, schemas, helpers) coexistam no mesmo repositório, simplificando o gerenciamento de dependências e a consistência do código.

### Estrutura de Diretórios

```
/ginkgo-leaf
├── apps/
│   ├── web/                  # Dashboard Next.js (Vercel)
│   │   ├── app/              # App Router
│   │   ├── components/
│   │   └── ...
│   ├── api/                  # API Core Fastify (Railway/VPS)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── ...
│   └── workers/              # Workers assíncronos (BullMQ, Railway/VPS)
│       ├── src/
│       │   ├── ingestion-worker.ts
│       │   ├── sync-worker.ts
│       │   └── ...
│
├── packages/
│   ├── ui/                   # Componentes React compartilhados (shadcn/ui)
│   ├── config/
│   │   ├── eslint-preset.js  # Configuração do ESLint
│   │   └── tsconfig/
│   │       ├── base.json     # TSConfig base
│   │       └── ...
│   ├── db/                   # Schema e cliente do banco de dados (Drizzle ORM)
│   │   ├── schema.ts
│   │   └── index.ts
│   └── shared-types/         # Tipos e interfaces TypeScript compartilhados
│       └── index.ts
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.production.yml
│   │   └── traefik/
│   │       └── traefik.yml
│   └── supabase/
│       └── migrations/       # Migrações do schema SQL do Supabase
│
├── .eslintrc.js
├── .gitignore
├── package.json              # Raiz do workspace pnpm
├── pnpm-workspace.yaml
└── tsconfig.json
```

### Princípios da Estrutura

*   **`apps/`**: Contém as aplicações executáveis. Cada subdiretório é uma unidade de deploy independente.
    *   `web`: A interface do usuário (dashboard) que será hospedada na Vercel.
    *   `api`: O backend principal que centraliza a lógica de negócio.
    *   `workers`: Processos de longa duração que rodam em background para tarefas assíncronas.
*   **`packages/`**: Contém pacotes de código compartilhados entre as aplicações.
    *   `ui`: Componentes React reutilizáveis para manter a consistência visual.
    *   `config`: Configurações centralizadas de `ESLint` e `TypeScript` para garantir a qualidade do código.
    *   `db`: Define o schema do banco de dados com Drizzle ORM, permitindo que a API e os workers acessem os dados de forma segura e tipada.
    *   `shared-types`: Centraliza as definições de tipos TypeScript, evitando duplicação e inconsistências entre o frontend e o backend.
*   **`infra/`**: Contém a configuração de infraestrutura como código.
    *   `docker`: Arquivos Docker Compose para orquestrar os serviços (n8n, Evolution, Chatwoot, etc.) em ambiente de desenvolvimento e produção.
    *   `supabase`: Migrações do banco de dados, garantindo que o schema evolua de forma controlada e versionada.

---


## 5. Modelo de Dados e Schema SQL

O modelo de dados é a espinha dorsal da plataforma, projetado em Supabase (Postgres) com uma abordagem de **schemas isolados** para organizar as responsabilidades e garantir a segurança com **Row Level Security (RLS)**. A seguir, uma visão consolidada das principais entidades, distribuídas por seus respectivos schemas.

### Visão Geral dos Schemas

| Schema | Responsabilidade Principal |
| :--- | :--- |
| `ginkgo` | Núcleo da plataforma: tenants, usuários, planos, billing e entidades canônicas. |
| `rag` | Sistema de RAG: fontes de conhecimento, assets, chunks e embeddings. |
| `leaf` | Agente de atendimento (Brann): canais, contatos, conversas e mensagens. |
| `command` | Agente de comando (OpenClaw): registro de ferramentas, sessões e políticas de execução. |
| `integrations` | Gerenciamento de contas e logs de sincronização com APIs externas. |

### Tabelas Principais (Core - `ginkgo` schema)

Estas tabelas formam a fundação multi-tenant da plataforma.

| Tabela | Descrição | Campos Chave |
| :--- | :--- | :--- |
| `tenants` | Representa uma organização cliente. Isola todos os outros dados. | `id`, `slug`, `name`, `status` |
| `profiles` | Espelho dos usuários do `auth.users` do Supabase, com metadados adicionais. | `id`, `auth_user_id`, `email`, `full_name` |
| `memberships` | Tabela de junção que associa um `profile` a um `tenant` com uma `role`. | `tenant_id`, `profile_id`, `role` (`owner`, `admin`, `operator`) |
| `subscriptions` | Gerencia as assinaturas dos tenants aos planos. | `tenant_id`, `plan_id`, `status`, `stripe_subscription_id` |
| `entitlements` | Associa um tenant a uma `skill` (add-on) que ele adquiriu. | `tenant_id`, `skill_key`, `status` |

### Tabelas do RAG (`rag` schema)

Estrutura para a memória empresarial de cada tenant.

| Tabela | Descrição | Campos Chave |
| :--- | :--- | :--- |
| `knowledge_sources` | Fontes de dados para indexação (ex: pasta no Google Drive, upload). | `tenant_id`, `name`, `source_type`, `config` |
| `knowledge_assets` | Um documento, imagem ou URL individual indexado. | `tenant_id`, `source_id`, `title`, `status`, `storage_path` |
| `knowledge_chunks` | Fragmentos de texto extraídos de um `asset`. | `tenant_id`, `asset_id`, `content`, `chunk_index` |
| `knowledge_embeddings` | Vetor de embedding para cada `chunk`, usado na busca semântica. | `tenant_id`, `chunk_id`, `embedding` (vetor), `model` |

### Tabelas do Atendimento (`leaf` schema)

Modelo de dados para o agente de atendimento Brann.

| Tabela | Descrição | Campos Chave |
| :--- | :--- | :--- |
| `channels` | Canais de comunicação configurados (ex: um número de WhatsApp). | `tenant_id`, `channel_type`, `external_id`, `status` |
| `contacts` | Um cliente final que interagiu através de um canal. | `tenant_id`, `name`, `phone`, `email`, `channel_ids` |
| `conversations` | Uma sessão de atendimento com um `contact` em um `channel`. | `tenant_id`, `contact_id`, `channel_id`, `status`, `sales_phase` |
| `messages` | Uma mensagem individual dentro de uma `conversation`. | `conversation_id`, `direction`, `sender_type`, `text`, `media_url` |

### Tabelas do Agente de Comando (`command` schema)

Estrutura que habilita o assistente unificado OpenClaw.

| Tabela | Descrição | Campos Chave |
| :--- | :--- | :--- |
| `tool_registry` | Catálogo de todas as ferramentas que o OpenClaw pode executar. | `name`, `description`, `category`, `required_skill`, `input_schema` |
| `runtime_policies` | Regras que determinam se uma `tool` pode ser executada por uma `role`. | `tool_name`, `role`, `action` (`allow`, `deny`, `require_approval`) |
| `sessions` | Uma sessão de interação de um operador com o OpenClaw. | `tenant_id`, `profile_id`, `channel`, `status` |
| `tool_calls` | Log de cada tentativa de execução de uma ferramenta. | `session_id`, `tool_name`, `status`, `input_args`, `output` |

> **Segurança:** Todas as tabelas contêm um campo `tenant_id` e são protegidas por políticas de **Row Level Security (RLS)**, garantindo que um usuário só possa acessar os dados do seu próprio tenant.

---


## 6. Guia de Setup e Deploy (Auto-Validado)

### 6.1 Pré-requisitos

```bash
# Verificar instalações
docker --version          # >= 24
docker compose version    # >= 2.20
node --version            # >= 20
pnpm --version            # >= 9
supabase --version        # >= 1.150
```

Contas necessárias antes de começar:
- Supabase (cloud) — criar projeto antes do primeiro deploy
- Stripe — criar conta e produtos antes de rodar seed
- OpenAI — chave de API disponível
- Cloudflare — domínio apontado para IP da VPS

---

### 6.2 Setup Local (Desenvolvimento)

**Passo 1 — Clonar e instalar**

```bash
git clone https://github.com/ginkgosystems/ginkgo-leaf
cd ginkgo-leaf
pnpm install
```

**Passo 2 — Variáveis de ambiente**

```bash
cp .env.example .env
# Preencher obrigatórias P1 (ver ENV-VARIABLES-GUIDE.md)
# Mínimo para rodar local:
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#   OPENAI_API_KEY
#   REDIS_URL=redis://localhost:6379
```

**Passo 3 — Subir serviços locais (Docker)**

```bash
cd infra/docker
docker compose up -d
# Serviços: n8n, Evolution API, Chatwoot, Redis, Traefik
```

**Passo 4 — Banco de dados**

```bash
# Conectar ao projeto Supabase
supabase login
supabase link --project-ref <project-id>

# Aplicar todas as migrations em ordem
supabase db push

# Executar seed do Tenant Zero
psql $SUPABASE_DB_URL -f packages/db/seed/tenant_zero.sql
```

**Passo 5 — Gerar tipos TypeScript do banco**

```bash
# Gerar tipos a partir do schema do Supabase
supabase gen types typescript --linked > packages/db/types/database.types.ts

# Usar nos serviços:
# import type { Database } from '@ginkgo/db/types/database.types'
# const supabase = createClient<Database>(url, key)
```

**Passo 6 — Rodar aplicações**

```bash
# Rodar web + api simultaneamente
pnpm dev

# Ou individualmente:
pnpm --filter web dev      # http://localhost:3000
pnpm --filter api dev      # http://localhost:3001
```

**Validação do ambiente local:**

```bash
# API respondendo
curl http://localhost:3001/health
# Esperado: {"status":"ok","timestamp":"..."}

# Banco conectado
curl http://localhost:3001/health/db
# Esperado: {"status":"ok","tables":38}

# n8n acessível
open http://localhost:5678

# Redis conectado
docker compose exec redis redis-cli ping
# Esperado: PONG
```

---

### 6.3 Setup de Produção (VPS + Vercel + Railway)

**Topologia de produção:**

```
Cloudflare DNS
  ├── app.ginkgosystems.tech    → Vercel (apps/web)
  ├── api.ginkgosystems.tech    → Railway (apps/api)
  ├── n8n.ginkgosystems.tech    → VPS Docker
  ├── evolution.ginkgosystems.tech → VPS Docker
  └── chatwoot.ginkgosystems.tech  → VPS Docker

Supabase Cloud  → banco, auth, storage, pgvector
Redis           → Railway Managed ou Upstash
Stripe          → billing (externo)
```

**Deploy VPS (Hostinger KVM 4 — mín. 4GB RAM)**

```bash
# 1. Criar registros A no Cloudflare para todos os subdomínios
# 2. Aguardar propagação DNS
dig +short n8n.ginkgosystems.tech  # deve retornar IP da VPS

# 3. Na VPS:
git clone https://github.com/ginkgosystems/ginkgo-leaf
cd ginkgo-leaf/infra/docker
cp .env.example .env && nano .env

# 4. Primeira execução: migrations Chatwoot
docker compose run --rm chatwoot bundle exec rails db:chatwoot_prepare

# 5. Deploy
bash deploy.sh

# 6. Validar
curl -s -o /dev/null -w "%<{http_code}>" https://n8n.ginkgosystems.tech/healthz
# Esperado: 200
```

**Deploy Frontend (Vercel)**

```bash
# Via CLI
cd apps/web
vercel deploy --prod

# Ou via integração GitHub:
# Vercel → Import Project → ginkgo-leaf → Root: apps/web
# Build command: pnpm build
# Output: .next
```

Variáveis no painel Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

**Deploy Backend (Railway)**

```bash
# Via CLI
cd apps/api
railway up

# Ou via GitHub:
# Railway → New Project → Deploy from GitHub → Root: apps/api
```

---

### 6.4 Pipeline de CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint

  migrate:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --linked
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-web:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-api:
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

### 6.5 Scripts de Manutenção

```bash
# Regenerar tipos TypeScript após migration
pnpm db:types

# Aplicar nova migration
supabase db push

# Rollback de prompt de agente
bash infra/scripts/rollback-prompt.sh brann <tenant_slug> <version>

# Provisionar novo cliente
bash infra/scripts/provision-tenant.sh \
  "Nome do Cliente" business "+5511999999999" "+5511888888888"

# Indexar documento na base RAG
bash infra/scripts/ingest-doc.sh \
  <tenant_id> "FAQ do Cliente" text "$(cat faq.md)"

# Testar qualidade do RAG
bash infra/scripts/rag-quality-test.sh <tenant_id>

# Backup manual do banco
supabase db dump --linked -f backup-$(date +%Y%m%d).sql
```

---

### 6.6 Checklist Auto-Validado — Go-Live

Execute e marque cada item antes de liberar cliente externo:

```
INFRAESTRUTURA
[ ] DNS propagado para todos os subdomínios
[ ] SSL ativo em todos os subdomínios (padlock no browser)
[ ] docker compose ps — todos os containers healthy/running
[ ] curl https://n8n.ginkgosystems.tech/healthz → 200

BANCO
[ ] supabase/check-schema.sql retorna 38+ tabelas
[ ] Tenant Zero inserido e validado
[ ] RLS: query com tenant falso retorna 0 rows
[ ] Índice HNSW em knowledge_chunks criado

AGENTE BRANN
[ ] Mensagem no WhatsApp → resposta em < 5s
[ ] tool_executions logado após cada execução
[ ] Lead criado após qualificação mínima
[ ] Handoff chegando no Chatwoot com resumo
[ ] Alerta de lead quente chegando ao operador

RAG
[ ] FAQ e catálogo indexados (20+ chunks)
[ ] rag-quality-test.sh → 9+/10 perguntas passando
[ ] retrieval_logs populado com scores > 0.70

BILLING
[ ] Stripe Checkout funcionando (modo test)
[ ] Webhook stripe → subscriptions atualizado
[ ] Token balance refletindo plano

OBSERVABILIDADE
[ ] Daily summary chegando às 08h BRT
[ ] Incident handler testado (falha gera alerta)
[ ] Metabase ou Supabase Studio mostrando métricas

TENANT ZERO
[ ] 48h de operação estável sem intervenção manual
[ ] Zero incidentes severity=high sem resolução
```

---

## 7. Agentes e Skills

### 7.1 Arquitetura do Agent Runtime

Todo agente executa dentro do mesmo ciclo padronizado, independente do canal ou da complexidade da tarefa:

```
Input (webhook / API / cron)
  → Context Builder
      ↓ histórico + metadata do contato
  → RAG Retrieval
      ↓ top-k chunks relevantes
  → Prompt Builder
      ↓ system + contexto + RAG + tool specs
  → LLM Call (OpenAI gpt-4o)
      ↓ resposta ou tool_call
  → Tool Dispatcher
      ↓ executar tool se necessário
  → Tool Executor + Log
      ↓ resultado reinjetado ou resposta final
  → Response Formatter
      ↓ sanitizar por canal (WhatsApp ≠ Telegram)
  → Output (Evolution / OpenClaw / API)
  → Metering (debitar tokens)
  → Observability Log
```

**Garantias do runtime:**
- Toda tool call registra em `tool_executions` — sem exceção
- Prompt sempre carregado de `prompt_versions` — nunca hardcoded
- Tokens debitados de `token_balances` após cada execução
- Erro em qualquer nó dispara `incident_handler`

---

### 7.2 Brann — Atendimento Comercial

| Parâmetro | Valor |
|-----------|-------|
| Canal | WhatsApp via Evolution API |
| Orquestração | n8n (WA-Brann-Atendimento.json) |
| Modelo | gpt-4o · temperature 0.4 · max_tokens 800 |
| Contexto | Últimas 12 mensagens |
| RAG top-k | 5 chunks · threshold 0.70 |
| Add-on | +R$147/mês |

**Metodologia de vendas embutida no prompt (SPIN):**

```
1. Situação   → entender o negócio do lead
2. Problema   → identificar o que está travando
3. Implicação → mostrar o custo do problema
4. Necessidade → conectar à solução da Ginkgo
```

**Tools do Brann:**

| Tool | Trigger | Efeito |
|------|---------|--------|
| `search_knowledge` | Antes de responder sobre produto | Busca RAG + injeta contexto |
| `create_lead` | Nome + telefone + intenção confirmados | UPSERT contacts + lead_scores |
| `fetch_catalog` | Pergunta sobre planos/preços | SELECT chunks tag:catalog |
| `handoff_human` | Urgência / pedido / 2 falhas | Ticket Chatwoot + alerta |
| `schedule_appointment` | Lead aceita agendar | INSERT appointments |

**Lead Score Engine (paralelo ao atendimento):**

```
Trigger: após cada mensagem do agente

Pontuação:
  +20  forneceu nome próprio
  +20  forneceu telefone ou email
  +15  mencionou problema ou dificuldade
  +15  perguntou sobre preço ou plano
  +20  mencionou urgência ou prazo
  +10  3+ mensagens consecutivas
  -10  pediu para parar ou demonstrou desinteresse
  -15  última mensagem > 24h atrás

Ações por tier:
  hot  (≥70) → alerta operador + tag hot_lead + CTA demo
  warm (40–69) → tag warm_lead
  cold (<40)  → tag cold_lead
```

---

### 7.3 Alfred — Operações e Análise

| Parâmetro | Valor |
|-----------|-------|
| Canal | Dashboard / API interna |
| Orquestração | n8n (Alfred-Report-Daily.json) |
| Modelo | gpt-4o · temperature 0.2 |
| Regra crítica | READ-ONLY por padrão |
| Add-on | +R$147/mês |

**Capacidades:**
- SQL Agent read-only sobre banco do cliente
- Geração de relatórios operacionais e executivos
- Parsing e extração de campos de PDFs e planilhas
- Monitoramento de métricas e filas
- Integração com ClickUp (tasks e projetos)

**Política de segurança:**
```
can_read   = true
can_write  = requires_explicit_confirmation
destructive = never

Toda escrita exige:
  1. Confirmação explícita do operador
  2. Log em audit_logs com actor e payload
  3. Possibilidade de rollback documentada
```

---

### 7.4 Nyra — Conteúdo e Tráfego Pago

| Parâmetro | Valor |
|-----------|-------|
| Canal | Dashboard / n8n pipelines |
| Orquestração | n8n (Nyra-Reels-Pipeline.json + outros) |
| Modelo | gpt-4o · temperature 0.7 |
| Add-on | +R$197/mês |

**Pipeline de Reels:**

```
INPUT: tema / produto / objetivo / referências
  ↓
PESQUISA
  TikTok API → trending sounds + hashtags
  Meta Graph API → performance de posts anteriores
  ↓
BRIEFING (gpt-4o)
  Hook (0–3s) · Desenvolvimento (3–25s) · CTA (25–30s)
  Legenda com hashtags por plataforma
  2 variações A/B de hook
  ↓
GERAÇÃO DE ATIVOS
  ElevenLabs  → narração em voz IA
  HeyGen      → avatar IA em vídeo
  Gamma AI    → slides de apoio
  Blotato     → social cards + thumbnails
  ↓
APROVAÇÃO (dashboard)
  [Aprovar] [Editar] [Regenerar]
  ↓
PUBLICAÇÃO (via Blotato)
  Instagram Reels · TikTok · YouTube Shorts
  Facebook Reels · Threads · LinkedIn · X
  ↓
ANÁLISE (D+1)
  Métricas via APIs → dashboard Content
```

**Reciclagem de conteúdo longo:**

```
Conteúdo longo (post, artigo, palestra)
  → extração de insights (gpt-4o)
    → roteiros por formato
      → carrossel
      → vídeos curtos
        → stories
          → email marketing
```

---

### 7.5 Command — Assistente Unificado

| Parâmetro | Valor |
|-----------|-------|
| Canal | Telegram + Webchat |
| Runtime | OpenClaw (1 instância por tenant) |
| Modelo | gpt-4o · temperature 0.4 |
| Add-on | +R$197/mês (plano Scale) |

**Capacidades:**
- Acesso unificado a todos os agentes do tenant
- LAPLACE routing — delega subtarefas ao agente correto
- Consulta à biblioteca RAG completa do tenant
- Ações com aprovação humana (publish, delete, send)
- Auditoria completa de toda ação executada

**Exemplos de comandos via Telegram:**

```
"Quantos leads quentes hoje?"
  → Alfred consulta lead_scores

"Cria um Reel sobre o produto X"
  → Nyra inicia pipeline de Reels

"Como está a taxa de handoff esta semana?"
  → Alfred consulta vw_handoff_rate

"Pausa a campanha do Instagram"
  → Nyra chama Meta Ads API (com aprovação)

"Adiciona esse PDF na base do Brann"
  → worker-ingestion via ingest-doc.sh
```

---

### 7.6 Skills — SDK e Marketplace

**Estrutura de uma skill:**

```
skill-package/
  manifest.json     → id, version, author, permissions, billing
  prompts/          → instruções adicionais por agente
  tools/            → implementações TypeScript
  workflows/        → n8n workflows exportados
  ui/               → extensões React para o dashboard
  docs/             → README e setup guide
```

**Manifest mínimo:**

```json
{
  "id": "shopify-analytics",
  "name": "Shopify Analytics",
  "version": "1.0.0",
  "author": "dev@empresa.com",
  "category": "ecommerce",
  "agents": ["alfred", "command"],
  "requires": {
    "integrations": ["shopify"],
    "plan": "business"
  },
  "permissions": ["orders.read", "reports.write"],
  "billing": {
    "model": "subscription",
    "price_brl": 49,
    "trial_days": 7
  },
  "revshare": {
    "developer": 0.70,
    "platform": 0.30
  }
}
```

**Skills oficiais disponíveis (P1/P2):**

| Skill | Agente | Plano mínimo | Preço |
|-------|--------|--------------|-------|
| `leaf-core` | Brann | Starter | Incluso |
| `alfred-sql` | Alfred | Business | Incluso |
| `alfred-reports` | Alfred | Business | Incluso |
| `nyra-reels` | Nyra | Business | Incluso |
| `nyra-ads` | Nyra | Business | Incluso |
| `command-core` | Command | Scale | Incluso |
| `shopify-intelligence` | Alfred | Business | +R$49/mês |
| `clickup-sync` | Alfred | Business | +R$29/mês |
| `google-ads-manager` | Nyra | Business | +R$79/mês |
| `meta-ads-manager` | Nyra | Business | +R$79/mês |
| `prospeccao-ativa` | Brann | Scale | +R$97/mês |

**Regras obrigatórias para skills:**

```
✅ Usar @ginkgo/skill-sdk — nunca acessar Supabase diretamente
✅ Declarar todas as permissões no manifest
✅ Respeitar ctx.tenantId em toda operação
✅ Nunca acessar secrets sem ser via ctx.secrets
✅ Requests apenas para domínios declarados no manifest

❌ Queries sem WHERE tenant_id
❌ Acesso direto ao Postgres
❌ Bypass de policies do Tool Registry
❌ Dados cross-tenant de qualquer forma
```

---

## 8. Plano de Execução (90 Dias)

### 8.1 Resumo por fase

| Fase | Semanas | Objetivo | Entregável chave |
|------|---------|----------|-----------------|
| Fundação | 1–2 | Infra + banco + Brann operacional | WhatsApp respondendo + logs |
| Produto | 3–4 | RAG + dashboard + 7 testes | Base respondendo corretamente |
| Venda | 5–6 | Frontend + billing + 1º cliente | Checkout Stripe + go-live |
| Tração | 7–9 | 3 clientes + otimização | Dashboard completo + prompts ajustados |
| Escala | 10–13 | 5 clientes + onboarding automático | MRR > R$2.000 |

### 8.2 Sprints e prompts para o Antigravity

| Sprint | Prompt | Entregável |
|--------|--------|-----------|
| S1 | P-01 | docker-compose + Traefik + SSL + healthchecks |
| S1 | P-02 | Schema Supabase (9 lotes) + seed Tenant Zero |
| S1 | P-03 | Evolution instance + n8n webhook receiver |
| S2 | P-04 | Brann flow completo (webhook → OpenAI → Evolution) |
| S2 | P-05 | Tools: create_lead + fetch_catalog + handoff_human |
| S2 | P-06 | System prompt v1 no banco + sanitização WhatsApp |
| S2 | P-07 | Lead Score Engine + alerta operador |
| S2 | P-08 | Incident handler em todos os workflows |
| S3 | P-10 | Pipeline RAG (extract → chunk → embed → pgvector) |
| S3 | P-11 | Tool search_knowledge conectada ao Brann |
| S3 | P-12 | Indexar FAQ + catálogo do Tenant Zero |
| S4 | P-13 | 7 testes end-to-end (todos devem passar) |
| S4 | P-14 | Dashboard métricas + daily summary |
| S5 | FE-01 | Next.js + Supabase Auth + layout + middleware |
| S5 | FE-03 | Billing + Stripe Checkout + webhooks |
| S6 | P-15 | provision-tenant.sh + go-live 1º cliente |
| S6 | FE-02 | Dashboard KPIs + feed ao vivo (Realtime) |

**Protocolo de execução:**

```
1. Colar contexto permanente (ginkgo-permanent-context.md)
2. Colar prompt do sprint atual
3. Aguardar plano do agente
4. Revisar antes de executar
5. Validar checklist de aceite
6. Só avançar após checklist passar
```

### 8.3 Metas ao dia 90

| Métrica | Meta |
|---------|------|
| MRR | ≥ R$2.000 |
| Clientes ativos | ≥ 5 |
| Churn | 0 |
| Custo operacional mensal | < R$800 |
| Margem bruta | > 70% |
| Tempo de onboarding | < 5 dias |
| Taxa de handoff | < 20% |
| Custo por conversa | < R$0,50 |
| Latência média | < 5s |

### 8.4 Segmentos de aquisição prioritários

| Segmento | Dor principal | Argumento de ROI |
|----------|--------------|-----------------|
| Imobiliárias | Lead perdido por resposta lenta | 1 lead convertido/semana paga o plano |
| Clínicas | Agenda no WhatsApp manual | Reduz 60% das mensagens da recepcionista |
| E-commerce local | Atendimento fora do horário | Pedido fora do horário vira receita |
| Prestadores de serviço | Orçamento pedido e nunca respondido | Lead qualificado antes da visita |

**Pitch de 60 segundos:**

```
"Você perde quantos leads por semana porque não respondeu rápido?

O Brann da Ginkgo fica no seu WhatsApp 24h, responde na hora,
qualifica o interesse e só chama você quando o cliente está pronto.

Não é bot genérico — aprende com seu negócio, conhece seu catálogo
e fala no seu tom.

Configuramos em uma semana. R$97/mês base.
Posso mostrar funcionando em 15 minutos?"
```

---

## 9. Referências e Boas Práticas

### 9.1 Documentação do projeto

| Documento | Conteúdo | Localização no repo |
|-----------|----------|-------------------|
| `README.md` | Referência técnica oficial completa | Raiz |
| `MIGRATIONS-GUIDE.md` | 9 lotes SQL + seed + RLS + check-schema | `packages/db/` |
| `WORKFLOWS-GUIDE.md` | 8 workflows n8n nó por nó | `n8n/workflows/` |
| `ENV-VARIABLES-GUIDE.md` | 50+ variáveis com docs e separação por serviço | Raiz |
| `ginkgo-permanent-context.md` | Contexto permanente do Antigravity | `docs/prd/` |
| `go-live-checklist.md` | Checklist binário por cliente | `docs/ops/` |

### 9.2 Gems do GitHub recomendados

| Categoria | Repositório | Por que usar |
|-----------|-------------|-------------|
| n8n production setup | `AiratTop/n8n-self-hosted` | Docker Compose production-ready com HTTPS automático e backup |
| Evolution API | `EvolutionAPI/evolution-api` | Referência oficial — webhooks, múltiplas instâncias, changelog |
| Chatwoot | `chatwoot/chatwoot` | `docker-compose.production.yaml` canônico para self-hosted |
| Boilerplate SaaS | `rcrdk/nextjs-fastify-saas-rbac` | Referência para estrutura de `apps/api` + `apps/web` com RBAC |
| Multi-tenancy Supabase | `vvalchev/supabase-multitenancy-rbac` | Template de RLS e policies multi-tenant alinhado com nosso modelo |

### 9.3 APIs e documentações externas

| Serviço | URL |
|---------|-----|
| Supabase Docs | https://supabase.com/docs |
| pgvector | https://github.com/pgvector/pgvector |
| n8n Docs | https://docs.n8n.io |
| Evolution API | https://doc.evolution-api.com |
| OpenClaw | https://github.com/openclaw/maintainers |
| Chatwoot API | https://www.chatwoot.com/docs/api |
| Stripe Docs | https://stripe.com/docs |
| OpenAI Platform | https://platform.openai.com/docs |
| Perplexity API | https://docs.perplexity.ai |
| ElevenLabs | https://elevenlabs.io/docs |
| HeyGen | https://docs.heygen.com |
| Blotato | https://blotato.com/docs |
| Gamma AI | https://gamma.app |
| Meta Graph API | https://developers.facebook.com/docs/graph-api |
| TikTok for Developers | https://developers.tiktok.com/doc |
| Google APIs Explorer | https://developers.google.com/apis-explorer |

### 9.4 Regras de engenharia — nunca violar

```
1.  WHERE tenant_id = $tenant em toda query — sem exceção
2.  Secrets nunca hardcoded — sempre variáveis de ambiente
3.  Prompts só mudam via prompt_versions — nunca edição direta
4.  tool_executions obrigatório em toda tool call
5.  Nenhum cliente externo antes do Tenant Zero rodar 48h estável
6.  Próximo sprint só após checklist do atual passar
7.  Incidente severity=high investigado no mesmo dia
8.  Alfred read-only por padrão — escrita exige confirmação
9.  Marketplace não abre antes de 5 clientes estáveis
10. LLM provider é fornecedor — nunca fundação da arquitetura
```

### 9.5 O que não construir antes da semana 9

```
❌ Alfred SQL Agent
❌ Nyra pipelines (Reels, posts, ads)
❌ Command / OpenClaw
❌ Adaptive / Corrective RAG
❌ Migração para Qdrant
❌ Multi-canal pesado (email, webchat nativo)
❌ Google Drive sync
❌ Marketplace de skills
❌ Wave, Pyre, LAPLACE routing
❌ Modelos locais em produção
```

---

> **Próximo movimento:** Colar o contexto permanente + P-01 no Antigravity.  
> O que não está neste documento não entra no build do P1.

---

*Ginkgo AI Systems — Manual Definitivo v1.0 completo — Março 2026*
