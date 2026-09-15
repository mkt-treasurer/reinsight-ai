import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { NewsHead, Pop, pIn, fillAt } from "../lib";
import { cueAt } from "../timing";

/**
 * 예전엔 3개 존을 가로로 늘어놓은 매트릭스였는데 컨설팅 슬라이드처럼 읽혀서
 * 회사 한 곳씩 순서대로 붙고 게이지가 차오르는 방식으로 바꿨다.
 */
const ROWS = [
  {
    name: "소마젠",
    why: "모더나에 유전체 분석 서비스 공급",
    tag: "과거 계약",
    level: 0.26,
    dashed: true,
  },
  {
    name: "삼양바이오팜",
    why: "자체 mRNA 암 백신 SYP-2135 개발",
    tag: "사람 대상 임상 전",
    level: 0.52,
    dashed: false,
  },
  {
    name: "삼성바이오로직스",
    why: "모더나 코로나 백신 완제 생산",
    tag: "다른 제품 · 과거",
    level: 0.44,
    dashed: false,
  },
];

const TRACK = 720;

export const S6Distance: React.FC = () => {
  const frame = useCurrentFrame();
  const cues = cueAt("s6-distance");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE, top: 140 }}>
        <NewsHead chip="비교해 봤습니다">
          같은 이름표인데, <span style={{ color: C.hi }}>알고 보니 다 달랐습니다</span>
        </NewsHead>
      </div>

      {ROWS.map((r, i) => {
        const start = cues[i + 1];
        const appear = P(start + 2, 18);
        const fill = fillAt(frame, start + 10, 34);
        const top = 274 + i * 172;
        return (
          <div
            key={r.name}
            style={{
              position: "absolute",
              left: SAFE,
              right: SAFE,
              top,
              display: "flex",
              alignItems: "center",
              gap: 34,
              opacity: appear,
              transform: `translateX(${(1 - appear) * 26}px)`,
            }}
          >
            <div style={{ width: 470, flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: C.text,
                  letterSpacing: -1.6,
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 27, fontWeight: 600, color: C.textDim, marginTop: 6 }}>
                {r.why}
              </div>
            </div>

            <div style={{ flex: 1, position: "relative" }}>
              <div
                style={{
                  height: 22,
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.10)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${r.level * fill * 100}%`,
                    borderRadius: 99,
                    background: r.dashed
                      ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.46) 0 12px, transparent 12px 24px)"
                      : `linear-gradient(90deg, ${C.brand}, ${C.brandLite})`,
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: `calc(${r.level * fill * 100}% - 8px)`,
                  top: -12,
                  width: 22,
                  height: 46,
                  borderRadius: 6,
                  background: r.dashed ? "#9BA2B8" : C.hi,
                  boxShadow: "0 0 24px rgba(255,225,77,0.55)",
                  opacity: fill,
                }}
              />
              <div
                style={{
                  marginTop: 20,
                  display: "inline-block",
                  fontSize: 26,
                  fontWeight: 800,
                  color: r.dashed ? C.muted : C.text,
                  background: r.dashed ? "rgba(255,255,255,0.08)" : "rgba(101,85,238,0.30)",
                  border: `1px solid ${r.dashed ? "rgba(255,255,255,0.16)" : "rgba(139,124,255,0.5)"}`,
                  borderRadius: 999,
                  padding: "8px 20px",
                  opacity: P(start + 26, 16),
                }}
              >
                {r.tag}
              </div>
            </div>
          </div>
        );
      })}

      <Pop
        delay={cues[3] + 34}
        style={{ position: "absolute", left: SAFE, right: SAFE, top: 828 }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: "rgba(10,12,22,0.86)",
            border: "1px dashed rgba(255,255,255,0.26)",
            borderRadius: 16,
            padding: "16px 28px 18px",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, color: C.muted, letterSpacing: 1 }}>
            이번 암 백신 임상·생산 계약
          </span>
          <span style={{ fontSize: 32, fontWeight: 800, color: C.hi }}>
            세 곳 모두 공시 없음
          </span>
        </div>
      </Pop>
    </AbsoluteFill>
  );
};
