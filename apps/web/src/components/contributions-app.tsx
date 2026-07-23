import { useState } from "react";

type Day = { date: string; level: number; count: number };
type Contributions = { total: number; days: Day[] };

const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

// GitHub lays days out in week columns; pad the first column so the top row is Sunday.
function Heatmap({ days }: { days: Day[] }) {
  if (days.length === 0) return null;
  const leadingBlanks = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "repeat(7, 11px)",
        gridAutoFlow: "column",
        gridAutoColumns: "11px",
        gap: "3px",
      }}
    >
      {Array.from({ length: leadingBlanks }, (_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`}
          style={{
            width: 11,
            height: 11,
            borderRadius: 2,
            background: LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0],
          }}
        />
      ))}
    </div>
  );
}

export default function ContributionsApp() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<Contributions | null>(null);
  const [searched, setSearched] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.SyntheticEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;

    setLoading(true);
    setError(null);
    setData(null);

    const res = await fetch(`/api/contributions/${encodeURIComponent(name)}`).catch(() => null);
    setLoading(false);

    if (!res || !res.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "request failed");
      return;
    }
    setData(await res.json());
    setSearched(name);
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div style={{ color: "#e6edf3", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={search} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="github username"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #30363d",
            background: "#0d1117",
            color: "#e6edf3",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #30363d",
            background: "#238636",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "..." : "Reveal"}
        </button>
      </form>

      {error && <p style={{ color: "#f85149" }}>Error: {error}</p>}

      {data && (
        <div>
          <p style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 24 }}>{data.total.toLocaleString()}</strong> contributions in
            the last year
          </p>
          <div style={{ overflowX: "auto" }}>
            <Heatmap days={data.days} />
          </div>
          <div style={{ marginTop: 24 }}>
            <p style={{ color: "#8b949e", marginBottom: 6 }}>Embed in your README:</p>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #30363d",
                background: "#161b22",
                color: "#e6edf3",
                fontSize: 13,
                overflowX: "auto",
              }}
            >
              {`![contributions](${origin}/${searched}.svg)`}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
