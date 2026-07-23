import type { APIRoute } from "astro";
import { fetchContributions, isError, statusForError } from "../../../lib/contributions";
import { limiter, rateLimitHeaders } from "../../../lib/limiter";

export const GET: APIRoute = async ({ params, clientAddress }) => {
  const ip = clientAddress ?? "unknown";
  const gate = limiter.check(ip);
  const rlHeaders = rateLimitHeaders(gate.remaining, gate.resetAt);

  if (!gate.ok) {
    const retryAfter = Math.max(1, Math.ceil((gate.resetAt - Date.now()) / 1000));
    return Response.json(
      { error: "too many requests", kind: "rate_limited" },
      { status: 429, headers: { ...rlHeaders, "Retry-After": String(retryAfter) } }
    );
  }

  const result = await fetchContributions(params.username ?? "");

  if (isError(result)) {
    return Response.json(result, { status: statusForError(result.kind), headers: rlHeaders });
  }

  return Response.json(result, {
    status: 200,
    headers: {
      ...rlHeaders,
      "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
    },
  });
};
