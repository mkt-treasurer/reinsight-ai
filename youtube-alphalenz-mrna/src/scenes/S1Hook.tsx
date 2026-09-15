import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { Eyebrow, Rise, pIn } from "../lib";
import { cueAt } from "../timing";

const PTS = [
  [0, 300], [60, 292], [120, 305], [180, 286], [240, 296],
  [300, 280], [360, 288], [420, 270], [480, 276], [540, 258],
  [600, 262], [640, 180], [680, 96], [720, 40],
];
const path = PTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
const LEN = 1250;

/** 첫 큐는 인사말이라, 숫자·차트는 두 번째 큐가 시작될 때 붙는다 */
export const S1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const [, a] = cueAt("s1-hook");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  const pct = interpolate(frame - (a + 8), [0, 40], [0, 177], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const draw = P(a + 6, 46);
  const glowP = interpolate(frame - (a + 42), [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", right: SAFE - 20, top: 250, opacity: 0.95 }}>
        <svg width={760} height={360} viewBox="0 0 760 340">
          <defs>
            <linearGradient id="ln" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.faint} />
              <stop offset="72%" stopColor={C.green} />
              <stop offset="100%" stopColor="#7BFFCE" />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill="none"
            stroke="url(#ln)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - draw)}
          />
          <circle cx={720} cy={40} r={12 + glowP * 6} fill={C.green} opacity={glowP} />
          <circle
            cx={720}
            cy={40}
            r={30 * glowP}
            fill="none"
            stroke={C.green}
            strokeWidth={2}
            opacity={0.35 * (1 - glowP) + 0.2}
          />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          top: 236,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Eyebrow>2026.08.19 · NASDAQ</Eyebrow>
        <Rise delay={6} style={{ marginTop: 34 }}>
          <div style={{ fontSize: 40, fontWeight: 600, color: C.textDim, letterSpacing: 2 }}>
            MODERNA <span style={{ color: C.muted }}>· MRNA</span>
          </div>
        </Rise>
        <Rise delay={a + 4} y={30}>
          <div
            style={{
              fontSize: 250,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -12,
              color: C.green,
              textShadow: `0 0 90px rgba(25,201,140,${0.28 + glowP * 0.25})`,
              marginTop: 6,
            }}
          >
            +{pct.toFixed(0)}%
          </div>
        </Rise>
        <Rise delay={a + 32} y={18}>
          <div style={{ fontSize: 46, fontWeight: 500, color: C.textDim, marginTop: 4 }}>
            하루 만에 반영된 임상 3상 뉴스
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};
