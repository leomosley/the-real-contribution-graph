import { createTtlCache } from "./cache";

// Star count for the header pill. Cached for an hour and best-effort: any
// failure returns null so the header simply omits the number.

const cache = createTtlCache<number>(60 * 60 * 1000, 4);

export async function fetchStars(repo: string): Promise<number | null> {
  const cached = cache.get(repo);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        "User-Agent": "the-real-contributions-graph",
        Accept: "application/vnd.github+json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { stargazers_count?: number };
    const stars = typeof body.stargazers_count === "number" ? body.stargazers_count : null;
    if (stars !== null) cache.set(repo, stars);
    return stars;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
