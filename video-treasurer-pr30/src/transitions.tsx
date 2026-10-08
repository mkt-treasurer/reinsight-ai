import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";

const OUT_E = Easing.bezier(0.4, 0, 1, 1);
const IN_E = Easing.bezier(0.16, 1, 0.3, 1);

export type Trans = 'scale' | 'wipeR' | 'wipeL' | 'slideUp' | 'curtain' | 'slideL' | 'zoomIn' | 'zoomOut' | 'fade';

/**
 * 씬 전환. 전부 같은 페이드면 지루해서 씬마다 다른 걸 쓴다.
 * 길이는 8~11프레임으로 짧게 — 포멀하되 답답하지 않게.
 */
export const Enter: React.FC<{
  kind: Trans;
  life: number;
  out?: number;
  children: React.ReactNode;
}> = ({ kind, life, out = 9, children }) => {
  const f = useCurrentFrame();
  const IN = 11;

  const i = interpolate(f, [0, IN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: IN_E,
  });
  // out >= life 이면 "나가는 전환 없음"(마지막 씬). 이걸 안 막으면
  // 페이드 구간이 음수에서 시작해 씬 전체가 서서히 흐려진다.
  const o =
    out >= life
      ? 1
      : interpolate(f, [life - out, life - 1], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: OUT_E,
        });

  // 들어오는 씬을 빨리 불투명하게 만들어야 겹치는 동안 둘 다 반투명해져 탁해지지 않는다
  const iFast = interpolate(f, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: IN_E,
  });

  let style: React.CSSProperties = { opacity: iFast * o };

  if (kind === "scale") {
    style.transform = `scale(${1.035 - 0.035 * i})`;
  } else if (kind === "wipeR") {
    style.clipPath = `inset(0 ${(1 - i) * 100}% 0 0)`;
    style.opacity = o;
  } else if (kind === "wipeL") {
    style.clipPath = `inset(0 0 0 ${(1 - i) * 100}%)`;
    style.opacity = o;
  } else if (kind === "curtain") {
    style.clipPath = `inset(${(1 - i) * 50}% 0 ${(1 - i) * 50}% 0)`;
    style.opacity = o;
  } else if (kind === "slideUp") {
    style.transform = `translateY(${(1 - i) * 46}px)`;
  } else if (kind === "zoomIn") {
    // 업무 화면 "안으로" 들어가는 느낌
    style.transform = `scale(${1.15 - 0.15 * i})`;
  } else if (kind === "zoomOut") {
    // 한 발 물러나며 마무리
    style.transform = `scale(${0.88 + 0.12 * i})`;
  } else if (kind === "slideL") {
    style.transform = `translateX(${(1 - i) * 72}px)`;
  }

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/** 전환 순간 화면을 스치는 얇은 빛줄기 — 씬이 바뀌었다는 신호 */
export const Sweep: React.FC<{ tone: "light" | "dark" }> = ({ tone }) => {
  const f = useCurrentFrame();
  if (f > 20) return null;
  const p = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp", easing: IN_E });
  const a = interpolate(f, [0, 6, 20], [0, 0.5, 0], { extrapolateRight: "clamp" });
  const c = tone === "dark" ? "255,255,255" : "91,75,219";
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: a,
        background: `linear-gradient(105deg, transparent ${p * 100 - 16}%, rgba(${c},0.30) ${
          p * 100
        }%, transparent ${p * 100 + 16}%)`,
      }}
    />
  );
};
