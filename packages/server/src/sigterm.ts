/**
 * The SIGTERM guard: a stray `kill -TERM` can no longer stop this server,
 * and every attempt names itself (`refused SIGTERM from pid N uid U (…)`).
 *
 * WHY: 2026-08-29, the production `olai.service` was killed twice in one
 * morning by agent lanes' broad `pkill -f` cleanups — everything on that
 * machine runs as one user, so any lane can signal production, and a kill
 * by a shared path substring matches it. The design settled with the human
 * afterwards (oss.olai's brainstorming/deterministic-ban.md, Solution 1)
 * puts the protection in the VICTIM, not in the manners of the senders:
 * catch SIGTERM with `sigaction(2)` + `SA_SIGINFO` so the sender's
 * `si_pid`/`si_uid` are in hand; HONOR the supervisor's stop, REFUSE and
 * name everyone else. The RCA is projects/olai/RCA/2026-08-29-production-sigterm.md.
 *
 * The MECHANISM had to be argued, and here it is. Two routes were tried:
 *
 *   1. signalfd(2) + pthread_sigmask(SIG_BLOCK) in this thread — pure
 *      `bun:ffi`, no compiled code — was measured to LOSE: Bun's
 *      `JITWorker` thread is born before any JavaScript runs and keeps
 *      SIGTERM unblocked, so a process-directed TERM is delivered THERE
 *      (the kernel skips the blocking main thread), where the default
 *      disposition killed the process in the probe. Neither
 *      pthread_sigmask (own thread only) nor any other syscall can raise
 *      another thread's mask, so no pure-ffi scheme based on blocking can
 *      work under a runtime that spawns threads before user code. The
 *      refusal has to be a process-wide CATCHER — dispositions are
 *      process-wide, so it holds in every thread at once.
 *   2. A catcher function from `bun:ffi`'s JSCallback would run JAVASCRIPT
 *      from signal context — the classic violation (allocation, VM locks,
 *      reentrancy). So the handler must be NATIVE code, which the repo has
 *      no toolchain for... except that Bun embeds TinyCC: `bun:ffi`'s
 *      `cc` compiles `./sigterm.c` at boot, in memory, in milliseconds.
 *      The handler is then genuinely native and async-signal-safe by
 *      construction — it only calls write(2) through a pointer handed in
 *      at arm time (PASSING the address sidesteps tcc having to link
 *      against libc, which on NixOS it cannot find). Everything else —
 *      sigaction itself, the pipe, the policy, /proc resolution, the log
 *      lines — is TypeScript right here.
 *
 * The handler appends {si_pid, si_uid, si_code} to a non-blocking
 * self-pipe; a poll loop drains it in ordinary context, where /proc
 * and stderr are safe. The kernel queue IS the flag/self-pipe the
 * classic constraint asks for.
 *
 * The POLICY is {@link judge}, honored at drain time: the supervisor —
 * a live `getppid()`, which is how `systemctl --user stop|restart olai`
 * delivers (the user manager is the service's parent and signals its
 * children) — the process itself (main.ts's parent-death race branch),
 * the parent it had AT ARM TIME when that parent is gone (the measured
 * shape of the `PR_SET_PDEATHSIG` contract main.ts arms: it arrives as
 * SI_USER with the DYING parent's pid, and `getppid()` has usually
 * already moved to 1 by drain time — the review's must-fix), and the
 * belt of pid 0. Honored senders must also carry a kill-family si_code:
 * a supplied siginfo (rt_sigqueueinfo) can claim anybody's pid, and its
 * si_code gives it away. Everyone else is refused, root included:
 * honoring by uid would only give root's TERM a quieter path, and root
 * already owns the uncatchable one below.
 *
 * HONORING is "today's orderly shutdown" byte-for-byte: the guard restores
 * the disposition it found on install (Bun's, armed when main.ts's
 * listeners attached) and re-raises SIGTERM to itself, so the ordinary
 * listeners run — `olai web: received SIGTERM` is written and runMain
 * interrupts the fiber — because that path is the tested, known-good one.
 *
 * The boundary, in one line: SIGKILL and root are outside this guard's
 * promise by design — SIGKILL is uncatchable by ANY process
 * (signal(7): dispositions cannot be set for it), and TERM→KILL
 * escalation (`TimeoutStopSec`, the OOM killer, a deliberate admin) is
 * untouched. This is a deterministic ban on TERM-CLASS ACCIDENTS, the
 * class the incident was made of; auditd names KILL senders.
 *
 * UNAVAILABLE IS LOUD, NOT SILENT: this depends on a documented but
 * experimental Bun API (`cc`) — if compilation, layout or the self-test
 * fail, the server boots with today's default disposition and says so on
 * stderr at start, so a regression in the guard can never masquerade as
 * a guard. Linux-only; darwin keeps the default handling (the supervisor
 * this policy recognizes is systemd's user manager).
 */

import { reasonOf } from "@olai/log"
import { cc, dlopen, FFIType, ptr, type Pointer } from "bun:ffi"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

export const SIGTERM = 15

/** The delivery codes trusted for HONORS, from sigaction(2)'s table.
 *  Cross-process siginfo SUPPLIES are policed by the kernel
 *  (rt_sigqueueinfo(2): si_code ≥ 0 — which is SI_USER — and SI_TKILL
 *  are both refused to the caller), so only the kill family's own sends
 *  ever carry these codes: every siginfo a user-space process hands the
 *  kernel wholesale arrives tagged SI_QUEUE or another of its own — to
 *  the kernel's exact words, "not even root can pretend to send signals
 *  from the kernel". Requiring one of these three is what makes a pid
 *  in a receipt mean the pid that sent it, at least in the kill family
 *  this guard watches. */
export const SI = { USER: 0, TKILL: -6, KERNEL: 128 } as const

/** Whoever a SIGTERM record names — this process, its supervisor, its
 *  (dead or alive) arming parent, or a stranger. `uid` is recorded for
 *  attribution and is deliberately NOT part of the rule: nothing
 *  legitimate here sends root TERMs, so root is refused and named like
 *  any other non-supervisor. */
export interface Sender {
  readonly pid: number
  readonly uid: number
  readonly code: number
}

export type Verdict = "honor" | "refuse"

/** The one question this guard exists to answer, as a pure function.
 *
 *  THE FORGE GATE first: a supplied siginfo (rt_sigqueueinfo) can claim
 *  to be anybody's pid — its si_code gives it away, so honors require a
 *  kill-family code (see SI above). Everything after that trusts the pid.
 *
 *  - SELF: `main.ts`'s dieWithParent race branch kills itself by
 *    process.kill — kill(2), a genuine SI_USER.
 *  - PARENT, read live: the supervisor — `systemctl --user stop|restart`
 *    is the user manager signaling its child. getppid() at RECEIPT time,
 *    not boot: a reparented server honors its NEW parent (a stray
 *    `systemd --user` re-adopting us can still stop us, which is right),
 *    and the reviewers probed Bun 1.4's process.ppid to be a live call.
 *  - ARMED PARENT (the pdeath contract, as MEASURED — this is the arm
 *    the 2026-08-29 review found its first draft wrong about):
 *    `PR_SET_PDEATHSIG`'s death signal arrives with si_code == SI_USER
 *    and si_pid == THE DYING PARENT's own pid — and `forget_original_parent()`
 *    reparents us in the same tick, so by the time the record is drained
 *    `process.ppid` is already 1 and the PARENT arm alone would refuse
 *    it. Hence the pid at ARM time is kept: honored when the current
 *    parent has moved. The price: a stranger inheriting that pid number
 *    within the same tick is honored too — accepted, because a deliberate
 *    actor has SIGKILL anyway, and the un-honored alternative is the
 *    contract dying, which is how the e2e harness used to leak a server
 *    per cancelled run.
 *  - pid 0: the belt. The man pages' example for kernel-sourced signals
 *    — and with the forge gate closed, something genuine: no current
 *    kernel path is KNOWN to send a TERM this way, so it costs nothing
 *    and stands if one is ever found.
 *
 *  Everything else — every agent lane's cleanup, every curious shell —
 *  is refused, whatever its uid. */
export const judge = (
  sender: Sender,
  here: { readonly self: number; readonly parent: number; readonly armedParent: number },
): Verdict => {
  if (sender.code < 0 && sender.code !== SI.TKILL) return "refuse"
  if (sender.pid === 0) return "honor"
  if (sender.pid === here.self || sender.pid === here.parent) return "honor"
  if (sender.pid === here.armedParent && here.parent !== here.armedParent) return "honor"
  return "refuse"
}

/** Rendered attribution for one sender, as the parenthetical both
 *  journal lines carry: the kernel and ourselves by name, a process by
 *  what `/proc/<pid>/cmdline` says — read at DRAIN time, the earliest
 *  point it is safe to touch the filesystem, and still often too late:
 *  a `pkill` has exited by then, in which case the pid and uid
 *  (kernel-recorded at send time, unforgeable) are the attribution and
 *  the line says the cmdline was already gone. */
export const who = (pid: number, self: number): string => {
  if (pid === 0) return "(the kernel)"
  if (pid === self) return "(this process)"
  try {
    const words = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean)
    return words.length === 0 ? "(empty cmdline)" : `(${words.join(" ")})`
  } catch {
    return "(already gone — pid and uid above were recorded at send time)"
  }
}

/** One journal line, whichever way the verdict went — the format is a
 *  promise the docs and the tests both read, so it is built once here:
 *  `olai web: honoring|refused SIGTERM from pid N uid U (…)`. */
const journal = (word: "honoring" | "refused", sender: Sender): string =>
  `olai web: ${word} SIGTERM from pid ${sender.pid} uid ${sender.uid} ${who(sender.pid, process.pid)}\n`

/* ── the mechanism, below the policy ─────────────────────────────── */

/** glibc/musl's userland `struct sigaction` on 64-bit Linux:
 *  handler@0 (8), mask@8 (128 bytes), flags@136, padding, restorer@144
 *  — 152 bytes total. Built by hand because the ffi layer has no headers. */
const SA_SIZE = 152
const SA_FLAGS_OFF = 136
const SA_SIGINFO = 4
const SA_RESTART = 0x10000000

const O_NONBLOCK = 0o4000
const O_CLOEXEC = 0o2000000

/** Bytes per record the C handler writes — {si_pid, si_uid, si_code} as
 *  three little-endian u32s. */
const RECORD_BYTES = 12

/** One caught SIGTERM, as the kernel described the sender at send time. */
interface Receipt {
  readonly pid: number
  readonly uid: number
  readonly code: number
}

/** How often the pipe is drained. Signals are rare, so this is nearly
 *  always one empty non-blocking read; 25ms keeps a refusal line
 *  effectively immediate in a journal. */
const DRAIN_MS = 25

interface Libc {
  readonly pipe2: (fds: Pointer, flags: number) => number
  readonly sigaction: (signo: number, act: Pointer, oldAct: Pointer | null) => number
  readonly writePtr: Pointer
}

/** `pipe2`, `sigaction`, and the ADDRESS of `write(2)` — the dlopen
 *  pattern of ./flock.ts: the soname resolves to the libc the process
 *  already has mapped, on any NixOS closure, with no search path. */
const openLibc = (): Libc => {
  const tried: Array<string> = []
  for (const name of ["libc.so.6", "libc.so"] as const) {
    try {
      const lib = dlopen(name, {
        pipe2: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
        sigaction: { args: [FFIType.i32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
        write: { args: [FFIType.i32, FFIType.ptr, FFIType.u64], returns: FFIType.i64 },
      })
      const writePtr = (lib.symbols.write as unknown as { readonly ptr: Pointer }).ptr
      return {
        pipe2: lib.symbols.pipe2,
        sigaction: lib.symbols.sigaction,
        writePtr,
      }
    } catch (cause) {
      tried.push(`${name}: ${reasonOf(cause)}`)
    }
  }
  throw new Error(`no libc with pipe2/sigaction/write: ${tried.join("; ")}`)
}

/** bun's embedded tinycc finishes every compile with a libc LINK — even
 *  though ./sigterm.c is freestanding and references nothing — and looks
 *  for `libc.so` in FHS paths that do not exist on NixOS. The real object
 *  is already mapped in this process: /proc/self/maps names it, so stage
 *  a scratch dir with `libc.so` symlinked at it and hand tcc that -L.
 *  Cleaned up immediately after the compile; only the compiled code is
 *  needed afterwards. */
// The Library the cc() call returns is deliberately never closed: closing
// would unmap the page the handler's machine code lives on, and the catcher
// must outlive everything else in this process. Same for the dlopen'd libc
// handle above: the write-pointer points into it.
const compileHandler = (): {
  readonly addr: () => bigint | number
  readonly arm: (writeAddr: bigint, fd: number) => void
  readonly dropped: () => bigint | number
} => {
  const libcPath = fs.readFileSync("/proc/self/maps", "utf8")
    .split("\n")
    .find((line) => line.endsWith("/libc.so.6"))
    ?.trimStart()
    .split(/\s+/, 6)[5]
  if (libcPath === undefined) {
    throw new Error("no /libc.so.6 mapping in /proc/self/maps to stage for tinycc")
  }
  const staged = fs.mkdtempSync(path.join(os.tmpdir(), "olai-tcc-libc-"))
  try {
    fs.symlinkSync(libcPath, path.join(staged, "libc.so"))
    const lib = cc({
      source: path.join(import.meta.dir, "sigterm.c"),
      library: "c",
      flags: ["-std=c11", "-O2", `-L${staged}`],
      symbols: {
        olaiAddr: { args: [], returns: FFIType.i64 },
        olaiArm: { args: [FFIType.i64, FFIType.i32], returns: FFIType.void },
        olaiDropped: { args: [], returns: FFIType.i64 },
      },
    })
    return {
      addr: lib.symbols.olaiAddr,
      arm: lib.symbols.olaiArm,
      dropped: lib.symbols.olaiDropped,
    }
  } finally {
    // The symlink has served its purpose the moment cc() returns; the
    // scratch dir must not accumulate across a service's restarts.
    try {
      fs.rmSync(staged, { recursive: true, force: true })
    } catch {
      // cosmetic: one symlink under /tmp
    }
  }
}

let armed = false
/** Where Bun's own disposition was saved at arm time — what an honored
 *  TERM is handed back to. Shared with `apply`, the honor path below. */
let oldAct: Uint8Array | undefined
/** The honor path ran: no second restore+reraise may fire. */
let shuttingDown = false
/** The parent this process had AT ARM TIME: the kernel's parent-death
 *  signal carries THAT pid (drain-time getppid has usually reparented by
 *  then), so it is captured once, here — see `judge`'s armed-parent arm.
 *  -1 until the guard arms: matches no real sender. */
let armedParent = -1

/** Everything an installed catcher needs to serve and be undone. Nothing
 *  in it is ever closed: closing the compiled shim's library would unmap
 *  the page its machine code lives on, and the dlopen'd libc handle owns
 *  the page the write-pointer points into. */
interface Guard {
  readonly libc: Libc
  readonly handler: Handler
  /** The self-pipe's read end. */
  readonly readEnd: number
  /** Hand the disposition BACK to whatever was installed before the arm. */
  readonly disarm: () => void
}

/** The compiled shim's exported vocabulary (its names are deliberately
 *  uninteresting — the module mocks no C). */
interface Handler {
  readonly addr: () => bigint | number
  readonly arm: (writeAddr: bigint, fd: number) => void
  readonly dropped: () => bigint | number
}

/** The arm: libc, the compiled handler, the self-pipe, and the sigaction
 *  that hands SIGTERM's disposition to the catcher. Throws on the first
 *  thing that fails; `disarm` unwinds the one irreversible step. */
const arm = (): Guard => {
  const libc = openLibc()
  const handler: Handler = compileHandler()

  const fds = new Int32Array(2)
  if (libc.pipe2(ptr(fds), O_NONBLOCK | O_CLOEXEC) !== 0) throw new Error("pipe2 failed")
  const [readEnd, writeEnd] = fds
  if (readEnd === undefined || writeEnd === undefined) throw new Error("pipe2 gave no ends")
  handler.arm(BigInt(libc.writePtr), writeEnd)

  const newAct = new Uint8Array(SA_SIZE)
  const view = new DataView(newAct.buffer)
  view.setBigUint64(0, BigInt(handler.addr()), true)
  view.setUint32(SA_FLAGS_OFF, SA_SIGINFO | SA_RESTART, true)
  oldAct = new Uint8Array(SA_SIZE)
  if (libc.sigaction(SIGTERM, ptr(newAct), ptr(oldAct)) !== 0) {
    throw new Error("sigaction(SIGTERM) failed")
  }
  return { libc, handler, readEnd, disarm: () => libc.sigaction(SIGTERM, ptr(oldAct!), null) }
}

/** PROVE the pipeline before anything is called armed: a self-sent TERM
 *  must come back with THIS pid and uid — which is what turns the layout
 *  guesses (siginfo offsets, u32 widths, the write-pointer handoff) into
 *  facts on every boot, on any kernel or libc this repo has never tried.
 *  A real TERM that races the wait still gets the policy: this is exactly
 *  when the disposition is live and the steady-state drain is not. */
const verified = async ({ libc, readEnd }: Guard): Promise<boolean> => {
  const deadline = Date.now() + 2000
  // The FIRST self-record is the probe; a second one is a genuine
  // self-kill and gets the policy like anything else — the proof must
  // not be able to eat a real stop. And a self-match never ends the
  // BATCH: every other receipt read in the same pull is applied before
  // returning, so a supervisor's stop can never be read out and
  // dropped on the floor in this window.
  let probePending = true
  process.kill(process.pid, "SIGTERM")
  while (Date.now() < deadline) {
    for (const receipt of drain(readEnd)) {
      // The catcher covers only SIGTERM, so any record is one; the proof
      // also demands the kill-family code the honor policy will ask of it
      // (a runtime whose process.kill comes in with any other si_code
      // would prove a different thing than the policy upholds).
      if (
        probePending && receipt.pid === process.pid && receipt.uid === getuid() &&
        (receipt.code === SI.USER || receipt.code === SI.TKILL)
      ) {
        probePending = false
        continue
      }
      apply(receipt, libc)
      if (shuttingDown) return true
    }
    if (!probePending) return true
    await Bun.sleep(5)
  }
  return !probePending
}

/** The steady state: poll the pipe, apply the policy, meter the drops.
 *  unref'd — the guard must never be what keeps a process alive: a
 *  finished command exits despite the poll, and runMain's exit code path
 *  ends it in the serving case. */
const drainForever = ({ libc, handler, readEnd }: Guard): void => {
  let droppedReported = 0
  const timer = setInterval(() => {
    for (const receipt of drain(readEnd)) {
      apply(receipt, libc)
      if (shuttingDown) {
        clearInterval(timer)
        return
      }
    }
    const dropped = Number(handler.dropped())
    if (dropped > droppedReported) {
      droppedReported = dropped
      process.stderr.write(
        `olai web: SIGTERM guard dropped ${dropped} attribution record(s) — a signal flood outran the refusal pipe; some senders went unnamed\n`,
      )
    }
  }, DRAIN_MS)
  timer.unref?.()
}

/**
 * Replace SIGTERM's disposition with the attribution catcher and start the
 * drain loop — or say loudly why not and leave today's handling untouched.
 *
 * Must run AFTER this process's own SIGTERM listeners exist (main.ts:
 * the console-line listener, and runMain's interruption): the disposition
 * they armed is what an honored TERM is handed BACK to — `oldAct` is the
 * whole of the honor path.
 */
export const installSigtermGuard = async (): Promise<void> => {
  if (process.platform !== "linux") return
  if (armed) return // one disposition per process; serving two vaults from one process arms once
  // "At arm time" is HERE, not after the proof: the parent can die during
  // the arm itself, and its pid is what the death signal will carry.
  const parentAtEntry = process.ppid
  let guard: Guard | undefined
  try {
    guard = arm()
    if (!(await verified(guard))) {
      throw new Error("self-sent SIGTERM never came back with this process's pid/uid")
    }
    if (shuttingDown) return // honored a REAL term mid-proof; the process is headed out
    armed = true
    armedParent = parentAtEntry
    drainForever(guard)
    process.stderr.write(
      `olai web: SIGTERM guard armed: only the supervisor (pid ${process.ppid}), the kernel, or this process's own pid can stop it; a TERM from any other sender is refused and named\n`,
    )
  } catch (cause) {
    // Disarm FIRST: a catcher whose pipeline failed would otherwise eat
    // TERMs with no attribution forever after.
    guard?.disarm()
    process.stderr.write(
      `olai web: SIGTERM guard unavailable: ${reasonOf(cause)} — SIGTERM keeps its default handling, and any same-uid process on this machine can stop this server\n`,
    )
  }
}

const getuid = (): number => (typeof process.getuid === "function" ? process.getuid() : -1)

/** Everything readable from the pipe right now, as receipts. */
const drain = (fd: number): Array<Receipt> => {
  if (fd < 0) return []
  const buf = new Uint8Array(64 * RECORD_BYTES)
  let n = 0
  try {
    n = fs.readSync(fd, buf, 0, buf.length, null)
  } catch {
    // EAGAIN with nothing pending; anything worse means the fd is gone.
    return []
  }
  const view = new DataView(buf.buffer)
  const out: Array<Receipt> = []
  for (let off = 0; off + RECORD_BYTES <= n; off += RECORD_BYTES) {
    out.push({
      pid: view.getInt32(off, true),
      uid: view.getUint32(off + 4, true),
      code: view.getInt32(off + 8, true),
    })
  }
  return out
}

/** The drain loop's one decision point: name every TERM; stop for the
 *  supervisor, keep serving for everyone else. */
const apply = (receipt: Receipt, libc: Libc): void => {
  const sender: Sender = { pid: receipt.pid, uid: receipt.uid, code: receipt.code }
  const verdict = judge(sender, { self: process.pid, parent: process.ppid, armedParent })
  if (verdict === "refuse") {
    process.stderr.write(journal("refused", sender))
    return
  }
  if (shuttingDown) return
  shuttingDown = true
  process.stderr.write(journal("honoring", sender))
  // Hand the signal back to whatever disposition was installed before the
  // guard — Bun's, which is what main.ts's listeners and runMain are on —
  // and re-raise. From here this is EXACTLY today's orderly shutdown: the
  // `received SIGTERM` line, runMain's interrupt, exit 130. (Restoring
  // also re-exposes the default disposition, so a TERM racing an unwedged
  // shutdown can still deliver the swift second death an operator expects
  // from a stuck stop.)
  if (oldAct !== undefined) libc.sigaction(SIGTERM, ptr(oldAct), null)
  process.kill(process.pid, "SIGTERM")
}
