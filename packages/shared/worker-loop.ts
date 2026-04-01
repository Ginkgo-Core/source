/**
 * @ginkgo/shared — worker-loop.ts
 * Generic worker loop with retry and graceful shutdown.
 * KI-5: Idempotency required for external events.
 */

import { dequeue } from './queue';
import type { QueueJob } from './queue';

export interface WorkerOptions {
  queueName: string;
  handler: (job: QueueJob) => Promise<void>;
  pollIntervalMs?: number;
  maxRetries?: number;
  onError?: (error: Error, job: QueueJob) => void;
}

/**
 * Run a worker loop that polls a Redis queue and processes jobs.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 */
export async function runWorker(options: WorkerOptions): Promise<void> {
  const {
    queueName,
    handler,
    pollIntervalMs = 5000,
    maxRetries = 3,
    onError,
  } = options;

  let running = true;

  const shutdown = () => {
    console.log(`[WORKER:${queueName}] Shutting down gracefully...`);
    running = false;
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log(`[WORKER:${queueName}] Started. Polling every ${pollIntervalMs}ms.`);

  while (running) {
    try {
      const job = await dequeue(queueName, Math.floor(pollIntervalMs / 1000));

      if (!job) continue;

      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        attempt++;
        try {
          await handler(job);
          success = true;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error(
            `[WORKER:${queueName}] Job ${job.id} attempt ${attempt}/${maxRetries} failed:`,
            error.message
          );

          if (attempt >= maxRetries) {
            console.error(`[WORKER:${queueName}] Job ${job.id} permanently failed.`);
            onError?.(error, job);
          } else {
            // Exponential backoff
            await sleep(Math.min(1000 * Math.pow(2, attempt), 30000));
          }
        }
      }
    } catch (err) {
      console.error(`[WORKER:${queueName}] Poll error:`, err);
      await sleep(pollIntervalMs);
    }
  }

  console.log(`[WORKER:${queueName}] Stopped.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
