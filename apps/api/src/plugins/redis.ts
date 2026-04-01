/**
 * Fastify plugin — Redis client
 * Decorates the Fastify instance with an ioredis client.
 */

import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redis(app: FastifyInstance): Promise<void> {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
  });

  client.on('error', (err) => {
    app.log.error('Redis connection error:', err.message);
  });

  client.on('connect', () => {
    app.log.info('Redis connected.');
  });

  app.decorate('redis', client);

  app.addHook('onClose', async () => {
    await client.quit();
  });

  app.log.info('Redis plugin registered.');
}

export const redisPlugin = fp(redis, {
  name: 'redis',
});
