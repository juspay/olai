/**
 * The set's view, kept ACROSS frames rather than built from each one.
 *
 * The tab holds one derivation of the whole directory — every index the app
 * reads is in it ({@link Derived}) — and until slice 4 of `model-indices` it
 * was thrown away and made again from scratch whenever any file spoke: a title
 * edit in one outline re-walked, re-indexed and re-resolved every record of
 * every other. This is the same answer reached the other way. The previous view
 * plus what moved gives the next one, through the format's own patcher — the
 * function the validator patches ITS view with, so the browser and the write
 * gate cannot come to disagree about what a set means
 * (`docs/brainstorming/model-indices.md`, direction C).
 *
 * WHAT MOVED IS WORKED OUT HERE, and that is the one thing this module adds.
 * The wire already sends it — the `outlines` collection is served with batched
 * `{upserts, removes}` frames — but the Solid layer that consumes them folds
 * them into a keyed store and hands a reader `{keys, byKey}`, so the frames
 * themselves reach nobody (`@kolu/surface`'s `useCollectionDeltas`). What
 * reaches a reader instead is each entry's `rev`: the SET's revision at the
 * moment that file was published, moved by the files a probe tick re-decoded
 * and left alone for every other (`@olai/surface`'s `OutlineEntry`,
 * `@olai/server`'s `published.ts`). So the delta is read back off the revisions
 * — a file whose number moved is an upsert, a key that went away is a remove —
 * which costs one number per FILE rather than a walk of every record, and says
 * exactly what the frame said. The generic fold that would hand the frames over
 * unchanged is Surface's to grow (`model-indices.md`, "what could upstream to
 * kolu"); this is what a consumer can do without it, and it is honest about
 * being a reconstruction.
 *
 * ONE PROCESS'S NUMBERS. A `rev` means something only within the server that
 * minted it, and a tab that outlived its server would be comparing two
 * processes' counters — which the wire does not let happen: the socket echoes
 * the process id it last saw, and a server that does not recognise itself
 * RETIRES the tab rather than feeding it frames (`./wire.ts`). A retired tab
 * stops updating and says so; it does not fold.
 *
 * MIXED REVISIONS, said out loud rather than inherited silently. Only the files
 * that MOVED are upserted, so an unchanged neighbour keeps the number it was
 * last published at and the view below always spans several — exactly as the
 * flatten-and-rebuild it replaces did, since that read the same entries. What
 * is new is that this module NAMES the revisions it built from, so "which
 * moment of the directory is this" is a question with an answer per file rather
 * than an assumption about all of them (the cross-file consistency paragraph in
 * `docs/brainstorming/outlines-as-collection.md`).
 */

import { byPath, derive, type Derived, type Located, patch } from "@olai/format"

/**
 * One file's slice, as this fold reads it — the wire's `OutlineEntry` narrowed
 * to the two fields that matter here.
 *
 * Structural rather than imported for the reason the patcher's own input shape
 * is ({@link @olai/format}'s `SetDelta`): what this needs is a revision and
 * some records, the wire's entry satisfies it by having both, and a benchmark
 * or a test can hand over the same two fields without minting a `broken: null`
 * to say nothing.
 */
export interface Entry {
  readonly rev: number
  readonly nodes: ReadonlyArray<Located>
}

/**
 * A view, and the frames it was built from.
 *
 * The revisions travel WITH the derivation for the reason the nodes do
 * ({@link Derived}'s own note): they are the only record of which entries this
 * view already knows about, and a pair assembled beside it by whoever holds
 * both could pair one revision's numbers with another's view.
 */
export interface View {
  readonly derived: Derived
  /** file → the revision its entry was at when this view was built. */
  readonly revs: ReadonlyMap<string, number>
}

/**
 * The next view: the held one patched with whatever moved, or a fresh
 * derivation when there is nothing to patch onto.
 *
 * `entryOf` rather than a map, because the caller is a Solid memo over a keyed
 * store and reading one key is what registers the dependency on it — handing
 * this a materialised map would mean reading every record of every file to
 * build it, which is the walk this exists to stop.
 *
 * The answer is the HELD view, by identity, when nothing moved: a frame that
 * says what the last one said leaves every memo downstream alone.
 */
export const viewOf = (
  held: View | undefined,
  files: Iterable<string>,
  entryOf: (file: string) => Entry | undefined,
): View => {
  const revs = new Map<string, number>()
  const upserts: Array<readonly [string, { readonly nodes: ReadonlyArray<Located> }]> = []
  for (const file of files) {
    const entry = entryOf(file)
    // A key the fold holds no value for yet is a file this view does not know
    // about — the same thing the flatten it replaces said with `?? []`.
    if (entry === undefined) continue
    revs.set(file, entry.rev)
    if (held?.revs.get(file) !== entry.rev) upserts.push([file, { nodes: entry.nodes }])
  }

  // NOTHING TO PATCH ONTO — the first frame of a subscription, or a manifest
  // that has just arrived. Every file is an upsert, so this is what the
  // patcher would decline at anyway, and the records go in the order a set is
  // assembled in ({@link byPath}) rather than the order the collection's keys
  // happen to arrive in: the flat list of a view IS its files read in order,
  // and a browser holding them in another one would be a different corpus.
  if (held === undefined) {
    const ordered = [...upserts].sort(([one], [other]) => byPath(one, other))
    return { derived: derive(ordered.flatMap(([, entry]) => entry.nodes)), revs }
  }

  const removes = [...held.revs.keys()].filter((file) => !revs.has(file))
  if (upserts.length === 0 && removes.length === 0) return held
  return { derived: patch(held.derived, { upserts, removes }), revs }
}
