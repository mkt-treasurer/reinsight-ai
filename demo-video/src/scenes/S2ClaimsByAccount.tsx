import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead, Dot } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { accounts } from "../data";
import { fadeUp, krCurrency, ramp } from "../util";

const TOGGLE_AT = 96;

export const S2ClaimsByAccount: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const toggled = frame >= TOGGLE_AT;
  const knob = interpolate(frame, [TOGGLE_AT, TOGGLE_AT + 10], [0, 22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shownTotal = Math.round(interpolate(frame, [TOGGLE_AT + 6, TOGGLE_AT + 26], [48, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <>
    <Stage lang={lang} sceneIndex={1} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <AppWindow route="/ins/claims/by-account" title="CLAIMS · 계정별 대사" style={{ height: 640, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ padding: 22 }}>
            {/* controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 800, color: desk.ink }}>Claims by Account</div>
                <div style={{ fontSize: 12, color: desk.hint, marginTop: 2 }}>SOC ↔ 원장 대사 · 이번 달 {shownTotal}건 표시</div>
              </div>
              {/* toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: toggled ? desk.ink : desk.meta, fontWeight: toggled ? 700 : 400 }}>차이 있는 건만</span>
                <div style={{ width: 46, height: 24, borderRadius: 12, background: toggled ? stage.accent : "#cbd5e1", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transform: `translateX(${knob}px)`, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </div>
            </div>

            {/* table */}
            <div style={{ border: `1px solid ${desk.border}` }}>
              <CardHead title="ACCOUNTS" sub="원수사 / 재보험사 · 라인" />
              <div style={{ display: "grid", gridTemplateColumns: "24px 2.3fr 1.2fr 1fr 1fr 0.9fr", padding: "8px 16px", borderBottom: `1px solid ${desk.border}`, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: desk.meta }}>
                <span /><span>ACCOUNT</span><span>LINE</span><span style={{ textAlign: "right" }}>TOTAL</span><span style={{ textAlign: "right" }}>OPEN</span><span style={{ textAlign: "right" }}>DIFF</span>
              </div>
              {accounts.map((a, i) => {
                const hasDiff = a.diff !== 0;
                const collapse = toggled && !hasDiff;
                const h = interpolate(frame, [TOGGLE_AT, TOGGLE_AT + 12], [44, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const rowIn = ramp(frame, 16 + i * 5, 14);
                return (
                  <div
                    key={a.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 2.3fr 1.2fr 1fr 1fr 0.9fr",
                      alignItems: "center",
                      padding: collapse ? `0 16px` : "0 16px",
                      height: collapse ? h : 44,
                      overflow: "hidden",
                      borderBottom: `1px solid ${desk.border}`,
                      opacity: collapse ? interpolate(frame, [TOGGLE_AT, TOGGLE_AT + 8], [1, 0], { extrapolateRight: "clamp" }) : rowIn,
                      background: hasDiff && toggled ? "rgba(185,28,28,0.03)" : "#fff",
                    }}
                  >
                    <Dot sev={hasDiff ? "critical" : "info"} />
                    <span style={{ fontSize: 13, color: desk.ink, fontWeight: 500 }}>{a.name}</span>
                    <span style={{ fontSize: 12, color: desk.meta }}>{a.line}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: desk.ink, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{krCurrency(a.total, a.cur)}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: desk.body, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{krCurrency(a.open, a.cur)}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, textAlign: "right", fontWeight: 700, color: hasDiff ? desk.critical : desk.hint, fontVariantNumeric: "tabular-nums" }}>
                      {hasDiff ? (a.diff > 0 ? "+" : "") + krCurrency(a.diff, a.cur) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, fontFamily: font.mono, fontSize: 11, color: desk.hint }}>
              {toggled ? "필터: 불일치 6건 — 나머지 42건은 자동 대사 일치" : "전체 48건 — SOC/원장 자동 대사 완료"}
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s2, lang)} start={TOGGLE_AT + 4} />
    </Stage>
    <SceneEmphasis from={TOGGLE_AT + 14} text="SOC↔원장 차이 6건만" left={1520} top={286} />
    </>
  );
};
