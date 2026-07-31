import { createRateLimiter } from "./rate-limit";

// Shared across routes so one client can't dodge the limit by switching endpoints.
export const limiter = createRateLimiter(60, 60_000);

export function rateLimitHeaders(remaining: number, resetAt: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
