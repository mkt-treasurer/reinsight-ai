import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt } from "../timing";
import { Card, CardHead, Chip, PAPER, Say, PathTag } from "../ui/Card";

const Q = "What changed in my portfolio this week?";

const FILES = [
  { n: "TRY-2026-0031_Ownership.pdf", w: 1 },
  { n: "Q3_Disclosure_Holding_A.pdf", w: 1 },
  { n: "BDX-2026-0203_Q3_Holdings.xlsx", w: 1 },
  { n: "Rating_Note_Agency_0914.pdf", w: 0.82 },
  { n: "Guidance_Revision_2026Q3.eml", w: 0.55 },
  { n: "Price_Series_2026-09.csv", w: 0.3 },
];

const HITS = [
  { t: "2 ownership changes", ref: "TRY-2026-0031 · 0044", n: "1" },
  { t: "1 guidance cut", ref: "Q3 filing, p.12", n: "2" },
  { t: "1 rating downgrade", ref: "Agency note, 14 Sep", n: "3" },
];

export const S2Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1, c2] = cueAt("s-demo");

  const typed = Math.max(
    0,
    Math.round(
      interpolate(frame - (c0 + 10), [0, 40], [0, Q.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  );
  const caret = typed < Q.length || Math.floor(frame / 8) % 2 === 0;
  const done = typed >= Q.length;

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
        <span style={{ width: 1, height: 15, background: "#d5dde8", margin: "0 6px" }} />
        <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 2.4, color: C.ink3 }}>
          MONITORING AGENT
        </span>
        <span style={{ marginLeft: 6 }}>
          <Chip tone="grey">EXAMPLE RUN</Chip>
        </span>
      </div>

      <Say
        y={344}
        p={pIn(frame, 4, 18)}
        sub="It reads this week's filings and answers, with every line sourced."
        subP={pIn(frame, c1 - 10, 18)}
      >
        Ask it in plain
        <br />
        language.
      </Say>

      <PathTag p={pIn(frame, 20, 14)}>/ax/agents/monitoring</PathTag>

      <Card x={880} y={150} w={912} p={pIn(frame, 6, 14)} z={3}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 26px 26px" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" style={{ flex: "0 0 auto" }}>
            <circle cx={10.5} cy={10.5} r={7} fill="none" stroke={C.ink4} strokeWidth={2} />
            <line x1={16} y1={16} x2={21} y2={21} stroke={C.ink4} strokeWidth={2} />
          </svg>
          <span style={{ fontSize: 28, fontWeight: 600, color: C.ink, letterSpacing: -0.8 }}>
            {Q.slice(0, typed)}
          </span>
          <span style={{ width: 2, height: 30, background: C.brand, opacity: caret ? 1 : 0 }} />
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.8,
              color: done ? "#fff" : C.ink4,
              background: done ? C.brand : "rgba(15,23,42,0.06)",
              borderRadius: 4,
              padding: "9px 16px 10px",
            }}
          >
            ENTER
          </span>
        </div>
      </Card>

      <Card x={880} y={290} w={912} p={pIn(frame, c1 - 14, 16)} z={1}>
        <CardHead label="READING DOCUMENTS" right="6 / 6 · THIS WEEK" />
        <div style={{ padding: "14px 24px 18px" }}>
          {FILES.map((f, i) => {
            const g = interpolate(frame - (c1 + i * 7), [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            const ok = g >= 1;
            return (
              <div
                key={f.n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "9px 0",
                  opacity: pIn(frame, c1 - 8 + i * 4, 12),
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: ok ? C.accent : C.ink4,
                    flex: "0 0 auto",
                  }}
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 16,
                    color: C.ink2,
                    width: 400,
                    flex: "0 0 auto",
                  }}
                >
                  {f.n}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 5,
                    background: "rgba(15,23,42,0.07)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${g * f.w * 100}%`,
                      background: C.brand,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    color: ok ? C.accent : C.ink4,
                    width: 52,
                    textAlign: "right",
                    flex: "0 0 auto",
                  }}
                >
                  {ok ? "read" : `${Math.round(g * 100)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        x={800}
        y={606}
        w={992}
        p={pIn(frame, c2 - 26, 16)}
        lift
        z={5}
        style={{ transform: `translateY(${(1 - pIn(frame, c2 - 26, 16)) * 24}px)` }}
      >
        <CardHead label="AI SUMMARY" right="3 SOURCES ATTACHED" dark />
        <div style={{ padding: "20px 26px 24px" }}>
          {HITS.map((h, i) => (
            <div
              key={h.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "15px 0",
                borderBottom: i === 2 ? "none" : "1px solid #eef2f7",
                opacity: pIn(frame, c2 - 16 + i * 9, 13),
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.brand,
                  background: "rgba(59,130,246,0.12)",
                  borderRadius: 3,
                  padding: "4px 8px 5px",
                }}
              >
                {h.n}
              </span>
              <span style={{ fontSize: 34, fontWeight: 700, color: C.ink, letterSpacing: -1.2 }}>
                {h.t}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink3 }}>{h.ref}</span>
            </div>
          ))}
        </div>
      </Card>
    </AbsoluteFill>
  );
};
