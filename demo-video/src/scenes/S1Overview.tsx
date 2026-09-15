import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { CardHead, Dot, Pill } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { overviewKpis, riskAlerts } from "../data";
import { countUp, fadeUp, ramp } from "../util";
import { CalloutLabel, dim } from "../stage/Emphasis";

// Emphasis beat: after KPIs settle, spotlight the discrepancy tile.
const EMPH_FROM = 58;
const EMPH_TO = 132;

export const S1Overview: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  return (
    <Stage lang={lang} sceneIndex={0} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 96px", justifyContent: "center" }}>
        <AppWindow route="/ins" title="OVERVIEW · 정산 관제" style={{ height: 660, transform: `translateY(${fadeUp(frame, 4, 22, 20).translateY}px)`, opacity: fadeUp(frame, 4, 22).opacity }}>
          <div style={{ padding: 22 }}>
            {/* KPI row */}
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: desk.border, border: `1px solid ${desk.border}` }}>
              {overviewKpis.map((k, i) => {
                const start = 14 + i * 8;
                const val = countUp(frame, start, 34, k.value);
                const ink = k.tone === "critical" ? desk.critical : k.tone === "warning" ? desk.warning : k.tone === "positive" ? desk.positive : desk.ink;
                const focused = k.tone === "critical";
                return (
                  <div key={k.label} style={{ background: desk.bg, padding: "16px 18px", opacity: dim(frame, EMPH_FROM, EMPH_TO, focused), outline: focused && frame >= EMPH_FROM && frame <= EMPH_TO ? `2px solid ${stage.accent}` : "none", outlineOffset: -2, transition: "opacity 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontFamily: font.head, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: desk.body }}>{k.label}</span>
                      <span style={{ fontSize: 10, color: desk.hint }}>{k.ko}</span>
                      {k.action && <span style={{ marginLeft: "auto" }}><Pill tone="critical">ACTION</Pill></span>}
                    </div>
                    <div style={{ fontFamily: font.mono, fontSize: 40, fontWeight: 700, color: ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                      {k.prefix ?? ""}{Math.round(val).toLocaleString()}{k.suffix ?? ""}
                    </div>
                    {k.delta && (
                      <div style={{ fontFamily: font.mono, fontSize: 11, color: desk.positive, marginTop: 4 }}>
                        {k.delta}일 vs 지난달 ▼
                      </div>
                    )}
                  </div>
                );
              })}
              {frame >= EMPH_FROM && frame <= EMPH_TO && (
                <CalloutLabel text="즉시 조치 대상 · 6건" left="37.5%" top={-44} start={EMPH_FROM} dir="down" />
              )}
            </div>

            {/* risk alerts + mini funnel */}
            <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginTop: 18 }}>
              <div style={{ border: `1px solid ${desk.border}` }}>
                <CardHead title="RISK ALERTS" sub="즉시 확인 필요" />
                <div>
                  {riskAlerts.map((a, i) => {
                    const start = 52 + i * 12;
                    const op = ramp(frame, start, 14);
                    return (
                      <div key={a.ref} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: `1px solid ${desk.border}`, opacity: op, transform: `translateX(${(1 - op) * 16}px)` }}>
                        <Dot sev={a.sev} />
                        <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: desk.link, width: 138 }}>{a.ref}</span>
                        <span style={{ fontSize: 13, color: desk.body, flex: 1 }}>{a.ko}</span>
                        <span style={{ fontFamily: font.mono, fontSize: 11, color: desk.hint }}>{a.age}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ border: `1px solid ${desk.border}` }}>
                <CardHead title="SETTLEMENT FUNNEL" sub="이번 달" />
                <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { l: "수신", v: 48, w: 100 },
                    { l: "대사 완료", v: 42, w: 88 },
                    { l: "검수", v: 36, w: 75 },
                    { l: "발송", v: 30, w: 62 },
                  ].map((s, i) => {
                    const w = ramp(frame, 60 + i * 8, 24) * s.w;
                    return (
                      <div key={s.l}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: desk.meta, marginBottom: 4 }}>
                          <span>{s.l}</span>
                          <span style={{ fontFamily: font.mono, color: desk.ink }}>{s.v}건</span>
                        </div>
                        <div style={{ height: 10, background: "#f1f5f9" }}>
                          <div style={{ height: "100%", width: `${w}%`, background: i === 3 ? stage.accent : desk.masthead }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, fontFamily: font.mono, fontSize: 11, color: desk.hint, textAlign: "right" }}>
              refreshed 09:04:12 · 자동 대사 ON
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s1, lang)} />
    </Stage>
  );
};
