/**
 * Ginkgo Leaf API — Fastify Server
 * Entry point for the backend API.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { supabasePlugin } from './plugins/supabase';
import { redisPlugin } from './plugins/redis';
import { healthRoutes } from './modules/health/routes';

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const HOST = process.env['API_HOST'] ?? '0.0.0.0';
const LOG_LEVEL = process.env['API_LOG_LEVEL'] ?? 'info';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
    },
  });

  // Security
  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Plugins
  await app.register(supabasePlugin);
  await app.register(redisPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/' });

  // Start
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🌿 Ginkgo Leaf API running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
