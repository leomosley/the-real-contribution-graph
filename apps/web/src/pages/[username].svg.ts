import type { APIRoute } from "astro";
import { fetchContributions } from "../lib/contributions";
import { renderContributionsSvg } from "../lib/contributions-svg";

// Embeddable badge: ![graph](https://<service>/<username>.svg)
// Always the anonymous/real aggregate. Served as a static SVG for README embeds.
export const GET: APIRoute = async ({ params }) => {
  const username = params.username ?? "";
  const result = await fetchContributions(username);

  const svg =
    "error" in result
      ? renderContributionsSvg(username, { total: 0, days: [] })
      : renderContributionsSvg(username, result);

  return new Response(svg, {
    // 200 even on error so the image still renders in a README.
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
