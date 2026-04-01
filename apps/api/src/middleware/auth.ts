/**
 * Auth middleware — validates JWT from Supabase Auth.
 * Decorates request with user info.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

/**
 * Validate JWT token from Authorization header.
 * Uses Supabase's getUser() to verify the token.
 */
export async function validateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header.',
    });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = request.server.supabase;

    if (!supabase) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Authentication service not configured.',
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token.',
      });
    }

    request.userId = user.id;
    request.userEmail = user.email;
  } catch {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Token validation failed.',
    });
  }
}
