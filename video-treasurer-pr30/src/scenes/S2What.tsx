import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn } from "../lib";
import { cueAt } from "../timing";
import { Card, CardHead, PAPER, Say, PathTag } from "../ui/Card";

/** 사람이 매주 손으로 하는 일. 우리 제품의 결과물이 아니라 '업무' 자체를 적는다. */
const JOBS = [
  { no: "01", k: "Research", d: "Read the filings. Write the note." },
  { no: "02", k: "Monitoring", d: "Check every holding for changes." },
  { no: "03", k: "Reporting", d: "Fill the same report again." },
];

export const S2What: React.FC = () => {
  const frame = useCurrentFrame();
  cueAt("s-what");

  const pick = pIn(frame, 86, 20);

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

      <Say
        y={368}
        p={pIn(frame, 4, 18)}
        sub="Work that repeats is work an agent can run."
        subP={pIn(frame, 94, 18)}
      >
        Analysts repeat the same
        <br />
        three jobs every week.
      </Say>

      <PathTag p={pIn(frame, 20, 14)}>/ax/agents</PathTag>

      <Card x={880} y={288} w={912} p={pIn(frame, 8, 16)}>
        <CardHead label="THE WEEKLY LOOP" right="DONE BY HAND" />
        <div style={{ padding: "6px 28px 10px" }}>
          {JOBS.map((j, i) => {
            const on = i === 1;
            const p = pIn(frame, 18 + i * 12, 16);
            return (
              <div
                key={j.no}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: "26px 18px",
                  margin: "0 -18px",
                  borderBottom: i === 2 ? "none" : "1px solid #eef2f7",
                  background: on ? `rgba(59,130,246,${pick * 0.08})` : "transparent",
                  borderLeft: on
                    ? `3px solid rgba(59,130,246,${pick})`
                    : "3px solid transparent",
                  opacity: p * (on ? 1 : 1 - pick * 0.5),
                  transform: `translateX(${(1 - p) * 14}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    color: on && pick > 0.3 ? C.brand : C.ink4,
                    width: 34,
                    flex: "0 0 auto",
                  }}
                >
                  {j.no}
                </span>
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    letterSpacing: -1.1,
                    color: C.ink,
                    width: 230,
                    flex: "0 0 auto",
                  }}
                >
                  {j.k}
                </span>
                <span style={{ fontSize: 24, fontWeight: 500, color: C.ink3, letterSpacing: -0.3 }}>
                  {j.d}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 28px 20px",
            borderTop: "1px solid #eef2f7",
            opacity: pIn(frame, 62, 16),
          }}
        >
          <span style={{ fontSize: 19, color: C.ink4 }}>↻</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: C.ink4,
            }}
          >
            SAME LOOP, EVERY WEEK
          </span>
        </div>
      </Card>
    </AbsoluteFill>
  );
};
