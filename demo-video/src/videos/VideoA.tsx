import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Lang, videoTitles, featureCards, pick } from "../i18n";
import { S0Intro } from "../scenes/S0Intro";
import { PartTitleCard, FeatureCard } from "../cards/Interstitial";
import { S1Overview } from "../scenes/S1Overview";
import { S2ClaimsByAccount } from "../scenes/S2ClaimsByAccount";
import { S3AuditData } from "../scenes/S3AuditData";

const INTRO = 330;
const PART = 60;
const CARD = 54;
// scene durations
const D1 = 390, D2 = 360, D3 = 300;
export const A_DUR = INTRO + PART + CARD + D1 + CARD + D2 + CARD + D3; // 1602 = 53.4s

export const VideoA: React.FC<{ lang: Lang }> = ({ lang }) => {
  const fc = featureCards;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={INTRO} name="Intro">
        <S0Intro lang={lang} />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={PART} name="Part A Title">
        <PartTitleCard lang={lang} kicker={pick(videoTitles.A.kicker, lang)} title={pick(videoTitles.A.title, lang)} sub={pick(videoTitles.A.sub, lang)} />
      </Sequence>

      <Sequence from={INTRO + PART} durationInFrames={CARD} name="Card S1">
        <FeatureCard lang={lang} no={fc.s1.no} title={pick(fc.s1.title, lang)} sub={pick(fc.s1.sub, lang)} />
      </Sequence>
      <Sequence from={INTRO + PART + CARD} durationInFrames={D1} name="S1 Overview">
        <S1Overview lang={lang} />
      </Sequence>

      <Sequence from={INTRO + PART + CARD + D1} durationInFrames={CARD} name="Card S2">
        <FeatureCard lang={lang} no={fc.s2.no} title={pick(fc.s2.title, lang)} sub={pick(fc.s2.sub, lang)} />
      </Sequence>
      <Sequence from={INTRO + PART + CARD + D1 + CARD} durationInFrames={D2} name="S2 Claims by Account">
        <S2ClaimsByAccount lang={lang} />
      </Sequence>

      <Sequence from={INTRO + PART + CARD + D1 + CARD + D2} durationInFrames={CARD} name="Card S3">
        <FeatureCard lang={lang} no={fc.s3.no} title={pick(fc.s3.title, lang)} sub={pick(fc.s3.sub, lang)} />
      </Sequence>
      <Sequence from={INTRO + PART + CARD + D1 + CARD + D2 + CARD} durationInFrames={D3} name="S3 Data Audit">
        <S3AuditData lang={lang} />
      </Sequence>
    </AbsoluteFill>
  );
};
