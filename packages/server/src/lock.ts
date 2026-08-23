/**
 * One brain per vault.
 *
 * A directory of outlines has exactly one olai over it, and the second one
 * refuses to boot. This file is that refusal: a kernel-held advisory lock
 * ({@link ./flock.ts}) taken at the top of every store boot
 * ({@link ./directory.ts}), and the sentence a person gets instead of a raw
 * `EWOULDBLOCK`.
 *
 * WHY, ratified 2026-08-15. Two stores over one directory have no
 * cross-process protection at all, and none of the three ways that shows up is
 * recoverable:
 *
 *   - Writes are WHOLE FILE and last-writer-wins. Each store stages its own
 *     copy of an outline and renames it over the destination; the rename is
 *     atomic, so nobody sees a torn file — and the loser's edits are gone
 *     wholesale, with both brains reporting success.
 *   - Validation is PER BRAIN. Each one validates the set it is about to write
 *     against the set it last read, so two writes that are each valid alone put
 *     duplicate ids and after-cycles on disk that neither store would have
 *     allowed. The invariant olai promises is a property of the directory, and
 *     only one process can hold it.
 *   - Commits sweep ONE git repository. Two `git add -A` and two commits
 *     against one work tree interleave into each other's staged trees.
 *
 * WHAT IS EXCLUDED, precisely: another process on THIS MACHINE that boots a
 * store over THIS DIRECTORY. Three things are outside that, and each is outside
 * it for its own reason:
 *
 *   - A person's editor, a `git pull`, an agent writing a file by hand. The
 *     store is built to converge on whatever the disk says; those are the case
 *     it handles rather than the case it cannot.
 *   - A second olai over a NETWORK filesystem from another host. `flock` on
 *     darwin is local to the host, so the exclusion cannot be promised on both
 *     platforms and is not claimed.
 *   - A NESTED VAULT: `olai web ~/notes` and `olai web ~/notes/projects` are
 *     two paths, so two digests, so two locks, and both boot — with every
 *     failure at the top of this file fully live over the subtree they share.
 *     The claim is keyed on a directory, and the thing it would have to be
 *     keyed on to catch that is a FILE SET. It is catchable — every holder
 *     writes its `root=` into the file it holds, so a boot could read the
 *     runtime directory and refuse on an ancestor or a descendant — and it is
 *     deliberately not done here: it is a second mechanism, with its own way of
 *     being wrong, and the exclusion this file promises is worth having without
 *     it. `docs/running.md` says so where a person reads.
 *
 * WHERE THE LOCK IS: `$XDG_RUNTIME_DIR/olai/<digest>.lock`, the per-user
 * runtime directory — owner-only. The machine clears it at logout; a graceful
 * stop unlinks its own file, and the next boot sweeps leftovers, because a
 * server that stays logged in never gets that logout. NOT inside the served
 * directory: a vault is somebody's git repository or notes app, and olai does
 * not leave files in it. A vault on a read-only mount still serves.
 *
 * The digest is over the REALPATH, which is the load-bearing half. A person
 * types `olai web ~/notes` in one terminal and `olai web .` from inside a
 * symlink to it in another; `resolve` answers those two differently and
 * `realpath` answers them the same, and two brains over one vault is exactly
 * what the difference would buy. That seam is the one #175 named and deferred —
 * the rendezvous socket canonicalised with `realpath` while `./directory.ts`
 * resolved — and with the socket retired (#184) this is the only
 * canonicalisation of a served root left in the process.
 *
 * The claim is the KERNEL'S flock, and a graceful stop UNLINKS the file after
 * that claim is done with it. Validity never moved into the file's existence:
 * `kill -9` still frees the vault the instant the descriptor closes, and a
 * leftover file is a leftover file, not a lock. What the unlink is for is the
 * other half of this directory — tests and short-lived serves used to leave a
 * file per vault, forever, because "the machine clears the tmpfs at logout"
 * does not run on a server that stays logged in. The race that makes unlinking
 * a HELD file two brains (open, unlink, a third creates a new inode and locks
 * that) is avoided by unlinking only in the finalizer, after we have stopped
 * serving: the process that still holds the flock is on its way out.
 *
 * A SIGKILL cannot unlink, and that is what {@link sweepRuntime} is for.
 *
 * The file's CONTENTS are DIAGNOSIS and never validity: whoever holds the lock
 * writes their pid and root there so the refusal below can name them. No code
 * path decides whether a vault is free by reading it. That split is what makes
 * a recycled pid harmless
 * — the worst it can do is put a wrong number in one sentence, never hand a
 * second brain a vault — and the number is sanity-checked before it is read
 * out at all ({@link holderIn}).
 *
 * WHY A FILE AT ALL, when `flock` would take the SERVED DIRECTORY's own
 * descriptor and need no file, no digest and no path convention — and would be
 * keyed on the inode, so even a bind mount would be one vault: because
 * `flock(2)` tells a caller `EWOULDBLOCK` and nothing else. It does not say who
 * holds the lock, and this refusal has to say it. `fcntl(F_GETLK)` does name
 * the holder, and it comes with POSIX record locking's own famous edge — the
 * lock is dropped when ANY descriptor to that file is closed anywhere in the
 * process — which is a foot-gun to leave in a long-lived server for the sake of
 * one integer. So the claim is `flock`, and the integer is a note the holder
 * writes inside the thing it holds.
 */

import { isPrivateOwnedDir } from "@kolu/surface/unix-socket"
import { codeOf, reasonOf } from "@olai/log"
import { Data, Effect } from "effect"
import type { Scope } from "effect"
import * as fs from "node:fs"
import { dirname, join } from "node:path"

import { canonical, digestOf, runtimeHome } from "@olai/state"

import { lockExclusive } from "./flock.ts"

/**
 * Another olai holds this directory.
 *
 * The ordinary answer, and the whole point of the feature — so it reads as
 * olai's own sentence rather than as a failure from a system call. The pid is
 * what a person acts on: it is what `ps` turns into "oh, the one I started this
 * morning", and what `kill` takes if it was a leftover.
 */
export class VaultInUse extends Data.TaggedError("VaultInUse")<{
  readonly root: string
  /** The holder, when it wrote itself down — see the header on why this is
   *  informational. A refusal that cannot name a pid is still a refusal. */
  readonly holder: number | null
}> {
  override get message(): string {
    return `another olai is serving this directory${
      this.holder === null ? "" : ` (pid ${this.holder})`
    } — one brain per vault`
  }
}

/**
 * The machine would not answer the question.
 *
 * A separate failure from {@link VaultInUse} because it is a different fact
 * with a different reader: not "somebody else has it" but "olai cannot find out
 * whether somebody else has it". Serving anyway would be the exact behaviour
 * this file exists to end, silently — so it refuses, and says what broke.
 */
export class LockUnavailable extends Data.TaggedError("LockUnavailable")<{
  readonly path: string
  readonly reason: string
}> {
  override get message(): string {
    return `olai cannot take the one-brain lock at ${this.path}: ${this.reason}. ` +
      "Refusing to serve rather than risk a second olai over the same files."
  }
}

/**
 * Where this directory's lock lives — computed from the directory alone, so two
 * processes that share nothing else land on the same file.
 *
 * WHERE the runtime home is, and what a served directory is called under it,
 * are `@olai/state`'s. They were spelled here first and are answered three
 * times now — this lock, the chat panel's memory, and the remembered git
 * policy — and two answers to "which file is this vault's" is exactly the
 * drift that would make one of them read somebody else's.
 */
export const lockFor = (root: string): string =>
  join(runtimeHome(), `${digestOf(canonical(root))}.lock`)

/**
 * Drop leftover files in the runtime directory.
 *
 * A `.lock` nothing holds (the kernel's flock is free) is a leftover. A
 * lock another olai is holding is left alone, even if its recorded root
 * cannot be stat'd — unlinking a held name is the two-brains race (a third
 * olai creates a new inode at that path while the holder keeps the old
 * one). Held-but-root-gone files are bounded clutter the tmpfs clears at
 * logout. Every `.sock` except `surface.sock` is a leftover of the retired
 * rendezvous sockets of #175/#184. `surface.sock` is skipped because
 * reverted #352-era binaries still hold that name; nothing on master
 * creates it.
 *
 * Hygiene, not validity: the kernel's flock is still what makes a vault free.
 * This is what stops the runtime directory growing a file per scratch vault
 * the tests ever started. Best-effort — a file we cannot unlink is left, and
 * the boot continues.
 *
 * Returns how many names it removed, so a boot can say so.
 */
export const sweepRuntime = (): number => {
  const home = runtimeHome()
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

/**
 * Drop one lock file, or leave it.
 *
 * The kernel's flock is validity, the same as everywhere else in this file.
 * If we can take it, nothing holds this vault and the file is a leftover.
 * If it is busy, another olai is in there: leave it. Unlinking a held
 * lock's name — even when the recorded root cannot be stat'd, as on a
 * bind-mounted runtime dir whose vault path the host does not see — is
 * the two-brains race: a third olai creates a new inode at that path
 * while the holder keeps the old one. A gone-root leftover that is still
 * held is clutter the tmpfs clears at logout.
 */
const sweepLock = (path: string): boolean => {
  let fd: number
  try {
    // Existing leftover, not a create: O_NOFOLLOW so a planted symlink is
    // not the file we flock, and 0o600 so the open is the same mode the
    // holder creates with (and so a world-writable `/tmp` path is not an
    // insecure temp file).
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
      // the descriptor is the claim we just used to decide; losing it now
      // costs nothing — the name is already gone.
    }
    return gone
  }
  try {
    fs.closeSync(fd)
  } catch {
    // not ours
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

/**
 * The pid a holder wrote down — DIAGNOSIS, never validity.
 *
 * Nothing here decides whether the vault is free: the kernel decided that
 * before this is called, and a `busy` answer stands whatever this file says or
 * fails to say. What it decides is only whether the refusal can NAME somebody,
 * and the sanity check is why it may: the note is written by whoever holds the
 * lock, so it is the holder's pid in every case but one — the microseconds
 * between a new holder taking the lock and writing itself down, when the
 * previous holder's number is still in the file. That number belongs to a dead
 * process, or, if the kernel has wrapped round to it, to an unrelated live one
 * — and a refusal that named it would send a person to `kill` something that is
 * not holding their notes. So a pid that names no process is not read out, and
 * the sentence simply does not name a holder.
 *
 * A recycled pid that IS alive cannot be caught here and does not need to be
 * caught anywhere: it costs a wrong number in one sentence during a window
 * microseconds wide, and it can never cost a vault, because nothing about the
 * refusal itself was ever decided by reading this.
 */
const holderIn = (path: string): number | null => {
  const pid = noteIn(path)
  return pid !== null && alive(pid) ? pid : null
}

/** The pid a holder wrote down. Diagnosis, never validity — see {@link holderIn}. */
const noteIn = (path: string): number | null => {
  try {
    const pid = /^pid=(\d+)$/m.exec(fs.readFileSync(path, "utf8"))?.[1]
    return pid === undefined ? null : Number(pid)
  } catch {
    return null
  }
}

/** Signal 0 is the "does this process exist" syscall spelled as a kill.
 *  `EPERM` is a yes — it exists and belongs to somebody else, which on a
 *  per-user runtime directory means the pid has been recycled to another
 *  user's process; anything else (`ESRCH`) is a no. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return codeOf(cause) === "EPERM"
  }
}

/**
 * Hold `root` for as long as the scope is open.
 *
 * The descriptor IS the claim, so it is kept open and closed by the scope's
 * finalizer — a graceful shutdown releases the directory before the process
 * exits, and every other way of stopping leaves it to the kernel, which is the
 * same release by a different route.
 */
export const holdVault = (
  root: string,
): Effect.Effect<void, VaultInUse | LockUnavailable, Scope.Scope> =>
  Effect.gen(function*() {
    const swept = sweepRuntime()
    if (swept > 0) {
      yield* Effect.annotateLogs(Effect.logInfo("swept leftover runtime files"), {
        count: swept,
      })
    }
    yield* Effect.acquireRelease(
      Effect.suspend((): Effect.Effect<Held, VaultInUse | LockUnavailable> => {
        const path = lockFor(root)
        const opened = openLock(path)
        if (typeof opened !== "number") return Effect.fail(opened)

        // Our descriptor goes with any answer but `held`: we are not serving this
        // directory, so we hold nothing open over it.
        const refuse = (failure: VaultInUse | LockUnavailable) => {
          fs.closeSync(opened)
          return Effect.fail(failure)
        }
        const outcome = lockExclusive(opened)
        if (outcome._tag === "busy") {
          return refuse(new VaultInUse({ root, holder: holderIn(path) }))
        }
        if (outcome._tag === "failed") {
          return refuse(new LockUnavailable({ path, reason: outcome.reason }))
        }

        // Ours now, so say who we are — for the next olai's refusal, and for a
        // person reading the runtime directory with `cat`. Truncated first: the
        // file may carry a dead holder's pid, and it is only ever written by
        // whoever holds the lock.
        try {
          fs.ftruncateSync(opened, 0)
          fs.writeSync(opened, `pid=${process.pid}\nroot=${canonical(root)}\n`, 0)
        } catch {
          // The claim is the lock, not the note. A runtime directory that will
          // not take these few bytes costs the NEXT olai a pid in its refusal and
          // costs this one nothing, so it is not worth refusing to serve over.
        }
        return Effect.succeed({ fd: opened, path })
      }),
      (held) =>
        Effect.sync(() => {
          // Unlink WHILE the flock still names this inode, then close. Closing
          // first would let a second olai lock the same file, after which the
          // unlink would strand that holder on an unlinked inode and a third
          // olai would create a new one — two brains. Unlinking a file we have
          // already stopped serving is the leftover we will not leave behind.
          unlinkQuiet(held.path)
          try {
            fs.closeSync(held.fd)
          } catch {
            // Closing is the release, and a descriptor we cannot close is one the
            // process is about to lose anyway.
          }
        }),
    )
  })

interface Held {
  readonly fd: number
  readonly path: string
}

/** The lock file, opened for writing without truncating it — truncation would
 *  erase the pid of whoever is holding it, which is the one thing the file is
 *  for. */
const openLock = (path: string): number | LockUnavailable => {
  const directory = dirname(path)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    // mkdirSync's mode applies only when the directory is CREATED. A
    // pre-existing `/tmp/olai-$UID` is exactly the case it cannot speak for,
    // so we ask the same predicate the unix-socket serve path uses. A failed
    // lstat throws into this try and becomes LockUnavailable via reasonOf —
    // the same fold mkdir and open already take. A false is "the directory
    // exists and is not ours."
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
