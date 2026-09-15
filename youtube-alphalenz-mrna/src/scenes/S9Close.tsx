import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { Pop, pIn } from "../lib";
import { cueAt } from "../timing";

const OUTLINE = (px: number) => {
  const out: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    out.push(`${(Math.cos(a) * px).toFixed(2)}px ${(Math.sin(a) * px).toFixed(2)}px 0 #05060B`);
  }
  return out.join(", ");
};

/** 세 회사 이름을 다시 붙여 놓고 질문으로 넘긴다 */
const FIRMS = [
  { name: "소마젠", note: "과거 계약" },
  { name: "삼양바이오팜", note: "임상 전" },
  { name: "삼성바이오로직스", note: "다른 제품" },
];

export const S9Close: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2] = cueAt("s9-close");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);

  return (
    <AbsoluteFill
      style={{ fontFamily: FONT, alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 18, marginBottom: 34 }}>
          {FIRMS.map((f, i) => (
            <Pop key={f.name} delay={4 + i * 8}>
              <div
                style={{
                  background: "rgba(10,12,22,0.86)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 18,
                  padding: "18px 30px 20px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", letterSpacing: -1.2 }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.muted, marginTop: 6 }}>
                  {f.note}
                </div>
              </div>
            </Pop>
          ))}
        </div>

        <Pop delay={30}>
          <div
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -1.4,
              textShadow: OUTLINE(3),
            }}
          >
            같은 이름표였지만,{" "}
            <span
              style={{
                background: C.hi,
                color: "#0B0C12",
                borderRadius: 12,
                padding: "3px 16px 8px",
                textShadow: "none",
              }}
            >
              연결은 제각각
            </span>
          </div>
        </Pop>

        <Pop delay={c2} style={{ marginTop: 64 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -2.2,
              textAlign: "center",
              lineHeight: 1.32,
              textShadow: OUTLINE(3.2),
            }}
          >
            모더나가 오르면,
            <br />
            함께 움직이는 기업은 어디일까요?
          </div>
        </Pop>

        <Pop delay={c2 + 12} style={{ marginTop: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              background: `linear-gradient(135deg, ${C.brandLite}, ${C.brand})`,
              borderRadius: 20,
              padding: "18px 36px 20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: 6, background: C.hi }} />
            <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: 4, color: "#fff" }}>
              ALPHALENZ
            </span>
            <span style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
              alpha-lenz.com
            </span>
          </div>
        </Pop>

        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(255,255,255,0.58)",
            marginTop: 38,
            textAlign: "center",
            lineHeight: 1.6,
            opacity: P(c2 + 22, 22),
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          본 영상은 정보 제공 목적이며 특정 종목의 매수·매도를 권유하지 않습니다.
          <br />
          출처: 트레져러 칼럼(2026.08.20), 모더나·머크 임상 3상 발표, 각 사 공시.
        </div>
      </div>
    </AbsoluteFill>
  );
};
