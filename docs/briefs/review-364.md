# Review brief: PR #364 — lock.test.ts: gone via #359, one residue pinned (flake-lock)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/364, head df37a5c1, branch flake-lock. You are in the author's worktree (`.worktrees/flake-lock`) — read, build, run; do not push.

1. Read `HACKING.md` in FULL; review per it.
2. The claims: (a) the original CI failure was #359's 25ms-poll bug, gone on a post-#359 branch — CHECK the negative: did the author actually try to reproduce on this branch under the CI-shaped window (8-way parallel + load), or only assert it? A "gone" verdict without a reproduction attempt at the old window is a hole. (b) One residue: stoppedWithin's close listener attached after kill → now rides the spawn-time exited() listener, hang throws. Attack: can the spawn-time listener resolve on a close that is NOT the kill's (a child that died earlier for its own reasons — does the test then assert a stale truth)? Is the flock actually released at descriptor close on every path the test asserts? (c) BOUND_MS arithmetic. (d) No product race claimed in the lock/flock machinery — spot-check LOCK_NB and the synchronous sweep claims against the source.
3. Verify, don't trust: lock.test.ts ×20 under load yourself (the author saw loadavg 37–108; stress-ng is fair), 8-way parallel window, full suite once; typecheck; only this lane's files moved.
4. Post a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line, MUSTs with a failure scenario.
5. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight: nobody answers before morning — rule-needing things go in the comment as findings.