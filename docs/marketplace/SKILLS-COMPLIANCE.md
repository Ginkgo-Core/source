# SKILLS-COMPLIANCE.md
## Política de Compliance e LGPD para Skills
### Regras obrigatórias para skills que tocam dados de terceiros

> **Versão:** 1.0.0 | **Base legal:** LGPD (Lei 13.709/2018)  
> **Aplica-se a:** Toda skill que coleta, processa ou armazena dados de pessoas físicas  
> **Bloqueia:** Publicação de skill no marketplace sem aprovação deste checklist

---

## Classificação de Risco por Skill

```
RISCO ALTO — exige aprovação explícita + aviso em destaque
  prospeccao-ativa          → coleta dados de pessoas sem consentimento direto
  disparo-massa-whatsapp    → comunicação em massa não solicitada
  instagram-dm-automatizado → DM em massa pode violar ToS da Meta

RISCO MÉDIO — exige política de retenção + opt-out
  email-marketing           → comunicação direta com base de contatos
  preenchimento-leads       → enriquecimento de dados de contatos
  triagem-curriculos        → dados sensíveis de candidatos

RISCO BAIXO — disclosure padrão suficiente
  content-recycler          → apenas dados do próprio tenant
  controle-financeiro       → dados financeiros próprios do tenant
  relatorio-executivo       → dados internos do tenant
  noticiario-nichado        → dados públicos sem PII
```

---

## Base Legal LGPD por Tipo de Skill

### Prospecção Ativa (scraping de leads)

```
Base legal aplicável: Art. 7°, IX — legítimo interesse
Condição: dados coletados de fontes PÚBLICAS (LinkedIn, site, Google)

Válido:
  ✅ Nome e cargo visível no LinkedIn (perfil público)
  ✅ Email profissional de página de contato pública
  ✅ Telefone publicado no Google Meu Negócio
  ✅ Dados de perfil público de redes sociais

Inválido:
  ❌ Dados de perfis privados ou com configuração de privacidade
  ❌ Emails obtidos por scraping de código-fonte de páginas
  ❌ Dados de grupos fechados / comunidades privadas
  ❌ Cruzamento de dados que revele informações sensíveis
     (saúde, religião, orientação sexual, etc.)

Obrigações:
  1. Informar ao lead que seus dados foram coletados
     (via primeiro contato — ex: "encontrei seu perfil no LinkedIn")
  2. Oferecer opt-out imediato e fácil
  3. Deletar dados em até 72h após solicitação
  4. Não transferir dados para terceiros
  5. Retenção máxima: 90 dias sem contato
```

### Disparo em Massa WhatsApp

```
Base legal aplicável: Art. 7°, I — consentimento
Condição: lista deve ser de contatos que deram consentimento explícito

Obrigações da skill:
  1. Verificar se contato está na base do tenant (não listas compradas)
  2. Incluir mensagem de opt-out em TODA comunicação:
     "Para não receber mais mensagens, responda SAIR"
  3. Processar opt-out em < 24h (bloquear automaticamente)
  4. Rate limit obrigatório: máx 1 mensagem por número a cada 24h
  5. Máximo de 1.000 disparos/dia por instância Evolution
     (acima disso risco de ban do WhatsApp)

Risco de ban Evolution API:
  WhatsApp detecta automação por:
  - Muitas mensagens em curto intervalo (< 1s entre envios)
  - Mesmo texto para múltiplos números
  - Horário incomum (madrugada)

  Mitigação obrigatória na skill:
  - Delay aleatório 3–8s entre envios
  - Variação de texto (personalização mínima por contato)
  - Horário configurável pelo tenant (padrão: 08h–20h)
  - Limite diário configurável (padrão: 500/dia)
```

### Email Marketing

```
Base legal aplicável: Art. 7°, I — consentimento
  Lista deve ter opt-in comprovado (double opt-in recomendado)

Obrigações:
  1. Cabeçalho de remetente identificável (sem "noreply")
  2. Link de descadastro em todo email (LGPD Art. 15)
  3. Endereço físico ou CNPJ do remetente no rodapé
  4. Registrar consentimento no banco (quem aceitou, quando, como)
  5. Honorar pedido de remoção em < 10 dias úteis
```

---

## Política de Retenção de Dados por Tipo

```
LEADS PROSPECTADOS (sem contato)
  Retenção: 30 dias
  Ação após: DELETE automático ou prompt ao tenant para decidir

LEADS EM CONTATO ATIVO (Brann atendendo)
  Retenção: Duração do relacionamento + 6 meses
  Ação após: Anonimizar nome/email, manter métricas agregadas

LEADS CONVERTIDOS (clientes)
  Retenção: Duração do contrato + 5 anos (obrigações fiscais)
  Ação após: Arquivar com acesso restrito

DADOS DE TERCEIROS EM SCRAPING (prospecção)
  Retenção máxima: 90 dias
  Ação: Job automático semanal que deleta registros antigos

VÍDEOS TEMPORÁRIOS (content-recycler)
  Retenção: Imediata após processamento
  Ação: DELETE no finally block do worker (já implementado)

VÍDEOS RECICLADOS (output do recycler)
  Retenção: Enquanto tenant estiver ativo
  Ação após cancelamento: 30 dias para download, depois DELETE
```

---

## Manifest de Skills — Campos de Compliance Obrigatórios

```json
{
  "id": "prospeccao-ativa",
  "compliance": {
    "lgpd_risk":        "high",
    "legal_basis":      "legitimate_interest",
    "data_types":       ["name", "email", "phone", "linkedin"],
    "data_sources":     ["public_profiles", "google_maps", "linkedin_public"],
    "retention_days":   90,
    "has_opt_out":      true,
    "requires_consent": false,
    "third_party_data": true,
    "disclosure_text":  "Esta skill coleta dados públicos de potenciais leads. Os dados são usados apenas para prospecção e deletados após 90 dias ou a pedido.",
    "approved":         true,
    "approved_at":      "2026-03-17",
    "approved_by":      "ginkgo-legal"
  }
}
```

---

## Onboarding de Skills com Risco Alto

Antes de ativar skill de risco alto, o tenant vê:

```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Política de uso — Skill: Prospecção Ativa           │
│                                                          │
│  Esta skill coleta dados públicos de potenciais clientes │
│  usando APIs de scraping.                                │
│                                                          │
│  Ao usar esta skill, você concorda com:                  │
│  ✓ Usar apenas para prospecção comercial legítima        │
│  ✓ Informar leads que seus dados foram coletados         │
│  ✓ Atender pedidos de exclusão em até 72h                │
│  ✓ Não revender ou compartilhar os dados coletados       │
│  ✓ Respeitar a LGPD e as políticas das plataformas       │
│                                                          │
│  Dados são deletados automaticamente após 90 dias.       │
│                                                          │
│  [Li e aceito]              [Cancelar]                   │
└──────────────────────────────────────────────────────────┘
```

Aceitação fica registrada em `audit_logs`:
```sql
INSERT INTO audit_logs (tenant_id, event_type, payload_json)
VALUES ($tenant, 'skill_compliance_accepted',
  '{"skill_id": "prospeccao-ativa", "accepted_at": "2026-03-17T10:00:00Z"}');
```

---

## Regras para Marketplace de Skills de Terceiros

Skills de terceiros com `third_party_data: true` passam por:

```
1. Revisão manual pela equipe Ginkgo (SLA: 5 dias úteis)
2. Código-fonte auditado para verificar:
   - Dados não saem do tenant (sem envio para servidor do dev)
   - opt-out está implementado
   - retenção respeita política declarada
3. Teste em sandbox com dados fictícios
4. Aprovação explícita antes de publicação
5. Re-auditoria a cada update de versão major
```

---

## Termos Anti-Abuso (ToS das Plataformas)

Além da LGPD, as plataformas têm regras próprias:

```
LINKEDIN
  Proibido: automação de conexões, scraping de escala
  Permitido: scraping manual, dados públicos com volume razoável
  Risco: conta banida se detectar acesso automatizado

META (Instagram/Facebook)
  Proibido: automação de DMs em massa, seguir/curtir em massa
  Permitido: API oficial (com permissões aprovadas)
  Risco: app banido pelo Facebook Developers

WHATSAPP (via Evolution API)
  Proibido: spam, listas compradas, volume anormal
  Permitido: comunicação com contatos que salvaram o número
  Risco: número banido permanentemente

GOOGLE
  Proibido: scraping agressivo do Search
  Permitido: Apify com rate limit respeitoso
  Risco: IP bloqueado por Google

MITIGAÇÃO GERAL:
  - Rate limits declarados no manifest de cada skill
  - Usuário assume responsabilidade no aceite de compliance
  - Ginkgo não é responsável por bans causados por mau uso
  - ToS de cada plataforma linkado no onboarding da skill
```

---

## Jobs de Limpeza Automática

```typescript
// workers/sync/cleanup.ts — adicionar ao CRON

// Deletar leads prospectados sem contato > 90 dias
cron.schedule('0 3 * * *', async () => {  // 03h toda madrugada
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('contacts')
    .delete()
    .eq('status', 'prospected')
    .lt('created_at', cutoff)
    .not('last_seen_at', 'gt', cutoff)  // sem interação recente

  // Logar no audit_log
  await supabase.from('audit_logs').insert({
    event_type:   'auto_cleanup_leads',
    payload_json: { cutoff_date: cutoff }
  })
})

// Deletar conteúdo reciclado de tenants cancelados > 30 dias
cron.schedule('0 4 * * *', async () => {
  const { data: cancelled } = await supabase
    .from('subscriptions')
    .select('tenant_id, canceled_at')
    .eq('status', 'canceled')
    .lt('canceled_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  for (const sub of cancelled ?? []) {
    // Deletar arquivos do Storage
    await supabase.storage.from('content').list(`${sub.tenant_id}/recycled`)
    // ... deletar recursivamente

    // Anonimizar leads (não deletar — podem ter obrigação fiscal)
    await supabase.from('contacts')
      .update({ name: 'Contato Removido', email: null, phone: null })
      .eq('tenant_id', sub.tenant_id)
  }
})
```

---

## Checklist de Publicação de Skill

```
ANTES DE PUBLICAR QUALQUER SKILL NO MARKETPLACE

Compliance básico (toda skill):
[ ] manifest.compliance preenchido completamente
[ ] lgpd_risk declarado (low | medium | high)
[ ] retention_days definido
[ ] disclosure_text escrito em português claro

Risco médio/alto (adicional):
[ ] Onboarding modal de aceite implementado
[ ] Aceitação gravada em audit_logs
[ ] Opt-out funcional e testado
[ ] Rate limits configurados e respeitados
[ ] Job de limpeza automática criado

Marketplace (third-party):
[ ] Código auditado pela equipe Ginkgo
[ ] Teste em sandbox concluído
[ ] ToS das plataformas envolvidas consultadas
[ ] Aprovação registrada em skills.compliance.approved = true
```

---

*Ginkgo AI Systems — SKILLS-COMPLIANCE.md v1.0.0 — Março 2026*
*Skills com risco alto não publicam sem este checklist completo.*
