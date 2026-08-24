# Review brief: PR #363 — the six load-class e2e scenarios wait on events, two product races fall out (flake-e2e-load)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/363, head 63fac4ce, branch flake-e2e-load. You are in the author's worktree (`.worktrees/flake-e2e-load`) — read, build, run; do not push.

1. Read `HACKING.md` in FULL; review per it.
2. The claims: six scenarios re-waited on real events (each with a TEST verdict), plus TWO PRODUCT fixes in the landing path — (a) `window.scrollBy` replaced with scrolling the nearest overflow box (split panes are overflow-y-auto), (b) the landing's 2s hang window now opens when the frame has real height instead of counting from the 70dvh guess. ATTACK THE PRODUCT FIXES FIRST: does nearest-overflow-box scrolling regress the whole-window case the old code served (a full-page article, no split)? Is "real height" well-defined on a frame that never grows (does the window now never open — a hang, or never fire — a silent skip)? Do the seal/click rules from #362's html_previews changes (merged tonight? check master) interact with these lines? Then the waits: does any new wait read a condition BEFORE snapshotting (the hole #360's reviewer named in push-wait loops); is the documents.feature fixture prose change (#swatches no longer a tag) weakening what the scenario proves?
3. Verify, don't trust: run the six features ×several under stress + 8-parallel (the author's own window); the whole suite once loaded; typecheck; confirm only this lane's files moved (e2e features/steps/support + the landing product files; pending/serve/reaper/lock untouched — serve/reaper are merged master now).
4. Post a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line, MUSTs with a failure scenario.
5. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight: nobody answers before morning — rule-needing things go in the comment as findings.