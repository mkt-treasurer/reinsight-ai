import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { sourceEmail, slipFields } from "../data";
import { fadeUp, pop, ramp } from "../util";

const FPS = 30;
const FIELD_START = 96; // AI extraction begins
const FIELD_STEP = 24;

const SrcBadge: React.FC<{ tone: string; where: string; on: number; frame: number }> = ({ tone, where, on, frame }) => {
  const p = pop(frame, on, FPS);
  const isEmail = tone === "email";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, opacity: p, transform: `scale(${0.7 + p * 0.3})`, fontFamily: font.mono, fontSize: 10, letterSpacing: "0.04em", padding: "2px 7px", border: `1px solid ${isEmail ? "#3b82f6" : "#059669"}`, color: isEmail ? "#1d4ed8" : "#047857", background: isEmail ? "rgba(59,130,246,0.06)" : "rgba(5,150,105,0.06)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: isEmail ? "#3b82f6" : "#059669" }} />
      {where}
    </span>
  );
};

export const S5SlipGenerator: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const aiPulse = frame >= 70 && frame < FIELD_START + slipFields.length * FIELD_STEP;
  const glow = aiPulse ? 0.5 + 0.5 * Math.sin((frame / FPS) * 8) : 0;

  return (
    <>
    <Stage lang={lang} sceneIndex={1} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 96px", justifyContent: "center" }}>
        <AppWindow route="/ins/tools/slip-generator" title="SLIP GENERATOR · AI 초안" style={{ height: 680, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1.25fr", height: "100%" }}>
            {/* LEFT — source email */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <CardHead title="SOURCE" sub="수신 이메일 원문" />
              <div style={{ padding: "14px 18px", overflow: "hidden" }}>
                <div style={{ fontSize: 11, color: desk.meta }}>FROM</div>
                <div style={{ fontFamily: font.mono, fontSize: 12, color: desk.ink, marginBottom: 8 }}>{sourceEmail.from}</div>
                <div style={{ fontSize: 13, color: desk.ink, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{sourceEmail.subject}</div>
                <div style={{ borderTop: `1px solid ${desk.border}`, paddingTop: 12 }}>
                  {sourceEmail.lines.map((l, i) => {
                    const op = ramp(frame, 14 + i * 4, 10);
                    const hi = frame >= 70 && (l.includes("4.85%") || l.includes("15.0%") || l.includes("20,000,000") || l.includes("35%"));
                    return (
                      <div key={i} style={{ fontFamily: font.mono, fontSize: 12, color: l.startsWith("  •") ? desk.ink : desk.body, lineHeight: 1.55, opacity: op, background: hi ? "rgba(59,130,246,0.10)" : "transparent", minHeight: 12 }}>
                        {l || " "}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MIDDLE — AI extract arrow */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: stage.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${8 + glow * 22}px ${glow * 6}px rgba(59,130,246,0.6)` }}>
                <span style={{ color: "#fff", fontSize: 16 }}>→</span>
              </div>
              <span style={{ writingMode: "vertical-rl", fontFamily: font.mono, fontSize: 10, letterSpacing: "0.2em", color: stage.accentDeep, textTransform: "uppercase" }}>ARIA EXTRACT</span>
            </div>

            {/* RIGHT — RQ slip form */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <CardHead title="RQ SLIP DRAFT" sub="AI 자동 추출" right={<span style={{ fontFamily: font.mono, fontSize: 10, color: desk.positive }}>● GENERATING</span>} />
              <div style={{ padding: "10px 18px" }}>
                {slipFields.map((f, i) => {
                  const on = FIELD_START + i * FIELD_STEP;
                  const filled = frame >= on;
                  const op = ramp(frame, on, 10);
                  return (
                    <div key={f.label} style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${desk.border}`, minHeight: 40 }}>
                      <div>
                        <div style={{ fontFamily: font.head, fontSize: 12, fontWeight: 700, color: desk.body }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: desk.hint }}>{f.ko}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: filled ? 1 : 0.25 }}>
                        {filled ? (
                          <>
                            <span style={{ fontFamily: font.mono, fontSize: 13, color: desk.ink, opacity: op, flex: 1 }}>{f.value}</span>
                            <SrcBadge tone={f.src.tone} where={f.src.where} on={on + 4} frame={frame} />
                          </>
                        ) : (
                          <span style={{ fontFamily: font.mono, fontSize: 13, color: desk.hint }}>···</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s5, lang)} start={FIELD_START + 40} />
    </Stage>
    <SceneEmphasis from={FIELD_START + 8 * FIELD_STEP + 6} text="8개 필드 자동 추출 · 출처 배지 표기" left={1120} top={252} />
    </>
  );
};
