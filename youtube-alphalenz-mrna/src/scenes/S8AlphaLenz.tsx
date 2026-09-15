import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { NewsHead, Pop, pIn } from "../lib";
import { cueAt } from "../timing";

/**
 * 주가는 올랐는데 계약은 없더라 — 이 대비를 두 줄로 보여주고 공시로 넘긴다.
 * 화면 주인공은 제품 캡처.
 */
export const S8AlphaLenz: React.FC = () => {
  const frame = useCurrentFrame();
  const [c1, c2, c3] = cueAt("s8-alphalenz");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  const CONTRAST = [
    { k: "주가", v: "세 곳 모두 상승", ok: true, d: c1 + 4 },
    { k: "계약", v: "확인되지 않음", ok: false, d: c2 + 4 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE, top: 138 }}>
        <NewsHead chip="뉴스에 없는 것" size={44}>
          주가는 올랐는데, <span style={{ color: C.hi }}>계약은요?</span>
        </NewsHead>
      </div>

      <div style={{ position: "absolute", left: SAFE, top: 256, width: 660 }}>
        {CONTRAST.map((r) => (
          <Pop key={r.k} delay={r.d} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                background: "rgba(10,12,22,0.80)",
                border: `1px solid ${r.ok ? "rgba(25,201,140,0.42)" : "rgba(255,255,255,0.16)"}`,
                borderRadius: 18,
                padding: "20px 28px 22px",
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  background: r.ok ? "#0FA968" : "rgba(255,255,255,0.14)",
                  borderRadius: 10,
                  padding: "8px 18px",
                  minWidth: 92,
                  textAlign: "center",
                }}
              >
                {r.k}
              </span>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: r.ok ? C.text : C.muted,
                  letterSpacing: -1.4,
                }}
              >
                {r.v}
              </span>
            </div>
          </Pop>
        ))}

        <Pop delay={c3 + 2} style={{ marginTop: 30 }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.42,
              letterSpacing: -1.4,
            }}
          >
            계약 이력 · 개발 단계 · 매출 구성
            <br />
            <span
              style={{
                background: C.hi,
                color: "#0B0C12",
                borderRadius: 12,
                padding: "3px 16px 8px",
              }}
            >
              공시에 있습니다
            </span>
          </div>
        </Pop>

        <Pop delay={c3 + 26} style={{ marginTop: 32 }}>
          <div
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${C.brandLite}, ${C.brand})`,
              borderRadius: 16,
              padding: "16px 30px 18px",
              fontSize: 34,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            alpha-lenz.com
          </div>
        </Pop>
      </div>

      <div
        style={{
          position: "absolute",
          left: 880,
          top: 250,
          width: 908,
          opacity: P(c3 + 8, 24),
          transform: `translateY(${(1 - P(c3 + 8, 24)) * 26}px) scale(${0.97 + P(c3 + 8, 24) * 0.03})`,
        }}
      >
        <div
          style={{
            borderRadius: 22,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "#0F111C",
            boxShadow: "0 44px 120px rgba(0,0,0,0.62)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 22px",
              background: "rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span
                key={c}
                style={{ width: 14, height: 14, borderRadius: 99, background: c, opacity: 0.85 }}
              />
            ))}
            <span
              style={{
                marginLeft: 14,
                fontSize: 23,
                fontWeight: 600,
                color: C.muted,
                letterSpacing: 1,
              }}
            >
              alpha-lenz.com
            </span>
          </div>
          <Img src={staticFile("shots/grid-card.png")} style={{ width: "100%", display: "block" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
