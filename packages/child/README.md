# @olai/child — one owner for a subprocess

Spawn, the exec-failure that arrives after spawn returns, drained stderr, and a kill with a grace period. Listeners attach at spawn. A wait is the event (the chunk, the exit, ESRCH); a clock is only a hang detector that throws with what the child said.

A LEAF: `node:child_process` and nothing else. No Effect — git and chat wrap in their own language. No workspace sibling — a package between a caller and the ability to start a process is the inversion this extraction exists to have stopped.

```ts
import { Hung, run, start } from "@olai/child"

const child = start("git", ["status"], { cwd: root })
const close = await child.wait(10_000, "git status")
// or the one-shot:
const said = await run("git", ["status"], { cwd: root, timeout: 10_000 })
```

## The socket

| | what it is |
|---|---|
| `start` | spawn, with the `error` and `close` listeners already on |
| `Child.unstartable` | a promise that settles ONLY if the exec failed — race it against the conversation |
| `Child.said` / `out` / `err` | drained pipes, so a child nobody is reading cannot block |
| `Child.wait(ms, why)` | the close, or `Hung` after `ms` with what the child said |
| `Child.stop` | SIGTERM, then SIGKILL if the grace expires. ESRCH is success |
| `run` | one-shot: drain both pipes, wait for close. Exec failure is an answer; a hang throws |

**Stdout is not drained by default.** It is often a protocol (ACP, JSON-RPC), and stealing it is worse than not logging it. `run` opts in because the answer *is* the output; a test that reads the serving line does too.

## What is out

Readiness (the serving line, the ACP handshake), transport (how pipes become JSON-RPC), restart policy, and the orphan sweep. #355 answered the last of those: the harness reaper and `PR_SET_PDEATHSIG` own it. A caller whose needs exceed the socket keeps that residue **on top of it**, never beside it.

## Why a receptacle

The same four facts were spelled in `chat/pipes.ts`, `chat/agent.ts`, `git`'s runner, `web/build.ts`, and `server`'s process-boundary tests — each with its own spawn, its own miss of the exec-after-spawn event, its own undrained pipe, its own `kill()` without a grace, its own clock where an event would have done. The weekend flake campaign (#347/#359/#361/#364) traced three test-race families to exactly that ad-hoc plumbing: wait on the event, attach at spawn, throw with what the child said. This package makes those the default so the next caller does not re-earn them.
