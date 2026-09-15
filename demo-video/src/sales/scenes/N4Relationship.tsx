import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SalesStage, ScreenPlate, SalesCaption } from "../SalesStage";
import { AppWindow } from "../../stage/AppWindow";
import { CardHead } from "../../ui/primitives";
import { desk, font, stage } from "../../theme";
import { fadeUp, ramp, pop } from "../../util";
import { relNodes, relEdges, relPath } from "../salesData";

const FPS = 30;
const VB_W = 720;
const VB_H = 470;
const WARM_FROM = 150;

const byId = (id: string) => relNodes.find((n) => n.id === id)!;

const nodeStyle = (kind: string) => {
  switch (kind) {
    case "center":
      return { fill: desk.masthead, stroke: desk.masthead, ink: "#ffffff", w: 132, h: 46 };
    case "target":
      return { fill: "rgba(59,130,246,0.10)", stroke: stage.accent, ink: desk.ink, w: 122, h: 44 };
    case "own":
      return { fill: "rgba(59,130,246,0.10)", stroke: stage.accent, ink: desk.ink, w: 122, h: 44 };
    case "rival":
      return { fill: "#ffffff", stroke: desk.critical, ink: desk.critical, w: 122, h: 44 };
    default:
      return { fill: "#ffffff", stroke: desk.borderStrong, ink: desk.body, w: 126, h: 44 };
  }
};

// 34–48s. Who actually gets us in the door — the warm path beats the cold email.
export const N4Relationship: React.FC = () => {
  const frame = useCurrentFrame();
  const win = fadeUp(frame, 6, 22, 18);

  return (
    <SalesStage phase="CONNECT">
      <AbsoluteFill style={{ padding: "238px 92px 0" }}>
        <ScreenPlate code="Relationship Intelligence" ko="인물 및 관계도 분석" />
        <AppWindow
          route="/ins/sales/relationships"
          title="NETWORK · 관계도"
          style={{ height: 578, opacity: win.opacity, transform: `translateY(${win.translateY}px)` }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1.42fr 1fr", height: "100%" }}>
            {/* ── graph ── */}
            <div style={{ borderRight: `1px solid ${desk.border}`, display: "flex", flexDirection: "column" }}>
              <CardHead title="RELATIONSHIP MAP" sub="한빛로지스 · 의사결정자 및 시장 접점" />
              <div style={{ padding: "6px 14px", display: "flex", justifyContent: "center" }}>
                <svg width={716} height={448} viewBox={`0 0 ${VB_W} ${VB_H}`}>
                  {/* edges */}
                  {relEdges.map((e, i) => {
                    const a = byId(e.from);
                    const b = byId(e.to);
                    const on = e.strong ? WARM_FROM : 20 + i * 9;
                    const p = ramp(frame, on, e.strong ? 24 : 16);
                    const x2 = a.x + (b.x - a.x) * p;
                    const y2 = a.y + (b.y - a.y) * p;
                    return (
                      <line
                        key={`${e.from}-${e.to}`}
                        x1={a.x}
                        y1={a.y}
                        x2={x2}
                        y2={y2}
                        stroke={e.strong ? stage.accent : "#cbd5e1"}
                        strokeWidth={e.strong ? 3 : 1.2}
                        strokeDasharray={e.strong ? "7 5" : undefined}
                        opacity={e.strong ? 1 : 0.75}
                      />
                    );
                  })}

                  {/* warm-path pulse dot */}
                  {frame >= WARM_FROM + 20 &&
                    (() => {
                      const a = byId("kim");
                      const b = byId("cfo");
                      const t = ((frame - WARM_FROM - 20) % 34) / 34;
                      return (
                        <circle
                          cx={a.x + (b.x - a.x) * t}
                          cy={a.y + (b.y - a.y) * t}
                          r={6}
                          fill={stage.accent}
                          opacity={1 - Math.abs(t - 0.5) * 0.7}
                        />
                      );
                    })()}

                  {/* nodes */}
                  {relNodes.map((n, i) => {
                    const s = nodeStyle(n.kind);
                    const on = 16 + i * 9;
                    const p = pop(frame, on, FPS);
                    const highlight =
                      frame >= WARM_FROM && (n.id === "kim" || n.id === "cfo");
                    return (
                      <g
                        key={n.id}
                        opacity={p}
                        transform={`translate(${n.x},${n.y}) scale(${0.88 + p * 0.12})`}
                      >
                        {highlight && (
                          <rect
                            x={-s.w / 2 - 5}
                            y={-s.h / 2 - 5}
                            width={s.w + 10}
                            height={s.h + 10}
                            fill="none"
                            stroke={stage.accent}
                            strokeWidth={1.5}
                            opacity={0.5}
                          />
                        )}
                        <rect
                          x={-s.w / 2}
                          y={-s.h / 2}
                          width={s.w}
                          height={s.h}
                          fill={s.fill}
                          stroke={s.stroke}
                          strokeWidth={highlight ? 2.4 : 1.2}
                        />
                        <text
                          x={0}
                          y={-3}
                          textAnchor="middle"
                          fontSize={14}
                          fontWeight={600}
                          fill={s.ink}
                          fontFamily={font.kr}
                        >
                          {n.label}
                        </text>
                        <text
                          x={0}
                          y={14}
                          textAnchor="middle"
                          fontSize={10}
                          fill={n.kind === "center" ? "#94a3b8" : desk.hint}
                          fontFamily={font.mono}
                        >
                          {n.sub}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ── warm path + recommendation ── */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <CardHead title="WARM PATH" sub="추천 접근 경로" />
              <div style={{ padding: "16px 18px" }}>
                <div
                  style={{
                    border: `1px solid ${stage.accent}`,
                    background: "rgba(59,130,246,0.05)",
                    padding: "16px 16px",
                    opacity: ramp(frame, WARM_FROM + 8, 18),
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.head,
                      fontSize: 18,
                      fontWeight: 700,
                      color: desk.ink,
                      marginBottom: 14,
                    }}
                  >
                    {relPath.title}
                  </div>
                  {relPath.evidence.map((e, i) => {
                    const p = ramp(frame, WARM_FROM + 22 + i * 12, 14);
                    return (
                      <div
                        key={e}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "6px 0",
                          opacity: p,
                          transform: `translateX(${(1 - p) * 10}px)`,
                        }}
                      >
                        <span style={{ color: stage.accent, fontSize: 11 }}>✓</span>
                        <span style={{ fontSize: 12.5, color: desk.body }}>{e}</span>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: `1px solid rgba(59,130,246,0.3)`,
                      fontFamily: font.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: desk.link,
                      opacity: ramp(frame, WARM_FROM + 62, 16),
                    }}
                  >
                    {relPath.verdict}
                  </div>
                </div>

                {/* cold vs warm */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 16,
                    opacity: ramp(frame, WARM_FROM + 80, 18),
                  }}
                >
                  <div style={{ border: `1px solid ${desk.border}`, padding: "12px 13px", opacity: 0.55 }}>
                    <div style={{ fontSize: 10, color: desk.hint, letterSpacing: "0.12em", marginBottom: 7 }}>
                      COLD EMAIL
                    </div>
                    <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 700, color: desk.meta }}>
                      낮음
                    </div>
                    <div style={{ fontSize: 11, color: desk.hint, marginTop: 4 }}>직접 접촉 회신율</div>
                  </div>
                  <div
                    style={{
                      border: `1px solid ${stage.accent}`,
                      padding: "12px 13px",
                      background: "rgba(59,130,246,0.05)",
                    }}
                  >
                    <div style={{ fontSize: 10, color: desk.link, letterSpacing: "0.12em", marginBottom: 7 }}>
                      WARM INTRO
                    </div>
                    <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 700, color: stage.accent }}>
                      높음
                    </div>
                    <div style={{ fontSize: 11, color: desk.meta, marginTop: 4 }}>소개 경유 회신율</div>
                  </div>
                </div>

                {/* AI recommendation */}
                <div
                  style={{
                    marginTop: 16,
                    borderLeft: `3px solid ${stage.accent}`,
                    paddingLeft: 13,
                    opacity: ramp(frame, WARM_FROM + 104, 20),
                  }}
                >
                  <div
                    style={{
                      fontFamily: font.head,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      color: desk.link,
                      marginBottom: 7,
                    }}
                  >
                    AI · 추천
                  </div>
                  <div style={{ fontSize: 12.5, color: desk.body, lineHeight: 1.65 }}>{relPath.advice}</div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </AbsoluteFill>
      <SalesCaption text="콜드메일 대신, 누구에게 소개를 요청해야 하는지 추천합니다" start={300} />
    </SalesStage>
  );
};
