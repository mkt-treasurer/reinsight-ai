import React from "react";
import { desk, font, stage } from "../theme";

// Light INS product window sitting on the dark stage — real financial-desk look.
export const AppWindow: React.FC<{
  route: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}> = ({ route, children, style, title }) => {
  return (
    <div
      style={{
        background: desk.bg,
        border: `1px solid ${desk.border}`,
        boxShadow: `0 40px 90px -30px rgba(2,8,23,0.75), 0 0 0 1px rgba(59,130,246,0.10), 0 0 60px -10px ${stage.glow}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/* browser chrome / URL bar */}
      <div
        style={{
          height: 40,
          background: "#eef2f7",
          borderBottom: `1px solid ${desk.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          flex: "0 0 auto",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {["#e05c5c", "#e0b74c", "#5cc16b"].map((c) => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            marginLeft: 10,
            height: 24,
            background: "#fff",
            border: `1px solid ${desk.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            fontFamily: font.mono,
            fontSize: 12,
            color: desk.meta,
            gap: 8,
          }}
        >
          <span style={{ color: desk.positive, fontSize: 11 }}>▲</span>
          <span style={{ color: desk.hint }}>insightre.ai</span>
          <span style={{ color: desk.ink }}>{route}</span>
        </div>
      </div>
      {/* masthead strip (matches DESIGN.md slate-900 masthead) */}
      <div
        style={{
          background: desk.masthead,
          color: "#fff",
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flex: "0 0 auto",
        }}
      >
        <span style={{ fontFamily: font.head, fontWeight: 700, fontSize: 13, letterSpacing: "0.18em" }}>
          INSIGHT<span style={{ color: stage.accentBright }}>RE</span>
        </span>
        <span style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.12em", color: "#94a3b8" }}>
          {title ?? "재보험 정산 데스크"}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};
