# ADR-001: contracts.share Sum Invariant — Why It Isn't Wired Anywhere

Status: Accepted (2026-05-04)

## Context

A diagnostic on the SOC fallback path (`soc_stream.py:478`) flagged that we
add `Contract.share` values straight into the SOC payload with no check that
the shares of a single (cover_note_no, year) placement actually sum to 1.0.
The intuition was that a missing/duplicate row would cause an under- or
over-billed reinsurer.

The remediation plan was:

1. Validator at `app/services/contract_validator.py`.
2. Hard fail on `POST/PUT /api/contracts` when a write would break the sum.
3. Soft warn in the SOC fallback when the existing rows already break the sum.
4. DB-wide audit script.

## What we found when we ran the audit

```
groups examined : 5645
groups failing  : 5452   (96.6%)
```

Even after deduping rows by `reinsurer` (so multiple installments for the same
reinsurer don't double-count), only **198 / 5645 (3.5%)** of placements have
shares summing to 1.0.

Two structural reasons surfaced:

1. **`contracts` is an installment ledger, not a placement ledger.**
   `(MF170014, 2018)` has 19 rows but only 2 distinct reinsurers — every rec
   /paid event creates a fresh row carrying the same share. 1074 / 5645 groups
   contain duplicate reinsurer rows.

2. **INS Corp is a partial broker on most placements.**
   Failing groups predominantly sum to small fractions like 0.09, 0.10, 0.15
   — i.e. INS Corp only books their own brokered slice; other reinsurers on
   the same placement are handled by other brokers and never enter this DB.
   `cover_notes` has no column recording "INS Corp's target share for this
   placement," so the real expected sum is unknown to the system.

The premise — "shares per (cover_note_no, year) sum to 1.0" — is therefore
**not a data invariant**. It only holds for the ~3.5% of placements where INS
Corp happens to be the sole broker.

## Decision

Keep the validator code, do not wire it into any write or read path.

- `app/services/contract_validator.py`: kept, with full unit tests.
- `scripts/audit_contract_shares.py`: kept; useful as a structural probe and
  as a starting point for any future invariant.
- `routers/contracts.py`, `routers/soc_stream.py`: **unchanged** — wiring was
  drafted, then reverted before this commit.

The validator is dormant. Any future caller that knows the *correct* expected
sum (e.g. a per-cover-note target share, or a per-installment-batch invariant)
can call it with that target. Today, no caller has that information.

## What this means for the original SOC fallback risk

The original concern stands: the fallback path multiplies `total * share` and
emits SOCs with no integrity check. Because shares legitimately don't sum to
1.0, we cannot detect "missing reinsurer" or "extra reinsurer" purely from the
contracts table. Stronger signals are needed:

- A `cover_notes.ins_corp_target_share` (or equivalent) field, populated at
  policy-onboarding time. Once present, the validator becomes useful.
- Or a per-(cover_note_no, year, reinsurer) consistency check — confirming
  that the same reinsurer carries the same share across all installment rows.
  144 / 5645 groups violate even this weaker invariant; that subset *is*
  likely real data corruption and is a candidate for a follow-up PR.

## Follow-ups

- [ ] Decide whether to add `cover_notes.ins_corp_target_share` (schema
      change; out of scope for this PR).
- [ ] Run audit periodically and surface the per-reinsurer-share-inconsistency
      cases (the 144) to ops for cleanup.
- [ ] Revisit the SOC fallback at `soc_stream.py:478` once a real invariant
      exists.
