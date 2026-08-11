/**
 * One published revision, as the wire holds it.
 *
 * This is a PROJECTION and nothing more. The set is assembled and judged in
 * `@olai/format`, published by `@olai/store`, and cut into per-file slices
 * here — so the browser reads the same records the validator approved, one
 * file at a time. Nothing is decided in this file except which slice a record
 * belongs to, and the record already says (`located.file`, `document.file`).
 *
 * TWO collections come out of it, and they are the same shape: an outline file
 * is a key and a document is a key. That is what keeps a body off the first
 * frame — a reader takes the key set and asks for the one document it is
 * showing — and it is why the slicing rule below is written ONCE and applied
 * twice rather than being two loops that could come to disagree about what a
 * changed file is.
 *
 * The per-tick CHANGE is not diffed here either: the store hands over the paths
 * its probe re-decoded and the paths its listing lost ({@link Snapshot}), and
 * this maps them onto each collection's verbs — a changed path is an upsert of
 * that file's new slice, a removed one is a remove of its key.
 *
 * ONE function, and that is the point: a revision reaching the wire is one
 * thing — the entries the collections now hold, the writes that get them
 * there, and the facts that belong to no file — and a caller assembling that
 * from three exports would be a caller who could do it in the wrong order or
 * leave a piece out.
 */

import type { OutlineSet } from "@olai/format"
import type { Snapshot } from "@olai/store"
import type { DocumentEntry, Manifest, OutlineEntry } from "@olai/surface"

/** What one collection holds, keyed by root-relative path, in the set's own
 *  order (which is the listing's, which is what a sidebar shows). */
export type Entries<T> = ReadonlyMap<string, T>

/** One collection's revision: what it holds now, and what moved to get there. */
export interface Change<T> {
  /** What the collection holds now — the value a fresh subscription is
   *  snapshotted from. Built whole each revision and never mutated after. */
  readonly entries: Map<string, T>
  /** The entries whose file MOVED, and the keys whose file is gone: this
   *  revision's deltas, for the subscriptions already open. */
  readonly upserts: ReadonlyArray<readonly [string, T]>
  readonly removes: ReadonlyArray<string>
}

/** What the wire held before this revision — one map per collection, which is
 *  what the "an unchanged file keeps its entry" rule below is read against. */
export interface Held {
  readonly outlines: Entries<OutlineEntry>
  readonly documents: Entries<DocumentEntry>
}

export interface Published {
  readonly outlines: Change<OutlineEntry>
  readonly documents: Change<DocumentEntry>
  readonly manifest: Manifest
}

/**
 * One collection's slice of a revision: an entry per source, and the deltas.
 *
 * An unchanged file KEEPS THE ENTRY it was published with, rather than being
 * rebuilt at this revision. Not an optimisation — a correctness one: only the
 * changed files are upserted, so a rebuilt entry would sit in the snapshot a
 * fresh subscriber reads at a revision no delta ever announced, and two tabs
 * would hold different `rev` for the same untouched file. What a collection
 * HOLDS and what it SAID have to be the same thing.
 *
 * The store's `changed` names every path it re-decoded — outlines and
 * documents together, since it is talking about a directory — so the entries
 * are what says which of them is a key of THIS collection. A path that changed
 * and is not an entry here belongs to the other one.
 */
const changeOf = <S, T>(
  sources: ReadonlyArray<S>,
  keyOf: (source: S) => string,
  build: (source: S) => T,
  snapshot: Snapshot<OutlineSet>,
  previous: Entries<T>,
): Change<T> => {
  const changed = new Set(snapshot.changed)
  const entries = new Map<string, T>()
  for (const source of sources) {
    const key = keyOf(source)
    const published = changed.has(key) ? undefined : previous.get(key)
    entries.set(key, published ?? build(source))
  }
  return {
    entries,
    upserts: snapshot.changed.flatMap((path) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    // A collection may not be told to drop a key it never had.
    removes: snapshot.removed.filter((path) => previous.has(path)),
  }
}

/**
 * A revision, and what the wire held before it.
 *
 * Every file the set lists gets an entry, including the outlines that hold no
 * nodes and the ones that did not parse: a key that went missing would be an
 * outline the sidebar stopped showing because it broke.
 */
export const publishedOf = (
  snapshot: Snapshot<OutlineSet>,
  held: Held,
): Published => {
  const set = snapshot.value
  // The set is FLAT and every record names its own file, so a file's slice is
  // that grouping — taken in one pass rather than one filter per file, because
  // this runs on every revision of a directory that can hold any number of
  // both.
  const byFile = Map.groupBy(set.nodes, (located) => located.file)
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))

  return {
    outlines: changeOf(
      set.files,
      (file) => file,
      (file) => ({
        rev: snapshot.rev,
        nodes: byFile.get(file) ?? [],
        broken: broken.get(file) ?? null,
      }),
      snapshot,
      held.outlines,
    ),
    documents: changeOf(
      set.documents,
      (document) => document.file,
      (document) => ({ rev: snapshot.rev, text: document.text }),
      snapshot,
      held.documents,
    ),
    manifest: { rev: snapshot.rev },
  }
}
