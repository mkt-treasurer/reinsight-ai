import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead, Dot } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { auditTabs, auditTotalRows, auditExceptions } from "../data";
import { countUp, fadeUp, ramp } from "../util";

export const S3AuditData: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const activeTab = frame < 130 ? 0 : frame < 175 ? 1 : 2;
  const scanned = Math.round(countUp(frame, 20, 60, auditTotalRows));
  const pct = interpolate(frame, [20, 80], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <>
    <Stage lang={lang} sceneIndex={2} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <AppWindow route="/ins/audit-data" title="DATA AUDIT · 전수 검사" style={{ height: 620, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ padding: 22 }}>
            {/* scan banner */}
            <div style={{ border: `1px solid ${desk.border}`, padding: "18px 20px", display: "flex", alignItems: "center", gap: 28 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: desk.meta, marginBottom: 6 }}>FULL AUDIT · 전수 검사</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 46, fontWeight: 700, color: desk.ink, fontVariantNumeric: "tabular-nums" }}>{scanned.toLocaleString()}</span>
                  <span style={{ fontSize: 15, color: desk.meta }}>행 검사 완료</span>
                  <span style={{ fontFamily: font.mono, fontSize: 15, color: desk.positive, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 8, background: "#f1f5f9", marginTop: 12, width: 520 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: stage.accent }} />
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontFamily: font.mono, fontSize: 30, fontWeight: 700, color: desk.critical }}>{auditTabs.reduce((s, t) => s + t.count, 0)}</div>
                <div style={{ fontSize: 12, color: desk.meta }}>예외 검출 · 샘플링 아님</div>
              </div>
            </div>

            {/* tabs */}
            <div style={{ display: "flex", gap: 0, marginTop: 20, borderBottom: `1px solid ${desk.border}` }}>
              {auditTabs.map((t, i) => (
                <div key={t.key} style={{ padding: "10px 20px", borderBottom: i === activeTab ? `2px solid ${desk.masthead}` : "2px solid transparent", display: "flex", alignItems: "center", gap: 8, marginBottom: -1 }}>
                  <span style={{ fontFamily: font.head, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: i === activeTab ? desk.ink : desk.hint }}>{t.en}</span>
                  <span style={{ fontSize: 11, color: desk.hint }}>{t.ko}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: i === activeTab ? desk.critical : desk.hint, background: "#f1f5f9", padding: "1px 6px" }}>{t.count}</span>
                </div>
              ))}
            </div>

            {/* exceptions */}
            <div style={{ border: `1px solid ${desk.border}`, borderTop: "none" }}>
              {auditExceptions.map((e, i) => {
                const op = ramp(frame, 60 + i * 9, 14);
                return (
                  <div key={e.ref} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: `1px solid ${desk.border}`, opacity: op, transform: `translateX(${(1 - op) * 14}px)` }}>
                    <Dot sev={e.sev} />
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: desk.link, width: 150 }}>{e.ref}</span>
                    <span style={{ fontSize: 13, color: desk.body, flex: 1 }}>{e.ko}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 11, color: e.days > 30 ? desk.critical : desk.hint }}>{e.days}일</span>
                  </div>
                );
              })}
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s3, lang)} start={70} />
    </Stage>
    <SceneEmphasis from={84} text="샘플링 아님 · 12,400행 전수 검사" left={210} top={330} />
    </>
  );
};
