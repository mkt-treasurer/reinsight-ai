import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { NODES, EDGES } from "../ui/Graph";
import { cueAt, scene } from "../timing";

const rnd = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const DOTS = Array.from({ length: 170 }, (_, i) => ({
  x: 180 + rnd(i + 3) * 1560,
  y: 300 + rnd(i + 77) * 540,
  r: 1.8 + rnd(i + 151) * 1.7,
  n: i % NODES.length,
  d: Math.round(rnd(i + 233) * 34),
}));

/** Answers the shot before it: this is how the agent knew. */
export const S3Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1, c2] = cueAt("s-graph");
  const life = scene("s-graph").durationInFrames;

  // hands the finished graph to the next shot, which catches it inside a boundary
  const handoff = interpolate(frame, [life - 26, life - 1], [1, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.darkDeep }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 130, textAlign: "center" }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -2.4,
            color: C.onDark,
            opacity: pIn(frame, 2, 16),
            transform: `translateY(${(1 - pIn(frame, 2, 16)) * 12}px)`,
          }}
        >
          We don't just collect the data.
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -2.4,
            color: C.brandLite,
            opacity: pIn(frame, c2 - 24, 16),
            transform: `translateY(${(1 - pIn(frame, c2 - 24, 16)) * 12}px)`,
          }}
        >
          Our TA7Z ontology connects it.
        </div>
      </div>

      <AbsoluteFill style={{ transform: `scale(${handoff})`, transformOrigin: "50% 54%" }}>
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          {DOTS.map((p, i) => {
            const target = NODES[p.n];
            const appear = pIn(frame, c0 + p.d, 12);
            const travel = interpolate(frame - (c1 + p.d * 0.5), [0, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            const o = appear * (1 - travel);
            if (o <= 0.01) return null;
            return (
              <circle
                key={`d${i}`}
                cx={p.x + (target.x - p.x) * travel}
                cy={p.y + (target.y - p.y) * travel}
                r={p.r}
                fill={travel > 0.1 ? C.brandLite : "rgba(148,163,184,0.55)"}
                opacity={o}
              />
            );
          })}

          {EDGES.map(([a, b], i) => {
            const A = NODES[a];
            const B = NODES[b];
            const p = interpolate(frame - (c1 + 34 + i * 3), [0, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            if (p <= 0.01) return null;
            return (
              <line
                key={`e${i}`}
                x1={A.x}
                y1={A.y}
                x2={A.x + (B.x - A.x) * p}
                y2={A.y + (B.y - A.y) * p}
                stroke="rgba(96,165,250,0.45)"
                strokeWidth={1.8}
              />
            );
          })}

          {NODES.map((nd, i) => {
            const p = pIn(frame, c1 + 18 + i * 4, 14);
            if (p <= 0.01) return null;
            return (
              <g key={nd.k}>
                <circle
                  cx={nd.x}
                  cy={nd.y}
                  r={nd.r * p * 2.1}
                  fill={nd.hub ? "rgba(59,130,246,0.16)" : "rgba(96,165,250,0.10)"}
                  opacity={p}
                />
                <circle
                  cx={nd.x}
                  cy={nd.y}
                  r={nd.r * p}
                  fill={nd.hub ? C.brand : C.brandLite}
                  opacity={p}
                />
              </g>
            );
          })}
        </svg>

        {NODES.map((nd, i) => {
          const p = pIn(frame, c1 + 30 + i * 3, 13);
          return (
            <div
              key={nd.k}
              style={{
                position: "absolute",
                left: nd.x - 120,
                top: nd.y + nd.r + 14,
                width: 240,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: nd.hub ? 22 : 19,
                fontWeight: 700,
                letterSpacing: 2.2,
                color: nd.hub ? C.onDark : C.onDark2,
                opacity: p,
              }}
            >
              {nd.k.toUpperCase()}
            </div>
          );
        })}
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 96,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: 5,
          color: C.onDark2,
          opacity: pIn(frame, c2 + 6, 16),
        }}
      >
        6,800+ SOURCES · ONE GRAPH · LINKED IN TIME
      </div>
    </AbsoluteFill>
  );
};
