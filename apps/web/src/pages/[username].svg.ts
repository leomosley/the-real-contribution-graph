import type { APIRoute } from "astro";
import { fetchContributions, isError } from "../lib/contributions";
import { renderContributionsSvg } from "../lib/contributions-svg";
import { resolveTheme } from "../lib/themes";
import { limiter } from "../lib/limiter";

// Embeddable badge: ![graph](https://<service>/<username>.svg?theme=<theme>)
// Always the anonymous/real aggregate. Served as SVG for README embeds, so it
// returns 200 even on error — the image must still render.
export const GET: APIRoute = async ({ params, url, clientAddress }) => {
  const username = params.username ?? "";
  const theme = resolveTheme(url.searchParams.get("theme"));

  const gate = limiter.check(clientAddress ?? "unknown");
  if (!gate.ok) {
    return svgResponse(renderContributionsSvg(username, { total: 0, days: [] }, theme), 60);
  }

  const result = await fetchContributions(username);
  const svg = isError(result)
    ? renderContributionsSvg(username, { total: 0, days: [] }, theme)
    : renderContributionsSvg(username, result, theme);

  return svgResponse(svg, 900);
};

function svgResponse(svg: string, maxAge: number): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600`,
    },
  });
}
