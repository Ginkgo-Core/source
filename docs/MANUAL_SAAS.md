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

Este guia descreve o processo para configurar o ambiente de desenvolvimento local e realizar o deploy para produção. O processo incorpora validações automáticas para garantir a integridade e a qualidade do código.

### Pré-requisitos

-   **Docker e Docker Compose:** Para orquestração dos serviços em contêineres.
-   **Node.js e pnpm:** Para gerenciamento do monorepo TypeScript.
-   **Supabase CLI:** Para gerenciamento das migrações do banco de dados.
-   **Vercel CLI e Railway CLI:** Para deploy dos respectivos ambientes.

### Setup do Ambiente de Desenvolvimento Local

1.  **Clonar o Repositório:**
    ```bash
    git clone <URL_DO_REPO_GINKGO_LEAF>
    cd ginkgo-leaf
    ```

2.  **Instalar Dependências:**
    ```bash
    pnpm install
    ```

3.  **Configurar Variáveis de Ambiente:**
    -   Copie o arquivo `.env.example` para `.env` na raiz do projeto.
    -   Preencha as variáveis, incluindo as chaves da API do Supabase, Stripe e OpenAI.

4.  **Iniciar o Banco de Dados e Serviços:**
    -   Execute as migrações do Supabase para criar o schema localmente:
        ```bash
        supabase start
        supabase db reset
        ```
    -   Inicie todos os serviços de infraestrutura (n8n, Evolution API, Chatwoot, Redis) com Docker Compose:
        ```bash
        docker-compose -f infra/docker/docker-compose.yml up -d
        ```

5.  **Iniciar as Aplicações:**
    -   Inicie o frontend, a API e os workers em modo de desenvolvimento:
        ```bash
        pnpm dev
        ```

### Processo de Deploy e CI/CD (Auto-Validado)

O deploy é automatizado através de um pipeline de CI/CD (ex: GitHub Actions) que executa uma série de validações antes de publicar as novas versões.

**Pipeline de Validação:**

1.  **Lint e Type Checking:** Garante que o código segue os padrões de estilo e que não há erros de tipo.
    ```bash
    pnpm lint
    pnpm typecheck
    ```

2.  **Validação de Skills (se aplicável):** Se uma nova skill foi adicionada ou modificada, o script `quick_validate.py` é executado para garantir que o `SKILL.md` está bem formatado.
    ```bash
    python3 scripts/validation/quick_validate.py packages/skills/<nome-da-skill>
    ```

3.  **Testes Unitários e de Integração:** Executa os testes para garantir que as novas mudanças não quebraram a funcionalidade existente.

4.  **Build das Aplicações:** Gera os artefatos de produção para cada aplicação no monorepo.
    ```bash
    pnpm build
    ```

**Deploy:**

1.  **Frontend (`apps/web`):** O deploy para a Vercel é acionado automaticamente por um push para a branch `main`.

2.  **Backend (`apps/api`, `apps/workers`):**
    -   Uma imagem Docker de produção é construída.
    -   A nova imagem é enviada para um registro (ex: Docker Hub, GitHub Container Registry).
    -   O deploy na Railway (ou VPS) é atualizado para usar a nova imagem.

3.  **Migrações do Banco de Dados:** As migrações do Supabase são aplicadas ao banco de dados de produção de forma segura.
    ```bash
    supabase db push
    ```

> O script `onboard-docker.sh` serve como um exemplo de teste end-to-end, simulando o fluxo de onboarding em um ambiente Docker isolado, o que é uma excelente prática para validar a experiência do usuário final antes do deploy.

---


## 7. Agentes e Skills

O coração da plataforma Ginkgo é seu ecossistema de agentes de IA, cada um com uma especialidade e um conjunto de skills que podem ser expandidas. A arquitetura é projetada para ser modular, permitindo que novos agentes e skills sejam adicionados como add-ons.

### Agentes Principais

| Agente | Nome de Código | Responsabilidade | Canal Principal |
| :--- | :--- | :--- | :--- |
| **Atendimento** | Brann | Atendimento ao cliente, qualificação de leads e vendas consultivas. | WhatsApp |
| **Gestão** | Alfred | Execução de tarefas operacionais e análise de dados. | n/a (interno) |
| **Conteúdo** | Nyra | Criação e agendamento de conteúdo para redes sociais. | n/a (interno) |
| **Comando** | OpenClaw | Assistente unificado para operadores, orquestrando outros agentes e ferramentas. | Telegram, Webchat |

### Estrutura de uma Skill

Uma `Skill` é um pacote auto-contido que estende as capacidades de um agente. A estrutura de uma skill é padronizada para garantir a consistência e a facilidade de manutenção.

-   **`SKILL.md`:** O arquivo principal que define os metadados da skill (nome, descrição) e fornece as instruções em linguagem natural para o agente sobre como e quando usar a skill.
-   **`scripts/` (opcional):** Contém scripts executáveis (Python, Bash) que realizam as ações da skill. Por exemplo, um script para se conectar a uma API externa.
-   **`references/` (opcional):** Documentação de apoio para o agente, como especificações de API ou guias de processo.
-   **`assets/` (opcional):** Arquivos estáticos que a skill pode usar, como templates de e-mail ou imagens.

Os scripts `init_skill.py`, `quick_validate.py` e `package_skill.py` são ferramentas essenciais para o ciclo de vida de uma skill, automatizando a criação, validação e empacotamento.

### Exemplo de Skill: `RAG Base`

-   **`SKILL.md`:** Descreve como o agente deve usar a função `search_knowledge` para responder a perguntas com base nos documentos indexados do tenant.
-   **`scripts/search_knowledge.py`:** Um script Python que se conecta ao `pgvector` no Supabase, realiza a busca por similaridade de cosseno e retorna os chunks de texto mais relevantes.

### Frontend de Gerenciamento de Skills

O dashboard web (`apps/web`) possui uma seção dedicada ao gerenciamento de skills, permitindo que os administradores do tenant:

-   **Visualizem** todas as skills disponíveis e instaladas.
-   **Habilitem ou desabilitem** skills com um clique.
-   **Instalem** novas skills a partir de um repositório (ClawHub).
-   **Configurem** chaves de API necessárias para skills que se conectam a serviços externos.

O código-fonte para esta interface está localizado em `apps/web/components/skills/`, com os arquivos `skills.ts`, `skills-shared.ts` e `skills-grouping.ts` definindo a lógica de renderização e interação.

---


## 8. Plano de Execução (90 Dias)

Este plano de 90 dias, dividido em sprints quinzenais, foca em construir a fundação da plataforma e entregar valor incrementalmente. O objetivo é ter um MVP funcional e com os primeiros clientes em produção ao final do período.

### Sprint 1-2 (Dias 1-30): Fundação e Core Multi-Tenant

-   **Objetivo:** Estabelecer a infraestrutura básica, o modelo de dados e o core multi-tenant.
-   **Entregáveis:**
    -   Repositório monorepo com `pnpm workspaces` configurado.
    -   Schema SQL inicial em Supabase com tabelas de `tenants`, `profiles`, `memberships` e `subscriptions`.
    -   Políticas de RLS implementadas para isolamento de tenants.
    -   API Core (Fastify) com endpoints para criação de tenants e convite de membros.
    -   Dashboard (Next.js) com fluxo de login, criação de conta e gerenciamento de equipe.
    -   Integração com Stripe para criação de `customer` e `subscription`.

### Sprint 3-4 (Dias 31-60): Agente de Atendimento (Brann) e RAG

-   **Objetivo:** Lançar o primeiro agente gerador de valor e a base do sistema de memória.
-   **Entregáveis:**
    -   Deploy self-hosted do n8n, Evolution API e Chatwoot via Docker Compose.
    -   Workflow em n8n para o agente **Brann**, conectando-se ao WhatsApp via Evolution API.
    -   Schema SQL para o `rag` e `leaf` (canais, contatos, conversas).
    -   Worker de ingestão para upload de documentos, chunking e embedding com `pgvector`.
    -   Skill `search_knowledge` para o Brann, permitindo que ele responda a perguntas com base no RAG.
    -   Interface no dashboard para upload de documentos e visualização de conversas.

### Sprint 5-6 (Dias 61-90): Agente de Comando (OpenClaw) e Onboarding

-   **Objetivo:** Habilitar o controle da plataforma via linguagem natural e refinar a experiência de onboarding.
-   **Entregáveis:**
    -   Schema SQL para o `command` (tool registry, policies, sessions).
    -   Implementação do agente **OpenClaw** com as 8 ferramentas iniciais (MVP).
    -   Integração do OpenClaw com o Telegram e um componente de chat no dashboard.
    -   Dashboard de billing, mostrando o consumo de tokens e o status da assinatura.
    -   Fluxo de onboarding guiado para novos clientes, ajudando-os a conectar suas contas e a obter valor rapidamente.
    -   Lançamento para os primeiros clientes beta.

---


## 9. Referências e Boas Práticas

Esta seção consolida as referências externas e as boas práticas internas que guiam o desenvolvimento da plataforma Ginkgo.

### Referências Externas (Gems)

-   **[1] n8n Production Self-Hosting:** [github.com/AiratTop/n8n-self-hosted](https://github.com/AiratTop/n8n-self-hosted)
-   **[2] Evolution API (WhatsApp):** [github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)
-   **[3] Chatwoot Self-Hosting:** [github.com/chatwoot/chatwoot](https://github.com/chatwoot/chatwoot)
-   **[4] Supabase Multi-Tenancy Boilerplate:** [github.com/vvalchev/supabase-multitenancy-rbac](https://github.com/vvalchev/supabase-multitenancy-rbac)
-   **[5] RAG Pipeline with TypeScript & pgvector:** [encore.dev/articles/how-to-build-rag-pipeline](https://encore.dev/articles/how-to-build-rag-pipeline)
-   **[6] Next.js + Fastify SaaS Boilerplate:** [github.com/rcrdk/nextjs-fastify-saas-rbac](https://github.com/rcrdk/nextjs-fastify-saas-rbac)

### Boas Práticas Internas

-   **Tudo é Multi-Tenant:** Cada nova tabela, endpoint ou serviço deve ser projetado desde o início com o `tenant_id` em mente. A segurança via RLS não é opcional.
-   **SQL é a Fonte da Verdade:** O schema do banco de dados, gerenciado via migrações do Supabase, é a fonte canônica da verdade para a estrutura de dados. O Drizzle ORM e os tipos TypeScript são gerados a partir dele.
-   **Não Reinvente a Roda:** Utilize as "Gems" do GitHub e outras soluções open source sempre que possível. O valor da Ginkgo está na orquestração e na experiência do usuário, não na re-implementação de componentes básicos.
-   **Valide Sempre:** O pipeline de CI/CD deve ser rigoroso. Lint, testes, validação de skills e builds devem passar antes de qualquer deploy.
-   **Documentação como Código:** O `README.md` e este manual são tão importantes quanto o código. Mantenha-os atualizados a cada nova feature ou mudança de arquitetura.

---

Este manual serve como um documento vivo. Ele deve ser atualizado continuamente à medida que a plataforma evolui, garantindo que a equipe de desenvolvimento tenha sempre uma fonte de verdade clara, técnica e acionável para construir o futuro da Ginkgo AI Systems.
