#!/usr/bin/env bash
# Run SOC generator test suite from CLI.
# Usage:
#   ./run_soc_tests.sh             → run all cases sequentially
#   ./run_soc_tests.sh <substr>    → only cases whose id contains <substr>
#   CONCURRENCY=4 ./run_soc_tests.sh
set -uo pipefail

API="${API:-http://localhost:7601}"
FILTER="${1:-}"
CONCURRENCY="${CONCURRENCY:-3}"

cases_json="$(curl -sf "$API/api/tools/soc/test-suite/cases")"
if [ -z "$cases_json" ]; then
  echo "failed to fetch cases from $API" >&2
  exit 1
fi

mapfile -t case_ids < <(echo "$cases_json" | python3 -c '
import json,sys
for c in json.load(sys.stdin):
    print(c["id"])
')

if [ -n "$FILTER" ]; then
  mapfile -t case_ids < <(printf '%s\n' "${case_ids[@]}" | grep -F "$FILTER" || true)
fi

total=${#case_ids[@]}
echo "Running $total case(s) against $API (concurrency=$CONCURRENCY)"
echo

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

run_one() {
  local idx=$1
  local id=$2
  local out="$tmp_dir/$idx.json"
  curl -sf -X POST "$API/api/tools/soc/test-suite/run" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"case_id": sys.argv[1]}))' "$id")" \
    > "$out" 2>/dev/null || echo '{"error":"request failed"}' > "$out"

  python3 - "$id" "$out" <<'PY'
import json, sys, os
cid = sys.argv[1]
with open(sys.argv[2]) as f:
    try: r = json.load(f)
    except: r = {"error": "parse failed"}
if r.get("error"):
    print(f"ERROR  {cid}  — {r['error']}")
    sys.exit(0)
cmp = r.get("compare") or {}
exp = r.get("expected") or {}
status = "PASS " if r.get("pass") else "FAIL "
exp_rs = ",".join(exp.get("expected_reinsurers") or [])
got_rs = ",".join((r.get("actual") or {}).get("reinsurers") or [])
print(f"{status}{cid}")
print(f"       expect: [{exp_rs}]")
print(f"       actual: [{got_rs}]")
if cmp.get("missing"):
    print(f"       missing: {cmp['missing']}")
if cmp.get("extra"):
    print(f"       extra: {cmp['extra']}")
PY
}

export -f run_one
export API tmp_dir

# Parallel with xargs
idx=0
: > "$tmp_dir/jobs.txt"
for id in "${case_ids[@]}"; do
  printf '%d\t%s\n' "$idx" "$id" >> "$tmp_dir/jobs.txt"
  idx=$((idx+1))
done

cat "$tmp_dir/jobs.txt" | xargs -L1 -P "$CONCURRENCY" -I{} bash -c '
  line="$@"
  idx="${line%%$'"'"'\t'"'"'*}"
  id="${line#*$'"'"'\t'"'"'}"
  run_one "$idx" "$id"
  echo
' _ {}

# Summary
pass=0; fail=0; err=0
for f in "$tmp_dir"/*.json; do
  [ -f "$f" ] || continue
  python3 -c '
import json, sys
try:
    r = json.load(open(sys.argv[1]))
except:
    print("err"); sys.exit()
if r.get("error"): print("err")
elif r.get("pass"): print("pass")
else: print("fail")
' "$f" | while read -r s; do
    case "$s" in
      pass) echo "P" ;;
      fail) echo "F" ;;
      err)  echo "E" ;;
    esac
  done
done | sort | uniq -c
