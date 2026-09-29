import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { cueAt } from "../timing";

/** A small moving picture of each job, so the words aren't doing all the work */
const Glyph: React.FC<{ kind: "note" | "alert" | "report"; p: number; frame: number }> = ({
  kind,
  p,
  frame,
}) => {
  if (kind === "note") {
    return (
      <svg width={86} height={86}>
        {[0, 1, 2, 3].map((i) => {
          const g = interpolate(frame - (14 + i * 7), [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          return (
            <rect
              key={i}
              x={4}
              y={16 + i * 16}
              width={(i === 3 ? 44 : 74) * g}
              height={7}
              rx={3}
              fill={i === 3 ? C.brandLite : "rgba(232,238,247,0.55)"}
            />
          );
        })}
      </svg>
    );
  }
  if (kind === "alert") {
    const beat = (frame % 34) / 34;
    return (
      <svg width={86} height={86}>
        <circle
          cx={43}
          cy={43}
          r={10 + beat * 26}
          fill="none"
          stroke={C.brandLite}
          strokeWidth={2}
          opacity={(1 - beat) * 0.8 * p}
        />
        <circle cx={43} cy={43} r={10} fill={C.brandLite} opacity={p} />
      </svg>
    );
  }
  const H = [34, 54, 24, 66];
  return (
    <svg width={86} height={86}>
      {H.map((h, i) => {
        const g = interpolate(frame - (14 + i * 6), [0, 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        return (
          <rect
            key={i}
            x={4 + i * 21}
            y={78 - h * g}
            width={13}
            height={h * g}
            rx={2}
            fill={i === 3 ? C.brandLite : "rgba(232,238,247,0.5)"}
          />
        );
      })}
    </svg>
  );
};

const JOBS: { w: string; d: string; g: "note" | "alert" | "report" }[] = [
  { w: "Research", d: "a company note, written from the filings", g: "note" },
  { w: "Monitoring", d: "an alert the day a holding changes", g: "alert" },
  { w: "Reporting", d: "the recurring report, in your template", g: "report" },
];

/** Ends by picking the one job the next shot is about to run, so the cut isn't a jump */
export const S2What: React.FC = () => {
  const frame = useCurrentFrame();
  cueAt("s-what");

  const pick = pIn(frame, 88, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.dark }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 196,
          textAlign: "center",
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: -2.5,
          color: C.onDark,
          opacity: pIn(frame, 2, 16),
          transform: `translateY(${(1 - pIn(frame, 2, 16)) * 14}px)`,
        }}
      >
        Three jobs analysts repeat <span style={{ color: C.brandLite }}>every week</span>.
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", marginTop: 40 }}>
        <div style={{ display: "flex", gap: 30 }}>
          {JOBS.map((j, i) => {
            const at = 4 + i * 14;
            const p = pIn(frame, at, 15);
            const on = i === 1;
            return (
              <div
                key={j.w}
                style={{
                  width: 476,
                  height: 396,
                  border: on
                    ? `1px solid rgba(96,165,250,${0.3 + pick * 0.6})`
                    : `1px solid ${C.onDarkLine2}`,
                  background: on
                    ? `rgba(59,130,246,${0.05 + pick * 0.1})`
                    : "rgba(148,163,184,0.05)",
                  borderRadius: 6,
                  padding: "38px 36px",
                  opacity: p * (on ? 1 : 1 - pick * 0.6),
                  transform: `translateY(${(1 - p) * 24}px) scale(${
                    on ? 1 + pick * 0.04 : 1 - pick * 0.03
                  })`,
                  boxShadow: on ? `0 0 ${pick * 60}px rgba(59,130,246,0.3)` : "none",
                }}
              >
                <Glyph kind={j.g} p={p} frame={frame - at} />
                <div
                  style={{
                    marginTop: 30,
                    fontSize: 52,
                    fontWeight: 700,
                    letterSpacing: -2,
                    color: C.onDark,
                  }}
                >
                  {j.w}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 27,
                    fontWeight: 500,
                    lineHeight: 1.42,
                    color: C.onDark2,
                    opacity: pIn(frame, at + 10, 14),
                  }}
                >
                  {j.d}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 848,
          textAlign: "center",
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: -1.5,
          color: C.onDark,
          opacity: pIn(frame, 100, 16),
          transform: `translateY(${(1 - pIn(frame, 100, 16)) * 12}px)`,
        }}
      >
        Watch <span style={{ color: C.brandLite }}>Monitoring</span> run.
      </div>
    </AbsoluteFill>
  );
};
