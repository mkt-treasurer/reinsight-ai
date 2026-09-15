import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { Eyebrow, Title, pIn } from "../lib";
import { cueAt } from "../timing";

const STEPS = [
  { n: "01", h: "종양 분석", s: "환자 암세포의 특징을 읽는다" },
  { n: "02", h: "mRNA 설계", s: "그 사람만의 백신을 만든다" },
  { n: "03", h: "면역 전달", s: "키트루다와 함께 투여한다" },
];

const STATS = [
  { v: "1,137명", l: "고위험 피부암 · 수술 후" },
  { v: "Phase 3", l: "재발 지연 · 전이 감소 달성" },
  { v: "최초", l: "후기 임상 mRNA 암백신" },
];

export const S3Trial: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2, c3] = cueAt("s3-trial");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE, top: 138 }}>
        <Eyebrow>WHAT CHANGED</Eyebrow>
        <div style={{ marginTop: 26 }}>
          <Title size={78}>
            예방 백신이 아니라, <span style={{ color: C.brandLite }}>맞춤형 표적 정보</span>
          </Title>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          right: SAFE,
          top: 372,
          display: "flex",
          alignItems: "stretch",
          gap: 26,
        }}
      >
        {STEPS.map((s, i) => {
          const p = P(c2 + 4 + i * 12, 24);
          return (
            <React.Fragment key={s.n}>
              <div
                style={{
                  flex: 1,
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  borderRadius: 22,
                  padding: "32px 34px",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 24}px)`,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: C.brandLite }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 50, fontWeight: 700, color: C.text, marginTop: 12 }}>
                  {s.h}
                </div>
                <div style={{ fontSize: 30, fontWeight: 500, color: C.muted, marginTop: 10 }}>
                  {s.s}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    width: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                    color: C.faint,
                    opacity: P(c2 + 12 + i * 12, 18),
                  }}
                >
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          right: SAFE,
          top: 640,
          display: "flex",
          gap: 26,
        }}
      >
        {STATS.map((s, i) => {
          const p = P(c3 + 6 + i * 10, 22);
          return (
            <div
              key={s.v}
              style={{
                flex: 1,
                background: "rgba(25,201,140,0.07)",
                border: `1px solid rgba(25,201,140,0.24)`,
                borderRadius: 20,
                padding: "26px 32px",
                opacity: p,
                transform: `translateY(${(1 - p) * 18}px)`,
              }}
            >
              <div style={{ fontSize: 58, fontWeight: 800, color: C.green, letterSpacing: -1.5 }}>
                {s.v}
              </div>
              <div style={{ fontSize: 28, fontWeight: 500, color: C.textDim, marginTop: 6 }}>
                {s.l}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
