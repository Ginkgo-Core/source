# Ginkgo Leaf

> O sistema operacional para automação inteligente. A plataforma principal da Ginkgo AI Systems para construir, implantar e gerenciar assistentes comerciais autônomos em escala.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Estrutura do Monorepo](#4-estrutura-do-monorepo)
5. [Guia de Instalação e Setup](#5-guia-de-instalação-e-setup)
6. [Módulos Principais](#6-módulos-principais)
7. [Modelo de Dados](#7-modelo-de-dados)

---

## 1. Visão Geral

Ginkgo Leaf é uma plataforma **multi-tenant** e **agent-first**, projetada para servir como a espinha dorsal de operações de IA. Ela fornece a infraestrutura, as ferramentas e as abstrações necessárias para escalar a entrega de agentes de IA para clientes finais, com foco em casos de uso comerciais como atendimento, qualificação de leads, vendas e suporte.

A filosofia do projeto é **"por fora, alfaiate; por dentro, fábrica"**. Cada cliente recebe uma instância configurada para suas necessidades específicas, mas todas operam sobre uma arquitetura-mãe robusta, observável e replicável. Isso garante escalabilidade e manutenibilidade, evitando a criação de soluções artesanais para cada novo cliente.

## 2. Arquitetura do Sistema

A arquitetura é desacoplada em camadas, desde a interface do cliente até a camada de dados e serviços externos, garantindo flexibilidade e resiliência.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES / OPERADORES                     │
│              Dashboard Web · Telegram Bot · API direta           │
└──────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / WSS
┌──────────────────────────────▼──────────────────────────────────┐
│                       CLOUDFLARE (CDN + DDoS)                    │
└──────────┬───────────────────────────────────────┬──────────────┘
           │                                       │
    ┌──────▼──────┐                        ┌──────▼──────┐
    │  Vercel     │                        │  Railway /  │
    │  apps/web   │                        │  Fly.io     │
    │  Next.js    │                        │  apps/api   │
    └──────┬──────┘                        └──────┬──────┘
           │                                      │
           └──────────────────┬───────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                        API CORE (Fastify)                        │
│     Auth · Billing · RAG · Agent Runtime · Tool Registry        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      WORKERS ASSÍNCRONOS                         │
│  provisioning · ingestion · sync · metering · notifications      │
└──────┬──────────────────────────────────────────┬───────────────┘
       │                                          │
┌──────▼──────────────┐              ┌────────────▼──────────────┐
│  SERVIÇOS EXTERNOS  │              │       DATA LAYER           │
│  n8n, Evolution API,│              │  Supabase Postgres         │
│  Stripe, OpenAI...  │              │  pgvector, Redis, Storage  │
└─────────────────────┘              └────────────────────────────┘
```

## 3. Stack Tecnológica

A seleção de tecnologias prioriza ecossistemas maduros, produtividade do desenvolvedor e escalabilidade.

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS | Interface do cliente (Dashboard) e website institucional. |
| **Backend (API Core)** | Fastify, TypeScript | API principal de alta performance para todos os serviços core. |
| **Banco de Dados** | Supabase (Postgres) | Banco de dados relacional, Auth, Storage e RLS. |
| **Banco Vetorial** | pgvector | Armazenamento e busca de embeddings para o RAG. |
| **Orquestração** | n8n | Automação de workflows, ingestão de dados e tarefas assíncronas. |
| **Filas e Cache** | Redis | Gerenciamento de sessões, cache de dados e jobs. |
| **Infraestrutura** | Docker, Traefik | Conteinerização e gerenciamento de serviços locais e em produção. |
| **Hospedagem** | Vercel (Frontend), Railway/Fly.io (Backend) | Plataformas de deploy otimizadas para a stack. |
| **Canal WhatsApp** | Evolution API | Conector para o WhatsApp Business API. |
| **Inbox Humano** | Chatwoot | Plataforma de handoff para atendimento humano. |
| **Pagamentos** | Stripe | Processamento de assinaturas, cobrança por uso e marketplace. |

## 4. Estrutura do Monorepo

O projeto utiliza um monorepo gerenciado com `pnpm workspaces` para compartilhar código e tipos entre as diferentes aplicações.

```
/ginkgo-leaf
├── apps/
│   ├── web/            # Dashboard do cliente em Next.js
│   └── api/            # API Core em Fastify
├── packages/
│   ├── db/             # Schema do banco, migrations e tipos gerados
│   ├── auth/           # Lógica de autenticação compartilhada
│   ├── billing/        # Lógica de cobrança e planos
│   ├── rag/            # Pipeline de ingestão e busca RAG
│   ├── agents/         # Runtime e definições dos agentes (Brann, Alfred)
│   └── shared/         # Tipos, constantes e utilitários globais
├── workers/
│   ├── ingestion/      # Workers para processamento de documentos RAG
│   ├── sync/           # Workers para sincronia com APIs externas
│   └── notifications/  # Workers para envio de alertas
├── infra/
│   └── docker/         # Docker Compose para ambiente local/produção
└── n8n/
    └── workflows/      # Workflows exportados do n8n
```

## 5. Guia de Instalação e Setup

Siga os passos abaixo para configurar e rodar o ambiente de desenvolvimento local.

### Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- [pnpm](https://pnpm.io/installation)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Acesso a uma conta Supabase, Stripe e OpenAI.

### 1. Clonar o Repositório

```bash
# Clone o repositório do projeto
gh repo clone gingkosystems/ginkgo-leaf
cd ginkgo-leaf
```

### 2. Configuração de Ambiente

Copie o arquivo de exemplo `.env.example` para um novo arquivo `.env` na raiz do projeto e preencha as variáveis de ambiente necessárias.

```bash
cp .env.example .env
```

As variáveis incluem chaves para Supabase (URL, `anon_key`, `service_role_key`), Stripe, OpenAI, e credenciais para os serviços locais.

### 3. Infraestrutura Local

Inicie todos os serviços de infraestrutura (n8n, Evolution API, Chatwoot, Redis) com Docker Compose.

```bash
cd infra/docker
docker-compose up -d
```

### 4. Banco de Dados

Conecte o projeto local à sua instância do Supabase e aplique as migrações do banco de dados.

```bash
# Faça o login na sua conta Supabase
supabase login

# Conecte o projeto (o ID pode ser encontrado na URL do seu projeto Supabase)
supabase link --project-ref <project-id>

# Envie as migrações para o banco na nuvem
supabase db push
```

### 5. Dependências e Execução

Instale as dependências do monorepo e inicie as aplicações `web` e `api` em modo de desenvolvimento.

```bash
# Volte para a raiz do projeto
cd ../..

# Instale todas as dependências
pnpm install

# Inicie os apps em modo de desenvolvimento
pnpm dev
```

### 6. Validação

Após a execução, os seguintes serviços estarão disponíveis:

- **Dashboard Web**: `http://localhost:3000`
- **API Core**: `http://localhost:3001`
- **n8n**: `http://localhost:5678` (ou o subdomínio configurado no Traefik)
- **Chatwoot**: `http://localhost:3002` (ou o subdomínio configurado)

## 6. Módulos Principais

- **Auth & Multi-Tenant**: Utiliza Supabase Auth com RLS (Row Level Security) para garantir isolamento total dos dados por `tenant_id`.
- **Agent Runtime**: Um orquestrador que recebe eventos, identifica o agente responsável (ex: **Brann** para vendas), executa a política de segurança, chama o LLM com o prompt correto e despacha para as `Tools` necessárias.
- **RAG Core**: Pipeline completo para ingestão (extração, normalização, chunking, embedding) e busca (retrieval) de conhecimento em bases documentais (PDFs, Markdown, etc.).
- **Tool Registry**: Um registro central onde todas as funções que um agente pode chamar são definidas, com esquemas de entrada/saída, permissões e políticas de execução.
- **Billing & Entitlements**: Integração com Stripe para gerenciar planos de assinatura, consumo de tokens e acesso a features premium.

## 7. Modelo de Dados

O schema do banco de dados é organizado por domínios e aplicado via migrações sequenciais. As principais entidades são:

- `tenants`: Cada cliente da plataforma.
- `profiles`: Usuários que pertencem a um tenant.
- `channels`: Canais de comunicação (WhatsApp, Telegram, etc.).
- `contacts`: Leads e clientes finais atendidos pelos agentes.
- `conversations`: O registro de uma interação completa com um contato.
- `messages`: Cada mensagem trocada dentro de uma conversa.
- `knowledge_assets` e `knowledge_chunks`: A base para o sistema RAG.
- `agents`, `prompt_versions`, `tools`: Configurações do runtime dos agentes.
- `subscriptions`, `billing_usage`: Tabelas para controle de faturamento.

Para o schema completo, consulte os arquivos de migração em `packages/db/migrations/`.
