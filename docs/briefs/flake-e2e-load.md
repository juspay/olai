# Brief: kill the loaded-localhost e2e flake class (flake-e2e-load)

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/flake-e2e-load`, branch `flake-e2e-load`) of `/home/srid/code/olai`. Overnight lane: the human is asleep; your report is the gate.

## The flake class (Inbox → flaky tests → e2e-localhost-load-flakes)

Six e2e scenarios across six feature files fail 1–3 per ~880 on a LOADED localhost and pass on rerun / on a quiet box:
- Batch 1 (#351's CI, 2026-08-22): `html_previews.feature:36` (a picture never refused in report.html), `archived_only_in_trash.feature:29` (agenda-empty timeout), `the_sidebar_sticks.feature:36` ("page does not scroll in this window").
- Batch 2 (#357's CI at b8474c6c, e2e leg 17m52s vs 5m37s quiet): `an_answer_leaves_the_rows_standing:51`, `documents:231`, `filter_in_place:202`.

All judged wall-clock waits until proven otherwise. Each wants the #347 treatment: find what the step actually waits on and wait on THAT, not on time. The step_definitions and support layers are shared — a fix in a shared wait helper is in scope; six copies of the same fix are not (find the shared socket).

## The treatment

1. Reproduce first: run the six features on the UNMODIFIED tree under load (`nix run nixpkgs#stress-ng --cpu 16` beside the run, or 8-way parallel bun workers — the CI-shaped contention that #361 used). Get each scenario's actual failure text.
2. Per scenario: what is the step waiting on, and what EVENT should it wait on instead? Timing budgets are hang detectors, never the wait. If any failure turns out to be PRODUCT (the page honestly doesn't converge under load), that is the finding of the night — fix it in the product and say so loudly.
3. PIN: the six features ≥20 consecutive runs green under the same load, run log in the PR. A whole-suite loaded run at the end for the class claim.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. No deferrals — or state the blocker as a finding (nobody answers before morning).
- Other lanes tonight own pending.test.ts, serve.test.ts, reaper.test.ts, lock.test.ts — do NOT touch them. Shared e2e support/step files ARE yours where the fix belongs there.
- Local bar at report: typecheck, the six features' pin log, the touched-feature runs.
- CI once at final head after review, both venues preferably (localhost x86_64-linux under /tmp/olai-odu-localhost.lock --host x86_64-linux=localhost; ci@petit aarch64-darwin under /tmp/olai-odu-petit.lock --host aarch64-darwin=ci@petit). The orchestrator says when.

## When done

Report here: PR URL + head, per scenario the wait found and the event it now waits on (test vs product verdict each), the pin log, `No deferrals.` Reviewer (opencode) comes next.