import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { handlers, heatmap, lossRatio } from "../data";
import { fadeUp, ramp } from "../util";

export const S7WeeklyDashboard: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);
  const maxCell = 15;

  // loss ratio line
  const W = 460, H = 190, pad = 30;
  const maxV = 80, minV = 40;
  const pts = lossRatio.map((d, i) => {
    const x = pad + (i / (lossRatio.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (d.v - minV) / (maxV - minV)) * (H - pad * 2);
    return { x, y };
  });
  const lineP = ramp(frame, 40, 34);
  const shownPts = pts.slice(0, Math.max(2, Math.ceil(lineP * pts.length)));
  const path = shownPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <>
    <Stage lang={lang} sceneIndex={0} sceneCount={4}>
      <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center" }}>
        <AppWindow route="/ins/tools/weekly-dashboard" title="WEEKLY · 팀 운영" style={{ height: 620, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", height: "100%" }}>
            {/* heatmap */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="HANDLER LOAD" sub="담당자별 처리량 (주차)" />
              <div style={{ padding: "22px 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: `70px repeat(${handlers.length}, 1fr)`, gap: 6, alignItems: "center" }}>
                  <span />
                  {handlers.map((h) => (
                    <span key={h} style={{ fontSize: 11, color: desk.meta, textAlign: "center" }}>{h}</span>
                  ))}
                  {heatmap.map((row, r) => (
                    <React.Fragment key={r}>
                      <span style={{ fontFamily: font.mono, fontSize: 11, color: desk.hint }}>W{r + 1}</span>
                      {row.map((v, c) => {
                        const on = 20 + (r * handlers.length + c) * 2.2;
                        const p = ramp(frame, on, 12);
                        const intensity = (v / maxCell) * p;
                        return (
                          <div key={c} style={{ height: 46, background: `rgba(59,130,246,${0.12 + intensity * 0.78})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: intensity > 0.5 ? "#fff" : desk.ink, opacity: p }}>{Math.round(v * p)}</span>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 20, fontFamily: font.mono, fontSize: 11, color: desk.hint }}>
                  이번 주 총 처리 187건 · 최대 부하: 이도현 (W3)
                </div>
              </div>
            </div>

            {/* loss ratio */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="LOSS RATIO" sub="포트폴리오 손해율 추이" />
              <div style={{ padding: "22px 20px" }}>
                <svg width={W} height={H} style={{ overflow: "visible" }}>
                  {[40, 50, 60, 70, 80].map((g) => {
                    const y = pad + (1 - (g - minV) / (maxV - minV)) * (H - pad * 2);
                    return (
                      <g key={g}>
                        <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#f1f5f9" strokeDasharray="2 2" />
                        <text x={0} y={y + 3} fontSize={10} fill="#94a3b8" fontFamily={font.mono}>{g}%</text>
                      </g>
                    );
                  })}
                  <path d={path} fill="none" stroke={desk.masthead} strokeWidth={2} />
                  {shownPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={i === shownPts.length - 1 ? 4 : 2.5} fill={i === lossRatio.length - 1 ? stage.accent : desk.masthead} />
                  ))}
                  {shownPts.map((p, i) => (
                    <text key={"l" + i} x={p.x} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle" fontFamily={font.mono}>{lossRatio[i].m}</text>
                  ))}
                </svg>
                <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: desk.meta, textTransform: "uppercase", letterSpacing: "0.1em" }}>현재</div>
                    <div style={{ fontFamily: font.mono, fontSize: 26, fontWeight: 700, color: desk.positive }}>49%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: desk.meta, textTransform: "uppercase", letterSpacing: "0.1em" }}>6개월 Δ</div>
                    <div style={{ fontFamily: font.mono, fontSize: 26, fontWeight: 700, color: desk.positive }}>−12%p</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s7, lang)} start={60} />
    </Stage>
    <SceneEmphasis from={80} text="손해율 6개월 −12%p 개선" left={1055} top={506} />
    </>
  );
};
