import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../stage/Stage";
import { AppWindow } from "../stage/AppWindow";
import { Caption } from "../stage/Caption";
import { SceneEmphasis } from "../stage/Emphasis";
import { CardHead } from "../ui/primitives";
import { desk, font, stage } from "../theme";
import { Lang, captions, pick } from "../i18n";
import { accuracyFields, versionTrend } from "../data";
import { countUp, fadeUp, ramp } from "../util";

export const S9Testbench: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 4, 22, 20);

  const W = 420, H = 180, pad = 34;
  const minV = 88, maxV = 100;
  const pts = versionTrend.map((d, i) => {
    const x = pad + (i / (versionTrend.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (d.acc - minV) / (maxV - minV)) * (H - pad * 2);
    return { x, y };
  });
  const lp = ramp(frame, 80, 34);
  const shown = pts.slice(0, Math.max(2, Math.ceil(lp * pts.length)));
  const path = shown.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <>
    <Stage lang={lang} sceneIndex={2} sceneCount={4}>
      <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center" }}>
        <AppWindow route="/ins/admin/slip-testbench" title="TESTBENCH · 추출 정확도" style={{ height: 620, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", height: "100%" }}>
            {/* accuracy bars */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="FIELD ACCURACY" sub="필드별 추출 정확도 · 최신 v1.0" />
              <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                {accuracyFields.map((f, i) => {
                  const on = 20 + i * 12;
                  const v = countUp(frame, on, 30, f.acc);
                  const w = ramp(frame, on, 30) * f.acc;
                  return (
                    <div key={f.field}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: desk.body }}>{f.field}</span>
                        <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, color: f.acc >= 99 ? desk.positive : desk.ink }}>{v.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 12, background: "#f1f5f9" }}>
                        <div style={{ height: "100%", width: `${w}%`, background: f.acc >= 99 ? desk.positive : stage.accent }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* version trend */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="VERSION TREND" sub="버전별 개선 추이" />
              <div style={{ padding: "22px 20px" }}>
                <svg width={W} height={H} style={{ overflow: "visible" }}>
                  {[90, 94, 98, 100].map((g) => {
                    const y = pad + (1 - (g - minV) / (maxV - minV)) * (H - pad * 2);
                    return (
                      <g key={g}>
                        <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#f1f5f9" strokeDasharray="2 2" />
                        <text x={0} y={y + 3} fontSize={10} fill="#94a3b8" fontFamily={font.mono}>{g}%</text>
                      </g>
                    );
                  })}
                  <path d={path} fill="none" stroke={stage.accent} strokeWidth={2.5} />
                  {shown.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={i === shown.length - 1 ? 4.5 : 3} fill={stage.accent} />
                  ))}
                  {shown.map((p, i) => (
                    <text key={"v" + i} x={p.x} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle" fontFamily={font.mono}>{versionTrend[i].v}</text>
                  ))}
                </svg>
                <div style={{ marginTop: 14, border: `1px solid ${desk.border}`, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: desk.meta }}>전체 평균 정확도</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: font.mono, fontSize: 34, fontWeight: 700, color: desk.positive }}>{countUp(frame, 90, 30, 98.4).toFixed(1)}%</span>
                    <span style={{ fontFamily: font.mono, fontSize: 13, color: desk.positive }}>▲ +7.2%p (v0.6→v1.0)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <Caption text={pick(captions.s9, lang)} start={70} />
    </Stage>
    <SceneEmphasis from={118} text="평균 98.4% · +7.2%p (v0.6→v1.0)" left={1120} top={548} />
    </>
  );
};
