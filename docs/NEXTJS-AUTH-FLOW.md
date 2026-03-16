# NEXTJS-AUTH-FLOW.md
## Next.js 14 Auth Flow — Ginkgo AI Systems
### Supabase SSR + App Router + Tenant Context

> **Stack:** Next.js 14 App Router + Supabase SSR (`@supabase/ssr`)  
> **Regra:** Auth via cookies — nunca localStorage no App Router  
> **Padrão:** Server Components para leitura, Client Components para interação

---

## Instalação

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

---

## 1. Clientes Supabase (server vs client)

```typescript
// apps/web/lib/supabase/server.ts
// Usado em Server Components, Route Handlers e Server Actions

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@ginkgo/db/types/database.types'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name)         { return cookieStore.get(name)?.value },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}
```

```typescript
// apps/web/lib/supabase/client.ts
// Usado em Client Components

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@ginkgo/db/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## 2. Middleware — Proteção de Rotas

```typescript
// apps/web/middleware.ts

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name)  { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session (obrigatório para manter cookies atualizados)
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Rotas públicas — não exigem auth
  const publicRoutes = ['/', '/login', '/register', '/auth/callback', '/pricing']
  const isPublic = publicRoutes.some(r => pathname === r || pathname.startsWith('/auth/'))

  // Usuário não autenticado tentando acessar área privada
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuário autenticado tentando acessar login/register
  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Verificar onboarding completo
  if (session && pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single()

    if (!profile?.tenant_id) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## 3. Layouts

### Root Layout

```tsx
// apps/web/app/layout.tsx

import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ginkgo AI Systems',
  description: 'Agentes de IA para o seu negócio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>{children}</body>
    </html>
  )
}
```

### Auth Layout (login/register)

```tsx
// apps/web/app/(auth)/layout.tsx

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A10] flex items-center justify-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

### Dashboard Layout (com sidebar)

```tsx
// apps/web/app/(dashboard)/layout.tsx

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/ui/sidebar'
import { Topbar } from '@/components/ui/topbar'

export default async function DashboardLayout({
  children
}: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Buscar perfil e tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(*)')
    .eq('id', session.user.id)
    .single()

  if (!profile?.tenant_id) redirect('/onboarding')

  return (
    <div className="flex h-screen bg-[#080810]">
      <Sidebar tenant={profile.tenants} role={profile.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar user={profile} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

---

## 4. Páginas de Auth

### Login

```tsx
// apps/web/app/(auth)/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : error.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="p-8 bg-[#0E0E1A] border border-[#2A2A3C] rounded-xl">
      <h1 className="text-2xl font-bold text-white mb-2">Entrar</h1>
      <p className="text-[#707088] text-sm mb-6">Acesse sua plataforma Ginkgo</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs text-[#707088] uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-[#141420] border border-[#2A2A3C] rounded-lg text-white text-sm focus:border-[#6EE7B7] outline-none"
            required
          />
        </div>
        <div>
          <label className="text-xs text-[#707088] uppercase tracking-wide">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-[#141420] border border-[#2A2A3C] rounded-lg text-white text-sm focus:border-[#6EE7B7] outline-none"
            required
          />
        </div>

        {error && <p className="text-[#F87171] text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#6EE7B7] text-[#0A0A10] font-bold rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-xs text-[#707088] mt-4">
        Não tem conta? <a href="/register" className="text-[#6EE7B7]">Criar agora</a>
      </p>
    </div>
  )
}
```

### Register

```tsx
// apps/web/app/(auth)/register/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RegisterPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [form, setForm]     = useState({ name: '', email: '', password: '', businessName: '', segment: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // 1. Criar usuário no Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: {
          full_name:     form.name,
          business_name: form.businessName,
          segment:       form.segment,
        }
      }
    })

    if (authError || !data.user) {
      setError(authError?.message ?? 'Erro ao criar conta')
      setLoading(false)
      return
    }

    // 2. Completar provisionamento via API
    await fetch('/api/auth/complete-registration', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        userId:       data.user.id,
        email:        form.email,
        name:         form.name,
        businessName: form.businessName,
        segment:      form.segment,
      })
    })

    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="p-8 bg-[#0E0E1A] border border-[#2A2A3C] rounded-xl">
      <h1 className="text-2xl font-bold text-white mb-2">Criar conta</h1>
      <p className="text-[#707088] text-sm mb-6">7 dias grátis — sem cartão</p>

      <form onSubmit={handleRegister} className="space-y-3">
        {[
          { key: 'name',         label: 'Seu nome',            type: 'text'     },
          { key: 'email',        label: 'Email',               type: 'email'    },
          { key: 'password',     label: 'Senha',               type: 'password' },
          { key: 'businessName', label: 'Nome do negócio',     type: 'text'     },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-xs text-[#707088] uppercase tracking-wide">{label}</label>
            <input
              type={type}
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full mt-1 px-3 py-2 bg-[#141420] border border-[#2A2A3C] rounded-lg text-white text-sm focus:border-[#6EE7B7] outline-none"
              required
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-[#707088] uppercase tracking-wide">Segmento</label>
          <select
            value={form.segment}
            onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
            className="w-full mt-1 px-3 py-2 bg-[#141420] border border-[#2A2A3C] rounded-lg text-white text-sm"
            required
          >
            <option value="">Selecionar...</option>
            <option value="imobiliaria">Imobiliária</option>
            <option value="clinica">Clínica / Consultório</option>
            <option value="ecommerce">E-commerce</option>
            <option value="servico">Prestador de serviço</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        {error && <p className="text-[#F87171] text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#6EE7B7] text-[#0A0A10] font-bold rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? 'Criando conta...' : 'Criar conta grátis →'}
        </button>
      </form>
    </div>
  )
}
```

### OAuth Callback

```typescript
// apps/web/app/auth/callback/route.ts

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

---

## 5. Contexto do tenant em Server Components

```typescript
// apps/web/lib/get-tenant.ts
// Helper reutilizável para buscar tenant do usuário autenticado

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getTenant() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id, role, name, email,
      tenants (
        id, name, slug, plan, status, config_json,
        subscriptions ( plan, status, trial_ends_at ),
        token_balances ( balance, used_period )
      )
    `)
    .eq('id', session.user.id)
    .single()

  if (error || !profile?.tenants) redirect('/onboarding')

  return {
    user:   { id: profile.id, role: profile.role, name: profile.name },
    tenant: profile.tenants,
  }
}

// Uso em Server Component:
// const { user, tenant } = await getTenant()
```

---

## 6. Rota API: completar registro

```typescript
// apps/web/app/api/auth/complete-registration/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Delegar para a API Fastify
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status })
  }

  return NextResponse.json(data)
}
```

---

## 7. Logout

```typescript
// apps/web/app/api/auth/signout/route.ts

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
}
```

```tsx
// Botão de logout em qualquer componente
<form action="/api/auth/signout" method="POST">
  <button type="submit">Sair</button>
</form>
```

---

## 8. Fluxo de trial → billing

```typescript
// apps/web/middleware.ts — adicionar verificação de trial

// Após validar session e profile, verificar se trial expirou
if (session && pathname.startsWith('/dashboard')) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at')
    .eq('tenant_id', profile.tenant_id)
    .single()

  const trialExpired = sub?.status === 'trialing'
    && sub.trial_ends_at
    && new Date(sub.trial_ends_at) < new Date()

  if (trialExpired && pathname !== '/billing') {
    return NextResponse.redirect(new URL('/billing?trial_expired=true', request.url))
  }
}
```

---

*Ginkgo AI Systems — NEXTJS-AUTH-FLOW.md v1.0.0 — Março 2026*
