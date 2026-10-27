# video-core-sff

30-second promo for **Core by Treasurer**, made for the Singapore FinTech Festival booth.
Gold-on-black motion graphics alternate with muted clips from `core-demo-draft7.mp4`.
Reads fully with sound off.

## Structure

| # | Scene | What happens |
|---|-------|--------------|
One function, one story: the guidance tracker, told as problem → solution. (Rumor check is a
separate film.)

| # | Scene | What happens |
|---|-------|--------------|
| 1 | Intro (native, 2s) | Glowing tile with the O mark, then the vector lockup with a gold light sweep |
| 2 | Print day (native) | Typed headline; the PM's two questions land one by one and hold for 3s+ |
| 3 | Problem (native) | "Normally, that's the analyst's whole morning." Clock races, filings and old notes pile up |
| 4 | The ask | Typed prompt: "Build a guidance tracker for NVDA, with what our previews expected." |
| 5 | Tracker (zoom) | The real report frozen (`public/tracker.png`, demo @ 16.0s); the camera moves over the three kinds of answer with gold boxes and numbered labels: the verdict sentence, the stat tiles, the sources panel |
| 6 | Answer 1 | Guide vs ours cards, then the verdict strip: 3 of 3 printed above range, so we likely run low |
| 7 | Answer 2 | Previews vs the print: (1.9%) avg, low 2 of 2, from our own notes |
| 8 | Sources | 7 sources, 4 public filings + the internal preview note in gold |
| 9 | Done | 00:00 → 06:00 counter; 2 questions · 1 request · 0 manual steps |
| 10 | Private (native) | "Nothing leaves the firm." + three one-line tiles |
| 11 | End (footage) | "Ask. It's done." lockup, kept as the final shot |

Footage-backed scenes ("beats", `src/scenes/Beats.tsx`) follow the reference ad's pattern: the demo
footage is pushed back as a blurred, dimmed, slowly tilting 3D stage (cropped so its burned-in caption
is off-frame), with one serif headline on top and native animated cards in front. Every cut has a
transition: fade, slide, wipe, or the gold hairline wipe in `src/transitions.tsx`. Captions never
overlap: each fades out (0.2s) before the transition and the next fades in (0.3s) after it
(`captionWindow` in `src/timeline.ts`).

```
public/clips/core-demo-draft7.mp4   source demo (not committed) — see "Source prep" below
public/tracker.png                  still of the demo @ 16.0s for the zoom scene (not committed; see below)
public/music.mp3                    optional, picked up automatically by `npm run render`
src/Lockup.tsx                      Core by Treasurer lockup as text + SVG (sharp at any size)
src/fontData.ts                     embedded Pretendard, copied from video-treasurer-pr30
src/cut.json                        the cut: scenes, clip in/out points, headline copy, transitions
```

```bash
npm install
npm run render     # -> out/core-sff-30s.mp4
npm run frames     # -> out/frames/NN-<scene>.jpg + sheet.jpg, one still per scene
npm run studio     # live preview
```

## TSMC 3Q26 film (~40s)

Composition `Tsmc` (`src/tsmc-ref.tsx`): the 12-scene story (setup → ask → answer → payoff) in the
look of the "SK hynix rumor check" film: near-black navy stage, Core's page inside a browser window,
the page dims while a white card pops out with a "| label", captions bottom-centre in serif with a
tiny gold kicker, an orange-gold stamp, and the same outro (dust → CORE sphere wordmark → TREASURER.).
Scenes: the press release, ten pages stacking up, the question typed into the real page (sharp),
Core reading the release / last quarter's forecast / your book, the verdict first, revenue vs
forecast, next quarter's guide, the 2nm reason, your position (DEMO FUND), a cursor clicking a
citation open to the source sentence (sharp), the release stamped BEAT ✓, outro. ~36s.
Captions ≤ 10 words; "4.8%" never shown. `TsmcGold` (`src/tsmc-gold.tsx`) is the same story in the
booth film's gold-on-black style.

`TsmcLight` (`src/tsmc.tsx`) is the earlier take in the "Core · check a rumor" LinkedIn style: light
stage, answer page full-frame, continuous zoom-ins, cursor click into the source. Kept for reference;
its `AnswerPage` is what the gold film uses as its stage. Figures in both are from TSMC's Oct 15, 2026
release (investor.tsmc.com).

Deliberately left out: "% vs midpoint" (Core's figure used the low end of the range) and the
broker/consensus paragraph (licensed data). The position line is stamped DEMO FUND.

```bash
COMP=Tsmc OUT=core-tsmc-40s.mp4 npm run render
```

## Source prep

Remotion's compositor intermittently fails on the raw export with "No frame found at position"
(seeks between keyframes). Re-encode it once as all-keyframes before rendering; seeking then
never misses. This also drops the audio, which the film mutes anyway:

```bash
ffmpeg -i ~/Downloads/core-demo-draft7.mp4 -vf "fps=30,format=yuv420p" -an -c:v libx264 -preset fast -crf 16 -g 1 -keyint_min 1 -movflags +faststart public/clips/core-demo-draft7.mp4
```

The zoom scene uses a frozen frame of the report:

```bash
ffmpeg -ss 16.0 -i public/clips/core-demo-draft7.mp4 -frames:v 1 public/tracker.png
```


## MAS film — Singapore back-office (30s)

Composition `Mas` (`src/mas.tsx`): the Singapore counterpart of the Korean FSS film
(`../video-wooricard-fss`, same house look — navy stage, blue grid, mono kickers, four-step flow bar), in
English, for fund managers that report to MAS. Target: VC / fund-management back office in Singapore.

| # | Scene | What happens |
|---|-------|--------------|
| 1 | Hook | Marina Bay at night. "Your MAS returns, done in minutes." Form 1 · Form 2 (MASNET, quarterly) / Form 25A (MAS-Tx, annual) |
| 2 | The clock | "Every quarter. 14 days after quarter end." 30 Sep → 14 Oct; Forms 1–6 annual within 5 months; VCFM Form 25A within 1 month; the July 2025 licence revocation that cited unfiled quarterly returns |
| 3 | Collect | Ledger · fund admin NAV · bank statements · Excel → one source |
| 4 | Map | "Cash at bank / CASH_EQV / Bank balances" → the Form 1 line item, mapped once |
| 5 | Check | Light stage: ledger vs Form 1 in S$, one mismatch flagged and traced, everything else passes |
| 6 | Lodge | One checked data set → Form 1 and Form 2, READY for MASNET |
| 7 | Payoff | 2 hours → 2 minutes, per form, per quarter |
| 8 | Outro | TREASURER wordmark · "MAS returns, collected to lodged." · treasurer.net |

Facts were checked on mas.gov.sg on 27 Oct 2026: *FAQs on Lodgement of Financial Returns* (Forms 1–9,
deadlines), *Form 25A – Annual Declaration by a Venture Capital Fund Manager* (one month from FYE, MAS-Tx),
*Enforcement actions 2025 – revokes the capital markets services licence* (3 Jul 2025; quarterly returns for
FY2024 and the quarter ended 31 Mar 2025 not submitted, among other breaches). The CHECK table is illustrative
and labelled so. "2 hours → 2 minutes" is the team's own claim from the 26 Oct 2026 strategy meeting.

B-roll: two Pexels clips (free for commercial use, no credit required), not committed —
`npm run sg-broll` fetches and re-encodes them into `public/clips/` (reads `PEXELS_API_KEY` from the
environment or `../video-wooricard-fss/.env`):

- 30570498 — Singapore city skyline at night, reflections (Timo Volz)
- 33702866 — Aerial view of Singapore's skyline (Florian Delée)

```bash
npm run sg-broll
COMP=Mas OUT=treasurer-mas-30s.mp4 npm run render
```

### MasCore — the same story in the HK draft's look (40s)

Composition `MasCore` (`src/mas-core.tsx`) replaces the navy "slide" look above with the look of the HK
front-office draft (`HK_Front(심사역)_vid_초안.mp4`): white stage, one bold line at the bottom, UI mockups
doing the explaining, chat bubbles top-right, a running counter bottom-right, hard cuts. ~40.0s.

| t | Scene | On screen | Line |
|---|---|---|---|
| 0:00 | quarter-end | Calendar flips to 30 Sep; inbox with the MAS reminder highlighted | Quarter end. → **14 days** to lodge. |
| 0:03 | sources | Five windows pile up: trial balance, NAV pack, bank statements, `…_v7_FINAL_final2.xlsx`, last quarter's Form 1 | Ledger. Admin. Bank. Excel. |
| 0:06 | retype | Form 1 template; a cursor types the numbers cell by cell from the ledger window | Retyped. Cell by cell. |
| 0:09 | formulas | `Form2_TRR_Priya_v12.xlsx — personal`; the C14 formula types out; "I'm the only one who knows how C14 works" | Form 2. One person's formulas. |
| 0:12 | tie | 6,466,087 vs 6,464,883, DIFFERENCE −1,204 "somewhere in 5 files" | Doesn't tie. **Again.** |
| 0:15 | day12 | DAY 12 of 14 · 02:07 AM; Managing Partner: "I'm the one signing this. Lodged on MASNET yet?" | Day 12. **Still not lodged.** |
| 0:17 | stakes (black) | July 2025. A CMS licence revoked. Among the reasons: quarterly returns not submitted. → What if it took **2 minutes**? | |
| 0:21 | meet | CORE lockup | Meet CORE |
| 0:23 | reads | The six sources roll, then orbit a black CORE disc; LINES READ / ELAPSED start | Reads every source. → All at once. |
| 0:27 | maps | Ledger and admin names → Form 1 line items with ✓; TRR computed from the rules | Maps every account to the MAS line. |
| 0:30 | gap | Check list, one red row; traced to `Q3_NAV_pack_FINAL.pdf · p.31 · row 212` with two buttons | Flags the one gap. Shows where. |
| 0:33 | ready | Form 1 and Form 2 cards, READY · MASNET, 0 open items; chip: VCFM? Form 25A, once a year — same pipeline | Form 1. Form 2. **2 minutes.** |
| 0:36 | you | "Lodged on MASNET · Day 1 · 10:14" | You review. You lodge. |
| 0:38 | end | CORE by TREASURER. · MAS returns in 2 minutes. · Book a demo → | |

Problem-half ELAPSED runs 00:00:00 → 290 h (12 days); solution-half ELAPSED runs to 00:02:00. All names,
messages and figures are invented; the MAS facts are the ones listed above.

```bash
COMP=MasCore OUT=treasurer-mas-core.mp4 npm run render
```

### MasAi — the MAS-specific story: the AI Risk Management Guidelines (38.6s)

Composition `MasAi` (`src/mas-ai.tsx`). The returns story above (Form 1/2 → MASNET) belongs to Treasurer's
regulatory-reporting module, not to Core. Core's own MAS story, per the Oct 2026 deck and treasurer.net/core,
is the **MAS Guidelines on AI Risk Management**, issued 7 Oct 2026: Sections 3–4 (oversight, identification,
inventory, risk materiality) apply from 7 Oct 2027, Sections 5–6 by 7 Oct 2028; fund management is named a
higher-risk use (Response para 3.10). Structure: the four things MAS asks for, ticked one by one by Core.

| t | Scene | On screen | Line |
|---|---|---|---|
| 0:00 | issued | The Guidelines document, stamped ISSUED 7 OCT 2026; counter "7 Oct 2027 · 345 days left" | 7 Oct 2026. MAS set the rules for AI. |
| 0:03 | higher-risk | Quote card, Response para 3.10, "fund management services" highlighted | Fund management: higher risk. |
| 0:06 | shadow | Three personal ChatGPT/Gemini/Claude tabs with the fund's positions and LP list pasted in; LEFT THE FIRM; compliance asks for the list | Your analysts already use AI. |
| 0:10 | four | ① inventory (4.5, 4.7) ② risk rating: impact · complexity · reliance (4.12) ③ human oversight, logged (5.9) ④ the board can see it (3.4) | By 7 Oct 2027: four things. |
| 0:13 | built-for (black) | CORE was built for exactly this. | |
| 0:16 | inventory | Core's AI use-case inventory table (use case · owner · model · data · risk · status), updated from the log | ① Every use, inventoried. From the log. |
| 0:19 | rating | "Earnings recap" rated: Impact High, Complexity Medium, Reliance Low → Higher risk, controls now | ② Rated on MAS's three dimensions. |
| 0:23 | reviewer | Core answer page: $46.72B cites its page, a computed figure flagged "no source", Reviewed by Mei Lin · logged #12,288 | ③ A reviewer's name on every answer. |
| 0:27 | pack | Inspection pack → model-card.pdf · controls.pdf · ai-inventory.xlsx · answer-log.csv; partner: "attach it to the board pack" | ④ One download for the board. Or MAS. |
| 0:30 | office | The Core box in your office; documents, book, notes, answers, log stay; public AI crossed out | Runs in your office. |
| 0:34 | done | The four cards, all ticked | Done. 345 days early. |
| 0:36 | end | CORE by TREASURER · Built for the MAS rules · Request a demo → · treasurer.net/core | |

Each step scene carries a source chip with the paragraph it answers. Guideline text is quoted from the MAS
PDFs (7 Oct 2026); the 78% "bring their own tools" figure is the Microsoft/LinkedIn Work Trend Index figure
used in Core's deck. Names, screens and figures are illustrative; the TSMC figures are the ones in the TSMC film.

```bash
COMP=MasAi OUT=treasurer-mas-ai.mp4 npm run render
```

### MasReturns — the back-office story, done right (39.8s) ← current

Composition `MasReturns` (`src/mas-returns.tsx`). Treasurer brand (the regulatory-reporting engine behind the
FSS film), not Core. White look shared with `mas-core.tsx`, but its own spine: a 14-day bar across the top from
"Q3 ended · 30 Sep" to "Due · MAS-Tx · 14 Oct". Without Treasurer the marker crawls to Day 12; with Treasurer
every step happens on Day 1.

| t | Scene | On screen | Line |
|---|---|---|---|
| 0:00 | quarter-end | MAS-Tx "Regular Data Returns": Form 1, Form 2, due 14 Oct, not submitted | Two forms. Fourteen days. |
| 0:03 | what-mas-asks | Form 1 and Form 2 as documents with the real line labels: (5) Trade debtors for fund management, (9)(b) Deposits with banks and cash balances — own, (13) Other current assets; base capital, deductions from FR, ORR = 5% of AAGI min S$100,000, FR/TRR ≥ 120% | MAS's line items. MAS's formulas. |
| 0:07 | files | Trial balance, NAV pack, three years of audited P&L (for AAGI), bank statements, last quarter as lodged, the personal TRR workbook; "Which revenue goes into AAGI?" | Six files. Three years. One spreadsheet. |
| 0:11 | day12 | TRR and FR/TRR cells show #REF!; Priya deleted the FY23 tab; the partner asks about the 120% test | Day 12. FR/TRR: #REF! |
| 0:14 | reset | Bar resets to Day 1 | The same quarter, in Treasurer. |
| 0:16 | reads | ① each MAS line → what it needs → the rule (Form 1 notes, SFA 04-N13 4.1.2–4.1.4, 3.1.1) | Reads what every MAS line needs. |
| 0:19 | maps | ② chart of accounts → MAS line (1010/1012/1015 → (9)(b); 1200/1210 → (5); 1900/1950 → Form 2 deductions) | Maps every account to a MAS line. Once. |
| 0:23 | computes | ③ AAGI = avg of 3 FYs = 5,599,000 → ORR = max(5%, 100,000) = 279,950 → TRR → FR 3,200,118 → FR/TRR 1,143%, above 120% | Form 2 by SFA 04-N13. Not by a macro. |
| 0:26 | checks | ④ ties to GL, balances, base capital = Form 1 items, trust money excluded; one +38% jump explained with its NAV-pack row | Ties to the ledger. Explains every jump. |
| 0:30 | filled | ⑤ Form 1 and Form 2 filled, cells highlighted; Export for MAS-Tx · working file with sources | MAS's form, filled. Day 1. |
| 0:33 | spare | Reviewed · signed · lodged on MAS-Tx, 1 Oct; chips: annual Forms 1–6, VCFM Form 25A, FSS 업무보고서 already live | Review. Lodge. Thirteen days to spare. |
| 0:36 | end | ◆ TREASURER · MAS returns, collected to lodged. · treasurer.net | |

MAS facts (checked 27 Oct 2026): Form 1 / Form 2 quarterly within 14 days, annually within 5 months, submitted
online via **MAS-Tx** (the mas.gov.sg form pages; the Aug 2024 LFMC compliance toolkit still lists MASNET).
Line labels are from the post-2018 Form 1 and Form 2 PDFs. Operational risk requirement: SFA 04-N13 paras
4.1.2–4.1.4 (5% of average annual gross income over the 3 preceding FYs, 2% above S$10m, floor S$100,000 or
S$50,000 for A/I-only). FR must not fall below TRR; notify MAS immediately below 120% (para 3.1.1). All names
and figures are illustrative. The engine claim ("same engine as our FSS module, new template") is the roadmap
position agreed on 27 Oct 2026, not a shipped feature.

```bash
COMP=MasReturns OUT=treasurer-mas-returns.mp4 npm run render
```

### MasFinal — the cut we ship (40.3s) ← current

Composition `MasFinal` (`src/mas-final.tsx`). Georgia serif throughout, plain white, Core's app window that
stays put while its content crossfades, a before/after bar, a sign-and-submit scene, the Core end card.
Captions leave before each 0.47s crossfade and arrive after it, so two captions are never on screen together.

| t | Scene | Line | Picture |
|---|---|---|---|
| 0:00 | opening | Two MAS forms to fill every quarter end / *still doing it by hand?* | Form 1 (balance sheet) and Form 2 (capital test) |
| 0:04 | escalation | Miss the deadline and it escalates | Clock keeps spinning, Day 14 → 60; a reminder → then scrutiny → then a fine |
| 0:06 | by-hand | One person in finance retypes every number, every quarter | Ledger · Bank · Admin → Priya → numbers hop into a real-looking sheet |
| 0:10 | capital-test | The capital test — every quarter MAS checks your capital against its minimum | Bars: MAS's minimum (5% of average income, S$0.28m) vs your capital (S$3.2m); the 120% notify line; 3.2m ÷ 0.28m = 1,143% |
| 0:13 | wrong-but-fine | Excel doesn't know MAS's rules — a wrong number looks right until MAS checks | Sheet shows 1,290% ✓ with no deductions; MAS's rule (Form 2 (II)(2)) deducts prepaid rent, office fit-out, a related-company loan → 1,143% ✗ "what you filed was wrong" |
| 0:17 | core | CORE by TREASURER | Black card |
| 0:18 | screen-1 | 01 · Your ledger, bank and admin files go in — the two MAS forms come out | Files into the Core disc; Form 1, Form 2 out with ✓; Export for MAS-Tx |
| 0:22 | screen-2 | 02 · The capital test, computed exactly the way MAS writes it | Rule: capital must not fall below 5% × 3-yr average income; under 120% of that, tell MAS immediately (SFA 04-N13 3.1.1 / 4.1.2); numbers; 1,143% ✓ |
| 0:26 | screen-3 | 03 · Tracked monthly, so you're warned months before you'd have to tell MAS | Monthly ratio vs the 120% notify line; Warning · June; why it's falling (dividend, two loss quarters) |
| 0:29 | screen-4 | 04 · Two forms each quarter, the audited set once a year — all from one mapping | Q1–Q4 (2 forms, by the 14th) + Year end (audited set, by 31 May for a Dec FYE) |
| 0:32 | compare | From twelve days to one | By hand: 12-day red bar · With Core: 1-day blue bar (illustrative) |
| 0:35 | sign | You review and sign — it's ready to submit on MAS-Tx | Signature draws; READY · MAS-Tx stamp |
| 0:38 | close | Less retyping, more running the fund | Serif |
| 0:39 | end | CORE by TREASURER · Book a demo → · Runs in your VPC or on-prem. Your data never leaves. | |

**Fact base (mas.gov.sg, checked 27 Oct 2026).** Form 1 / Form 2 quarterly within 14 days and the audited set
within 5 months of FYE, online via MAS-Tx (form pages; Reg 27 SF(FMR)R; late lodgement is an offence liable
to a fine, Reg 27(7)/(10) per MAS's FAQ). ORR = 5% of 3-year average annual gross income (2% above S$10m),
floor S$100,000 or S$50,000 for A/I-only (SFA 04-N13 4.1.2–4.1.4). FR must not fall below TRR; notify MAS
immediately below 120% (3.1.1). Deductions from financial resources include non-current assets, pre-paid
expenses and unsecured amounts due from related corporations (Form 2 (II)(2)). CMS licence revoked 3 Jul 2025
citing unfiled quarterly returns among other breaches.

**Who it is true for.** Licensed fund management companies (retail and A/I LFMCs), which since 1 Aug 2024
includes every former RFMC. **Not** managers under the VCFM regime: they are exempt from Part III of the
SF(FMR)R, hold no risk-based capital requirement, and file only Form 25A once a year (Guidelines SFA 04-G05
Annex A7; VCFM compliance toolkit, Jan 2023). A VCFM audience needs a different film.

**What is positioning, not product.** Everything after the Core card: Core today is a research product; the
form engine exists for the Korean FSS 업무보고서 with no MAS template; monthly tracking is not built.
"Twelve days to one" is illustrative. Names and figures are invented. The end-card line about VPC/on-prem is
Treasurer's own and holds only for the local-model configurations.

```bash
COMP=MasFinal OUT=treasurer-mas-final.mp4 npm run render
```

### MasVc — the VC version (40.3s) ← current for the VC 심사역 target

Composition `MasVc` (`src/mas-vc.tsx`). Same look and spine as `MasFinal`, but built for what a VCFM-regime VC
manager actually files: **Form 25A**, once a year, within one month of financial year end, on MAS-Tx. VCFMs are
exempt from Part III of the SF(FMR) Regulations, so there is no capital test and no quarterly Form 1/2 for them
(MAS Guidelines SFA 04-G05, Appendix 7). `MasFinal` stays as the LFMC version.

| t | Scene | Line | Picture |
|---|---|---|---|
| 0:00 | opening | One MAS declaration a year, for every fund you run / *still compiling it by hand?* | Form 25A paper |
| 0:04 | deadline | Due a month after year end — alongside the audit and the LP letters | Clock 1 → 31 Jan; audit, LP letters, Form 25A stack up |
| 0:07 | by-hand | Someone pulls every deal and every NAV into one sheet, by hand | Cap tables · Admin NAV · Deal CRM → Priya, your associate → Excel |
| 0:10 | rule | The VCFM rule — at least 80% of each fund in qualifying start-ups | Qualifying ≥ 80% bar, everything else ≤ 20% bar with the cap line; Fund I at 10.5% |
| 0:13 | wrong-but-fine | One secondary counted wrong, and the fund is outside the rule | Sheet: 10.5% ✓ → MAS's definition adds the S$6m secondary → 20.5% ✗ |
| 0:17 | core | CORE by TREASURER | Black card |
| 0:19 | screen-1 | 01 · Your cap tables, NAVs and deal log go in — Form 25A comes out | Files into the Core disc; Form 25A.xlsx fills (committed, qualifying, non-qualifying, AUM at NAV); Ready for MAS-Tx |
| 0:23 | screen-2 | 02 · Every company classified the way MAS defines it | The definition; four companies classified; 20.5% over the cap, fix before you declare |
| 0:26 | screen-3 | 03 · Checked before every term sheet, so no deal breaks the 20% cap | Proposed secondary takes Fund I 10.5% → 20.5%; alternatives; all funds' shares |
| 0:30 | screen-4 | 04 · One declaration a month after year end — kept current all year | 31 Dec · 31 Jan Form 25A · Form 23A within 14 days · deal checks all year |
| 0:33 | compare | From fifteen days to one | An associate's January: 15 days vs 1 day, illustrative |
| 0:36 | sign | You review and sign — it's ready to submit on MAS-Tx | Signature; READY · MAS-Tx |
| 0:39 | close / end | Less compiling, more investing → CORE by TREASURER · Book a demo → | |

Facts (checked 27 Oct 2026): Form 25A — annual declaration by a VCFM, within one month of FYE, online via
MAS-Tx, an .xlsx asking per fund for committed capital, AUM at NAV (undrawn commitments excluded), AUM in
qualifying and in non-qualifying investments (MAS form page revised 25 Feb 2025 + the form's explanatory
notes). Qualifying = specified products directly issued by an unlisted business venture incorporated no more
than ten years before the initial investment; follow-ons stay qualifying; older companies and secondary
purchases are non-qualifying; funds must keep ≥ 80% of committed capital (ex fees/expenses) in qualifying and
≤ 20% in non-qualifying investments (Appendix 7, para 7.1). Form 23A within 14 days of a change (Table A7-1).
What happens when Form 25A is late is not stated in those sources, so the film shows the workload clash, not a
penalty. Names, funds, companies and numbers are illustrative. Everything after the Core card is positioning,
not a shipped feature (team call, 27 Oct 2026).

```bash
COMP=MasVc OUT=treasurer-mas-vc.mp4 npm run render
```
