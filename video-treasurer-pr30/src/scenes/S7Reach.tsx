import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { cueAt } from "../timing";

/** Status is taken straight from the deck: Korea live, SG/HK in pilot, JP/US planned */
const STOPS = [
  { k: "KOREA", s: "LIVE", x: 470, y: 640, on: true },
  { k: "SINGAPORE", s: "PILOT", x: 880, y: 726, on: true },
  { k: "HONG KONG", s: "PILOT", x: 1210, y: 596, on: true },
  { k: "JAPAN · US", s: "NEXT", x: 1560, y: 512, on: false },
];

export const S7Reach: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-reach");

  const n = interpolate(frame - 4, [0, 30], [0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.dark }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 176, textAlign: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 20,
            opacity: pIn(frame, 2, 14),
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1,
              color: C.onDark,
            }}
          >
            {Math.round(n)}
            <span style={{ color: C.brandLite }}>+</span>
          </span>
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.6, color: C.onDark }}>
            institutions already run Treasurer AX
          </span>
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {STOPS.slice(0, -1).map((s, i) => {
          const a = STOPS[i];
          const b = STOPS[i + 1];
          const p = interpolate(frame - (c0 + 14 + i * 12), [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          if (p <= 0.01) return null;
          const mx = (a.x + b.x) / 2;
          const my = Math.min(a.y, b.y) - 110;
          const t = p;
          const qx = (1 - t) * ((1 - t) * a.x + t * mx) + t * ((1 - t) * mx + t * b.x);
          const qy = (1 - t) * ((1 - t) * a.y + t * my) + t * ((1 - t) * my + t * b.y);
          return (
            <path
              key={`p${i}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${qx} ${qy}`}
              stroke={b.on ? "rgba(96,165,250,0.6)" : "rgba(148,163,184,0.34)"}
              strokeWidth={2}
              strokeDasharray={b.on ? undefined : "6 6"}
              fill="none"
            />
          );
        })}
        {STOPS.map((s, i) => {
          const p = pIn(frame, c0 + 8 + i * 12, 13);
          return (
            <g key={s.k}>
              <circle
                cx={s.x}
                cy={s.y}
                r={16 * p}
                fill={s.on ? C.brand : "rgba(148,163,184,0.4)"}
                opacity={p}
              />
              {s.on ? (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={16 * p * (1.5 + 0.5 * Math.sin((frame - i * 7) / 6))}
                  fill="none"
                  stroke="rgba(96,165,250,0.35)"
                  strokeWidth={1.5}
                  opacity={p}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {STOPS.map((s, i) => {
        const p = pIn(frame, c0 + 12 + i * 12, 13);
        return (
          <div
            key={s.k}
            style={{
              position: "absolute",
              left: s.x - 170,
              top: s.y + 34,
              width: 340,
              textAlign: "center",
              opacity: p,
            }}
          >
            <div
              style={{
                fontSize: 27,
                fontWeight: 700,
                letterSpacing: -0.6,
                color: s.on ? C.onDark : C.onDark3,
              }}
            >
              {s.k}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2.6,
                color: s.on ? C.brandLite : C.onDark3,
              }}
            >
              {s.s}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 116,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 4.4,
          color: C.onDark3,
          opacity: pIn(frame, c1, 16),
        }}
      >
        ASSET MANAGERS · SECURITIES · INSURANCE · PRIVATE MARKETS
      </div>
    </AbsoluteFill>
  );
};
