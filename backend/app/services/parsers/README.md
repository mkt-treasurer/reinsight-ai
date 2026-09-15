# Cedant document parsers

Deterministic parsers that turn raw cedant filings into structured
claim rows. No LLM calls — every output is reproducible from the same
input. Phase 1 covers KB monthly bordereaux end-to-end and the
reference-number shape for KB only.

## Layout

| Module | Purpose |
|---|---|
| `errors.py` | `KBSchemaError`, `RefNoParseError`, base `ParserError` |
| `ref_no_parser.py` | KB reference-number regex parser |
| `kb_bordereau.py` | KB monthly bordereau xlsx → `KBBordereauResult` |
| `_unverified/hw_ref_no_draft.py` | HW draft. Not on the public API. |

## What KB sends each month

Two report types arrive per recipient (`인스보험중개` / `DAEWOO INS`),
so the typical month produces four xlsx files:

| Report | Sheet name | Revision column | Amount columns | Total rows |
|---|---|---|---|---|
| `PLA` (Outstanding Loss Advice) | `OS List` | `추산차수 (OS Serial)` | `OS Loss_Indemnity` etc. | per-currency at the bottom |
| `SOC` (Settlement of Claim) | `SOC` | `결정차수 (Paid Serial)` | `Paid Loss_Indemnity` etc. | per-currency at the bottom |

`'대우 인스'` and `'인스'` were originally reported as *sheet* names but
turn out to be *recipient* labels — the actual sheet inside each file
is one of `OS List` or `SOC`. The recipient is read from the `To :`
line near the top of the sheet and exposed as
`KBBordereauResult.recipient`.

## KB reference numbers

Source format (Excel cell `접수번호 (KB Ref)`) is a 14-digit string.
The revision is **a separate integer column** (`추산차수` / `결정차수`),
not embedded in the ref string.

`parse_kb_ref_no` returns three string surfaces on every parse:

| Field | Form | Use |
|---|---|---|
| `raw` | `"20260204009404"` (or whatever was passed in) | logging, error context |
| `normalized` | `"2026-0204009404 001"` (space separator) | DB-compatible display form, matches the historical `claims.ref_no` shape |
| `key` | `"2026-0204009404-001"` (hyphen separator) | clean canonical identifier — URL slugs, JSON path components, dedup hash inputs |

### Migration compatibility

The `claims.ref_no` column already contains values like
`"2026-0204009404 001"` (with whitespace), so `normalized` is
deliberately backward-compatible with existing rows and existing
`ILIKE` queries. New code paths that need a clean identifier should
prefer `key` over `normalized`:

- **Existing reads against `claims.ref_no`** (e.g. `soc_stream.py`'s
  `Claim.ref_no.ilike(f"%{base_ref}%")` style queries) — keep using
  `normalized`. No migration needed.
- **New writes / new join keys** (Phase 2 monthly diff, future PK on
  a normalised ref table) — use `key`. Avoid putting whitespace into
  a column you intend to join, slug, or hash on.
- **Round-trip** `key.replace("-{rev:03d}", " {rev:03d}") == normalized`
  by construction; converting between the two forms is mechanical.

Caveat: when the source ref carries the `외` ("and others")
multi-claim suffix, both `normalized` and `key` preserve it verbatim.
The character is non-ASCII but conveys real claim-aggregation
semantics, so dropping it would silently merge distinct refs.

### Year-month-day decoding

For modern entries (2017+), the 10-digit core decomposes as
``MM (2) + DD (2) + serial (6)``. Legacy KB rows pre-2017 sometimes
encode ``MM = 00`` (opaque core); the parser flags these as
`format_variant="kb_legacy_opaque"` and leaves `month`/`day` `None`
rather than guessing.

### Variant taxonomy and source data

The parser tags every row with one of three variants:

| `format_variant` | Meaning |
|---|---|
| `kb_modern` | Canonical shape with valid `MM ∈ 01..12` |
| `kb_legacy_opaque` | 10-digit core has `MM=00` — parsed but not date-decoded |
| `sentinel` | `"various"` placeholder, returned with `is_sentinel=True` |

> **Source of distribution numbers.** Any percentages quoted in
> conversation about `length(ref_no)` shapes (e.g. "62% modern with
> revision, 21% no-hyphen, 11% legacy") came from a 2026-05-04 audit
> query — `SELECT length(ref_no), COUNT(*) FROM claims WHERE
> cedant='KB' GROUP BY length(ref_no)`, N=1682. The fixtures shipped
> in this repository (104 rows) are not statistically representative
> of the production population and were not used to derive those
> ratios. The code itself only distinguishes the three variants
> above — finer length-based partitioning is informational, not
> behavioural.

### Sentinels

- `"various"` is a known data-quality marker for rows aggregating
  multiple underlying claims. Returned with `is_sentinel=True` so the
  row stays but downstream code can skip ref-based joining.

## Validation policy

`parse_kb_bordereau` raises `KBSchemaError` for structural failures —
no whitelisted sheet, header row missing, required columns missing —
because these block the file as a whole. Row-level problems
(unparseable ref_no, bad date, blank row in the middle) become
`KBBordereauResult.warnings` and the row is either kept (parse
failure) or silently skipped (decorative / fully blank), preserving
the totals invariant for downstream cross-checking.

Required columns: `ref_no`, `insured`, `dol`, `your_share_pct`, plus
the kind-specific revision column.

### Sibling rows (intentional)

KB groups multiple casualty arms of a single incident under one KB
Ref + revision but distinct ``casualty`` values, so two rows that
share `(ref_no.key, revision)` are the rule, not an exception. The
Feb 2026 PLA INS fixture's `2023-0707020197-000` group is the
canonical example:

| Row | `casualty` | OS Loss_Indemnity |
|---|---|---|
| R78 | `인001 미상` | 1,000,000 |
| R79 | `물001 미상` | 10,000,000 |

Both rows describe the same Paris hotel robbery for `(주) 온라인투어`,
but the personal-injury (`인`) and property-damage (`물`) lines
settle on different reserve estimates and must be tracked
separately. Item Serial and Cession Serial are both ``1`` on each
row — only ``casualty`` separates them.

The parser exposes the sibling discriminator through
``KBClaimRow.natural_key()``, defined as the 6-tuple

```
(recipient, ref_no.key, casualty, item_serial, cession_serial, revision)
```

This is the identifier downstream code should use when deduplicating,
joining across months, or building a primary key. It must not be
reduced back to ``(ref, revision)`` — sibling collapse loses the
indemnity-vs-property split.

### Casualty (`재해명`) value shapes

The casualty column carries multiple flavours of value, only some of
which are structured. From a 2026-05-04 audit across the four shipped
fixtures (104 rows, 83 distinct values) — see
[`backend/scripts/audit_kb_casualty.py`](../../../scripts/audit_kb_casualty.py):

| Class | Rows | Share | Notes |
|---|---|---|---|
| `masked_name_kr` | 52 | 50.0% | Korean names with one Hangul masked: `김*숙`, `박*배` |
| `free_text` | 35 | 33.7% | Project names, full names, item descriptions: `방배그랑자이`, `정연희`, `HP Bucket, D` |
| `generic_marker` | 14 | 13.5% | Single-word damage-type labels: `누수`, `재해물`, `이익상실`, `담장` |
| `coded[인/물]` | 2 | 1.9% | The structured sibling discriminator: `인001 미상`, `물001 미상` |
| `masked_name_en` | 1 | 1.0% | Latin-script names: `Cho***` |

Two consequences for downstream code:

1. The structured `[인/물]\d{3}` form is rare (~2% of rows), but it's
   the only shape that explicitly encodes a sibling-casualty split.
   The other 98% are free-form identifiers that *also* uniquely
   discriminate within a `(ref, revision)` group, just by accident
   of being human-readable names rather than coded labels.
2. KB's privacy practice is inconsistent — some rows are masked
   (`김*숙`), some are not (`정연희`, `김주환`). Don't rely on the
   casualty value being de-identified.

### True duplicates (Phase-2 decision pending)

A *true* duplicate is a natural-key collision: two rows whose entire
6-tuple matches. None of the four shipped fixtures contain any —
verified by `TestSiblingCasualties::test_natural_key_uniqueness_across_full_fixtures`.

> **Phase-2 TODO — define true-duplicate policy.** When the monthly-
> diff logic lands and starts ingesting more months of data, the
> parser may eventually see a real natural-key collision. The
> handling rule must be deterministic. Candidates:
>
> 1. **Fold by summing amounts** — interpret the collision as a
>    duplicate booking (e.g. amendment row missed by KB).
> 2. **Keep all rows** — interpret the collision as separate
>    sub-cessions that happen to share the same disambiguator.
> 3. **Hard fail** — surface as a data-quality alert and quarantine
>    the file pending operator review.
>
> The decision must be made before Phase 2 ships because monthly-diff
> semantics depend on it (counting a collision as one closure vs. two
> changes the closure-detection output).

## Source of truth

Domain rules came from the 2026-04-16 mail thread with INS Corp's
Lee Sungeun. Bordereau structure observed against the real
February 2026 KB files in `backend/tests/fixtures/kb_borderau/`.

## HW (Hanwha) — Phase 2

`parsers._unverified.hw_ref_no_draft.parse_hw_ref_no_draft` exists as
a regex draft inferred from a DB audit (515 rows) plus one Hanwha SOC
email screenshot. **It is not on the public API and must not be
imported from production code.** When real HW document fixtures are
available, the draft will be re-validated and promoted into
`ref_no_parser` proper. See the module docstring for the specific
verification gaps (RF prefix semantics, line-code letter meanings,
C-prefix segment schema, 2-digit-year window).

The Hanwha SOC `20260413171106853750` timestamp-shaped value seen in
the email is a separate concern: it isn't generated by anything in
this repository, but the same deterministic-extraction discipline
that protects KB here will protect HW once the document parser
lands.

## Phase 2 — monthly-diff engine

The `parsers.kb` subpackage builds on the Phase-1 row parser to
detect claim lifecycle transitions across monthly snapshots. Three
public types live there:

| Type | Purpose |
|---|---|
| `KBMonthlySnapshot` | Atomic four-slot container per month — PLA × {INS, DAEWOO}, SOC × {INS, DAEWOO}. At least one PLA slot must be populated. |
| `SOCHistory` | Accumulator that answers "has this claim been settled?". Stores 6-tuple full keys, queries at the 5-tuple base-key (claim) level so the answer is revision-agnostic. |
| `diff_monthly()` | Returns one `ClaimTransition` per base key seen in either month. INS and DAEWOO streams diff independently. |

### Matching key

Phase 2 introduces a 5-tuple **base key** distinct from Phase 1's
`natural_key()` 6-tuple:

```
base_key = (recipient, ref_body, casualty, item_serial, cession_serial)
```

`ref_body` is `ref_no.key` with the trailing `-RRR` revision suffix
stripped (e.g. `2026-0204009404-001` → `2026-0204009404`). Revision
is excluded from the matching key so `REVISION_BUMP` shows up as a
continuation rather than a delete-then-insert pair. Phase 1's
`natural_key()` is unchanged — it stays as the row-level identity
hash inside `KBClaimRow`; the diff engine just doesn't reuse it.

### TransitionType ledger

| Variant | Meaning |
|---|---|
| `UNCHANGED` | Same base key in both months, same revision |
| `REVISION_BUMP` | Same base key, current revision = previous + 1 |
| `REVISION_GAP` | Same base key, current revision > previous + 1 (KB skipped numbers) |
| `REVISION_REGRESSION` | Same base key, current revision < previous. Notes always include the literal `anomaly:regression` so audit can route these to a peer-level review section |
| `NEW` | Base key in current only, no SOC history record |
| `REOPENED` | Base key in current only, SOC history records prior settlement |
| `SETTLED` | Base key disappeared from PLA, SOC history records the claim. 지급 종결 |
| `DISMISSED` | Base key disappeared from PLA, no SOC history record. 면책 종결 |

### Casualty drift audit (Pass 2)

Strict 5-tuple matching can miss claims whose casualty text shifts
across months (e.g. `미상` placeholder filling in to `김*숙` once KB
gets a name). The engine doesn't auto-correct — instead, after the
strict pass classifies each transition, a Pass-2 audit scans for
4-tuple near-matches (drop casualty) on the unmatched side and
attaches a note for human review:

| Pass-2 outcome | Note prefix | Operator action |
|---|---|---|
| Unique near-match | `casualty_drift_suspected:` | Review whether the disappearing and appearing rows are the same claim |
| Multiple near-matches (siblings) | `casualty_ambiguous_with_siblings:` | Inspect siblings — `인001` / `물001` style sibling collapse risk |
| No near-match | (no note) | None — strict result is unambiguous |

The transition itself is unchanged in every case; the audit script
surfaces these notes in dedicated review sections.

### Audit script

```bash
cd backend && python -m scripts.audit_kb_monthly \
  --previous-dir /path/to/2026-01/ \
  --current-dir  /path/to/2026-02/ \
  --soc-history-dirs /path/to/2026-01/ /path/to/2026-02/ \
  --json out.json
```

Each input directory holds the four monthly xlsx files
(categorisation is by parsed sheet kind + recipient, not by file
name). Output sections render in the order: SETTLED → DISMISSED →
REOPENED → NEW → REVISION_BUMP → REVISION_GAP → REVISION_REGRESSION
(anomaly) → UNCHANGED (counts only) → audit warnings.

### Synthetic test fixtures

`backend/tests/fixtures/kb_borderau/synthetic/` contains a
generator-produced 3-month KB-shaped scenario covering every
transition type. Regenerate with:

```bash
cd backend && python -m tests.fixtures.kb_borderau.generators.make_diff_scenarios
```

Real KB fixtures hold PII so we ship only one production month
(`PLA_FAC_INS_2026.02.xlsx` etc.); the synthetic set is what
`test_monthly_diff_scenarios` runs against.

## Phase 3a — workflow mapping + DB schema

Phase 3a wires the diff-engine output into the database schema
without taking on any live writes yet. Three pieces shipped:

1. **Alembic infrastructure** — first time the project carries
   schema migrations. See `backend/alembic/README.md` for the
   bootstrap notes; `backend/alembic.ini` reads `DATABASE_URL`
   from the environment so the same config works locally and in CI.
2. **`claims` schema extension** — three new columns plus an index,
   shipped as `0001_add_kb_diff_columns`:

   | Column | Type | Purpose |
   |---|---|---|
   | `last_transition` | `String(30)` (indexed) | Phase-2 `TransitionType.value` |
   | `last_transition_at` | `DateTime` | When the diff engine detected the transition |
   | `last_diff_audit_severity` | `String(20)` | `info` / `warning` / `anomaly` |

3. **`workflow_mapping`** — pure logic that maps a `ClaimTransition`
   to a `WorkflowImpact`. Only DISMISSED touches `workflow_status`;
   every other transition records itself in the new audit columns
   without disturbing the broker workflow.

### Mapping table (locked by `test_workflow_mapping.py`)

| Transition | `last_transition` | `workflow_status` impact | Severity |
|---|---|---|---|
| `NEW` | `new` | (unchanged) | info |
| `REOPENED` | `reopened` | (unchanged) | warning |
| `UNCHANGED` | `unchanged` | (unchanged) | info |
| `REVISION_BUMP` | `revision_bump` | (unchanged) | info |
| `REVISION_GAP` | `revision_gap` | (unchanged) | warning |
| `REVISION_REGRESSION` | `revision_regression` | (unchanged) | anomaly |
| `SETTLED` | `settled` | (unchanged) | info |
| `DISMISSED` | `dismissed` | `dismissed` (new value) | info |

`SETTLED` deliberately does **not** flip `workflow_status` to
`completed`. The two axes are orthogonal: cedant-side SETTLED means
KB paid the original insured; broker-side `completed` means the
reinsurer paid INS Corp. Conflating them would hide whether our SOC
chase is still in flight.

### Severity escalation

Diff-engine notes lift severity automatically:
- `casualty_drift_suspected` (Pass-2 unique near-match) → bump
  `info` → `warning`, surface as `audit:casualty_drift` note
- `casualty_ambiguous_with_siblings` (Pass-2 multiple) → same bump
  with an `audit:casualty_ambiguous` note
- `anomaly:regression` (REVISION_REGRESSION) → already at `anomaly`;
  the literal marker is propagated through to the impact's notes for
  downstream filtering

### `workflow_status` protection clauses

DISMISSED is the only transition that can set `workflow_status`, but
the mapper refuses to overwrite three already-meaningful states:

```
completed         → keep (money already paid)
payment_received  → keep (partial payment in flight)
sent_to_reinsurer → keep (chase in progress)
```

When this happens the impact's notes carry a
`workflow_protected: refusing to overwrite ...` marker and severity
gets bumped to `warning`. Operators can then investigate why a
DISMISSED arrived after broker-side activity.

### `WorkflowSyncer` (Phase 3a: dry-run only)

```python
syncer = WorkflowSyncer()
result = syncer.apply(transition, current_status="booked")
# result.applied is False; result.impact carries the planned change.
```

`syncer.apply(transition, dry_run=False)` raises
`NotImplementedError` — Phase 3c will add the live UPDATE behind the
flag without changing this signature.

## Phase 3b — slip_cases adapter (read-only)

Phase 3b extends `SOCHistory` with a second storage tier sourced
from the live SOC pipeline's `slip_cases.extracted` JSONB. The new
tier exists because Phase 2 only knows about claims that reached the
monthly bordereau; `slip_cases` carries SOCs as soon as they're
processed, sometimes before they round-trip through KB's monthly file.

### Why partial, not full

The LLM extraction prompt (`soc_prompts.py:50-66`) does not capture
casualty / item_serial / cession_serial — three of the five fields
that make up Phase-2's base key. So slip_cases entries can only
satisfy a coarser ref-level question: "did **any** revision under
this `(recipient, ref_body)` ever see a SOC issued?" An audit of the
production DB on 2026-05-04 confirmed the gap is structural rather
than a data bug:

| Field | slip_cases coverage |
|---|---|
| `cedant_ref_no` | 100% (`claims[]` rows) |
| `insured` | 100% |
| `casualty` | 0% |
| `item_serial` | 0% |
| `cession_serial` | 0% |

The recipient is inferred from the source filename (`DAEWOO` substring
→ DAEWOO INS, otherwise the INS default).

### Two-tier `SOCHistory`

```python
history = SOCHistory()
history.add(soc_bordereau_result)            # 6-tuple, full info
history.add_partial(                          # 3-tuple, partial info
    recipient="인스보험중개, SEOUL, KOREA",
    ref_body="2024-1105009358",
    revision=1,
    quality="partial",
)

history.has_seen(base_key)                    # 5-tuple strict — bordereau only
history.has_seen_at_ref_level(rec, ref_body)  # 2-tuple — both tiers
```

Phase 2's diff engine still calls `has_seen` (strict) so partial
entries cannot accidentally flip a transition to SETTLED. The
ref-level query is for audit reporting and future Phase-3c uses
that opt in explicitly.

### Quality grading

| Grade | Required fields | Real-world frequency |
|---|---|---|
| `exact` | full 5-tuple | 0% — JSONB schema can't carry it |
| `partial` | recipient + ref_body + revision | typical case (e.g. `cedant_ref_no="2024-1105009358 001"`) |
| `inferred` | ref_body only | rare — when revision can't be parsed |

`SlipCasesAdapter(quality_threshold="partial")` (the default) admits
both `exact` and `partial`, skipping `inferred`. The threshold is a
single string ordered by `QUALITY_ORDER`.

### Audit script

```bash
cd backend && python -m scripts.audit_slip_cases_keys \
  [--bordereau-dir tests/fixtures/kb_borderau/] \
  [--from-rows-json offline_dump.json] \
  [--json out.json]
```

Read-only against the live database. Three buckets land in the
output:

- **both** — slip_cases and bordereau both record the same
  `(recipient, ref_body)`. Healthy reconciliation.
- **bordereau-only** — bordereau has the claim, slip_cases doesn't.
  Expected when the SOC predates Slip Generator adoption or never
  ran through the live pipeline.
- **slip-only** — slip_cases has a key the bordereau lacks.
  Suspicious; investigate before trusting the partial entry as
  settlement evidence.

The 2026-05-04 production audit found 1 / 14 / 0 across the buckets,
which matches expectations: only one claim has been through both
pipelines so far.

### Live-DB write path

`SlipCasesAdapter._fetch_from_db()` raises `NotImplementedError` —
Phase 3b ships only the in-memory `populate(history, rows=...)`
path. The audit script has its own one-off SQL query for read-only
operation; the production sync hook lands in Phase 3c.

## Deferred to later phases

- **HW document parser**: Hanwha SOCs are typically single-claim
  PDFs/xlsx with no bordereau layout; needs its own sample set.
- **`soc_stream.py` integration (Phase 3c)**: replace the LLM-
  driven xlsx path in the live SOC pipeline with the deterministic
  parser + diff + WorkflowSyncer (this time with `dry_run=False`),
  and wire the `SlipCasesAdapter` to refresh the history at startup.
- **slip_cases prompt enrichment**: capturing casualty / item /
  cession in the SOC extraction prompt would lift slip_cases keys
  to `exact` quality and let them participate in Phase-2 strict
  matching. Out of Phase-3 scope; tracked as a follow-up.
- **True-duplicate dedup policy**: the natural-key collision
  handling note from Phase 1 still stands. Decide before Phase 3c
  ingests live data.
