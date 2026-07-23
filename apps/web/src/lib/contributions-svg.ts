import type { Contributions } from "./contributions";

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

  // Pad the first column so the top row is Sunday, matching GitHub's layout.
  const leadingBlanks = new Date(`${data.days[0].date}T00:00:00Z`).getUTCDay();
  const weeks = Math.ceil((leadingBlanks + data.days.length) / 7);

  const width = PAD_X * 2 + weeks * PITCH;
  const height = HEADER + 7 * PITCH + PAD_BOTTOM;

  const cells = data.days
    .map((day, i) => {
      const slot = leadingBlanks + i;
      const x = PAD_X + Math.floor(slot / 7) * PITCH;
      const y = HEADER + (slot % 7) * PITCH;
      const fill = LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0];
      const label = `${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`;
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"><title>${escapeXml(label)}</title></rect>`;
    })
    .join("");

  const heading = `${data.total.toLocaleString("en-US")} contributions in the last year`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`${username}: ${heading}`)}">
  <rect width="${width}" height="${height}" rx="6" fill="#0d1117"/>
  <text x="${PAD_X}" y="22" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#e6edf3"><tspan font-weight="600">${escapeXml(username)}</tspan> · ${escapeXml(heading)}</text>
  ${cells}
</svg>`;
}
