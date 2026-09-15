import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";
import timing from "./timing.json";

type Cue = { sub: string; from: number; to: number };

const CUES: Cue[] = [];
for (const s of timing.scenes as any[]) {
  for (const c of s.cues) {
    const from = s.from + c.fromInScene;
    CUES.push({ sub: c.sub, from, to: from + c.framesInScene });
  }
}

/** 뉴스 자막용 두꺼운 검은 외곽선 — 배경이 밝든 어둡든 읽힌다 */
const OUTLINE = (px: number) => {
  const out: string[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps;
    out.push(`${(Math.cos(a) * px).toFixed(2)}px ${(Math.sin(a) * px).toFixed(2)}px 0 #05060B`);
  }
  out.push(`0 ${px * 1.5}px ${px * 3}px rgba(0,0,0,0.55)`);
  return out.join(", ");
};

/** `**키워드**` 는 형광 박스로 강조 */
const render = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => {
    if (!part.startsWith("**")) return <span key={i}>{part}</span>;
    return (
      <span
        key={i}
        style={{
          background: C.hi,
          color: "#0B0C12",
          borderRadius: 8,
          padding: "2px 12px 6px",
          margin: "0 3px",
          textShadow: "none",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        {part.slice(2, -2)}
      </span>
    );
  });

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const PRE = 4;
  const POST = 7;
  const active = CUES.find((c) => frame >= c.from - PRE && frame <= c.to + POST);
  if (!active) return null;

  const o =
    interpolate(frame, [active.from - PRE, active.from + 3], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [active.to, active.to + POST], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const y = interpolate(frame, [active.from - PRE, active.from + 5], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 72,
        display: "flex",
        justifyContent: "center",
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1560,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.52,
          letterSpacing: -1.6,
          wordBreak: "keep-all",
          color: "#FFFFFF",
          textShadow: OUTLINE(4.5),
          padding: "0 40px",
        }}
      >
        {render(active.sub)}
      </div>
    </div>
  );
};
