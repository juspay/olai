import { reasonOf } from "@olai/log"
import { dlopen, FFIType, type Pointer, read } from "bun:ffi"

/** `LOCK_EX | LOCK_NB` — take it exclusively, and answer now rather than wait.
 *  Both constants are 2 and 4 on Linux and on darwin. */
const LOCK_EX = 2
const LOCK_NB = 4

/**
 * The three things that differ by platform:
 *
 *   - WHICH LIBC, by the soname the dynamic loader knows it under. The bun
 *     binary is linked against libc, so `dlopen` finds the object already
 *     mapped rather than searching the filesystem — an soname works with no
 *     path and no `LD_LIBRARY_PATH`, even inside a Nix store closure.
 *   - WHERE ERRNO IS. It is per-thread, so it is reached through a function:
 *     glibc spells that `__errno_location`, darwin `__error`.
 *   - WHAT "SOMEBODY ELSE HAS IT" IS. `EWOULDBLOCK` is `EAGAIN`, 11 on Linux
 *     and 35 on darwin.
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

export type Locked =
  | { readonly _tag: "held" }
  | { readonly _tag: "busy" }
  | { readonly _tag: "failed"; readonly reason: string }

export const lockExclusive = (fd: number): Locked => {
  libc ??= open()
  if (libc instanceof Error) return { _tag: "failed", reason: libc.message }

  let errno = 0
  for (let attempt = 0; attempt < EINTR_ATTEMPTS; attempt++) {
    if (libc.flock(fd, LOCK_EX | LOCK_NB) === 0) return { _tag: "held" }
    errno = libc.errno()
    if (errno === PLATFORM.wouldBlock) return { _tag: "busy" }
    if (errno !== EINTR) break
  }
  return {
    _tag: "failed",
    reason: errno === EINTR
      ? `flock was interrupted ${EINTR_ATTEMPTS} times running (errno ${EINTR})`
      : `flock failed with errno ${errno}`,
  }
}

/** 4 on every platform this runs on, and one of the few errnos POSIX fixes. */
const EINTR = 4

const EINTR_ATTEMPTS = 5
