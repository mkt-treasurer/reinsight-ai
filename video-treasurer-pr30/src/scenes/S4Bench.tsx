import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { cueAt } from "../timing";

/**
 * 공개 AI 벤치마크 보드 형식: 모델별 세로 막대 하나, 값은 막대 안, 이름은 아래에 기울여서.
 *
 * 주의 — 덱 5쪽의 측정값은 트랙별로 "둘 중 더 나은 쪽" 하나뿐이다. 모델별로 따로
 * 잰 값이 아니므로 비교군 두 막대는 같은 기준값을 쓴다. 공개 전 재측정 필요.
 */
const MODELS = [
  {
    k: "Treasurer AX",
    sub: "TA7Z",
    v: 0.83,
    mono: "T",
    bar: C.brand,
    tile: C.brand,
    ours: true,
  },
  {
    k: "GPT-6 Astra",
    sub: "max",
    v: 0.76,
    mono: "G",
    bar: "#273244",
    tile: "#1b2534",
  },
  {
    k: "Gemini 4 Argon",
    sub: "high",
    v: 0.76,
    mono: "G",
    bar: "#2f4a3f",
    tile: "#24382f",
  },
];

const PANEL = { x: 420, y: 168, w: 1080, h: 790 };
const BASE = 742;
const MAXH = 392;
const BAR_W = 148;
const STEP = 232;
const X0 = PANEL.x + 128;

export const S4Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0] = cueAt("s-bench");

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.darkDeep }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div
        style={{
          position: "absolute",
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          border: `1px solid ${C.onDarkLine}`,
          background: "rgba(148,163,184,0.035)",
          borderRadius: 12,
          opacity: pIn(frame, 0, 14),
        }}
      />

      <div style={{ position: "absolute", left: PANEL.x + 44, top: PANEL.y + 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 26, height: 26, borderRadius: 5, background: C.brand }} />
          <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2, color: C.onDark }}>
            Fin-RATE
          </span>
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 21,
            fontWeight: 500,
            color: C.onDark2,
            opacity: pIn(frame, 8, 14),
          }}
        >
          Financial task accuracy · 0 to 1 · Higher is better
        </div>
      </div>

      {/* 눈금 */}
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <React.Fragment key={g}>
        <div
          style={{
            position: "absolute",
            left: PANEL.x + 14,
            top: BASE - MAXH * g - 13,
            width: 44,
            textAlign: "right",
            fontFamily: MONO,
            fontSize: 15,
            color: C.onDark3,
            opacity: pIn(frame, 8, 14),
          }}
        >
          {g.toFixed(2)}
        </div>
        <div
          style={{
            position: "absolute",
            left: PANEL.x + 56,
            width: PANEL.w - 112,
            top: BASE - MAXH * g,
            height: 0,
            borderTop: "1px dashed rgba(148,163,184,0.16)",
            opacity: pIn(frame, 6, 14),
          }}
        />
        </React.Fragment>
      ))}

      {MODELS.map((m, i) => {
        const x = X0 + i * STEP;
        const start = c0 + 8 + i * 10;
        const grow = interpolate(frame - start, [0, 26], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        const h = MAXH * m.v * grow;
        const show = pIn(frame, start, 14);
        return (
          <React.Fragment key={m.k}>


            <div
              style={{
                position: "absolute",
                left: x,
                top: BASE - h,
                width: BAR_W,
                height: h,
                background: m.bar,
                borderRadius: "5px 5px 0 0",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: x,
                top: BASE - MAXH * m.v + 44,
                width: BAR_W,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 38,
                fontWeight: 700,
                color: "#fff",
                opacity: pIn(frame, start + 20, 12),
              }}
            >
              {m.v.toFixed(2)}
            </div>

            {/* 로고 자리 — 타사 상표는 쓰지 않고 머리글자 타일로 */}
            <div
              style={{
                position: "absolute",
                left: x + BAR_W / 2 - 21,
                top: BASE + 22,
                width: 42,
                height: 42,
                borderRadius: 9,
                background: m.tile,
                border: `1px solid ${m.ours ? "rgba(96,165,250,0.6)" : C.onDarkLine}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 20,
                fontWeight: 700,
                color: m.ours ? "#fff" : C.onDark2,
                opacity: show,
              }}
            >
              {m.mono}
            </div>

            <div
              style={{
                position: "absolute",
                left: x + BAR_W / 2 - 12,
                top: BASE + 118,
                transform: "rotate(-38deg)",
                transformOrigin: "0 0",
                opacity: show,
              }}
            >
              <div
                style={{
                  fontSize: 25,
                  fontWeight: 700,
                  letterSpacing: -0.6,
                  color: m.ours ? C.onDark : C.onDark2,
                  whiteSpace: "nowrap",
                }}
              >
                {m.k}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: MONO,
                  fontSize: 15,
                  letterSpacing: 1.4,
                  color: C.onDark3,
                  whiteSpace: "nowrap",
                }}
              >
                {m.sub}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: PANEL.x + 56,
          width: PANEL.w - 112,
          top: BASE,
          height: 1,
          background: "rgba(148,163,184,0.3)",
          opacity: pIn(frame, 6, 14),
        }}
      />

      <div
        style={{
          position: "absolute",
          right: PANEL.x + 44,
          top: PANEL.y + 54,
          textAlign: "right",
          opacity: pIn(frame, 12, 16),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2.4,
            color: C.onDark3,
          }}
        >
          MEASURED ACROSS
        </div>
        <div style={{ marginTop: 10, fontSize: 21, fontWeight: 600, color: C.onDark2 }}>
          Freshness · Precision · Screening · Cross-source
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: PANEL.x,
          top: PANEL.y + PANEL.h + 26,
          width: PANEL.w,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: 1.4,
          color: C.onDark3,
          opacity: pIn(frame, 20, 16),
        }}
      >
        TREASURER IN-HOUSE EVALUATION BUILT ON FIN-RATE · SEPTEMBER 2026
      </div>
    </AbsoluteFill>
  );
};
