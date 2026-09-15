import React from "react";
import { C, FONT } from "./theme";

/** 좌상단 브랜드 뱃지 — 밝은 씬에서도 어두운 씬에서도 읽히도록 불투명 */
export const BrandBadge: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 52,
      left: 56,
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: FONT,
      background: `linear-gradient(135deg, ${C.brandLite}, ${C.brand})`,
      borderRadius: 14,
      padding: "13px 22px 14px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    }}
  >
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: 5,
        background: C.hi,
        display: "block",
      }}
    />
    <span
      style={{
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: 3.5,
        color: "#FFFFFF",
      }}
    >
      ALPHALENZ
    </span>
  </div>
);
