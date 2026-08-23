/**
 * The served directory, opened — the four lines the composition root starts
 * with, and the ordering rules between them.
 *
 * `olai web` is the one transport over a directory: it resolves the path,
 * annotates it onto the log, CLAIMS the directory, and opens a store over it.
 *
 * The claim is `./lock.ts`, and this is where it goes because this is where a
 * store over somebody's vault is born: every path that opens one comes through
 * here, so "one brain per vault" is a property of this function rather than a
 * rule a composition root has to remember — including the next one, whenever a
 * second way to serve a directory arrives. It is taken BEFORE the store, which
 * is the only order that means anything: a store opened first has already
 * forked a watcher over files this process may turn out not to own.
 *
 * The ORDER of the annotation and the store is load-bearing in a different way,
 * and invisible when it is wrong:
 * `Store.make` forks the watcher and the probe loop, and a fiber inherits the
 * log annotations in force when it is forked. Annotate afterwards and every
 * line those fibers ever emit — a failed probe, three layers down, on somebody
 * else's machine — says nothing about which directory it was probing, and
 * nothing anywhere reports that it does not.
 *
 * That is not a rule a comment can hold, and it was one: both files carried a
 * note saying "before the store, so the fibers it forks inherit it", which is
 * the shape of a thing that wants to be structural instead.
 */

import { codec, type Store as OutlineStore } from "@olai/ops"
import * as Store from "@olai/store"
import { Data, Deferred, Effect, Exit, type Scope } from "effect"
import * as fs from "node:fs"
import { dirname, basename, resolve } from "node:path"

import { holdVault } from "./lock.ts"

/**
 * The directory we opened is no longer there.
 *
 * Scratch vaults the e2e suite copies into `/tmp` used to outlive the suite:
 * the harness deleted the tree and the server kept running over a path that
 * named nothing. A process whose subject has vanished has nothing to serve,
 * so this is a stop, not a retry.
 */
export class RootGone extends Data.TaggedError("RootGone")<{
  readonly root: string
}> {
  override get message(): string {
    return `the served directory is gone: ${this.root}`
  }
}

/**
 * Settle with {@link RootGone} once `root` is no longer a directory.
 *
 * The watch is on the PARENT, because a watch on `root` itself is dropped
 * when that directory is unlinked and some kernels then say nothing. A
 * 2-second poll is the backstop for an event the watch lost. Interrupted
 * with the serve, so a signal does not leave a watcher behind.
 */
export const watchRoot = (
  root: string,
): Effect.Effect<never, RootGone, Scope.Scope> =>
  Effect.gen(function*() {
    const gone = yield* Deferred.make<never, RootGone>()
    let settled = false
    const fire = (): void => {
      if (settled) return
      try {
        if (fs.statSync(root).isDirectory()) return
      } catch {
        // ENOENT, ENOTDIR, a dangling symlink: the subject is gone.
      }
      settled = true
      Deferred.doneUnsafe(gone, Exit.fail(new RootGone({ root })))
    }
    fire()
    const parent = dirname(root)
    const name = basename(root)
    let watcher: fs.FSWatcher | undefined
    try {
      watcher = fs.watch(parent, (_event, filename) => {
        if (filename === null || filename === name) fire()
      })
      watcher.on("error", () => fire())
    } catch {
      // The parent would not take a watch. The poll is then the whole of it.
    }
    const tick = setInterval(fire, 2_000)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        settled = true
        clearInterval(tick)
        watcher?.close()
      }),
    )
    return yield* Deferred.await(gone)
  })

export interface Directory {
  /** The directory, resolved. Resolved rather than as typed: it is what every
   *  path answer downstream is relative to, and what the log says we opened. */
  readonly root: string
  readonly store: OutlineStore
}

/** Open `root` as an outline store, with the log annotated for everything the
 *  store and its callers will go on to say, and the directory held against a
 *  second olai for as long as this one has it. Scoped, like the store it opens:
 *  closing the scope releases the claim, and so does the process ending by any
 *  route at all (`./lock.ts`). */
export const openDirectory = (root: string) =>
  Effect.gen(function*() {
    const resolved = resolve(root)
    yield* Effect.annotateLogsScoped({ root: resolved })
    yield* holdVault(resolved)
    const directory: Directory = {
      root: resolved,
      store: yield* Store.make({ root: resolved, codec }),
    }
    return directory
  })
