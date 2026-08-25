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
 *
 * ── WHAT A REVISION COSTS ──────────────────────────────────────────────
 *
 * A REVISION IS THE SIZE OF WHAT MOVED, not the size of the directory, and
 * that is the whole of `perf-published-maps`. It used to be the other way: each
 * of the three collections walked its own list of every served file and built
 * its own fresh `Map` of every entry, so one keystroke saved into one outline
 * of a two-thousand-file vault rebuilt about three maps of two thousand keys
 * — every write, every open tab, forever.
 *
 * So the map a collection holds is now MOVED from revision to revision rather
 * than rebuilt: the entries the wire already has are the very map object the
 * next revision hands out, with this revision's changed files written into it.
 * The store already says which files those are ({@link Moved}), and the set
 * already says where a path is (`@olai/format`'s `documentAt`, a binary search
 * over the order `assemble` puts the list in), so nothing here has to walk a
 * directory to find out.
 *
 * TWO CONSEQUENCES, and both are load-bearing.
 *
 * The revision handed in is CONSUMED. `publishedOf` writes into the maps of the
 * `published` argument and hands them back inside the revision it returns, so a
 * caller must not go on reading the old one — which is exactly what the one
 * caller does (`./runtime.ts` replaces `held` with what this returns, on the
 * same synchronous stack that writes the deltas, so no reader can be between
 * the two). A caller that wanted both revisions at once would have to say so,
 * and nothing does.
 *
 * MEMBERSHIP REBUILDS THE MAP; a value moving does not. A file arriving or
 * leaving is rare — it is a file being created or deleted, not a file being
 * written — so the walk is paid there and nowhere else, and it has to be paid
 * there: `Map` keeps insertion order, so writing a new path into the held map
 * would put it at the END while every other key is in the set's own path
 * order, and the order of `entries` is the order a fresh subscriber's snapshot
 * arrives in. Writing an EXISTING key leaves it exactly where it was, which is
 * why the common revision disturbs nothing.
 *
 * WHETHER MEMBERSHIP MOVED IS DERIVED AND NEVER TRUSTED, and that is not
 * belt-and-braces — the store's diff is not total about it. See `same` in
 * {@link publishedOf}, which has the whole of that argument and the failure
 * that made it necessary.
 *
 * WHAT KEEPS THE REUSED MAP FROM SWALLOWING A DELTA. A map whose identity
 * survives a revision is the one thing that can quietly go stale — a subscriber
 * folding by identity would skip an update it needed — so the rule here is that
 * an entry the wire is told about and an entry the map holds are written in the
 * SAME statement: `upserts` reads its values back out of `entries`, so there is
 * no path on which the collection holds one thing and the delta says another.
 * The claim is not left to the reading: `./published.equivalence.test.ts`
 * replays an op corpus against this projection and against the walk it replaced
 * ({@link ./published.testlib.ts}'s `publishedAsWalked`) and holds the two to
 * the same delta sequence and the same final `readAll`, and proves the harness
 * can see the hazard by injecting it.
 *
 * WHAT IT RESTS ON, said out loud because it is now load-bearing rather than
 * merely true: {@link Moved}'s `changed` names every path the probe DECODED, so
 * a file that arrived is always in it — a new path has no cached stamp and
 * cannot be skipped. `removed` is weaker and the projection does not lean on
 * it: it is the listing's diff against a stamp table a `resync` is entitled to
 * forget, so departures can go unnamed. Membership is derived from the two
 * counts instead (`same`, above), and `removed` decides only what an OPEN
 * subscriber is told, which is exactly what it decided before.
 */

import {
  bodyOf,
  type BrokenFile,
  type Document,
  documentAt,
  faceOf,
  isBodied,
  isOutline,
  type Markdown,
  nodesOf,
  type Outline,
  type OutlineSet,
  type Reading,
  textKind,
  type Unkept,
} from "@olai/format"
import type { Snapshot } from "@olai/store"
import type { DocumentEntry, Head, OutlineEntry } from "@olai/surface"

/** Which paths a revision moved — the store's own diff, and the only part of a
 *  snapshot the slicing rule below reads. Named rather than taken as the whole
 *  `Snapshot`, so the one generic thing in this file is not pinned to the
 *  app's set type to read two arrays off it.
 *
 *  IT IS THE WHOLE OF THE MEMBERSHIP CHANGE, which is the contract the reuse in
 *  this file stands on: a file the set did not hold a moment ago is in
 *  `changed`, a file it no longer holds is in `removed`, and no path is in both
 *  (`@olai/store`'s `absorb` — a file edited and then deleted is removed, one
 *  deleted and then written is changed). */
type Moved = Pick<Snapshot<unknown>, "changed" | "removed">

/** One collection's revision: what it holds now, and what moved to get there.
 *  Keyed by root-relative path, in the set's own order (which is the listing's,
 *  which is what a sidebar shows). */
export interface Change<T> {
  /** What the collection holds now — the value a fresh subscription is
   *  snapshotted from.
   *
   *  THE VERY MAP THE LAST REVISION HANDED OUT, with this revision written into
   *  it, unless a key was born (see the header). So its identity is stable
   *  across most revisions and its CONTENTS are this revision's — which is safe
   *  in exactly one arrangement and this is it: the entries and the deltas
   *  below are written in one statement each, on one synchronous stack, and the
   *  previous revision is consumed rather than kept. */
  readonly entries: Map<string, T>
  /** The entries whose file MOVED, and the keys whose file is gone: this
   *  revision's deltas, for the subscriptions already open. The values are read
   *  back out of {@link Change.entries}, never built a second time, so what the
   *  collection holds and what it said are one object. */
  readonly upserts: ReadonlyArray<readonly [string, T]>
  readonly removes: ReadonlyArray<string>
}

/**
 * ...and the one fact about a revision the WIRE has no use for: which of the
 * upserted keys this revision INTRODUCED.
 *
 * It used to be read off the previous revision's own map — "the collection did
 * not have this key before this revision" — and that is a question the map can
 * no longer be asked, because it IS this revision's map. So the slicing rule
 * answers it while it still knows, and the one reader that needs it
 * ({@link documentsOf}, deciding whether a bodyless entry may be written over a
 * key somebody is showing) takes it from here.
 */
interface Sliced<T> extends Change<T> {
  readonly born: ReadonlySet<string>
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
   * is that the bodied list is a FILTER of this one, taken through one
   * predicate in one function (`@olai/format`'s `isBodied`).
   * `./published.test.ts` asserts the containment, and that is the belt to this
   * brace.
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
  /** See {@link changeOf}'s own — one question, asked once for all three. */
  same: boolean,
): Pick<Published, "documents" | "unread"> => {
  // The BODIED half of the directory: this member is what a reader opens as a
  // page, and an outline is published as its records next door.
  const change = changeOf<Markdown | Unkept, DocumentEntry>(
    snapshot.value.set,
    isBodied,
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
    same,
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
  //
  // WHICH KEYS ARE NEW is the slice's own answer (`born`) rather than a
  // question asked of the previous revision's map, which is a map this one now
  // holds — see {@link Sliced}.
  const upserts: Array<readonly [string, DocumentEntry]> = []
  const unread: Array<string> = []
  for (const [path, entry] of change.upserts) {
    if (entry.text !== null) upserts.push([path, entry])
    else {
      if (textKind(path) !== null) unread.push(path)
      if (change.born.has(path)) upserts.push([path, entry])
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
 * SO DOES THE MAP THEY SIT IN, which is the whole of what `perf-published-maps`
 * changed here: the collection's entries are carried from one revision to the
 * next rather than rebuilt around them. The three shapes below are the three
 * things a revision can do to a collection, in the order they cost:
 *
 *   - IT MOVED NOTHING HERE — the commonest revision of all, since a probe that
 *     re-decoded one `.md` is nothing at all to the outlines. The map is handed
 *     straight on and nothing is allocated but the two empty delta lists.
 *   - IT MOVED FILES THIS COLLECTION ALREADY HELD — a save. Those keys are
 *     written into the held map, and every other key keeps both its entry and
 *     its place.
 *   - MEMBERSHIP MOVED — a file created or deleted anywhere in the directory.
 *     The map is rebuilt from the set, because `Map` appends and the ORDER of
 *     `entries` is the set's (the header has this). An unchanged file's entry is
 *     still the one it was published with; what is rebuilt is the map, not the
 *     entries in it.
 *
 * The store's `changed` names every path it re-decoded — outlines and
 * documents together, since it is talking about a directory — so the SET is
 * what says which of them is a key of THIS collection: each is looked up by
 * path and offered to this collection's own predicate. A path that changed and
 * is not this collection's belongs to the other one; a path that changed and is
 * in no set at all (a file the probe read and a later probe lost) is nobody's.
 */
const changeOf = <S extends Document, T>(
  set: OutlineSet,
  /** WHICH FILES ARE THIS COLLECTION'S, asked one file at a time — the same
   *  predicate `@olai/format`'s own list narrowings are written with, so the
   *  key set below and `bodiedIn`/`outlinesIn` cannot come to mean different
   *  files. */
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  moved: Moved,
  previous: Change<T> | undefined,
  /** Whether the directory holds the same NUMBER of files it did a revision
   *  ago — {@link publishedOf}'s one question, asked once and answered for all
   *  three collections. `false` is a membership change, whatever this
   *  collection's own `changed`/`removed` say about it. */
  same: boolean,
): Sliced<T> => {
  const held = previous?.entries
  // WHAT MOVED IN THIS COLLECTION — found in the set rather than walked to, and
  // this is the one place the size of a revision is decided: `documentAt` is a
  // binary search over the order `assemble` promises, so a probe that moved
  // four files asks four questions of a vault of any size.
  const touched: Array<readonly [string, S]> = []
  for (const path of moved.changed) {
    const document = documentAt(set, path)
    if (document !== undefined && holds(document)) touched.push([path, document])
  }
  // A collection may not be told to drop a key it never had.
  const removes = moved.removed.filter((path) => held?.has(path) === true)
  const born = new Set(
    touched.flatMap(([path]) => (held?.has(path) === true ? [] : [path])),
  )

  // MEMBERSHIP MOVED, SO THE MAP IS REBUILT; anything else moves the map it was
  // handed. `same` is the whole membership question asked outside
  // ({@link publishedOf}), and `born` is this collection's half of it: between
  // them they are exact. A key set that changed at all with the SAME number of
  // files in it has a key nobody had before, so `born` catches it; a key set
  // that changed SIZE moves the count, so `same` does. There is nothing left
  // for a delete to do here, which is why there is not one.
  const entries = held !== undefined && same && born.size === 0
    ? held
    : rebuilt(set, holds, build, new Set(touched.map(([path]) => path)), held)
  if (entries === held) for (const [path, source] of touched) entries.set(path, build(source))
  return {
    entries,
    // READ BACK OUT OF `entries`, never built a second time: the collection and
    // the delta are one object, which is what keeps a map whose identity
    // survives a revision from ever holding something the wire was not told.
    upserts: touched.flatMap(([path]) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    removes,
    born,
  }
}

/**
 * The map, built whole from the set — what a MEMBERSHIP change costs, and the
 * first revision of a store.
 *
 * It is the walk this file used to do three times per revision, kept for the
 * one thing only a walk can do: put the keys in the set's own order. An
 * unchanged file's entry comes from the held map, so what is rebuilt is the map
 * and never the entries — a rebuilt entry would carry this revision's number
 * for a file no delta named (see above).
 */
const rebuilt = <S extends Document, T>(
  set: OutlineSet,
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  /** The paths this revision re-decoded that are keys HERE — the ones whose
   *  entry may not be carried across. */
  touched: ReadonlySet<string>,
  held: ReadonlyMap<string, T> | undefined,
): Map<string, T> => {
  const entries = new Map<string, T>()
  for (const document of set.documents) {
    if (!holds(document)) continue
    const published = touched.has(document.path) ? undefined : held?.get(document.path)
    entries.set(document.path, published ?? build(document))
  }
  return entries
}

/**
 * A revision, and the revision the wire is holding — the WHOLE of the previous
 * one, not the two maps out of it that the rule below reads. A caller that
 * assembled those by hand would be a caller who could pair one collection's
 * entries with another's, which is the same "in the wrong order or with a
 * piece left out" this file exists as one function to prevent. `null` is the
 * first revision, when the wire holds nothing.
 *
 * IT IS CONSUMED, and that is the one thing a caller has to know: the maps in
 * `published` are written into and handed back inside the revision this
 * returns, so the value passed in is not a value to go on reading. The header
 * says why, and `./runtime.ts` — the one caller — replaces `held` with the
 * result on the same stack that writes the deltas.
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
  /**
   * HOW MANY FILES THE WIRE HOLDS, against how many the set lists — the one
   * question that decides whether the collections may be carried at all, asked
   * once for all three because only the HEADS hold every file and only they can
   * answer it in constant time.
   *
   * It is here because the store's diff is not total about membership and this
   * is what makes that safe. `Snapshot.removed` is the LISTING's diff, taken
   * against the stamp table the last probe left — and `resync` forgets that
   * table (`@olai/store`'s `probe.forget`, which is the door a `git checkout`
   * or a harness putting a fixture back comes through), so a file deleted
   * before one is re-listed as gone and named as removed by NOBODY. The walk
   * this replaced could not be hurt by that: it re-derived membership from the
   * set every revision, and a key nothing removed simply was not there to
   * rebuild. A projection that carries its maps can be, and was — one deleted
   * file after a resync stayed in the sidebar for the life of the process
   * (`quick_capture.feature`, "the sidebar offers no Inbox").
   *
   * So membership is DERIVED rather than trusted, in constant time: a key set
   * that changed with the same number of files in it has a key nobody had
   * before, which each collection's own `born` catches; a key set that changed
   * SIZE moves this count. Between them nothing gets through, and neither costs
   * a walk. That is `@olai/format`'s `viewOf` move exactly, one layer up — a
   * delta that does not line up with the set it is about turns into a REBUILD
   * rather than into a view holding something the set does not.
   *
   * What this does NOT do is invent a delta: a file that left unannounced is
   * dropped from what a fresh subscriber reads and is not in `removes`, because
   * `removes` is the store's own list and the walk published exactly the same
   * nothing. An open reader keeps that key until it reconnects, on this
   * projection and on the one before it alike.
   */
  const same = published !== null &&
    published.heads.entries.size === set.documents.length

  return {
    outlines: changeOf<Outline, OutlineEntry>(
      set,
      isOutline,
      (outline) => ({
        rev: snapshot.rev,
        nodes: nodesOf(derived, outline.path),
        broken: broken.get(outline.path) ?? null,
        face: faceOf(outline),
      }),
      snapshot,
      published?.outlines,
      same,
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
    heads: changeOf<Document, Head>(
      set,
      everyFile,
      (document) => ({
        rev: snapshot.rev,
        face: faceOf(document),
        broken: broken.get(document.path) ?? null,
      }),
      snapshot,
      published?.heads,
      same,
    ),
    ...documentsOf(snapshot, published, broken, same),
  }
}

/** The heads' membership, which is every served file — the one collection whose
 *  predicate narrows nothing. Spelled as a predicate anyway rather than given
 *  the whole list, so all three collections are the same statement and there is
 *  no second shape here for a reader to hold in mind. */
const everyFile = (_document: Document): _document is Document => true
