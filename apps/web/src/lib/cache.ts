// In-memory TTL cache. Scoped to a single warm serverless/edge instance, so it
// is a best-effort latency win — not a source of truth. Falls back to a fresh
// fetch on any miss, which is always correct.

type Entry<T> = { value: T; expiresAt: number };

export type TtlCache<T> = {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
};

export function createTtlCache<T>(ttlMs: number, maxEntries = 500): TtlCache<T> {
  const store = new Map<string, Entry<T>>();

  const get = (key: string): T | undefined => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  };

  const set = (key: string, value: T): void => {
    // Bound memory: evict the oldest insertion when full.
    if (store.size >= maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  };

  return { get, set };
}
