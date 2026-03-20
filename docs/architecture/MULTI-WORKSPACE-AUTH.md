# MULTI-WORKSPACE-AUTH.md
## Especificação de Autenticação Multi-Workspace
### Como um usuário acessa múltiplos tenants

> **Versão:** 1.0.0 | **Decisão:** 1 email pode ter N tenants (via memberships)  
> **Impacta:** middleware.ts · get-tenant.ts · JWT · FE-01 · TENANT-PROVISIONING

---

## Decisão Central

```
1 auth.users (email) pode pertencer a N tenants via memberships

Exemplos válidos:
  gabriel@empresa.com
    → owner de "Imobiliária Silva" (tenant A)
    → owner de "Clínica Dr. Ana" (tenant B)      ← plano Scale (multi-workspace)
    → admin de "Agência Digital X" (tenant C)    ← convidado por outro owner

  ana@agencia.com
    → owner de "Agência Digital X"
    → admin de "Cliente 1 da Agência"             ← white-label futuro
    → viewer de "Cliente 2 da Agência"
```

**Multi-workspace = plano Scale permite criar mais de 1 tenant sob o mesmo email de billing.**

---

## Modelo de Dados

```sql
-- Um usuário pode ter múltiplos memberships em múltiplos tenants
-- Isso já existe nas migrations — só precisamos garantir que o
-- frontend e o middleware suportam a troca de workspace

-- profiles: 1 registro por auth.users (não por tenant)
ALTER TABLE profiles
  DROP COLUMN IF EXISTS tenant_id; -- tenant_id NÃO fica no profile
  -- tenant_id fica apenas em memberships

-- memberships: é a tabela de ligação N:N
-- tenant_id + profile_id → role
-- Já existe na migration 001_platform_core.sql ✅

-- Índice para listar todos os tenants de um usuário
CREATE INDEX IF NOT EXISTS idx_memberships_profile
  ON memberships(profile_id, tenant_id);
```

---

## JWT — Como o tenant_id é carregado

### Problema
O Supabase JWT não carrega `tenant_id` automaticamente. Precisamos de uma estratégia para que o servidor saiba qual tenant está ativo na requisição.

### Solução: Workspace ativo via cookie + header

```typescript
// O workspace ativo é armazenado em:
// 1. Cookie HTTP-only: ginkgo-workspace (para SSR Next.js)
// 2. Header X-Tenant-ID (para chamadas API direta)

// Nunca no JWT payload (o JWT é do Supabase, não podemos alterar)
```

### Fluxo após login

```
1. Login Supabase Auth → JWT emitido (sem tenant_id)
2. Next.js chama GET /api/workspaces (lista todos os tenants do usuário)
3. Se 1 workspace → selecionar automaticamente
4. Se N workspaces → mostrar WorkspaceSwitcher antes do dashboard
5. Workspace selecionado → setar cookie ginkgo-workspace={tenant_id}
6. Todas as requisições subsequentes incluem o tenant_id do cookie
```

---

## API: GET /api/workspaces

```typescript
// apps/web/app/api/workspaces/route.ts

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: memberships } = await supabase
    .from('memberships')
    .select(`
      role,
      tenants (
        id, name, slug, plan, status,
        subscriptions ( plan, status ),
        token_balances ( balance )
      )
    `)
    .eq('profile_id', session.user.id)
    .eq('status', 'accepted')  // só memberships aceitos

  return NextResponse.json({
    workspaces: memberships?.map(m => ({
      tenant_id:   m.tenants.id,
      name:        m.tenants.name,
      slug:        m.tenants.slug,
      plan:        m.tenants.plan,
      role:        m.role,
      token_balance: m.tenants.token_balances?.balance ?? 0,
    })) ?? []
  })
}
```

---

## Middleware atualizado

```typescript
// apps/web/middleware.ts — versão final com multi-workspace

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* ... SSR cookie handlers ... */ } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // 1. Rotas públicas
  const publicRoutes = ['/', '/login', '/register', '/auth/callback', '/pricing']
  if (publicRoutes.includes(pathname)) {
    if (session && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // 2. Sem sessão → login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Workspace selection obrigatória antes do dashboard
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/inbox')) {
    const activeWorkspace = request.cookies.get('ginkgo-workspace')?.value

    if (!activeWorkspace) {
      // Buscar workspaces do usuário
      const { data: memberships } = await supabase
        .from('memberships')
        .select('tenant_id, role, tenants(status)')
        .eq('profile_id', session.user.id)

      const active = memberships?.filter(m => m.tenants?.status === 'active')

      if (!active || active.length === 0) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }

      if (active.length === 1) {
        // Auto-selecionar o único workspace
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set('ginkgo-workspace', active[0].tenant_id, {
          httpOnly: true, secure: true, sameSite: 'lax', path: '/'
        })
        return response
      }

      // Múltiplos workspaces → seleção obrigatória
      return NextResponse.redirect(new URL('/workspace-select', request.url))
    }

    // 4. Workspace ativo → verificar se usuário tem acesso
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('profile_id', session.user.id)
      .eq('tenant_id', activeWorkspace)
      .single()

    if (!membership) {
      // Workspace inválido → limpar cookie e redirecionar
      response = NextResponse.redirect(new URL('/workspace-select', request.url))
      response.cookies.delete('ginkgo-workspace')
      return response
    }

    // 5. Trial expirado → billing
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('tenant_id', activeWorkspace)
      .single()

    const trialExpired = sub?.status === 'trialing'
      && sub.trial_ends_at
      && new Date(sub.trial_ends_at) < new Date()

    if (trialExpired && !pathname.startsWith('/billing')) {
      return NextResponse.redirect(new URL('/billing?trial_expired=true', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)']
}
```

---

## get-tenant.ts atualizado

```typescript
// apps/web/lib/get-tenant.ts

import { createClient }  from '@/lib/supabase/server'
import { cookies }       from 'next/headers'
import { redirect }      from 'next/navigation'

export async function getTenant() {
  const supabase      = createClient()
  const cookieStore   = cookies()
  const tenant_id     = cookieStore.get('ginkgo-workspace')?.value

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  if (!tenant_id) redirect('/workspace-select')

  // Verificar membership (RLS não substitui — verificação explícita)
  const { data: membership } = await supabase
    .from('memberships')
    .select(`
      role,
      tenants (
        id, name, slug, plan, status, config_json, timezone,
        subscriptions ( plan, status, trial_ends_at ),
        token_balances ( balance, used_period )
      )
    `)
    .eq('profile_id', session.user.id)
    .eq('tenant_id', tenant_id)
    .single()

  if (!membership) redirect('/workspace-select')

  return {
    user:      { id: session.user.id, role: membership.role },
    tenant:    membership.tenants,
    tenant_id, // conveniência
  }
}

// Para Server Components que precisam só do tenant_id sem query completa:
export async function getTenantId(): Promise<string> {
  const cookieStore = cookies()
  const tenant_id   = cookieStore.get('ginkgo-workspace')?.value
  if (!tenant_id) redirect('/workspace-select')
  return tenant_id
}
```

---

## WorkspaceSwitcher — Componente

```tsx
// apps/web/app/workspace-select/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter }            from 'next/navigation'

export default function WorkspaceSelectPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(d => setWorkspaces(d.workspaces))
  }, [])

  async function select(tenant_id: string) {
    await fetch('/api/workspaces/select', {
      method: 'POST',
      body:   JSON.stringify({ tenant_id })
    })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0A0A10] flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-[#0E0E1A] border border-[#2A2A3C] rounded-xl">
        <h1 className="text-xl font-bold text-white mb-6">Escolher workspace</h1>
        <div className="space-y-3">
          {workspaces.map(ws => (
            <button
              key={ws.tenant_id}
              onClick={() => select(ws.tenant_id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border
                         border-[#2A2A3C] hover:border-[#6EE7B7] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6EE7B7] to-[#34d399]
                              flex items-center justify-center text-sm font-bold text-[#0A0A10]">
                {ws.name[0]}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-white">{ws.name}</div>
                <div className="text-xs text-[#707088]">{ws.plan} · {ws.role}</div>
              </div>
              <div className="text-xs text-[#6EE7B7] font-mono">
                {(ws.token_balance / 1000).toFixed(0)}k tokens
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push('/onboarding?new=true')}
          className="w-full mt-4 py-2.5 border border-dashed border-[#2A2A3C]
                     text-[#707088] rounded-lg text-sm hover:border-[#6EE7B7]
                     hover:text-[#6EE7B7] transition-colors"
        >
          + Criar novo workspace
        </button>
      </div>
    </div>
  )
}
```

---

## Regras de billing multi-workspace (plano Scale)

```
Plano Scale → max 3 workspaces sob o mesmo billing
  - 1 Stripe Customer
  - 1 fatura consolidada
  - Tokens COMPARTILHADOS entre workspaces (pool único)
  - Cada workspace tem seus próprios agentes e integrações

Workspaces adicionais além do plano:
  +R$197/mês por workspace extra (qualquer plano)

Convidar membro para workspace (não cria novo workspace):
  - Qualquer plano
  - Membro paga R$0 (usa tokens do owner)
  - Roles: admin | operator | viewer
```

---

## Checklist de implementação

```
[ ] INDEX idx_memberships_profile criado (migration 001)
[ ] profiles.tenant_id removido (estava errado — tenant fica em memberships)
[ ] GET /api/workspaces retornando lista correta
[ ] POST /api/workspaces/select setando cookie ginkgo-workspace
[ ] middleware.ts com workspace check completo
[ ] get-tenant.ts lendo do cookie
[ ] WorkspaceSelectPage renderizando para N workspaces
[ ] Auto-seleção para usuário com 1 único workspace
[ ] Plano Scale: lógica de máx 3 workspaces no /auth/register
[ ] Token pool compartilhado para multi-workspace (billing.ts)
```

---

*Ginkgo AI Systems — MULTI-WORKSPACE-AUTH.md v1.0.0 — Março 2026*
