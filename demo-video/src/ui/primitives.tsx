import React from "react";
import { desk, font } from "../theme";

export const sevColor = (s: string) =>
  s === "critical" ? desk.critical : s === "warning" ? desk.warning : desk.hint;

export const Dot: React.FC<{ sev: string; pulse?: boolean }> = ({ sev }) => (
  <span style={{ width: 7, height: 7, borderRadius: "50%", background: sevColor(sev), display: "inline-block" }} />
);

export const CardHead: React.FC<{ title: string; sub?: string; right?: React.ReactNode }> = ({ title, sub, right }) => (
  <div
    style={{
      padding: "9px 16px",
      borderBottom: `1px solid ${desk.border}`,
      background: desk.headerBar,
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
    }}
  >
    <span style={{ fontFamily: font.head, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: desk.body, textTransform: "uppercase" }}>
      {title}
    </span>
    {sub && <span style={{ fontSize: 11, color: desk.hint, fontFamily: font.body }}>{sub}</span>}
    {right}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; tone?: "neutral" | "critical" }> = ({ children, tone = "neutral" }) => (
  <span
    style={{
      fontFamily: font.mono,
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      padding: "2px 7px",
      border: `1px solid ${tone === "critical" ? desk.critical : desk.borderStrong}`,
      color: tone === "critical" ? desk.critical : desk.body,
      background: tone === "critical" ? "rgba(185,28,28,0.05)" : "#fff",
    }}
  >
    {children}
  </span>
);

export const StagePill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", background: "#f1f5f9", color: desk.body, padding: "2px 7px" }}>
    {children}
  </span>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ border: `1px solid ${desk.border}`, background: desk.bg, ...style }}>{children}</div>
);
