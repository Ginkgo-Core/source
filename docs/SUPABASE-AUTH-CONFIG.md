# SUPABASE-AUTH-CONFIG.md
## Configuração do Supabase Auth — Ginkgo AI Systems
### Checklist completo do painel + código

> **Projeto Supabase:** https://supabase.com/dashboard  
> **Domínio:** ginkgosystems.tech  
> **Executar antes do FE-01**

---

## 1. URLs e Redirects

```
Supabase Dashboard
  → Authentication
    → URL Configuration

Site URL:
  https://app.ginkgosystems.tech

Redirect URLs (adicionar todas):
  https://app.ginkgosystems.tech/**
  https://app.ginkgosystems.tech/auth/callback
  https://app.ginkgosystems.tech/onboarding
  https://app.ginkgosystems.tech/dashboard
  http://localhost:3000/**             ← desenvolvimento local
  http://localhost:3000/auth/callback  ← desenvolvimento local
```

---

## 2. Email Settings

```
Authentication → Email Templates → Configurações gerais

Sender name:  Ginkgo AI
Sender email: oi@ginkgosystems.tech

SMTP personalizado (usando Resend):
  Host:     smtp.resend.com
  Port:     465
  Username: resend
  Password: re_xxxxx  ← RESEND_API_KEY
  Encryption: SSL/TLS

→ Salvar e testar envio
```

---

## 3. Email Templates Customizados

### Confirmação de email

```
Authentication → Email Templates → Confirm signup

Subject:
  Confirme seu email — Ginkgo AI

Body (HTML):
<h2>Bem-vindo à Ginkgo!</h2>
<p>Clique no link abaixo para confirmar seu email e começar seu trial gratuito:</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#6EE7B7;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Confirmar email →</a></p>
<p style="color:#888;font-size:12px;">Link válido por 24h. Se não foi você, ignore este email.</p>
```

### Reset de senha

```
Authentication → Email Templates → Reset password

Subject:
  Redefinir senha — Ginkgo AI

Body (HTML):
<h2>Redefinição de senha</h2>
<p>Clique no link abaixo para criar uma nova senha:</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#6EE7B7;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Redefinir senha →</a></p>
<p style="color:#888;font-size:12px;">Link válido por 1h.</p>
```

### Magic Link (se usar)

```
Authentication → Email Templates → Magic Link

Subject:
  Seu link de acesso — Ginkgo AI

Body (HTML):
<h2>Seu link de acesso</h2>
<p><a href="{{ .ConfirmationURL }}">Entrar na Ginkgo →</a></p>
<p style="color:#888;font-size:12px;">Link válido por 1h.</p>
```

---

## 4. JWT Settings

```
Authentication → JWT Settings

JWT Expiry:
  Access token:  3600   (1 hora — padrão OK)
  Refresh token: 604800 (7 dias)

JWT Secret:
  → Copiar e salvar como SUPABASE_JWT_SECRET no .env
  → Nunca rotacionar em produção sem invalidar todas as sessões
```

---

## 5. OAuth Providers

### Google (para GMB + Drive + YouTube)

```
Authentication → Providers → Google → Enable

Client ID:      → Google Console → Credentials → OAuth 2.0 Client ID
Client Secret:  → Google Console → Credentials → Client Secret

Authorized redirect URI (copiar do Supabase e colar no Google Console):
  https://<project>.supabase.co/auth/v1/callback

Scopes adicionais (configurar na integração, não no Supabase Auth):
  O Supabase Auth só gerencia o login Google.
  Os scopes de GMB/Drive/Ads são gerenciados via OAuth personalizado
  na rota /api/oauth/google/connect
```

**Setup no Google Cloud Console:**
```
1. console.cloud.google.com
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs:
   https://<project>.supabase.co/auth/v1/callback
   https://app.ginkgosystems.tech/api/oauth/google/callback
5. Habilitar APIs:
   - Google My Business API
   - Google Drive API
   - YouTube Data API v3
   - Google Ads API
   - Google Analytics Data API
```

### Meta (para Instagram + Facebook)

```
Authentication → Providers → Facebook → Enable
(Supabase usa "Facebook" para Meta OAuth)

App ID:     → developers.facebook.com → seu app → Basic Settings
App Secret: → idem

Valid OAuth Redirect URIs (no Meta for Developers):
  https://<project>.supabase.co/auth/v1/callback
  https://app.ginkgosystems.tech/api/oauth/meta/callback

Permissions necessárias no Meta App:
  pages_show_list
  pages_read_engagement
  instagram_basic
  instagram_manage_insights
  pages_messaging
  ads_read
  ads_management
  leads_retrieval
```

**App Review no Meta:**
```
Para usar em produção (não apenas para si mesmo), submeter para App Review:
  - pages_read_engagement (nível avançado)
  - instagram_manage_insights
  - ads_management
Tempo estimado de review: 1–5 dias úteis
```

---

## 6. Rate Limits de Auth

```
Authentication → Rate Limits

Email confirmations: 5 por hora por email (padrão OK)
SMS OTP:            Não usar em P1
Sign ups:            Deixar em 30/hora (padrão)
Sign ins:            Deixar em 30/hora (padrão)

→ Se necessário aumentar para clientes com alto volume,
  alterar via Supabase CLI ou dashboard
```

---

## 7. Trigger on_auth_user_created

```sql
-- Executar no SQL Editor do Supabase após migrations

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar profile base
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Notificar API via pg_notify para completar provisionamento
  PERFORM pg_notify(
    'new_user_registered',
    json_build_object(
      'user_id',       NEW.id,
      'email',         NEW.email,
      'business_name', NEW.raw_user_meta_data->>'business_name',
      'segment',       NEW.raw_user_meta_data->>'segment',
      'full_name',     NEW.raw_user_meta_data->>'full_name'
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verificar se trigger foi criado
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

---

## 8. Policies RLS para Auth

```sql
-- Garantir que usuário só acessa seu próprio profile

-- Profiles: usuário vê e edita apenas o seu
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Memberships: usuário vê apenas as suas
CREATE POLICY "Users can view own memberships"
  ON memberships FOR SELECT
  USING (
    profile_id = auth.uid()
  );

-- Tenants: usuário vê o tenant ao qual pertence
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM memberships WHERE profile_id = auth.uid()
    )
  );
```

---

## 9. Variáveis de ambiente geradas

```bash
# Copiar do painel Supabase → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...     # anon/public key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...          # service_role key (PRIVADA)
SUPABASE_JWT_SECRET=...                         # JWT Secret

# OAuth (do Google Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://app.ginkgosystems.tech/api/oauth/google/callback

# OAuth (do Meta for Developers)
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...   # string aleatória que você define
```

---

## 10. Checklist de configuração

```
PAINEL SUPABASE — Authentication
[ ] Site URL configurado: https://app.ginkgosystems.tech
[ ] Redirect URLs adicionadas (produção + localhost)
[ ] SMTP customizado com Resend configurado e testado
[ ] Templates de email customizados (confirm + reset)
[ ] JWT Expiry: access 3600 / refresh 604800
[ ] Google OAuth habilitado com Client ID e Secret
[ ] Meta/Facebook OAuth habilitado (se P2 — pode deixar para depois)

GOOGLE CLOUD CONSOLE
[ ] Projeto criado
[ ] OAuth 2.0 Client ID criado
[ ] Redirect URIs adicionados (Supabase + app)
[ ] APIs habilitadas: GMB, Drive, YouTube, Ads, Analytics

META FOR DEVELOPERS
[ ] App criado em modo desenvolvimento
[ ] Permissions solicitadas
[ ] Redirect URIs configuradas

SQL (executar no Supabase SQL Editor)
[ ] Trigger on_auth_user_created criado
[ ] Policies de auth (profiles, memberships, tenants)
[ ] Verificar: SELECT * FROM profiles LIMIT 1 (após criar conta de teste)

TESTE END-TO-END
[ ] Criar conta → email de confirmação recebido
[ ] Confirmar email → redirect para onboarding
[ ] Login → redirect para dashboard
[ ] Logout → redirect para login
[ ] Trial expirado → redirect para billing
[ ] Usuário sem tenant → redirect para onboarding
```

---

*Ginkgo AI Systems — SUPABASE-AUTH-CONFIG.md v1.0.0 — Março 2026*
