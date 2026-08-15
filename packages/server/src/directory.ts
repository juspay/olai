/**
 * The served directory, opened — the three lines both composition roots start
 * with, and the one ordering rule between them.
 *
 * `olai web` and `olai mcp` are two transports over one directory, so both
 * resolve the path, annotate it onto the log, and open a store over it. The
 * ORDER of the middle two is load-bearing and invisible when it is wrong:
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

import type { OutlineError, OutlineSet } from "@olai/format"
import { codec } from "@olai/ops"
import * as Store from "@olai/store"
import { Effect } from "effect"
import { resolve } from "node:path"

export interface Directory {
  /** The directory, resolved. Resolved rather than as typed: it is what every
   *  path answer downstream is relative to, and what the log says we opened. */
  readonly root: string
  readonly store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>>
}

/** Open `root` as an outline store, with the log annotated for everything the
 *  store and its callers will go on to say. Scoped, like the store it opens. */
export const openDirectory = (root: string) =>
  Effect.gen(function*() {
    const resolved = resolve(root)
    yield* Effect.annotateLogsScoped({ root: resolved })
    const directory: Directory = {
      root: resolved,
      store: yield* Store.make({ root: resolved, codec }),
    }
    return directory
  })
