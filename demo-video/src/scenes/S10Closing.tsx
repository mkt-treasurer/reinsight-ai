import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../stage/Stage";
import { stage, font } from "../theme";
import { Lang, captions, pick, brand } from "../i18n";
import { roadmap } from "../data";
import { fadeUp, pop } from "../util";

const FPS = 30;

export const S10Closing: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();

  return (
    <Stage lang={lang} sceneIndex={3} sceneCount={4}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 120px" }}>
        {/* kicker */}
        <div style={{ opacity: fadeUp(frame, 6, 16).opacity, transform: `translateY(${fadeUp(frame, 6, 16, 14).translateY}px)`, textAlign: "center", marginBottom: 46 }}>
          <div style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: "0.32em", color: stage.accentBright, textTransform: "uppercase", marginBottom: 14 }}>
            도입 로드맵 · IMPLEMENTATION ROADMAP
          </div>
          <div style={{ fontFamily: font.head, fontSize: 40, fontWeight: 800, color: stage.ink, letterSpacing: "-0.01em" }}>
            작게 시작해, 정산 데스크 전체로
          </div>
        </div>

        {/* roadmap */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, width: "100%", maxWidth: 1180 }}>
          {roadmap.map((r, i) => {
            const on = 26 + i * 16;
            const p = pop(frame, on, FPS);
            const active = i === 0;
            return (
              <div key={r.phase} style={{ border: `1px solid ${active ? stage.accent : stage.hair}`, background: active ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)", padding: "26px 24px", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ fontFamily: font.head, fontSize: 20, fontWeight: 800, color: active ? stage.accentBright : stage.ink }}>{r.phase}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 12, color: stage.inkMuted }}>{r.weeks}</span>
                </div>
                <div style={{ fontSize: 18, color: stage.ink, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{r.ko}</div>
                <div style={{ fontFamily: font.mono, fontSize: 12, color: stage.inkFaint }}>{r.en}</div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 52, display: "flex", alignItems: "center", gap: 18, opacity: fadeUp(frame, 92, 18).opacity, transform: `translateY(${fadeUp(frame, 92, 18, 16).translateY}px)` }}>
          <div style={{ background: stage.accent, color: "#fff", padding: "16px 30px", fontFamily: font.head, fontWeight: 700, fontSize: 18, letterSpacing: "0.02em", boxShadow: `0 16px 40px -12px ${stage.glow}` }}>
            {pick(captions.s10, lang)}
          </div>
          <span style={{ fontFamily: font.mono, fontSize: 14, color: stage.inkMuted }}>→ 삼성화재·현대해상 실계약 샘플 기준</span>
        </div>

        {/* logo lockup */}
        <div style={{ marginTop: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: fadeUp(frame, 120, 20).opacity, transform: `scale(${0.94 + fadeUp(frame, 120, 20).opacity * 0.06})` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 14, height: 14, background: stage.accent, transform: "rotate(45deg)" }} />
            <span style={{ fontFamily: font.head, fontWeight: 800, fontSize: 32, letterSpacing: "0.4em", color: stage.ink }}>{brand.wordmark}</span>
          </div>
          <span style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: "0.24em", color: stage.inkMuted }}>× INS 보험중개 · {brand.site}</span>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
