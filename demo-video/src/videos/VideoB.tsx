import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Lang, videoTitles, featureCards, pick } from "../i18n";
import { PartTitleCard, FeatureCard } from "../cards/Interstitial";
import { S4DocumentChain } from "../scenes/S4DocumentChain";
import { S5SlipGenerator } from "../scenes/S5SlipGenerator";
import { S6ReviewQueue } from "../scenes/S6ReviewQueue";

const PART = 60;
const CARD = 54;
const D4 = 360, D5 = 480, D6 = 360;
export const B_DUR = PART + CARD + D4 + CARD + D5 + CARD + D6; // 1422 = 47.4s

export const VideoB: React.FC<{ lang: Lang }> = ({ lang }) => {
  const fc = featureCards;
  let at = 0;
  const seq = (dur: number) => { const from = at; at += dur; return { from, durationInFrames: dur }; };
  const partA = seq(PART), cA = seq(CARD), s4 = seq(D4), cB = seq(CARD), s5 = seq(D5), cC = seq(CARD), s6 = seq(D6);
  return (
    <AbsoluteFill>
      <Sequence {...partA} name="Part B Title">
        <PartTitleCard lang={lang} kicker={pick(videoTitles.B.kicker, lang)} title={pick(videoTitles.B.title, lang)} sub={pick(videoTitles.B.sub, lang)} />
      </Sequence>
      <Sequence {...cA} name="Card S4"><FeatureCard lang={lang} no={fc.s4.no} title={pick(fc.s4.title, lang)} sub={pick(fc.s4.sub, lang)} /></Sequence>
      <Sequence {...s4} name="S4 Document Chain"><S4DocumentChain lang={lang} /></Sequence>
      <Sequence {...cB} name="Card S5"><FeatureCard lang={lang} no={fc.s5.no} title={pick(fc.s5.title, lang)} sub={pick(fc.s5.sub, lang)} /></Sequence>
      <Sequence {...s5} name="S5 Slip Generator"><S5SlipGenerator lang={lang} /></Sequence>
      <Sequence {...cC} name="Card S6"><FeatureCard lang={lang} no={fc.s6.no} title={pick(fc.s6.title, lang)} sub={pick(fc.s6.sub, lang)} /></Sequence>
      <Sequence {...s6} name="S6 Review Queue"><S6ReviewQueue lang={lang} /></Sequence>
    </AbsoluteFill>
  );
};
