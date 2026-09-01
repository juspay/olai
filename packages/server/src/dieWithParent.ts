/**
 * Die with the parent that ASKED to be died with — and with nobody else.
 *
 * #355 armed `prctl(PR_SET_PDEATHSIG, SIGTERM)` at boot so a server spawned by
 * the e2e harness could not outlive a SIGKILLed cucumber (230 `olai web`
 * processes sat on `/tmp` directories that were already gone), and paired it
 * with a check for the RACE that arm cannot cover: a parent that died between
 * the spawn and this call is a parent whose death signal has already not been
 * sent, and no later one is coming. The check it used was `getppid() === 1` —
 * *my parent is init, so I was orphaned* — and it was armed unconditionally.
 *
 * That sentence is false in both directions, and both were measured (below).
 * It is a FALSE POSITIVE for every daemonising wrapper, because a wrapper's
 * whole job is to exit and leave the child running: the child reads PID 1 and
 * kills itself while perfectly healthy. Not hypothetical — on 2026-08-23 a
 * demo recording lost its server mid-capture, and the workaround was the
 * awkward one (keep the server a child of the recorder). opencode's review of
 * #355 predicted exactly this in a nit at the time. It is also a FALSE
 * NEGATIVE under a `PR_SET_CHILD_SUBREAPER` ancestor (a session manager, a
 * supervisor, `systemd-run --user --scope`), where an orphan reparents to the
 * subreaper rather than to 1 — so the one case the check was written for is
 * the case it misses there.
 *
 * So the gate is the SPAWN SHAPE, not the parent's number.
 * {@link DIE_WITH_PARENT} — `OLAI_DIE_WITH_PARENT=<the spawner's own pid>` —
 * is a caller tying this process to itself: the e2e harness
 * (`packages/tests/support/hooks.ts`), the process-boundary unit tests
 * (`child.testlib.ts`) and the shell drivers (`support/serve.sh`) set it,
 * because a runner that can be SIGKILLed needs a floor under its cleanup.
 * Nothing else does, so a wrapper, a systemd unit, a shell or a person gets
 * neither the arm nor the check, and a server started any of those ways
 * outlives whoever started it.
 *
 * The variable carries the spawner's PID rather than a bare yes, because that
 * pid is also the honest race test: *the process that tied me to it is not my
 * parent any more* is true whether the orphan landed on init or on a
 * subreaper, and it needs no guess about which of those a machine has. The
 * residual is pid reuse inside the milliseconds between the spawn and this
 * call, which would have to hit this exact number to be wrong.
 *
 * MEASURED on this project's Linux (7.1.5, bun 1.4.0), because every sentence
 * above is a claim about the kernel rather than about this code:
 *
 *   1. A child whose parent exits reports `getppid() === 1` and lives on
 *      indefinitely — the daemonised shape, healthy, and what today's check
 *      killed.
 *   2. `PR_SET_PDEATHSIG` fires on the death of the parent that was there
 *      when it was armed, and the SIGTERM arrives ahead of the reparenting
 *      settling: `getppid()` reads 1 by the time the handler runs without a
 *      subreaper, and still reads the DYING parent's pid with one.
 *   3. With a `PR_SET_CHILD_SUBREAPER` grandparent, an orphan reparents to
 *      the subreaper's pid, never to 1.
 *   4. Arming AFTER the parent has died delivers nothing, ever — the race is
 *      real, and only a check after the arm closes it.
 *
 * ONE call goes through `bun:ffi`: `prctl`, which the runtime does not expose.
 * The parent is read as `process.ppid`, which it does — and which is a LIVE
 * read rather than a value captured at start (measured: it tracks libc's
 * `getppid()` exactly across a reparent, both moving from the spawner's pid to
 * 1 in the same 100ms beat). A second FFI symbol for a number the runtime
 * hands over is a second thing that can fail to load on the way to the same
 * answer. It stays best-effort in the same breath as #355 — a machine without
 * the syscall still serves — but a caller who ASKED and did not get it is no
 * longer told nothing: that one says so on stderr, because the cleanup floor
 * it was promised is gone and only the reaper is left holding it.
 */

import { dlopen, FFIType } from "bun:ffi"

/** The variable a spawner sets to its OWN pid to be died with. */
export const DIE_WITH_PARENT = "OLAI_DIE_WITH_PARENT"

/** PR_SET_PDEATHSIG, and the signal it should send. SIGTERM, not SIGKILL, so
 *  the lock-file finalizer still runs. */
const PR_SET_PDEATHSIG = 1
const SIGTERM = 15

/**
 * What {@link DIE_WITH_PARENT} asked for, as a value — the whole policy, so a
 * test can read it without a process to kill.
 *
 * `arm: false` is the default and the answer to anything malformed: a process
 * never stops itself over an instruction it could not read, and the complaint
 * is a line, not an exit.
 */
export type ParentDeathPolicy =
  | { readonly arm: false; readonly complaint?: string }
  | { readonly arm: true; readonly parent: number }

export const parentDeathPolicy = (env: NodeJS.ProcessEnv): ParentDeathPolicy => {
  const raw = env[DIE_WITH_PARENT]
  if (raw === undefined || raw === "") return { arm: false }
  // A pid, spelled as digits: `1` is a legitimate value (a container's
  // entry point is PID 1 and may spawn a server it means to keep), which is
  // why this is a pid and never a yes/no whose "1" would collide with it.
  const asked = Number(raw)
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(asked) || asked < 1) {
    return {
      arm: false,
      complaint:
        `olai: ignoring ${DIE_WITH_PARENT}=${raw} — it must be the spawning ` +
        `process's own pid (\`${DIE_WITH_PARENT}=$$\`); not dying with any parent`,
    }
  }
  return { arm: true, parent: asked }
}

/**
 * Arm the kernel's parent-death signal, if the spawner asked for it, and stop
 * now if that spawner is already gone.
 *
 * The instruction is CONSUMED: it names a parent that is this process's, and
 * a child of this process inherits the environment. Left in place it would
 * tell a grandchild it was tied to a process that is not its parent, which
 * reads as "already orphaned" and stops it at boot.
 */
export const dieWithParent = (env: NodeJS.ProcessEnv = process.env): void => {
  const policy = parentDeathPolicy(env)
  delete env[DIE_WITH_PARENT]
  if (!policy.arm) {
    if (policy.complaint !== undefined) process.stderr.write(`${policy.complaint}\n`)
    return
  }
  // Linux only: `prctl` is the syscall, and darwin has no equivalent that can
  // be called without a helper process. A caller that asked on darwin is not
  // warned — the platform is the answer, and every spawn site here runs on
  // both.
  if (process.platform !== "linux") return
  // The sonames, glibc's then musl's — the same list `./flock.ts` keeps for the
  // same loader, in a PLATFORM table that also answers where errno lives and
  // what EWOULDBLOCK is. Not imported from there: reaching into the lock module
  // for a string would put this file's boot on that one's graph for a reason
  // that has nothing to do with locking. The day a third platform arrives, that
  // table is the fuller answer and this list is two lines to move.
  for (const name of ["libc.so.6", "libc.so"] as const) {
    try {
      const lib = dlopen(name, {
        prctl: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
      })
      lib.symbols.prctl(PR_SET_PDEATHSIG, SIGTERM)
      // The race the arm above cannot cover: a parent that died first is a
      // signal that was already not sent. Asked AFTER the arm, so a parent
      // dying in between is caught by one or the other and not missed by both.
      if (process.ppid !== policy.parent) process.kill(process.pid, "SIGTERM")
      return
    } catch {
      // try the next soname
    }
  }
  process.stderr.write(
    `olai: asked to die with pid ${policy.parent} (${DIE_WITH_PARENT}), but libc ` +
      `would not load — PR_SET_PDEATHSIG is not armed and this process can outlive it\n`,
  )
}
