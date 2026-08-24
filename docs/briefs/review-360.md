# Review brief: PR #360 — pending.test.ts's three stacked races, one of them product (flake-pending)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/360, head e028f32c, branch flake-pending. You are in the author's worktree (`.worktrees/flake-pending`) — read, build, run; do not push.

## What to do

1. Read `HACKING.md` in FULL; review per it.
2. The claims, sharpest first: (3) a PRODUCT race — `survey` and `commit` fighting over git's index.lock (status refreshes the index; commit writes it), fixed by one semaphore permit per Repo handle held for the whole verb. THIS IS THE FINDING TO ATTACK: is the semaphore actually per-handle-per-repo (two handles on one directory?); can it deadlock (a verb that awaits another verb on the same handle?); does it serialize things that were correctly concurrent (read-only surveys now queueing behind slow commits — a latency regression the ops layer's callers would feel?); is index.lock contention REALLY possible on master's call graph or only in the test's artificial concurrency? (2) the 40ms test window vs the product's 15s debounce — verify the product window claim and that onSettled-snapshotted-before-action cannot itself race. (1) the GIT_IDENT env pinning — hermetic, restored correctly, and the empty-ident scenario actually exercises the original failure.
3. Verify, don't trust: run the file alone + full suite, under load if you can; check the 20-run pin claim's shape; check no other lane's files moved (serve/reaper/lock/e2e are other lanes tonight).
4. Post your review as a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line, MUSTs with a failure scenario.
5. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight lane: nobody answers questions before morning — state what needs ruling as a finding in the comment.