'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          company_name: companyName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? 'Erro ao criar conta.');
      }

      // Auto-login after registration
      const supabase = createBrowserClient();
      await supabase.auth.signInWithPassword({ email, password });

      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <h1 className="mb-2 text-2xl font-bold text-primary">
          🌿 Criar Conta
        </h1>
        <p className="mb-8 text-secondary">
          Comece a usar agentes de IA no seu negócio.
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-secondary">
              Seu nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-primary outline-none focus:border-accent"
              placeholder="João Silva"
              required
            />
          </div>

          <div>
            <label htmlFor="company" className="mb-1 block text-sm text-secondary">
              Nome da empresa
            </label>
            <input
              id="company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-primary outline-none focus:border-accent"
              placeholder="Minha Empresa"
              required
            />
          </div>

          <div>
            <label htmlFor="register-email" className="mb-1 block text-sm text-secondary">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-primary outline-none focus:border-accent"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="register-password" className="mb-1 block text-sm text-secondary">
              Senha
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-primary outline-none focus:border-accent"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-secondary">
          Já tem conta?{' '}
          <a href="/login" className="text-accent hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </div>
  );
}
