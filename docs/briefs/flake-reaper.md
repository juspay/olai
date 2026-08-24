# Brief: kill the reaper.test.ts flake (flake-reaper)

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/flake-reaper`, branch `flake-reaper`) of `/home/srid/code/olai`. Overnight lane: the human is asleep; your report is the gate.

## The flake (Inbox → flaky tests → reaper-test-flaky)

`reaper.test.ts` failed in #357's CI unit leg at b8474c6c (2026-08-23 19:27): failed in run 1, passed in runs 2–3 at the same sha while `lock.test.ts` took its place; 61/61 on a quiet box. The box was carrying another lane's build plus the [parallel] e2e leg. Wall-clock bound suspected. Context worth reading first: the reaper itself landed in #355 (runtime-dir-flood — harness reaper SIGKILLs its process group, exits 130/143, PDEATHSIG) and one of #355's re-verdict nits was "the 130/143 exit not pinned" — the reaper's own tests may be timing-shaped around process death.

## The treatment (the #347 standard)

1. Reproduce on the UNMODIFIED file: alone, in the full suite, under load (`nix run nixpkgs#stress-ng`). Get the actual failure text before theorizing.
2. Decide each failure: TEST-race vs PRODUCT-race. A test waiting a fixed time for a process to die wants to wait on the DEATH (exit event / waitpid), not a deadline. If the reaper itself can miss a kill or leak under load, that is PRODUCT — fix it there.
3. PIN: ≥20 consecutive full-file runs green UNDER LOAD, run log in the PR.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. No deferrals — `## Deferrals` says `No deferrals.` or state the blocker as a finding (nobody answers questions before morning).
- Other flake lanes tonight own pending.test.ts, serve.test.ts, lock.test.ts and the e2e features — do NOT touch their files. lock.test.ts is the nearest neighbour (same CI leg, alternating failures): if your root cause PROVES shared with lock's, fix it ONLY on your side of the boundary and SAY SO in the report — the lock lane will pick it up.
- Local bar at report: typecheck, unit, the 20-run pin log.
- CI once at final head after review, both venues preferably (localhost x86_64-linux under /tmp/olai-odu-localhost.lock --host x86_64-linux=localhost; ci@petit aarch64-darwin under /tmp/olai-odu-petit.lock --host aarch64-darwin=ci@petit). The orchestrator says when.

## When done

Report here: PR URL + head, each race and verdict with the fix, the pin log, suite counts, `No deferrals.` Reviewer (opencode) comes next.