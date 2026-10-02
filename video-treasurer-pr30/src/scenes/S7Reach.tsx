import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt } from "../timing";
import { Card, CardHead, Chip, PAPER, PathTag } from "../ui/Card";

/** 상태는 덱 9쪽 그대로 — 한국만 LIVE, 싱가포르·홍콩은 파일럿 */
const STOPS: { k: string; s: string; tone: "green" | "blue" | "grey"; d: string }[] = [
  { k: "Korea", s: "LIVE", tone: "green", d: "asset managers · securities · insurance" },
  { k: "Singapore", s: "PILOT", tone: "blue", d: "offshore hedge funds · brokers" },
  { k: "Hong Kong", s: "PILOT", tone: "blue", d: "asset managers" },
  { k: "Japan · US", s: "NEXT", tone: "grey", d: "planned 2027–2028" },
];

export const S7Reach: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-reach");

  const n = interpolate(frame - 6, [0, 32], [0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: PAPER }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 62,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: pIn(frame, 0, 12),
        }}
      >
        <span style={{ width: 12, height: 12, background: C.brand, transform: "rotate(45deg)" }} />
        <span
          style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 4.5, color: C.ink2 }}
        >
          TREASURER AX
        </span>
      </div>

      <div style={{ position: "absolute", left: 120, top: 360, width: 640 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: -5,
            lineHeight: 1,
            color: C.ink,
            opacity: pIn(frame, 2, 14),
          }}
        >
          {Math.round(n)}
          <span style={{ color: C.brand }}>+</span>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: -1.5,
            lineHeight: 1.36,
            color: C.ink,
            opacity: pIn(frame, 10, 16),
          }}
        >
          institutions already
          <br />
          run Treasurer AX.
        </div>
      </div>

      <PathTag p={pIn(frame, 20, 14)}>/ax/customers</PathTag>

      <Card x={880} y={252} w={912} p={pIn(frame, 8, 16)}>
        <CardHead label="DEPLOYMENTS" right="SEPTEMBER 2026" />
        <div style={{ padding: "8px 26px 18px" }}>
          {STOPS.map((s, i) => (
            <div
              key={s.k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "22px 0",
                borderBottom: i === STOPS.length - 1 ? "none" : "1px solid #eef2f7",
                opacity: pIn(frame, c0 + 6 + i * 9, 14),
              }}
            >
              <div style={{ width: 250 }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    letterSpacing: -1,
                    color: s.tone === "grey" ? C.ink3 : C.ink,
                  }}
                >
                  {s.k}
                </div>
              </div>
              <Chip tone={s.tone}>{s.s}</Chip>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink4 }}>{s.d}</span>
            </div>
          ))}
        </div>
      </Card>

      <div
        style={{
          position: "absolute",
          left: 880,
          top: 880,
          width: 912,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 3.4,
          color: C.ink4,
          opacity: pIn(frame, c1, 16),
        }}
      >
        ASSET MANAGERS · SECURITIES · INSURANCE · PRIVATE MARKETS
      </div>
    </AbsoluteFill>
  );
};
