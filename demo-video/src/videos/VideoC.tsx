import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Lang, videoTitles, featureCards, pick } from "../i18n";
import { PartTitleCard, FeatureCard } from "../cards/Interstitial";
import { S7WeeklyDashboard } from "../scenes/S7WeeklyDashboard";
import { S8NewsAgent } from "../scenes/S8NewsAgent";
import { S9Testbench } from "../scenes/S9Testbench";
import { S10Closing } from "../scenes/S10Closing";

const PART = 60;
const CARD = 54;
const D7 = 300, D8 = 360, D9 = 300, D10 = 300;
export const C_DUR = PART + CARD + D7 + CARD + D8 + CARD + D9 + D10; // 1482 = 49.4s

export const VideoC: React.FC<{ lang: Lang }> = ({ lang }) => {
  const fc = featureCards;
  let at = 0;
  const seq = (dur: number) => { const from = at; at += dur; return { from, durationInFrames: dur }; };
  const partC = seq(PART), cA = seq(CARD), s7 = seq(D7), cB = seq(CARD), s8 = seq(D8), cC = seq(CARD), s9 = seq(D9), s10 = seq(D10);
  return (
    <AbsoluteFill>
      <Sequence {...partC} name="Part C Title">
        <PartTitleCard lang={lang} kicker={pick(videoTitles.C.kicker, lang)} title={pick(videoTitles.C.title, lang)} sub={pick(videoTitles.C.sub, lang)} />
      </Sequence>
      <Sequence {...cA} name="Card S7"><FeatureCard lang={lang} no={fc.s7.no} title={pick(fc.s7.title, lang)} sub={pick(fc.s7.sub, lang)} /></Sequence>
      <Sequence {...s7} name="S7 Weekly Dashboard"><S7WeeklyDashboard lang={lang} /></Sequence>
      <Sequence {...cB} name="Card S8"><FeatureCard lang={lang} no={fc.s8.no} title={pick(fc.s8.title, lang)} sub={pick(fc.s8.sub, lang)} /></Sequence>
      <Sequence {...s8} name="S8 News Agent"><S8NewsAgent lang={lang} /></Sequence>
      <Sequence {...cC} name="Card S9"><FeatureCard lang={lang} no={fc.s9.no} title={pick(fc.s9.title, lang)} sub={pick(fc.s9.sub, lang)} /></Sequence>
      <Sequence {...s9} name="S9 Testbench"><S9Testbench lang={lang} /></Sequence>
      <Sequence {...s10} name="S10 Closing"><S10Closing lang={lang} /></Sequence>
    </AbsoluteFill>
  );
};
