import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import { createElement as h } from "react";
import { loadGoogleFont } from "../lib/og-font";

export const prerender = false;

const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

const cell = (color: string) =>
  h("div", { style: { width: 15, height: 15, borderRadius: 3, backgroundColor: color } });

// Decorative heatmap band: brighter toward the right, echoing "revealed" data.
function band() {
  const columns = Array.from({ length: 26 }, (_, c) =>
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 4 }, key: c },
      Array.from({ length: 7 }, (_, r) => {
        const bias = Math.floor((c / 26) * 3);
        const level = ((c * 7 + r * 3 + bias) % (LEVELS.length - 1)) + (bias > 0 ? 1 : 0);
        return cell(LEVELS[Math.min(level, 4)]!);
      })
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
      "THE REAL CONTRIBUTIONS GRAPH"
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
