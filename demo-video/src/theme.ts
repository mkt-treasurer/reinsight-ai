// TREASURER dark-navy stage tokens + real INS light-product tokens.
// The film (stage) is dark navy + blue; the product windows inside it render
// in the actual INS financial-desk palette (see frontend/DESIGN.md).

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// ── Stage (the film) ─────────────────────────────────────────────
export const stage = {
  bg: "#0d1526",
  bgDeep: "#080e1c",
  grid: "rgba(59,130,246,0.06)",
  glow: "rgba(59,130,246,0.22)",
  accent: "#3b82f6",
  accentBright: "#60a5fa",
  accentDeep: "#1e3a8a",
  ink: "#e8eef7",
  inkMuted: "#8ea0bd",
  inkFaint: "#4a5b78",
  hair: "rgba(148,163,184,0.14)",
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
};

// ── Product window (real INS light desk) ─────────────────────────
export const desk = {
  bg: "#ffffff",
  shell: "#f8fafc",
  masthead: "#0f172a",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  headerBar: "#f8fafc",
  ink: "#0f172a",
  body: "#334155",
  meta: "#64748b",
  hint: "#94a3b8",
  rowHover: "#f8fafc",
  critical: "#b91c1c",
  warning: "#b45309",
  positive: "#047857",
  chartNeutral: "#0f172a",
  chartNeutral2: "#94a3b8",
  link: "#1e40af",
};

export const font = {
  head: "Montserrat, sans-serif",
  mono: "'JetBrains Mono', monospace",
  kr: "'Noto Sans KR', sans-serif",
  body: "'Noto Sans KR', 'JetBrains Mono', sans-serif",
};

// Cubic-bezier easing tuned to the ECC web ruleset (ease-out-expo).
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_INOUT = [0.65, 0, 0.35, 1] as const;
