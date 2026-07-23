import type { Contributions } from "./contributions";
import { buildLayout } from "./contributions-layout";

const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const CELL = 11;
const PITCH = 14; // cell + gap
const PAD_X = 16;
const HEADER = 34;
const PAD_BOTTOM = 12;

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function errorSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="60" role="img">
  <rect width="360" height="60" rx="6" fill="#0d1117"/>
  <text x="16" y="36" font-family="system-ui,sans-serif" font-size="14" fill="#f85149">${escapeXml(message)}</text>
</svg>`;
}

export function renderContributionsSvg(username: string, data: Contributions): string {
  if (data.days.length === 0) return errorSvg(`No data for ${username}`);

  const { cells, columns } = buildLayout(data.days);
  const width = PAD_X * 2 + columns * PITCH;
  const height = HEADER + 7 * PITCH + PAD_BOTTOM;

  const rects = cells
    .map((cell) => {
      const x = PAD_X + cell.col * PITCH;
      const y = HEADER + cell.row * PITCH;
      const fill = LEVEL_COLORS[cell.level] ?? LEVEL_COLORS[0];
      const label = `${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`;
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"><title>${escapeXml(label)}</title></rect>`;
    })
    .join("");

  const heading = `${data.total.toLocaleString("en-US")} contributions in the last year`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`${username}: ${heading}`)}">
  <rect width="${width}" height="${height}" rx="6" fill="#0d1117"/>
  <text x="${PAD_X}" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#e6edf3"><tspan font-weight="600">${escapeXml(username)}</tspan> · ${escapeXml(heading)}</text>
  ${rects}
</svg>`;
}
