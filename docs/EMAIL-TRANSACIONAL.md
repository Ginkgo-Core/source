# EMAIL-TRANSACIONAL.md
## Email Transacional — Ginkgo AI Systems
### Provider: Resend + React Email

> **Provider:** Resend (resend.com)  
> **SDK:** `resend` npm package  
> **Templates:** React Email (`@react-email/components`)  
> **From:** `oi@ginkgosystems.tech`

---

## Por que Resend

- API simples, SDK TypeScript nativo
- Gratuito até 3.000 emails/mês (suficiente para P1)
- Dashboard com logs e analytics
- Suporte a React Email (templates em TSX)
- Entregabilidade alta (SPF, DKIM configurados automaticamente)

---

## Setup

```bash
# Instalar
pnpm add resend @react-email/components

# Variável de ambiente
RESEND_API_KEY=re_...        # Resend → API Keys → Create
FROM_EMAIL=oi@ginkgosystems.tech
```

### Configurar domínio no Resend

```
Resend → Domains → Add Domain → ginkgosystems.tech
Adicionar os registros DNS que o Resend pede no Cloudflare:
  TXT  _dmarc.ginkgosystems.tech
  TXT  resend._domainkey.ginkgosystems.tech
  MX   ginkgosystems.tech (se quiser receber replies)
Aguardar verificação (5–30 min)
```

---

## Cliente Resend

```typescript
// packages/shared/email.ts

import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM = 'Ginkgo AI <oi@ginkgosystems.tech>'

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to:      string
  subject: string
  react:   React.ReactElement
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    react,
  })

  if (error) {
    console.error('Email error:', error)
    throw error
  }

  return data
}
```

---

## Templates

### 1. Boas-vindas (trigger: signup)

```tsx
// packages/shared/emails/WelcomeEmail.tsx

import {
  Body, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Button, Hr
} from '@react-email/components'

interface WelcomeEmailProps {
  name:            string
  businessName:    string
  onboarding_url:  string
  trial_days?:     number
}

export function WelcomeEmail({
  name,
  businessName,
  onboarding_url,
  trial_days = 7
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Seu trial de {trial_days} dias começou — configure seu agente agora</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#0A0A10', fontSize: '24px' }}>
            Bem-vindo à Ginkgo, {name}! 👋
          </Heading>
          <Text style={{ color: '#444', lineHeight: '1.6' }}>
            Sua conta para <strong>{businessName}</strong> está pronta.
            Você tem <strong>{trial_days} dias gratuitos</strong> para configurar
            e ver o Brann funcionando no seu WhatsApp.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={onboarding_url}
              style={{
                backgroundColor: '#6EE7B7',
                color: '#0A0A10',
                padding: '12px 28px',
                borderRadius: '8px',
                fontWeight: 'bold',
                textDecoration: 'none',
                fontSize: '15px'
              }}
            >
              Configurar meu agente →
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eee' }} />
          <Text style={{ color: '#888', fontSize: '12px' }}>
            Ginkgo AI Systems · ginkgosystems.tech
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

**Envio:**
```typescript
await sendEmail({
  to:      email,
  subject: `Bem-vindo à Ginkgo! Seu trial começa agora`,
  react:   <WelcomeEmail name={name} businessName={businessName} onboarding_url={url} />
})
```

---

### 2. Confirmação de pagamento (trigger: invoice.paid)

```tsx
// packages/shared/emails/PaymentConfirmedEmail.tsx

export function PaymentConfirmedEmail({
  name,
  plan,
  amount_brl,
  period,
  invoice_url
}: PaymentConfirmedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Pagamento confirmado — plano {plan} ativo</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#0A0A10', fontSize: '22px' }}>
            ✅ Pagamento confirmado
          </Heading>
          <Text>
            Olá {name}, seu pagamento de <strong>R$ {amount_brl}</strong> para
            o plano <strong>{plan}</strong> referente a <strong>{period}</strong>
            foi confirmado.
          </Text>
          <Text>
            Seus tokens foram recarregados e todos os agentes estão ativos.
          </Text>
          <Link href={invoice_url} style={{ color: '#6EE7B7' }}>
            Ver fatura completa →
          </Link>
        </Container>
      </Body>
    </Html>
  )
}
```

---

### 3. Alerta de tokens baixos (trigger: balance < 20%)

```tsx
// packages/shared/emails/LowBalanceEmail.tsx

export function LowBalanceEmail({
  name,
  balance_remaining,
  balance_pct,
  buy_tokens_url
}: LowBalanceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>⚡ Seus tokens estão acabando — recarregue agora</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#F87171', fontSize: '22px' }}>
            ⚡ Tokens baixos — {balance_pct}% restante
          </Heading>
          <Text>
            {name}, seu saldo de tokens está em <strong>{balance_remaining.toLocaleString()}</strong> tokens
            ({balance_pct}% do pacote).
          </Text>
          <Text>
            Quando zerar, seus agentes pausam automaticamente.
            Recarregue agora para manter o atendimento ativo.
          </Text>
          <Button href={buy_tokens_url} style={{
            backgroundColor: '#6EE7B7', color: '#0A0A10',
            padding: '12px 28px', borderRadius: '8px',
            fontWeight: 'bold', textDecoration: 'none'
          }}>
            Comprar tokens →
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
```

---

### 4. Trial expirando (trigger: 2 dias antes do fim)

```tsx
// packages/shared/emails/TrialExpiringEmail.tsx

export function TrialExpiringEmail({
  name,
  days_remaining,
  upgrade_url
}: TrialExpiringEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Seu trial expira em {days_remaining} dia(s) — não perca o acesso</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#FCD34D', fontSize: '22px' }}>
            ⏰ Seu trial expira em {days_remaining} dia(s)
          </Heading>
          <Text>
            {name}, seu período de teste gratuito está quase acabando.
            Para continuar usando o Brann e manter o atendimento automático ativo,
            escolha um plano antes que expire.
          </Text>
          <Button href={upgrade_url} style={{
            backgroundColor: '#6EE7B7', color: '#0A0A10',
            padding: '12px 28px', borderRadius: '8px', fontWeight: 'bold'
          }}>
            Escolher meu plano →
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
```

---

### 5. Incidente crítico (trigger: severity=high)

```tsx
// packages/shared/emails/IncidentEmail.tsx
// Enviado para o operador (gabriel@ginkgosystems.tech), não para o cliente

export function IncidentEmail({
  tenant_name,
  severity,
  description,
  workflow,
  dashboard_url
}: IncidentEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>🚨 Incidente {severity} — {tenant_name}</Preview>
      <Body style={{ backgroundColor: '#1a0a0a', fontFamily: 'monospace' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px', color: '#f87171' }}>
          <Heading style={{ color: '#F87171' }}>
            🚨 Incidente {severity.toUpperCase()}
          </Heading>
          <Text style={{ color: '#fca5a5' }}>Tenant: {tenant_name}</Text>
          <Text style={{ color: '#fca5a5' }}>Workflow: {workflow}</Text>
          <Text style={{ color: '#fca5a5' }}>Descrição: {description}</Text>
          <Link href={dashboard_url} style={{ color: '#6EE7B7' }}>
            Ver no dashboard →
          </Link>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## CRON: alertas proativos

```typescript
// workers/sync/email-alerts.ts

// Verificar trials expirando (rodar 1x por dia às 09h)
cron.schedule('0 9 * * *', async () => {
  const expiring = await supabase
    .from('subscriptions')
    .select('tenant_id, trial_ends_at, tenants(name), profiles(email, name)')
    .eq('status', 'trialing')
    .gte('trial_ends_at', new Date().toISOString())
    .lte('trial_ends_at', addDays(new Date(), 2).toISOString())

  for (const sub of expiring.data ?? []) {
    const daysLeft = differenceInDays(new Date(sub.trial_ends_at!), new Date())
    await sendEmail({
      to:      sub.profiles.email,
      subject: `Seu trial expira em ${daysLeft} dia(s)`,
      react:   <TrialExpiringEmail
                 name={sub.profiles.name}
                 days_remaining={daysLeft}
                 upgrade_url={`${process.env.APP_URL}/billing`}
               />
    })
  }
})

// Verificar saldo baixo (< 20%) — rodar a cada 6h
cron.schedule('0 */6 * * *', async () => {
  const { data: balances } = await supabase
    .from('token_balances')
    .select('tenant_id, balance, tenants(name, config_json)')
    .lt('balance', 120000) // < 20% do plano Starter

  for (const b of balances ?? []) {
    await enqueue('notifications', 'send_low_balance_alert', b.tenant_id, {})
  }
})
```

---

## Variável de ambiente adicional

```bash
RESEND_API_KEY=re_...
FROM_EMAIL=oi@ginkgosystems.tech
```

---

*Ginkgo AI Systems — EMAIL-TRANSACIONAL.md v1.0.0 — Março 2026*
