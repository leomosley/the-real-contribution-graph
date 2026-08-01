import { useEffect, useMemo, useRef, useState } from "react";
import { buildLayout } from "../lib/contributions-layout";
import {
  DEFAULT_THEME,
  paletteFor,
  resolveTheme,
  THEMES,
  type Palette,
  type Theme,
} from "../lib/themes";

type Day = { date: string; level: number; count: number };
type Contributions = { total: number; days: Day[] };
type ApiError = { error: string; kind?: string };

const EMPTY_CELL = "#1b1b1d";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function messageForError(err: ApiError): string {
  switch (err.kind) {
    case "not_found":
      return "No GitHub user by that name.";
    case "invalid_username":
      return "That doesn't look like a GitHub username.";
    case "rate_limited":
      return "Too many requests right now — give it a minute.";
    case "timeout":
      return "GitHub took too long to respond. Try again.";
    case "unreachable":
    case "github_error":
      return "Couldn't reach GitHub. Try again shortly.";
    default:
      return err.error || "Something went wrong.";
  }
}

function Grid({ days, colors }: { days: Day[]; colors: Palette }) {
  const layout = useMemo(() => buildLayout(days), [days]);

  return (
    <div className="w-full">
      <div
        className="mb-1.5 grid gap-[var(--cell-gap)] font-mono text-[10px] text-neutral-600"
        style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
      >
        {layout.months.map((m) => (
          <span key={`${m.col}-${m.label}`} style={{ gridColumnStart: m.col + 1 }}>
            {m.label}
          </span>
        ))}
      </div>
      <div
        className="grid gap-[var(--cell-gap)]"
        style={{
          gridTemplateRows: "repeat(7, auto)",
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        }}
      >
        {layout.cells.map((cell) => (
          <div
            key={cell.date}
            title={`${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`}
            className="cell-in aspect-square w-full rounded-[2px]"
            style={{
              gridRowStart: cell.row + 1,
              gridColumnStart: cell.col + 1,
              background: colors[cell.level] ?? colors[0],
              animationDelay: `${Math.min(cell.col * 9, 650)}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Legend({ colors }: { colors: Palette }) {
  return (
    <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-neutral-600">
      <span className="mr-0.5">Less</span>
      {colors.map((c, i) => (
        <span key={i} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: c }} />
      ))}
      <span className="ml-0.5">More</span>
    </div>
  );
}

// Deterministic hash → [0,1). Keeps SSR and client render identical while
// looking unstructured, unlike a plain modulo which draws visible diagonals.
function hash01(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const PLACEHOLDER_COLUMNS = 53;
// How suppressed the public "before" side is; the "after" side runs at full signal.
const BEFORE_REVEAL = 0.16;

// One cell's brightness at a given reveal strength. `reveal` scales the whole
// signal, so the same field renders as a near-empty public year or the dense
// real graph just by dialling it down or up.
function placeholderLevel(i: number, reveal: number): number {
  const dayOfWeek = i % 7;
  const week = Math.floor(i / 7);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const wave = 0.5 + 0.5 * Math.sin(week * 0.55 + hash01(week) * 2.5);
  const noise = hash01(i * 7 + dayOfWeek);
  const hot = hash01(week * 31 + 7) > 0.82 ? 0.45 : 0;

  const base = wave * 0.55 + noise * 0.45 + hot + 0.2 - (isWeekend ? 0.24 : 0);
  const intensity = base * reveal;

  if (intensity < 0.15) {
    return 0;
  }
  if (intensity < 0.42) {
    return 1;
  }
  if (intensity < 0.66) {
    return 2;
  }
  if (intensity < 0.88) {
    return 3;
  }
  return 4;
}

// Draggable before/after grid: each cell is precomputed at both reveal
// strengths, and a handle wipes the boundary between public (left) and real (right).
function PlaceholderGrid({ colors }: { colors: Palette }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [split, setSplit] = useState(0.42);
  const [dragging, setDragging] = useState(false);

  const levels = useMemo(
    () =>
      Array.from({ length: 371 }, (_, i) => ({
        before: placeholderLevel(i, BEFORE_REVEAL),
        after: placeholderLevel(i, 1),
      })),
    []
  );

  const boundaryCol = Math.round(split * PLACEHOLDER_COLUMNS);
  const handlePercent = (boundaryCol / PLACEHOLDER_COLUMNS) * 100;

  function setFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    setSplit(Math.min(1, Math.max(0, fraction)));
  }

  function nudge(step: number) {
    setSplit((s) => Math.min(1, Math.max(0, s + step / PLACEHOLDER_COLUMNS)));
  }

  return (
    <div
      className="mx-auto w-full max-w-full select-none"
      style={{ maxWidth: PLACEHOLDER_COLUMNS * 14 - 3 }}
    >
      <div className="mb-2 flex justify-between font-mono text-[10px] tracking-wide text-neutral-600">
        <span>What GitHub shows</span>
        <span className="text-accent/70">Your real graph</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Drag to reveal hidden contributions"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split * 100)}
        onPointerDown={(e) => {
          draggingRef.current = true;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) {
            setFromClientX(e.clientX);
          }
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          setDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragging(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            nudge(-1);
          }
          if (e.key === "ArrowRight") {
            nudge(1);
          }
        }}
        className="relative cursor-ew-resize touch-none rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        <div
          className="grid gap-[var(--cell-gap)]"
          style={{
            gridTemplateRows: "repeat(7, auto)",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0, 1fr)",
          }}
        >
          {levels.map((cell, i) => {
            const revealed = Math.floor(i / 7) >= boundaryCol;
            const level = revealed ? cell.after : cell.before;
            return (
              <div
                key={i}
                className="aspect-square w-full rounded-[2px] transition-[background-color] duration-150"
                style={{ background: colors[level], opacity: level === 0 ? 0.4 : 0.9 }}
              />
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute top-0 bottom-0 -translate-x-1/2"
          style={{ left: `${handlePercent}%` }}
        >
          <div className="mx-auto h-full w-px bg-white/40" />
          <div
            className={`absolute top-1/2 left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-neutral-900/90 text-neutral-300 shadow-lg shadow-black/40 backdrop-blur-md transition-transform ${
              dragging ? "scale-110" : ""
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 6l-4 6 4 6zM15 6l4 6-4 6z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Swatch row for choosing the graph theme.
function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Graph theme">
      {THEMES.map((theme) => {
        const selected = theme.name === value.name;
        return (
          <button
            key={theme.name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={theme.label}
            title={theme.label}
            onClick={() => onChange(theme)}
            className={`h-6 w-6 rounded-[4px] border transition-all ${
              selected ? "scale-110 border-white/60" : "border-white/10 hover:border-white/30"
            }`}
            style={{ background: theme.ramp[2] }}
          />
        );
      })}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// Copy control: nudges with a tooltip after 5s, then opens a Link/Markdown chooser.
function CopyMenu({ origin, username, theme }: { origin: string; username: string; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<null | "link" | "markdown">(null);
  const [showTip, setShowTip] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const query = theme.name === DEFAULT_THEME.name ? "" : `?theme=${theme.name}`;
  const linkQuery = theme.name === DEFAULT_THEME.name ? "" : `&theme=${theme.name}`;
  const link = `${origin}/?u=${encodeURIComponent(username)}${linkQuery}`;
  const markdown = `![${username}'s real contributions](${origin}/${username}.svg${query})`;

  useEffect(() => {
    const t = setTimeout(() => setShowTip(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function copy(kind: "link" | "markdown", value: string) {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(kind);
    setOpen(false);
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => {
          setShowTip(false);
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
      >
        <CopyIcon />
        {copied ? "Copied" : "Copy"}
      </button>

      {(showTip || hovered) && !open && !copied && (
        <div className="fade-up absolute right-0 bottom-full z-10 mb-2 whitespace-nowrap rounded-md border border-white/10 bg-neutral-900/95 px-2.5 py-1.5 text-xs text-neutral-300 shadow-lg shadow-black/40 backdrop-blur-md">
          Copy to add to your README or share
        </div>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-2 flex w-52 flex-col gap-0.5 rounded-lg border border-white/10 bg-neutral-900/95 p-1.5 shadow-xl shadow-black/50 backdrop-blur-md"
        >
          <button
            role="menuitem"
            onClick={() => copy("link", link)}
            className="rounded-md px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/[0.06]"
          >
            Link
          </button>
          <button
            role="menuitem"
            onClick={() => copy("markdown", markdown)}
            className="rounded-md px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/[0.06]"
          >
            Markdown
          </button>
        </div>
      )}
    </div>
  );
}

// Header row (stats + copy) lives outside the graph's overflow scroller so the
// copy popover isn't clipped.
function Result({
  data,
  searched,
  origin,
  theme,
  colors,
}: {
  data: Contributions;
  searched: string;
  origin: string;
  theme: Theme;
  colors: Palette;
}) {
  const maxWidth = useMemo(() => {
    const cols = buildLayout(data.days).columns;
    return cols > 0 ? cols * 14 - 3 : undefined;
  }, [data.days]);

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div style={{ maxWidth }} className="mx-auto w-full min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-mono text-xl font-medium tracking-tight text-white tabular-nums">
              {data.total.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500">contributions this year</span>
            <span className="font-mono text-xs text-neutral-600">· @{searched}</span>
          </div>
          <CopyMenu key={searched} origin={origin} username={searched} theme={theme} />
        </div>
        <Grid days={data.days} colors={colors} />
        <Legend colors={colors} />
      </div>
    </div>
  );
}

// Loading placeholder mirroring Result's layout so the graph doesn't jump when
// real data arrives.
function ResultSkeleton() {
  const maxWidth = PLACEHOLDER_COLUMNS * 14 - 3;
  const bar = "rounded bg-white/[0.06]";
  const cell = "aspect-square w-full rounded-[2px] bg-white/[0.05]";

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div
        style={{ maxWidth }}
        className="mx-auto w-full min-w-0 animate-pulse motion-reduce:animate-none"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className={`h-7 w-44 max-w-[60%] ${bar}`} />
          <div className={`h-[30px] w-[74px] shrink-0 ${bar}`} />
        </div>
        <div className="mb-1.5 flex gap-8">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-2.5 w-6 rounded bg-white/[0.05]" />
          ))}
        </div>
        <div
          className="grid gap-[var(--cell-gap)]"
          style={{
            gridTemplateRows: "repeat(7, auto)",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0, 1fr)",
          }}
        >
          {Array.from({ length: PLACEHOLDER_COLUMNS * 7 }, (_, i) => (
            <div key={i} className={cell} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <div className={`h-2.5 w-7 ${bar}`} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[11px] w-[11px] rounded-[2px] bg-white/[0.06]" />
          ))}
          <div className={`h-2.5 w-8 ${bar}`} />
        </div>
      </div>
    </div>
  );
}

export default function ContributionsApp() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<Contributions | null>(null);
  const [searched, setSearched] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  const trimmed = username.trim();
  const invalid = trimmed.length > 0 && !USERNAME_RE.test(trimmed);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const colors = useMemo(() => paletteFor(theme, EMPTY_CELL), [theme]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (next.name === DEFAULT_THEME.name) {
      params.delete("theme");
    } else {
      params.set("theme", next.name);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  async function search(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!trimmed || invalid || loading) {
      return;
    }
    await reveal(trimmed);
  }

  async function reveal(name: string) {
    setLoading(true);
    setError(null);
    setData(null);

    const res = await fetch(`/api/contributions/${encodeURIComponent(name)}`).catch(() => null);
    setLoading(false);

    if (!res || !res.ok) {
      const body: ApiError | null = await res?.json().catch(() => null);
      setError(messageForError(body ?? { error: "Request failed." }));
      return;
    }

    setData((await res.json()) as Contributions);
    setSearched(name);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("u", name);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  }

  // Deep link /?u=<username>&theme=<theme> reveals on load, so results are shareable.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTheme(resolveTheme(params.get("theme")));
    const param = params.get("u")?.trim();
    if (param && USERNAME_RE.test(param)) {
      setUsername(param);
      void reveal(param);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <form
        onSubmit={search}
        className={`mx-auto flex w-full max-w-md items-center rounded-full border bg-white/[0.03] p-1.5 backdrop-blur-md transition-colors ${
          invalid ? "border-red-500/40" : "border-white/10 focus-within:border-white/25"
        }`}
      >
        <span className="pl-4 font-mono text-sm text-neutral-600 select-none">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="GitHub username"
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-sm text-white outline-none placeholder:text-neutral-600"
        />
        <button
          type="submit"
          disabled={loading || !trimmed || invalid}
          className="rounded-full bg-white px-5 py-1.5 text-sm font-medium text-neutral-950 transition-all duration-200 hover:shadow-[0_0_28px_rgba(57,211,83,0.35)] disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? "Revealing…" : "Reveal"}
        </button>
      </form>

      {invalid && (
        <p className="mt-2.5 text-center font-mono text-xs text-red-400/80">
          Letters, numbers and single hyphens only — up to 39 characters.
        </p>
      )}

      <div className="mt-14 flex flex-col items-center">
        {error && <p className="font-mono text-sm text-red-400/90">{error}</p>}

        {!error && loading && <ResultSkeleton />}

        {!error && !loading && data && (
          <Result data={data} searched={searched} origin={origin} theme={theme} colors={colors} />
        )}

        {!error && !loading && !data && (
          <div className="flex w-full min-w-0 flex-col items-center">
            <p className="mb-6 font-mono text-sm text-neutral-600">
              Enter a username to reveal the real graph.
            </p>
            <PlaceholderGrid colors={colors} />
          </div>
        )}

        <div className="mt-8">
          <ThemePicker value={theme} onChange={chooseTheme} />
        </div>
      </div>
    </div>
  );
}
