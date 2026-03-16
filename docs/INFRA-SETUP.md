# INFRA-SETUP.md
## Setup Operacional Completo — Ginkgo AI Systems
### Hostinger VPS + Cloudflare + Vercel + Supabase

> **Domínio:** ginkgosystems.tech  
> **VPS:** Hostinger KVM 4 (4GB RAM, 2 vCPU, 40GB)  
> **Versão:** 1.0.0 | Março 2026

---

## 1. Mapa de Subdomínios

```
Cloudflare DNS (ginkgosystems.tech)
  │
  ├── ginkgosystems.tech          → Vercel (landing page)
  ├── app.ginkgosystems.tech      → Vercel (dashboard / onboarding)
  │
  ├── api.ginkgosystems.tech      → Hostinger VPS (Fastify API)
  ├── hooks.ginkgosystems.tech    → Hostinger VPS (webhooks externos)
  ├── chat.ginkgosystems.tech     → Hostinger VPS (Chatwoot)
  ├── wa.ginkgosystems.tech       → Hostinger VPS (Evolution API)
  ├── n8n.ginkgosystems.tech      → Hostinger VPS (n8n)
  │
  └── (futuro)
      ├── cmd.ginkgosystems.tech  → Hostinger VPS (OpenClaw)
      └── cdn.ginkgosystems.tech  → Supabase Storage / Cloudflare R2
```

---

## 2. DNS Records no Cloudflare

### Registros obrigatórios P1

| Nome | Tipo | Valor | Proxy | Notas |
|------|------|-------|-------|-------|
| `@` | A | `<IP_VPS>` | DNS only | Raiz — ou CNAME para Vercel se landing lá |
| `app` | CNAME | `cname.vercel-dns.com` | **DNS only** ⚠️ | Vercel pede proxy OFF |
| `api` | A | `<IP_VPS>` | Proxied ✅ | WAF ativo |
| `hooks` | A | `<IP_VPS>` | Proxied ✅ | Recebe webhooks externos |
| `chat` | A | `<IP_VPS>` | Proxied ✅ | Chatwoot |
| `wa` | A | `<IP_VPS>` | Proxied ✅ | Evolution API |
| `n8n` | A | `<IP_VPS>` | Proxied ✅ | n8n workflows |

> **⚠️ Regra crítica Vercel + Cloudflare:**  
> O subdomínio `app.` deve ter **proxy desligado** (DNS only — ícone cinza no Cloudflare).  
> A Vercel não recomenda Cloudflare como reverse proxy na frente dela.  
> Use Cloudflare apenas como DNS para `app.` — não como WAF intermediário.

### Como encontrar o IP da VPS

```bash
# No painel Hostinger → VPS → Overview → IP Address
# Ou via SSH:
curl ifconfig.me
```

### Validar propagação DNS

```bash
# Aguardar 5–30 min após criar os registros, então:
dig +short app.ginkgosystems.tech
dig +short api.ginkgosystems.tech
dig +short n8n.ginkgosystems.tech
# Cada um deve retornar o IP correto
```

---

## 3. Configuração Cloudflare

### SSL/TLS
```
Cloudflare → SSL/TLS → Overview
Modo: Full (strict)
```

### Regras de Page Rules (opcional mas recomendado)
```
app.ginkgosystems.tech/*
  → Cache Level: Bypass (dashboard não deve ser cacheado)

hooks.ginkgosystems.tech/*
  → Disable Performance (webhooks precisam de baixa latência)
```

### WAF Rules (básico)
```
Cloudflare → Security → WAF → Managed Rules
  → Cloudflare Managed Ruleset: ON
  → Bot Fight Mode: ON

Rate Limiting (api.ginkgosystems.tech):
  → 100 requests / 1 min por IP
  → Action: Block
```

---

## 4. Vercel — Deploy do Frontend

### Conectar domínio

```bash
# 1. No painel Vercel → Project → Settings → Domains
# Adicionar: app.ginkgosystems.tech

# 2. Vercel vai pedir para criar registro CNAME:
#    app → cname.vercel-dns.com
#    (já feito na seção 2 acima)

# 3. Aguardar verificação (1–5 min)
```

### Deploy via CLI

```bash
cd apps/web
vercel deploy --prod

# Ou automático via GitHub (recomendado):
# Vercel → New Project → Import ginkgo-leaf
# Root Directory: apps/web
# Build Command: pnpm build
# Output Directory: .next
# Framework: Next.js
```

### Variáveis de ambiente no Vercel

```bash
# Painel Vercel → Project → Settings → Environment Variables

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://app.ginkgosystems.tech
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 5. Hostinger VPS — Setup Inicial

### Acesso SSH

```bash
ssh root@<IP_VPS>
# Ou usar o terminal do painel Hostinger
```

### Instalar dependências

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Verificar
docker --version
docker compose version

# Instalar utilitários
apt install -y git curl nano ufw fail2ban
```

### Configurar firewall

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Traefik redirect)
ufw allow 443/tcp   # HTTPS (Traefik)
ufw enable
ufw status
```

### Clonar repositório

```bash
mkdir -p /srv/ginkgo
cd /srv/ginkgo
git clone https://github.com/ginkgosystems/ginkgo-leaf .
```

---

## 6. Docker Compose — Todos os Serviços VPS

**Arquivo:** `/srv/ginkgo/infra/docker/docker-compose.yml`

```yaml
version: "3.8"

networks:
  ginkgo-net:
    driver: bridge

volumes:
  traefik-certs:
  n8n-data:
  evolution-data:
  chatwoot-data:
  redis-data:

services:

  # ── TRAEFIK — Reverse Proxy + SSL ──────────────────────────────────
  traefik:
    image: traefik:v2.11
    restart: always
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge=true"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.le.acme.storage=/certs/acme.json"
      - "--api.dashboard=false"
      - "--log.level=ERROR"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "traefik-certs:/certs"
    networks:
      - ginkgo-net

  # ── REDIS — Cache e Filas ──────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis-data:/data
    networks:
      - ginkgo-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 20s
      timeout: 5s
      retries: 3

  # ── N8N — Orquestração de Workflows ───────────────────────────────
  n8n:
    image: n8nio/n8n:latest
    restart: always
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      - GENERIC_TIMEZONE=America/Sao_Paulo
      - TZ=America/Sao_Paulo
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${SUPABASE_DB_HOST}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${SUPABASE_DB_USER}
      - DB_POSTGRESDB_PASSWORD=${SUPABASE_DB_PASSWORD}
    volumes:
      - n8n-data:/home/node/.n8n
    networks:
      - ginkgo-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`${N8N_HOST}`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=le"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # ── EVOLUTION API — WhatsApp ───────────────────────────────────────
  evolution-api:
    image: atendai/evolution-api:latest
    restart: always
    environment:
      - SERVER_URL=https://${EVOLUTION_HOST}
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=${EVOLUTION_DATABASE_URL}
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
      - LOG_LEVEL=ERROR
      - DEL_INSTANCE=false
      - LANGUAGE=pt-BR
    volumes:
      - evolution-data:/evolution/instances
    networks:
      - ginkgo-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.evolution.rule=Host(`${EVOLUTION_HOST}`)"
      - "traefik.http.routers.evolution.entrypoints=websecure"
      - "traefik.http.routers.evolution.tls.certresolver=le"
      - "traefik.http.services.evolution.loadbalancer.server.port=8080"
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ── CHATWOOT — Inbox Humano ────────────────────────────────────────
  chatwoot:
    image: chatwoot/chatwoot:latest
    restart: always
    environment:
      - RAILS_ENV=production
      - SECRET_KEY_BASE=${CHATWOOT_SECRET_KEY_BASE}
      - DATABASE_URL=${CHATWOOT_DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=https://${CHATWOOT_HOST}
      - DEFAULT_LOCALE=pt_BR
      - ACTIVE_STORAGE_SERVICE=local
      - RAILS_LOG_TO_STDOUT=true
      - ENABLE_ACCOUNT_SIGNUP=false
    volumes:
      - chatwoot-data:/app/storage
    networks:
      - ginkgo-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chatwoot.rule=Host(`${CHATWOOT_HOST}`)"
      - "traefik.http.routers.chatwoot.entrypoints=websecure"
      - "traefik.http.routers.chatwoot.tls.certresolver=le"
      - "traefik.http.services.chatwoot.loadbalancer.server.port=3000"
    depends_on:
      - redis
    command: ["bundle", "exec", "rails", "s", "-b", "0.0.0.0", "-p", "3000"]

  # ── CHATWOOT WORKER ────────────────────────────────────────────────
  chatwoot-worker:
    image: chatwoot/chatwoot:latest
    restart: always
    environment:
      - RAILS_ENV=production
      - SECRET_KEY_BASE=${CHATWOOT_SECRET_KEY_BASE}
      - DATABASE_URL=${CHATWOOT_DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=https://${CHATWOOT_HOST}
    volumes:
      - chatwoot-data:/app/storage
    networks:
      - ginkgo-net
    depends_on:
      - redis
    command: ["bundle", "exec", "sidekiq", "-C", "config/sidekiq.yml"]
```

---

## 7. .env da VPS

**Arquivo:** `/srv/ginkgo/infra/docker/.env`

```bash
# ── TRAEFIK / INFRA ───────────────────────────────────────────────────
ACME_EMAIL=gabriel@ginkgosystems.tech
DOMAIN=ginkgosystems.tech

# ── HOSTNAMES ─────────────────────────────────────────────────────────
N8N_HOST=n8n.ginkgosystems.tech
EVOLUTION_HOST=wa.ginkgosystems.tech
CHATWOOT_HOST=chat.ginkgosystems.tech

# ── N8N ───────────────────────────────────────────────────────────────
N8N_ENCRYPTION_KEY=                  # openssl rand -hex 32
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=             # senha forte

# Supabase DB para n8n (Session Pooler)
SUPABASE_DB_HOST=aws-0-sa-east-1.pooler.supabase.com
SUPABASE_DB_USER=postgres.xxxx
SUPABASE_DB_PASSWORD=

# ── EVOLUTION API ─────────────────────────────────────────────────────
EVOLUTION_API_KEY=                   # gerado no painel Evolution
EVOLUTION_DATABASE_URL=postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/evolution

# ── CHATWOOT ──────────────────────────────────────────────────────────
CHATWOOT_SECRET_KEY_BASE=            # openssl rand -hex 64
CHATWOOT_DATABASE_URL=postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/chatwoot
```

---

## 8. deploy.sh

**Arquivo:** `/srv/ginkgo/infra/docker/deploy.sh`

```bash
#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ginkgo AI Systems — Deploy VPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /srv/ginkgo

echo "→ Pulling latest changes..."
git pull origin main

echo "→ Pulling Docker images..."
docker compose pull

echo "→ Starting containers..."
docker compose up -d --build

echo "→ Container status:"
docker compose ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Validação:"
echo ""
echo "  n8n:      curl https://n8n.ginkgosystems.tech/healthz"
echo "  evolution: curl https://wa.ginkgosystems.tech/"
echo "  chatwoot:  curl https://chat.ginkgosystems.tech/auth/sign_in"
echo "  redis:     docker compose exec redis redis-cli ping"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

```bash
chmod +x infra/docker/deploy.sh
```

---

## 9. Fluxo de Signup Automático

Quando um usuário se cadastra na plataforma, quatro sistemas trabalham juntos automaticamente:

```
USUÁRIO acessa app.ginkgosystems.tech
  ↓
[1] ENTRADA
  Landing page na Vercel
  CTA → "Começar grátis 7 dias"
  Formulário: nome, email, nome do negócio, segmento

  ↓
[2] AUTENTICAÇÃO (Supabase Auth)
  signUp(email, password)
  → cria auth.users
  → dispara trigger: on_auth_user_created

  ↓
[3] PROVISIONAMENTO AUTOMÁTICO (API Fastify)
  POST /api/auth/register
    a. INSERT tenants (name, slug, plan=starter, status=trialing)
    b. INSERT profiles (id=auth.user_id, tenant_id, role=owner)
    c. INSERT memberships (tenant_id, profile_id, role=owner)
    d. INSERT token_balances (balance=600000)  ← cota trial
    e. INSERT tenant_skills (leaf-core ativo)
    f. worker-provisioning: criar instância Evolution + inbox Chatwoot
    g. Stripe: criar Customer (sem cobrança ainda)
    h. Email de boas-vindas com link de onboarding

  ↓
[4] ONBOARDING WIZARD (Vercel → apps/web)
  Passo 1: Conectar WhatsApp (QR Evolution)
  Passo 2: Upload de FAQ / catálogo (RAG ingestion)
  Passo 3: Preview do Brann respondendo
  Passo 4: Dashboard com primeiros dados
  → tenant_id ativo, Brann operando
```

### Trigger no Supabase (automação do passo 2→3)

```sql
-- Criar trigger que dispara o provisionamento quando usuário é criado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir profile base
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  -- Notificar API para completar provisionamento
  PERFORM pg_notify(
    'new_user',
    json_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'metadata', NEW.raw_user_meta_data
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Endpoint de registro (apps/api)

```typescript
// apps/api/src/modules/auth/register.ts

app.post('/auth/register', async (request, reply) => {
  const { userId, email, businessName, segment } = request.body

  // 1. Criar tenant
  const slug = slugify(businessName)
  const { data: tenant } = await supabase
    .from('tenants')
    .insert({ name: businessName, slug, plan: 'starter', status: 'trialing' })
    .select().single()

  // 2. Vincular profile ao tenant
  await supabase.from('profiles')
    .update({ tenant_id: tenant.id })
    .eq('id', userId)

  // 3. Criar membership owner
  await supabase.from('memberships')
    .insert({ tenant_id: tenant.id, profile_id: userId, role: 'owner' })

  // 4. Token balance inicial (trial)
  await supabase.from('token_balances')
    .insert({ tenant_id: tenant.id, balance: 600000 })

  // 5. Ativar skill base
  const { data: skill } = await supabase
    .from('skills').select('id').eq('slug', 'leaf-core').single()
  await supabase.from('tenant_skills')
    .insert({ tenant_id: tenant.id, skill_id: skill.id, status: 'active' })

  // 6. Stripe Customer (sem cobrança)
  const customer = await stripe.customers.create({
    email, name: businessName,
    metadata: { tenant_id: tenant.id }
  })
  await supabase.from('subscriptions')
    .insert({ tenant_id: tenant.id, stripe_customer_id: customer.id,
               plan: 'starter', status: 'trialing' })

  // 7. Provisioning worker (async)
  await redis.lpush('queue:provisioning', JSON.stringify({
    tenant_id: tenant.id, slug, segment
  }))

  return reply.send({ tenant_id: tenant.id, onboarding_url: '/onboarding' })
})
```

---

## 10. Checklist de Infraestrutura — Go-Live

```
DNS E CLOUDFLARE
[ ] 6 registros A/CNAME criados no Cloudflare
[ ] app. com proxy OFF (DNS only)
[ ] api., wa., chat., hooks., n8n. com proxy ON
[ ] SSL/TLS modo Full (strict)
[ ] Propagação DNS validada: dig +short para cada subdomínio

VERCEL
[ ] Projeto conectado ao repositório GitHub
[ ] Build funcionando (pnpm build sem erro)
[ ] Domínio app.ginkgosystems.tech verificado no Vercel
[ ] Variáveis de ambiente configuradas no painel Vercel
[ ] Deploy de produção bem-sucedido

HOSTINGER VPS
[ ] Docker e Docker Compose instalados
[ ] Firewall UFW: 80, 443, 22 liberados
[ ] /srv/ginkgo clonado
[ ] infra/docker/.env preenchido
[ ] Primeiro deploy: bash infra/docker/deploy.sh
[ ] Chatwoot migrations: docker compose run --rm chatwoot bundle exec rails db:chatwoot_prepare
[ ] Todos os containers healthy: docker compose ps

VALIDAÇÃO DOS SERVIÇOS
[ ] curl https://n8n.ginkgosystems.tech/healthz → 200
[ ] curl https://wa.ginkgosystems.tech/ → 200 ou 401
[ ] curl https://chat.ginkgosystems.tech/auth/sign_in → 200
[ ] docker compose exec redis redis-cli ping → PONG

SUPABASE
[ ] supabase db push → 38+ tabelas criadas
[ ] seed/tenant_zero.sql executado
[ ] RLS testado (query com tenant falso → 0 rows)

FLUXO DE SIGNUP
[ ] Cadastro na landing page → tenant criado automaticamente
[ ] Email de boas-vindas enviado
[ ] Redirect para onboarding funcionando
[ ] WhatsApp conectável via QR no wizard
[ ] Brann respondendo após onboarding completo
```

---

## 11. Ordem de Execução — Primeiro Deploy

```
Dia 1 (manhã)
  1. Criar registros DNS no Cloudflare
  2. Aguardar propagação

Dia 1 (tarde)
  3. Conectar projeto no Vercel + variáveis
  4. Primeiro deploy do frontend
  5. Validar app.ginkgosystems.tech

Dia 1 (tarde/noite)
  6. SSH na VPS Hostinger
  7. Instalar Docker e dependências
  8. Clonar repo + preencher .env
  9. docker compose up -d
  10. Validar todos os healthchecks

Dia 2 (manhã)
  11. supabase db push (migrations)
  12. Executar seed Tenant Zero
  13. Importar workflows n8n
  14. Criar instância Evolution + escanear QR
  15. Testar fluxo completo ponta a ponta

Dia 2 (tarde)
  16. Testar signup automático end-to-end
  17. Validar checklist completo
  18. Tenant Zero operando — pronto para clientes
```

---

*Ginkgo AI Systems — INFRA-SETUP.md v1.0.0 — Março 2026*
