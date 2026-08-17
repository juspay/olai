/**
 * One published revision, as the wire holds it.
 *
 * This is a PROJECTION and nothing more. The set is assembled and judged in
 * `@olai/format`, published by `@olai/store`, and cut into per-file slices
 * here — so the browser reads the same records the validator approved, one
 * file at a time. Nothing is decided in this file except which slice a record
 * belongs to, and the record already says (`located.file`, `document.file`).
 *
 * THREE collections come out of it, and they are the same shape: an outline
 * file is a key, a document is a key, and a document's HEAD is that same key
 * with the body left off. That is what keeps a body off the first frame — a
 * reader takes the key set and asks for the one document it is showing — and
 * it is why the slicing rule below is written ONCE and applied three times
 * rather than being three loops that could come to disagree about what a
 * changed file is.
 *
 * A body the SET does not keep passes through as what the set says about it: a
 * key, and a `null` where its text would be (`@olai/format`'s `kinds.ts`). This
 * file invents nothing about that and reads nothing off a disk — the entry is
 * the set's own answer projected, as every other entry here is, and the read
 * that fills one in belongs to whoever a reader asked (`./bodies.ts`).
 *
 * The per-tick CHANGE is not diffed here either: the store hands over the paths
 * its probe re-decoded and the paths its listing lost ({@link Snapshot}), and
 * this maps them onto each collection's verbs — a changed path is an upsert of
 * that file's new slice, a removed one is a remove of its key.
 *
 * ONE function, and that is the point: a revision reaching the wire is one
 * thing — the entries both collections now hold and the writes that get them
 * there — and a caller assembling that from two exports would be a caller who
 * could do it in the wrong order or leave a piece out. What is NOT here is the
 * `manifest`: whether a directory has a set at all is a fact about the store
 * having published anything, which is answered where the snapshot is read
 * (`runtime.ts`) and needs no projection.
 */

import { nodesOf, type Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import type { DocumentEntry, Head, OutlineEntry } from "@olai/surface"

/** Which paths a revision moved — the store's own diff, and the only part of a
 *  snapshot the slicing rule below reads. Named rather than taken as the whole
 *  `Snapshot`, so the one generic thing in this file is not pinned to the
 *  app's set type to read two arrays off it. */
type Moved = Pick<Snapshot<unknown>, "changed" | "removed">

/** One collection's revision: what it holds now, and what moved to get there.
 *  Keyed by root-relative path, in the set's own order (which is the listing's,
 *  which is what a sidebar shows). */
export interface Change<T> {
  /** What the collection holds now — the value a fresh subscription is
   *  snapshotted from. Built whole each revision and never mutated after. */
  readonly entries: Map<string, T>
  /** The entries whose file MOVED, and the keys whose file is gone: this
   *  revision's deltas, for the subscriptions already open. */
  readonly upserts: ReadonlyArray<readonly [string, T]>
  readonly removes: ReadonlyArray<string>
}

export interface Published {
  readonly outlines: Change<OutlineEntry>
  readonly documents: Change<DocumentEntry>
  /**
   * The same files as {@link documents}, one revision each and no body
   * (`@olai/surface`'s `Head`).
   *
   * WHAT MAKES THAT "the same files" rather than "similar files" is worth being
   * exact about, because a reader takes its FILE LIST from the heads and a key
   * missing here is a file the sidebar stops showing. It is not one loop: it is
   * two `changeOf` calls, because these are two collections with two held
   * revisions of their own. What holds them together is that both are given the
   * same `sources` binding and the same `keyOf`, in one function, three lines
   * apart — so the way to break it is to hand one of them a different list,
   * which is a visible edit rather than a drift. `./published.test.ts` asserts
   * the equality, and that is the belt to this brace.
   */
  readonly heads: Change<Head>
  /**
   * The paths this revision moved whose BODY the set does not keep — what the
   * body reader has to read before anyone can be handed one (`./bodies.ts`).
   *
   * It is here, beside the two collections, because it is the OTHER HALF of the
   * decision below: an upsert this revision withholds from the collection is
   * exactly a body somebody else owes a reader, and the two are decided in one
   * pass so they cannot come to disagree about which those are.
   */
  readonly unread: ReadonlyArray<string>
}

/**
 * The documents half of a revision: what the two collections keyed by a bodied
 * file are told, and what is owed to the body reader.
 *
 * ONE function over ONE reading of the previous revision, and over ONE binding
 * of the source list, which is the whole reason it is not three: the slice, the
 * head and the split all need "what the wire had before this" and all three
 * must be about the same files, and callers passing those separately are
 * callers who can pass different things.
 *
 * An entry carrying its text is sent as it is. An entry saying `null` is a body
 * the set does not keep, and it is the body reader's: writing that value to a
 * key somebody is showing would blank the page and re-fill it a moment later,
 * where the reader replaces it in one frame.
 *
 * A key this revision INTRODUCES is sent anyway, `null` and all, and that is
 * not an exception but the other thing an upsert does: it is how the collection
 * learns its MEMBERSHIP changed, which is what puts a new file in the sidebar.
 * A reader cannot be SHOWING a file that did not exist a moment ago, so there
 * is nothing to blank.
 *
 * WHO CAN SEE THAT `null`, exactly: only a reader holding a `get` open on the
 * key ACROSS the file's birth — and it stays what they hold, because a body is
 * read for whoever ASKED (`./bodies.ts`, and the ask is `readOne`), and this
 * frame is not an ask. No consumer here is in that position, which is why it is
 * left alone rather than answered with a read of every new `.html` in a
 * `git pull`: the browser's subscription is CREATED from the key set — the page
 * model refuses a path the directory does not hold (`@olai/web`'s `page.ts`),
 * so the file appearing is what mounts the page that subscribes — and an MCP
 * client reads afresh on every `notifications/resources/updated` rather than
 * holding one stream open. A raw client that did hold one would see this frame
 * and no body until it opened the key again. That is a known edge, written down
 * rather than papered over.
 */
const documentsOf = (
  snapshot: Snapshot<Reading>,
  held: Published | null,
): Pick<Published, "documents" | "heads" | "unread"> => {
  const documents = snapshot.value.set.documents
  const keyOf = (document: (typeof documents)[number]) => document.file
  const change = changeOf(
    documents,
    keyOf,
    (document) => ({ rev: snapshot.rev, text: document.text }),
    snapshot,
    held?.documents,
  )
  // THE HEAD OF EVERY ONE OF THEM, withheld from nobody. This is the half a
  // reader watches for "the file moved": it carries no body, so there is
  // nothing to blank and nothing to wait for, and the arm below that keeps a
  // bodyless `null` off an open key has no counterpart here. It is also the
  // only place a `.html`'s change reaches a browser now — the body it used to
  // ride on is not asked for at all (`@olai/web`'s `documents.tsx`).
  const heads = changeOf(
    documents,
    keyOf,
    () => ({ rev: snapshot.rev }),
    snapshot,
    held?.heads,
  )
  // One pass, two lists: what to send, and what somebody has to read. A file is
  // in exactly one of them unless it is BOTH new and bodyless, which is a key
  // announced and a body owed — see above.
  const upserts: Array<readonly [string, DocumentEntry]> = []
  const unread: Array<string> = []
  for (const [path, entry] of change.upserts) {
    if (entry.text !== null) upserts.push([path, entry])
    else {
      unread.push(path)
      if (held?.documents.entries.has(path) !== true) upserts.push([path, entry])
    }
  }
  return { documents: { ...change, upserts }, heads, unread }
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
  moved: Moved,
  previous: Change<T> | undefined,
): Change<T> => {
  const held = previous?.entries
  const changed = new Set(moved.changed)
  const entries = new Map<string, T>()
  for (const source of sources) {
    const key = keyOf(source)
    const published = changed.has(key) ? undefined : held?.get(key)
    entries.set(key, published ?? build(source))
  }
  return {
    entries,
    upserts: moved.changed.flatMap((path) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    // A collection may not be told to drop a key it never had.
    removes: moved.removed.filter((path) => held?.has(path) === true),
  }
}

/**
 * A revision, and the revision the wire is holding — the WHOLE of the previous
 * one, not the two maps out of it that the rule below reads. A caller that
 * assembled those by hand would be a caller who could pair one collection's
 * entries with another's, which is the same "in the wrong order or with a
 * piece left out" this file exists as one function to prevent. `null` is the
 * first revision, when the wire holds nothing.
 *
 * Every file the set lists gets an entry, including the outlines that hold no
 * nodes and the ones that did not parse: a key that went missing would be an
 * outline the sidebar stopped showing because it broke.
 */
export const publishedOf = (
  snapshot: Snapshot<Reading>,
  published: Published | null,
): Published => {
  const { set, derived } = snapshot.value
  // The set is FLAT and every record names its own file, so a file's slice is
  // that grouping — and the grouping is READ rather than made, through the
  // format's own reader of it (`nodesOf`, over the `byFile` index the snapshot
  // now carries), so "what does this outline hold" has one spelling here and at
  // the writers. It used to be a `Map.groupBy` of every record, run on every
  // revision of a directory that can hold any number of both.
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))

  return {
    outlines: changeOf(
      set.files,
      (file) => file,
      (file) => ({
        rev: snapshot.rev,
        nodes: nodesOf(derived, file),
        broken: broken.get(file) ?? null,
      }),
      snapshot,
      published?.outlines,
    ),
    ...documentsOf(snapshot, published),
  }
}
