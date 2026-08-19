import type { Contributions } from "./contributions";
import { buildLayout } from "./contributions-layout";
import { DEFAULT_MODE, DEFAULT_THEME, EMPTY_CELL, paletteFor, type Mode, type Theme } from "./themes";

const CELL = 11;
const PITCH = 14;
const PAD_X = 16;
const HEADER = 34;
const PAD_BOTTOM = 12;

// Canvas + text colours per surface mode. Empty-cell colour comes from themes.ts.
const SURFACE: Record<Mode, { canvas: string; text: string }> = {
  dark: { canvas: "#0d1117", text: "#e6edf3" },
  light: { canvas: "#ffffff", text: "#1f2328" },
};

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function errorSvg(message: string, mode: Mode): string {
  const canvas = SURFACE[mode].canvas;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="60" role="img">
  <rect width="360" height="60" rx="6" fill="${canvas}"/>
  <text x="16" y="36" font-family="system-ui,sans-serif" font-size="14" fill="#f85149">${escapeXml(message)}</text>
</svg>`;
}

export function renderContributionsSvg(
  username: string,
  data: Contributions,
  theme: Theme = DEFAULT_THEME,
  mode: Mode = DEFAULT_MODE
): string {
  if (data.days.length === 0) {
    return errorSvg(`No data for ${username}`, mode);
  }

  const surface = SURFACE[mode];
  const colors = paletteFor(theme, EMPTY_CELL[mode]);
  const { cells, columns } = buildLayout(data.days);
  const width = PAD_X * 2 + columns * PITCH;
  const height = HEADER + 7 * PITCH + PAD_BOTTOM;

  const rects = cells
    .map((cell) => {
      const x = PAD_X + cell.col * PITCH;
      const y = HEADER + cell.row * PITCH;
      const fill = colors[cell.level] ?? colors[0];
      const label = `${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`;
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"><title>${escapeXml(label)}</title></rect>`;
    })
    .join("");

  const heading = `${data.total.toLocaleString("en-US")} contributions in the last year`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`${username}: ${heading}`)}">
  <rect width="${width}" height="${height}" rx="6" fill="${surface.canvas}"/>
  <text x="${PAD_X}" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="${surface.text}"><tspan font-weight="600">${escapeXml(username)}</tspan> · ${escapeXml(heading)}</text>
  ${rects}
</svg>`;
}
