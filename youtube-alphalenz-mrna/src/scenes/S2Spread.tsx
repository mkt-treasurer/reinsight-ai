import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { Eyebrow, EASE, pIn } from "../lib";
import { cueAt } from "../timing";

const TARGETS = [
  { name: "소마젠", tag: "상한가", y: 240 },
  { name: "삼양바이오팜", tag: "매수세 유입", y: 410 },
  { name: "그 외 mRNA 관련주", tag: "동반 강세", y: 580 },
];

export const S2Spread: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2] = cueAt("s2-spread");
  const q = interpolate(frame - c2, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const dim = 1 - q * 0.62;
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE, top: 132 }}>
        <Eyebrow>SPILLOVER · 08.20 KRX</Eyebrow>
      </div>

      <div style={{ opacity: dim, transition: "none" }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {TARGETS.map((t, i) => {
            const p = P(16 + i * 9, 24);
            const y2 = t.y + 58;
            const d = `M620,425 C830,425 900,${y2} 1160,${y2}`;
            return (
              <g key={t.name}>
                <path
                  d={d}
                  fill="none"
                  stroke={C.brandLite}
                  strokeWidth={2.5}
                  opacity={0.55}
                  strokeDasharray={900}
                  strokeDashoffset={900 * (1 - p)}
                />
                <circle cx={1160} cy={y2} r={7 * p} fill={C.brandLite} />
              </g>
            );
          })}
        </svg>

        {(() => {
          const p = P(2, 22);
          return (
            <div
              style={{
                position: "absolute",
                left: SAFE,
                top: 320,
                width: 488,
                padding: "34px 38px",
                borderRadius: 22,
                background: "rgba(25,201,140,0.09)",
                border: `1px solid rgba(25,201,140,0.34)`,
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 3, color: C.muted }}>
                08.19 · US
              </div>
              <div style={{ fontSize: 54, fontWeight: 700, color: C.text, marginTop: 8 }}>
                모더나
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.green, marginTop: 6 }}>
                +177% · 임상 3상 성공
              </div>
            </div>
          );
        })()}

        {TARGETS.map((t, i) => {
          const p = P(24 + i * 9, 22);
          return (
            <div
              key={t.name}
              style={{
                position: "absolute",
                left: 1188,
                top: t.y,
                width: 560,
                padding: "26px 32px",
                borderRadius: 20,
                background: "rgba(10,12,22,0.74)",
                border: `1px solid rgba(255,255,255,0.16)`,
                opacity: p,
                transform: `translateX(${(1 - p) * 26}px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 42, fontWeight: 700, color: C.text }}>{t.name}</span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: C.brandLite,
                  background: "rgba(101,85,238,0.16)",
                  border: `1px solid rgba(139,124,255,0.3)`,
                  borderRadius: 999,
                  padding: "8px 18px",
                }}
              >
                {t.tag}
              </span>
            </div>
          );
        })}
      </div>

      {q > 0.01 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 1150,
              top: 196,
              width: 636,
              height: 522,
              borderRadius: 28,
              border: `2px dashed rgba(139,124,255,${0.75 * q})`,
              opacity: q,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 1150,
              top: 152,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 3,
              color: C.brandLite,
              opacity: q,
            }}
          >
            ‘mRNA 관련주’
          </div>
          <div
            style={{
              position: "absolute",
              left: SAFE,
              top: 600,
              opacity: q,
              display: "flex",
              alignItems: "center",
              gap: 36,
              transform: `scale(${0.94 + q * 0.06})`,
              transformOrigin: "left center",
            }}
          >
            <div
              style={{
                fontSize: 150,
                fontWeight: 800,
                color: C.brandLite,
                lineHeight: 1,
                textShadow: "0 0 80px rgba(139,124,255,0.45)",
              }}
            >
              ?
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: C.text,
                marginTop: 0,
                letterSpacing: -1.6,
                lineHeight: 1.32,
                width: 520,
              }}
            >
              같은 이름표면,<br />같은 이야기일까?
            </div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
