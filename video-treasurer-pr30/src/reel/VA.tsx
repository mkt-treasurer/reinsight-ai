import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { Stage } from "../ui/Stage";
import { cueAt, scene } from "../timing";

/**
 * 세로(1080x1920) 릴스용 씬 — 앞 절반.
 * 인스타 UI 가 위 ~240px, 아래 ~440px 을 가리므로 본문은 TOP~BOT 안에 둔다.
 * 가로판과 내용은 같고 배치와 글자 크기만 모바일에 맞춘다.
 */
export const W = 1080;
export const H = 1920;
export const PAD = 76;
export const TOP = 300;
export const BOT = 1480;

const WASH =
  "radial-gradient(ellipse 96% 56% at 50% 44%, rgba(8,14,28,0.90) 0%, rgba(8,14,28,0.56) 58%, rgba(8,14,28,0.14) 100%)";

/** 세로판 공통 배경 */
export const VStage: React.FC<{ seed?: number; count?: number; lattice?: number }> = ({
  seed = 7,
  count = 22,
  lattice = 1,
}) => <Stage seed={seed} count={count} w={W} h={H} wash={WASH} lattice={lattice} />;

/** 화면 위에 작게 박는 워드마크 */
export const VMark: React.FC<{ p: number }> = ({ p }) => (
  <div
    style={{
      position: "absolute",
      left: PAD,
      top: 232,
      display: "flex",
      alignItems: "center",
      gap: 14,
      opacity: p,
    }}
  >
    <span style={{ width: 16, height: 16, background: C.brand, transform: "rotate(45deg)" }} />
    <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: 9, color: C.onDark }}>
      TREASURER
    </span>
  </div>
);

/** 모바일에서 읽히는 크기의 선언문 */
export const VSay: React.FC<{
  lines: React.ReactNode[];
  from?: number;
  size?: number;
  top?: number;
  align?: "left" | "center";
}> = ({ lines, from = 0, size = 82, top = TOP, align = "left" }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        top,
        textAlign: align,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: -2.6,
        color: C.onDark,
      }}
    >
      {lines.map((l, i) => {
        const p = pIn(frame, from + i * 8, 20);
        return (
          <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

export const VEm: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: C.brandLite }}>{children}</span>
);

export const VKick: React.FC<{ children: React.ReactNode; p: number; top: number }> = ({
  children,
  p,
  top,
}) => (
  <div
    style={{
      position: "absolute",
      left: PAD,
      right: PAD,
      top,
      fontFamily: MONO,
      fontSize: 21,
      fontWeight: 700,
      letterSpacing: 4.4,
      color: C.brandLite,
      opacity: p,
    }}
  >
    {children}
  </div>
);

/* ─────────────────────────── 01 오프닝 ─────────────────────────── */

export const V1Open: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-open");
  const build = pIn(frame, 6, 24);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={11} count={20} />
      <VMark p={build} />

      <VSay
        from={c0 + 2}
        size={104}
        top={640}
        lines={[
          <>Analysts</>,
          <>repeat the</>,
          <>same jobs</>,
          <>
            <VEm>every day.</VEm>
          </>,
        ]}
      />

      <VKick p={pIn(frame, c1 + 2, 18)} top={1222}>
        AI AGENTS FOR FINANCIAL INSTITUTIONS
      </VKick>
    </AbsoluteFill>
  );
};

/* ─────────────────────── 02 매일 도는 업무 ─────────────────────── */

const JOBS = [
  { no: "01", k: "Research", d: "Read the filings. Write the note." },
  { no: "02", k: "Monitoring", d: "Check every holding for changes." },
  { no: "03", k: "Reporting", d: "Fill the same report again." },
];

export const V2What: React.FC = () => {
  const frame = useCurrentFrame();
  cueAt("s-what");
  const pick = pIn(frame, 86, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={31} count={18} lattice={0.6} />
      <VMark p={pIn(frame, 0, 12)} />

      <VKick p={pIn(frame, 2, 14)} top={344}>
        THE DAILY LOOP · DONE BY HAND
      </VKick>

      {JOBS.map((j, i) => {
        const on = i === 1;
        const p = pIn(frame, 14 + i * 12, 16);
        return (
          <div
            key={j.no}
            style={{
              position: "absolute",
              left: PAD,
              right: PAD,
              top: 452 + i * 190,
              border: `1px solid ${on ? `rgba(96,165,250,${0.3 + pick * 0.4})` : C.onDarkLine2}`,
              background: on ? `rgba(59,130,246,${0.06 + pick * 0.12})` : "rgba(10,16,32,0.72)",
              borderRadius: 10,
              padding: "28px 30px 30px",
              opacity: p * (on ? 1 : 1 - pick * 0.42),
              transform: `translateY(${(1 - p) * 16}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  color: on && pick > 0.3 ? C.brandLite : C.onDark3,
                }}
              >
                {j.no}
              </span>
              <span style={{ fontSize: 50, fontWeight: 700, letterSpacing: -1.6, color: C.onDark }}>
                {j.k}
              </span>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: -0.5,
                color: C.onDark2,
              }}
            >
              {j.d}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1052,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: pIn(frame, 58, 16),
        }}
      >
        <span style={{ fontSize: 26, color: C.onDark3 }}>↻</span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.onDark3,
          }}
        >
          SAME LOOP, EVERY DAY
        </span>
      </div>

      <VSay
        from={70}
        size={64}
        top={1168}
        lines={[
          <>Work that repeats is</>,
          <>
            work <VEm>an agent can run.</VEm>
          </>,
        ]}
      />
    </AbsoluteFill>
  );
};

/* ──────────────────── 03 우리가 가진 자료 ──────────────────── */

const SIDES = [
  { k: "PUBLIC", items: ["Korean filings", "Market data"], hero: false },
  {
    k: "PRIVATE",
    items: ["Private-company financials", "Ownership & relationships"],
    hero: true,
  },
];

export const V3Layers: React.FC = () => {
  const frame = useCurrentFrame();
  const [, c1, c2] = cueAt("s-layers");
  const life = scene("s-layers").durationInFrames;

  const flow = interpolate(frame, [c2 - 26, c2 + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const hand = interpolate(frame, [life - 48, life - 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={5} count={18} lattice={0.7} />
      <VMark p={pIn(frame, 0, 12)} />

      <VKick p={pIn(frame, 2, 14)} top={344}>
        WHY AN AGENT CAN RUN THEM
      </VKick>

      <VSay
        from={8}
        size={64}
        top={414}
        lines={[
          <>
            The same jobs read the <VEm>same sources</VEm>.
          </>,
        ]}
      />

      {SIDES.map((s, i) => {
        const p = pIn(frame, c1 - 20 + i * 12, 16);
        return (
          <div
            key={s.k}
            style={{
              position: "absolute",
              left: PAD,
              right: PAD,
              top: 644 + i * 228,
              border: `1px solid ${s.hero ? "rgba(96,165,250,0.55)" : "rgba(148,163,184,0.26)"}`,
              background: s.hero ? "rgba(13,40,92,0.92)" : "rgba(10,16,32,0.90)",
              borderRadius: 10,
              padding: "28px 32px 32px",
              opacity: p,
              transform: `translateY(${(1 - p) * 16}px)`,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: 3.4,
                color: s.hero ? C.brandLite : C.onDark3,
              }}
            >
              {s.k}
            </div>
            <div style={{ marginTop: 16 }}>
              {s.items.map((it, k) => (
                <div
                  key={it}
                  style={{
                    fontSize: 38,
                    fontWeight: 600,
                    letterSpacing: -1,
                    lineHeight: 1.44,
                    color: C.onDark,
                    opacity: pIn(frame, c1 - 12 + i * 12 + k * 7, 14),
                  }}
                >
                  {it}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 둘이 아래로 모인다 */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 1].map((i) => {
          const p = interpolate(frame - (c2 - 30 + i * 6), [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          if (p <= 0.01) return null;
          const x = i === 0 ? PAD + 150 : W - PAD - 150;
          const y1 = i === 0 ? 644 + 196 : 872 + 224;
          return (
            <path
              key={i}
              d={`M ${x} ${y1} C ${x} ${y1 + 50}, ${W / 2} ${1142 - 50}, ${W / 2} ${1142}`}
              stroke={i === 1 ? "rgba(96,165,250,0.7)" : "rgba(148,163,184,0.5)"}
              strokeWidth={2.2}
              fill="none"
              strokeDasharray={420}
              strokeDashoffset={420 * (1 - p)}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1152,
          border: `1px solid rgba(96,165,250,${0.35 + flow * 0.4})`,
          background: `rgba(59,130,246,${0.08 + flow * 0.08})`,
          borderRadius: 10,
          padding: "24px 30px 28px",
          opacity: pIn(frame, c2 - 20, 16),
          boxShadow: `0 0 ${flow * 54}px rgba(59,130,246,0.3)`,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: 3.4,
            color: C.brandLite,
          }}
        >
          ONE LAYER
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: -1,
            color: C.onDark,
          }}
        >
          Ours · collected and cleaned in real time
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1348,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: -0.9,
          color: C.onDark2,
          opacity: hand,
          transform: `translateY(${(1 - hand) * 10}px)`,
        }}
      >
        Then linked — <span style={{ color: C.onDark, fontWeight: 700 }}>who owns what, as of when</span>.
      </div>
    </AbsoluteFill>
  );
};

/* ──────────────────── 04 온톨로지 (간소화) ──────────────────── */

/** 모바일에서 읽히도록 노드를 다섯으로 줄이고 크게 */
const VN = [
  { k: "COMPANY", x: 540, y: 900, r: 44, hub: true },
  { k: "PERSON", x: 268, y: 712, r: 26 },
  { k: "FILING", x: 812, y: 712, r: 26 },
  { k: "ASSET", x: 268, y: 1096, r: 26 },
  { k: "EVENT", x: 812, y: 1096, r: 26 },
];
const VE: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 3],
  [2, 4],
];

const rnd = (s: number) => {
  const x = Math.sin(s * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const VDOTS = Array.from({ length: 70 }, (_, i) => ({
  x: 90 + rnd(i + 3) * 900,
  y: 640 + rnd(i + 77) * 540,
  r: 2.2 + rnd(i + 151) * 2,
  n: i % VN.length,
  d: Math.round(rnd(i + 233) * 30),
}));

export const V4Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1, c2] = cueAt("s-graph");

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VStage seed={41} count={16} lattice={0.5} />
      <VMark p={pIn(frame, 0, 12)} />

      <VSay
        from={2}
        size={62}
        top={362}
        lines={[
          <>We don&rsquo;t just collect it.</>,
          <>
            <VEm>TA7Z connects it.</VEm>
          </>,
        ]}
      />

      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {VDOTS.map((p, i) => {
          const t = VN[p.n];
          const appear = pIn(frame, c0 + p.d, 12);
          const travel = interpolate(frame - (c1 + p.d * 0.5), [0, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          const o = appear * (1 - travel);
          if (o <= 0.01) return null;
          return (
            <circle
              key={`d${i}`}
              cx={p.x + (t.x - p.x) * travel}
              cy={p.y + (t.y - p.y) * travel}
              r={p.r}
              fill={travel > 0.1 ? C.brandLite : "rgba(148,163,184,0.55)"}
              opacity={o}
            />
          );
        })}

        {VE.map(([a, b], i) => {
          const A = VN[a];
          const B = VN[b];
          const p = interpolate(frame - (c1 + 30 + i * 4), [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          if (p <= 0.01) return null;
          return (
            <line
              key={`e${i}`}
              x1={A.x}
              y1={A.y}
              x2={A.x + (B.x - A.x) * p}
              y2={A.y + (B.y - A.y) * p}
              stroke="rgba(96,165,250,0.5)"
              strokeWidth={2.4}
            />
          );
        })}

        {VN.map((nd, i) => {
          const p = pIn(frame, c1 + 16 + i * 5, 14);
          if (p <= 0.01) return null;
          return (
            <g key={nd.k}>
              <circle
                cx={nd.x}
                cy={nd.y}
                r={nd.r * p * 2}
                fill={nd.hub ? "rgba(59,130,246,0.18)" : "rgba(96,165,250,0.12)"}
              />
              <circle cx={nd.x} cy={nd.y} r={nd.r * p} fill={nd.hub ? C.brand : C.brandLite} />
            </g>
          );
        })}
      </svg>

      {VN.map((nd, i) => {
        const p = pIn(frame, c1 + 28 + i * 4, 13);
        return (
          <div
            key={nd.k}
            style={{
              position: "absolute",
              left: nd.x - 170,
              top: nd.y + nd.r + 16,
              width: 340,
              textAlign: "center",
              fontFamily: MONO,
              fontSize: nd.hub ? 27 : 23,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: nd.hub ? C.onDark : C.onDark2,
              opacity: p,
            }}
          >
            {nd.k}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top: 1292,
          textAlign: "center",
          opacity: pIn(frame, c2 + 4, 16),
        }}
      >
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3, color: C.onDark }}>
          6,800<span style={{ color: C.brandLite }}>+</span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: MONO,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            color: C.onDark2,
          }}
        >
          SOURCES · ONE GRAPH
        </div>
      </div>
    </AbsoluteFill>
  );
};
