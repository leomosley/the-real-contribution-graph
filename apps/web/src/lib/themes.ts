// Single source of truth for graph colour themes, shared by the server SVG
// renderer and the interactive React preview. A theme supplies only the four
// active ramp colours (levels 1-4); the empty cell (level 0) is a per-context
// neutral so the graph sits correctly on each canvas.

export type ThemeName = "default" | "white" | "red" | "purple" | "blue" | "pink";
export type Ramp = readonly [string, string, string, string];
export type Theme = { name: ThemeName; label: string; ramp: Ramp };
export type Palette = readonly [string, string, string, string, string];

export const THEMES: readonly Theme[] = [
  { name: "default", label: "GitHub", ramp: ["#0e4429", "#006d32", "#26a641", "#39d353"] },
  { name: "white", label: "White", ramp: ["#30363d", "#656c76", "#adbac7", "#ffffff"] },
  { name: "red", label: "Red", ramp: ["#5c1a1e", "#99282f", "#e5484d", "#ff7b72"] },
  { name: "purple", label: "Purple", ramp: ["#3c1e70", "#6e40c9", "#a371f7", "#d2a8ff"] },
  { name: "blue", label: "Blue", ramp: ["#0a3069", "#1158c7", "#388bfd", "#79c0ff"] },
  { name: "pink", label: "Pink", ramp: ["#6e1a4d", "#a53b7e", "#db61a2", "#ff9bce"] },
];

export const DEFAULT_THEME = THEMES[0];

// Unknown/absent names fall back to the default theme.
export const resolveTheme = (name: string | null | undefined): Theme =>
  THEMES.find((theme) => theme.name === name) ?? DEFAULT_THEME;

// Full five-level palette for a given empty-cell colour.
export const paletteFor = (theme: Theme, empty: string): Palette =>
  [empty, ...theme.ramp] as unknown as Palette;
