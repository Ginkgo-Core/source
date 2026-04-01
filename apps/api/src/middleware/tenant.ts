/**
 * Tenant middleware — resolves the active tenant for the request.
 * Reads tenant from X-Tenant-Id header or ginkgo-workspace cookie.
 * Validates user membership before granting access.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    memberRole?: string;
  }
}

/**
 * Resolve and validate tenant context.
 * Must run AFTER validateJWT.
 */
export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.userId;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Must authenticate before resolving tenant.',
    });
  }

  // Tenant ID from header (API clients) or cookie (web dashboard)
  const tenantId =
    (request.headers['x-tenant-id'] as string) ??
    parseCookie(request.headers.cookie, 'ginkgo-workspace');

  if (!tenantId) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Missing tenant context. Set X-Tenant-Id header or ginkgo-workspace cookie.',
    });
  }

  // Validate membership
  const supabase = request.server.supabase;

  if (!supabase) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Database service not configured.',
    });
  }

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('role, status')
    .eq('tenant_id', tenantId)
    .eq('profile_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !membership) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'No active membership for this tenant.',
    });
  }

  request.tenantId = tenantId;
  request.memberRole = membership.role as string;
}

/**
 * Parse a specific cookie value from the cookie header string.
 */
function parseCookie(
  cookieHeader: string | undefined,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;

  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));

  return match ? match.split('=')[1] : undefined;
}
