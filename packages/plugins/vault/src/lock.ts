import { isPrivateOwnedDir } from "@kolu/surface/unix-socket"
import { codeOf, reasonOf } from "@olai/log"
import { Data, Effect } from "effect"
import type { Scope } from "effect"
import * as fs from "node:fs"
import { dirname, join } from "node:path"

import type { RuntimePaths } from "@olai/ops"

import { lockExclusive } from "./flock.ts"

export class VaultInUse extends Data.TaggedError("VaultInUse")<{
  readonly root: string
  readonly holder: number | null
}> {
  override get message(): string {
    return `another olai is serving this directory${
      this.holder === null ? "" : ` (pid ${this.holder})`
    } — one brain per vault`
  }
}

export class LockUnavailable extends Data.TaggedError("LockUnavailable")<{
  readonly path: string
  readonly reason: string
}> {
  override get message(): string {
    return `olai cannot take the one-brain lock at ${this.path}: ${this.reason}. ` +
      "Refusing to serve rather than risk a second olai over the same files."
  }
}

export const lockFor = (root: string, paths: RuntimePaths): string =>
  join(paths.home(), `${paths.digest(paths.canonical(root))}.lock`)

export const sweepRuntime = (paths: RuntimePaths): number => {
  const home = paths.home()
  let entries: ReadonlyArray<fs.Dirent>
  try {
    if (!isPrivateOwnedDir(home)) return 0
    entries = fs.readdirSync(home, { withFileTypes: true })
  } catch {
    return 0
  }
  let swept = 0
  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue
    const full = join(home, entry.name)
    if (entry.name.endsWith(".sock")) {
      if (entry.name === "surface.sock") continue
      if (unlinkQuiet(full)) swept += 1
      continue
    }
    if (!entry.name.endsWith(".lock")) continue
    if (sweepLock(full)) swept += 1
  }
  return swept
}

const sweepLock = (path: string): boolean => {
  let fd: number
  try {
    fd = fs.openSync(
      path,
      fs.constants.O_RDWR | fs.constants.O_NOFOLLOW,
      0o600,
    )
  } catch {
    return false
  }
  const outcome = lockExclusive(fd)
  if (outcome._tag === "held") {
    const gone = unlinkQuiet(path)
    try {
      fs.closeSync(fd)
    } catch {
    }
    return gone
  }
  try {
    fs.closeSync(fd)
  } catch {
  }
  return false
}

const unlinkQuiet = (path: string): boolean => {
  try {
    fs.unlinkSync(path)
    return true
  } catch {
    return false
  }
}

const diagnosticPidIn = (path: string): number | null => {
  try {
    const written = /^pid=(\d+)$/m.exec(fs.readFileSync(path, "utf8"))?.[1]
    if (written === undefined) return null
    const pid = Number(written)
    return alive(pid) ? pid : null
  } catch {
    return null
  }
}

/** Signal 0 is the "does this process exist" syscall spelled as a kill, and
 *  `EPERM` is a yes: the process is there and belongs to somebody else. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return codeOf(cause) === "EPERM"
  }
}

export const holdVault = (
  root: string,
  paths: RuntimePaths,
): Effect.Effect<void, VaultInUse | LockUnavailable, Scope.Scope> =>
  Effect.gen(function*() {
    const swept = sweepRuntime(paths)
    if (swept > 0) {
      yield* Effect.annotateLogs(Effect.logInfo("swept leftover runtime files"), {
        count: swept,
      })
    }
    yield* Effect.acquireRelease(
      Effect.suspend((): Effect.Effect<Held, VaultInUse | LockUnavailable> => {
        const path = lockFor(root, paths)
        const opened = openLock(path)
        if (typeof opened !== "number") return Effect.fail(opened)

        const refuse = (failure: VaultInUse | LockUnavailable) => {
          fs.closeSync(opened)
          return Effect.fail(failure)
        }
        const outcome = lockExclusive(opened)
        if (outcome._tag === "busy") {
          return refuse(new VaultInUse({ root, holder: diagnosticPidIn(path) }))
        }
        if (outcome._tag === "failed") {
          return refuse(new LockUnavailable({ path, reason: outcome.reason }))
        }

        try {
          fs.ftruncateSync(opened, 0)
          fs.writeSync(opened, `pid=${process.pid}\nroot=${paths.canonical(root)}\n`, 0)
        } catch {
        }
        return Effect.succeed({ fd: opened, path })
      }),
      (held) =>
        Effect.sync(() => {
          unlinkQuiet(held.path)
          try {
            fs.closeSync(held.fd)
          } catch {
          }
        }),
    )
  })

interface Held {
  readonly fd: number
  readonly path: string
}

const openLock = (path: string): number | LockUnavailable => {
  const directory = dirname(path)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    // `mkdirSync`'s mode applies only when the directory is CREATED, so a
    // pre-existing one needs its own ownership check.
    if (!isPrivateOwnedDir(directory)) {
      return new LockUnavailable({
        path,
        reason: `${directory} is not a private owner-only directory`,
      })
    }
    return fs.openSync(path, fs.constants.O_RDWR | fs.constants.O_CREAT, 0o600)
  } catch (cause) {
    return new LockUnavailable({ path, reason: reasonOf(cause) })
  }
}
