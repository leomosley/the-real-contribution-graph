import type { APIRoute } from "astro";
import { fetchContributions } from "../../../lib/contributions";

export const GET: APIRoute = async ({ params }) => {
  const result = await fetchContributions(params.username ?? "");
  const status = "error" in result ? 400 : 200;
  return Response.json(result, { status });
};
