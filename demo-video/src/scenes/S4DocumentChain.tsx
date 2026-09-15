import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { docChain } from "../data";
import { fadeUp, pop } from "../util";

const FPS = 30;

export const S4DocumentChain: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);

  return (
    <>
    <Stage lang={lang} sceneIndex={0} sceneCount={3}>
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <AppWindow route="/ins/documents" title="DOCUMENTS · 근거 체인" style={{ height: 560, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <CardHead title="EVIDENCE CHAIN" sub="Treaty → BDX → SOC → Invoice" />
          <div style={{ padding: "48px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", height: 400 }}>
            {docChain.map((n, i) => {
              const start = 18 + i * 22;
              const p = pop(frame, start, FPS);
              const lineStart = start + 10;
              const lineP = interpolate(frame, [lineStart, lineStart + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <React.Fragment key={n.key}>
                  <div style={{ position: "relative", zIndex: 2, width: 220, opacity: p, transform: `scale(${0.9 + p * 0.1})` }}>
                    <div style={{ border: `1px solid ${i === docChain.length - 1 ? stage.accent : desk.borderStrong}`, background: i === docChain.length - 1 ? "rgba(59,130,246,0.05)" : "#fff", boxShadow: "0 8px 24px -12px rgba(15,23,42,0.25)" }}>
                      <div style={{ background: i === docChain.length - 1 ? stage.accent : desk.masthead, color: "#fff", padding: "8px 14px", fontFamily: font.head, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em" }}>
                        {n.key}
                      </div>
                      <div style={{ padding: "14px 14px" }}>
                        <div style={{ fontSize: 13, color: desk.ink, fontWeight: 500 }}>{n.ko}</div>
                        <div style={{ fontFamily: font.mono, fontSize: 12, color: desk.link, marginTop: 6 }}>{n.id}</div>
                        <div style={{ fontSize: 11, color: desk.hint, marginTop: 4 }}>{n.meta}</div>
                      </div>
                    </div>
                  </div>
                  {i < docChain.length - 1 && (
                    <div style={{ flex: 1, height: 2, position: "relative", margin: "0 -6px", zIndex: 1 }}>
                      <div style={{ position: "absolute", top: 0, left: 0, height: 2, width: `${lineP * 100}%`, background: stage.accent }} />
                      <div style={{ position: "absolute", right: 0, top: -4, width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `8px solid ${stage.accent}`, opacity: lineP > 0.95 ? 1 : 0 }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ padding: "0 40px 20px", fontFamily: font.mono, fontSize: 12, color: desk.hint }}>
            이메일 · 엑셀 · PDF 원본 링크 유지 — 클릭 시 원문으로 추적
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s4, lang)} start={70} />
    </Stage>
    <SceneEmphasis from={104} text="원문(이메일·엑셀·PDF)까지 추적" left={1470} top={452} />
    </>
  );
};
