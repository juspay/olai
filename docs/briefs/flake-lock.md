# Brief: kill the lock.test.ts flake (flake-lock)

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/flake-lock`, branch `flake-lock`) of `/home/srid/code/olai`. Overnight lane: the human is asleep; your report is the gate.

## The flake (Inbox → flaky tests → lock-test-flaky) — and what already changed under it

`lock.test.ts` failed in #357's CI unit leg at b8474c6c (runs 2–3, alternating with reaper.test.ts; quiet-box green) on a 10s "the server never said where it was serving" boot timeout — 5.9–6.3s lock boots against the old wait. Since then, **#359 merged (ad1e076d)**: `child.testlib.ts`'s wait is now chunk-driven (the serving line's own stdout event, BOOT_TIMEOUT only a hang detector), and lock.test.ts already had BOUND_MS. #361 also merged (reaper waits on deaths). Your branch is cut AFTER both.

So your job is judgment first, not surgery:
1. Reproduce on YOUR branch (which has #359's fix): lock.test.ts alone ×20 under load, 8-way parallel × 3 rounds (the CI-shaped window), full suite under load. If the flake is GONE — #359's fix covered it — your PR is the PIN plus whatever residue you find: verify the file has no other wall-clock waits (flock acquisition waits? stale-lock sweeps timed?), fix any you find the #347 way, and state plainly in the PR that the root cause was #359's, with your evidence.
2. If it still fires: the residue is yours — find the actual wait, fix it (test-race vs product-race decided honestly; the lock/flock machinery is #355's product — a product bug there is a real finding).
3. PIN: ≥20 consecutive full-file runs green under load, log in the PR. A PR that only adds/strengthens the pin and cleans residual clock-waits is a fine PR — do not invent work.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. No deferrals — or state the blocker as a finding (nobody answers before morning).
- Other lanes own pending.test.ts and the e2e features tonight; serve/reaper are MERGED (their files are yours to read, not re-litigate).
- Local bar at report: typecheck, unit, the pin log.
- CI once at final head after review, both venues (localhost x86_64-linux under /tmp/olai-odu-localhost.lock --host x86_64-linux=localhost; ci@petit aarch64-darwin under /tmp/olai-odu-petit.lock --host aarch64-darwin=ci@petit). Flocks queue behind other lanes — expected. The orchestrator says when.

## When done

Report here: PR URL + head, the reproduce verdict (gone-via-#359 with evidence, or residue found and fixed), the pin log, `No deferrals.` Reviewer (opencode) comes next.