# BUILD-GUIDE-MVP.md — Guia de Construção do MVP Leaf by Ginkgo

> **Versão:** 1.0.0 | **Data:** Abril 2026  
> **Autor:** Manus AI (Arquiteto) & Gabriel (Copiloto Operador)  
> **Objetivo:** Guia executável, passo a passo, para construir o MVP do Leaf by Ginkgo (SDR Brann + WhatsApp + Dashboard + CRM) usando o Antigravity.

---

## 1. Visão Geral da Arquitetura do MVP

O MVP foca em **Aquisição e Conversão Automatizada**. A arquitetura é enxuta, priorizando velocidade de deploy e funcionalidade real.

**Stack Base:**
- **Orquestração:** n8n
- **Canal:** Evolution API (WhatsApp)
- **Visualização de Conversas:** Chatwoot
- **Banco de Dados & Auth:** Supabase (PostgreSQL + pgvector)
- **Memória Rápida:** Redis
- **Frontend (Dashboard):** Next.js (React)
- **Infraestrutura:** Docker (VPS)

**Fluxo Principal:**
`WhatsApp → Evolution API → n8n (Webhook) → Agente Brann (OpenAI/Claude) → Supabase (Leads/CRM) → Resposta WhatsApp → Chatwoot (Visualização/Handoff) → Dashboard Next.js (Métricas/Gestão)`

---

## 2. Metodologia de Trabalho (Arquiteto + Copiloto)

Como seu Arquiteto, eu (Manus) defini a estrutura e os prompts. Você (Gabriel), como Copiloto Operador, executará os prompts no **Antigravity** e aplicará o código gerado na infraestrutura.

**Regra de Ouro:** Não avance para a próxima fase sem que a anterior esteja 100% funcional e validada (Gate).

---

## 3. Fases de Construção

### FASE 0: Preparação do Terreno (Manual)

Antes de codar, precisamos das chaves e serviços configurados.

**Ações do Copiloto (Gabriel):**
1. **Supabase:** Crie um projeto. Anote `URL` e `ANON_KEY`. Execute no SQL Editor: `CREATE EXTENSION IF NOT EXISTS vector;`
2. **OpenAI/Claude:** Gere uma API Key.
3. **VPS:** Tenha uma VPS Ubuntu limpa com Docker e Docker Compose instalados.
4. **Domínios:** Aponte subdomínios no Cloudflare (ex: `n8n.seudominio.com`, `api.seudominio.com`, `chat.seudominio.com`).

**Gate 0:** Chaves em mãos e VPS acessível via SSH.

---

### FASE 1: Infraestrutura Base (Docker)

Vamos subir o motor do sistema na VPS.

**Prompt para o Antigravity (Copie e cole):**
```text
Atue como Engenheiro DevOps Sênior.
Crie um arquivo `docker-compose.yml` completo e pronto para produção para o MVP do Leaf by Ginkgo.
O stack deve incluir:
1. Traefik (para roteamento e SSL automático via Let's Encrypt)
2. n8n (orquestrador)
3. Evolution API (para WhatsApp)
4. Chatwoot (para visualização de conversas)
5. Redis (cache para Chatwoot e n8n)
6. PostgreSQL (banco local apenas para Chatwoot e Evolution, os dados do app vão pro Supabase externo).

Requisitos:
- Use variáveis de ambiente (${VAR_NAME}) para senhas e domínios.
- Forneça um `.env.example` correspondente.
- Inclua um script `deploy.sh` simples para subir tudo.
- A infra deve ser resiliente (restart: always).
```

**Ações do Copiloto:**
1. Cole o código gerado na VPS.
2. Preencha o `.env`.
3. Rode `bash deploy.sh`.

**Gate 1:** Acesse `n8n.seudominio.com` e `chat.seudominio.com` no navegador e veja as telas de login.

---

### FASE 2: Banco de Dados (Supabase)

Estrutura do CRM e histórico.

**Prompt para o Antigravity:**
```text
Atue como Arquiteto de Banco de Dados.
Crie o schema SQL para o Supabase (PostgreSQL) do MVP Leaf by Ginkgo.
Precisamos das seguintes tabelas:

1. `leads`: id, tenant_id, nome, telefone, status (novo, em_qualificacao, qualificado, agendado, convertido), interesse, score (0-100), origem, created_at, updated_at.
2. `messages`: id, tenant_id, lead_id, role (user, agent), content, created_at.
3. `agent_logs`: id, tenant_id, lead_id, action, details (jsonb), created_at.

Requisitos:
- Inclua RLS (Row Level Security) básico baseado em `tenant_id`.
- Crie uma função SQL simples para atualizar o `updated_at` automaticamente.
- Forneça o SQL completo pronto para rodar no SQL Editor do Supabase.
```

**Ações do Copiloto:**
1. Rode o SQL gerado no SQL Editor do Supabase.

**Gate 2:** Tabelas criadas no Supabase.

---

### FASE 3: O Cérebro (Agente Brann no n8n)

Aqui a mágica acontece. Vamos criar o fluxo do SDR.

**Prompt para o Antigravity:**
```text
Atue como Engenheiro de Automação Especialista em n8n e Agentes de IA.
Desenhe a estrutura lógica (em texto detalhado ou JSON do n8n se possível) para o fluxo do Agente SDR Brann.

O fluxo deve:
1. Receber Webhook da Evolution API (nova mensagem WhatsApp).
2. Buscar o histórico do lead no Supabase (tabela `messages`).
3. Enviar o contexto + nova mensagem para a OpenAI (GPT-4o) ou Anthropic (Claude 3.5 Sonnet).
4. O Prompt do Sistema do Brann deve instruí-lo a:
   - Agir como um SDR humano, curto e direto.
   - Qualificar o lead fazendo perguntas sobre o interesse.
   - Classificar o lead (atualizar status no Supabase).
   - Se o lead quiser falar com humano, acionar uma "tool" de handoff.
5. Salvar a resposta do Brann no Supabase.
6. Enviar a resposta de volta via Evolution API.

Forneça:
1. O passo a passo dos nós do n8n.
2. O System Prompt completo e otimizado para o Brann (focado em conversão e humanização, estilo WhatsApp).
3. A estrutura da chamada de API para atualizar o Supabase.
```

**Ações do Copiloto:**
1. Monte o fluxo no n8n seguindo o guia.
2. Conecte seu WhatsApp na Evolution API.
3. Aponte o Webhook da Evolution para o n8n.

**Gate 3:** Mande um "Oi" pro seu número conectado e o Brann deve responder qualificando você.

---

### FASE 4: Dashboard do Cliente (Next.js)

A interface onde o cliente vê o valor.

**Prompt para o Antigravity:**
```text
Atue como Desenvolvedor Frontend Sênior (Next.js, Tailwind, Shadcn UI).
Crie a estrutura de um Dashboard simples para o MVP Leaf by Ginkgo.

Páginas necessárias:
1. `/login`: Tela de login simples (Supabase Auth).
2. `/dashboard`: Visão geral.
   - Métricas: Total de Leads, Leads Qualificados, Taxa de Conversão.
   - Tabela de Leads Recentes (buscando do Supabase).
3. `/leads`: Lista completa de leads com filtro por status (Kanban ou Tabela).

Requisitos:
- Use App Router do Next.js 14+.
- Forneça o código dos componentes principais (Cards de métricas, Tabela de Leads).
- Mostre como fazer o fetch dos dados do Supabase no lado do servidor (Server Components).
- O design deve ser limpo, estilo SaaS moderno (inspirado em ClickUp/Linear).
```

**Ações do Copiloto:**
1. Crie o projeto Next.js (`npx create-next-app@latest`).
2. Aplique o código gerado.
3. Conecte ao Supabase.
4. Faça o deploy na Vercel.

**Gate 4:** Acesse o dashboard na Vercel, faça login e veja os leads que o Brann capturou na Fase 3.

---

## 4. Próximos Passos (Pós-MVP)

Com este MVP rodando, você tem um produto vendável. Os próximos passos (que desenharemos depois) incluem:
- Integração RAG profunda (Laplace).
- Handoff real para o Chatwoot (sincronização bidirecional).
- Billing automatizado via Stripe.

**Gabriel, copie o prompt da FASE 1, jogue no Antigravity e vamos começar a subir essa infraestrutura!**
