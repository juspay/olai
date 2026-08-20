# RCA: olai.service died by outside SIGTERM, twice in one night, and stayed down (2026-08-20)

**Status**: module fixed (`Restart=always` + `RestartSec=1s`, `SuccessExitStatus=130` kept) — the live unit gains `Restart=always` at the host's next home-manager switch; sender of the SIGTERM unknown after ruling out every kill path in this repo (and the odu/kolu tooling the overnight lanes were running).

## Timeline (host journal, 2026-08-19 evening → 2026-08-20 morning)

Live unit (`systemctl --user cat olai.service`, home-manager generated from `nix/home/module.nix`):

```
ExecStart=/nix/store/…-olai/bin/olai web /home/srid/code/olai/docs --port 7714 --host 127.0.0.1
Restart=on-failure
SuccessExitStatus=130
```

`journalctl --user -u olai --since "2026-08-19 20:00"`, lifecycle lines only:

| time | what |
|---|---|
| 20:49:45 | `olai web: received SIGTERM` + systemd `Stopped` + `Started` — a deliberate `systemctl` restart |
| 23:06:33 | `olai web: received SIGTERM`; systemd `Consumed 2min 6s CPU time over 2h 16min wall clock…`. **No** `Stopping`/`Stopped`, **no** restart. Unit went inactive. |
| 00:52:15 | systemd `Started` — orchestrator restarted it by hand, 105 min later |
| 06:01:09 | `olai web: received SIGTERM`; systemd `Consumed 4min 23s CPU time over 5h 8min wall clock…`. Again: no Stopping/Stopped, no restart. |
| 06:51:32 | systemd `Started` — restarted by hand, 50 min later |
| 08:12:02 | `received SIGTERM` / `Stopped` / `Started` — deliberate restart (new store path) |

`systemctl --user show olai` after the last hand-start: `ActiveState=active`, `NRestarts=0`, `Result=success`.

The two deaths that went dark (23:06, 06:01) both fell inside windows of heavy `nix-daemon` activity by this user — overnight agent lanes running e2e/CI in `.worktrees/*`.

## Mechanism

The roadmap note's "the service has no `Restart=`" was stale. The unit already had `Restart=on-failure`. Effect's `runMain` handles SIGTERM, writes `olai web: received SIGTERM` to stderr, and **exits 130**. `SuccessExitStatus=130` declares that a clean success, so `systemctl stop` does not land the unit in failed — which is the right call for a deliberate stop.

The two lines together are exactly the configuration that makes a stray SIGTERM take the ledger down for hours: `on-failure` does not restart a successful exit. systemd's table (`man systemd.service`, `Restart=`) is unambiguous — a clean exit (exit 0, or a status listed in `SuccessExitStatus=`) restarts only under `always` / `on-success`, not under `on-failure`.

`Restart=always` is the fix that keeps the two properties we want:

- A SIGTERM that did **not** come from systemd comes back after `RestartSec=1s`.
- A death that **was** a systemd operation is never restarted: "When the death of the process is a result of systemd operation (e.g. service stop or restart), the service will not be restarted" (`man systemd.service`, `Restart=`). `systemctl stop` / `restart` stay deliberate.

`SuccessExitStatus=130` stays. Dropping it would make every clean stop a failed unit.

## Launchd (parity check, not a Darwin incident)

The Darwin agent is `KeepAlive.SuccessfulExit=false` + `Crashed=true`. `launchd.plist(5)`: `SuccessfulExit=false` restarts on the inverse of a zero exit, so a 130 **already restarts there** — 130 is non-zero, and Effect exits rather than dying of an uncaught signal, so the `Crashed=` arm is not the one that fires. `KeepAlive=true` would also restart a clean 0, which `olai web` never does (it waits until interrupted). `launchctl bootout` stays a deliberate stop either way. Linux was the gap; Darwin already survived the incident's exit.

## Sender

Something sent SIGTERM **straight to the process**. systemd did not stop the unit: the 20:49 and 08:12 restarts have `Stopped`/`Started` pairs; the 23:06 and 06:01 deaths have neither. A `systemctl kill` or a raw `kill -TERM <mainpid>` would look like this; a `systemctl stop` would not.

**Not found in this repo.** Every kill path was read. None of them can hit the 7714 user unit:

| suspect | what it actually kills | signal | why it cannot be 7714 |
|---|---|---|---|
| e2e harness (`packages/tests/support/hooks.ts` `killChild`, `stopOwnServer`) | the `ChildProcess` it spawned | **SIGKILL**, not SIGTERM | no `--port` unless a `@scratch:` scenario is restarting *its own* already-bound OS-assigned port; the harness's own comment: "two worktrees cannot pick the same number and cannot squat production" |
| `underload.sh` | the busy-wait `bash -c 'while :'` loops it spawned | SIGTERM of those pids | never names olai |
| `wire.sh` / `evidence.sh` / `support/serve.sh` | `$OLAI_SERVER`, which is `$!` of the bun they just spawned | SIGTERM of that child | port 0 unless `PORT=` is set, and `olai_port_free` **refuses** an explicit port something else is already serving. Pid is not read from `.olai-dev/url` |
| `just serve` | `trap 'kill 0'` — this recipe's process group | SIGTERM of the group | a systemd user unit is its own cgroup; it is not in the recipe's group |
| `just run` | nothing; writes `.olai-dev/url` (`url` + `pid=`) | — | nothing in this repo reads that pid and kills it. Docs say `curl` the URL to check staleness |
| packaged `olai web` (`packages/server`) | `process.kill(pid, 0)` is a liveness probe (signal 0) in `lock.ts`; tests `child.kill()` their own children | 0 / test-only | no process-group or parent signal on shutdown |
| ACP child (`packages/chat/src/agent.ts` `stop`) | `at.child.kill()` — the agent subprocess this server spawned | default SIGTERM of **the child** | the parent is the server; killing the child does not signal the parent |
| `packages/acp` | — | — | no `kill` at all |
| `scripts/` | hydrate / kolu-deps / bun-test-preload | — | no process control |

**Read, not changed, outside this repo:**

- `~/.config/odu` is `hosts.json`. No kill scripts. odu's own `cancel`/`supersede` tears down a CI coordinator in a checkout, not `olai.service`.
- `~/code/kolu/.worktrees/master`: `justfile` `dev-clean` `kill -TERM`s padi/kaval pids from *their* runtime dir, with a state-root manifest check so it will not touch a foreign pid. No `pkill -f olai`, no `lsof -ti:7714`.

No `pkill -f "olai web"`, no `lsof -ti:7714 | xargs kill`, no stale-`.olai-dev/url`-pid kill exists in this tree. A guess that "nix-daemon did it" because the deaths sat in busy-build windows is not a finding — nix sandboxing is a PID namespace; a build's teardown cannot signal the host's user unit. The sender is **unknown**. Next time: the unit comes back in a second, and the `received SIGTERM` line plus the absence of systemd `Stopped` still names an outside signal.

## Fix

`nix/home/module.nix` (asserted by `nix/home/check.nix`, described by `docs/running.md`):

- Linux: `Restart=always`, `RestartSec=1s`, `SuccessExitStatus=130` kept.
- Darwin: KeepAlive dict unchanged (already restarts 130); comment now says so.

## How we'd know next time

- Journal still prints `olai web: received SIGTERM`.
- A systemd-initiated stop has `Stopping`/`Stopped`. An outside SIGTERM does not — and, with this unit, is followed by a start ~1s later (`NRestarts` increments, `ActiveState=active`).
- If it does **not** come back, the start limiter fired (`StartLimitBurst=` / `StartLimitIntervalSec=`, systemd defaults) or the unit was actually stopped. `systemctl --user status olai` says which.
