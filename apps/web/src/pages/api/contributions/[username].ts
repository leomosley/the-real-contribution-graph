import type { APIRoute } from "astro";

// The Rust API (apps/api) is the real fetcher; this endpoint just proxies to it,
// keeping the backend location server-side.
const API_URL = import.meta.env.API_URL ?? "http://localhost:8799";

export const GET: APIRoute = async ({ params }) => {
  const username = params.username ?? "";

  const upstream = await fetch(`${API_URL}/contributions/${encodeURIComponent(username)}`).catch(
    () => null
  );

  if (!upstream) {
    return Response.json({ error: "api unreachable" }, { status: 502 });
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
};
