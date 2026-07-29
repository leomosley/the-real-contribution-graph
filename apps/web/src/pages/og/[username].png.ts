import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";
import { loadGoogleFont } from "../../lib/og-font";
import { fetchContributions, isError, isValidUsername, type Day } from "../../lib/contributions";
import { buildLayout } from "../../lib/contributions-layout";
import { paletteFor, resolveTheme, type Palette, type Theme } from "../../lib/themes";

export const prerender = false;

// Empty cell sits a touch above the near-black canvas, echoing GitHub's grid.
const EMPTY_CELL = "#161b22";
const CELL = 14;
const GAP = 4;

// Themed grid built from the real day data, laid out weekday-major like GitHub.
function grid(days: Day[], colors: Palette) {
  const { cells, columns } = buildLayout(days);
  const byPos = new Map(cells.map((c) => [`${c.col}:${c.row}`, c]));

  const cols = Array.from({ length: columns }, (_, col) =>
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: GAP }, key: col },
      Array.from({ length: 7 }, (_, row) => {
        const cell = byPos.get(`${col}:${row}`);
        const color = cell ? (colors[cell.level] ?? colors[0]) : EMPTY_CELL;
        return h("div", {
          key: row,
          style: { width: CELL, height: CELL, borderRadius: 3, backgroundColor: color },
        });
      })
    )
  );

  return h("div", { style: { display: "flex", gap: GAP } }, cols);
}

function card(children: ReturnType<typeof h>[]) {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: "#0a0c10",
        fontFamily: "Space Grotesk",
      },
    },
    ...children
  );
}

const label = () =>
  h(
    "div",
    { style: { display: "flex", letterSpacing: 6, fontSize: 22, color: "#7d8590" } },
    "THE REAL CONTRIBUTIONS GRAPH"
  );

// Fallback when the user is unknown or GitHub gives us nothing.
function fallbackCard(username: string) {
  return card([
    label(),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { display: "flex", fontSize: 76, fontWeight: 700, color: "#e6edf3" } },
        `@${username}`
      ),
      h(
        "div",
        { style: { display: "flex", fontSize: 30, color: "#7d8590", marginTop: 12 } },
        "No public contributions to reveal."
      )
    ),
    h("div", { style: { display: "flex" } }),
  ]);
}

function profileCard(username: string, total: number, days: Day[], theme: Theme) {
  const colors = paletteFor(theme, EMPTY_CELL);
  const accent = theme.ramp[3];

  return card([
    label(),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 20 } },
        h(
          "div",
          { style: { display: "flex", fontSize: 76, fontWeight: 700, color: "#e6edf3" } },
          `@${username}`
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 16, marginTop: 8 } },
        h(
          "div",
          { style: { display: "flex", fontSize: 52, fontWeight: 700, color: accent } },
          total.toLocaleString("en-US")
        ),
        h(
          "div",
          { style: { display: "flex", fontSize: 30, color: "#7d8590" } },
          "contributions GitHub hides."
        )
      )
    ),
    grid(days, colors),
  ]);
}

export const GET: APIRoute = async ({ params, url }) => {
  const username = params.username ?? "";
  const theme = resolveTheme(url.searchParams.get("theme"));

  const [bold, regular] = await Promise.all([
    loadGoogleFont("Space Grotesk", 700),
    loadGoogleFont("Space Grotesk", 400),
  ]);

  const result = isValidUsername(username) ? await fetchContributions(username) : null;
  const element =
    result && !isError(result) && result.days.length > 0
      ? profileCard(username, result.total, result.days, theme)
      : fallbackCard(username);

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
      { name: "Space Grotesk", data: regular, weight: 400, style: "normal" },
    ],
    headers: {
      "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
    },
  });
};
