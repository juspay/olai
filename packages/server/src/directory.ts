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

import type { KindVocabulary } from "@olai/format"
import { codecFor, type Store as OutlineStore } from "@olai/ops"
import * as Store from "@olai/store"
import { Effect } from "effect"
import { resolve } from "node:path"

import { holdVault } from "./lock.ts"
import { compileOrg2Corpus } from "./org2.ts"

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
 *  route at all (`./lock.ts`).
 *
 *  `kinds` IS WHAT THE STORE VALIDATES WITH: which property kinds the enabled
 *  plugins taught this vault's vocabulary, assembled at the composition root
 *  and handed down as data (`./propKinds.ts`). It is a parameter and not a
 *  module-level default for the reason `@olai/ops`' `codecFor` takes one — a
 *  root that forgot it would validate every vault as though this binary had
 *  never heard of a terminal, silently. */
export const openDirectory = (root: string, kinds: KindVocabulary) =>
  Effect.gen(function*() {
    const resolved = resolve(root)
    yield* Effect.annotateLogsScoped({ root: resolved })
    yield* holdVault(resolved)
    yield* Effect.sync(() => compileOrg2Corpus(resolved))
    const directory: Directory = {
      root: resolved,
      store: yield* Store.make({ root: resolved, codec: codecFor(kinds) }),
    }
    return directory
  })
