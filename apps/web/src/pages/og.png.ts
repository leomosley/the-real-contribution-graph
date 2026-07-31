import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";
import { loadGoogleFont } from "../lib/og-font";

export const prerender = false;

const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

const cell = (color: string) =>
  h("div", { style: { width: 15, height: 15, borderRadius: 3, backgroundColor: color } });

// Deterministic hash → [0,1). Matches the site's placeholder so the OG band
// reads as the same organic, non-repeating field rather than diagonals.
function hash01(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// Fake a heavy contributor: mostly-filled with weekend dips and hot streaks,
// biased toward the brighter end of the ramp.
function bandLevel(col: number, row: number): number {
  const isWeekend = row === 0 || row === 6;
  const wave = 0.5 + 0.5 * Math.sin(col * 0.55 + hash01(col) * 2.5);
  const noise = hash01(col * 7 + row);
  const hot = hash01(col * 31 + 7) > 0.82 ? 0.45 : 0;
  const intensity = wave * 0.55 + noise * 0.45 + hot + 0.2 - (isWeekend ? 0.24 : 0);

  if (intensity < 0.15) return 0;
  if (intensity < 0.42) return 1;
  if (intensity < 0.66) return 2;
  if (intensity < 0.88) return 3;
  return 4;
}

// Decorative heatmap band echoing "revealed" data.
function band() {
  const columns = Array.from({ length: 26 }, (_, c) =>
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 4 }, key: c },
      Array.from({ length: 7 }, (_, r) => cell(LEVELS[bandLevel(c, r)]!))
    )
  );
  return h("div", { style: { display: "flex", gap: 4, opacity: 0.55 } }, columns);
}

export const GET: APIRoute = async () => {
  const [bold, regular] = await Promise.all([
    loadGoogleFont("Space Grotesk", 700),
    loadGoogleFont("Space Grotesk", 400),
  ]);

  const element = h(
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
    h(
      "div",
      { style: { display: "flex", letterSpacing: 6, fontSize: 22, color: "#7d8590" } },
      "the-real-contribution-graph"
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { display: "flex", fontSize: 84, fontWeight: 700, color: "#e6edf3" } },
        "See the work"
      ),
      h(
        "div",
        { style: { display: "flex", fontSize: 84, fontWeight: 700, color: "#e6edf3" } },
        "GitHub",
        h("span", { style: { color: "#39d353", marginLeft: 24 } }, "hides.")
      )
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 28 } },
      band(),
      h(
        "div",
        { style: { display: "flex", fontSize: 26, color: "#7d8590" } },
        "The anonymous view recruiters can't normally see."
      )
    )
  );

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
      { name: "Space Grotesk", data: regular, weight: 400, style: "normal" },
    ],
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
};
