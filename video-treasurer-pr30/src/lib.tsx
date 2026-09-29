import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { C, FONT, MONO } from "./theme";

export const EASE = Easing.bezier(0.22, 1, 0.32, 1);

/** 0→1 등장 진행도 (훅) */
export function useIn(delay = 0, duration = 22) {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
}

/** 반복문 안에서 쓰는 순수 함수판 */
export const pIn = (frame: number, delay = 0, duration = 22) =>
  interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

/** 페이드 + 살짝 위로 — 포멀 톤이라 이동량을 작게 */
export const Rise: React.FC<{
  delay?: number;
  y?: number;
  duration?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, y = 14, duration = 22, style, children }) => {
  const p = useIn(delay, duration);
  return (
    <div style={{ ...style, opacity: p, transform: `translateY(${(1 - p) * y}px)` }}>{children}</div>
  );
};

/** from 프레임부터 보이고, to 가 있으면 그때 사라진다 */
export const Window: React.FC<{
  from: number;
  to?: number;
  fade?: number;
  y?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ from, to, fade = 12, y = 14, style, children }) => {
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
    <div style={{ ...style, opacity: o, transform: `translateY(${(1 - inP) * y}px)` }}>
      {children}
    </div>
  );
};

/** 섹션 라벨 — 하우스 톤: 모노 + 넓은 자간, 앞에 번호 */
export const Kicker: React.FC<{
  children: React.ReactNode;
  delay?: number;
  no?: string;
}> = ({ children, delay = 0, no }) => (
  <Rise delay={delay} y={8}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        fontFamily: MONO,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 4.2,
        color: C.brandLite,
        textTransform: "uppercase",
      }}
    >
      {no ? <span style={{ color: C.brand }}>{no}</span> : null}
      <span style={{ width: 22, height: 1, background: "currentColor", opacity: 0.55 }} />
      {children}
    </div>
  </Rise>
);

/** 씬 제목 */
export const Head: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  tone?: "light" | "dark";
  style?: React.CSSProperties;
}> = ({ children, delay = 6, size = 58, tone = "dark", style }) => (
  <Rise delay={delay} y={16}>
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -2,
        lineHeight: 1.26,
        color: tone === "dark" ? C.onDark : C.ink,
        wordBreak: "keep-all",
        ...style,
      }}
    >
      {children}
    </div>
  </Rise>
);

/** 본문 보조 문단 */
export const Body: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  tone?: "light" | "dark";
  style?: React.CSSProperties;
}> = ({ children, delay = 12, size = 27, tone = "dark", style }) => (
  <Rise delay={delay} y={10}>
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 500,
        letterSpacing: -0.6,
        lineHeight: 1.62,
        color: tone === "dark" ? C.onDark2 : C.ink3,
        wordBreak: "keep-all",
        ...style,
      }}
    >
      {children}
    </div>
  </Rise>
);

/** 얇은 구분선 */
export const Rule: React.FC<{ tone?: "light" | "dark"; style?: React.CSSProperties }> = ({
  tone = "dark",
  style,
}) => (
  <div
    style={{
      height: 1,
      background: tone === "dark" ? C.onDarkLine : C.line,
      ...style,
    }}
  />
);

/** 숫자 카운트업 */
export function useCount(target: number, delay = 0, duration = 34) {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, duration], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.9, 0.2, 1),
  });
}
