// The entire backend: a cookieless GET to GitHub's undocumented contributions
// fragment + an HTML parse. Runs server-side. The trick is deliberately NOT
// authenticating — auth is what strips the data down to what GitHub chooses to
// show. This is the anonymous/incognito aggregate.

import { createTtlCache } from "./cache";

export type Day = { date: string; level: number; count: number };
export type Contributions = { total: number; days: Day[] };

export type ContributionsErrorKind =
  "invalid_username" | "not_found" | "rate_limited" | "timeout" | "unreachable" | "github_error";

export type ContributionsError = { error: string; kind: ContributionsErrorKind };

export type ContributionsResult = Contributions | ContributionsError;

export const isError = (result: ContributionsResult): result is ContributionsError =>
  "error" in result;

// Map an error kind to the HTTP status the JSON API should surface.
export function statusForError(kind: ContributionsErrorKind): number {
  switch (kind) {
    case "invalid_username":
      return 400;
    case "not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "unreachable":
    case "github_error":
      return 502;
  }
}

const DAY_RE = /<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>/g;
const TOOLTIP_RE = /for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g;

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = createTtlCache<Contributions>(CACHE_TTL_MS);

// GitHub usernames: 1-39 chars, alphanumeric or single hyphens.
export function isValidUsername(name: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(name);
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

async function fetchGithub(username: string): Promise<Response | ContributionsError> {
  const url = `https://github.com/users/${username}/contributions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // No token, no cookies: this is the anonymous/incognito view.
    return await fetch(url, {
      headers: { "User-Agent": "the-real-contributions-graph" },
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return aborted
      ? { error: "github request timed out", kind: "timeout" }
      : { error: "github unreachable", kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

function mapStatusError(status: number): ContributionsError {
  if (status === 404) return { error: "user not found", kind: "not_found" };
  if (status === 429)
    return { error: "github rate limited us, try again soon", kind: "rate_limited" };
  return { error: `github responded ${status}`, kind: "github_error" };
}

export async function fetchContributions(username: string): Promise<ContributionsResult> {
  if (!isValidUsername(username)) return { error: "invalid username", kind: "invalid_username" };

  const key = username.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetchGithub(username);
  if ("error" in res) return res;
  if (!res.ok) return mapStatusError(res.status);

  const parsed = parseContributions(await res.text());
  cache.set(key, parsed);
  return parsed;
}
