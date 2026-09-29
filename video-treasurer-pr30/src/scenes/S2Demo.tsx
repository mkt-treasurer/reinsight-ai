import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt } from "../timing";

const Q = "What changed in my portfolio this week?";
const STEPS = ["ASK", "READ", "ANSWER"];

const PILL_W = 214;
const PILL_X = 260;
const PILL_Y = 566;
const SOURCES = ["Filings", "Disclosures", "Ownership", "Prices"];
const pillCx = (i: number) => PILL_X + i * (PILL_W + 16) + PILL_W / 2;

/** eight real documents, two per source type, read left to right */
const DOC_Y = 360;
const DOCS = Array.from({ length: 8 }, (_, i) => ({
  x: 300 + i * 172,
  type: i % 4,
  at: 4 + i * 6,
}));

export const S2Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1, c2] = cueAt("s-demo");

  const typed = Math.max(
    0,
    Math.round(
      interpolate(frame - (c0 + 10), [0, 42], [0, Q.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  );
  const caret = typed < Q.length || Math.floor(frame / 8) % 2 === 0;
  const step = frame >= c2 - 24 ? 2 : frame >= c1 - 4 ? 1 : 0;

  const scanX = interpolate(frame - c1, [0, 56], [260, 1660], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const reading = frame > c1 && frame < c1 + 56;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.darkDeep }}>
      {/* app chrome + where we are in the run */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 92,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 84px",
          borderBottom: `1px solid ${C.onDarkLine}`,
          opacity: pIn(frame, 0, 10),
        }}
      >
        <span style={{ width: 13, height: 13, background: C.brand, transform: "rotate(45deg)" }} />
        <span
          style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: 5, color: C.onDark }}
        >
          TREASURER AX
        </span>
        <span style={{ width: 1, height: 18, background: C.onDarkLine2, margin: "0 10px" }} />
        <span
          style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: 3, color: C.brandLite }}
        >
          MONITORING AGENT
        </span>
        <span style={{ flex: 1 }} />
        {STEPS.map((s, i) => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {i > 0 ? <span style={{ fontFamily: MONO, fontSize: 15, color: C.onDark3 }}>→</span> : null}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2.4,
                color: i === step ? C.brandLite : C.onDark3,
                borderBottom: i === step ? `2px solid ${C.brandLite}` : "2px solid transparent",
                paddingBottom: 4,
              }}
            >
              {s}
            </span>
          </span>
        ))}
      </div>

      {/* 01 the ask */}
      <div
        style={{
          position: "absolute",
          left: 260,
          right: 260,
          top: 186,
          border: `1px solid ${C.onDarkLine2}`,
          background: "rgba(148,163,184,0.05)",
          borderRadius: 6,
          padding: "26px 32px 28px",
          display: "flex",
          alignItems: "center",
          opacity: pIn(frame, 4, 12),
        }}
      >
        <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1.3, color: C.onDark }}>
          {Q.slice(0, typed)}
        </span>
        <span
          style={{ width: 3, height: 40, background: C.brandLite, opacity: caret ? 1 : 0, marginLeft: 5 }}
        />
      </div>

      {/* 02 each document is read, then filed under the source it came from */}
      {DOCS.map((d, i) => {
        const appear = pIn(frame, c1 - 10 + i * 3, 10);
        const fly = interpolate(frame - (c1 + d.at), [0, 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        });
        const o = appear * (1 - fly);
        if (o <= 0.01) return null;
        const tx = (pillCx(d.type) - 30 - d.x) * fly;
        const ty = (PILL_Y - DOC_Y) * fly;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: DOC_Y,
              width: 60,
              height: 78,
              borderRadius: 3,
              background: "rgba(232,238,247,0.92)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              padding: "0 9px",
              opacity: o,
              transform: `translate(${tx}px, ${ty}px) scale(${1 - fly * 0.55})`,
            }}
          >
            <span style={{ height: 3, background: "rgba(15,23,42,0.32)" }} />
            <span style={{ height: 3, background: "rgba(15,23,42,0.32)" }} />
            <span style={{ height: 3, width: "58%", background: "rgba(15,23,42,0.32)" }} />
          </div>
        );
      })}

      {reading ? (
        <div
          style={{
            position: "absolute",
            left: scanX,
            top: 336,
            width: 3,
            height: 118,
            background: C.brandLite,
            boxShadow: `0 0 26px ${C.brandLite}`,
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 300,
          fontFamily: MONO,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2.6,
          color: C.onDark3,
          opacity: pIn(frame, c1 - 12, 12),
        }}
      >
        READING THIS WEEK'S DOCUMENTS
      </div>

      {SOURCES.map((s, i) => {
        const filed = DOCS.filter((d) => d.type === i).some((d) => frame > c1 + d.at + 13);
        const p = pIn(frame, c1 - 6 + i * 4, 12);
        return (
          <span
            key={s}
            style={{
              position: "absolute",
              left: PILL_X + i * (PILL_W + 16),
              top: PILL_Y - 26,
              width: PILL_W,
              textAlign: "center",
              border: `1px solid ${filed ? "rgba(96,165,250,0.7)" : C.onDarkLine2}`,
              background: filed ? "rgba(59,130,246,0.16)" : "rgba(148,163,184,0.04)",
              borderRadius: 4,
              padding: "12px 0 14px",
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 1.6,
              color: filed ? C.brandLite : C.onDark3,
              opacity: p,
            }}
          >
            {s}
          </span>
        );
      })}

      {/* 03 the answer */}
      <div
        style={{
          position: "absolute",
          left: 260,
          right: 260,
          top: 662,
          borderRadius: 6,
          border: `1px solid rgba(96,165,250,0.34)`,
          background: "rgba(59,130,246,0.07)",
          padding: "28px 40px 32px",
          opacity: pIn(frame, c2 - 24, 16),
          transform: `translateY(${(1 - pIn(frame, c2 - 24, 16)) * 22}px)`,
          boxShadow: `0 0 ${44 * pIn(frame, c2 - 24, 20)}px rgba(59,130,246,0.22)`,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.onDark3,
            marginBottom: 22,
          }}
        >
          WHAT CHANGED THIS WEEK
        </div>
        {[
          { t: "2 ownership changes", c: "1" },
          { t: "1 guidance cut", c: "2" },
          { t: "1 rating downgrade", c: "3" },
        ].map((h, i) => {
          const p = pIn(frame, c2 - 14 + i * 10, 13);
          return (
            <div
              key={h.c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                marginBottom: i === 2 ? 0 : 18,
                opacity: p,
                transform: `translateX(${(1 - p) * 16}px)`,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 5, background: C.brandLite }} />
              <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.7, color: C.onDark }}>
                {h.t}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.brandLite,
                  background: "rgba(96,165,250,0.18)",
                  borderRadius: 3,
                  padding: "4px 9px 5px",
                }}
              >
                {h.c}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 260,
          top: 952,
          fontFamily: MONO,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2.4,
          color: C.emerald,
          opacity: pIn(frame, c2 + 18, 16),
        }}
      >
        3 SOURCES ATTACHED · EVERY LINE TRACES BACK
      </div>
    </AbsoluteFill>
  );
};
