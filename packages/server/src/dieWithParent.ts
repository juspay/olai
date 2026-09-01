/**
 * A TIE to one process, and the four moments of it.
 *
 * This process is tied to at most one other: the one that spawned it and
 * asked to be died with. That tie is a PID, and everything in this file is a
 * moment of it —
 *
 *   ARRIVES. `OLAI_DIE_WITH_PARENT=<the spawner's own pid>`, set by the
 *            spawner before the spawn ({@link DIE_WITH_PARENT}). The e2e
 *            harness (`packages/tests/support/hooks.ts`), the
 *            process-boundary unit tests (`./child.testlib.ts`) and the shell
 *            drivers (`support/serve.sh`) set it, because a runner that can be
 *            SIGKILLed needs a floor under its cleanup. Nothing else does, so
 *            a wrapper, a systemd unit, a shell or a person leaves this
 *            process UNTIED — and an untied process outlives whoever started
 *            it.
 *   TOLD.    `prctl(PR_SET_PDEATHSIG, SIGTERM)`: the kernel sends that TERM
 *            when the parent that was there at the arm dies. SIGTERM and not
 *            SIGKILL, so the lock-file finalizer still runs.
 *   CHECKED. Once, immediately after the arm, because the kernel's half of the
 *            tie can be missed: a parent that died BEFORE the arm is a signal
 *            that was already not sent, and no later one is coming (measured
 *            — arming after the parent's death delivers nothing, ever). The
 *            check IS the tie, read back: *the process I was tied to is not my
 *            parent any more.*
 *   DROPPED. The tie is consumed out of the environment, because it names THIS
 *            process's parent and a child of this process has a different one.
 *            Left in place it would tell a grandchild it was tied to a process
 *            that is not its parent — which reads as already-orphaned, and
 *            stops it at boot.
 *
 * WHAT IT REPLACED, because the tie is the fix and not a decoration. #355
 * armed the same `prctl` unconditionally and paired it with `getppid() === 1`
 * — *my parent is init, so I was orphaned.* That sentence is wrong in both
 * directions, and both were measured here:
 *
 *   - FALSE POSITIVE, for every daemonising wrapper. A wrapper's whole job is
 *     to exit and leave the child running, and a child whose parent exits
 *     reads `getppid() === 1` and lives on indefinitely — healthy, and killed.
 *     On 2026-08-23 a demo recording lost its server mid-capture, and the
 *     workaround was the awkward one (keep the server a child of the
 *     recorder); opencode's review of #355 predicted it in a nit at the time.
 *   - FALSE NEGATIVE, under a `PR_SET_CHILD_SUBREAPER` ancestor (a session
 *     manager, a supervisor, `systemd-run --user --scope`), where an orphan
 *     reparents to the subreaper and never reads 1 at all — so the one case
 *     that check was written for is the case it misses there. This is the
 *     whole reason the tie is a PID rather than a yes: *not my parent any
 *     more* is the same sentence whichever of the two a machine has, and it
 *     needs no guess about which. (A tie to pid `1` is meanwhile legitimate —
 *     a container's entry point is PID 1 and may spawn a server it means to
 *     keep — which a yes spelled `1` could not have said.)
 *
 * The residual is pid reuse inside the milliseconds between the spawn and the
 * arm, which would have to land on this exact number to be wrong.
 *
 * Measured with them, on this project's Linux (7.1.5, bun 1.4.0):
 * `PR_SET_PDEATHSIG` fires on the death of the parent that was there when it
 * was armed, and its SIGTERM arrives ahead of the reparenting settling —
 * `getppid()` reads 1 by the time the handler runs without a subreaper, and
 * still reads the DYING parent's pid with one. That is the shape
 * `@olai/sigterm`'s judge honors, and this file does not change it.
 *
 * WHERE THIS LIVES, and why not lower. The volatility is HOW a process is tied
 * to another's lifetime: Linux's `prctl` today, nothing on darwin, a pidfd
 * tomorrow — and it has already changed once, from #355's shape to this one,
 * without the composition root's call site (`dieWithParent()`) changing at
 * all. It is not `packages/child`'s: that package's README and
 * `docs/architecture.md` both put the orphan sweep explicitly OUT of it. It is
 * not `@olai/sigterm`'s either — that package is the RECEIVE side, deciding
 * which TERMs to honor, where this is the composition root deciding who may
 * make the kernel send one.
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

/** The variable a spawner sets to its OWN pid, to tie the process it is about
 *  to start to itself. */
export const DIE_WITH_PARENT = "OLAI_DIE_WITH_PARENT"

/** PR_SET_PDEATHSIG, and the signal the kernel should send. */
const PR_SET_PDEATHSIG = 1
const SIGTERM = 15

/**
 * The tie as a value: the pid this process was tied to, or `null` for none.
 *
 * The pid IS the tie — there is no second flag saying whether one exists, and
 * no arm-order convention holding the two in agreement. `null` is the default
 * and the answer to anything unreadable: a process never stops itself over an
 * instruction it could not read, so a malformed value is a complaint rather
 * than an exit, and a complaint can only exist on the untied arm.
 */
export type ParentTie =
  | { readonly parent: number }
  | { readonly parent: null; readonly complaint?: string }

/** Read the tie out of an environment. Pure: the whole policy, without a
 *  process to kill. */
export const parentTie = (env: NodeJS.ProcessEnv): ParentTie => {
  const raw = env[DIE_WITH_PARENT]
  if (raw === undefined || raw === "") return { parent: null }
  const asked = Number(raw)
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(asked) || asked < 1) {
    return {
      parent: null,
      complaint:
        `olai: ignoring ${DIE_WITH_PARENT}=${raw} — it must be the spawning ` +
        `process's own pid (\`${DIE_WITH_PARENT}=$$\`); not dying with any parent`,
    }
  }
  return { parent: asked }
}

/** Honor the tie: tell the kernel about it, then read it back once. The four
 *  moments in the header, in the order the header names them. */
export const dieWithParent = (env: NodeJS.ProcessEnv = process.env): void => {
  const tie = parentTie(env)
  // Dropped in the same breath as it is read: what this process was told
  // about ITS parent is not true of anything it spawns.
  delete env[DIE_WITH_PARENT]
  if (tie.parent === null) {
    if (tie.complaint !== undefined) process.stderr.write(`${tie.complaint}\n`)
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
      // Read back AFTER the arm, so a parent dying in between is caught by one
      // or the other and missed by neither.
      if (process.ppid !== tie.parent) process.kill(process.pid, "SIGTERM")
      return
    } catch {
      // try the next soname
    }
  }
  process.stderr.write(
    `olai: tied to pid ${tie.parent} (${DIE_WITH_PARENT}), but libc would not ` +
      `load — PR_SET_PDEATHSIG is not armed and this process can outlive it\n`,
  )
}
