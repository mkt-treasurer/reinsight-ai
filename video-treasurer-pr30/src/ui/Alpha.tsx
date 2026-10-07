import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { A, C, FONT, MONO, SERIF } from "../theme";
import { pIn, EASE } from "../lib";

/** 결정적 난수 — seed 가 같으면 매 렌더 같은 배치가 나온다 */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Tile = { c: number; r: number; big: number; shade: number; delay: number };

/**
 * 파란 타일이 격자 위에서 하나씩 켜지는 배경.
 * 밝은 타일은 드물게 — 레퍼런스처럼 대부분은 거의 바탕에 묻힌다.
 */
export const Mosaic: React.FC<{
  seed?: number;
  count?: number;
  cell?: number;
  from?: number;
  spread?: number;
  opacity?: number;
  area?: { x: number; y: number; w: number; h: number };
}> = ({ seed = 7, count = 26, cell = 94, from = 0, spread = 46, opacity = 1, area }) => {
  const frame = useCurrentFrame();
  const box = area ?? { x: 0, y: 0, w: 1920, h: 1080 };
  const cols = Math.max(1, Math.floor(box.w / cell));
  const rows = Math.max(1, Math.floor(box.h / cell));

  const tiles = React.useMemo<Tile[]>(() => {
    const used = new Set<string>();
    const out: Tile[] = [];
    for (let i = 0; i < count * 4 && out.length < count; i++) {
      const c = Math.floor(rnd(seed + i * 1.7) * cols);
      const r = Math.floor(rnd(seed + i * 2.9 + 50) * rows);
      const big = rnd(seed + i * 4.1 + 90) > 0.76 ? 2 : 1;
      if (c + big > cols || r + big > rows) continue;
      let clash = false;
      for (let dc = 0; dc < big; dc++)
        for (let dr = 0; dr < big; dr++) if (used.has(`${c + dc},${r + dr}`)) clash = true;
      if (clash) continue;
      for (let dc = 0; dc < big; dc++)
        for (let dr = 0; dr < big; dr++) used.add(`${c + dc},${r + dr}`);
      const b = rnd(seed + i * 5.3 + 130);
      const shade = b > 0.94 ? 4 : b > 0.84 ? 3 : b > 0.62 ? 2 : b > 0.32 ? 1 : 0;
      out.push({ c, r, big, shade, delay: Math.floor(rnd(seed + i * 6.7 + 200) * spread) });
    }
    return out;
  }, [seed, count, cols, rows, spread]);

  const pad = Math.round(cell * 0.11);

  return (
    <AbsoluteFill style={{ opacity }}>
      {tiles.map((t, i) => {
        const p = pIn(frame, from + t.delay, 15);
        if (p <= 0.004) return null;
        // 밝은 타일만 천천히 숨 쉰다
        const pulse = t.shade >= 3 ? 0.82 + 0.18 * Math.sin((frame - from - t.delay) / 19) : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: box.x + t.c * cell + pad,
              top: box.y + t.r * cell + pad,
              width: t.big * cell - pad * 2,
              height: t.big * cell - pad * 2,
              background: A.tile[t.shade],
              opacity: p * pulse,
              transform: `scale(${0.82 + p * 0.18})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 모자이크를 깐 검은 무대 */
export const VoidStage: React.FC<{
  seed?: number;
  count?: number;
  from?: number;
  tiles?: number;
  children?: React.ReactNode;
}> = ({ seed = 7, count = 32, from = 0, tiles = 1, children }) => (
  <AbsoluteFill style={{ background: A.void, fontFamily: FONT }}>
    <Mosaic seed={seed} count={count} from={from} opacity={tiles} />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 58% 90% at 26% 52%, rgba(5,7,15,0.94) 0%, rgba(5,7,15,0.58) 54%, rgba(5,7,15,0) 100%)",
      }}
    />
    {children}
  </AbsoluteFill>
);

/**
 * 세리프 선언문. 줄마다 차례로 올라온다.
 * 강조는 lines 안에 <Em> 로 넣는다.
 */
export const Statement: React.FC<{
  lines: React.ReactNode[];
  from?: number;
  size?: number;
  left?: number;
  top?: number;
  align?: "left" | "center";
  width?: number;
}> = ({ lines, from = 0, size = 86, left = 150, top = 404, align = "left", width = 1620 }) => {
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
        fontFamily: SERIF,
        fontSize: size,
        lineHeight: 1.17,
        letterSpacing: -1.4,
        color: "#fff",
      }}
    >
      {lines.map((l, i) => {
        const p = pIn(frame, from + i * 9, 20);
        return (
          <div
            key={i}
            style={{
              opacity: p,
              transform: `translateY(${(1 - p) * 20}px)`,
            }}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
};

/** 선언문 안에서 한 덩어리만 밝게 */
export const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: "#6ea8ff" }}>{children}</span>
);

/** 선언문 위에 얹는 작은 모노 꼬리표 */
export const Kicker: React.FC<{ children: React.ReactNode; from?: number; left?: number; top?: number }> = ({
  children,
  from = 0,
  left = 152,
  top = 322,
}) => {
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
        color: "#5b8ddb",
        opacity: pIn(frame, from, 14),
      }}
    >
      {children}
    </div>
  );
};

/** 풀블리드 파랑 무대 — 제품 화면이 올라가는 자리 */
export const BlueField: React.FC<{ from?: number; children?: React.ReactNode }> = ({
  from = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, from, 16);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, opacity: p }}>
      <AbsoluteFill style={{ background: A.field }} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(255,255,255,0.10) 0%, rgba(11,71,171,0.26) 62%, rgba(11,71,171,0.52) 100%)",
        }}
      />
      {/* 레퍼런스의 옅은 십자 가늠선 */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 0,
          width: 1,
          height: 1080,
          background: "rgba(255,255,255,0.13)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 540,
          width: 1920,
          height: 1,
          background: "rgba(255,255,255,0.09)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** 파랑 위에 떠 있는 흰 카드 */
export const FloatCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  from?: number;
  tilt?: number;
  pad?: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, from = 0, tilt = 0, pad = 26, children }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, from, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 30px 72px rgba(3,18,54,0.34), 0 4px 14px rgba(3,18,54,0.18)",
        padding: pad,
        opacity: p,
        transform: `perspective(1800px) rotateX(${tilt}deg) translateY(${(1 - p) * 16}px) scale(${
          0.97 + p * 0.03
        })`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </div>
  );
};

/** 카드 둘레에 가는 선으로 달리는 작은 라벨 */
export const NodeTag: React.FC<{
  x: number;
  y: number;
  w?: number;
  label: string;
  from?: number;
}> = ({ x, y, w = 212, label, from = 0 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, from, 15);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: "#fff",
        border: "1px solid rgba(15,42,92,0.14)",
        borderRadius: 7,
        padding: "11px 13px",
        boxShadow: "0 8px 22px rgba(3,18,54,0.16)",
        opacity: p,
        transform: `translateY(${(1 - p) * 8}px)`,
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          marginTop: 2,
          width: 13,
          height: 13,
          borderRadius: 7,
          border: `2px solid ${C.brand}`,
        }}
      />
      <span style={{ fontSize: 15, lineHeight: 1.33, color: "#2a3b57", letterSpacing: -0.2 }}>
        {label}
      </span>
    </div>
  );
};

/** 노드와 카드를 잇는 가는 선 */
export const Hair: React.FC<{
  d: string;
  from?: number;
  len?: number;
  color?: string;
}> = ({ d, from = 0, len = 320, color = "rgba(255,255,255,0.55)" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  if (p <= 0.01) return null;
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={1.4}
      fill="none"
      strokeDasharray={len}
      strokeDashoffset={len * (1 - p)}
    />
  );
};
