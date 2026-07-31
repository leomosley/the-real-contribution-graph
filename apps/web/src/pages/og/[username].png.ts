import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";
import { loadGoogleFont } from "../../lib/og-font";
import { fetchContributions, isError, isValidUsername, type Day } from "../../lib/contributions";
import { buildLayout } from "../../lib/contributions-layout";
import { paletteFor, resolveTheme, type Palette, type Theme } from "../../lib/themes";

export const prerender = false;

const EMPTY_CELL = "#161b22";
const CELL = 16;
const GAP = 3;

// Themed grid built from the real day data, laid out weekday-major.
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
        justifyContent: "center",
        gap: 56,
        padding: "64px 80px",
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
    { style: { display: "flex", letterSpacing: 1, fontSize: 20, color: "#7d8590" } },
    "The Real Contribution Graph"
  );

const gridRow = (days: Day[], colors: Palette) =>
  h(
    "div",
    { style: { display: "flex", justifyContent: "center", width: "100%" } },
    grid(days, colors)
  );

// Fallback when the user is unknown or GitHub gives us nothing.
function fallbackCard(username: string) {
  return card([
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 20 } },
      label(),
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            color: "#e6edf3",
            lineHeight: 1,
          },
        },
        `@${username}`
      ),
      h(
        "div",
        { style: { display: "flex", fontSize: 28, color: "#7d8590" } },
        "No public contributions to reveal."
      )
    ),
  ]);
}

function profileCard(username: string, total: number, days: Day[], theme: Theme) {
  const colors = paletteFor(theme, EMPTY_CELL);
  const accent = theme.ramp[3];

  return card([
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },
      label(),
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            color: "#e6edf3",
            lineHeight: 1,
          },
        },
        `@${username}`
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 12 } },
        h(
          "div",
          { style: { display: "flex", fontSize: 44, fontWeight: 700, color: accent } },
          total.toLocaleString("en-US")
        ),
        h("div", { style: { display: "flex", fontSize: 28, color: "#7d8590" } }, "contributions")
      )
    ),
    gridRow(days, colors),
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
