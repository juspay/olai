# Review brief: PR #359 — serve.test.ts waits on events, not the clock (flake-serve)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/359, head 0dc404ed, branch flake-serve. You are in the author's worktree (`.worktrees/flake-serve`) — read, build, run; do not push.

## What to do

1. Read `HACKING.md` in FULL; review per it.
2. The claim: serve.test.ts's flake was three TEST-races — a 25ms polling loop on the serving line (now an event wait on the child's own stdout chunk), bun's 5s default test bound under BOOT_TIMEOUT=10s (now BOUND_MS=2×BOOT_TIMEOUT per test), and an inherited-PATH agent leak (#355's twin, now the same off-switch serve.testlib/run() as startWeb). The author judged NO product race. Challenge that judgment specifically: is there any path where the SERVER's listen/ready can honestly hang or misreport that these test fixes would now hide?
3. Verify, don't trust: run the file alone and inside the full suite, ideally under load (stress-ng via nix is fair); check the pin claim's shape (20 consecutive loaded runs, AFTER_FAIL=0); check nothing outside this lane's files moved (pending/reaper/lock/e2e are other lanes tonight).
4. Post your review as a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line; MUSTs need a failure scenario.
5. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight lane: nobody will answer questions until morning — if something must be ruled, state it in the comment as a finding rather than waiting.