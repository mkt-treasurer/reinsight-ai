import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp } from "../../util";
import { reconDocs, reconRows, reconAlert, reconActions } from "../salesData";

const ROWS_FROM = 118;
const ALERT_FROM = 214;
const ACTIONS_FROM = 262;
const MAIL_FROM = 372;

const stateInk = (s: string) =>
  s === "match" ? desk.positive : s === "diff" ? desk.critical : desk.warning;
const stateText = (s: string) => (s === "match" ? "일치" : s === "diff" ? "차이 발생" : "확인 필요");

// 74–91s. After binding: match every document against the money that actually moved.
export const N7Reconciliation: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);

  return (
    <SalesStage phase="RECONCILE">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Reconciliation Center" ko="정청산 및 수수료 대사" />
        <AppWindow
          route="/ins/settlement/reconciliation"
          title="RECON · 정산 대사"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "0.86fr 1.55fr 1.02fr", height: "100%" }}>
            {/* ── collected documents ── */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="DOCUMENTS" sub="자동 수집" />
              <div style={{ padding: "12px 15px" }}>
                {reconDocs.map((d, i) => {
                  const on = 18 + i * 11;
                  const p = ramp(frame, on, 13);
                  const checked = frame >= on + 16;
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "8px 0",
                        borderBottom: `1px solid ${desk.border}`,
                        opacity: p,
                        transform: `translateX(${(1 - p) * 12}px)`,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: `1px solid ${checked ? desk.positive : desk.borderStrong}`,
                          background: checked ? desk.positive : "#fff",
                          color: "#fff",
                          fontSize: 9,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span style={{ fontSize: 12, color: desk.body }}>{d}</span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: "auto",
                  padding: "12px 15px",
                  borderTop: `1px solid ${desk.border}`,
                  fontFamily: font.mono,
                  fontSize: 10.5,
                  color: desk.hint,
                  lineHeight: 1.6,
                }}
              >
                8종 문서 · 자동 분류 완료
                <br />
                한빛로지스 / A 보험사 / 2026-08
              </div>
            </div>

            {/* ── reconciliation table ── */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="RECONCILIATION" sub="계약 기준 vs 실제 정산" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 0.95fr",
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
                <span>항목</span>
                <span style={{ textAlign: "right" }}>계약 기준</span>
                <span style={{ textAlign: "right" }}>실제 정산</span>
                <span style={{ textAlign: "right" }}>상태</span>
              </div>

              {reconRows.map((r, i) => {
                const on = ROWS_FROM + i * 15;
                const p = ramp(frame, on, 15);
                const bad = r.state !== "match";
                const lit = r.state === "diff" && frame >= ALERT_FROM;
                return (
                  <div
                    key={r.item}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 1fr 0.95fr",
                      alignItems: "center",
                      padding: "15px 18px",
                      borderBottom: `1px solid ${desk.border}`,
                      opacity: p,
                      transform: `translateY(${(1 - p) * 10}px)`,
                      background: lit ? "rgba(185,28,28,0.06)" : "transparent",
                      outline: lit ? `2px solid ${desk.critical}` : "none",
                      outlineOffset: -2,
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: desk.ink, fontWeight: 500 }}>{r.item}</span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 13,
                        color: desk.body,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.contract}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 13,
                        fontWeight: bad ? 700 : 400,
                        color: bad ? stateInk(r.state) : desk.body,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.actual}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 9.5,
                          letterSpacing: "0.08em",
                          color: stateInk(r.state),
                          border: `1px solid ${stateInk(r.state)}`,
                          padding: "2px 7px",
                        }}
                      >
                        {stateText(r.state)}
                      </span>
                    </span>
                  </div>
                );
              })}

              {/* discrepancy alert */}
              <div
                style={{
                  margin: "16px 18px",
                  border: `1px solid ${desk.critical}`,
                  background: "rgba(185,28,28,0.05)",
                  padding: "14px 16px",
                  opacity: ramp(frame, ALERT_FROM, 16),
                  transform: `translateY(${(1 - ramp(frame, ALERT_FROM, 16)) * 12}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: desk.critical,
                      display: "inline-block",
                      opacity: Math.floor(frame / 12) % 2 ? 1 : 0.35,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: font.head,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: desk.critical,
                      textTransform: "uppercase",
                    }}
                  >
                    {reconAlert.title}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: desk.ink, fontWeight: 600 }}>{reconAlert.body}</div>
                <div
                  style={{
                    marginTop: 9,
                    fontFamily: font.mono,
                    fontSize: 11,
                    color: desk.meta,
                    opacity: ramp(frame, ALERT_FROM + 26, 14),
                  }}
                >
                  원인 추정 · 정산서 수수료율 12.5% 적용 (계약 15.0%)
                </div>
              </div>
            </div>

            {/* ── automated follow-through ── */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="AUTO ACTIONS" sub="자동 실행" />
              <div style={{ padding: "12px 16px" }}>
                {reconActions.map((a, i) => {
                  const on = ACTIONS_FROM + i * 14;
                  const p = ramp(frame, on, 15);
                  const done = frame >= on + 22;
                  return (
                    <div
                      key={a}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: `1px solid ${desk.border}`,
                        opacity: p,
                        transform: `translateX(${(1 - p) * 10}px)`,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          background: done ? stage.accent : desk.borderStrong,
                          transform: "rotate(45deg)",
                          display: "inline-block",
                          flex: "0 0 auto",
                        }}
                      />
                      <span style={{ fontSize: 12.5, color: desk.body, flex: 1 }}>{a}</span>
                      {done && (
                        <span style={{ fontFamily: font.mono, fontSize: 9, color: desk.positive }}>OK</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* follow-up email */}
              <div style={{ padding: "6px 16px 16px", marginTop: "auto" }}>
                <div
                  style={{
                    background: stage.accent,
                    color: "#fff",
                    fontFamily: font.head,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "11px 14px",
                    textTransform: "uppercase",
                    textAlign: "center",
                    opacity: ramp(frame, MAIL_FROM, 14),
                    transform: `scale(${
                      frame >= MAIL_FROM + 20 && frame < MAIL_FROM + 28 ? 0.96 : 1
                    })`,
                  }}
                >
                  Draft Follow-up Email
                </div>
                <div
                  style={{
                    marginTop: 11,
                    border: `1px solid ${desk.border}`,
                    padding: "11px 12px",
                    opacity: ramp(frame, MAIL_FROM + 30, 16),
                  }}
                >
                  <div style={{ fontFamily: font.mono, fontSize: 10, color: desk.hint, marginBottom: 6 }}>
                    To. A 보험사 정산팀
                  </div>
                  <div style={{ fontSize: 12, color: desk.body, lineHeight: 1.65 }}>
                    2026-08 정산분 중개수수료가 계약 요율 15.0% 대비 12.5%로 산정되어 600만 원 차이가
                    확인됩니다. 재정산 부탁드립니다.
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      paddingTop: 8,
                      borderTop: `1px solid ${desk.border}`,
                      fontFamily: font.mono,
                      fontSize: 9.5,
                      color: desk.hint,
                    }}
                  >
                    담당 배정 · 회수 예정일 2026-09-12
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption
        text="차이가 발생하면 원인을 분석하고, 담당자에게 알리며, 확인 이메일까지 자동으로 작성합니다"
        start={430}
      />
    </SalesStage>
  );
};
