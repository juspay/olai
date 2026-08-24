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

import {
  bodiedIn,
  bodyOf,
  type BrokenFile,
  faceOf,
  nodesOf,
  outlinesIn,
  type Reading,
  textKind,
} from "@olai/format"
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
   * EVERY served file, one revision each, its face, and whether it could be
   * read — no content of any kind (`@olai/surface`'s `Head`).
   *
   * THE DIRECTORY AS A BROWSER HOLDS IT since PR 10 of
   * `docs/brainstorming/vault-in-browser.md`: the sidebar's tree, the page
   * model's membership test and the palette's titles all come from here, where
   * the first three used to come from every record of every outline. So its
   * source list is {@link OutlineSet.documents} itself — every file the
   * directory holds, in the set's own order — rather than the bodied half.
   *
   * IT IS A SUPERSET OF {@link documents}' KEYS, and that direction is what a
   * reader relies on: a head missing for a file the directory holds is a file
   * the sidebar stops showing, and a bodied file's head is always here to open
   * its body against. It is two `changeOf` calls, because these are two
   * collections with two held revisions of their own; what holds them together
   * is that the bodied list is a FILTER of this one, taken through one `keyOf`
   * in one function. `./published.test.ts` asserts the containment, and that is
   * the belt to this brace.
   */
  readonly heads: Change<Head>
  /**
   * The paths this revision moved whose BODY the set does not keep AND WHICH
   * SOMETHING HERE CAN READ — what the body reader has to read before anyone
   * can be handed one (`./bodies.ts`).
   *
   * It is here, beside the two collections, because it is the OTHER HALF of the
   * decision below: an upsert this revision withholds from the collection is
   * exactly a body somebody else owes a reader, and the two are decided in one
   * pass so they cannot come to disagree about which those are.
   *
   * NOT EVERY WITHHELD UPSERT IS ONE, and that is the half the viewers added: a
   * picture and a `.pdf` are announced as keys and owe nobody a body, because
   * there is no text in either to hand over (`@olai/format`'s `holds`). So this
   * is a subset of the withheld upserts rather than the same list, and the pass
   * below is where the two part company.
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
 * key ACROSS the file's birth. It used to be all they saw — a body was read for
 * whoever ASKED, the ask was `readOne`, and this frame is not an ask — so such a
 * reader sat on the announcement with no body until it opened the key again.
 * That is closed now, and by the other half of the same revision: the newborn
 * path is in `unread` too, a hold is taken by the SUBSCRIPTION rather than by a
 * successful read (the collection's own `holders` dep, `./runtime.ts`), so the
 * body is read for exactly the readers holding that key and lands on the same
 * key one frame later. What is left of the edge is an ORDER rather than an
 * absence: a holder across a birth sees the announcement and then the body,
 * where a reader who opens the key afterwards sees only the body. Nobody in
 * tree is even in that position — the browser's subscription is CREATED from
 * the key set (the page model refuses a path the directory does not hold,
 * `@olai/web`'s `page.ts`), and an MCP client reads afresh on every
 * `notifications/resources/updated` — and a raw client that holds one is now
 * told the whole truth in two frames instead of half of it in one.
 *
 * WHAT IS STILL NOT DONE HERE, and deliberately: no body is READ from this
 * function, on a birth or on any other revision. A `git pull` that adds four
 * hundred saved pages announces four hundred keys and opens none of them,
 * because the read is the body reader's and its filter is who is holding what.
 * And no body is OWED for a file this process cannot read as text at all — see
 * the pass at the foot of the function.
 */
/** Whether this file's breakage is a READ that failed, not a parse. The set
 *  folds every decode Result.fail into `broken`; only `unreadable-file` is
 *  {@link DocumentEntry.refused}. A parse-broken `.md` keeps the blank body
 *  it always had, and Head.broken is still what the sidebar ⚠ hangs from. */
const isUnread = (file: BrokenFile | undefined): boolean =>
  file?.errors.some((error) => error.code === "unreadable-file") === true

const documentsOf = (
  snapshot: Snapshot<Reading>,
  held: Published | null,
  /** Why the set holds a PLACE for a file and no content — the same map
   *  the heads read for {@link Head.broken}. An outline's breakage rides
   *  {@link OutlineEntry.broken}; a document's READ failure is this
   *  entry's `refused`. A parse failure is not. */
  broken: ReadonlyMap<string, BrokenFile>,
): Pick<Published, "documents" | "unread"> => {
  // The BODIED half of the directory: this member is what a reader opens as a
  // page, and an outline is published as its records next door.
  const documents = bodiedIn(snapshot.value.set)
  const change = changeOf(
    documents,
    (document) => document.path,
    (document) => ({
      rev: snapshot.rev,
      text: bodyOf(document),
      // A kept `.md` that will not OPEN is a refusal of THIS file. A
      // `.html` is never in `broken` from the probe — its body is not
      // kept — so its refusal arrives later, from `./bodies.ts`.
      refused: isUnread(broken.get(document.path)),
    }),
    snapshot,
    held?.documents,
  )
  // One pass, two lists: what to send, and what somebody has to read. A file is
  // in exactly one of them unless it is BOTH new and bodyless, which is a key
  // announced and a body owed — see above.
  //
  // A BODY IS OWED ONLY WHERE THERE IS ONE TO READ, which is the registry's
  // `holds` column asked by name (`textKind`). A picture and a `.pdf` are
  // bodied files the set keeps nothing of, exactly like a saved page — and
  // there is no text in either for this process to hand anybody: their pages
  // fetch the bytes themselves, off the media route. Listing one here would
  // promise a body that, if a raw client ever held the key, would be read off
  // the disk and decoded as UTF-8, which is neither the file nor an error. The
  // KEY is still announced, because membership is what puts a file in the
  // sidebar.
  const upserts: Array<readonly [string, DocumentEntry]> = []
  const unread: Array<string> = []
  for (const [path, entry] of change.upserts) {
    if (entry.text !== null) upserts.push([path, entry])
    else {
      if (textKind(path) !== null) unread.push(path)
      if (held?.documents.entries.has(path) !== true) upserts.push([path, entry])
    }
  }
  return { documents: { ...change, upserts }, unread }
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
      outlinesIn(set),
      (outline) => outline.path,
      (outline) => ({
        rev: snapshot.rev,
        nodes: nodesOf(derived, outline.path),
        broken: broken.get(outline.path) ?? null,
        face: faceOf(outline),
      }),
      snapshot,
      published?.outlines,
    ),
    // THE HEAD OF EVERY FILE, withheld from nobody and cut from the SET's own
    // document list. This is what a reader watches for "the file moved" and
    // what it takes its file list from: no content of any kind, so there is
    // nothing to blank and nothing to wait for. The FACE and the BREAKAGE ride
    // here — the cheap halves of a document, cut from the same value the body
    // and the records are cut from below and above, which is what makes the
    // slices one fact rather than three: a head whose face disagreed with the
    // body beside it would be a title the palette draws for prose the page does
    // not have.
    heads: changeOf(
      set.documents,
      (document) => document.path,
      (document) => ({
        rev: snapshot.rev,
        face: faceOf(document),
        broken: broken.get(document.path) ?? null,
      }),
      snapshot,
      published?.heads,
    ),
    ...documentsOf(snapshot, published, broken),
  }
}
