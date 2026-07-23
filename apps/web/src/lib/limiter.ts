import { createRateLimiter } from "./rate-limit";

// Shared across routes within an instance so one client can't dodge the limit
// by switching endpoints. Coarse by design (see rate-limit.ts).
export const limiter = createRateLimiter(60, 60_000);

export function rateLimitHeaders(remaining: number, resetAt: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
