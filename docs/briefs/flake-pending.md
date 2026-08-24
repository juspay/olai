# Brief: kill the pending.test.ts flake (flake-pending)

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/flake-pending`, branch `flake-pending`) of `/home/srid/code/olai`. Overnight lane: the human is asleep; your report is the gate.

## The flake (Inbox → flaky tests → pending-test-quiet-window-flaky)

`packages/ops/src/pending.test.ts` → "a flurry of writes records itself as ONE commit". Three sightings on 2026-08-23:
1. grok reviewing #357 (full `just test` under load): quiet-window commit counts failed.
2. #357's CI at b8474c6c: failed in ALL THREE unit-leg runs under load — the most consistent of that batch. Quiet box: 61/61.
3. #358's author: failed 2 of 3 consecutive single-file runs under load, **with `fatal: empty ident name` from git in the fixture's temp repository**. The test's window is 40ms.

**The cause hint is sighting 3:** an ident-less fixture repo means git's identity is coming from ambient config that can race or vanish under load — the fixture likely needs explicit `user.name`/`user.email` (config or env), and the 40ms quiet window is a wall-clock wait on top. Two distinct races may be stacked here.

## The treatment (the #347 standard)

1. Reproduce on the UNMODIFIED file — runs alone and within the full suite, under load (another build running beside it is fair game; `nix run nixpkgs#stress-ng` if you need synthetic load).
2. For each distinct failure: decide TEST-race vs PRODUCT-race. Fix the product where it is the product (the ops layer's quiet-window commit logic is product code — if a flurry can honestly record as two commits under load, that is a product bug, not a test bug). Find what the test waits on and wait on THAT, not on time.
3. Fix the fixture's git identity properly (explicit, hermetic — no dependence on the machine's config or env).
4. PIN it: ≥20 consecutive full-file runs green UNDER LOAD, and state the run log in the PR.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. No deferrals — `## Deferrals` says `No deferrals.` or you STOP and ASK here.
- Do not touch other flaky files (serve/reaper/lock/e2e features) — they are other lanes tonight. If your root cause PROVES shared (e.g. one fixture helper), say so in the report and STOP rather than annexing their files.
- Local bar at report: typecheck, unit, the pinned 20-run log. Refactor passes only if the product changed non-trivially.
- CI once at final head after review: preferably BOTH venues — localhost x86_64-linux under /tmp/olai-odu-localhost.lock (--host x86_64-linux=localhost) AND ci@petit aarch64-darwin under /tmp/olai-odu-petit.lock (--host aarch64-darwin=ci@petit). The orchestrator says when.

## When done

Report here: PR URL + head, each race found and its verdict (test vs product) with the fix, the 20-run pin log, suite counts, `No deferrals.` Reviewer (opencode) comes next.