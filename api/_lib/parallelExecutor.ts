/**
 * Parallel Executor — Concurrent task execution with concurrency limit
 *
 * Run N tasks in parallel with configurable concurrency, timeout, and retry.
 * Useful for: parallel AI calls, batch Firestore operations, multi-tool execution.
 *
 * Usage:
 *   const results = await parallelExecute(tasks, { concurrency: 3, timeoutMs: 10000 });
 */

import type { Result } from '../../shared/types/result.js';
import { Ok, Err, AppErrors } from '../../shared/types/result.js';

// ============================================
// Types
// ============================================

export interface ParallelTask<T> {
  id: string;
  fn: () => Promise<T>;
  priority?: number;          // Higher = runs first (default 0)
  retries?: number;           // Override per-task retry count
  timeoutMs?: number;         // Override per-task timeout
}

export interface ParallelOptions {
  concurrency?: number;       // Max concurrent tasks (default: 5)
  timeoutMs?: number;         // Per-task timeout (default: 30000)
  retries?: number;           // Retry count on failure (default: 1)
  retryDelayMs?: number;      // Delay between retries (default: 500)
  onProgress?: (completed: number, total: number, taskId: string) => void;
  abortSignal?: AbortSignal;
}

export interface TaskResult<T> {
  id: string;
  result: Result<T>;
  durationMs: number;
  retries: number;
}

export interface ParallelResult<T> {
  results: TaskResult<T>[];
  totalMs: number;
  succeeded: number;
  failed: number;
}

// ============================================
// Executor
// ============================================

export async function parallelExecute<T>(
  tasks: ParallelTask<T>[],
  options: ParallelOptions = {}
): Promise<ParallelResult<T>> {
  const {
    concurrency = 5,
    timeoutMs = 30_000,
    retries = 1,
    retryDelayMs = 500,
    onProgress,
    abortSignal,
  } = options;

  const startTime = Date.now();

  // Sort by priority (descending)
  const sorted = [...tasks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const results: TaskResult<T>[] = [];
  let completed = 0;
  let taskIndex = 0;

  // Semaphore-based concurrency control
  async function runNext(): Promise<void> {
    while (taskIndex < sorted.length) {
      if (abortSignal?.aborted) return;

      const task = sorted[taskIndex++];
      const taskTimeout = task.timeoutMs ?? timeoutMs;
      const taskRetries = task.retries ?? retries;
      const taskStart = Date.now();
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount <= taskRetries) {
        if (abortSignal?.aborted) {
          results.push({
            id: task.id,
            result: Err(AppErrors.internal('Aborted')),
            durationMs: Date.now() - taskStart,
            retries: retryCount,
          });
          return;
        }

        try {
          const value = await withTimeout(task.fn(), taskTimeout);
          results.push({
            id: task.id,
            result: Ok(value),
            durationMs: Date.now() - taskStart,
            retries: retryCount,
          });
          break;
        } catch (err: any) {
          lastError = err;
          retryCount++;

          if (retryCount <= taskRetries) {
            await sleep(retryDelayMs * retryCount);
          } else {
            // All retries exhausted
            results.push({
              id: task.id,
              result: Err(
                err.name === 'TimeoutError'
                  ? AppErrors.timeout(task.id, taskTimeout)
                  : AppErrors.internal(err.message, err)
              ),
              durationMs: Date.now() - taskStart,
              retries: retryCount - 1,
            });
          }
        }
      }

      completed++;
      onProgress?.(completed, sorted.length, task.id);
    }
  }

  // Launch concurrent workers
  const workers = Array.from(
    { length: Math.min(concurrency, sorted.length) },
    () => runNext()
  );

  await Promise.all(workers);

  const succeeded = results.filter(r => r.result.ok).length;

  return {
    results,
    totalMs: Date.now() - startTime,
    succeeded,
    failed: results.length - succeeded,
  };
}

// ============================================
// Convenience: Map with concurrency
// ============================================

/**
 * Like Promise.all but with concurrency limit.
 * Simpler API when you just need to map over items.
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: Omit<ParallelOptions, 'onProgress'> & { concurrency?: number } = {}
): Promise<Result<R>[]> {
  const tasks: ParallelTask<R>[] = items.map((item, index) => ({
    id: `item_${index}`,
    fn: () => fn(item, index),
  }));

  const result = await parallelExecute(tasks, options);

  // Return in original order
  const ordered = new Array<Result<R>>(items.length);
  for (const r of result.results) {
    const idx = parseInt(r.id.split('_')[1], 10);
    ordered[idx] = r.result;
  }
  return ordered;
}

// ============================================
// Batch: Split array into chunks and process
// ============================================

export async function batchProcess<T, R>(
  items: T[],
  batchFn: (batch: T[]) => Promise<R>,
  batchSize = 10,
  options: ParallelOptions = {}
): Promise<ParallelResult<R>> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const tasks: ParallelTask<R>[] = batches.map((batch, index) => ({
    id: `batch_${index}`,
    fn: () => batchFn(batch),
  }));

  return parallelExecute(tasks, options);
}

// ============================================
// Helpers
// ============================================

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Timed out after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
