import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt } from "../timing";
import { Card, CardHead, PAPER, Say, PathTag } from "../ui/Card";

/** 덱 5쪽 그대로: Treasurer vs GPT-5.2 / Gemini 3.1 Pro 중 더 나은 쪽 */
const TRACKS = [
  { k: "Freshness", ours: 0.85, theirs: 0.65 },
  { k: "Precision", ours: 0.8, theirs: 0.76 },
  { k: "Screening", ours: 0.72, theirs: 0.68 },
  { k: "Cross-source", ours: 0.95, theirs: 0.95 },
];

const BAR_X = 210;
const BAR_W = 430;
const ROW_TOP = 30;
const PITCH = 116;

export const S4Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0] = cueAt("s-bench");

  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: PAPER }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 62,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: pIn(frame, 0, 12),
        }}
      >
        <span style={{ width: 12, height: 12, background: C.brand, transform: "rotate(45deg)" }} />
        <span
          style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 4.5, color: C.ink2 }}
        >
          TREASURER AX
        </span>
      </div>

      <Say
        y={372}
        p={pIn(frame, 4, 18)}
        sub="Measured on the Fin-RATE benchmark, against the better of GPT-5.2 and Gemini 3.1 Pro."
        subP={pIn(frame, 16, 18)}
      >
        Treasurer AX beats
        <br />
        general models.
      </Say>

      <PathTag p={pIn(frame, 20, 14)}>/ax/benchmark</PathTag>

      <Card x={880} y={214} w={912} h={624} p={pIn(frame, 8, 16)}>
        <CardHead label="FIN-RATE-BASED BENCHMARK" right="SEPTEMBER 2026" />

        <div
          style={{
            display: "flex",
            gap: 26,
            padding: "16px 26px 10px",
            borderBottom: "1px solid #eef2f7",
          }}
        >
          {[
            { c: C.brand, t: "TREASURER AX" },
            { c: "rgba(15,23,42,0.18)", t: "GPT-5.2 · GEMINI 3.1 PRO" },
          ].map((l) => (
            <span key={l.t} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 13, height: 13, background: l.c, borderRadius: 2 }} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  color: C.ink3,
                }}
              >
                {l.t}
              </span>
            </span>
          ))}
        </div>

        <div style={{ position: "relative", height: 420, padding: "0 26px" }}>
          {TRACKS.map((t, i) => {
            const y = ROW_TOP + i * PITCH;
            const g = interpolate(frame - (c0 + 6 + i * 8), [0, 24], [0, 1], {
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
                    left: 26,
                    top: y + 14,
                    width: 190,
                    fontSize: 27,
                    fontWeight: 600,
                    letterSpacing: -0.8,
                    color: C.ink,
                    opacity: show,
                  }}
                >
                  {t.k}
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: BAR_X,
                    top: y + 4,
                    width: BAR_W * t.ours * g,
                    height: 24,
                    background: C.brand,
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: BAR_X + BAR_W * t.ours + 16,
                    top: y,
                    fontFamily: MONO,
                    fontSize: 27,
                    fontWeight: 700,
                    color: C.brand,
                    opacity: pIn(frame, c0 + 20 + i * 8, 12),
                  }}
                >
                  {t.ours.toFixed(2)}
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: BAR_X,
                    top: y + 36,
                    width: BAR_W * t.theirs * g,
                    height: 24,
                    background: "rgba(15,23,42,0.13)",
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: BAR_X + BAR_W * t.theirs + 16,
                    top: y + 34,
                    fontFamily: MONO,
                    fontSize: 24,
                    fontWeight: 500,
                    color: C.ink4,
                    opacity: pIn(frame, c0 + 20 + i * 8, 12),
                  }}
                >
                  {t.theirs.toFixed(2)}
                </div>

                {gap > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 770,
                      top: y + 14,
                      fontFamily: MONO,
                      fontSize: 22,
                      fontWeight: 700,
                      color: C.accent,
                      opacity: pIn(frame, c0 + 26 + i * 8, 12),
                    }}
                  >
                    +{gap.toFixed(2)}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 26,
            right: 26,
            bottom: 20,
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: 1.6,
            color: C.ink4,
            opacity: pIn(frame, 26, 16),
          }}
        >
          TREASURER IN-HOUSE EVALUATION
        </div>
      </Card>
    </AbsoluteFill>
  );
};
