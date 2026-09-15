# Phase 3c Deployment Guide

KB deterministic parser is wired into `soc_stream.py` behind a
three-position feature flag (`KB_PARSER_MODE`). Phase 3c ships only
the observation path — no live DB writes happen yet, no SOC outputs
are overridden.

## TL;DR

```bash
# Default (no env vars set) — strict legacy parity:
KB_PARSER_MODE=off    # explicit form

# Phase 3c rollout:
KB_PARSER_MODE=shadow

# Phase 3d cutover (requires explicit approval):
KB_PARSER_MODE=on
KB_PARSER_ON_APPROVED=phase-3d-review-<id>
```

The flag is read at process start (`app.config._resolve_kb_parser_mode`).
Restart the backend after changing the env var.

## What each mode does

| Mode | Cedant detection | Parser | LLM prompt | Cross-check | DB writes |
|---|---|---|---|---|---|
| `off` | not run | not run | unchanged | not run | none |
| `shadow` | run | run if KB | unchanged | run, audit only | none |
| `on` | run | run if KB | KB context **injected** | run, surfaces SSE warnings | none (deferred to Phase 3d) |

Phase 3c never sets `dry_run=False` on `WorkflowSyncer.apply` — the
diff producer is empty, so the call site is exercised but no
transitions ever flow through. Phase 3d flips the producer on.

## Roll-out procedure

1. **Merge the PR** — flag defaults to `off`. Production is unaffected.
2. **Verify off-mode parity**:
   - Pick 5 representative production SOC streams (KB and non-KB).
   - Confirm the user-facing SSE event sequence is byte-identical to
     pre-Phase-3c output. The `evidence_payload` should not contain
     a `kb_audit` key.
3. **Activate SHADOW**:
   - Set `KB_PARSER_MODE=shadow` and restart.
   - Monitor: cross-check `severity` distribution, parse-failure rate,
     audit event volume. Expect `kb_parsed` events on every KB upload
     and no fail spikes.
   - Watch for at least **two monthly bordereau cycles** (~2 months)
     before promoting.
4. **Phase-3d review** — separate cutover gate. When approved, mint
   the `KB_PARSER_ON_APPROVED` token and proceed.
5. **Activate ON**:
   - Set both `KB_PARSER_MODE=on` and `KB_PARSER_ON_APPROVED=<id>`.
   - Verify the LLM prompt now contains the deterministic context
     block (`[KB 결정론 파싱 결과 — 이 정보는 검증된 사실입니다]`).
   - Cross-check warnings now surface as SSE step events; ops must
     watch for elevated warning rates.

## Roll-back procedure

**Immediate** — environment variable change, no code redeploy:

```bash
unset KB_PARSER_MODE  # or: KB_PARSER_MODE=off
# restart backend
```

The `evidence_payload` reverts to the pre-Phase-3c shape on the very
next stream.

**Database** — Phase 3c writes nothing, so there's no DB roll-back to
worry about. Phase 3a's columns (`last_transition` etc.) remain
nullable; their values stay `NULL` until Phase 3d activates writes.

## Monitoring thresholds

Set alerts (or grep dashboards) on the SSE / log audit events:

| Metric | Threshold | Action |
|---|---|---|
| `cross_check.severity == fail` rate | > 5% of KB streams | Investigate within 24h — something diverged between LLM and parser |
| `kb_parse_failed` events | any | Investigate — parser broke against new KB layout |
| `kb_borderline_detected` rate | > 10% of KB streams | Revisit detector confidence weights |
| Stream P95 latency | > 30% above OFF baseline | Investigate parser hot path; consider rolling back to OFF |
| `phase_3d_hook_invoked` `transition_count` > 0 in mode != ON (shouldn't happen) | any | Bug — diff producer leaked into a non-ON path |

## Phase 3d entry conditions

Promote ON to "diff-active" only when:

- [ ] Two complete monthly bordereau cycles in SHADOW mode without
      sustained `cross_check.fail` events.
- [ ] At least one cycle reviewed end-to-end where the parser's
      transitions match operator expectations on a sample of claims.
- [ ] Phase 3d migration plan reviewed (monthly snapshot storage —
      Postgres bytea / S3 / JSONB serialised — decided).
- [ ] `WorkflowSyncer.apply(dry_run=False)` SQL implementation
      reviewed and unit-tested.
- [ ] Roll-back plan including DB write reversal documented.

## What Phase 3c does **not** do

- Override LLM-produced SOC outputs (Phase 3d).
- Live-write `claims.workflow_status` (Phase 3d).
- Run monthly diff inside the per-request stream (Phase 3d).
- Sync `slip_cases.extracted` JSONB into `SOCHistory` during a
  request (potential Phase 3d, gated on async-session work).
- Touch HW / SS / KR / DB / HM / Meritz documents in any way (the
  `_unverified/` HW draft remains isolated).

## Touched files (review reference)

| File | Lines added/modified |
|---|---|
| `app/config.py` | +50 (KBParserMode + ON gate) |
| `app/services/cedant_detector.py` | new (159) |
| `app/services/soc_stream_kb_integration.py` | new (~250) |
| `app/services/parsers/kb/llm_context.py` | new (138) |
| `app/services/parsers/kb/cross_check.py` | new (254) |
| `app/services/parsers/kb/diff_hooks.py` | new (62) |
| `app/services/parsers/kb/slip_cases_sync.py` | +50 (live `_fetch_from_db`) |
| `app/routers/soc_stream.py` | +25 / -0 (5 hooks) |

Tests: 23 new integration tests + the Phase-3c unit tests inherited
from infrastructure modules.
