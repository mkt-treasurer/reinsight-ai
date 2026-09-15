import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead, Pill } from "../../ui/primitives";
import { CalloutLabel } from "../../stage/Emphasis";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, countUp } from "../../util";
import { accountKpis, accountFirm, accountPolicies, accountAi } from "../salesData";

const GAP_FROM = 196;

const statusInk = (s: string) =>
  s === "gap" ? desk.critical : s === "renew" ? desk.warning : desk.positive;
const statusText = (s: string) => (s === "gap" ? "보장 공백" : s === "renew" ? "갱신 예정" : "유지");

// 20–34s. One customer, one screen: firm profile, in-force policies, AI read.
export const N3Account360: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);

  return (
    <SalesStage phase="DISCOVER">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Account 360" ko="보험계약자 통합 대시보드" />
        <AppWindow
          route="/ins/sales/accounts/hanbit-logis"
          title="ACCOUNT · 한빛로지스"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 1,
              background: desk.border,
              borderBottom: `1px solid ${desk.border}`,
            }}
          >
            {accountKpis.map((k, i) => {
              const on = 16 + i * 8;
              const v = countUp(frame, on, 32, k.value);
              const ink =
                k.tone === "accent"
                  ? stage.accent
                  : k.tone === "warning"
                    ? desk.warning
                    : k.tone === "positive"
                      ? desk.positive
                      : desk.ink;
              return (
                <div key={k.label} style={{ background: desk.bg, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontFamily: font.head,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        color: desk.body,
                      }}
                    >
                      {k.label}
                    </span>
                    <span style={{ fontSize: 10, color: desk.hint }}>{k.ko}</span>
                  </div>
                  <div
                    style={{
                      fontFamily: font.mono,
                      fontSize: 34,
                      fontWeight: 700,
                      color: ink,
                      letterSpacing: "-0.02em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {k.prefix ?? ""}
                    {Math.round(v).toLocaleString()}
                    <span style={{ fontSize: 20 }}>{k.suffix ?? ""}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* three columns: firm · policies · AI */}
          <div style={{ display: "grid", gridTemplateColumns: "0.92fr 1.5fr 1.1fr", height: 396 }}>
            {/* firm profile */}
            <div style={{ borderRight: `1px solid ${desk.border}` }}>
              <CardHead title="COMPANY" sub="기업 정보" />
              <div style={{ padding: "12px 16px" }}>
                {accountFirm.map((f, i) => {
                  const p = ramp(frame, 52 + i * 9, 14);
                  return (
                    <div
                      key={f.k}
                      style={{
                        padding: "9px 0",
                        borderBottom: `1px solid ${desk.border}`,
                        opacity: p,
                        transform: `translateY(${(1 - p) * 8}px)`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: desk.hint, marginBottom: 3 }}>{f.k}</div>
                      <div style={{ fontSize: 13, color: desk.ink, fontWeight: 500 }}>{f.v}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* in-force policies */}
            <div style={{ borderRight: `1px solid ${desk.border}`, position: "relative" }}>
              <CardHead title="IN-FORCE POLICIES" sub="기존 보험계약 · 만기 · 보험료" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.25fr 0.85fr 0.9fr 0.62fr 0.72fr",
                  padding: "8px 16px",
                  borderBottom: `1px solid ${desk.border}`,
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: desk.meta,
                  fontFamily: font.head,
                  fontWeight: 700,
                }}
              >
                <span>종목</span>
                <span>보험사</span>
                <span>만기</span>
                <span style={{ textAlign: "right" }}>보험료</span>
                <span style={{ textAlign: "right" }}>상태</span>
              </div>
              {accountPolicies.map((p, i) => {
                const on = 84 + i * 11;
                const op = ramp(frame, on, 14);
                const isGap = p.status === "gap";
                const lit = isGap && frame >= GAP_FROM;
                return (
                  <div
                    key={p.line}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.25fr 0.85fr 0.9fr 0.62fr 0.72fr",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: `1px solid ${desk.border}`,
                      opacity: op,
                      transform: `translateX(${(1 - op) * 12}px)`,
                      background: lit ? "rgba(185,28,28,0.06)" : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: desk.ink, fontWeight: 500 }}>{p.line}</span>
                    <span style={{ fontSize: 12, color: desk.body }}>{p.insurer}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 11, color: desk.meta }}>{p.expiry}</span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 12,
                        color: desk.ink,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {p.premium}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 9.5,
                          letterSpacing: "0.08em",
                          color: statusInk(p.status),
                          border: `1px solid ${statusInk(p.status)}`,
                          padding: "2px 6px",
                        }}
                      >
                        {statusText(p.status)}
                      </span>
                    </span>
                  </div>
                );
              })}

              <div
                style={{
                  padding: "72px 16px 12px",
                  fontFamily: font.mono,
                  fontSize: 11,
                  color: desk.hint,
                }}
              >
                과거 5년 사고 4건 · 최대 지급 2.1억 (2024 냉동설비 고장)
              </div>

              {frame >= GAP_FROM && (
                <CalloutLabel
                  text="미가입 2종목 · 보장 공백"
                  left={300}
                  top={296}
                  start={GAP_FROM}
                  dir="up"
                  align="left"
                />
              )}
            </div>

            {/* AI read */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="AI ANALYSIS" sub="제안 우선순위" />
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {accountAi.map((line, i) => {
                  const p = ramp(frame, 140 + i * 24, 20);
                  return (
                    <div
                      key={i}
                      style={{
                        border: `1px solid ${stage.accent}`,
                        background: "rgba(59,130,246,0.05)",
                        padding: "12px 13px",
                        opacity: p,
                        transform: `translateY(${(1 - p) * 12}px)`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            background: stage.accent,
                            transform: "rotate(45deg)",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: font.head,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.18em",
                            color: desk.link,
                          }}
                        >
                          AI · 제안 {i + 1}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: desk.body, lineHeight: 1.6 }}>{line}</div>
                    </div>
                  );
                })}

                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: ramp(frame, 214, 16),
                  }}
                >
                  <Pill tone="critical">ACTION</Pill>
                  <span style={{ fontSize: 12, color: desk.body }}>재산 + 기업휴지 우선 제안</span>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption
        text="기업 정보 · 기존 계약 · 갱신 일정 · 과거 클레임 · 예상 보험료를 한 화면에서"
        start={236}
      />
    </SalesStage>
  );
};
