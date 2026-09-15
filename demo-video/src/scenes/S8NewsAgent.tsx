import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { newsCard, matchedTreaties, chatAnswer } from "../data";
import { fadeUp, pop, ramp, typed } from "../util";

const FPS = 30;
const TYPE_START = 150;

export const S8NewsAgent: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const answer = pick(chatAnswer, lang);
  const shown = typed(answer, frame, TYPE_START, 34, FPS);
  const caret = Math.floor(frame / 8) % 2 === 0 && shown.length < answer.length;

  return (
    <>
    <Stage lang={lang} sceneIndex={1} sceneCount={4}>
      <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center" }}>
        <AppWindow route="/ins/tools/news-insights → /ins/chat" title="NEWS → AGENT · 인사이트" style={{ height: 640, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", height: "100%" }}>
            {/* left: news + matched treaties */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="MARKET NEWS" sub="재보험 시장 동향" />
              <div style={{ padding: 20 }}>
                {/* news card */}
                <div style={{ border: `1px solid ${desk.borderStrong}`, padding: 16, opacity: fadeUp(frame, 16, 16).opacity, transform: `translateY(${fadeUp(frame, 16, 16, 12).translateY}px)` }}>
                  <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.14em", color: stage.accentDeep, marginBottom: 8 }}>{newsCard.tag}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: desk.ink, lineHeight: 1.4 }}>{pick({ ko: newsCard.ko, en: newsCard.en } as any, lang)}</div>
                  <div style={{ fontFamily: font.mono, fontSize: 11, color: desk.hint, marginTop: 10 }}>{newsCard.src}</div>
                </div>

                {/* match flow */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 12px", opacity: ramp(frame, 60, 12) }}>
                  <div style={{ height: 1, flex: 1, background: desk.border }} />
                  <span style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.1em", color: stage.accentDeep, textTransform: "uppercase" }}>▼ 연관 Treaty 자동 매칭</span>
                  <div style={{ height: 1, flex: 1, background: desk.border }} />
                </div>

                {matchedTreaties.map((m, i) => {
                  const on = 72 + i * 16;
                  const p = pop(frame, on, FPS);
                  return (
                    <div key={m.id} style={{ border: `1px solid ${desk.border}`, padding: "12px 14px", marginBottom: 10, opacity: p, transform: `translateX(${(1 - p) * 14}px)` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: desk.link }}>{m.id}</span>
                        <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: desk.positive }}>{m.pct}%</span>
                      </div>
                      <div style={{ fontSize: 13, color: desk.body, marginTop: 4 }}>{m.ko}</div>
                      <div style={{ height: 4, background: "#f1f5f9", marginTop: 8 }}>
                        <div style={{ height: "100%", width: `${ramp(frame, on, 16) * m.pct}%`, background: stage.accent }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* right: chat agent */}
            <div style={{ display: "flex", flexDirection: "column", background: desk.shell }}>
              <CardHead title="ARIA AGENT" sub="영업 인사이트 질의" right={<span style={{ fontFamily: font.mono, fontSize: 10, color: desk.positive }}>● LIVE</span>} />
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                {/* user question */}
                <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: desk.masthead, color: "#fff", padding: "12px 16px", opacity: fadeUp(frame, 100, 14).opacity }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>이 뉴스, 우리 갱신 포트폴리오에 어떤 영향이 있지?</div>
                </div>
                {/* AI answer */}
                {frame >= TYPE_START - 8 && (
                  <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#fff", border: `1px solid ${desk.border}`, padding: "14px 16px", boxShadow: "0 8px 24px -14px rgba(15,23,42,0.3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, background: stage.accent, transform: "rotate(45deg)" }} />
                      <span style={{ fontFamily: font.head, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: desk.body }}>ARIA</span>
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.65, color: desk.ink }}>
                      {shown}{caret && <span style={{ color: stage.accent }}>▋</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s8, lang)} start={TYPE_START + 30} />
    </Stage>
    <SceneEmphasis from={TYPE_START + 92} text="영향 2건 · 예상 −USD 1.9M" left={980} top={402} />
    </>
  );
};
