import { createTtlCache } from "./cache";

// Google Fonts serves woff2 to modern browsers, but satori needs ttf/otf/woff.
// An old User-Agent makes the CSS endpoint hand back truetype URLs.
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1)";

// Fonts don't change; cache the bytes for the life of the instance.
const cache = createTtlCache<ArrayBuffer>(24 * 60 * 60 * 1000, 16);

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } }).then((r) => r.text());
  const fontUrl = css.match(/src:\s*url\((.+?)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!fontUrl) throw new Error(`could not resolve font url for ${key}`);

  const bytes = await fetch(fontUrl).then((r) => r.arrayBuffer());
  cache.set(key, bytes);
  return bytes;
}
