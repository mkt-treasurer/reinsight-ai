import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT } from "./theme";

/** 검은 외곽선 — 어떤 배경에서도 글자가 읽히게 */
const OUTLINE = (px: number) => {
  const out: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    out.push(`${(Math.cos(a) * px).toFixed(2)}px ${(Math.sin(a) * px).toFixed(2)}px 0 #05060B`);
  }
  return out.join(", ");
};

const BG = `radial-gradient(1300px 900px at 12% -12%, rgba(101,85,238,0.44), transparent 60%),
            radial-gradient(1000px 700px at 92% 110%, rgba(25,201,140,0.22), transparent 58%),
            linear-gradient(155deg, #141838 0%, #0A0C18 56%, #10132A 100%)`;

/** 숫자를 주인공으로 쓸 때의 공통 스타일 */
const HERO = (size: number): React.CSSProperties => ({
  fontSize: size,
  fontWeight: 800,
  letterSpacing: -size * 0.062,
  lineHeight: 0.92,
  color: C.green,
  textShadow: `0 0 ${size * 0.5}px rgba(25,201,140,0.55), ${OUTLINE(Math.round(size * 0.012))}`,
  whiteSpace: "nowrap",
});

const Badge: React.FC<{ top?: number; left?: number }> = ({ top = 56, left = 80 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left,
      display: "flex",
      alignItems: "center",
      gap: 13,
      background: `linear-gradient(135deg, ${C.brandLite}, ${C.brand})`,
      borderRadius: 16,
      padding: "14px 24px 16px",
      boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
    }}
  >
    <span style={{ width: 17, height: 17, borderRadius: 6, background: C.hi }} />
    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, color: "#fff" }}>
      ALPHALENZ
    </span>
  </div>
);

const Hi: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      background: C.hi,
      color: "#0B0C12",
      borderRadius: 16,
      padding: "6px 24px 14px",
      textShadow: "none",
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    }}
  >
    {children}
  </span>
);

/** A — 숫자 하나로 화면을 채운다 */
const VariantA: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT, background: BG }}>
    <Badge />
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 168,
        display: "flex",
        alignItems: "baseline",
        gap: 34,
      }}
    >
      <span
        style={{
          fontSize: 104,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -3,
          textShadow: OUTLINE(3),
        }}
      >
        모더나
      </span>
      <span style={{ fontSize: 46, fontWeight: 800, color: C.muted, letterSpacing: 3 }}>
        08.19 · NASDAQ
      </span>
    </div>

    <div style={{ position: "absolute", left: 72, right: 72, top: 268, textAlign: "center" }}>
      <div style={HERO(496)}>+177%</div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 88,
        textAlign: "center",
        fontSize: 96,
        fontWeight: 800,
        color: "#fff",
        letterSpacing: -3.2,
        textShadow: OUTLINE(3.2),
      }}
    >
      같이 오른 국내 3곳, <Hi>진짜 연결은?</Hi>
    </div>
  </AbsoluteFill>
);

/** B — 숫자 + 급등 차트 */
const VariantB: React.FC = () => {
  const PTS = [
    [0, 300], [90, 288], [180, 302], [270, 280], [360, 292],
    [450, 266], [540, 274], [610, 190], [680, 104], [740, 28],
  ];
  const path = PTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: BG }}>
      <Badge />
      <div style={{ position: "absolute", right: 48, top: 150, opacity: 0.85 }}>
        <svg width={800} height={360} viewBox="0 0 760 330">
          <defs>
            <linearGradient id="tl" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.faint} />
              <stop offset="70%" stopColor={C.green} />
              <stop offset="100%" stopColor="#8CFFD6" />
            </linearGradient>
            <linearGradient id="ta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(25,201,140,0.42)" />
              <stop offset="100%" stopColor="rgba(25,201,140,0)" />
            </linearGradient>
          </defs>
          <path d={`${path} L740,330 L0,330 Z`} fill="url(#ta)" />
          <path
            d={path}
            fill="none"
            stroke="url(#tl)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={740} cy={28} r={20} fill={C.green} />
          <circle cx={740} cy={28} r={38} fill="none" stroke={C.green} strokeWidth={4} opacity={0.5} />
        </svg>
      </div>

      <div style={{ position: "absolute", left: 80, top: 214 }}>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -2.6,
            textShadow: OUTLINE(3),
          }}
        >
          모더나
        </div>
        <div style={{ ...HERO(372), marginTop: 4 }}>+177%</div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: C.textDim,
            letterSpacing: -1,
            marginTop: 18,
          }}
        >
          하루 만에
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 66,
          fontSize: 86,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -3,
          textShadow: OUTLINE(3.2),
        }}
      >
        국내 관련주 3곳, <Hi>진짜 연결은?</Hi>
      </div>
    </AbsoluteFill>
  );
};

/** C — 숫자 아래에 회사 이름을 작게 깐다 */
const VariantC: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT, background: BG }}>
    <Badge />
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        top: 176,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 76,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -2.2,
          textShadow: OUTLINE(2.8),
        }}
      >
        모더나 하루 만에
      </div>
      <div style={{ ...HERO(470), marginTop: 2 }}>+177%</div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 168,
        display: "flex",
        justifyContent: "center",
        gap: 20,
      }}
    >
      {["소마젠", "삼양바이오팜", "삼성바이오로직스"].map((f) => (
        <div
          key={f}
          style={{
            background: "rgba(10,12,22,0.86)",
            border: "2px solid rgba(255,255,255,0.24)",
            borderRadius: 16,
            padding: "18px 30px 20px",
            fontSize: 44,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -1.2,
          }}
        >
          {f}
        </div>
      ))}
    </div>

    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 62,
        textAlign: "center",
        fontSize: 82,
        fontWeight: 800,
        color: "#fff",
        letterSpacing: -2.8,
        textShadow: OUTLINE(3),
      }}
    >
      <Hi>진짜 연결은 제각각</Hi>
    </div>
  </AbsoluteFill>
);

export const Thumbnail: React.FC<{ variant?: "A" | "B" | "C" }> = ({ variant = "A" }) => {
  if (variant === "B") return <VariantB />;
  if (variant === "C") return <VariantC />;
  return <VariantA />;
};
