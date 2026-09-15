import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { FPS, WIDTH, HEIGHT } from "./theme";
import { VideoA, A_DUR } from "./videos/VideoA";
import { VideoB, B_DUR } from "./videos/VideoB";
import { VideoC, C_DUR } from "./videos/VideoC";
import { VideoSales, SALES_DUR } from "./videos/VideoSales";
import { Lang } from "./i18n";

const langs: Lang[] = ["ko", "en"];

export const RemotionRoot: React.FC = () => (
  <>
    {/* 영업 · 정청산 컨셉 데모 (기획안 2026-07-28) — 단일 110초, 한국어 */}
    <Composition
      id="SalesOps-ko"
      component={VideoSales}
      durationInFrames={SALES_DUR}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />

    {langs.map((lang) => (
      <React.Fragment key={lang}>
        <Composition
          id={`VideoA-${lang}`}
          component={VideoA as React.FC<Record<string, unknown>>}
          durationInFrames={A_DUR}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ lang }}
        />
        <Composition
          id={`VideoB-${lang}`}
          component={VideoB as React.FC<Record<string, unknown>>}
          durationInFrames={B_DUR}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ lang }}
        />
        <Composition
          id={`VideoC-${lang}`}
          component={VideoC as React.FC<Record<string, unknown>>}
          durationInFrames={C_DUR}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ lang }}
        />
      </React.Fragment>
    ))}
  </>
);
