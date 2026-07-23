// The entire backend: a cookieless GET to GitHub's undocumented contributions
// fragment + an HTML parse. Runs server-side in the Worker. The trick is
// deliberately NOT authenticating — auth is what strips the data.

export type Day = { date: string; level: number; count: number };
export type Contributions = { total: number; days: Day[] };

const DAY_RE = /<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>/g;
const TOOLTIP_RE = /for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g;

// GitHub usernames: 1-39 chars, alphanumeric or single hyphens.
export function isValidUsername(name: string): boolean {
  return /^[a-zA-Z0-9-]{1,39}$/.test(name);
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

// Tooltip text is "N contribution(s) on <date>." or "No contributions on <date>.".
function parseCount(text: string): number {
  const token = text.trim().split(/\s+/)[0]?.replace(/,/g, "") ?? "";
  const n = Number.parseInt(token, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function parseContributions(html: string): Contributions {
  const counts = new Map<string, number>();
  for (const [, id, text] of html.matchAll(TOOLTIP_RE)) {
    counts.set(id, parseCount(text));
  }

  const days: Day[] = [];
  for (const [tag] of html.matchAll(DAY_RE)) {
    const date = attr(tag, "data-date");
    const id = attr(tag, "id");
    if (!date || !id) continue; // padding cells have no data-date
    days.push({
      date,
      level: Number.parseInt(attr(tag, "data-level") ?? "0", 10) || 0,
      count: counts.get(id) ?? 0,
    });
  }

  const total = days.reduce((sum, day) => sum + day.count, 0);
  return { total, days };
}

export async function fetchContributions(
  username: string
): Promise<Contributions | { error: string }> {
  if (!isValidUsername(username)) return { error: "invalid username" };

  const url = `https://github.com/users/${username}/contributions`;
  // No token, no cookies: this is the anonymous/incognito view.
  const res = await fetch(url, {
    headers: { "User-Agent": "the-real-contributions-graph" },
  }).catch(() => null);

  if (!res) return { error: "github unreachable" };
  if (!res.ok) return { error: `github ${res.status}` };

  return parseContributions(await res.text());
}
