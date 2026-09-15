#!/usr/bin/env python3
"""CLI runner for SOC generator test suite.

Usage:
    python run_soc_tests.py                 # run all
    python run_soc_tests.py --filter 3.10   # only cases whose id contains substr
    python run_soc_tests.py --concurrency 4
    python run_soc_tests.py --limit 5
"""
import argparse
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

DEFAULT_API = "http://localhost:7601"


def http_get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


def http_post(url: str, body: dict, timeout: int = 300) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def run_case(api: str, case_id: str) -> dict:
    try:
        t0 = time.time()
        res = http_post(f"{api}/api/tools/soc/test-suite/run", {"case_id": case_id})
        res["_elapsed"] = time.time() - t0
        return res
    except Exception as e:
        return {"case_id": case_id, "error": str(e), "_elapsed": 0}


def fmt_line(r: dict) -> str:
    cid = r.get("case_id", "?")
    elapsed = r.get("_elapsed", 0)
    if r.get("error"):
        return f"ERROR {cid} ({elapsed:.1f}s) — {r['error']}"
    exp = (r.get("expected") or {}).get("expected_reinsurers") or []
    act = (r.get("actual") or {}).get("reinsurers") or []
    cmp = r.get("compare") or {}
    status = "PASS " if r.get("pass") else "FAIL "
    bits = [f"{status}{cid} ({elapsed:.1f}s)"]
    bits.append(f"  expect: {exp}")
    bits.append(f"  actual: {act}")
    if cmp.get("missing"):
        bits.append(f"  missing: {cmp['missing']}")
    if cmp.get("extra"):
        bits.append(f"  extra: {cmp['extra']}")
    return "\n".join(bits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default=DEFAULT_API)
    ap.add_argument("--filter", default="")
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out-dir", default="test-results", help="dir to save .log / .json results")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(args.out_dir, f"soc_test_{stamp}.log")
    json_path = os.path.join(args.out_dir, f"soc_test_{stamp}.json")
    latest_log = os.path.join(args.out_dir, "latest.log")
    latest_json = os.path.join(args.out_dir, "latest.json")
    log_f = open(log_path, "w", encoding="utf-8")
    def emit(s: str = ""):
        print(s, flush=True)
        log_f.write(s + "\n")
        log_f.flush()

    cases = http_get(f"{args.api}/api/tools/soc/test-suite/cases")
    ids = [c["id"] for c in cases]
    if args.filter:
        ids = [i for i in ids if args.filter in i]
    if args.limit > 0:
        ids = ids[: args.limit]

    total = len(ids)
    emit(f"Run started {datetime.now().isoformat(timespec='seconds')}")
    emit(f"API: {args.api}   concurrency: {args.concurrency}   cases: {total}")
    emit()

    pass_ct = fail_ct = err_ct = 0
    fail_details: list[dict] = []
    all_results: list[dict] = []
    t_start = time.time()

    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futs = {ex.submit(run_case, args.api, cid): cid for cid in ids}
        done_ct = 0
        for fut in as_completed(futs):
            r = fut.result()
            all_results.append(r)
            done_ct += 1
            emit(f"[{done_ct}/{total}] {fmt_line(r)}")
            emit()
            if r.get("error"):
                err_ct += 1
            elif r.get("pass"):
                pass_ct += 1
            else:
                fail_ct += 1
                fail_details.append(r)

    elapsed = time.time() - t_start
    emit("=" * 60)
    emit(f"Total: {total}  Pass: {pass_ct}  Fail: {fail_ct}  Error: {err_ct}  ({elapsed:.1f}s)")
    if fail_details:
        emit("\nFailed cases:")
        for r in fail_details:
            cmp = r.get("compare") or {}
            emit(f"  - {r['case_id']}  missing={cmp.get('missing')}  extra={cmp.get('extra')}")

    # Write JSON and 'latest' symlinks
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump({
            "started_at": datetime.fromtimestamp(t_start).isoformat(timespec="seconds"),
            "elapsed": elapsed,
            "summary": {"total": total, "pass": pass_ct, "fail": fail_ct, "error": err_ct},
            "results": all_results,
        }, jf, ensure_ascii=False, indent=2)
    for link, target in ((latest_log, log_path), (latest_json, json_path)):
        try:
            if os.path.islink(link) or os.path.exists(link):
                os.remove(link)
            os.symlink(os.path.basename(target), link)
        except OSError:
            pass
    emit(f"\nResults: {log_path}")
    emit(f"JSON:    {json_path}")
    log_f.close()


if __name__ == "__main__":
    main()
