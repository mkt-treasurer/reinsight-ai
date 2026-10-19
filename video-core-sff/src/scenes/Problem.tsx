import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, MONO, SANS } from "../theme";
import { CaptionTiming, Headline, Tag, clamp01, fadeIn, useEnter } from "../ui";

/** What the analyst would open by hand: four filings, two old notes, a spreadsheet. */
const PILE: [string, string, number, number, number][] = [
  // label, kind, x, y, rotation
  ["NVIDIA Q3 FY26 results", "PDF", 300, 540, -7],
  ["NVIDIA Q4 FY26 results", "PDF", 560, 590, 5],
  ["NVIDIA Q1 FY27 results", "PDF", 420, 680, -3],
  ["NVIDIA Q2 FY27 results", "PDF", 760, 520, 8],
  ["Our Q1 preview · J. Park", "NOTE", 1020, 640, -5],
  ["Our Q2 preview", "NOTE", 1180, 550, 6],
  ["nvda_guidance_tracker.xlsx", "XLSX", 900, 730, -2],
];

const rnd = (i: number) => {
  const x = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
};

const Doc: React.FC<{ label: string; kind: string; x: number; y: number; rot: number; delay: number }> = ({ label, kind, x, y, rot, delay }) => {
  const e = useEnter(delay, 13);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 380,
        padding: "18px 22px",
        background: "#f4f4f1",
        color: "#1a1c22",
        borderRadius: 10,
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        opacity: clamp01(e * 1.4),
        transform: `translateY(${(1 - e) * -140}px) rotate(${rot + (1 - e) * 12}deg) scale(${0.9 + 0.1 * e})`,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, padding: "4px 8px", borderRadius: 4, background: kind === "NOTE" ? "#e9dcb3" : "#e4e6ec", color: "#3a3d46" }}>{kind}</span>
      <span style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600 }}>{label}</span>
    </div>
  );
};

/** The morning that Core replaces: the clock races while documents pile up. */
export const Problem: React.FC<{ timing: CaptionTiming; tag?: string; headline: string }> = ({ timing, tag, headline }) => {
  const frame = useCurrentFrame();
  // clock races from 7:10 to 11:30 over the scene
  const mins = Math.round(interpolate(frame, [timing.enter, timing.exitAt], [0, 260], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const h = 7 + Math.floor((10 + mins) / 60);
  const m = (10 + mins) % 60;
  const clock = `${h}:${String(m).padStart(2, "0")} AM`;
  const foot = fadeIn(frame, timing.enter + 50, 10) * (1 - fadeIn(frame, timing.exitAt, 6));

  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 70%, rgba(255,255,255,0.05), rgba(0,0,0,0) 60%)` }} />

      <div style={{ position: "absolute", left: 84, top: 56, display: "flex", alignItems: "center", gap: 14, opacity: fadeIn(frame, timing.enter, 8) }}>
        <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
        <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 4, color: C.gold }}>{clock}</span>
      </div>

      <Headline tag={tag} text={headline} timing={timing} />

      {/* the pile */}
      {PILE.map(([label, kind, x, y, rot], i) => (
        <Doc key={label} label={label} kind={kind} x={x} y={y} rot={rot} delay={timing.enter + 10 + i * 6 + Math.round(rnd(i) * 3)} />
      ))}

      {/* what it costs */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 92,
          textAlign: "center",
          opacity: foot,
        }}
      >
        <Tag size={22} color={C.white2}>4 filings · 2 old notes · 1 spreadsheet · by hand</Tag>
      </div>
    </AbsoluteFill>
  );
};
