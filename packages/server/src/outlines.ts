/**
 * The loaded set, as the wire holds it: one entry per outline file, plus the
 * facts that belong to no file.
 *
 * This is a PROJECTION and nothing more. The set is assembled and judged in
 * `@olai/format`, published by `@olai/store`, and cut into per-file slices
 * here — so the browser reads the same records the validator approved, one
 * file at a time. Nothing is decided in this file except which slice a node
 * belongs to, and the node already says (`located.file`).
 *
 * The per-tick CHANGE is not diffed here either: the store hands over the paths
 * its probe re-decoded and the paths its listing lost ({@link Store.Snapshot}),
 * and this maps them onto the collection's verbs — a changed path is an upsert
 * of that file's new slice, a removed one is a remove of its key. The set as a
 * whole is right there beside them, so the only thing that could go wrong is
 * disagreeing with it, which is why {@link cut} builds both from one pass.
 */

import type { Located, OutlineSet } from "@olai/format"
import type { Snapshot } from "@olai/store"
import type { Manifest, OutlineEntry } from "@olai/surface"

/** Every outline file of one revision, keyed by root-relative path, in the
 *  set's own order (which is the listing's, which is what a sidebar shows). */
export type Entries = ReadonlyMap<string, OutlineEntry>

/** One tick's worth of collection writes: the entries whose file moved, and
 *  the keys whose file is gone. Both are named by the store's probe rather
 *  than found by comparing two maps. */
export interface Change {
  readonly upserts: ReadonlyArray<readonly [string, OutlineEntry]>
  readonly removes: ReadonlyArray<string>
}

/** The whole set as entries. Every file the set lists gets one, including the
 *  ones that hold no nodes and the ones that did not parse: a key that went
 *  missing would be an outline the sidebar stopped showing because it broke. */
export const cut = (snapshot: Snapshot<OutlineSet>): Entries => {
  const set = snapshot.value
  const byFile = new Map<string, Array<Located>>()
  for (const located of set.nodes) {
    const nodes = byFile.get(located.file)
    if (nodes === undefined) byFile.set(located.file, [located])
    else nodes.push(located)
  }
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))

  const entries = new Map<string, OutlineEntry>()
  for (const file of set.files) {
    entries.set(file, {
      rev: snapshot.rev,
      nodes: byFile.get(file) ?? [],
      broken: broken.get(file) ?? null,
    })
  }
  return entries
}

/** What to publish, given the last entries and the revision that replaced them.
 *
 *  The store's `changed` names every file it re-decoded — documents included,
 *  since it is talking about a directory and not about outlines — so the
 *  entries are what says which of them is a key of this collection. A path that
 *  changed and is not an entry is a document, and its text reaches the browser
 *  in the manifest. */
export const changeOf = (
  snapshot: Snapshot<OutlineSet>,
  next: Entries,
  previous: Entries,
): Change => ({
  upserts: snapshot.changed.flatMap((path) => {
    const entry = next.get(path)
    return entry === undefined ? [] : [[path, entry] as const]
  }),
  removes: snapshot.removed.filter((path) => previous.has(path)),
})

/** The set-wide facts of one revision. `null` is not spelled here: it is what a
 *  store with no snapshot at all publishes, and that is the store's word. */
export const manifestOf = (snapshot: Snapshot<OutlineSet>): Manifest => ({
  rev: snapshot.rev,
  documents: snapshot.value.documents,
})
