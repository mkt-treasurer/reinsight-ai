import React from "react";
import { C, MONO } from "../theme";

/** 레퍼런스 톤: 밝은 배경 위에 흰 카드가 부드러운 그림자로 떠 있고, 여러 장이 겹친다 */
export const PAPER = "#eef2f7";
export const CARD_LINE = "#e6ecf4";
export const SHADOW = "0 24px 60px rgba(15,23,42,0.13), 0 2px 6px rgba(15,23,42,0.06)";
export const SHADOW_LIFT = "0 40px 90px rgba(15,23,42,0.22), 0 2px 8px rgba(15,23,42,0.08)";

export const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  p?: number;
  lift?: boolean;
  z?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ x, y, w, h, p = 1, lift, z = 1, style, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.paperAlt,
      border: `1px solid ${CARD_LINE}`,
      borderRadius: 8,
      boxShadow: lift ? SHADOW_LIFT : SHADOW,
      opacity: p,
      zIndex: z,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** 카드 머리말 — 모노 라벨 왼쪽, 보조 정보 오른쪽 */
export const CardHead: React.FC<{ label: string; right?: string; dark?: boolean }> = ({
  label,
  right,
  dark,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      padding: "16px 22px 15px",
      borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.1)" : CARD_LINE}`,
      background: dark ? "#111c30" : "transparent",
    }}
  >
    <span
      style={{
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 2.4,
        color: dark ? "rgba(255,255,255,0.72)" : C.ink3,
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1 }} />
    {right ? (
      <span
        style={{
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: 1.6,
          color: dark ? "rgba(255,255,255,0.4)" : C.ink4,
        }}
      >
        {right}
      </span>
    ) : null}
  </div>
);

/** 상태 칩 — 레퍼런스의 DRAFT READY / 변경 표시 */
export const Chip: React.FC<{ tone: "blue" | "green" | "red" | "grey"; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const t = {
    blue: { bg: "rgba(59,130,246,0.12)", fg: C.brand },
    green: { bg: "rgba(4,120,87,0.12)", fg: C.accent },
    red: { bg: "rgba(179,38,30,0.10)", fg: "#b3261e" },
    grey: { bg: "rgba(15,23,42,0.06)", fg: C.ink3 },
  }[tone];
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.6,
        color: t.fg,
        background: t.bg,
        borderRadius: 3,
        padding: "4px 9px 5px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

/** 좌측 카피 — 레퍼런스처럼 작고 왼쪽 정렬 */
export const Say: React.FC<{
  x?: number;
  y: number;
  w?: number;
  p: number;
  sub?: string;
  subP?: number;
  children: React.ReactNode;
}> = ({ x = 120, y, w = 620, p, sub, subP = 1, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w }}>
    <div
      style={{
        fontSize: 42,
        fontWeight: 700,
        letterSpacing: -1.5,
        lineHeight: 1.42,
        color: C.ink,
        opacity: p,
        transform: `translateY(${(1 - p) * 12}px)`,
      }}
    >
      {children}
    </div>
    {sub ? (
      <div
        style={{
          marginTop: 20,
          fontSize: 23,
          fontWeight: 500,
          lineHeight: 1.5,
          color: C.ink3,
          opacity: subP,
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);

/** 화면 왼쪽 아래 경로 표시 — 레퍼런스의 /ins/tools/news-insights */
export const PathTag: React.FC<{ children: React.ReactNode; dark?: boolean; p?: number }> = ({
  children,
  dark,
  p = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: 120,
      bottom: 62,
      fontFamily: MONO,
      fontSize: 14,
      letterSpacing: 1.8,
      color: dark ? "rgba(232,238,247,0.34)" : C.ink4,
      opacity: p,
    }}
  >
    {children}
  </div>
);
