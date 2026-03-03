/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 *
 * NOTE: Vercel functions are stateless — each container instance has its own Map.
 * This provides burst protection at the container level, not globally.
 * For global rate limiting, use Upstash Redis (@upstash/ratelimit).
 *
 * Usage:
 *   const { allowed, remaining, resetMs } = checkRateLimit(identifier, 10, 60_000);
 *   if (!allowed) return res.status(429).json({ error: 'Çok fazla istek. Lütfen bekleyin.' });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Module-level store — shared within a single container instance's lifetime.
const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries (every 5 minutes) to prevent memory leaks.
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't keep the process alive just for cleanup
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as NodeJS.Timeout).unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number; // ms until window resets
}

/**
 * @param identifier  Usually req.userUid or IP address
 * @param limit       Max requests allowed in the window
 * @param windowMs    Time window in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs = 60_000
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || existing.resetAt <= now) {
    // New window
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const resetMs = existing.resetAt - now;

  return {
    allowed: existing.count <= limit,
    remaining,
    resetMs,
  };
}

/**
 * Pre-configured limiters for common use cases.
 */
export const LIMITS = {
  /** AI caption generation: 20 req / minute per user */
  AI_CAPTION: { limit: 20, windowMs: 60_000 },

  /** Heavy AI analysis (brand, campaign): 10 req / minute per user */
  AI_ANALYSIS: { limit: 10, windowMs: 60_000 },

  /** Persona chat: 30 messages / minute per user */
  AI_CHAT: { limit: 30, windowMs: 60_000 },

  /** Workflow AI designer: 15 req / minute per user */
  AI_WORKFLOW: { limit: 15, windowMs: 60_000 },

  /** Video transcription (expensive): 5 req / minute per user */
  AI_TRANSCRIBE: { limit: 5, windowMs: 60_000 },

  /** Marketing AI agent: 20 req / minute per user */
  MARKETING_AGENT: { limit: 20, windowMs: 60_000 },

  /** Task AI intake chat: 20 req / minute per user */
  AI_TASK_INTAKE: { limit: 20, windowMs: 60_000 },

  /** Workflow builder AI chat: 20 req / minute per user */
  AI_BUILDER_CHAT: { limit: 20, windowMs: 60_000 },
} as const;

/**
 * Convenience: apply a rate limit and return 429 response if exceeded.
 * Returns `true` if the request should continue, `false` if rate-limited.
 *
 * @example
 *   if (!applyRateLimit(res, req.userUid, LIMITS.AI_CAPTION)) return;
 */
export function applyRateLimit(
  res: { status: (code: number) => { json: (body: object) => void } },
  identifier: string,
  config: { limit: number; windowMs: number }
): boolean {
  const result = checkRateLimit(identifier, config.limit, config.windowMs);

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.resetMs / 1000);
    res.status(429).json({
      error: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
      retryAfterSeconds: retryAfterSec,
    });
    return false;
  }

  return true;
}
