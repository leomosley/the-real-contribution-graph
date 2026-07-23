// Shared client for the Rust API (apps/api), the real anonymous fetcher.
const API_URL = import.meta.env.API_URL ?? "http://localhost:8799";

export type Day = { date: string; level: number; count: number };
export type Contributions = { total: number; days: Day[] };

export async function fetchContributions(
  username: string
): Promise<Contributions | { error: string }> {
  const res = await fetch(`${API_URL}/contributions/${encodeURIComponent(username)}`).catch(
    () => null
  );

  if (!res) return { error: "api unreachable" };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: body?.error ?? `upstream ${res.status}` };
  }
  return res.json() as Promise<Contributions>;
}
