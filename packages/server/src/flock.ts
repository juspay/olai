/**
 * `flock(2)`, and nothing else.
 *
 * An OS ADVISORY LOCK is the whole reason this file exists rather than a
 * lockfile with a pid in it. The kernel owns the claim: it is released when the
 * descriptor closes, which happens when the process exits — cleanly, on a
 * SIGKILL, on a panic, on a laptop losing power. So there is no staleness
 * protocol, because there is no staleness: no "is that pid still alive", no
 * "was that pid recycled", no stale-lock timeout, and no leftover file that
 * makes a machine refuse to serve after a crash. Every one of those is a bug
 * somebody has shipped, and none of them is reachable from here.
 *
 * It is reached through `bun:ffi` because neither Node nor Bun exposes
 * `flock(2)` — the runtime's file system API stops at open, read, write and
 * rename, and `fs-ext`, the package that has filled that gap for a decade,
 * exists for exactly this reason. This calls the same libc function every other
 * program on the machine uses, so a lock taken here is visible to `lslocks` and
 * to anything else that flocks.
 *
 * WHAT WAS WEIGHED FIRST, because forty lines of syscall are worth writing only
 * if nothing off the shelf does the job:
 *
 *   - `proper-lockfile` — the popular answer, and the wrong one HERE. Its lock
 *     is a directory whose EXISTENCE is the claim, kept alive by an mtime
 *     heartbeat and released by a staleness timeout — so a SIGKILLed olai
 *     leaves a vault that stays locked for the stale window, and the library's
 *     own "compromised" callback exists because that heartbeat can be missed
 *     under load by a process that is perfectly alive. Its `onCompromised`, its
 *     `stale`, its `update` and its retry policy are four knobs that describe
 *     one thing this design does not have: doubt about whether the holder is
 *     still there. The kernel has no doubt.
 *   - `lockfile` (npm) and the `@zkochan` fork of proper-lockfile — the same
 *     family, the same staleness protocol, same verdict.
 *   - `fs-ext` — a real `flock` binding, and the closest fit. It is a native
 *     addon built with node-gyp: a C++ toolchain in a build that is otherwise
 *     bun and Nix, a binding compiled against Node's ABI running under Bun, and
 *     a dependency to keep pinned in `bun.nix` — all to reach a two-argument
 *     libc call that `bun:ffi` reaches with no build step at all.
 *   - `flock(1)` from util-linux — no npm dependency, but the lock would be
 *     held by a CHILD process that can outlive its parent, which turns "the
 *     kernel releases it when olai dies" back into a supervision problem. It is
 *     also Linux-only.
 *   - An abstract unix socket, Linux's other kernel-released claim: no
 *     filesystem entry and no staleness — and no macOS.
 *
 * So: no dependency, and the one thing a dependency would have had to give us
 * (a claim the kernel owns) is the thing the popular ones do not have.
 *
 * WHAT IS PLATFORM-SPECIFIC, and what CI can prove: the Linux lane exercises
 * everything here. macOS is not tested by CI (odu's rule, and this PR does not
 * change what a Mac does otherwise) — what is known is that `flock` on darwin
 * takes the same two arguments with the same two constants, and that its
 * `EWOULDBLOCK` is 35 rather than Linux's 11, which is the one difference this
 * file encodes. What darwin does DIFFERENTLY is over NFS (BSD flock is local to
 * the host, where modern Linux forwards it to the server), and that is a
 * limitation of the guarantee rather than of this code: two olai on two
 * machines over one network vault are not excluded by any flock, on either
 * platform.
 */

import { reasonOf } from "@olai/log"
import { dlopen, FFIType, type Pointer, read } from "bun:ffi"

/** `LOCK_EX | LOCK_NB` — take it exclusively, and answer now rather than wait.
 *  Waiting is the wrong verb for a boot: a person who started a second olai by
 *  mistake wants to be told, not to have their terminal hang until they find
 *  and stop the first one. Both constants are 2 and 4 on Linux and on darwin. */
const LOCK_EX = 2
const LOCK_NB = 4

/**
 * The three things that differ by platform, in one place — because they are one
 * question asked three times, and a file that answers it in three places is a
 * file where a fourth platform is added twice.
 *
 *   - WHICH LIBC, by the name the dynamic loader knows it under. The bun binary
 *     already has libc mapped — it is linked against it — so `dlopen` finds the
 *     object that is loaded rather than searching the filesystem, which is why
 *     an soname works with no path and no `LD_LIBRARY_PATH` even inside a Nix
 *     store closure. More than one spelling per platform is a LIST rather than
 *     a guess: glibc and musl are both Linux.
 *   - WHERE ERRNO IS. It is per-thread, so it is reached through a function
 *     rather than as a variable: glibc spells that `__errno_location` and
 *     darwin spells it `__error`.
 *   - WHAT "SOMEBODY ELSE HAS IT" IS. `EWOULDBLOCK` is `EAGAIN`, 11 on Linux
 *     and 35 on darwin — the one failure that is an ANSWER rather than a fault,
 *     and worth telling apart from every other errno because reporting a
 *     machine problem as another person's olai sends them hunting for a process
 *     that does not exist.
 */
const PLATFORM = process.platform === "darwin"
  ? {
    // macOS: libc, libm, libpthread and the rest are one library.
    libcs: ["libSystem.B.dylib"],
    errno: "__error",
    wouldBlock: 35,
  } as const
  : {
    // glibc, which is every platform olai is packaged for today; then musl and
    // the BSDs' unversioned spelling.
    libcs: ["libc.so.6", "libc.so"],
    errno: "__errno_location",
    wouldBlock: 11,
  } as const

interface Libc {
  readonly flock: (fd: number, operation: number) => number
  readonly errno: () => number
}

/** Resolved once, on first use — a process that serves two directories does the
 *  `dlopen` once. (The `bun:ffi` IMPORT above is static and costs its
 *  millisecond in any process that reaches `./lock.ts`; it is the library
 *  lookup that waits until something actually locks.) */
let libc: Libc | Error | null = null

const open = (): Libc | Error => {
  const tried: Array<string> = []
  for (const name of PLATFORM.libcs) {
    try {
      const library = dlopen(name, {
        flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
        [PLATFORM.errno]: { args: [], returns: FFIType.ptr },
      })
      const where = library.symbols[PLATFORM.errno] as () => Pointer
      return {
        flock: library.symbols.flock as (fd: number, operation: number) => number,
        errno: () => read.i32(where(), 0),
      }
    } catch (cause) {
      tried.push(`${name}: ${reasonOf(cause)}`)
    }
  }
  return new Error(`no libc with flock and ${PLATFORM.errno}: ${tried.join("; ")}`)
}

/** What a `flock` call answered. `held` and `busy` are the two ordinary
 *  outcomes; `failed` is the machine refusing to answer the question, which is
 *  not the same as an answer of "no". */
export type Locked =
  | { readonly _tag: "held" }
  | { readonly _tag: "busy" }
  | { readonly _tag: "failed"; readonly reason: string }

/**
 * Take an exclusive advisory lock on `fd`, or say why not.
 *
 * The caller keeps the descriptor OPEN for as long as it wants the claim:
 * closing it — deliberately, or by exiting — is what releases the lock. There
 * is deliberately no `unlock` here for the same reason there is no unlink: the
 * lifetime is the descriptor's, and a second way to end it is a second thing to
 * get wrong.
 */
export const lockExclusive = (fd: number): Locked => {
  libc ??= open()
  if (libc instanceof Error) return { _tag: "failed", reason: libc.message }
  if (libc.flock(fd, LOCK_EX | LOCK_NB) === 0) return { _tag: "held" }
  const errno = libc.errno()
  return errno === PLATFORM.wouldBlock
    ? { _tag: "busy" }
    : { _tag: "failed", reason: `flock failed with errno ${errno}` }
}
