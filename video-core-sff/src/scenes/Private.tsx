import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, SANS, SERIF } from "../theme";
import { CaptionTiming, Tag, clamp01, fadeIn, useEnter } from "../ui";

const TILES: [string, string][] = [
  ["Your data", "Stays in your office."],
  ["Your model", "Trained on your own work."],
  ["Your machine", "No outbound traffic."],
];

const Tile: React.FC<{ kicker: string; text: string; delay: number }> = ({ kicker, text, delay }) => {
  const e = useEnter(delay, 15);
  const line = useEnter(delay + 8, 22);
  return (
    <div
      style={{
        flex: 1,
        padding: "30px 34px 34px",
        border: `1px solid ${C.goldDim}`,
        borderRadius: 12,
        background: C.ink,
        opacity: clamp01(e * 1.3),
        transform: `translateY(${(1 - e) * 46}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Tag size={17}>{kicker}</Tag>
      <div style={{ height: 1, background: C.gold, opacity: 0.6, transform: `scaleX(${line})`, transformOrigin: "left" }} />
      <div style={{ fontFamily: SANS, fontSize: 34, color: C.white, lineHeight: 1.25 }}>{text}</div>
    </div>
  );
};

/** One line, three tiles. */
export const Private: React.FC<{ timing: CaptionTiming; tag?: string; headline?: string }> = ({ timing, tag = "Private by design", headline = "Nothing leaves the firm." }) => {
  const frame = useCurrentFrame();
  const inA = fadeIn(frame, timing.enter, timing.inLen ?? 9);
  const outA = 1 - fadeIn(frame, timing.exitAt, timing.outLen ?? 6);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.08), rgba(0,0,0,0) 55%)` }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 230,
          textAlign: "center",
          opacity: inA * outA,
          transform: `translateY(${(1 - inA) * 14}px)`,
        }}
      >
        <div style={{ marginBottom: 26 }}>
          <Tag size={28}>{tag}</Tag>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 104, color: C.white, lineHeight: 1.05 }}>{headline}</div>
      </div>
      <div style={{ position: "absolute", left: 180, right: 180, top: 540, display: "flex", gap: 26 }}>
        {TILES.map(([k, t], i) => (
          <Tile key={k} kicker={k} text={t} delay={timing.enter + 10 + i * 8} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
