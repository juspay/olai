# Review brief: PR #361 — reaper.test.ts waits on deaths, not deadlines (flake-reaper)

You are the REVIEWER. PR: https://github.com/juspay/olai/pull/361, head 5b6140f6, branch flake-reaper. You are in the author's worktree (`.worktrees/flake-reaper`) — read, build, run; do not push.

1. Read `HACKING.md` in FULL; review per it.
2. The claims: two TEST-races, no product change — (a) kill(childPid,0) probed the instant the parent exits, racing SIGKILL's schedule/zombie reaping → now waits on ESRCH; (b) `once("exit")` resolving on a 5s timeout as success, which silently unpinned #355's 130/143 exit codes → now the codes are asserted and a hang THROWS; plus a SIGTERM twin pin. Attack specifically: is "the reaper is not missing the kill" actually proven, or just made unobservable again (does the ESRCH wait have its own unbounded/hidden deadline; can the 130/143 assertion race the shell's own signal handling)? Is the claim that a real cancelled run never probes kill(0) at that instant true of the HARNESS's actual sequence?
3. Verify, don't trust: run the file alone, under stress, and 8-way parallel (the author's 2/24 window); check the pin log shape; confirm no other lane's files moved (pending/serve/lock/e2e).
4. Post a PR COMMENT: OBJECT or DO-NOT-OBJECT, MUST/SHOULD/NIT with file:line, MUSTs with a failure scenario.
5. Report in this terminal: verdict, comment URL, one line per MUST.

Overnight: nobody answers questions before morning — rule-needing things go in the comment as findings.