import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { NewsHead, Pop, pIn, useFill } from "../lib";
import { cueAt } from "../timing";

/** 오른쪽에 그려지는 상승 라인 — '기대가 붙는' 느낌을 숫자 대신 선으로 */
const PTS = [
  [0, 300], [70, 292], [140, 300], [210, 284], [280, 290],
  [350, 272], [420, 280], [470, 214], [520, 140], [560, 74], [600, 30],
];
const PATH = PTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
const AREA = `${PATH} L600,330 L0,330 Z`;

export const S5Why: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2, c3] = cueAt("s5-why");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);
  const draw = useFill(c3 + 2, 40);
  const dot = pIn(frame, c3 + 30, 12);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE, top: 148 }}>
        <NewsHead chip="WHY +177%">코로나 이후 비어 있던 성장 엔진</NewsHead>
      </div>

      {/* 왼쪽 — 2분기 숫자 두 장 */}
      <div style={{ position: "absolute", left: SAFE, top: 288, width: 700 }}>
        {[
          { label: "2026 2Q 매출", v: "약 1억 $", color: C.text, d: c2 + 2 },
          { label: "순손실", v: "약 8억 $", color: C.red, d: c2 + 14 },
        ].map((k) => (
          <Pop key={k.label} delay={k.d} style={{ marginBottom: 22 }}>
            <div
              style={{
                background: "rgba(10,12,22,0.82)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 20,
                padding: "24px 34px 26px",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 32, fontWeight: 700, color: C.textDim }}>{k.label}</span>
              <span
                style={{
                  fontSize: 76,
                  fontWeight: 800,
                  color: k.color,
                  letterSpacing: -2.5,
                }}
              >
                {k.v}
              </span>
            </div>
          </Pop>
        ))}

        <Pop delay={c3 + 6}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.44,
              marginTop: 8,
            }}
          >
            시장이 궁금했던 건 하나였습니다
            <br />
            <span style={{ color: C.hi }}>“코로나 말고도 사업이 되나?”</span>
          </div>
        </Pop>
      </div>

      {/* 오른쪽 — 차오르는 상승선 */}
      <div style={{ position: "absolute", right: SAFE - 10, top: 300, opacity: P(c3, 20) }}>
        <svg width={640} height={356} viewBox="0 0 620 340">
          <defs>
            <linearGradient id="s5line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.faint} />
              <stop offset="68%" stopColor={C.green} />
              <stop offset="100%" stopColor="#8CFFD6" />
            </linearGradient>
            <linearGradient id="s5area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(25,201,140,0.34)" />
              <stop offset="100%" stopColor="rgba(25,201,140,0)" />
            </linearGradient>
            <clipPath id="s5clip">
              <rect x="0" y="0" width={620 * draw} height="340" />
            </clipPath>
          </defs>
          <g clipPath="url(#s5clip)">
            <path d={AREA} fill="url(#s5area)" />
            <path
              d={PATH}
              fill="none"
              stroke="url(#s5line)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <circle cx={600} cy={30} r={13 * dot} fill={C.green} />
          <circle cx={600} cy={30} r={26 * dot} fill="none" stroke={C.green} strokeWidth={2} opacity={0.4} />
        </svg>
        <Pop delay={c3 + 30} style={{ marginTop: -6 }}>
          <div
            style={{
              display: "inline-block",
              background: C.hi,
              color: "#0B0C12",
              fontSize: 34,
              fontWeight: 800,
              borderRadius: 12,
              padding: "12px 22px 14px",
              marginLeft: 210,
            }}
          >
            mRNA 암 치료 플랫폼
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};
