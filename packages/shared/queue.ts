/**
 * @ginkgo/shared — queue.ts
 * Simple Redis LPUSH-based queue helper.
 * Phase 1: LPUSH. Phase 2: BullMQ via content-recycler.
 */

import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
  });

  return redis;
}

export interface QueueJob {
  id: string;
  type: string;
  tenantId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Enqueue a job via Redis LPUSH.
 */
export async function enqueue(
  queueName: string,
  job: Omit<QueueJob, 'createdAt'>
): Promise<void> {
  const r = getRedis();
  const entry: QueueJob = {
    ...job,
    createdAt: new Date().toISOString(),
  };
  await r.lpush(`queue:${queueName}`, JSON.stringify(entry));
}

/**
 * Dequeue a job via Redis BRPOP (blocking).
 */
export async function dequeue(
  queueName: string,
  timeoutSeconds: number = 5
): Promise<QueueJob | null> {
  const r = getRedis();
  const result = await r.brpop(`queue:${queueName}`, timeoutSeconds);

  if (!result) return null;

  return JSON.parse(result[1]) as QueueJob;
}

/**
 * Get queue length.
 */
export async function queueLength(queueName: string): Promise<number> {
  const r = getRedis();
  return r.llen(`queue:${queueName}`);
}
