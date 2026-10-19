import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, MONO, SANS, SERIF } from "../theme";
import { CaptionTiming, Tag, clamp01, fadeIn, useEnter } from "../ui";

const TILES: [string, string, string][] = [
  ["Your data", "Your research, in your office.", "notes · previews · the book"],
  ["Your model", "Trained on your own work.", "weights: yours"],
  ["Your machine", "Nothing leaves the firm.", "outbound traffic: none"],
];

const Tile: React.FC<{ kicker: string; text: string; meta: string; delay: number }> = ({ kicker, text, meta, delay }) => {
  const e = useEnter(delay, 15);
  const line = useEnter(delay + 8, 22);
  return (
    <div
      style={{
        flex: 1,
        padding: "30px 34px 32px",
        border: `1px solid ${C.goldDim}`,
        borderRadius: 12,
        background: C.ink,
        opacity: clamp01(e * 1.3),
        transform: `translateY(${(1 - e) * 46}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Tag size={15}>{kicker}</Tag>
      <div style={{ height: 1, background: C.gold, opacity: 0.6, transform: `scaleX(${line})`, transformOrigin: "left" }} />
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.white, lineHeight: 1.25 }}>{text}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, color: C.white3, letterSpacing: 1 }}>{meta}</div>
    </div>
  );
};

/** Your data. Your model. Your machine. */
export const Private: React.FC<{ timing: CaptionTiming; headline?: string }> = ({ timing, headline = "Your data. Your model. Your machine." }) => {
  const frame = useCurrentFrame();
  const inA = fadeIn(frame, timing.enter, timing.inLen ?? 9);
  const outA = 1 - fadeIn(frame, timing.exitAt, timing.outLen ?? 6);
  const sub = fadeIn(frame, timing.enter + 10, 10);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.08), rgba(0,0,0,0) 55%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 180,
          textAlign: "center",
          opacity: inA * outA,
          transform: `translateY(${(1 - inA) * 14}px)`,
        }}
      >
        <div style={{ marginBottom: 26 }}>
          <Tag size={28}>Private by design</Tag>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 70, color: C.white, lineHeight: 1.12, maxWidth: 1400, margin: "0 auto", textWrap: "balance" }}>{headline}</div>
        <div style={{ marginTop: 20, fontFamily: SERIF, fontSize: 36, fontStyle: "italic", color: C.white2, opacity: sub }}>
          Your data. Your model. Your machine. Nothing leaves the firm.
        </div>
      </div>
      <div style={{ position: "absolute", left: 180, right: 180, top: 500, display: "flex", gap: 26 }}>
        {TILES.map(([k, t, m], i) => (
          <Tile key={k} kicker={k} text={t} meta={m} delay={timing.enter + 10 + i * 8} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
