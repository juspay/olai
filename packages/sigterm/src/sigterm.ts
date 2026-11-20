import { cc, dlopen, FFIType, ptr, type Pointer } from "bun:ffi"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

export const SIGTERM = 15

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const SI = { USER: 0, TKILL: -6, KERNEL: 128 } as const

export interface Sender {
  readonly pid: number
  readonly uid: number
  readonly code: number
}

export type Verdict = "honor" | "refuse"

export const judge = (
  sender: Sender,
  here: { readonly self: number; readonly parent: number; readonly armedParent: number },
): Verdict => {
  // rt_sigqueueinfo lets a sender supply any si_pid; only the kill family's
  // codes (SI_USER, SI_TKILL, SI_KERNEL) are the kernel's own to write.
  if (sender.code < 0 && sender.code !== SI.TKILL) return "refuse"
  if (sender.pid === 0) return "honor"
  if (sender.pid === here.self || sender.pid === here.parent) return "honor"
  // PR_SET_PDEATHSIG's death signal carries si_pid of the DYING parent, and
  // the reparent to init has already happened by the time it is read.
  if (sender.pid === here.armedParent && here.parent !== here.armedParent) return "honor"
  return "refuse"
}

export const who = (pid: number, self: number): string => {
  if (pid === 0) return "(the kernel)"
  if (pid === self) return "(this process)"
  try {
    const words = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean)
    return words.length === 0 ? "(empty cmdline)" : `(${words.join(" ")})`
  } catch (cause) {
    const code = (cause as { readonly code?: string }).code ?? "unknown"
    return code === "ENOENT" || code === "ESRCH"
      ? "(already gone — pid and uid above were recorded at send time)"
      : `(cmdline unreadable: ${code})`
  }
}

const journal = (word: "honoring" | "refused", sender: Sender): string =>
  `olai web: ${word} SIGTERM from pid ${sender.pid} uid ${sender.uid} ${who(sender.pid, process.pid)}\n`

/** glibc/musl's userland `struct sigaction` on 64-bit Linux: handler@0 (8),
 *  mask@8 (128 bytes), flags@136 — 152 bytes total. Built by hand because the
 *  ffi layer has no headers. */
const SA_SIZE = 152
const SA_FLAGS_OFF = 136
const SA_SIGINFO = 4
const SA_RESTART = 0x10000000

const O_NONBLOCK = 0o4000
const O_CLOEXEC = 0o2000000

const RECORD_BYTES = 12

interface Receipt {
  readonly pid: number
  readonly uid: number
  readonly code: number
}

const DRAIN_MS = 25

interface Libc {
  readonly pipe2: (fds: Pointer, flags: number) => number
  readonly sigaction: (signo: number, act: Pointer, oldAct: Pointer | null) => number
  readonly writePtr: Pointer
}

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

/** `bun:ffi`'s `cc` ends every compile with a libc link, even for a
 *  freestanding source that references nothing, and looks for `libc.so` in FHS
 *  paths NixOS does not have — so the object this process already has mapped is
 *  staged under that name for the `-L`. */
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
    try {
      fs.rmSync(staged, { recursive: true, force: true })
    } catch {
    }
  }
}

let armed = false
let oldAct: Uint8Array | undefined
let shuttingDown = false
let armedParent = -1

interface Guard {
  readonly libc: Libc
  readonly handler: Handler
  readonly readEnd: number
  readonly disarm: () => void
}

interface Handler {
  readonly addr: () => bigint | number
  readonly arm: (writeAddr: bigint, fd: number) => void
  readonly dropped: () => bigint | number
}

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

const verified = async ({ libc, readEnd }: Guard): Promise<boolean> => {
  const deadline = Date.now() + 2000
  let probePending = true
  process.kill(process.pid, "SIGTERM")
  while (Date.now() < deadline) {
    for (const receipt of drain(readEnd)) {
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

const drainForever = ({ libc, handler, readEnd, disarm }: Guard): void => {
  let droppedReported = 0
  let done = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const started = Date.now()
  const tick = (): void => {
    if (done) return
    let batch: Array<Receipt>
    try {
      batch = drain(readEnd)
    } catch (cause) {
      done = true
      process.stderr.write(
        `olai web: SIGTERM guard's refusal pipe failed (${reasonOf(cause)}) — disarming the catcher; SIGTERM keeps its default handling\n`,
      )
      disarm()
      return
    }
    for (const receipt of batch) {
      apply(receipt, libc)
      if (shuttingDown) {
        done = true
        return
      }
    }
    const dropped = Number(handler.dropped())
    if (dropped > droppedReported) {
      droppedReported = dropped
      process.stderr.write(
        `olai web: SIGTERM guard dropped ${dropped} attribution record(s) — a signal flood outran the refusal pipe; some senders went unnamed, and the dropped record can be the supervisor's stop\n`,
      )
    }
    timer = setTimeout(tick, Date.now() - started < 10_000 ? DRAIN_MS : DRAIN_MS * 5)
    timer.unref?.()
  }
  tick()
}

let installing: Promise<void> | undefined

export const installSigtermGuard = (): Promise<void> => {
  installing ??= installSigtermGuardOnce()
  return installing
}

const installSigtermGuardOnce = async (): Promise<void> => {
  if (process.platform !== "linux") return
  if (armed) return
  armedParent = process.ppid
  let guard: Guard | undefined
  try {
    guard = arm()
    if (!(await verified(guard))) {
      throw new Error("self-sent SIGTERM never came back with this process's pid/uid")
    }
    if (shuttingDown) return
    armed = true
    drainForever(guard)
    process.stderr.write(
      `olai web: SIGTERM guard armed: supervisor=${process.ppid}\n`,
    )
  } catch (cause) {
    guard?.disarm()
    process.stderr.write(
      `olai web: SIGTERM guard unavailable: ${reasonOf(cause)} — SIGTERM keeps its default handling, and any same-uid process on this machine can stop this server\n`,
    )
  }
}

const getuid = (): number => (typeof process.getuid === "function" ? process.getuid() : -1)

const drain = (fd: number): Array<Receipt> => {
  if (fd < 0) return []
  const buf = new Uint8Array(64 * RECORD_BYTES)
  let n = 0
  try {
    n = fs.readSync(fd, buf, 0, buf.length, null)
  } catch (cause) {
    if ((cause as { readonly code?: string }).code !== "EAGAIN") {
      throw cause
    }
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
  if (oldAct === undefined || libc.sigaction(SIGTERM, ptr(oldAct), null) !== 0) {
    process.stderr.write(
      "olai web: honoring SIGTERM, but restoring the pre-guard disposition failed — exiting directly rather than letting the stop be swallowed\n",
    )
    process.exit(130)
  }
  process.kill(process.pid, "SIGTERM")
}
