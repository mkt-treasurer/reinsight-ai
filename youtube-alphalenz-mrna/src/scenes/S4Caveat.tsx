import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { pIn } from "../lib";
import { cueAt } from "../timing";

const DONE = ["재발을 늦추는 핵심 목표", "다른 장기로의 전이 감소", "후기 임상에서 나온 첫 신호"];
const OPEN = ["위험 감소 폭의 상세 수치", "전체 생존기간 연장 여부", "규제기관 허가"];

/** 밝은 카드뉴스 톤 — 흰 카드 · 검은 글씨 · 형광 강조 */
export const S4Caveat: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2] = cueAt("s4-caveat");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div
        style={{
          position: "absolute",
          left: SAFE,
          top: 150,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: P(0, 18),
        }}
      >
        <span
          style={{
            background: C.ink,
            color: "#fff",
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 3,
            borderRadius: 10,
            padding: "10px 18px",
          }}
        >
          짚고 갈 것
        </span>
        <span style={{ fontSize: 30, fontWeight: 700, color: C.inkDim }}>
          결과를 어디까지 읽을 수 있나
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          right: SAFE,
          top: 240,
          display: "flex",
          gap: 34,
        }}
      >
        {[
          {
            title: "달성한 것",
            items: DONE,
            accent: "#0FA968",
            tint: "#FFFFFF",
            border: "#0FA968",
            dashed: false,
            base: 6,
          },
          {
            title: "아직 없는 것",
            items: OPEN,
            accent: "#8A90A8",
            tint: "rgba(255,255,255,0.72)",
            border: "rgba(13,16,32,0.22)",
            dashed: true,
            base: 32,
          },
        ].map((col) => {
          const p = P(col.base, 22);
          return (
            <div
              key={col.title}
              style={{
                flex: 1,
                background: col.tint,
                border: `3px ${col.dashed ? "dashed" : "solid"} ${col.border}`,
                borderRadius: 26,
                padding: "34px 38px 30px",
                opacity: p,
                transform: `translateY(${(1 - p) * 22}px)`,
                boxShadow: col.dashed ? "none" : "0 22px 60px rgba(13,16,32,0.18)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: 34,
                  fontWeight: 800,
                  color: col.dashed ? C.inkDim : "#fff",
                  background: col.dashed ? "transparent" : col.accent,
                  border: col.dashed ? `2px dashed ${col.accent}` : "none",
                  borderRadius: 12,
                  padding: "10px 22px",
                  letterSpacing: -0.5,
                }}
              >
                {col.title}
              </div>
              {col.items.map((it, i) => {
                const q = P(col.base + 10 + i * 8, 20);
                return (
                  <div
                    key={it}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 18,
                      padding: "20px 0 0",
                      opacity: q,
                      transform: `translateX(${(1 - q) * 14}px)`,
                    }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        border: `3px ${col.dashed ? "dashed" : "solid"} ${col.accent}`,
                        background: col.dashed ? "transparent" : col.accent,
                        color: "#fff",
                        fontSize: 21,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {col.dashed ? "" : "✓"}
                    </span>
                    <span
                      style={{
                        fontSize: 40,
                        fontWeight: 700,
                        color: col.dashed ? C.inkDim : C.ink,
                        letterSpacing: -1,
                      }}
                    >
                      {it}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 726,
          display: "flex",
          justifyContent: "center",
          opacity: P(c2 + 4, 22),
          transform: `translateY(${(1 - P(c2 + 4, 22)) * 18}px)`,
        }}
      >
        <div
          style={{
            fontSize: 66,
            fontWeight: 800,
            color: C.ink,
            letterSpacing: -2.4,
            background: "#FFFFFF",
            borderRadius: 20,
            padding: "18px 40px 22px",
            boxShadow: "0 20px 54px rgba(13,16,32,0.22)",
          }}
        >
          중요한 진전{" "}
          <span
            style={{
              background: C.hi,
              borderRadius: 10,
              padding: "2px 16px 6px",
            }}
          >
            ≠
          </span>{" "}
          상용화 확정
        </div>
      </div>
    </AbsoluteFill>
  );
};
