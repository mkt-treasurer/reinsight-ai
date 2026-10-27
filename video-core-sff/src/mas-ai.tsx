/**
 * "Built for the MAS rules" — ~38s film for Singapore fund managers (VC / asset managers), MAS-specific:
 * MAS issued its Guidelines on AI Risk Management on 7 Oct 2026; Sections 3–4 (oversight, identification,
 * inventory, risk materiality) apply from 7 Oct 2027. Fund management is named a higher-risk use.
 * Structure: the four things MAS asks for, ticked one by one by Core's own workflow (inventory → risk rating →
 * reviewer on every answer → inspection pack), then "runs in your office".
 * Same white look as the HK draft (shared chrome from mas-core.tsx), different structure and counter.
 *
 * Sources on screen: MAS Guidelines on AI Risk Management (7 Oct 2026) paras 1.8, 3.4, 4.5, 4.7, 4.12, 5.9;
 * MAS Response to Feedback P017-2025 (7 Oct 2026) paras 3.10, 13.5; Core's Oct 2026 deck and treasurer.net/core.
 * Names, figures and screens are illustrative. Days-left counter is computed for 27 Oct 2026 (345 days).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";
import { BLUE, Bubble, Cap, GREEN, GREY, GREY2, INK, INK2, LINE, MONO, RED, SANS, Stage, Win, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 6;
const DAYS_LEFT = 345; // 27 Oct 2026 → 7 Oct 2027

/* ------------------------------------------------------------------ chrome */

/** Bottom-right: the MAS date and the days left. Red until Core takes over, then ink. */
const Deadline: React.FC<{ red?: boolean; at?: number }> = ({ red = true, at = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", right: 60, bottom: 46, display: "flex", gap: 48, opacity: pIn(frame, at, 10) }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>MAS GUIDELINES APPLY</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: INK, marginTop: 2 }}>7 Oct 2027</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>DAYS LEFT</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: red ? RED : INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{DAYS_LEFT}</div>
      </div>
    </div>
  );
};

/** Small source chip: "MAS Guidelines · para 4.5". */
const Src: React.FC<{ text: string; at: number; x?: number; y?: number; right?: boolean }> = ({ text, at, x = 60, y = 46, right }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", [right ? "right" : "left"]: x, bottom: y, fontFamily: MONO, fontSize: 13, letterSpacing: 1.5, color: GREY, background: "#f3f3f3", borderRadius: 6, padding: "7px 12px", opacity: pIn(frame, at, 10) }}>{text}</div>
  );
};

/** The four asks, as cards. `done` ticks them. */
const ASKS = [
  { n: "①", t: "An inventory of every AI use", s: "purpose · data · owner · risk rating", p: "para 4.5, 4.7" },
  { n: "②", t: "A risk rating per use case", s: "impact · complexity · reliance", p: "para 4.12" },
  { n: "③", t: "Human oversight, logged", s: "who reviewed, what they changed", p: "para 5.9" },
  { n: "④", t: "The board can see it", s: "approve, review, risk appetite", p: "para 3.4" },
];

const AskCard: React.FC<{ i: number; at: number; done?: boolean; x: number; y: number; w?: number; compact?: boolean }> = ({ i, at, done, x, y, w = 780, compact }) => {
  const frame = useCurrentFrame();
  const a = ASKS[i];
  const p = pIn(frame, at, 14);
  const tick = done ? pIn(frame, at + 10, 10) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, display: "flex", alignItems: "center", gap: 22, padding: compact ? "16px 22px" : "22px 28px", borderRadius: 16, background: "#fff", boxShadow: "0 14px 44px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, borderRadius: 999, flexShrink: 0, background: done ? GREEN : "#f1f1f1", color: done ? "#fff" : INK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: compact ? 20 : 26, fontWeight: 800, transform: done ? `scale(${0.8 + tick * 0.2})` : "none" }}>
        {done && tick > 0.5 ? "✓" : a.n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: compact ? 24 : 30, fontWeight: 700, color: INK, letterSpacing: -0.8 }}>{a.t}</div>
        <div style={{ fontSize: compact ? 15 : 18, color: GREY, marginTop: 3 }}>{a.s}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, color: GREY2, whiteSpace: "nowrap" }}>{a.p}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

/** 1 · The document lands. */
const Issued: React.FC = () => {
  const frame = useCurrentFrame();
  const stamp = pIn(frame, 30, 10);
  return (
    <Stage>
      {[2, 1, 0].map((k) => {
        const p = pIn(frame, 4 + (2 - k) * 5, 16);
        return (
          <div key={k} style={{ position: "absolute", left: 560 + k * 22, top: 110 + k * 16, width: 800, height: 620, background: "#fff", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: p * (k === 0 ? 1 : 0.6), transform: `translateY(${(1 - p) * 30}px) rotate(${k * 1.2}deg)`, transformOrigin: "50% 100%" }}>
            {k === 0 ? (
              <div style={{ padding: "48px 56px" }}>
                <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>MONETARY AUTHORITY OF SINGAPORE</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, color: INK, lineHeight: 1.15, marginTop: 18 }}>
                  Guidelines on Artificial Intelligence Risk Management
                </div>
                <div style={{ fontSize: 18, color: GREY, marginTop: 14 }}>for Financial Institutions · 30 pages</div>
                <div style={{ marginTop: 40 }}>
                  {[0.9, 0.75, 0.85, 0.6, 0.8, 0.7].map((w, i) => (
                    <div key={i} style={{ height: 8, width: `${w * 100}%`, background: "#e4e4e4", borderRadius: 4, marginBottom: 16, opacity: pIn(frame, 20 + i * 2, 8) }} />
                  ))}
                </div>
                <div style={{ position: "absolute", right: 48, top: 44, padding: "10px 16px", border: `3px solid ${RED}`, borderRadius: 8, color: RED, fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: 2, transform: `rotate(-8deg) scale(${0.6 + stamp * 0.4})`, opacity: stamp }}>ISSUED 7 OCT 2026</div>
              </div>
            ) : null}
          </div>
        );
      })}
      <Cap at={8}>
        7 Oct 2026. <span style={{ color: RED }}>MAS set the rules</span> for AI.
      </Cap>
      <Deadline at={28} />
    </Stage>
  );
};

/** 2 · Fund management is named higher-risk. */
const HigherRisk: React.FC = () => {
  const frame = useCurrentFrame();
  const hl = pIn(frame, 26, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 260, top: 170, width: 1400, padding: "44px 52px", borderRadius: 18, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 2, 14) }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>MAS · RESPONSE TO FEEDBACK · PARA 3.10</div>
        <div style={{ fontSize: 34, lineHeight: 1.45, color: INK2, marginTop: 20, fontWeight: 500 }}>
          "…controls relating to transparency, explainability, and fairness should be applied with greater rigour for use cases of higher risk materiality, such as credit scoring, insurance underwriting, and the provision of financial advisory or{" "}
          <span style={{ background: `rgba(216,35,42,${0.12 * hl})`, boxShadow: `0 0 0 ${6 * hl}px rgba(216,35,42,${0.12 * hl})`, borderRadius: 4, color: hl > 0.5 ? RED : INK2, fontWeight: 700 }}>fund management services</span>
          …"
        </div>
      </div>
      <Cap at={10}>
        Fund management: <span style={{ color: RED }}>higher risk.</span>
      </Cap>
      <Deadline />
    </Stage>
  );
};

/** 3 · Your analysts already use AI — shadow AI. */
const Shadow: React.FC = () => {
  const frame = useCurrentFrame();
  const tabs = [
    { t: "ChatGPT", q: "Summarise TSMC 3Q26 call — we're 3.9% long, should we add?" },
    { t: "Gemini", q: "Rewrite this IC memo on Project Harbour (Series B, S$12m)" },
    { t: "Claude", q: "Here's our LP list — draft the quarterly letter" },
  ];
  return (
    <Stage>
      {tabs.map((tb, i) => (
        <Win key={tb.t} x={200 + i * 60} y={110 + i * 150} w={1100} h={300} title={`${tb.t.toLowerCase()}.com · personal account`} at={4 + i * 10} rot={i === 1 ? 0.6 : -0.6}>
          <div style={{ padding: "22px 26px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: "#eee", flexShrink: 0 }} />
            <div style={{ fontSize: 22, color: INK, lineHeight: 1.4, background: "#f4f4f4", borderRadius: 14, padding: "12px 18px" }}>{tb.q}</div>
          </div>
          <div style={{ position: "absolute", right: 20, top: 16, fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: RED, border: `1.5px solid ${RED}`, borderRadius: 6, padding: "5px 9px", opacity: pIn(frame, 40 + i * 6, 10) }}>LEFT THE FIRM</div>
        </Win>
      ))}
      <Bubble at={56} who="Mei Lin" role="Compliance" when="Today · 09:12" text="Which AI tools are we actually using? MAS wants a list." dark />
      <Cap at={10}>Your analysts already use AI.</Cap>
      <Src text="Guidelines para 1.9(f): shadow AI · 78% bring their own tools (Microsoft/LinkedIn, 2024)" at={30} />
      <Deadline />
    </Stage>
  );
};

/** 4 · By 7 Oct 2027: four things. */
const Four: React.FC = () => (
  <Stage>
    {ASKS.map((_, i) => (
      <AskCard key={i} i={i} at={6 + i * 10} x={570} y={110 + i * 150} />
    ))}
    <Cap at={10}>
      By 7 Oct 2027: <span style={{ color: RED }}>four things.</span>
    </Cap>
    <Src text="Guidelines para 1.8 · Response para 13.5: Sections 3–4 by 12 months" at={40} />
    <Deadline />
  </Stage>
);

/** 5 · Black card: Core was built for it. */
const BuiltFor: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36, opacity: a, transform: `scale(${0.96 + a * 0.04})` }}>
        <div style={{ display: "flex", alignItems: "center", color: "#fff", fontWeight: 500, fontSize: 120, letterSpacing: 36, paddingLeft: 36, lineHeight: 1 }}>
          C<span style={{ display: "inline-block", margin: "0 36px 0 -8px", marginTop: 3 }}><OMark size={92} color="#fff" /></span>RE
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: -1.5 }}>was built for exactly this.</div>
      </div>
    </Stage>
  );
};

/** 6 · ① Inventory, automatically. */
const Inventory: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    ["Morning brief", "K. Lim", "Local · 70B", "Book · filings · notes", "Higher", "Live"],
    ["Earnings recap", "A. Rahman", "Local · 70B", "Filings · transcripts", "Higher", "Live"],
    ["Rumor check", "A. Rahman", "Local · 70B", "Own notes · data", "Higher", "Live"],
    ["IC memo draft", "K. Lim", "Local · 70B", "Data room · past memos", "Higher", "Pilot"],
    ["Meeting notes", "ops", "Cloud · under agreement", "Internal only", "Basic", "Live"],
  ];
  return (
    <Stage>
      <AskCard i={0} at={0} done x={60} y={40} w={560} compact />
      <Win x={660} y={60} w={1200} h={600} title="core · compliance · AI use-case inventory" at={8}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px 12px", borderBottom: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>AI use-case inventory</div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 6, padding: "5px 9px", opacity: pIn(frame, 60, 10) }}>UPDATED FROM THE LOG · TODAY</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 1.1fr 1.4fr 0.7fr 0.6fr", padding: "10px 24px", fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, color: GREY, borderBottom: `1px solid ${LINE}` }}>
          {["USE CASE", "OWNER", "MODEL", "DATA", "RISK", "STATUS"].map((h) => <span key={h}>{h}</span>)}
        </div>
        {rows.map((r, i) => {
          const p = pIn(frame, 20 + i * 7, 10);
          return (
            <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 1.1fr 1.4fr 0.7fr 0.6fr", alignItems: "center", padding: "0 24px", height: 74, borderBottom: `1px solid ${LINE}`, fontSize: 19, color: INK2, opacity: p, transform: `translateX(${(1 - p) * 12}px)` }}>
              <span style={{ fontWeight: 700, color: INK }}>{r[0]}</span>
              <span>{r[1]}</span>
              <span>{r[2]}</span>
              <span>{r[3]}</span>
              <span style={{ color: r[4] === "Higher" ? RED : GREY, fontWeight: 700 }}>{r[4]}</span>
              <span style={{ color: r[5] === "Live" ? GREEN : GREY, fontWeight: 600 }}>{r[5]}</span>
            </div>
          );
        })}
      </Win>
      <Cap at={10}>
        <span style={{ color: GREEN }}>①</span> Every use, inventoried. From the log.
      </Cap>
      <Src text="Guidelines para 4.7: purpose · data · owner · risk rating · status" at={44} />
      <Deadline red={false} />
    </Stage>
  );
};

/** 7 · ② Rated on MAS's three dimensions. */
const Rating: React.FC = () => {
  const frame = useCurrentFrame();
  const dims = [
    { k: "Impact", v: "High", why: "The desk trades on it", n: 0.9, c: RED },
    { k: "Complexity", v: "Medium", why: "Local model · every figure cited", n: 0.55, c: "#d97706" },
    { k: "Reliance", v: "Low", why: "A reviewer signs before use", n: 0.25, c: GREEN },
  ];
  return (
    <Stage>
      <AskCard i={1} at={0} done x={60} y={40} w={560} compact />
      <div style={{ position: "absolute", left: 660, top: 60, width: 1200, padding: "30px 36px 34px", borderRadius: 18, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 8, 14) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: INK }}>Earnings recap <span style={{ fontWeight: 400, color: GREY, fontSize: 18 }}>· risk materiality</span></div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREY }}>ASSESSED BY COMPLIANCE · 2 MIN</div>
        </div>
        {dims.map((d, i) => {
          const p = pIn(frame, 22 + i * 14, 14);
          const bar = lin(frame, 26 + i * 14, 46 + i * 14, 0, d.n);
          return (
            <div key={d.k} style={{ display: "grid", gridTemplateColumns: "190px 1fr 140px", alignItems: "center", gap: 24, marginTop: i ? 22 : 30, opacity: p }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: INK }}>{d.k}</div>
                <div style={{ fontSize: 15, color: GREY, marginTop: 2 }}>{d.why}</div>
              </div>
              <div style={{ height: 14, borderRadius: 99, background: "#efefef", overflow: "hidden" }}>
                <div style={{ width: `${bar * 100}%`, height: "100%", background: d.c, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: d.c, textAlign: "right" }}>{d.v}</div>
            </div>
          );
        })}
        <div style={{ marginTop: 30, paddingTop: 22, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 16, opacity: pIn(frame, 72, 12) }}>
          <span style={{ padding: "8px 14px", borderRadius: 999, background: RED, color: "#fff", fontSize: 17, fontWeight: 700 }}>Higher risk</span>
          <span style={{ fontSize: 19, color: INK2 }}>Lifecycle controls applied now, not in 2028.</span>
        </div>
      </div>
      <Cap at={10}>
        <span style={{ color: GREEN }}>②</span> Rated on MAS's three dimensions.
      </Cap>
      <Src text="Guidelines para 4.12: impact · complexity · reliance" at={44} />
      <Deadline red={false} />
    </Stage>
  );
};

/** 8 · ③ A reviewer's name on every answer. */
const Reviewer: React.FC = () => {
  const frame = useCurrentFrame();
  const hl = pIn(frame, 30, 10);
  const rev = pIn(frame, 56, 12);
  return (
    <Stage>
      <AskCard i={2} at={0} done x={60} y={40} w={560} compact />
      <Win x={660} y={60} w={1200} h={620} title="core · ask · TSMC 3Q26 recap" at={8}>
        <div style={{ padding: "22px 28px 0" }}>
          <div style={{ fontSize: 17, color: GREY }}>Q · What were the key takeaways from TSMC's 3Q26 results, and what does it mean for our position?</div>
          <div style={{ fontSize: 26, color: INK, lineHeight: 1.5, marginTop: 18 }}>
            Third-quarter revenue was{" "}
            <span style={{ background: `rgba(47,107,255,${0.14 * hl})`, boxShadow: `0 0 0 ${5 * hl}px rgba(47,107,255,${0.14 * hl})`, borderRadius: 4, fontWeight: 700 }}>$46.72 billion</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, padding: "3px 10px 3px 4px", borderRadius: 999, background: "#f3f4f6", fontSize: 14, color: INK2, opacity: hl }}>
              <span style={{ background: BLUE, color: "#fff", borderRadius: 5, padding: "1px 7px", fontWeight: 700 }}>9</span>3Q26 EarningsRelease.pdf · p.1
            </span>
            , above the top of July's guide. Gross margin{" "}
            <span style={{ fontWeight: 700 }}>66.4%</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, padding: "3px 10px 3px 4px", borderRadius: 999, background: "#f3f4f6", fontSize: 14, color: INK2, opacity: hl }}>
              <span style={{ background: BLUE, color: "#fff", borderRadius: 5, padding: "1px 7px", fontWeight: 700 }}>11</span>Presentation.pdf · p.6
            </span>
            . Our long is <span style={{ fontWeight: 700 }}>3.9% of NAV</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, padding: "3px 10px", borderRadius: 999, background: "rgba(216,35,42,0.08)", fontSize: 14, color: RED, fontWeight: 700, opacity: pIn(frame, 42, 10) }}>computed · no source — check</span>
            .
          </div>
          <div style={{ fontSize: 22, color: INK2, lineHeight: 1.5, marginTop: 16, opacity: pIn(frame, 36, 12) }}>
            Fourth-quarter guide is $52.3–54.3 billion, with 2nm share of wafer revenue rising to 8%. Margins drift down on the 2nm ramp and overseas fabs, not demand. The near-term earnings path looks intact, which supports holding the long.
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, opacity: pIn(frame, 44, 12) }}>
            {["Sources 5 · 2 internal", "3 figures computed · 1 flagged", "Demo data"].map((x) => (
              <span key={x} style={{ padding: "6px 12px", borderRadius: 999, background: "#f3f4f6", fontSize: 14, color: INK2 }}>{x}</span>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", left: 28, right: 28, bottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 12, background: "#f7f7f7", opacity: rev, transform: `translateY(${(1 - rev) * 10}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>ML</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Reviewed by Mei Lin · Compliance</div>
              <div style={{ fontSize: 14, color: GREY }}>Today 09:41 · changed 1 figure · logged #12,288</div>
            </div>
          </div>
          <span style={{ padding: "9px 16px", borderRadius: 999, background: INK, color: "#fff", fontSize: 16, fontWeight: 700 }}>Approve for the desk</span>
        </div>
      </Win>
      <Cap at={10}>
        <span style={{ color: GREEN }}>③</span> A reviewer's name on every answer.
      </Cap>
      <Src text="Guidelines para 5.9(d): document logs of human oversight · every figure cites its page" at={44} />
      <Deadline red={false} />
    </Stage>
  );
};

/** 9 · ④ One download for the board. Or MAS. */
const Pack: React.FC = () => {
  const frame = useCurrentFrame();
  const files = [
    ["model-card.pdf", "Which model, where it ran, how it was tuned"],
    ["controls.pdf", "Data · testing · human oversight · cyber"],
    ["ai-inventory.xlsx", "5 use cases · owners · risk ratings"],
    ["answer-log.csv", "12,288 answers · sources · reviewer"],
  ];
  const click = pIn(frame, 18, 8);
  return (
    <Stage>
      <AskCard i={3} at={0} done x={60} y={40} w={560} compact />
      <div style={{ position: "absolute", left: 660, top: 90, width: 520, padding: "28px 30px", borderRadius: 18, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 6, 14) }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>CORE · COMPLIANCE</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: INK, letterSpacing: -1, marginTop: 10 }}>Inspection pack</div>
        <div style={{ fontSize: 17, color: GREY, marginTop: 6 }}>Everything MAS or the board would ask for, from your own machine.</div>
        <div style={{ marginTop: 26, display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", borderRadius: 999, background: INK, color: "#fff", fontSize: 19, fontWeight: 700, transform: `scale(${1 - click * 0.04})` }}>
          ↓ Download · one file
        </div>
      </div>
      <div style={{ position: "absolute", left: 1230, top: 90, width: 630 }}>
        {files.map(([f, d], i) => {
          const p = pIn(frame, 30 + i * 9, 12);
          return (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 22px", borderRadius: 14, background: "#fff", boxShadow: "0 12px 36px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", marginBottom: 14, opacity: p, transform: `translateX(${(1 - p) * 24}px)` }}>
              <div style={{ width: 40, height: 48, borderRadius: 6, background: "#f1f1f1", border: `1px solid ${LINE}`, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: INK }}>{f}</div>
                <div style={{ fontSize: 15, color: GREY, marginTop: 3 }}>{d}</div>
              </div>
            </div>
          );
        })}
      </div>
      <Bubble at={74} i={0} who="David Tan" role="Managing Partner" when="Today · 10:02" text="Board pack for Thursday — just attach it." dark />
      <Cap at={10}>
        <span style={{ color: GREEN }}>④</span> One download for the board. Or MAS.
      </Cap>
      <Src text="Guidelines para 3.4: the board approves and reviews · para 4.7: links to documentation" at={44} />
      <Deadline red={false} />
    </Stage>
  );
};

/** 10 · Runs in your office. */
const Office: React.FC = () => {
  const frame = useCurrentFrame();
  const box = pIn(frame, 6, 16);
  const cross = pIn(frame, 40, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 300, top: 120, width: 1320, height: 560, borderRadius: 24, border: `2px dashed ${GREY2}`, opacity: pIn(frame, 2, 12) }}>
        <div style={{ position: "absolute", left: 28, top: -14, background: "#fff", padding: "0 12px", fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>YOUR OFFICE · 1 RAFFLES PLACE</div>
        <div style={{ position: "absolute", left: 80, top: 150, width: 300, height: 220, borderRadius: 18, background: INK, boxShadow: "0 24px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: box, transform: `scale(${0.9 + box * 0.1})` }}>
          <div style={{ display: "flex", alignItems: "center", color: "#fff", fontWeight: 500, fontSize: 40, letterSpacing: 12, paddingLeft: 12 }}>
            C<span style={{ display: "inline-block", margin: "0 12px 0 -3px", marginTop: 2 }}><OMark size={31} color="#fff" /></span>RE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: "#9a9a9a" }}>DGX SPARK · LOCAL MODEL</div>
        </div>
        {["Documents", "The book", "Notes", "Answers", "The log"].map((k, i) => {
          const p = pIn(frame, 16 + i * 5, 10);
          return (
            <div key={k} style={{ position: "absolute", left: 480 + (i % 3) * 260, top: 150 + Math.floor(i / 3) * 110, padding: "16px 22px", borderRadius: 12, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", fontSize: 21, fontWeight: 600, color: INK, opacity: p }}>{k}</div>
          );
        })}
        <div style={{ position: "absolute", left: 480, top: 400, fontSize: 19, color: INK2, opacity: pIn(frame, 46, 12) }}>
          Stays here. <span style={{ color: GREY }}>You choose what leaves — down to nothing.</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1640, top: 370, display: "flex", alignItems: "center", gap: 10, opacity: cross }}>
        <span style={{ fontSize: 34, color: RED, fontWeight: 800 }}>✕</span>
        <span style={{ fontSize: 17, color: GREY, width: 200 }}>Public AI · someone else's servers</span>
      </div>
      <Cap at={10}>Runs in your office.</Cap>
      <Src text="Guidelines para 2.5(b): no confidential data into public AI tools" at={44} />
      <Deadline red={false} />
    </Stage>
  );
};

/** 11 · Done, 345 days early. */
const Done: React.FC = () => (
  <Stage>
    {ASKS.map((_, i) => (
      <AskCard key={i} i={i} at={2 + i * 6} done x={570} y={110 + i * 150} />
    ))}
    <Cap at={30}>
      Done. <span style={{ color: GREEN }}>{DAYS_LEFT} days early.</span>
    </Cap>
    <Deadline red={false} />
  </Stage>
);

/** 12 · End card. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 14), b = pIn(frame, 16, 14), c = pIn(frame, 28, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: "50%", top: 320, transform: `translateX(-50%) scale(${0.94 + a * 0.06})`, opacity: a }}>
        <Lockup size={110} color={INK} subColor="#5c5c5c" dot={BLUE} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 630, textAlign: "center", fontSize: 32, fontWeight: 600, color: INK, opacity: b }}>Built for the MAS rules.</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 680, textAlign: "center", fontSize: 20, color: GREY, opacity: b }}>See it on your own filing. Twenty minutes, every figure traced to its page.</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 745, display: "flex", justifyContent: "center", opacity: c }}>
        <span style={{ padding: "14px 28px", borderRadius: 999, background: INK, color: "#fff", fontSize: 20, fontWeight: 700 }}>Request a demo →</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: GREY, opacity: c }}>treasurer.net/core</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASAI_SCENES: S[] = [
  { id: "issued", dur: 3.2, body: Issued },
  { id: "higher-risk", dur: 3.4, body: HigherRisk },
  { id: "shadow", dur: 3.6, body: Shadow },
  { id: "four", dur: 4.0, body: Four },
  { id: "built-for", dur: 2.2, body: BuiltFor },
  { id: "inventory", dur: 3.8, body: Inventory },
  { id: "rating", dur: 3.8, body: Rating },
  { id: "reviewer", dur: 3.8, body: Reviewer },
  { id: "pack", dur: 3.8, body: Pack },
  { id: "office", dur: 3.2, body: Office },
  { id: "done", dur: 2.8, body: Done },
  { id: "end", dur: 3.2, body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
export const MASAI_FRAMES = MASAI_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? CUT : 0), 0);

export const MasAi: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff", fontFamily: SANS }}>
    <TransitionSeries>
      {MASAI_SCENES.flatMap((s, i) => {
        const Body = s.body;
        const nodes: React.ReactNode[] = [];
        if (i > 0) nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: CUT })} />);
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body />
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
