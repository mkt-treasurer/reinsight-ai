import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt, scene } from "../timing";
import { VStage, VMark, VSay, VEm, VKick, W, H, PAD } from "./VA";

const RED = "#f87171";

/* ──────────────── 05 고객 시스템 안에서 돈다 ──────────────── */

/** 세로에서는 경계가 가로선이다 — 위가 고객 안, 아래가 바깥 */
const LINE_Y = 1118;

export const V5Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-deploy");

  const box = pIn(frame, 16, 18);
  const t = interpolate(frame - (c1 - 10), [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const blocked = t > 0.62;
  const beat = blocked ? 0.5 + 0.5 * Math.abs(Math.sin((frame - c1) / 7)) : 0;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={53} count={16} lattice={0.5} />
      <VMark p={pIn(frame, 0, 12)} />

      <VSay
        from={4}
        size={62}
        top={344}
        lines={[
          <>Your data. Your machine.</>,
          <>
            <VEm>Your agent.</VEm>
          </>,
        ]}
      />

      {/* 고객 환경 */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 570,
          height: 466,
          border: "2px dashed rgba(96,165,250,0.5)",
          background: "rgba(59,130,246,0.05)",
          borderRadius: 12,
          opacity: box,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 26,
            top: -15,
            background: C.darkDeep,
            padding: "0 14px",
            fontFamily: MONO,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.brandLite,
          }}
        >
          HARDWARE YOU OWN
        </div>
      </div>

      {/* DB 와 에이전트 */}
      <div
        style={{
          position: "absolute",
          left: PAD + 56,
          top: 652,
          width: 230,
          textAlign: "center",
          opacity: pIn(frame, c0 + 8, 16),
        }}
      >
        <svg width={230} height={92} style={{ display: "block" }}>
          <ellipse cx={115} cy={17} rx={113} ry={16} fill="rgba(59,130,246,0.22)" stroke={C.brand} />
          <path
            d="M 2 17 L 2 70 A 113 16 0 0 0 228 70 L 228 17"
            fill="rgba(59,130,246,0.12)"
            stroke={C.brand}
          />
          <ellipse cx={115} cy={42} rx={113} ry={15} fill="none" stroke="rgba(96,165,250,0.4)" />
        </svg>
        <div style={{ marginTop: 14, fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: C.onDark }}>
          Your data
        </div>
        <div
          style={{ marginTop: 6, fontFamily: MONO, fontSize: 17, letterSpacing: 1.8, color: C.onDark3 }}
        >
          STAYS IN PLACE
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: PAD + 56,
          top: 652,
          width: 230,
          textAlign: "center",
          opacity: pIn(frame, c0 + 16, 16),
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            margin: "0 auto",
            borderRadius: 46,
            background: C.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 ${18 + pIn(frame, c0 + 22, 20) * 34}px rgba(59,130,246,0.55)`,
          }}
        >
          <span style={{ width: 30, height: 30, background: "#fff", transform: "rotate(45deg)" }} />
        </div>
        <div style={{ marginTop: 14, fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: C.onDark }}>
          Treasurer AX
        </div>
        <div
          style={{ marginTop: 6, fontFamily: MONO, fontSize: 17, letterSpacing: 1.8, color: C.onDark3 }}
        >
          RUNS NEXT TO IT
        </div>
      </div>

      {/* 경계선 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: LINE_Y,
          height: 2,
          background: `linear-gradient(90deg, rgba(96,165,250,0) 0%, rgba(96,165,250,${
            0.5 + beat * 0.4
          }) 16%, rgba(96,165,250,${0.5 + beat * 0.4}) 84%, rgba(96,165,250,0) 100%)`,
          opacity: box,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: LINE_Y + 14,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 3,
          color: C.onDark3,
          opacity: box,
        }}
      >
        BOUNDARY · OUTSIDE IS THE INTERNET
      </div>

      {/* 밖으로 나가려다 막히는 자료 */}
      {[0, 1, 2].map((k) => {
        const tk = interpolate(frame - (c1 - 14 + k * 11), [0, 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        if (tk <= 0.02) return null;
        const start = 1010;
        const raw = start + tk * 220;
        const edge = LINE_Y - 26;
        const hit = raw >= edge;
        const back = hit ? Math.min(1, (raw - edge) / 90) : 0;
        const y = hit ? edge - back * 54 : raw;
        const x = PAD + 104 + k * 268;
        return (
          <React.Fragment key={k}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 62,
                height: 26,
                borderRadius: 4,
                background: hit ? "rgba(248,113,113,0.22)" : "rgba(148,163,184,0.2)",
                border: `1px solid ${hit ? RED : "rgba(148,163,184,0.5)"}`,
                opacity: 1 - back * 0.65,
              }}
            />
            {hit && back < 0.5 ? (
              <div
                style={{
                  position: "absolute",
                  left: x - 18,
                  top: LINE_Y - 8,
                  width: 98,
                  height: 14,
                  background: RED,
                  borderRadius: 4,
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
          left: PAD,
          right: PAD,
          top: LINE_Y + 86,
          textAlign: "center",
          fontSize: 74,
          fontWeight: 700,
          letterSpacing: -2.6,
          color: C.brandLite,
          opacity: blocked ? pIn(frame, c1 + 12, 14) : 0,
        }}
      >
        It stays yours.
      </div>

      {/* 보안 인증 */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: LINE_Y + 192,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          border: "1px solid rgba(52,211,153,0.5)",
          background: "rgba(52,211,153,0.08)",
          borderRadius: 10,
          padding: "22px 26px 24px",
          opacity: pIn(frame, c0 + 2, 18),
        }}
      >
        <svg width={44} height={52}>
          <path
            d="M22 2 L42 11 V27 C42 39 32 47 22 50 C12 47 2 39 2 27 V11 Z"
            fill="rgba(52,211,153,0.14)"
            stroke={C.emerald}
            strokeWidth={2}
          />
          <path
            d="M12 26 L19 33 L32 19"
            fill="none"
            stroke={C.emerald}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1.4, color: C.onDark }}>
            ISO/IEC <span style={{ color: C.emerald }}>27001</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 21, fontWeight: 600, color: C.onDark2 }}>
            Information Security Management certified
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ──────────────────── 06 Fin-RATE (간소화) ──────────────────── */

const MODELS = [
  { k: "Treasurer AX", v: 0.83, ours: true },
  { k: "GPT-6 Astra", v: 0.76, ours: false },
  { k: "Gemini 4 Argon", v: 0.76, ours: false },
];

const BASE = 1248;
const BARH = 480;
const BW = 232;

export const V6Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-bench");

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={67} count={14} lattice={0.42} />
      <VMark p={pIn(frame, 0, 12)} />

      <VKick p={pIn(frame, 2, 14)} top={344}>
        FIN-RATE · FINANCIAL TASK ACCURACY
      </VKick>

      <VSay
        from={6}
        size={62}
        top={414}
        lines={[
          <>
            Our agent scores <VEm>highest.</VEm>
          </>,
        ]}
      />

      {MODELS.map((m, i) => {
        const x = PAD + 44 + i * (BW + 72);
        const grow = interpolate(frame - (c0 + 8 + i * 10), [0, 26], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        const h = BARH * m.v * grow;
        return (
          <React.Fragment key={m.k}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: BASE - h,
                width: BW,
                height: h,
                borderRadius: "6px 6px 0 0",
                background: m.ours ? C.brand : "rgba(148,163,184,0.30)",
                border: m.ours ? "none" : "1px solid rgba(148,163,184,0.44)",
                boxShadow: m.ours ? "0 0 46px rgba(59,130,246,0.42)" : "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x,
                top: BASE - h + 26,
                width: BW,
                textAlign: "center",
                fontSize: 60,
                fontWeight: 700,
                letterSpacing: -2,
                color: m.ours ? "#fff" : C.onDark,
                opacity: grow > 0.7 ? pIn(frame, c0 + 20 + i * 10, 14) : 0,
              }}
            >
              {m.v.toFixed(2)}
            </div>
            <div
              style={{
                position: "absolute",
                left: x - 30,
                top: BASE + 22,
                width: BW + 60,
                textAlign: "center",
                fontSize: 27,
                fontWeight: m.ours ? 700 : 600,
                letterSpacing: -0.7,
                lineHeight: 1.3,
                color: m.ours ? C.onDark : C.onDark2,
                opacity: pIn(frame, c0 + 14 + i * 10, 14),
              }}
            >
              {m.k}
            </div>
          </React.Fragment>
        );
      })}

      {/* 바닥선 */}
      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: BASE,
          height: 1,
          background: C.onDarkLine2,
          opacity: pIn(frame, c0, 14),
        }}
      />

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1372,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 2.6,
          lineHeight: 1.6,
          color: C.onDark3,
          opacity: pIn(frame, c1, 16),
        }}
      >
        0 TO 1 · HIGHER IS BETTER
        <br />
        FRESHNESS · PRECISION · SCREENING · CROSS-SOURCE
      </div>
    </AbsoluteFill>
  );
};

/* ──────────────────── 07 도입 현황 ──────────────────── */

const STOPS = [
  { k: "KOREA", s: "LIVE" },
  { k: "SINGAPORE", s: "PILOT" },
  { k: "HONG KONG", s: "PILOT" },
];

export const V7Reach: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0] = cueAt("s-reach");
  const n = interpolate(frame - 4, [0, 30], [0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={83} count={18} lattice={0.6} />
      <VMark p={pIn(frame, 0, 12)} />

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 520,
          textAlign: "center",
          opacity: pIn(frame, 2, 16),
        }}
      >
        <div style={{ fontSize: 212, fontWeight: 700, letterSpacing: -9, color: C.onDark, lineHeight: 1 }}>
          {Math.round(n)}
          <span style={{ color: C.brandLite }}>+</span>
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1.3,
            color: C.onDark2,
          }}
        >
          institutions already run
          <br />
          Treasurer AX
        </div>
      </div>

      {STOPS.map((s, i) => {
        const p = pIn(frame, c0 + 10 + i * 12, 16);
        return (
          <div
            key={s.k}
            style={{
              position: "absolute",
              left: PAD,
              right: PAD,
              top: 1032 + i * 104,
              display: "flex",
              alignItems: "center",
              gap: 20,
              borderTop: i === 0 ? `1px solid ${C.onDarkLine}` : "none",
              borderBottom: `1px solid ${C.onDarkLine}`,
              padding: "26px 6px",
              opacity: p,
              transform: `translateX(${(1 - p) * 16}px)`,
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: 7,
                background: s.s === "LIVE" ? C.emerald : C.brandLite,
                flex: "0 0 auto",
              }}
            />
            <span style={{ flex: 1, fontSize: 42, fontWeight: 700, letterSpacing: -1.2, color: C.onDark }}>
              {s.k}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2.6,
                color: s.s === "LIVE" ? C.emerald : C.onDark2,
              }}
            >
              {s.s}
            </span>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1394,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 2.6,
          color: C.onDark3,
          opacity: pIn(frame, c0 + 48, 16),
        }}
      >
        ASSET MANAGERS · SECURITIES · INSURANCE
      </div>
    </AbsoluteFill>
  );
};

/* ──────────────────── 08 마무리 ──────────────────── */

export const V8Close: React.FC = () => {
  const frame = useCurrentFrame();
  const life = scene("s-close").durationInFrames;
  const lock = life - 68;
  const out = 1 - pIn(frame, lock - 6, 16);
  const rule = pIn(frame, lock + 10, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={23} count={22} lattice={1 - pIn(frame, lock - 4, 22) * 0.8} />

      <AbsoluteFill style={{ opacity: out }}>
        <VSay
          from={4}
          size={92}
          top={700}
          lines={[
            <>The AI</>,
            <>operating layer for</>,
            <>
              <VEm>financial institutions.</VEm>
            </>,
          ]}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: pIn(frame, lock, 20),
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <span style={{ width: 22, height: 22, background: C.brand, transform: "rotate(45deg)" }} />
            <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 9, color: C.onDark }}>
              TREASURER
            </span>
          </div>
          <div
            style={{
              margin: "38px auto 0",
              width: rule * 300,
              height: 1,
              background: "rgba(255,255,255,0.22)",
            }}
          />
          <div
            style={{
              marginTop: 30,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: -0.6,
              lineHeight: 1.4,
              color: C.onDark2,
              opacity: pIn(frame, lock + 14, 18),
            }}
          >
            <span style={{ color: C.onDark, fontWeight: 700 }}>60+</span> institutions
            <br />
            already run Treasurer AX
          </div>
          <div
            style={{
              marginTop: 32,
              fontFamily: MONO,
              fontSize: 24,
              letterSpacing: 4,
              color: C.brandLite,
              opacity: pIn(frame, lock + 18, 18),
            }}
          >
            treasurer.co.kr
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export { W, H };
