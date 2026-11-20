import type { Document, Reading, Verdict } from "@olai/format"
import { type Directory, type RuntimePaths } from "@olai/ops"
import * as Store from "@olai/store"
import { Effect } from "effect"
import { stat } from "node:fs/promises"
import { resolve } from "node:path"

import { holdVault } from "./lock.ts"

export type { Directory } from "@olai/ops"

/** The claim is taken BEFORE the store, which is the only order that means
 *  anything: a store opened first has already forked a watcher over files this
 *  process may turn out not to own. The ORDER of the annotation and the store
 *  is load-bearing in a different way: `Store.make` forks the watcher and the
 *  probe loop, and a fiber inherits the log annotations in force when it is
 *  forked. */
export const openDirectory = (root: string, codec: Store.Codec<Document, Reading, Verdict>, paths: RuntimePaths) =>
  Effect.gen(function*() {
    const resolved = resolve(root)
    const isDirectory = yield* Effect.tryPromise({
      try: async () => (await stat(resolved)).isDirectory(),
      catch: (cause) => new Error(`cannot open vault ${resolved}: ${String(cause)}`),
    })
    if (!isDirectory) return yield* Effect.die(new Error(`${resolved} is not a directory`))
    yield* Effect.annotateLogsScoped({ root: resolved })
    yield* holdVault(resolved, paths)
    const directory: Directory = {
      root: resolved,
      store: yield* Store.make({ root: resolved, codec }),
    }
    return directory
  })
