import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { N1Opening } from "../sales/scenes/N1Opening";
import { N2OpportunityRadar } from "../sales/scenes/N2OpportunityRadar";
import { N3Account360 } from "../sales/scenes/N3Account360";
import { N4Relationship } from "../sales/scenes/N4Relationship";
import { N5SalesCopilot } from "../sales/scenes/N5SalesCopilot";
import { N6MarketPlacement } from "../sales/scenes/N6MarketPlacement";
import { N7Reconciliation } from "../sales/scenes/N7Reconciliation";
import { N8RevenueDashboard } from "../sales/scenes/N8RevenueDashboard";
import { N9Ending } from "../sales/scenes/N9Ending";

// Durations follow the 기획안 §4 timing table exactly (30fps).
//  1 오프닝            0–7s    210
//  2 Opportunity Radar 7–20s   390
//  3 Account 360       20–34s  420
//  4 Relationship      34–48s  420
//  5 Sales Copilot     48–62s  420
//  6 Market Placement  62–74s  360
//  7 Reconciliation    74–91s  510
//  8 Revenue Dashboard 91–105s 420
//  9 엔딩              105–110s 150
const D = [210, 390, 420, 420, 420, 360, 510, 420, 150];

export const SALES_DUR = D.reduce((a, b) => a + b, 0); // 3300 = 110s

// Cumulative start frame for scene i.
const at = (i: number) => D.slice(0, i).reduce((a, b) => a + b, 0);

const SCENES: { name: string; C: React.FC }[] = [
  { name: "1 오프닝", C: N1Opening },
  { name: "2 Opportunity Radar", C: N2OpportunityRadar },
  { name: "3 Account 360", C: N3Account360 },
  { name: "4 Relationship Intelligence", C: N4Relationship },
  { name: "5 AI Sales Copilot", C: N5SalesCopilot },
  { name: "6 Market Placement", C: N6MarketPlacement },
  { name: "7 Reconciliation Center", C: N7Reconciliation },
  { name: "8 Revenue Intelligence", C: N8RevenueDashboard },
  { name: "9 엔딩", C: N9Ending },
];

export const VideoSales: React.FC = () => (
  <AbsoluteFill>
    {SCENES.map((s, i) => (
      <Sequence key={s.name} from={at(i)} durationInFrames={D[i]} name={s.name}>
        <s.C />
      </Sequence>
    ))}
  </AbsoluteFill>
);
