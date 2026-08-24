# Brief: kill the serve.test.ts flake (flake-serve)

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/flake-serve`, branch `flake-serve`) of `/home/srid/code/olai`. Overnight lane: the human is asleep; your report is the gate.

## The flake (Inbox → flaky tests → serve-test-listen-flaky)

`serve.test.ts` (packages/server) fails on a LISTEN TIMEOUT in a full `just test` under load. Sightings 2026-08-23:
1. grok reviewing #357: "6 fails in serve.test.ts (listen timeout)" in a whole-suite run while two lanes + a second review shared the box; judged environment; passed standalone.
2. Earlier #357 CI red runs also had test@x86_64-linux failing on wall-clock-bound subjects (that run named reaper/pending/lock — serve was grok's sighting).

Shape: a server's listen/ready wait bounded by wall-clock that load can blow through — or a port/socket contention between concurrently-running test files. Both are findable.

## The treatment (the #347 standard)

1. Reproduce on the UNMODIFIED file: alone, in the full suite, under load (`nix run nixpkgs#stress-ng` for synthetic load if the box is quiet tonight).
2. Decide each failure: TEST-race vs PRODUCT-race. A listen that can honestly time out under load wants the test to wait on the LISTENING event, not a deadline; a port collision wants per-test isolation (port 0 / per-process runtime dir — the #355 precedent). If the server itself can hang its listen, that is product.
3. PIN it: ≥20 consecutive full-file runs green UNDER LOAD, run log in the PR.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. No deferrals — `## Deferrals` says `No deferrals.` or STOP and ASK here.
- Do not touch the other flake lanes' files (pending/reaper/lock/e2e features) — if the root cause PROVES shared, say so and STOP rather than annexing.
- Local bar at report: typecheck, unit, the 20-run pin log.
- CI once at final head after review: preferably BOTH venues — localhost x86_64-linux under /tmp/olai-odu-localhost.lock (--host x86_64-linux=localhost) AND ci@petit aarch64-darwin under /tmp/olai-odu-petit.lock (--host aarch64-darwin=ci@petit). The orchestrator says when.

## When done

Report here: PR URL + head, each race and its verdict with the fix, the pin log, suite counts, `No deferrals.` Reviewer (opencode) comes next.