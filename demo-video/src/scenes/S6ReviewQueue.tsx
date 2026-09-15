import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { reviewDiff, auditLog } from "../data";
import { fadeUp, pop, ramp } from "../util";

const FPS = 30;
const APPROVE_AT = 150;

export const S6ReviewQueue: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const approved = frame >= APPROVE_AT + 6;
  const btnPress = interpolate(frame, [APPROVE_AT, APPROVE_AT + 4, APPROVE_AT + 8], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <>
    <Stage lang={lang} sceneIndex={2} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center" }}>
        <AppWindow route="/ins/tools/rq-slip" title="REVIEW QUEUE · 검수" style={{ height: 660, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", height: "100%" }}>
            {/* diff */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="AI DRAFT ↔ REVISED" sub="초안 vs 수정본" right={<span style={{ fontFamily: font.mono, fontSize: 10, color: desk.warning }}>2 EDITS</span>} />
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", padding: "8px 18px", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: desk.meta, borderBottom: `1px solid ${desk.border}` }}>
                <span>FIELD</span><span>AI 초안</span><span>수정본</span>
              </div>
              {reviewDiff.map((r, i) => {
                const op = ramp(frame, 20 + i * 10, 14);
                return (
                  <div key={r.field} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${desk.border}`, opacity: op, background: r.changed ? "rgba(180,83,9,0.05)" : "#fff" }}>
                    <span style={{ fontFamily: font.head, fontSize: 12, fontWeight: 700, color: desk.body }}>{r.field}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: r.changed ? desk.warning : desk.body, textDecoration: r.changed ? "line-through" : "none" }}>{r.ai}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: r.changed ? desk.positive : desk.body, fontWeight: r.changed ? 700 : 400 }}>{r.human}</span>
                  </div>
                );
              })}
              {/* approve button */}
              <div style={{ marginTop: "auto", padding: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <div style={{ border: `1px solid ${desk.borderStrong}`, padding: "10px 18px", fontFamily: font.head, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: desk.body }}>REJECT</div>
                <div style={{ background: approved ? desk.positive : stage.accent, color: "#fff", padding: "10px 22px", fontFamily: font.head, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", transform: `scale(${btnPress})`, boxShadow: `0 8px 20px -8px ${approved ? "rgba(4,120,87,0.6)" : "rgba(59,130,246,0.6)"}` }}>
                  {approved ? "✓ APPROVED · 발송 승인됨" : "APPROVE · 승인"}
                </div>
              </div>
            </div>

            {/* audit log */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="AUDIT LOG" sub="감사 이력 (불변)" />
              <div style={{ padding: "20px 22px", position: "relative" }}>
                <div style={{ position: "absolute", left: 30, top: 28, bottom: 28, width: 2, background: desk.border }} />
                {auditLog.map((e, i) => {
                  const on = i < 2 ? 40 + i * 26 : APPROVE_AT + 10;
                  const p = pop(frame, on, FPS);
                  const isAI = e.role === "AI";
                  const isApprove = e.role === "승인";
                  const col = isAI ? stage.accent : isApprove ? desk.positive : desk.warning;
                  return (
                    <div key={i} style={{ display: "flex", gap: 16, marginBottom: 26, opacity: p, transform: `translateX(${(1 - p) * 12}px)` }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", border: `3px solid ${col}`, zIndex: 1, flex: "0 0 auto", marginLeft: 2 }} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: font.head, fontSize: 13, fontWeight: 700, color: desk.ink }}>{e.actor}</span>
                          <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.08em", color: col, border: `1px solid ${col}`, padding: "1px 6px", textTransform: "uppercase" }}>{e.role}</span>
                        </div>
                        <div style={{ fontSize: 13, color: desk.body, marginTop: 5 }}>{e.ko}</div>
                        <div style={{ fontFamily: font.mono, fontSize: 11, color: desk.hint, marginTop: 3 }}>{e.at}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s6, lang)} start={APPROVE_AT + 16} />
    </Stage>
    <SceneEmphasis from={APPROVE_AT + 12} text="사람이 승인 · 이력 불변 기록" left={820} top={772} />
    </>
  );
};
