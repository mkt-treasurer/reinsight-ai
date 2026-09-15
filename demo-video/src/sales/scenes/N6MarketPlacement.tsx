import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, countUp } from "../../util";
import { marketRows, marketDetail, placementStages, placementCurrent } from "../salesData";

// 62–74s. Which markets will actually take this risk, and where the deal stands.
export const N6MarketPlacement: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);

  return (
    <SalesStage phase="PLACE">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Market Placement" ko="보험사 및 재보험사 배치 전략" />
        <AppWindow
          route="/ins/sales/placement"
          title="PLACEMENT · 배치 전략"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1.42fr 1fr", height: 366 }}>
            {/* market fit table */}
            <div style={{ borderRight: `1px solid ${desk.border}` }}>
              <CardHead title="MARKET FIT" sub="인수 선호도 · 예상 Capacity" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 78px 92px 1.35fr",
                  padding: "9px 18px",
                  borderBottom: `1px solid ${desk.border}`,
                  fontSize: 9.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: desk.meta,
                  fontFamily: font.head,
                  fontWeight: 700,
                }}
              >
                <span>보험사 · 재보험사</span>
                <span>구분</span>
                <span style={{ textAlign: "right" }}>적합도</span>
                <span style={{ textAlign: "right" }}>Capacity</span>
                <span style={{ paddingLeft: 20 }}>주요 특징</span>
              </div>

              {marketRows.map((r, i) => {
                const on = 20 + i * 16;
                const p = ramp(frame, on, 16);
                const fit = countUp(frame, on + 4, 26, r.fit);
                const lead = i === 0;
                return (
                  <div
                    key={r.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 70px 78px 92px 1.35fr",
                      alignItems: "center",
                      padding: "16px 18px",
                      borderBottom: `1px solid ${desk.border}`,
                      opacity: p,
                      transform: `translateX(${(1 - p) * 14}px)`,
                      background: lead && frame >= 120 ? "rgba(59,130,246,0.06)" : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: desk.ink }}>{r.name}</span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 9.5,
                        letterSpacing: "0.08em",
                        background: "#f1f5f9",
                        color: desk.body,
                        padding: "2px 6px",
                        justifySelf: "start",
                      }}
                    >
                      {r.kind}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 22,
                        fontWeight: 700,
                        color: lead ? stage.accent : desk.ink,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Math.round(fit)}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 13,
                        color: desk.body,
                        textAlign: "right",
                      }}
                    >
                      {r.cap}
                    </span>
                    <span style={{ fontSize: 12.5, color: desk.body, paddingLeft: 20 }}>{r.note}</span>
                  </div>
                );
              })}

              <div
                style={{
                  padding: "14px 18px",
                  fontFamily: font.mono,
                  fontSize: 11,
                  color: desk.hint,
                }}
              >
                필요 Capacity 1,200억 · 확보 가능 1,600억 (충족)
              </div>
            </div>

            {/* submission detail */}
            <div>
              <CardHead title="SUBMISSION DETAIL" sub="A 보험사 (Lead 후보)" />
              <div style={{ padding: "12px 18px" }}>
                {marketDetail.map((d, i) => {
                  const p = ramp(frame, 74 + i * 12, 15);
                  return (
                    <div
                      key={d.k}
                      style={{
                        padding: "10px 0",
                        borderBottom: `1px solid ${desk.border}`,
                        opacity: p,
                        transform: `translateY(${(1 - p) * 8}px)`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: desk.hint, marginBottom: 4 }}>{d.k}</div>
                      <div style={{ fontSize: 13, color: desk.ink, fontWeight: 500 }}>{d.v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* placement workflow rail */}
          <div style={{ borderTop: `1px solid ${desk.border}` }}>
            <CardHead title="PLACEMENT WORKFLOW" sub="업무 단계" />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "26px 24px",
              }}
            >
              {placementStages.map((s, i) => {
                const on = 150 + i * 13;
                const p = ramp(frame, on, 14);
                const done = i < placementCurrent;
                const now = i === placementCurrent;
                const ink = now ? stage.accent : done ? desk.masthead : desk.hint;
                return (
                  <React.Fragment key={s}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                        opacity: p,
                        flex: "0 0 auto",
                        width: 148,
                      }}
                    >
                      <div
                        style={{
                          width: now ? 18 : 13,
                          height: now ? 18 : 13,
                          background: done || now ? ink : "#fff",
                          border: `2px solid ${ink}`,
                          borderRadius: "50%",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 10.5,
                          color: ink,
                          fontWeight: now ? 700 : 400,
                          textAlign: "center",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {s}
                      </span>
                      {now && (
                        <span
                          style={{
                            fontFamily: font.mono,
                            fontSize: 9,
                            letterSpacing: "0.14em",
                            color: "#fff",
                            background: stage.accent,
                            padding: "2px 7px",
                          }}
                        >
                          NOW
                        </span>
                      )}
                    </div>
                    {i < placementStages.length - 1 && (
                      <div
                        style={{
                          flex: 1,
                          height: 2,
                          background: "#e2e8f0",
                          marginTop: -26,
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: `${ramp(frame, on + 6, 12) * (i < placementCurrent ? 100 : 0)}%`,
                            background: desk.masthead,
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption
        text="인수 선호도 · 예상 Capacity · 유사 인수 사례를 분석해 최적의 배치 전략을 제안합니다"
        start={252}
      />
    </SalesStage>
  );
};
