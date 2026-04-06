# PROMPT-ANTIGRAVITY-FASE1.md

> **Objetivo:** Copie o texto abaixo e cole no Antigravity para gerar o fluxo do Agente Brann no n8n e o SQL do banco de dados.

---

**[COPIE A PARTIR DAQUI]**

Atue como Engenheiro de Automação Especialista em n8n e Arquiteto de Banco de Dados PostgreSQL (Supabase).
Meu objetivo é construir o MVP do "Leaf by Ginkgo", um sistema de SDR automatizado via WhatsApp.

Eu já tenho a infraestrutura rodando:
- Supabase: `xajksfznxhpgkaxqgckn.supabase.co`
- n8n: `https://studio.ginkgosystems.tech`
- Evolution API: `https://evo.ginkgosystems.tech`
- Chatwoot: `https://chat.ginkgosystems.tech`

Preciso que você me entregue DOIS artefatos prontos para uso:

### ARTEFATO 1: Schema SQL (Supabase)
Crie o código SQL para rodar no SQL Editor do Supabase. Precisamos de 3 tabelas essenciais para o MVP:
1. `leads`: id (uuid), phone (text, unique), name (text), status (text: 'novo', 'qualificando', 'qualificado', 'handoff'), score (int), created_at, updated_at.
2. `messages`: id (uuid), lead_id (fk), role (text: 'user', 'agent'), content (text), created_at.
3. `agent_logs`: id (uuid), lead_id (fk), action (text), details (jsonb), created_at.

Requisitos do SQL:
- Inclua RLS (Row Level Security) básico (pode deixar public read/write por enquanto para o MVP, mas ative a feature).
- Crie uma function/trigger para atualizar o `updated_at` da tabela `leads` automaticamente.

### ARTEFATO 2: Fluxo n8n (Agente Brann SDR)
Desenhe a estrutura lógica detalhada para eu montar o fluxo no n8n. O fluxo deve fazer o seguinte:

1. **Trigger:** Webhook recebendo POST da Evolution API (evento de nova mensagem).
2. **Parse:** Extrair o número do telefone e o texto da mensagem.
3. **Supabase (Lead):** Buscar na tabela `leads` pelo telefone. Se não existir, criar um novo com status 'novo'.
4. **Supabase (Histórico):** Salvar a mensagem do usuário na tabela `messages`. Buscar as últimas 10 mensagens desse lead para contexto.
5. **Agente IA (OpenAI/Claude):** Enviar o histórico + nova mensagem para o LLM.
   - **System Prompt do Brann:** Escreva um prompt de sistema focado em conversão. O Brann é um SDR. Ele deve ser curto, humano (estilo WhatsApp, sem formatação markdown pesada), fazer uma pergunta por vez para qualificar o lead (descobrir nome, interesse, urgência).
   - **Tools (Function Calling):** O agente deve ter acesso a uma tool chamada `qualify_lead` (atualiza o status e score no banco) e `request_human` (muda o status para 'handoff').
6. **Supabase (Salvar Resposta):** Salvar a resposta gerada pelo agente na tabela `messages`.
7. **Evolution API (Enviar):** Fazer um POST para a Evolution API enviando a resposta de volta para o WhatsApp do lead.

**Entregável esperado:**
1. O bloco de código SQL completo.
2. O passo a passo claro de quais nós (nodes) usar no n8n e como configurá-los (especialmente o nó de HTTP Request para o Supabase e Evolution, e o nó do Agente Avançado).
3. O System Prompt exato que devo colar no nó do Agente.

**[FIM DA CÓPIA]**
