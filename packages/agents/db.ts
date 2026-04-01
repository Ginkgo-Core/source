/**
 * @ginkgo/agents — db.ts
 * Singleton Supabase client for the agent kernel.
 * KI-3: No client creation outside this file.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase service-role client.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * All kernel operations go through this client.
 */
export function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    throw new Error(
      '[KERNEL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

/**
 * Returns a Supabase client scoped to a specific tenant via RLS.
 * Sets app.tenant_id for current_tenant_id() function in Postgres.
 */
export async function getTenantClient(tenantId: string): Promise<SupabaseClient> {
  const supabase = getClient();

  // Set the tenant context for RLS policies
  await supabase.rpc('set_config', {
    setting_name: 'app.tenant_id',
    setting_value: tenantId,
  });

  return supabase;
}
