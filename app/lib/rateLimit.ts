/**
 * Simple in-memory rate limiter for API routes.
 *
 * Provides per-key sliding-window rate limiting within a single Lambda instance.
 * Not shared across instances — provides basic protection, not ironclad.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   const result = limiter.check(userId);
 *   if (!result.allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Max requests per window per key */
  max: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup of expired entries (every 60s)
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      cleanup();
      const now = Date.now();
      const existing = store.get(key);

      if (!existing || existing.resetAt <= now) {
        // New window
        store.set(key, { count: 1, resetAt: now + options.windowMs });
        return { allowed: true, remaining: options.max - 1, resetAt: now + options.windowMs };
      }

      existing.count++;
      if (existing.count > options.max) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
      }

      return { allowed: true, remaining: options.max - existing.count, resetAt: existing.resetAt };
    },
  };
}

// Pre-configured limiters for different route types
/** Bedrock/Polly routes — 20 requests per minute per user */
export const aiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
/** General API routes — 60 requests per minute per user */
export const apiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
