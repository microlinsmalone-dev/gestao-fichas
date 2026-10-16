#!/usr/bin/env python3
"""
Standalone Test Runner for SistemaFichas_Web E2E Test Suite
Executes Tiers 1-4, reports per-tier statistics, and returns exit code 0 on success.
Author: test_writer_e2e
"""

import sys
import os
import time
import unittest
import argparse

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from tests.e2e import test_tier1_features
from tests.e2e import test_tier2_boundaries
from tests.e2e import test_tier3_interactions
from tests.e2e import test_tier4_scenarios


TIER_MODULES = {
    1: {
        "name": "Tier 1: Feature Coverage (F1..F10)",
        "module": test_tier1_features,
        "target_min": 50
    },
    2: {
        "name": "Tier 2: Boundary & Corner Cases (F1..F10)",
        "module": test_tier2_boundaries,
        "target_min": 50
    },
    3: {
        "name": "Tier 3: Cross-Feature Interactions",
        "module": test_tier3_interactions,
        "target_min": 10
    },
    4: {
        "name": "Tier 4: Real-World User Scenarios",
        "module": test_tier4_scenarios,
        "target_min": 5
    }
}


def run_tier(tier_num: int, tier_info: dict, verbose: bool = False):
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(tier_info["module"])

    stream = open(os.devnull, "w") if not verbose else sys.stdout
    runner = unittest.TextTestRunner(stream=stream, verbosity=2 if verbose else 0)

    start_time = time.time()
    result = runner.run(suite)
    elapsed = time.time() - start_time

    if not verbose:
        stream.close()

    total = result.testsRun
    failed = len(result.failures)
    errors = len(result.errors)
    passed = total - failed - errors

    return {
        "tier": tier_num,
        "name": tier_info["name"],
        "target_min": tier_info["target_min"],
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "elapsed": elapsed,
        "success": (failed == 0 and errors == 0 and total >= tier_info["target_min"])
    }


def main():
    parser = argparse.ArgumentParser(description="SistemaFichas_Web E2E Test Runner")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4], help="Execute only a specific tier (1, 2, 3, or 4)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose test execution output")
    args = parser.parse_args()

    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    selected_tiers = [args.tier] if args.tier else [1, 2, 3, 4]

    print("=" * 80)
    print(" SISTEMAFICHAS_WEB - END-TO-END ACCEPTANCE TEST SUITE")
    print("=" * 80)
    print(f" Workspace: {PROJECT_ROOT}")
    print(f" Execution Mode: {'All Tiers (1-4)' if not args.tier else f'Tier {args.tier} only'}")
    print(f" Verbosity: {'Verbose' if args.verbose else 'Standard'}")
    print("-" * 80)

    results = []
    overall_start = time.time()

    for t_num in selected_tiers:
        t_info = TIER_MODULES[t_num]
        print(f"\n[RUNNING] {t_info['name']} ...", flush=True)
        res = run_tier(t_num, t_info, verbose=args.verbose)
        results.append(res)
        status_sym = "PASSED" if res["success"] else "FAILED"
        print(f"  -> {status_sym}: {res['passed']}/{res['total']} passed in {res['elapsed']:.3f}s (Min Req: {res['target_min']})")

    overall_elapsed = time.time() - overall_start

    # Summary Table
    print("\n" + "=" * 80)
    print("                         TEST EXECUTION SUMMARY")
    print("=" * 80)
    header = f" {'Tier':<6} | {'Description':<38} | {'Passed':<6} | {'Failed':<6} | {'Time (s)':<8} | {'Status':<6}"
    print(header)
    print("-" * 80)

    grand_total = sum(r["total"] for r in results)
    grand_passed = sum(r["passed"] for r in results)
    grand_failed = sum(r["failed"] for r in results)
    grand_errors = sum(r["errors"] for r in results)
    all_succeeded = all(r["success"] for r in results)

    for r in results:
        status_str = "PASS" if r["success"] else "FAIL"
        row = f" Tier {r['tier']:<1} | {r['name']:<38} | {r['passed']:<6} | {r['failed'] + r['errors']:<6} | {r['elapsed']:<8.3f} | {status_str:<6}"
        print(row)

    print("-" * 80)
    pass_rate = (grand_passed / grand_total * 100.0) if grand_total > 0 else 0.0
    summary_line = f" TOTAL  | Grand Total: {grand_total:<25} | {grand_passed:<6} | {grand_failed + grand_errors:<6} | {overall_elapsed:<8.3f} | {pass_rate:.1f}%"
    print(summary_line)
    print("=" * 80)

    if all_succeeded:
        print(f"\n>>> RESULT: SUCCESS - All {grand_total} tests passed across all tiers (100% pass rate).")
        sys.exit(0)
    else:
        print(f"\n>>> RESULT: FAILURE - One or more tests failed or threshold not met.")
        sys.exit(1)


if __name__ == "__main__":
    main()
