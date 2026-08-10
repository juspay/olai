/**
 * One published revision, as the wire holds it.
 *
 * This is a PROJECTION and nothing more. The set is assembled and judged in
 * `@olai/format`, published by `@olai/store`, and cut into per-file slices
 * here — so the browser reads the same records the validator approved, one
 * file at a time. Nothing is decided in this file except which slice a node
 * belongs to, and the node already says (`located.file`).
 *
 * The per-tick CHANGE is not diffed here either: the store hands over the paths
 * its probe re-decoded and the paths its listing lost ({@link Snapshot}), and
 * this maps them onto the collection's verbs — a changed path is an upsert of
 * that file's new slice, a removed one is a remove of its key.
 *
 * ONE function, and that is the point: a revision reaching the wire is one
 * thing — the entries the collection now holds, the writes that get it there,
 * and the facts that belong to no file — and a caller assembling that from
 * three exports would be a caller who could do it in the wrong order or leave
 * a piece out.
 */

import type { OutlineSet } from "@olai/format"
import type { Snapshot } from "@olai/store"
import type { Manifest, OutlineEntry } from "@olai/surface"

/** Every outline file of one revision, keyed by root-relative path, in the
 *  set's own order (which is the listing's, which is what a sidebar shows). */
export type Entries = ReadonlyMap<string, OutlineEntry>

export interface Published {
  /** What the collection holds now — the value a fresh subscription is
   *  snapshotted from. Built whole each revision and never mutated after. */
  readonly entries: Map<string, OutlineEntry>
  /** The entries whose file MOVED, and the keys whose file is gone: this
   *  revision's deltas, for the subscriptions already open. */
  readonly upserts: ReadonlyArray<readonly [string, OutlineEntry]>
  readonly removes: ReadonlyArray<string>
  readonly manifest: Manifest
}

/**
 * A revision, and what the wire held before it.
 *
 * Every file the set lists gets an entry, including the ones that hold no nodes
 * and the ones that did not parse: a key that went missing would be an outline
 * the sidebar stopped showing because it broke.
 *
 * The store's `changed` names every file it re-decoded — documents included,
 * since it is talking about a directory and not about outlines — so the entries
 * are what says which of them is a key of this collection. A path that changed
 * and is not an entry is a document, and its text reaches the browser on the
 * manifest.
 */
export const publishedOf = (
  snapshot: Snapshot<OutlineSet>,
  previous: Entries,
): Published => {
  const set = snapshot.value
  // The set is FLAT and every record names its own file, so a file's slice is
  // that grouping — taken in one pass rather than one filter per file, because
  // this runs on every revision of a directory that can hold any number of
  // both.
  const byFile = Map.groupBy(set.nodes, (located) => located.file)
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))

  // An unchanged file KEEPS THE ENTRY it was published with, rather than being
  // rebuilt at this revision. Not an optimisation — a correctness one: only the
  // changed files are upserted, so a rebuilt entry would sit in the snapshot a
  // fresh subscriber reads at a revision no delta ever announced, and two tabs
  // would hold different `rev` for the same untouched file. What the collection
  // HOLDS and what it SAID have to be the same thing.
  const changed = new Set(snapshot.changed)
  const entries = new Map<string, OutlineEntry>()
  for (const file of set.files) {
    const published = changed.has(file) ? undefined : previous.get(file)
    entries.set(
      file,
      published ?? {
        rev: snapshot.rev,
        nodes: byFile.get(file) ?? [],
        broken: broken.get(file) ?? null,
      },
    )
  }

  return {
    entries,
    upserts: snapshot.changed.flatMap((path) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    // A collection may not be told to drop a key it never had.
    removes: snapshot.removed.filter((path) => previous.has(path)),
    manifest: { documents: set.documents },
  }
}
