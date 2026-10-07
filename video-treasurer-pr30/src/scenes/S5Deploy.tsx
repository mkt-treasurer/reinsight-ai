import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { GraphStatic } from "../ui/Graph";
import { cueAt } from "../timing";

const RED = "#f87171";

/** 왼쪽은 고객 경계 안, 오른쪽은 바깥 — 가운데 선에서 데이터가 막힌다 */
const SPLIT = 1180;
const BOX = { x: 150, y: 338, w: SPLIT - 150 - 46, h: 470 };
const BC = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 + 30 };

/** 고객 환경 안의 DB */
const DB: React.FC<{ x: number; y: number; w: number; label: string; sub: string; p: number }> = ({
  x,
  y,
  w,
  label,
  sub,
  p,
}) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, opacity: p }}>
    <svg width={w} height={74} style={{ display: "block" }}>
      <ellipse cx={w / 2} cy={14} rx={w / 2 - 2} ry={13} fill="rgba(59,130,246,0.22)" stroke={C.brand} />
      <path
        d={`M 2 14 L 2 56 A ${w / 2 - 2} 13 0 0 0 ${w - 2} 56 L ${w - 2} 14`}
        fill="rgba(59,130,246,0.12)"
        stroke={C.brand}
      />
      <ellipse cx={w / 2} cy={34} rx={w / 2 - 2} ry={12} fill="none" stroke="rgba(96,165,250,0.4)" />
    </svg>
    <div style={{ marginTop: 10, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: C.onDark }}>{label}</div>
      <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 13, letterSpacing: 1.6, color: C.onDark3 }}>
        {sub}
      </div>
    </div>
  </div>
);

export const S5Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-deploy");

  const s = interpolate(frame, [0, 26], [0.62, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const box = pIn(frame, 16, 18);

  // 밖으로 나가려다 경계에서 막힌다
  const t = interpolate(frame - (c1 - 10), [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const raw = BC.x + t * 700;
  const edge = SPLIT - 30;
  const px = Math.min(raw, edge);
  const blocked = raw >= edge;
  const beat = blocked ? 0.5 + 0.5 * Math.abs(Math.sin((frame - c1) / 7)) : 0;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          textAlign: "center",
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: -2.4,
          color: C.onDark,
          opacity: pIn(frame, 4, 16),
        }}
      >
        Treasurer AX runs inside <span style={{ color: C.brandLite }}>your</span> system.
      </div>

      {/* 경계선 */}
      <div
        style={{
          position: "absolute",
          left: SPLIT,
          top: 300,
          width: 2,
          height: 560,
          background: `linear-gradient(180deg, rgba(96,165,250,0) 0%, rgba(96,165,250,${
            0.5 + beat * 0.4
          }) 18%, rgba(96,165,250,${0.5 + beat * 0.4}) 82%, rgba(96,165,250,0) 100%)`,
          opacity: box,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SPLIT - 104,
          top: 262,
          width: 208,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 2.6,
          color: C.onDark3,
          opacity: box,
        }}
      >
        BOUNDARY
      </div>

      {/* 바깥쪽이 어디인지 명시 */}
      <div style={{ position: "absolute", left: SPLIT + 64, top: 300, opacity: box }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.onDark3,
          }}
        >
          OUTSIDE
        </div>
        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 600, color: C.onDark2 }}>
          internet · vendor cloud
        </div>
      </div>

      {/* 고객 환경 */}
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          border: `2px dashed rgba(96,165,250,0.5)`,
          borderRadius: 8,
          background: "rgba(59,130,246,0.05)",
          opacity: box,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 26,
            top: -14,
            background: C.dark,
            padding: "0 12px",
            fontFamily: MONO,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.brandLite,
          }}
        >
          YOUR OWN CLOUD OR SERVERS
        </div>
      </div>

      <DB
        x={BOX.x + 56}
        y={BOX.y + 58}
        w={190}
        label="Your data"
        sub="STAYS IN PLACE"
        p={pIn(frame, c0 + 10, 16)}
      />

      {/* 데이터 옆에서 에이전트가 돈다 */}
      <div
        style={{
          position: "absolute",
          left: BOX.x + 286,
          top: BOX.y + 58,
          width: 190,
          textAlign: "center",
          opacity: pIn(frame, c0 + 18, 16),
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            margin: "0 auto",
            borderRadius: 37,
            background: C.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${18 + pIn(frame, c0 + 24, 20) * 30}px rgba(59,130,246,0.55)`,
          }}
        >
          <span style={{ width: 24, height: 24, background: "#fff", transform: "rotate(45deg)" }} />
        </div>
        <div style={{ marginTop: 14, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: C.onDark }}>
          Treasurer AX
        </div>
        <div
          style={{ marginTop: 4, fontFamily: MONO, fontSize: 13, letterSpacing: 1.6, color: C.onDark3 }}
        >
          RUNS NEXT TO IT
        </div>
      </div>

      <GraphStatic cx={BC.x + 170} cy={BC.y + 60} scale={s} />

      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y + BOX.h - 62,
          width: BOX.w,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2.2,
          color: C.onDark2,
          opacity: pIn(frame, c0 + 26, 16),
        }}
      >
        AGENTS + YOUR DATA · CUSTOMER-HELD KEYS
      </div>

      {/* 바깥으로 나가려다 경계에서 되돌아오는 데이터 */}
      {t > 0.05 ? (
        <>
          {[0, 1, 2].map((k) => {
            const tk = interpolate(frame - (c1 - 14 + k * 11), [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            if (tk <= 0.02) return null;
            const rawK = BC.x + tk * 760;
            const hit = rawK >= edge;
            // 경계에 닿으면 튕겨 되돌아간다
            const back = hit ? Math.min(1, (rawK - edge) / 260) : 0;
            const xk = hit ? edge - back * 150 : rawK;
            const yk = BC.y - 60 + k * 72;
            return (
              <React.Fragment key={k}>
                <div
                  style={{
                    position: "absolute",
                    left: xk,
                    top: yk,
                    width: 44,
                    height: 20,
                    borderRadius: 3,
                    background: hit ? "rgba(248,113,113,0.22)" : "rgba(148,163,184,0.2)",
                    border: `1px solid ${hit ? RED : "rgba(148,163,184,0.5)"}`,
                    opacity: 1 - back * 0.7,
                  }}
                />
                {hit && back < 0.5 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: edge - 6,
                      top: yk - 16,
                      width: 14,
                      height: 52,
                      background: RED,
                      borderRadius: 3,
                      opacity: (1 - back * 2) * (0.5 + beat * 0.5),
                      filter: "blur(2px)",
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: SPLIT + 64,
              top: 648,
              opacity: blocked ? pIn(frame, c1 + 12, 14) : 0,
            }}
          >
            <div
              style={{
                fontSize: 46,
                fontWeight: 700,
                letterSpacing: -1.8,
                color: RED,
              }}
            >
              Nothing leaves.
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: MONO,
                fontSize: 16,
                letterSpacing: 2,
                color: C.onDark3,
              }}
            >
              NO DATA EGRESS · NO TRAINING ON YOUR DATA
            </div>
          </div>
        </>
      ) : null}

      {/* 보안 인증 */}
      <div
        style={{
          position: "absolute",
          left: SPLIT + 64,
          top: 418,
          display: "flex",
          alignItems: "center",
          gap: 20,
          border: `1px solid rgba(52,211,153,0.5)`,
          background: "rgba(52,211,153,0.08)",
          borderRadius: 8,
          padding: "22px 30px 24px",
          opacity: pIn(frame, c0 + 2, 18),
          transform: `translateY(${(1 - pIn(frame, c0 + 2, 18)) * 14}px)`,
        }}
      >
        <svg width={46} height={54}>
          <path
            d="M23 2 L44 11 V28 C44 41 34 49 23 52 C12 49 2 41 2 28 V11 Z"
            fill="rgba(52,211,153,0.14)"
            stroke={C.emerald}
            strokeWidth={2}
          />
          <path
            d="M13 27 L20 34 L33 20"
            fill="none"
            stroke={C.emerald}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.4, color: C.onDark }}>
            ISO/IEC <span style={{ color: C.emerald }}>27001</span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: 600,
              color: C.onDark2,
            }}
          >
            Information Security Management certified
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
