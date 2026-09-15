import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, SAFE } from "../theme";
import { pIn, useCount } from "../lib";
import { cueAt } from "../timing";

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 밝은 카드뉴스 톤 — 숫자를 크게, 연결 안 되는 건 회색으로 떼어놓는다 */
export const S7Earnings: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c2, c3] = cueAt("s7-earnings");
  const P = (d: number, dur = 22) => pIn(frame, d, dur);
  const rev = useCount(13209, c2 + 8, 34);
  const op = useCount(5864, c2 + 16, 34);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div
        style={{
          position: "absolute",
          left: SAFE,
          top: 132,
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
          뉴스 ≠ 실적
        </span>
        <span style={{ fontSize: 44, fontWeight: 800, color: C.ink, letterSpacing: -1.6 }}>
          테마가 움직인 것과,{" "}
          <span style={{ background: C.hi, borderRadius: 9, padding: "2px 12px 5px" }}>
            실적을 만든 것
          </span>
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          right: SAFE,
          top: 262,
          display: "flex",
          gap: 30,
        }}
      >
        {[
          { label: "삼성바이오로직스 2Q 매출", v: rev, badge: "전년 동기 +30%", d: c2 + 2 },
          { label: "영업이익", v: op, badge: "전년 동기 +23%", d: c2 + 10 },
        ].map((k) => {
          const p = P(k.d, 22);
          return (
            <div
              key={k.label}
              style={{
                flex: 1,
                background: "#FFFFFF",
                border: "3px solid rgba(13,16,32,0.10)",
                borderRadius: 26,
                padding: "30px 38px 34px",
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
                boxShadow: "0 22px 60px rgba(13,16,32,0.18)",
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 700, color: C.inkDim }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
                <span
                  style={{
                    fontSize: 108,
                    fontWeight: 800,
                    color: C.ink,
                    letterSpacing: -5,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(k.v)}
                </span>
                <span style={{ fontSize: 40, fontWeight: 700, color: C.inkDim }}>억 원</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  display: "inline-block",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  background: "#0FA968",
                  borderRadius: 999,
                  padding: "9px 22px",
                }}
              >
                {k.badge}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE,
          right: SAFE,
          top: 608,
          display: "flex",
          alignItems: "stretch",
          gap: 22,
          opacity: P(c3, 22),
        }}
      >
        <div
          style={{
            flex: 1.35,
            background: "#FFFFFF",
            border: "3px solid #0FA968",
            borderRadius: 24,
            padding: "24px 32px 28px",
            boxShadow: "0 18px 48px rgba(13,16,32,0.16)",
          }}
        >
          <div style={{ fontSize: 27, fontWeight: 800, color: "#0FA968", letterSpacing: 1 }}>
            회사가 밝힌 성장 요인
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
            {["1~4공장 높은 가동률", "환율 효과"].map((t, i) => {
              const p = P(c3 + 10 + i * 8, 20);
              return (
                <div
                  key={t}
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    color: C.ink,
                    background: C.hi,
                    borderRadius: 14,
                    padding: "14px 22px",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 12}px)`,
                  }}
                >
                  {t}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            width: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 900,
            color: "rgba(13,16,32,0.28)",
            opacity: P(c3 + 22, 20),
          }}
        >
          ╱╱
        </div>

        <div
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.55)",
            border: "3px dashed rgba(13,16,32,0.22)",
            borderRadius: 24,
            padding: "24px 32px 28px",
            opacity: P(c3 + 18, 22),
          }}
        >
          <div style={{ fontSize: 27, fontWeight: 800, color: C.inkDim, letterSpacing: 1 }}>
            이번 분기 실적과 무관
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: "rgba(13,16,32,0.42)",
              marginTop: 18,
              lineHeight: 1.34,
            }}
          >
            모더나 mRNA 암 백신
            <br />
            임상 3상 뉴스
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
