import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { Broll } from "../Footage";
import { CornerMark } from "../Brand";
import { cueAt, scene } from "../timing";

/**
 * 덱 5쪽 01 · DATA 그대로. 두 갈래의 자료가 한 레이어로 합쳐지고,
 * 마지막 한 줄이 다음 씬(누가 무엇을 가졌는지)으로 넘긴다.
 */
const SIDES = [
  { k: "PUBLIC", items: ["Korean filings", "Market data"], x: 300, hero: false },
  {
    k: "PRIVATE",
    items: ["Private-company financials", "Ownership & relationships"],
    x: 1060,
    hero: true,
  },
];

const CW = 560;
const CY = 356;
const CH = 236;
const MERGE_Y = 712;

export const S3Layers: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c1, c2] = cueAt("s-layers");
  const life = scene("s-layers").durationInFrames;

  const flow = interpolate(frame, [c2 - 26, c2 + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const hand = interpolate(frame, [life - 48, life - 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Broll
        id="demo-a"
        seconds={9.9}
        opacity={0.13}
        zoom={0.08}
        grade="saturate(0.3) brightness(0.7) contrast(1.08)"
        style={{ position: "absolute", inset: 0 }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,14,28,0.9) 0%, rgba(8,14,28,0.72) 46%, rgba(8,14,28,0.94) 100%)",
        }}
      />

      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 172, textAlign: "center" }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 5,
            color: C.brandLite,
            opacity: pIn(frame, 2, 14),
          }}
        >
          01 · DATA
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: -2.4,
            color: C.onDark,
            opacity: pIn(frame, 8, 18),
            transform: `translateY(${(1 - pIn(frame, 8, 18)) * 14}px)`,
          }}
        >
          Data a better model <span style={{ color: C.brandLite }}>can&apos;t buy</span>.
        </div>
      </div>

      {/* 두 갈래가 아래로 흘러 합쳐진다 */}
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {SIDES.map((s, i) => {
          const x = s.x + CW / 2;
          const p = interpolate(frame - (c2 - 30 + i * 6), [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          if (p <= 0.01) return null;
          const y1 = CY + CH;
          const mx = 960;
          return (
            <path
              key={s.k}
              d={`M ${x} ${y1} C ${x} ${y1 + 70}, ${mx} ${MERGE_Y - 70}, ${mx} ${MERGE_Y}`}
              stroke={s.hero ? "rgba(96,165,250,0.7)" : "rgba(148,163,184,0.5)"}
              strokeWidth={2.2}
              fill="none"
              strokeDasharray={340}
              strokeDashoffset={340 * (1 - p)}
            />
          );
        })}
      </svg>

      {SIDES.map((s, i) => {
        const p = pIn(frame, c1 - 20 + i * 12, 16);
        return (
          <div
            key={s.k}
            style={{
              position: "absolute",
              left: s.x,
              top: CY,
              width: CW,
              height: CH,
              border: `1px solid ${s.hero ? "rgba(96,165,250,0.5)" : C.onDarkLine2}`,
              background: s.hero ? "rgba(59,130,246,0.09)" : "rgba(148,163,184,0.05)",
              borderRadius: 7,
              padding: "28px 32px",
              opacity: p,
              transform: `translateY(${(1 - p) * 18}px)`,
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
            <div style={{ marginTop: 22 }}>
              {s.items.map((it, k) => (
                <div
                  key={it}
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: -0.9,
                    lineHeight: 1.5,
                    color: C.onDark,
                    opacity: pIn(frame, c1 - 12 + i * 12 + k * 7, 14),
                  }}
                >
                  {it}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 한 레이어로 */}
      <div
        style={{
          position: "absolute",
          left: 300,
          top: MERGE_Y,
          width: 1320,
          display: "flex",
          alignItems: "center",
          gap: 26,
          border: `1px solid rgba(96,165,250,${0.35 + flow * 0.4})`,
          background: `rgba(59,130,246,${0.08 + flow * 0.08})`,
          borderRadius: 7,
          padding: "26px 34px 28px",
          opacity: pIn(frame, c2 - 20, 16),
          boxShadow: `0 0 ${flow * 54}px rgba(59,130,246,0.3)`,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3.4,
            color: C.brandLite,
            flex: "0 0 auto",
          }}
        >
          ONE LAYER
        </span>
        <span style={{ width: 1, height: 28, background: C.onDarkLine2 }} />
        <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.9, color: C.onDark }}>
          Collected and cleaned in real time
        </span>
      </div>

      {/* 다음 씬으로 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: MERGE_Y + 126,
          textAlign: "center",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: -0.9,
          color: C.onDark2,
          opacity: hand,
          transform: `translateY(${(1 - hand) * 10}px)`,
        }}
      >
        Then linked — <span style={{ color: C.onDark, fontWeight: 700 }}>who owns what, as of when</span>
        .
      </div>
    </AbsoluteFill>
  );
};
