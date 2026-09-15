import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, countUp } from "../../util";
import { revenueKpis, pipeline, nextActions } from "../salesData";

const toneInk = (t: string) =>
  t === "accent"
    ? stage.accent
    : t === "warning"
      ? desk.warning
      : t === "critical"
        ? desk.critical
        : t === "positive"
          ? desk.positive
          : desk.ink;

// 91–105s. What the management team sees: pipeline, revenue, leakage, next actions.
export const N8RevenueDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);
  const maxN = pipeline[0].n;

  return (
    <SalesStage phase="RECONCILE">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Revenue Intelligence" ko="경영진 통합 대시보드" />
        <AppWindow
          route="/ins/sales/revenue"
          title="EXECUTIVE · 매출 인텔리전스"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          {/* KPI row — 6 tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6,1fr)",
              gap: 1,
              background: desk.border,
              borderBottom: `1px solid ${desk.border}`,
            }}
          >
            {revenueKpis.map((k, i) => {
              const on = 14 + i * 7;
              const v = countUp(frame, on, 32, k.value);
              const dec = k.dec ?? 0;
              return (
                <div key={k.label} style={{ background: desk.bg, padding: "14px 15px" }}>
                  <div
                    style={{
                      fontFamily: font.head,
                      fontSize: 8.5,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: desk.body,
                      marginBottom: 3,
                    }}
                  >
                    {k.label}
                  </div>
                  <div style={{ fontSize: 9.5, color: desk.hint, marginBottom: 9 }}>{k.ko}</div>
                  <div
                    style={{
                      fontFamily: font.mono,
                      fontSize: 30,
                      fontWeight: 700,
                      color: toneInk(k.tone),
                      letterSpacing: "-0.02em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {dec ? v.toFixed(dec) : Math.round(v).toLocaleString()}
                    <span style={{ fontSize: 17 }}>{k.suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", height: 396 }}>
            {/* pipeline funnel */}
            <div style={{ borderRight: `1px solid ${desk.border}` }}>
              <CardHead title="PIPELINE" sub="Lead → Reconciliation Complete" />
              <div style={{ padding: "16px 22px" }}>
                {pipeline.map((p, i) => {
                  const on = 60 + i * 11;
                  const w = ramp(frame, on, 26) * (p.n / maxN);
                  const last = i === pipeline.length - 1;
                  return (
                    <div key={p.stage} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 12, color: desk.body, fontWeight: 500 }}>{p.stage}</span>
                        <span
                          style={{
                            fontFamily: font.mono,
                            fontSize: 13,
                            color: last ? stage.accent : desk.ink,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {Math.round(ramp(frame, on, 26) * p.n)}건
                        </span>
                      </div>
                      <div style={{ height: 15, background: "#f1f5f9" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${w * 100}%`,
                            background: last
                              ? stage.accent
                              : i >= 4
                                ? desk.masthead
                                : desk.chartNeutral2,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: font.mono,
                    fontSize: 11,
                    color: desk.hint,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>전환율 Lead → Bound 15.8%</span>
                  <span>refreshed 09:04:12</span>
                </div>
              </div>
            </div>

            {/* next best actions */}
            <div>
              <CardHead title="NEXT BEST ACTIONS" sub="AI 추천 우선 조치" />
              <div style={{ padding: "14px 18px" }}>
                {nextActions.map((a, i) => {
                  const on = 168 + i * 15;
                  const p = ramp(frame, on, 16);
                  const ink = toneInk(a.tone);
                  const top = i === 0;
                  return (
                    <div
                      key={a.ko}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: "13px 13px",
                        marginBottom: 8,
                        border: `1px solid ${top ? stage.accent : desk.border}`,
                        background: top ? "rgba(59,130,246,0.05)" : "#fff",
                        opacity: p,
                        transform: `translateX(${(1 - p) * 14}px)`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 10,
                          fontWeight: 700,
                          color: ink,
                          width: 16,
                          flex: "0 0 auto",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 13, color: desk.ink, flex: 1, fontWeight: top ? 600 : 400 }}>
                        {a.ko}
                      </span>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: ink,
                          flex: "0 0 auto",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption
        text="신규 영업기회 · 예상 매출 · 갱신 계약 · 미수수료 · 정산 오류를 하나의 대시보드에서"
        start={266}
      />
    </SalesStage>
  );
};
