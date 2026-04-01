/**
 * Auth module — Register endpoint
 * Creates: profile → membership → tenant (in that order)
 * Uses Supabase Auth for user creation, then populates platform tables.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  company_name: string;
  timezone?: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterBody }>(
    '/auth/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { email, password, name, company_name, timezone } = request.body;

      if (!email || !password || !name || !company_name) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Missing required fields: email, password, name, company_name.',
        });
      }

      const supabase = request.server.supabase;

      if (!supabase) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'Authentication service not configured.',
        });
      }

      // 1. Create auth user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (authError || !authData.user) {
        return reply.status(400).send({
          error: 'Registration Failed',
          message: authError?.message ?? 'Failed to create user.',
        });
      }

      const userId = authData.user.id;
      const tenantId = randomUUID();

      try {
        // 2. Create profile (NO tenant_id — global identity)
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          name,
          email,
          locale: 'pt-BR',
          timezone: timezone ?? 'America/Sao_Paulo',
        });

        if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

        // 3. Create tenant
        const slug = company_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const { error: tenantError } = await supabase.from('tenants').insert({
          id: tenantId,
          name: company_name,
          slug,
          plan: 'starter',
          status: 'trialing',
          timezone: timezone ?? 'America/Sao_Paulo',
        });

        if (tenantError) throw new Error(`Tenant creation failed: ${tenantError.message}`);

        // 4. Create membership (owner + is_primary = true)
        const { error: membershipError } = await supabase.from('memberships').insert({
          tenant_id: tenantId,
          profile_id: userId,
          role: 'owner',
          is_primary: true,
          status: 'active',
          accepted_at: new Date().toISOString(),
        });

        if (membershipError)
          throw new Error(`Membership creation failed: ${membershipError.message}`);

        // 5. Create initial token balance
        const { error: balanceError } = await supabase.from('token_balances').insert({
          tenant_id: tenantId,
          balance: 600000, // starter plan default
          used_period: 0,
        });

        if (balanceError)
          throw new Error(`Token balance creation failed: ${balanceError.message}`);

        return reply.status(201).send({
          user_id: userId,
          tenant_id: tenantId,
          email,
          name,
          company_name,
          plan: 'starter',
        });
      } catch (err) {
        // Attempt cleanup on failure
        app.log.error('Registration cleanup needed:', err);

        // Delete auth user on failure
        await supabase.auth.admin.deleteUser(userId);

        const message = err instanceof Error ? err.message : 'Registration failed.';
        return reply.status(500).send({
          error: 'Registration Failed',
          message,
        });
      }
    }
  );
}
