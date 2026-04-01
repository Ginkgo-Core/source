/**
 * Fastify plugin — Supabase client
 * Decorates the Fastify instance with a Supabase service-role client.
 */

import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

async function supabase(app: FastifyInstance): Promise<void> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    app.log.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Supabase plugin skipped.');
    return;
  }

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  app.decorate('supabase', client);
  app.log.info('Supabase plugin registered.');
}

export const supabasePlugin = fp(supabase, {
  name: 'supabase',
});
