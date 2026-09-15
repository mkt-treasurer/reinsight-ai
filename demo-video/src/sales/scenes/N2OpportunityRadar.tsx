import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, countUp } from "../../util";
import { radarRows, radarEvents, radarWhyNow } from "../salesData";

// 7–20s. Ranked opportunity list → the signals behind the top row → AI "why now".
export const N2OpportunityRadar: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);

  return (
    <SalesStage phase="DISCOVER">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Opportunity Radar" ko="보험 영업기회 탐지" />
        <AppWindow
          route="/ins/sales/radar"
          title="RADAR · 영업기회 탐지"
          style={{ height: 515, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1.32fr 1fr", height: "100%" }}>
            {/* ── ranked opportunities ── */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="OPPORTUNITY SCORE" sub="외부 신호 기반 랭킹" />

              {/* table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 88px 1.5fr 1.15fr",
                  padding: "9px 18px",
                  borderBottom: `1px solid ${desk.border}`,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: desk.meta,
                  fontFamily: font.head,
                  fontWeight: 700,
                }}
              >
                <span>기업명</span>
                <span style={{ textAlign: "right" }}>SCORE</span>
                <span style={{ paddingLeft: 22 }}>주요 신호</span>
                <span>예상 보험</span>
              </div>

              {radarRows.map((r, i) => {
                const on = 22 + i * 16;
                const p = ramp(frame, on, 16);
                const score = countUp(frame, on + 4, 26, r.score);
                const lit = r.focus && frame >= 128;
                return (
                  <div
                    key={r.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 88px 1.5fr 1.15fr",
                      alignItems: "center",
                      padding: "15px 18px",
                      borderBottom: `1px solid ${desk.border}`,
                      opacity: p,
                      transform: `translateX(${(1 - p) * 14}px)`,
                      background: lit ? "rgba(59,130,246,0.07)" : "transparent",
                      outline: lit ? `2px solid ${stage.accent}` : "none",
                      outlineOffset: -2,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: desk.ink }}>{r.name}</span>
                      {lit && (
                        <span
                          style={{
                            fontFamily: font.mono,
                            fontSize: 9,
                            letterSpacing: "0.14em",
                            background: stage.accent,
                            color: "#fff",
                            padding: "2px 7px",
                          }}
                        >
                          신규 수요 신호
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 24,
                        fontWeight: 700,
                        color: r.focus ? stage.accent : desk.ink,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(score)}
                    </span>
                    <span style={{ fontSize: 13, color: desk.body, paddingLeft: 22 }}>{r.signal}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 11, color: desk.meta }}>{r.need}</span>
                  </div>
                );
              })}

              {/* score bars */}
              <div style={{ padding: "18px 18px 0" }}>
                {radarRows.map((r, i) => {
                  const w = ramp(frame, 40 + i * 12, 28) * r.score;
                  return (
                    <div key={r.name} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 10,
                          color: desk.hint,
                          marginBottom: 4,
                          fontFamily: font.mono,
                        }}
                      >
                        <span>{r.name}</span>
                        <span>{r.score}</span>
                      </div>
                      <div style={{ height: 8, background: "#f1f5f9" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${w}%`,
                            background: r.focus ? stage.accent : desk.chartNeutral2,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: "auto",
                  padding: "12px 18px",
                  fontFamily: font.mono,
                  fontSize: 11,
                  color: desk.hint,
                  borderTop: `1px solid ${desk.border}`,
                }}
              >
                스캔 대상 3,180개사 · 신호 수집 09:12 기준
              </div>
            </div>

            {/* ── signal detail for 한빛로지스 ── */}
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              <CardHead title="COMPANY EVENTS" sub="한빛로지스" />
              <div style={{ padding: "14px 18px" }}>
                {radarEvents.map((e, i) => {
                  const on = 74 + i * 11;
                  const p = ramp(frame, on, 14);
                  return (
                    <div
                      key={e.ko}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: "10px 0",
                        borderBottom: `1px solid ${desk.border}`,
                        opacity: p,
                        transform: `translateY(${(1 - p) * 10}px)`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          background: "#f1f5f9",
                          color: desk.body,
                          padding: "3px 7px",
                          width: 60,
                          textAlign: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        {e.tag}
                      </span>
                      <span style={{ fontSize: 13, color: desk.ink, flex: 1 }}>{e.ko}</span>
                      <span style={{ fontFamily: font.mono, fontSize: 10, color: desk.hint }}>{e.meta}</span>
                    </div>
                  );
                })}
              </div>

              {/* AI why-now */}
              <div
                style={{
                  margin: "8px 18px 18px",
                  border: `1px solid ${stage.accent}`,
                  background: "rgba(59,130,246,0.05)",
                  opacity: ramp(frame, 138, 18),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderBottom: `1px solid rgba(59,130,246,0.28)`,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      background: stage.accent,
                      transform: "rotate(45deg)",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: font.head,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      color: desk.link,
                    }}
                  >
                    AI · WHY NOW?
                  </span>
                </div>
                <div style={{ padding: "12px 14px", fontSize: 13, color: desk.body, lineHeight: 1.6 }}>
                  {radarWhyNow}
                </div>
              </div>

            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption
        text="투자 · 사업장 신설 · 해외 진출 · M&A 신호를 분석해 새로운 보험 영업기회를 탐색합니다"
        start={200}
      />
    </SalesStage>
  );
};
