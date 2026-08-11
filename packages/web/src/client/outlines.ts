/**
 * The served directory, as this tab sees it.
 *
 * THREE subscriptions, and between them they are the whole read side of the
 * app: a COLLECTION of outlines keyed by root-relative path, the KEY SET of the
 * documents collection beside it, and a `manifest` CELL for what belongs to no
 * one file. The outlines are served with batched `deltas`, so a probe tick that
 * touched one file sends that file's entry and not the corpus — and the key is
 * the protocol's (`keySchema`) rather than a client library's default, which is
 * the whole point of the re-modelling
 * (`docs/brainstorming/outlines-as-collection.md`).
 *
 * The documents are the OPPOSITE case, and this module takes only half of them:
 * their key set. A `.md` is drawn in exactly two places — as a path in the
 * sidebar's file tree, and as a body on the one document a reader has open —
 * and the first of those is every document in the directory while the second is
 * one. So the paths arrive here, and a body is asked for by whoever is showing
 * it (`./document/documents.tsx`). What that replaced was the manifest carrying
 * every document's full text in the first frame: ~124 KB of a ~212 KB snapshot
 * for this project's own `docs/`, and O(corpus) for a directory of thousands.
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

import type { BrokenFile, Derived } from "@olai/format"
import { derive } from "@olai/format"
import type { Manifest } from "@olai/surface"
import { type Accessor, createMemo, createSignal } from "solid-js"

import { sortByPath } from "./paths.ts"
import { olai } from "./wire.ts"

export interface Outlines {
  /** The set-wide facts: `undefined` before the first frame, `null` for a
   *  directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every outline file, in path order. */
  readonly files: Accessor<ReadonlyArray<string>>
  /** Every `.md` the directory holds, by path and in path order — the sidebar's
   *  file tree mixes them with the outlines under the folders they live in, and
   *  an address that names one is answered against this list. The TEXT is not
   *  here: it travels per document, to whoever opens one. */
  readonly documents: Accessor<ReadonlyArray<string>>
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

  /**
   * The documents' KEY SET, and only it.
   *
   * `.use()` on this collection would open the keys stream AND a value stream
   * per key — every body in the directory, which is the thing the collection
   * exists to stop sending. So the keys ref is driven on its own, through
   * `rawStream`: the framework's own composition for exactly this (its
   * `unenrolledKeys` docs describe feeding the raw list back as a narrowed
   * `.use({ keys })`, which is what `./document/documents.tsx` then does with
   * the one document a reader has open), and `rawStream` rather than a bare
   * `unenrolledStreamCall` so the stream is still IN `client.health()` — a
   * keys stream that dies would otherwise read as a directory with no
   * documents in it.
   *
   * No `onRetry`: every frame is the whole key set, so a reconnect replaces
   * this list wholesale, and clearing it in the gap would empty the sidebar's
   * documents for as long as the socket takes to come back.
   */
  const [documents, setDocuments] = createSignal<ReadonlyArray<string>>([])
  olai.rawStream(
    "documents.keys",
    olai.collections.documents.unenrolledKeys,
    undefined,
    { onItem: (keys) => setDocuments(sortByPath(keys)) },
  )

  const files = createMemo(() => sortByPath(entries.keys()))

  /** Every node of the set: file by file, each file's nodes in file order —
   *  which is the order the flat `nodes` list had when the whole set travelled
   *  as one value, so every derivation downstream sees what it always did. */
  const nodes = createMemo(() =>
    files().flatMap((file) => entries.byKey(file)?.()?.nodes ?? [])
  )

  return {
    manifest: manifest.value,
    files,
    documents,
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
