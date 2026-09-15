import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, FONT } from "./theme";

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 entrance progress, delayed by `delay` frames */
export function useIn(delay = 0, duration = 22) {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
}

export function useSpringIn(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7, stiffness: 120 } });
}

/** fade + rise */
export const Rise: React.FC<{
  delay?: number;
  y?: number;
  duration?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, y = 26, duration = 22, style, children }) => {
  const p = useIn(delay, duration);
  return (
    <div style={{ ...style, opacity: p, transform: `translateY(${(1 - p) * y}px)` }}>
      {children}
    </div>
  );
};

/** exit-aware wrapper: visible between `from` and `to` (frames) */
export const Window: React.FC<{
  from: number;
  to?: number;
  fade?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ from, to, fade = 12, style, children }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame - from, [0, fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const outP =
    to === undefined
      ? 1
      : interpolate(frame - to, [0, fade], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
  const o = inP * outP;
  if (o <= 0.001) return null;
  return (
    <div style={{ ...style, opacity: o, transform: `translateY(${(1 - inP) * 20}px)` }}>
      {children}
    </div>
  );
};

export function useCount(target: number, delay = 0, duration = 34) {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, duration], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.9, 0.2, 1),
  });
}

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <Rise delay={delay} y={12}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: FONT,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: 5,
        color: C.brandLite,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 34,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${C.brand}, ${C.brandLite})`,
        }}
      />
      {children}
    </div>
  </Rise>
);

export const Title: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 4, size = 76, style }) => (
  <Rise delay={delay} y={22}>
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 700,
        color: C.text,
        letterSpacing: -2.2,
        lineHeight: 1.22,
        ...style,
      }}
    >
      {children}
    </div>
  </Rise>
);

export const Card: React.FC<{
  style?: React.CSSProperties;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ style, children, accent }) => (
  <div
    style={{
      background: accent ? "rgba(101,85,238,0.10)" : C.panel,
      border: `1px solid ${accent ? "rgba(139,124,255,0.34)" : C.line}`,
      borderRadius: 22,
      padding: "34px 36px",
      display: "flex",
      flexDirection: "column",
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

/** pure (non-hook) entrance progress — safe inside loops */
export const pIn = (frame: number, delay = 0, duration = 22) =>
  interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

/** 뉴스형 헤드라인 — 예전 큰 타이틀 대신 칩 + 한 줄 */
export const NewsHead: React.FC<{
  chip: string;
  children: React.ReactNode;
  delay?: number;
  tone?: "dark" | "light";
  size?: number;
}> = ({ chip, children, delay = 0, tone = "dark", size = 46 }) => {
  const p = useIn(delay, 18);
  const ink = tone === "light" ? "#0D1020" : C.text;
  const chipBg = tone === "light" ? "#0D1020" : "rgba(255,255,255,0.14)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: p,
        transform: `translateY(${(1 - p) * 12}px)`,
        fontFamily: FONT,
      }}
    >
      <span
        style={{
          background: chipBg,
          color: "#fff",
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: 2.5,
          borderRadius: 9,
          padding: "9px 16px",
          whiteSpace: "nowrap",
        }}
      >
        {chip}
      </span>
      <span
        style={{
          fontSize: size,
          fontWeight: 800,
          color: ink,
          letterSpacing: -1.6,
          lineHeight: 1.24,
        }}
      >
        {children}
      </span>
    </div>
  );
};

/** 툭 튀어나오는 등장 — 뉴스 그래픽 특유의 '하나씩 붙는' 느낌 */
export const Pop: React.FC<{
  delay?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
  from?: number;
}> = ({ delay = 0, style, children, from = 0.86 }) => {
  const s = useSpringIn(delay, 13);
  const o = useIn(delay, 9);
  return (
    <div
      style={{
        ...style,
        opacity: o,
        transform: `scale(${from + (1 - from) * s})`,
      }}
    >
      {children}
    </div>
  );
};

/** 지수가 차오르는 막대 — 0→1 진행도 */
export const useFill = (delay: number, duration = 30) => {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
};

/** useFill 의 순수 함수판 — 반복문 안에서 쓸 때 */
export const fillAt = (frame: number, delay: number, duration = 30) =>
  interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
