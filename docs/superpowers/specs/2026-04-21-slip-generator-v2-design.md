# Slip Generator v2 — Design Spec

**Date**: 2026-04-21
**Status**: Approved for implementation planning
**Author**: Ted + Claude (brainstorming session)

## Background

The existing SOC/slip generator (`backend/app/routers/soc_generator.py`, `soc_stream.py`, `services/soc_prompts.py`) works but does not reflect the full claim workflow documented in `INS 클레임 프로세스.pdf`. Missing or partial pieces:

- **Cedant-specific input formats** (KR individual PDF, KB bordereau Excel, DB portal, HM bordereau+PDF+portal, HW/SS individual PDF) — no per-cedant routing
- **Email composition** — no subject template (`SOC_{cedant}_{lob}_UY{yyyy}(DOL {dol})_{ref} ({reinsurer})`), no body template, no CC
- **Special contracts** — DB-금호 (premium/claim offset), KB MED-MAL facility (Great American SG + Allianz fixed), KR 특약, SS 코오롱모터스/인포유 (manual handling)

Rather than stuff these branches into one ever-growing prompt, v2 externalizes per-cedant rules as data (playbooks), moves deterministic lookups to tools, and uses an agent loop inside a LangGraph skeleton for judgment.

## Goals

1. Keep v1 running untouched; build v2 alongside for safe comparison
2. Every cedant/special-case rule encoded as data (YAML), not prompt text
3. Deterministic operations are tools, LLM only orchestrates and synthesizes
4. Regression tests (golden cases) pin behavior as new cases are added

## Non-goals (MVP)

- Not covering all 6 cedants — MVP is KB + KR only
- Not covering all 4 special cases — MVP is KB MED-MAL facility only
- No admin UI for editing playbooks (YAML in repo, code review to change)
- No migration of v1 callers — v2 is a parallel surface

## Architecture

### Module layout

```
backend/app/
├── services/slip_agent_v2/
│   ├── graph.py          # LangGraph skeleton (4 phases)
│   ├── state.py          # Pydantic SlipAgentState
│   ├── tools.py          # 7 tools, wraps existing services
│   ├── prompts.py        # phase system prompts
│   ├── playbooks.py      # YAML loader
│   └── playbooks/
│       ├── _schema.py    # Pydantic Playbook schema
│       ├── KB.yaml
│       └── KR.yaml
├── routers/slip_generator_v2.py   # /api/v2/slip/* (SSE)
└── tests/slip_agent_v2/
    ├── conftest.py
    ├── test_goldens.py
    ├── helpers/{diff.py, fixtures.py}
    └── goldens/
        ├── KB_bordereau_01/
        ├── KB_bordereau_multirow_negative/
        ├── KB_medmal_01/
        └── KR_single_01/

frontend/src/app/tools/
├── slip-generator/        # v1 untouched
└── slip-generator-v2/     # new, calls /api/v2/slip/*

frontend/src/lib/api-v2.ts
```

v1 (`services/soc_*`, `routers/soc_generator.py`, `routers/soc_stream.py`, `frontend/.../slip-generator/`) is not modified.

### Dependencies added

```
langgraph==0.2.*
langchain-google-genai==2.*
pyyaml==6.*
```

LLM provider stays on Gemini (existing `google-generativeai` credentials). Gemini 3 Pro is the fallback if the current model's tool-calling reliability is inadequate during golden-test validation.

## Phase Flow (LangGraph)

The graph only holds coarse phases. Branching for cedants and special cases happens **inside** the extract-and-reason agent loop via tool calls and playbook data — not as graph edges.

```
          ┌─────────┐
          │ ingest  │   Parse PDF/XLSX/MSG → text + tables. Pure Python, no LLM.
          └────┬────┘
               ▼
     ┌────────────────────┐
     │ extract_and_reason │ ◀── Agent loop (Gemini + tool calling)
     └──────────┬─────────┘     - get_cedant_playbook
                ▼               - lookup_cover_note
           ┌─────────┐          - lookup_facility_contract
           │ compose │          - search_past_claims
           └────┬────┘          - lookup_contract_shares
                ▼               - check_share_consistency
           ┌──────────┐         - resolve_reinsurer_alias
           │ validate │         Max 15 tool-call iterations.
           └─────┬────┘
                 │    pass → END
                 │    fail → feedback → extract_and_reason (max 2 retries)
                 ▼
                END
```

### Per-phase responsibilities

**`ingest`** — reuses `services/doc_parser.py`. Output: `RawDocs{files: [{name, mime, text, tables}]}`. Deterministic.

**`extract_and_reason`** — single Gemini agent with the 7 tools. System prompt instructs: "detect cedant → fetch playbook → follow playbook's special_contracts if matched, else reconcile past_claims + contract_shares against file_shares". Returns structured `claims[]` and `allocation[]`.

**`compose`** — deterministic template fill for INS slip format + email subject from playbook template. LLM only fills free-text fields (`description`, `particulars`) when not fully present in source.

**`validate`** — 100% deterministic checks:
- sum of reinsurer shares equals 1.0 (or file total share) within tolerance
- currency totals match sum of rows
- required fields present (`ref_no`, `dol`, `cedant_code`, `reinsurers[]`)
- if playbook matched a facility special_contract, only the playbook's fixed reinsurers appear

Failure produces a `ValidationFeedback` object appended to state; `extract_and_reason` re-runs with feedback injected into prompt. Retry cap: 2.

### State

```python
class SlipAgentState(BaseModel):
    raw_docs: RawDocs
    playbook: Playbook | None = None
    claims: list[Claim] = []
    allocation: list[ReinsurerAllocation] = []
    slip: SlipDocument | None = None
    email: EmailDraft | None = None
    validation: ValidationReport | None = None
    retry_count: int = 0
    tool_trace: list[ToolCall] = []
```

`tool_trace` is recorded so golden tests can optionally assert which tools were called.

## Tools (MVP: 7)

All tools live in `services/slip_agent_v2/tools.py`, declared with LangChain's `@tool` decorator, typed with Pydantic input/output. All tools are **deterministic** and **return empty/error objects rather than raising** — the agent decides next steps.

| Tool | Purpose | Wraps |
|---|---|---|
| `get_cedant_playbook(code)` | Returns playbook for a cedant code | `playbooks.py` YAML loader |
| `lookup_cover_note(ref_no, insured)` | Cover Note match → reinsurer hint | existing `contracts` DB query |
| `lookup_facility_contract(cedant, lob, uy)` | Facility match from playbook + DB | playbook special_contracts + DB |
| `search_past_claims(ref_no, insured)` | Past claims on same ref/account | existing `claim_processor.py` |
| `lookup_contract_shares(insured, uy)` | Contract-based reinsurer allocation | existing `contract_processor.py` |
| `check_share_consistency(file, contract)` | Diff between file shares and contract shares | pure function |
| `resolve_reinsurer_alias(name)` | Alias/OCR variant → canonical | existing `reinsurer_names.py` |

Design principle: adding a new cedant or special case should usually require **playbook data only**, not a new tool. Tools are query-shaped, not action-shaped.

## Playbook YAML

### Schema (`playbooks/_schema.py`)

```python
class SpecialContractMatch(BaseModel):
    lob_any_of: list[str] = []
    uy_any_of: list[int] = []

class FixedReinsurer(BaseModel):
    name: str
    canonical_key: str

class SpecialContractBehavior(BaseModel):
    mode: Literal["fixed_reinsurers", "share_offset", "manual_flag"]
    fixed_reinsurers: list[FixedReinsurer] = []
    note_for_agent: str = ""

class SpecialContract(BaseModel):
    id: str
    name: str
    match: SpecialContractMatch
    behavior: SpecialContractBehavior

class EmailTemplate(BaseModel):
    subject: str
    body_template_id: str
    cc: list[str] = []

class Playbook(BaseModel):
    cedant_code: str
    cedant_full_name: str
    input_formats: list[str]
    default_broker_share_note: str = ""
    special_contracts: list[SpecialContract] = []
    email_template: EmailTemplate
```

### `KB.yaml`

```yaml
cedant_code: KB
cedant_full_name: "KB Insurance Co., Ltd."
input_formats: [bordereau_excel]
default_broker_share_note: "KB 보더루는 파일 share 신뢰도 높음"

special_contracts:
  - id: KB_MEDMAL_FACILITY
    name: "MED-MAL Facility"
    match:
      lob_any_of: ["MED-MAL", "의료 과실", "Medical Malpractice", "의료과실"]
    behavior:
      mode: fixed_reinsurers
      fixed_reinsurers:
        - name: "Great American Insurance Company, Singapore Branch"
          canonical_key: great_american_sg
        - name: "Allianz"
          canonical_key: allianz
      note_for_agent: |
        Facility 계약. 과거 클레임/계약 조회 결과가 다르더라도 위 재보험사로 고정.
        Share는 file의 file_share 를 그대로 분배.

email_template:
  subject: "SOC_{cedant_full_name}_{lob_code}_UY{uy}(DOL {dol})_{ref_no} ({reinsurer_short})"
  body_template_id: standard_soc_v1
  cc: ["casualty@dwins.co.kr"]
```

### `KR.yaml`

```yaml
cedant_code: KR
cedant_full_name: "Korean Reinsurance Company"
input_formats: [individual_pdf]
default_broker_share_note: "KR은 treaty(특약) 비중 높음"

special_contracts: []

email_template:
  subject: "SOC_{cedant_full_name}_{lob_code}_UY{uy}(DOL {dol})_{ref_no} ({reinsurer_short})"
  body_template_id: standard_soc_v1
  cc: ["casualty@dwins.co.kr"]
```

### Extension points (future)

- DB-금호 → `mode: share_offset` with offset-rule fields
- SS 코오롱/인포유 → `mode: manual_flag` (agent sets "담당자 개입 필요" flag, no auto allocation)
- HM 포털 → add `portal_hint` field later

## Test Harness

### Layout

```
backend/tests/slip_agent_v2/
├── conftest.py
├── test_goldens.py
├── helpers/
│   ├── diff.py          # partial-match dict diff
│   └── fixtures.py      # DB seed, frozen time
└── goldens/
    ├── KB_bordereau_01/
    │   ├── inputs/              # raw SOC files
    │   ├── db_seed.yaml         # contracts / past claims required
    │   ├── expected.json        # expected output
    │   └── expected_trace.json  # (optional) required tool calls
    ├── KB_bordereau_multirow_negative/
    ├── KB_medmal_01/
    └── KR_single_01/
```

### Runner

```python
@pytest.mark.parametrize("case_dir", discover_golden_cases())
async def test_golden(case_dir, seeded_db):
    case = load_case(case_dir)
    seed_db(seeded_db, case.db_seed)
    result = await run_slip_agent_v2(case.inputs)
    diff = compare(result, case.expected, schema=DIFF_SCHEMA)
    assert diff.is_match, diff.report()
    if case.expected_trace:
        assert contains_subsequence(result.tool_trace, case.expected_trace)
```

Run: `pytest backend/tests/slip_agent_v2/ -v --run-golden`. Default-skipped in CI (LLM cost); triggered on PR label or weekly.

### MVP golden cases

| Case | Input | Verifies |
|---|---|---|
| `KB_bordereau_01` | KB 보더루 Excel, 1 row | baseline happy path — cedant detect → past claims → allocation |
| `KB_bordereau_multirow_negative` | Normal row + 환수 row | negative-amount regression (commit 7e2860a area) |
| `KB_medmal_01` | KB MED-MAL Excel | playbook facility branch — GA + Allianz fixed even if past claims differ |
| `KR_single_01` | KR individual PDF, 1 claim | individual PDF + no special contract |

### Baseline capture

Run v1 (`soc_generator.py`) on each golden input, hand-verify, seed the result into `expected.json`. This establishes "v2 no-regression vs v1" as the acceptance bar.

## Guardrails

- agent tool-call iteration cap: **15** per extract_and_reason invocation
- validate-fail retry cap: **2**
- per-phase timeouts: ingest 30s, extract 120s, compose 60s, validate 10s
- Gemini token usage logged per case; regressions flagged in golden-test report

## Open questions (for implementation plan)

- SSE event shape for v2 — match v1's `soc_stream.py` shape for frontend reuse, or define v2 shape?
- `db_seed.yaml` loader — build custom or adapt existing test fixtures?
- Should `tool_trace` be exposed in the SSE stream for debugging the v2 UI, or test-only?

These are resolved in the implementation plan, not this spec.
