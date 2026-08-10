/**
 * The served directory, as this tab sees it.
 *
 * TWO subscriptions, and between them they are the whole read side of the app:
 * a COLLECTION of outlines keyed by root-relative path, and a `manifest` CELL
 * for what belongs to no one file. The collection is served with batched
 * `deltas`, so a probe tick that touched one file sends that file's entry and
 * not the corpus — and the key is the protocol's (`keySchema`) rather than a
 * client library's default, which is the whole point of the re-modelling
 * (`docs/brainstorming/outlines-as-collection.md`).
 *
 * THREE states a reader must tell apart, and the manifest is what says which:
 * `undefined` is "no frame yet" (the page is still reading), `null` is "there
 * has never been a valid set" (the error report IS the page), and a value is a
 * directory. An empty collection cannot carry that distinction — a directory
 * with no outlines in it is a real answer, and it looks exactly like a first
 * probe that has not finished.
 *
 * Two frames of one revision may arrive a beat apart, and nothing here pretends
 * otherwise: entries are upserted per changed file, so an unchanged neighbour
 * keeps the `rev` it was last published at, and the manifest is a member of its
 * own. What that costs a reader is spelled out in the design doc's cross-file
 * consistency paragraph; what it costs THIS module is nothing, because
 * everything below is derived from whatever the entries currently say rather
 * than from a claim about which revision they are all at.
 *
 * Nothing here writes to what the wire hands it — see App.tsx's note on
 * `reconcile` — and nothing here interprets it either: the nodes of every entry
 * go into `@olai/format`'s own derivation, the same call the validator makes.
 */

import type { BrokenFile, Derived, Document } from "@olai/format"
import { derive } from "@olai/format"
import type { Manifest } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"

import { sortByPath } from "./paths.ts"
import { olai } from "./wire.ts"

export interface Outlines {
  /** The set-wide facts: `undefined` before the first frame, `null` for a
   *  directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every outline file, in path order. */
  readonly files: Accessor<ReadonlyArray<string>>
  /** Every `.md` the directory holds, text and all — the sidebar's second list,
   *  the document pages, and every `doc` preview. */
  readonly documents: Accessor<ReadonlyArray<Document>>
  /** The same documents BY PATH — the one index everything that answers "which
   *  document is this" reads. The list above stays the list, because order is
   *  what a sidebar draws. */
  readonly documentsByFile: Accessor<ReadonlyMap<string, Document>>
  /** The files that did not parse, by path — the sidebar marks them and the
   *  main pane draws one of them instead of a tree. */
  readonly broken: Accessor<ReadonlyMap<string, BrokenFile>>
  /** One derivation over every node of every entry — the same call the
   *  validator makes. `undefined` until there is a set to derive. */
  readonly derived: Accessor<Derived | undefined>
}

export const createOutlines = (): Outlines => {
  const entries = olai.collections.outlines.use()
  const manifest = olai.cells.manifest.use()

  const files = createMemo(() => sortByPath(entries.keys()))

  /** Every node of the set: file by file, each file's nodes in file order —
   *  which is the order the flat `nodes` list had when the whole set travelled
   *  as one value, so every derivation downstream sees what it always did. */
  const nodes = createMemo(() =>
    files().flatMap((file) => entries.byKey(file)?.()?.nodes ?? [])
  )

  const documents = () => manifest.value()?.documents ?? []

  return {
    manifest: manifest.value,
    files,
    documents,
    documentsByFile: createMemo(
      () =>
        new Map<string, Document>(
          documents().map((document) => [document.file, document] as const),
        ),
    ),
    broken: createMemo(() => {
      const found = new Map<string, BrokenFile>()
      for (const file of files()) {
        const broken = entries.byKey(file)?.()?.broken
        if (broken !== undefined && broken !== null) found.set(file, broken)
      }
      return found
    }),
    // A set that has never loaded has nothing to derive FROM, and the page it
    // gets is the error report rather than an empty tree — so the `undefined`
    // here is the manifest's two absent states and not a third one.
    derived: createMemo(() => {
      const loaded = manifest.value()
      return loaded === undefined || loaded === null ? undefined : derive(nodes())
    }),
  }
}
