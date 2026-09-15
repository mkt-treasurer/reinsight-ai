# InsightRe Design System

Canonical design language for all pages in this app. Derived from the Overview page (`src/app/page.tsx`) — use that file as the living reference implementation.

**Principle**: Clean, dense, financial-desk feel. Bloomberg/ECB-adjacent. No cream, no serif display, no decorative gradients, no rounded corners. Data density over whitespace. English UPPERCASE titles paired with small Korean subtext.

## Surfaces & color

- App background: `bg-white` (content area); outer shell can stay `bg-slate-50`.
- Top strip / masthead: `bg-slate-900 text-white`.
- Cards: `border border-slate-200 bg-white`, **no rounded corners**.
- Card header bar: `px-4 py-2.5 border-b border-slate-200 bg-slate-50`.
- Dividers: 1px `slate-200` (or `slate-300` for emphasis). Use `gap-px` on `bg-slate-200` grids for hairline separators between tiles.
- Primary ink: `slate-900`. Body text: `slate-700`. Meta: `slate-500`. Hint: `slate-400`.
- Severity:
  - critical → `#b91c1c`
  - warning → `#b45309`
  - info / neutral → `slate-400` / `slate-500`
- Positive (sparingly): `emerald-700` / `emerald-400`.
- **Do not** use decorative blue/purple gradients, cream/off-white, or colored card backgrounds. Single-accent rule: red for alerts, slate for everything else.

## Typography

- Already wired in `globals.css`: body = JetBrains Mono + Pretendard, headings = Montserrat. **Do not** add Instrument Serif or other display serifs.
- Section title: `text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700`.
- Subtitle (Korean allowed): `text-[10px] text-slate-400`.
- KPI / display numbers: JetBrains Mono, `text-[32px]` (or up to 40px), `font-bold`, `tabular-nums`.
- Table cells: `text-[12px]`, mono + `tabular-nums` for numerics.
- Meta / eyebrow: `text-[10px] uppercase tracking-wider text-slate-500`.
- Never italic. Never serif.

## Layout primitives

- 12-column grid with `gap-5` between top-level blocks.
- Masthead strip (slate-900) at the top of every operational page.
- Below masthead: content at `px-6 py-5`.
- KPI row: 4 tiles, 1px dividers via `grid grid-cols-4 gap-px bg-slate-200`.
- Analytics row: 4 chart cards (col-span-3 each) or 2×2 when fewer.
- Data tables full-width, enclosed in a bordered card.

### `Card` component pattern

```tsx
<div className="border border-slate-200 bg-white">
  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">TITLE</span>
    <span className="text-[10px] text-slate-400">한글 부제</span>
  </div>
  <div className="p-4">{children}</div>
</div>
```

### KPI tile

- Top: label (UPPERCASE 10px bold) + Korean sublabel (10px slate-400) + optional `ACTION` pill (bordered red).
- Number: 32px JetBrains Mono bold tabular-nums. Red ink when severe, slate-900 otherwise, emerald-700 for positive.
- Hint (mono, slate-400, 10px) underneath.

### Tables

- Header row: `text-[10px] uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200`.
- Body rows: `border-b border-slate-100 hover:bg-slate-50`, `py-2`.
- Severity dot in leftmost column: `w-[6px] h-[6px] rounded-full`; critical pulses.
- Stage pill: `text-[10px] uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5`.
- Ref / ID cells: mono semibold; hover → `text-[#1e40af] underline`.

### Filters / controls

- Segmented control: bordered `slate-300`, active state `bg-slate-900 text-white`, inactive `bg-white text-slate-600 hover:bg-slate-50`.
- Sort toggles: bordered pills, active = `border-slate-900 text-slate-900`.
- Buttons: sharp corners, 10–11px UPPERCASE tracking-wider.

## Charts (recharts)

- Gridlines: `stroke="#f1f5f9" strokeDasharray="2 2"`, usually `vertical={false}`.
- Axis ticks: `{ fontSize: 10, fill: "#64748b" }`, `axisLine={false}`, `tickLine={false}` (keep baseline axis when helpful: `axisLine={{ stroke: "#cbd5e1" }}`).
- Tooltip `contentStyle`: `{ fontSize: 10, border: "1px solid #e2e8f0", borderRadius: 0, padding: "4px 8px" }`.
- Bar radius: `[0,0,0,0]` — no rounded bars.
- Bar fill palette: `slate-900 / slate-400` for neutrals, severity colors for alert bars.
- Line charts: stroke `#0f172a`, `strokeWidth={1.5}`, `dot={false}`.
- Pie/donut: `innerRadius 40 / outerRadius 62`, `paddingAngle 2`, `stroke="none"`, fill per severity palette.
- Chart height: 160–200px in cards; never larger than the tabular data next to it.
- Every chart card should include a **legend or tiny stat grid underneath** when a Tooltip alone isn't enough.

## Motion

- Row stagger fade-in (`animation: rowIn 280ms ease-out both`), cap delay ≤ 450ms total.
- Critical severity dot: soft radial pulse (`pulseDot 1.6s`).
- Live indicator: emerald dot `animate-pulse`.
- Bar/line initial grow via `transition-all duration-700`.
- **No** hover bouncing, scale transforms, or parallax. Static-first.

## Copy & language

- Primary labels English UPPERCASE. Provide Korean subtext/caption alongside where the user is a domestic employee (e.g., `STUCK CASES` / `정체 > 3일`).
- Dates: `toLocaleDateString("ko-KR", { ... })` with weekday-short.
- Times: `toLocaleTimeString("ko-KR", { hour12: false })`, mono tabular-nums.
- Currency: prefix `₩` for KRW; compact suffix in Korean units (`억`, `만`, `조`).

## Don'ts

- No Instrument Serif / italic editorial masthead.
- No cream/warm off-white backgrounds.
- No rounded cards or bars (`rounded-*` only on tiny status dots / pills).
- No colored card fills (green/blue/yellow tinted backgrounds).
- No decorative icons or emoji in UI.
- No "sections 01 / 02" numbering.
- No gradients except the live-pulse dot.

## Reference

When building a new page, start from `src/app/page.tsx` and copy the structure:

1. Masthead strip (slate-900).
2. KPI row (4 tiles, hairline dividers).
3. Analytics row (4 chart cards).
4. Context row (funnel + hotspots or similar).
5. Data table with filters/sort.
6. Footer line (`refreshed HH:mm:ss`).
