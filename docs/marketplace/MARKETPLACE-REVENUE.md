# MARKETPLACE-REVENUE.md
## Modelo de Receita do Marketplace
### Revshare, billing de skills, Stripe Connect e projeções

> **Versão:** 1.0.0  
> **Entra em:** Fase 3 (após 5 clientes estáveis)  
> **Depende de:** Stripe Connect configurado

---

## Modelo de Revshare — Decisão Final

```
Receita da skill     → 100%
  Ginkgo retém      → 30%
  Desenvolvedor leva → 70%

Stripe Connect retém → ~2,5% + R$0,25/transação (pago pela Ginkgo)
  (não repassado ao dev — custo operacional da plataforma)
```

---

## Tipos de Skill e Modelos de Billing

### Tipo 1 — Assinatura mensal (mais comum)

```
Exemplo: skill controle-financeiro a R$49/mês

Quando 1 tenant ativa a skill:
  Stripe cobra R$49/mês do tenant (junto com assinatura base)
  Ginkgo recebe R$49
  Stripe taxa: ~R$1,47 (3%)
  Líquido Ginkgo: ~R$47,53
  Repasse ao dev (70%): R$33,27/mês por cliente ativo

Com 100 clientes ativos nessa skill:
  Receita bruta: R$4.900/mês
  Stripe fees: ~R$147
  Líquido Ginkgo: ~R$4.753
  Dev recebe: R$3.327/mês
  Ginkgo retém: R$1.426/mês (sem contar overhead de suporte)
```

### Tipo 2 — Por execução (skills de alto consumo)

```
Exemplo: skill prospeccao-ativa — R$97/mês base + tokens por execução

R$97/mês → va para o dev via revshare (mesma lógica acima)

Tokens por execução → ficam INTEIRAMENTE na Ginkgo
  Porque tokens = markup sobre custo de API
  O dev não participa do consumo de tokens
  (tokens são infraestrutura da Ginkgo, não feature do dev)

Declaração no manifest:
  billing.model = "subscription_plus_tokens"
  billing.price_brl = 97
  billing.token_cost_per_run = 120   ← sugestão do dev, aprovada pela Ginkgo
```

### Tipo 3 — Pagamento único (skills simples)

```
Exemplo: skill de template de email a R$79 (compra única)

Ginkgo cobra R$79 uma vez
Stripe fees: ~R$2,22
Dev recebe: R$79 × 70% - proporcional = ~R$53,40

Nota: menos interessante para ambos — preferir assinatura
Válido para: templates, configurações, recursos sem atualização contínua
```

---

## Cálculo Real — 3 Cenários

### Cenário 1 — Dev Individual, 1 Skill Popular

```
Skill: content-recycler-pro a R$79/mês
Clientes ativos: 50
Execuções médias por cliente/mês: 8 (8 vídeos reciclados)

RECEITA DE ASSINATURA:
  Gross: 50 × R$79 = R$3.950/mês
  Stripe fees: ~R$118
  Net: R$3.832
  Dev recebe (70%): R$2.682/mês
  Ginkgo retém (30%): R$1.150/mês

RECEITA DE TOKENS (ficam na Ginkgo):
  50 clientes × 8 execuções × 150 tokens = 60.000 tokens/mês
  60k tokens × R$0,011/token = R$660/mês de tokens
  Custo real das APIs: ~R$270
  Margem de tokens: R$390/mês

TOTAL GINKGO com essa skill:
  R$1.150 (revshare) + R$390 (tokens) = R$1.540/mês

TOTAL DEV:
  R$2.682/mês de receita passiva
  (sem custo de hospedagem ou suporte operacional)
```

### Cenário 2 — Agência com 5 Skills, 200 Clientes Total

```
Skills:
  prospeccao-ativa         R$97/mês × 60 clientes
  email-marketing          R$49/mês × 80 clientes
  relatorio-executivo      R$29/mês × 120 clientes
  disparo-massa-whatsapp   R$79/mês × 40 clientes
  triagem-curriculos       R$79/mês × 20 clientes

RECEITA BRUTA TOTAL:
  R$5.820 + R$3.920 + R$3.480 + R$3.160 + R$1.580 = R$17.960/mês

Stripe fees (~3%): ~R$539

LÍQUIDO: R$17.421/mês
  Agência dev recebe (70%): R$12.195/mês
  Ginkgo retém (30%): R$5.226/mês

TOKENS adicionais (~R$2.000/mês para Ginkgo)

TOTAL GINKGO com essa agência: ~R$7.226/mês
```

### Cenário 3 — Marketplace Maduro (Fase 4+)

```
Hipótese: 50 skills de terceiros, 500 clientes na plataforma

Revenue de marketplace:
  Assinatura média por skill: R$49/mês
  Clientes médios por skill: 30
  Skills ativas: 50

  Total skills revenue: 50 × 30 × R$49 = R$73.500/mês
  Ginkgo retém 30%: R$22.050/mês
  Desenvolvedores levam 70%: R$51.450/mês

Tokens de skills:
  ~500 clientes × ~R$50/mês em tokens de skills = R$25.000/mês
  Custo real: ~R$10.000
  Margem tokens skills: R$15.000/mês

TOTAL MARKETPLACE GINKGO: R$37.050/mês
  (sem contar assinaturas base e agentes)
```

---

## Implementação Stripe Connect

### Setup inicial

```bash
# Habilitar Stripe Connect no painel Stripe
# Tipo: Standard (desenvolvedor gerencia própria conta Stripe)
# Ou: Express (Ginkgo gerencia, mais simples para o dev)
# DECISÃO: Express (menor fricção para onboarding de devs)
```

### Fluxo de onboarding do dev

```
1. Dev registra conta em developers.ginkgosystems.tech
2. Completa KYC via Stripe Connect Express
   (Stripe cuida de CPF/CNPJ, dados bancários)
3. Recebe developer_id do sistema
4. Publica skill no marketplace
5. Stripe Connect começa a receber repasses automaticamente
```

### Variáveis de ambiente adicionais

```bash
# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=     # do painel Stripe Connect
STRIPE_WEBHOOK_SECRET_CONNECT= # para eventos de Connect
```

### Tabela de revshare

```sql
-- Já existe em marketplace (migration 008)
-- Completar a lógica de processamento

-- Job mensal de revshare (roda no dia 5 de cada mês)
CREATE TABLE revshare_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id     UUID REFERENCES profiles(id),
  skill_id         UUID REFERENCES skills(id),
  period           TEXT,                    -- YYYY-MM
  gross_brl        NUMERIC,
  platform_pct     FLOAT DEFAULT 0.30,
  developer_pct    FLOAT DEFAULT 0.70,
  stripe_fees_brl  NUMERIC,
  platform_brl     NUMERIC,
  developer_brl    NUMERIC,
  stripe_transfer_id TEXT,
  status           TEXT DEFAULT 'pending', -- pending | processing | paid | failed
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### Worker de revshare (CRON dia 5)

```typescript
// workers/sync/revshare.ts

cron.schedule('0 10 5 * *', async () => {  // dia 5, 10h
  const period = getPreviousMonth()  // ex: "2026-03"

  // 1. Calcular receita por skill no período
  const { data: revenue } = await supabase.rpc('calc_skill_revenue', {
    p_period: period
  })

  for (const r of revenue ?? []) {
    const stripe_fees = r.gross_brl * 0.025 + 0.25
    const net         = r.gross_brl - stripe_fees
    const dev_amount  = net * 0.70
    const plat_amount = net * 0.30

    if (dev_amount < 5) continue  // mínimo R$5 para transferir

    // 2. Criar transferência Stripe Connect
    const transfer = await stripe.transfers.create({
      amount:      Math.floor(dev_amount * 100),  // em centavos
      currency:    'brl',
      destination: r.stripe_account_id,  // conta Express do dev
      description: `Ginkgo Marketplace — ${r.skill_name} — ${period}`
    })

    // 3. Registrar no banco
    await supabase.from('revshare_payments').insert({
      developer_id:      r.developer_id,
      skill_id:          r.skill_id,
      period,
      gross_brl:         r.gross_brl,
      stripe_fees_brl:   stripe_fees,
      platform_brl:      plat_amount,
      developer_brl:     dev_amount,
      stripe_transfer_id: transfer.id,
      status:            'paid',
      processed_at:      new Date().toISOString()
    })
  }
})
```

---

## Dashboard do Desenvolvedor

```
developers.ginkgosystems.tech

Seções:
  Minhas skills         → status, versão, aprovação
  Analytics             → clientes ativos, churn, execuções
  Receita               → MRR, histórico de repasses
  Conta bancária        → via Stripe Connect Express
  Documentação          → SDK, exemplos, changelog da API
```

---

## Política de Aprovação e Qualidade

```
TAXA DE APROVAÇÃO ESTIMADA (baseada em marketplaces similares):
  Skills enviadas:   100%
  Aprovadas:         ~60%
  Rejeitadas:        ~30%  → feedback + chance de reenvio
  Suspensas pós-pub: ~10%  → violação de compliance ou qualidade

CRITÉRIOS DE REJEIÇÃO:
  - Não passa no checklist de compliance
  - Funcionalidade duplica skill oficial Ginkgo sem diferenciação
  - Qualidade de código insatisfatória (sem tratamento de erro)
  - Descrição enganosa ou promessas não entregues
  - Dependência de serviço externo não declarado no manifest

POLÍTICA DE SUSPENSÃO:
  - 3 reclamações de clientes por comportamento inesperado
  - Violação de ToS de plataformas externas que gerou bans
  - Skill que quebra Kernel Invariants (acesso direto ao banco)
```

---

## Projeção de Receita do Marketplace

```
Fase 3 (meses 6–12, após 5 clientes):
  Skills publicadas: 5–10
  Clientes comprando skills: ~30% da base
  Receita estimada: R$2.000–R$5.000/mês incremental

Fase 4 (meses 12–24):
  Skills publicadas: 20–50
  Clientes comprando skills: ~50% da base
  Receita estimada: R$10.000–R$30.000/mês incremental

Fase 5 (meses 24+):
  Skills publicadas: 100+
  Marketplace como flywheel:
    + skills → + valor para clientes → + clientes → + devs → + skills
  Receita marketplace: 30–40% da receita total da plataforma
```

---

## Checklist de Implementação

```
Stripe Connect:
[ ] Conta Stripe Connect habilitada (tipo Express)
[ ] STRIPE_CONNECT_CLIENT_ID no .env
[ ] Webhook /webhooks/stripe-connect configurado
[ ] Página de onboarding de desenvolvedor

Banco de dados:
[ ] revshare_payments table criada
[ ] skill_revenue SQL function criada
[ ] developer_id em profiles (ou tabela developers separada)

Workers:
[ ] revshare.ts com CRON dia 5 de cada mês
[ ] Notificação ao dev quando repasse é feito

Dashboard do dev:
[ ] developers.ginkgosystems.tech (subdomínio)
[ ] Autenticação separada da plataforma principal
[ ] Visualização de analytics e receita
```

---

*Ginkgo AI Systems — MARKETPLACE-REVENUE.md v1.0.0 — Março 2026*
*Marketplace não abre antes de 5 clientes estáveis e Stripe Connect configurado.*
