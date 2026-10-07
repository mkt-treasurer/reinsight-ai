import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";

/** 결정적 난수 — seed 가 같으면 매 렌더 같은 배치가 나온다 */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Pt = { x: number; y: number; r: number; hot: boolean; d: number };

/**
 * 배경에 아주 옅게 깔리는 노드-링크 격자.
 * 우리가 파는 것이 '연결된 자료'이므로 배경도 그 모양을 쓴다.
 * 글자를 방해하지 않을 만큼만 보이게 한다.
 */
export const Lattice: React.FC<{
  seed?: number;
  count?: number;
  from?: number;
  opacity?: number;
  drift?: number;
}> = ({ seed = 7, count = 26, from = 0, opacity = 1, drift = 1 }) => {
  const frame = useCurrentFrame();

  const { pts, links } = React.useMemo(() => {
    const pts: Pt[] = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: 60 + rnd(seed + i * 1.7) * 1800,
        y: 70 + rnd(seed + i * 2.9 + 40) * 940,
        r: 2.4 + rnd(seed + i * 3.7 + 80) * 2.6,
        hot: rnd(seed + i * 5.1 + 120) > 0.84,
        d: Math.floor(rnd(seed + i * 6.3 + 170) * 40),
      });
    }
    // 각 점을 가장 가까운 둘과 잇는다 — 중복 선은 버린다
    const seen = new Set<string>();
    const links: [number, number][] = [];
    pts.forEach((p, i) => {
      const near = pts
        .map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      near.forEach((o) => {
        const k = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
        if (seen.has(k)) return;
        seen.add(k);
        links.push([i, o.j]);
      });
    });
    return { pts, links };
  }, [seed, count]);

  const slide = interpolate(frame, [0, 300], [0, -26 * drift], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${slide}px)` }}
      >
        {links.map(([a, b], i) => {
          const A = pts[a];
          const B = pts[b];
          const p = interpolate(frame - (from + Math.max(A.d, B.d) + 8), [0, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          if (p <= 0.01) return null;
          return (
            <line
              key={`l${i}`}
              x1={A.x}
              y1={A.y}
              x2={A.x + (B.x - A.x) * p}
              y2={A.y + (B.y - A.y) * p}
              stroke="rgba(96,165,250,0.14)"
              strokeWidth={1}
            />
          );
        })}
        {pts.map((p, i) => {
          const a = pIn(frame, from + p.d, 16);
          if (a <= 0.01) return null;
          const beat = p.hot ? 0.74 + 0.26 * Math.sin((frame - from - p.d) / 21) : 1;
          return (
            <g key={`p${i}`}>
              {p.hot ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r * 4.2}
                  fill="rgba(59,130,246,0.10)"
                  opacity={a * beat}
                />
              ) : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.hot ? C.brand : "rgba(96,165,250,0.34)"}
                opacity={a * beat}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** 격자를 깐 우리 무대 — 다크 네이비 그대로 */
export const Stage: React.FC<{
  seed?: number;
  count?: number;
  from?: number;
  lattice?: number;
  children?: React.ReactNode;
}> = ({ seed = 7, count = 26, from = 0, lattice = 1, children }) => (
  <AbsoluteFill style={{ background: C.darkDeep, fontFamily: FONT }}>
    <Lattice seed={seed} count={count} from={from} opacity={lattice} />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 62% 86% at 24% 52%, rgba(8,14,28,0.92) 0%, rgba(8,14,28,0.52) 56%, rgba(8,14,28,0) 100%)",
      }}
    />
    {children}
  </AbsoluteFill>
);

/**
 * 한 샷에 한 생각. 줄마다 차례로 올라온다.
 * 서체는 우리 본문체 그대로 — 자간만 바짝 조인다.
 */
export const Statement: React.FC<{
  lines: React.ReactNode[];
  from?: number;
  size?: number;
  left?: number;
  top?: number;
  align?: "left" | "center";
  width?: number;
}> = ({ lines, from = 0, size = 78, left = 150, top = 404, align = "left", width = 1620 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : left,
        right: align === "center" ? 0 : undefined,
        top,
        width: align === "center" ? undefined : width,
        textAlign: align,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.22,
        letterSpacing: -3,
        color: C.onDark,
      }}
    >
      {lines.map((l, i) => {
        const p = pIn(frame, from + i * 9, 20);
        return (
          <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
            {l}
          </div>
        );
      })}
    </div>
  );
};

/** 선언문 안에서 한 덩어리만 밝게 */
export const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: C.brandLite }}>{children}</span>
);

/** 선언문 위에 얹는 작은 모노 꼬리표 */
export const Kicker: React.FC<{
  children: React.ReactNode;
  from?: number;
  left?: number;
  top?: number;
}> = ({ children, from = 0, left = 152, top = 322 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        fontFamily: MONO,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: 5,
        color: C.brandLite,
        opacity: pIn(frame, from, 14),
      }}
    >
      {children}
    </div>
  );
};
