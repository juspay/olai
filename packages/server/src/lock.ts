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
 * store over this directory. Not a person's editor, not `git pull`, not an
 * agent writing a file by hand — the store is built to converge on whatever the
 * disk says, and those are the case it handles rather than the case it cannot.
 * And not a second olai over a NETWORK filesystem from another host: `flock`
 * on darwin is local to the host, so that exclusion cannot be promised on both
 * platforms and is not claimed here.
 *
 * WHERE THE LOCK IS: `$XDG_RUNTIME_DIR/olai/<digest>.lock`, the per-user
 * runtime directory — owner-only, and cleared by the machine rather than by
 * us. NOT inside the served directory: a vault is somebody's git repository or
 * notes app, and olai does not leave files in it. A vault on a read-only mount
 * still serves.
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
 * The lock file is NEVER UNLINKED, and that is deliberate: removing a locked
 * file is the classic lockfile race — a second process opens the inode, the
 * holder unlinks it, a third creates a new file at the same path and locks
 * that, and now two processes hold "the lock". The file is a few bytes in a
 * tmpfs the machine clears at logout. Its CONTENTS are DIAGNOSIS and never
 * validity: whoever holds the lock writes their pid there so the refusal below
 * can name them, and no code path decides whether a vault is free by reading
 * it. That split is what makes a recycled pid harmless — the worst it can do is
 * put a wrong number in one sentence, never hand a second brain a vault — and
 * the number is sanity-checked before it is read out at all
 * ({@link holderIn}).
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

import { Data, Effect } from "effect"
import type { Scope } from "effect"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { dirname, join, resolve } from "node:path"

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
 * A path that does not exist has no realpath, and falls back to the resolved
 * spelling: the caller is about to fail on the missing directory anyway, and
 * this must not be what tells them so.
 */
export const lockFor = (root: string): string =>
  join(
    runtimeHome(),
    `${createHash("sha256").update(canonical(root)).digest("hex").slice(0, 16)}.lock`,
  )

/**
 * `$XDG_RUNTIME_DIR/olai`, or the fixed per-user `/tmp/olai-$UID` where there
 * is no runtime directory — the convention kolu's rendezvous sockets use, which
 * olai kept a user of until #184 and is one again here.
 *
 * NOT `os.tmpdir()`, and that is the whole reason this is not one line: it
 * honours `$TMPDIR`, which differs by LAUNCH CONTEXT — a launchd- or
 * systemd-started olai and one a person types into a terminal get different
 * ones — so the same vault would be locked at two paths and neither process
 * would see the other. `/tmp` is present and identical in every process on both
 * platforms, and `-$UID` keeps it per-user. Read at call time rather than at
 * import, so a test can point a server somewhere of its own (the same reason
 * `@olai/chat`'s state home is).
 */
const runtimeHome = (): string => {
  const xdg = process.env["XDG_RUNTIME_DIR"]
  return xdg !== undefined && xdg !== ""
    ? join(xdg, "olai")
    : `/tmp/olai-${process.getuid?.() ?? "shared"}`
}

const canonical = (root: string): string => {
  try {
    return fs.realpathSync(resolve(root))
  } catch {
    return resolve(root)
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
  try {
    const written = /^pid=(\d+)$/m.exec(fs.readFileSync(path, "utf8"))?.[1]
    if (written === undefined) return null
    const pid = Number(written)
    return alive(pid) ? pid : null
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
    return (cause as { readonly code?: unknown } | null)?.code === "EPERM"
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
  Effect.acquireRelease(
    Effect.suspend((): Effect.Effect<number, VaultInUse | LockUnavailable> => {
      const path = lockFor(root)
      const opened = openLock(path)
      if (typeof opened !== "number") return Effect.fail(opened)

      const outcome = lockExclusive(opened)
      if (outcome._tag !== "held") {
        // Read the holder BEFORE closing ours: nothing here depends on the
        // ordering, but a descriptor closed early is one more thing between the
        // question and the answer.
        const holder = outcome._tag === "busy" ? holderIn(path) : null
        fs.closeSync(opened)
        return outcome._tag === "busy"
          ? Effect.fail(new VaultInUse({ root, holder }))
          : Effect.fail(new LockUnavailable({ path, reason: outcome.reason }))
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
      return Effect.succeed(opened)
    }),
    (fd) =>
      Effect.sync(() => {
        try {
          fs.closeSync(fd)
        } catch {
          // Closing is the release, and a descriptor we cannot close is one the
          // process is about to lose anyway.
        }
      }),
  ).pipe(Effect.asVoid)

/** The lock file, opened for writing without truncating it — truncation would
 *  erase the pid of whoever is holding it, which is the one thing the file is
 *  for. Its directory is made owner-only and checked to still be ours, because
 *  off systemd it is a fixed path in `/tmp`: a directory somebody else made
 *  there first is one they could hold a lock in, and olai would report their
 *  claim as another olai of the reader's own. */
const openLock = (path: string): number | LockUnavailable => {
  const directory = dirname(path)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    const owner = fs.statSync(directory).uid
    const us = process.getuid?.()
    if (us !== undefined && owner !== us) {
      return new LockUnavailable({
        path,
        reason: `${directory} belongs to uid ${owner}, not to you`,
      })
    }
    return fs.openSync(path, fs.constants.O_RDWR | fs.constants.O_CREAT, 0o600)
  } catch (cause) {
    return new LockUnavailable({
      path,
      reason: cause instanceof Error ? cause.message : String(cause),
    })
  }
}
