// Fixed-window per-key rate limiter. In-memory and per-instance, so it is a
// coarse abuse guard rather than a strict global quota. Good enough to keep a
// single client from hammering the GitHub scrape.

type Window = { count: number; resetAt: number };

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimiter = {
  check: (key: string) => RateLimitResult;
};

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const windows = new Map<string, Window>();

  const check = (key: string): RateLimitResult => {
    const now = Date.now();
    const existing = windows.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      windows.set(key, { count: 1, resetAt });
      return { ok: true, remaining: limit - 1, resetAt };
    }

    existing.count += 1;
    const remaining = Math.max(0, limit - existing.count);
    return { ok: existing.count <= limit, remaining, resetAt: existing.resetAt };
  };

  return { check };
}
