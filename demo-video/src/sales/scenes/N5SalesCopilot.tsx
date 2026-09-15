import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, pop, typed } from "../../util";
import {
  copilotProducts,
  copilotStrategy,
  copilotDecisionMakers,
  copilotAgenda,
  copilotEmail,
} from "../salesData";

const FPS = 30;
const CLICK = 30; // "Generate Sales Strategy" pressed
const RESULT = CLICK + 14;
const MAIL_CLICK = 236;
const MAIL_TYPE = MAIL_CLICK + 14;

// 48–62s. One click turns the account read into products, arguments, agenda and an email.
export const N5SalesCopilot: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);
  const pressed = frame >= CLICK && frame < CLICK + 8;
  const mailPressed = frame >= MAIL_CLICK && frame < MAIL_CLICK + 8;

  return (
    <SalesStage phase="CONNECT">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="AI Sales Copilot" ko="AI 영업 전략 생성" />
        <AppWindow
          route="/ins/sales/copilot"
          title="COPILOT · 영업 전략"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          {/* action bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "11px 18px",
              borderBottom: `1px solid ${desk.border}`,
              background: desk.headerBar,
            }}
          >
            <span style={{ fontSize: 12, color: desk.meta }}>대상 ·</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: desk.ink }}>한빛로지스</span>
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 10,
                color: desk.hint,
                border: `1px solid ${desk.border}`,
                padding: "2px 7px",
              }}
            >
              OPPORTUNITY 92
            </span>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  background: frame >= CLICK ? desk.masthead : stage.accent,
                  color: "#fff",
                  fontFamily: font.head,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  padding: "9px 18px",
                  textTransform: "uppercase",
                  transform: `scale(${pressed ? 0.95 : 1})`,
                }}
              >
                {frame >= RESULT ? "Regenerate" : "Generate Sales Strategy"}
              </div>
              {frame >= CLICK && frame < RESULT && (
                <span style={{ fontFamily: font.mono, fontSize: 11, color: desk.link }}>분석 중…</span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr 1.12fr", height: 455 }}>
            {/* products + strategy */}
            <div style={{ borderRight: `1px solid ${desk.border}` }}>
              <CardHead title="RECOMMENDED LINES" sub="추천 보험상품" />
              <div style={{ padding: "13px 16px", display: "flex", flexWrap: "wrap", gap: 7 }}>
                {copilotProducts.map((p, i) => {
                  const s = pop(frame, RESULT + i * 6, FPS);
                  const key = i < 2;
                  return (
                    <span
                      key={p}
                      style={{
                        fontFamily: font.mono,
                        fontSize: 11,
                        padding: "6px 10px",
                        border: `1px solid ${key ? stage.accent : desk.borderStrong}`,
                        background: key ? "rgba(59,130,246,0.07)" : "#fff",
                        color: key ? desk.link : desk.body,
                        opacity: s,
                        transform: `translateY(${(1 - s) * 8}px)`,
                      }}
                    >
                      {p}
                    </span>
                  );
                })}
              </div>

              <div style={{ borderTop: `1px solid ${desk.border}` }}>
                <CardHead title="SALES ARGUMENT" sub="영업 전략" />
                <div style={{ padding: "12px 16px" }}>
                  {copilotStrategy.map((s, i) => {
                    const on = RESULT + 40 + i * 13;
                    const p = ramp(frame, on, 15);
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "8px 0",
                          borderBottom: `1px solid ${desk.border}`,
                          opacity: p,
                          transform: `translateY(${(1 - p) * 8}px)`,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: font.mono,
                            fontSize: 10,
                            color: stage.accent,
                            fontWeight: 700,
                            flex: "0 0 auto",
                            paddingTop: 2,
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: 12.5, color: desk.body, lineHeight: 1.55 }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* decision makers + agenda */}
            <div style={{ borderRight: `1px solid ${desk.border}` }}>
              <CardHead title="DECISION MAKERS" sub="추천 접촉 대상" />
              <div style={{ padding: "13px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
                {copilotDecisionMakers.map((d, i) => {
                  const p = ramp(frame, RESULT + 20 + i * 10, 14);
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: `1px solid ${desk.border}`,
                        padding: "9px 12px",
                        opacity: p,
                        transform: `translateX(${(1 - p) * 10}px)`,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          background: i === 0 ? stage.accent : "#f1f5f9",
                          color: i === 0 ? "#fff" : desk.body,
                          fontFamily: font.mono,
                          fontSize: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: desk.ink, fontWeight: 500 }}>{d}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: `1px solid ${desk.border}` }}>
                <CardHead title="MEETING AGENDA" sub="추천 미팅 아젠다" />
                <div style={{ padding: "12px 16px" }}>
                  {copilotAgenda.map((a, i) => {
                    const on = RESULT + 74 + i * 12;
                    const p = ramp(frame, on, 14);
                    return (
                      <div
                        key={a}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "7px 0",
                          borderBottom: `1px solid ${desk.border}`,
                          opacity: p,
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            border: `1px solid ${desk.borderStrong}`,
                            flex: "0 0 auto",
                          }}
                        />
                        <span style={{ fontSize: 12.5, color: desk.body }}>{a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* email draft */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="INTRODUCTION EMAIL" sub="맞춤형 이메일 초안" />
              <div style={{ padding: "13px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    background: mailPressed ? desk.masthead : frame >= MAIL_CLICK ? "#f1f5f9" : stage.accent,
                    color: frame >= MAIL_CLICK && !mailPressed ? desk.body : "#fff",
                    fontFamily: font.head,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "9px 14px",
                    textTransform: "uppercase",
                    textAlign: "center",
                    transform: `scale(${mailPressed ? 0.96 : 1})`,
                    opacity: ramp(frame, MAIL_CLICK - 26, 14),
                  }}
                >
                  Generate Introduction Email
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: `1px solid ${desk.border}`,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    opacity: ramp(frame, MAIL_TYPE - 6, 12),
                  }}
                >
                  <div
                    style={{
                      padding: "9px 13px",
                      borderBottom: `1px solid ${desk.border}`,
                      background: desk.headerBar,
                    }}
                  >
                    <div style={{ fontFamily: font.mono, fontSize: 10, color: desk.hint }}>
                      To. 박지훈 CFO · 한빛로지스
                    </div>
                    <div style={{ fontSize: 12, color: desk.ink, fontWeight: 600, marginTop: 4 }}>
                      신규 물류센터 리스크 및 보장 공백 검토 제안
                    </div>
                  </div>
                  <div style={{ padding: "13px 14px", fontSize: 12.5, color: desk.body, lineHeight: 1.75 }}>
                    {copilotEmail.map((l, i) => {
                      const start = MAIL_TYPE + i * 26;
                      return (
                        <div key={i} style={{ minHeight: 22 }}>
                          {typed(l, frame, start, 46, FPS)}
                          {frame >= start && frame < start + 30 && (
                            <span
                              style={{
                                borderLeft: `2px solid ${stage.accent}`,
                                marginLeft: 1,
                                opacity: Math.floor(frame / 8) % 2 ? 1 : 0.2,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      marginTop: "auto",
                      padding: "9px 13px",
                      borderTop: `1px solid ${desk.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: ramp(frame, MAIL_TYPE + 116, 16),
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        background: stage.accent,
                        transform: "rotate(45deg)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontFamily: font.mono, fontSize: 10, color: desk.hint }}>
                      김태현 이사 소개 요청 문구 포함 · 검수 후 발송
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>

        {/* click cursor — coords are frame-space (window top sits at y≈286) */}
        <Cursor frame={frame} at={CLICK} x={1700} y={372} />
        <Cursor frame={frame} at={MAIL_CLICK} x={1500} y={458} />
      </AbsoluteFill>
      <SalesCaption
        text="추천 보험상품 · 영업 논리 · 미팅 아젠다 · 맞춤형 이메일을 자동으로 생성합니다"
        start={330}
      />
    </SalesStage>
  );
};

// Small pointer that glides in, clicks, and leaves.
const Cursor: React.FC<{ frame: number; at: number; x: number; y: number }> = ({ frame, at, x, y }) => {
  const inP = interpolate(frame, [at - 22, at], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [at + 16, at + 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < at - 22 || frame > at + 30) return null;
  const press = frame >= at && frame < at + 8 ? 0.85 : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + (1 - inP) * 26,
        opacity: inP * out,
        transform: `scale(${press})`,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <svg width={22} height={26} viewBox="0 0 22 26">
        <path d="M2 1 L2 20 L7 15.5 L10.5 24 L14 22.4 L10.6 14.2 L17.5 14 Z" fill="#0f172a" stroke="#fff" strokeWidth={1.4} />
      </svg>
      {frame >= at && frame < at + 12 && (
        <div
          style={{
            position: "absolute",
            left: -12,
            top: -12,
            width: 40,
            height: 40,
            border: `2px solid ${stage.accent}`,
            borderRadius: "50%",
            opacity: interpolate(frame, [at, at + 12], [0.8, 0], { extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(frame, [at, at + 12], [0.4, 1.5], { extrapolateRight: "clamp" })})`,
          }}
        />
      )}
    </div>
  );
};
