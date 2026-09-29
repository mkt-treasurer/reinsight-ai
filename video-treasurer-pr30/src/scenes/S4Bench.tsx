import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { cueAt } from "../timing";

/** Verbatim from the deck: Treasurer vs the better of GPT-5.2 / Gemini 3.1 Pro */
const TRACKS = [
  { k: "Freshness", ours: 0.85, theirs: 0.65 },
  { k: "Precision", ours: 0.8, theirs: 0.76 },
  { k: "Screening", ours: 0.72, theirs: 0.68 },
  { k: "Cross-source", ours: 0.95, theirs: 0.95 },
];

const X = 520;
const W = 880;
const TOP = 388;
const PITCH = 142;

export const S4Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0] = cueAt("s-bench");

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.darkDeep }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 118, textAlign: "center" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 5,
            color: C.brandLite,
            marginBottom: 22,
            opacity: pIn(frame, 0, 14),
          }}
        >
          ON THE FIN-RATE BENCHMARK
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: -2.4,
            color: C.onDark,
            opacity: pIn(frame, 2, 16),
          }}
        >
          Treasurer AX <span style={{ color: C.brandLite }}>beats general models</span>.
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            gap: 36,
            opacity: pIn(frame, 10, 16),
          }}
        >
          {[
            { c: C.brandLite, t: "TREASURER AX" },
            { c: "rgba(148,163,184,0.42)", t: "GPT-5.2 · GEMINI 3.1 PRO" },
          ].map((l) => (
            <span key={l.t} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 17, height: 17, background: l.c, borderRadius: 2 }} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: C.onDark2,
                }}
              >
                {l.t}
              </span>
            </span>
          ))}
        </div>
      </div>

      {TRACKS.map((t, i) => {
        const y = TOP + i * PITCH;
        const p = interpolate(frame - (c0 + 6 + i * 8), [0, 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        const show = pIn(frame, c0 + 6 + i * 8, 14);
        const gap = t.ours - t.theirs;
        return (
          <React.Fragment key={t.k}>
            <div
              style={{
                position: "absolute",
                left: 120,
                top: y + 12,
                width: 380,
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: -1,
                color: C.onDark,
                opacity: show,
              }}
            >
              {t.k}
            </div>

            <div
              style={{
                position: "absolute",
                left: X,
                top: y,
                width: W * t.ours * p,
                height: 32,
                background: `linear-gradient(90deg, ${C.brand}, ${C.brandLite})`,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: X + W * t.ours + 22,
                top: y - 3,
                fontFamily: MONO,
                fontSize: 34,
                fontWeight: 700,
                color: C.brandLite,
                opacity: pIn(frame, c0 + 6 + i * 8 + 16, 12),
              }}
            >
              {t.ours.toFixed(2)}
            </div>

            <div
              style={{
                position: "absolute",
                left: X,
                top: y + 42,
                width: W * t.theirs * p,
                height: 32,
                background: "rgba(148,163,184,0.24)",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: X + W * t.theirs + 22,
                top: y + 41,
                fontFamily: MONO,
                fontSize: 30,
                fontWeight: 500,
                color: C.onDark3,
                opacity: pIn(frame, c0 + 6 + i * 8 + 16, 12),
              }}
            >
              {t.theirs.toFixed(2)}
            </div>

            {gap > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: X + W + 116,
                  top: y + 14,
                  fontFamily: MONO,
                  fontSize: 26,
                  fontWeight: 700,
                  color: C.emerald,
                  opacity: pIn(frame, c0 + 6 + i * 8 + 22, 12),
                }}
              >
                +{gap.toFixed(2)}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 120,
          top: TOP + TRACKS.length * PITCH + 10,
          fontFamily: MONO,
          fontSize: 17,
          letterSpacing: 1.6,
          color: C.onDark2,
          opacity: pIn(frame, 20, 16),
        }}
      >
        FIN-RATE-BASED · TREASURER IN-HOUSE EVALUATION · SEPTEMBER 2026
      </div>
    </AbsoluteFill>
  );
};
