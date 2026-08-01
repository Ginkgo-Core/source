# Ginkgo Leaf

CRM comercial nativo em IA para organizar contatos, leads, oportunidades, conversas, agenda, vendas, suporte e relacionamento com clientes.

**Status:** produto oficial em desenvolvimento  
**Repositório canônico:** `ginkgoai/ginkgo-leaf`  
**Kernel:** Ginkgo Tree  
**Licença atual:** proprietária comercial, com versões históricas sob MIT

> Leaf é primeiro um CRM. WhatsApp, atendimento, agentes conversacionais, agendamento e automações são superfícies operacionais do relacionamento registrado no CRM.

## Papel no ecossistema

```text
AI Stack — laboratório aberto Apache-2.0
        │
        ▼
Ginkgo Tree — autonomia, limites, memória e white-label
        │
        └── Leaf — AI-native CRM
```

## Escopo principal

- contatos, empresas e histórico unificado;
- leads, oportunidades, funis e etapas;
- inbox e atendimento multicanal;
- WhatsApp e canais conectados;
- qualificação e distribuição de leads;
- agenda, confirmação e reagendamento;
- tarefas, follow-up, cobrança e pós-venda;
- catálogo, documentos e respostas assistidas por conhecimento;
- memória do cliente e contexto comercial;
- handoff para operadores humanos;
- métricas de atendimento, conversão, receita e SLA;
- agentes configuráveis por organização;
- implantação dedicada ou white-label mediante contrato.

## Fronteira de responsabilidades

### Leaf contém

- domínio de contatos, leads, oportunidades, pipelines e agenda;
- inbox, jornadas e workflows de relacionamento;
- interface, navegação e copy do CRM;
- conectores específicos de atendimento e vendas;
- políticas de risco de comunicação com clientes;
- testes, documentação e deploy da edição.

### Ginkgo Tree contém

- autenticação, organizações, RBAC e multi-tenancy;
- billing, metering, orçamento e carteira de tokens;
- agent runtime, autonomia, skills e permissões;
- approvals, auditoria, evidências e secrets boundary;
- Laplace para conhecimento, RAG, memória e proveniência;
- white-label, temas, domínios e componentes compartilhados.

Leaf deve consumir pacotes privados versionados `@ginkgo/*`; o kernel não deve ser copiado para este repositório.

## Arquitetura de alto nível

```text
Cliente / Operador
        │
        ▼
Leaf CRM
  ├── contatos e histórico
  ├── leads, pipeline e agenda
  ├── inbox e atendimento
  ├── agentes e automações
  └── métricas comerciais
        │
        ├──► Ginkgo Tree
        ├──► Laplace
        ├──► workers / n8n limitado
        └──► canais e sistemas autorizados
```

## Princípios

1. **CRM como fonte operacional:** conversas, tarefas e automações atualizam registros rastreáveis.
2. **Tenant obrigatório:** toda operação é escopada por organização.
3. **Handoff honesto:** o agente transfere quando falta autorização, contexto ou confiança.
4. **Evidência antes da afirmação:** conhecimento e ações externas registram fonte e resultado.
5. **Aprovação por risco:** dinheiro, exclusão e comunicações sensíveis seguem políticas.
6. **Produto não duplica kernel:** capacidades reutilizáveis retornam ao Ginkgo Tree.

## Desenvolvimento

- comportamento compartilhado → `ginkgo-tree`;
- CRM e relacionamento → `ginkgo-leaf`;
- exemplo genérico sanitizado → `ai-stack`.

Nunca versione credenciais, conversas reais, dados de clientes, exports de produção ou webhooks ativos.

## Licenciamento

Versões históricas foram publicadas sob MIT e permanecem cobertas por essa concessão, preservada em `LICENSES/MIT-2025.txt`. Novas revisões proprietárias seguem `LICENSE` e `LICENSING.md`.

Produção, hospedagem, distribuição, white-label, OEM e acesso ao código dependem de autorização escrita da Ginkgo AI Systems.
