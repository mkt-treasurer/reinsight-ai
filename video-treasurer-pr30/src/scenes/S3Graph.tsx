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

/**
 * 모으는 일과 잇는 일을 한 씬에서 보여준다.
 * 왼쪽 줄기가 공개 자료, 오른쪽 줄기가 비공개 자료.
 * 둘이 가운데로 모여 노드가 되고, 그 다음 TA7Z 가 잇는다.
 */
const STREAMS = [
  { k: "PUBLIC", items: "Filings · Market data", x0: 150, w: 470, hero: false },
  {
    k: "PRIVATE",
    items: "Private-company financials · Ownership",
    x0: 1300,
    w: 470,
    hero: true,
  },
];

const DOTS = Array.from({ length: 150 }, (_, i) => {
  const side = i % 2;
  const s = STREAMS[side];
  return {
    side,
    x: s.x0 + rnd(i + 3) * s.w,
    y: 330 + rnd(i + 77) * 440,
    r: 1.8 + rnd(i + 151) * 1.7,
    n: i % NODES.length,
    d: Math.round(rnd(i + 233) * 34),
  };
});

export const S3Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1, c2] = cueAt("s-graph");
  const life = scene("s-graph").durationInFrames;

  // 완성된 그래프를 다음 씬이 경계 안에서 받아 간다
  const handoff = interpolate(frame, [life - 26, life - 1], [1, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  // 줄기 라벨은 점이 떠나면 비켜준다
  const tags = 1 - pIn(frame, c1 + 18, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 128, textAlign: "center" }}>
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
          We collect <span style={{ color: C.brandLite }}>public and private</span> data.
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -2.4,
            color: C.onDark,
            opacity: pIn(frame, c2 - 30, 16),
            transform: `translateY(${(1 - pIn(frame, c2 - 30, 16)) * 12}px)`,
          }}
        >
          Our <span style={{ color: C.brandLite }}>TA7Z ontology</span> connects it.
        </div>
      </div>

      {/* 두 줄기가 무엇인지 */}
      {STREAMS.map((s) => (
        <div
          key={s.k}
          style={{
            position: "absolute",
            left: s.x0 - 10,
            top: 268,
            width: s.w + 20,
            textAlign: "center",
            opacity: tags * pIn(frame, 10, 16),
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3.4,
              color: s.hero ? C.brandLite : C.onDark3,
            }}
          >
            {s.k}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
              color: C.onDark2,
            }}
          >
            {s.items}
          </div>
        </div>
      ))}

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
                fill={
                  travel > 0.1
                    ? C.brandLite
                    : p.side === 1
                      ? "rgba(96,165,250,0.70)"
                      : "rgba(148,163,184,0.55)"
                }
                opacity={o}
              />
            );
          })}

          {EDGES.map(([a, b], i) => {
            const A = NODES[a];
            const B = NODES[b];
            const p = interpolate(frame - (c1 + 40 + i * 3), [0, 18], [0, 1], {
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
            const p = pIn(frame, c1 + 24 + i * 4, 14);
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
          const p = pIn(frame, c1 + 36 + i * 3, 13);
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
          bottom: 92,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: 5,
          color: C.onDark2,
          opacity: pIn(frame, c2 + 2, 16),
        }}
      >
        6,800+ SOURCES · ONE GRAPH · LINKED IN TIME
      </div>
    </AbsoluteFill>
  );
};
