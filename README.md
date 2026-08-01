# Ginkgo Leaf

Plataforma comercial de atendimento, CRM e operações conversacionais com agentes de IA.

**Status:** produto oficial em desenvolvimento  
**Repositório canônico:** `ginkgoai/ginkgo-leaf`  
**Kernel:** Ginkgo Tree  
**Licença:** proprietária comercial

> Leaf é uma distribuição vertical do Ginkgo Tree. Este repositório contém somente o que é específico de atendimento, relacionamento, agenda, vendas e suporte. Identidade, tenancy, billing, políticas, auditoria, execução e white-label pertencem ao kernel compartilhado.

## Papel no ecossistema

```text
AI Stack — laboratório aberto Apache-2.0
        │
        ▼
Ginkgo Tree — kernel comercial e white-label OS
        │
        └── Leaf — atendimento e CRM conversacional
```

## Escopo do produto

Leaf organiza a jornada completa de conversação empresarial:

- atendimento multicanal;
- WhatsApp e canais conectados;
- qualificação de leads;
- CRM operacional;
- agendamento e confirmação;
- catálogo, arquivos e respostas com RAG;
- histórico e memória do cliente;
- handoff para atendentes humanos;
- follow-up, cobrança e pós-venda;
- indicadores de atendimento, conversão e SLA;
- agentes configuráveis por organização;
- implantação dedicada ou white-label mediante contrato.

## Fronteira de responsabilidades

### Este repositório contém

- módulos de inbox, contatos, oportunidades e agenda;
- jornadas e workflows específicos do Leaf;
- interface, navegação e copy do produto;
- conectores e adaptadores de atendimento;
- políticas de risco específicas de comunicação com clientes;
- testes e documentação da edição;
- configurações de deploy do produto.

### Ginkgo Tree contém

- autenticação, organizações, membership e RBAC;
- isolamento multi-tenant;
- billing, planos, metering e carteira de tokens;
- agent runtime, skills e permissões;
- filas, approvals, auditoria e evidências;
- secrets boundary;
- white-label, temas e domínios;
- componentes compartilhados e contratos de extensão.

O código do kernel não deve ser copiado para Leaf. O produto deve consumir pacotes privados e versionados do namespace `@ginkgo/*`.

## Arquitetura de alto nível

```text
Operador / Cliente
        │
        ▼
Leaf Web ──► Leaf API / módulos de domínio
                  │
                  ├──► Ginkgo Tree kernel
                  ├──► Worker / filas
                  ├──► n8n como executor limitado
                  ├──► Evolution API / canais
                  └──► PostgreSQL, Redis e memória por tenant
```

## Princípios

1. **Tenant obrigatório:** toda operação é escopada por organização.
2. **Handoff honesto:** o agente deve transferir quando não possui autorização ou confiança suficiente.
3. **Evidência antes de afirmação:** RAG e ações externas devem registrar fonte e resultado.
4. **Aprovação por risco:** ações financeiras, destrutivas ou sensíveis exigem política e aprovação.
5. **Executor cego:** n8n executa tarefas delimitadas e não recebe segredos mestres da plataforma.
6. **Produto não duplica kernel:** melhorias reutilizáveis retornam ao Ginkgo Tree.

## Desenvolvimento

Antes de alterar o produto, identifique onde a mudança pertence:

- comportamento reutilizável por várias edições → `ginkgo-tree`;
- comportamento exclusivo de atendimento/CRM → `ginkgo-leaf`;
- exemplo genérico e sanitizado → `ai-stack`.

Nunca versione credenciais, dados de clientes, exports de produção, conversas ou caminhos de webhook ativos.

## Documentação

Documentos de implementação existentes permanecem em `docs/`. Novas decisões que alterem contratos com o kernel devem registrar a versão de Ginkgo Tree suportada e a estratégia de migração.

## Licença

Este software é proprietário e comercial. Uso, implantação, hospedagem, distribuição, white-label, OEM ou acesso ao código dependem de autorização escrita da Ginkgo AI Systems.

Consulte [`LICENSE`](LICENSE).
