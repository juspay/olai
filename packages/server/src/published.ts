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
 * that file's new slice, a removed one is a remove of its key. With ONE
 * invented verb, and it is this change's: a key that LEFT in a revision the
 * store cannot name (`resync` forgets the stamp table the `removed` diff is
 * taken against) is in NO listing's `removed`, so the projection mints that
 * remove itself ({@link mintedOf}) rather than leaving every open subscriber
 * holding a file nobody has.
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
 * A COLLECTION'S OWN MEMBERSHIP REBUILDS ITS MAP; a value moving does not. A
 * file arriving or leaving is rare — it is a file being created or deleted, not
 * a file being written — so the walk is paid there and nowhere else, and it has
 * to be paid there: `Map` keeps insertion order, so writing a new path into the
 * held map would put it at the END while every other key is in the set's own
 * path order, and the order of `entries` is the order a fresh subscriber's
 * snapshot arrives in. Writing an EXISTING key leaves it exactly where it was,
 * which is why the common revision disturbs nothing.
 *
 * ITS OWN, and never the DIRECTORY'S — the correction grok's review of
 * `bcc15008` made. A revision that drops an outline and adds a `.md` moves no
 * file count at all, and the outlines still lost a key; a rule written against
 * the directory would have carried a map still holding it, with the wire told
 * to drop it and every later revision reusing the same shell. Each collection
 * asks about its own keys ({ changeOf}), and the one question none of them
 * can answer alone — a departure the store cannot NAME — is asked once as
 * `complete` in { publishedOf}, where the argument and the failure that
 * made it necessary are written down.
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
 * a file that ARRIVED is always in it — a new path has no cached stamp and
 * cannot be skipped. `removed` is weaker: it is the listing's diff against a
 * stamp table a `resync` is entitled to forget, so a DEPARTURE can go unnamed.
 * So a named departure is taken at its word (it can only be true — the store
 * does not invent one) and an unnamed one is caught by arithmetic (`complete`,
 * below) and then MINTED into the delta: `changeOf` ends every revision with
 * one delta shape — a remove is a remove whether the store named it or this
 * file had to.
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
 *  IT IS NOT THE WHOLE OF THE MEMBERSHIP CHANGE, and the reuse in this file is
 *  written against exactly how far it goes: a file the set did not hold a moment
 *  ago is always in `changed` (a new path has no stamp to be skipped by), and no
 *  path is in both lists (`@olai/store`'s `absorb` — a file edited and then
 *  deleted is removed, one deleted and then written is changed). `removed` is
 *  the weaker half: a departure a `resync` swallowed is in neither list, which
 *  is what `complete` ({@link publishedOf}) gates and {@link mintedOf} says. */
type Moved = Pick<Snapshot<unknown>, "changed" | "removed">

/** One collection's revision: what it holds now, and what moved to get there.
 *  Keyed by root-relative path, in the set's own order (which is the listing's,
 *  which is what a sidebar shows). */
export interface Change<T> {
  /** What the collection holds now — the value a fresh subscription is
   *  snapshotted from.
   *
   *  THE VERY MAP THE LAST REVISION HANDED OUT, with this revision written into
   *  it, unless this collection's own membership moved (see the header). So its identity is stable
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
   * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`: the sidebar's tree, the page
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
  /** Both {@link changeOf}'s own — the files this revision re-decoded, and
   *  whether the store's diff accounts for every one that left. */
  decoded: ReadonlyArray<Document>,
  complete: boolean,
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
    decoded,
    snapshot,
    held?.documents,
    complete,
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
 *   - MEMBERSHIP MOVED — a file of THIS collection arrived or left. The map is
 *     rebuilt from the set, because `Map` appends and the ORDER of `entries` is
 *     the set's (the header has this). An unchanged file's entry is still the
 *     one it was published with; what is rebuilt is the map, not the entries in
 *     it.
 *
 * THE THIRD IS ASKED OF THIS COLLECTION AND NEVER OF THE DIRECTORY, which is
 * the correction grok's review of `bcc15008` made and the one thing about this
 * rule that is easy to get wrong. The directory's FILE COUNT is not a
 * collection's membership: a revision that drops an outline and adds a `.md`
 * — the shape a `git pull` takes when a note is rewritten as a page — leaves
 * that count exactly where it was, births nothing in the outlines, and would
 * carry a map still holding the key the store had just named as gone. An open
 * subscriber would be told to drop it and a fresh one would go on reading it,
 * for the life of the process. So each collection asks about its OWN keys:
 * {@link Sliced.born} for what arrived, `removes` for what left, and
 * {@link mintedOf} — gated by `complete` ({@link publishedOf}) — for the
 * departures the store cannot name at all.
 *
 * The store's `changed` names every path it re-decoded — outlines and
 * documents together, since it is talking about a directory — so the SET is
 * what says which of them is a key of THIS collection: the paths are looked up
 * ONCE for all three ({@link publishedOf}'s `decoded`) and each collection
 * offers them to its own predicate. A path that changed and is not this
 * collection's belongs to the other one; a path that changed and is in no set
 * at all (a file the probe read and a later probe lost) is nobody's.
 */
const changeOf = <S extends Document, T>(
  set: OutlineSet,
  /** WHICH FILES ARE THIS COLLECTION'S, asked one file at a time — the same
   *  predicate `@olai/format`'s own list narrowings are written with, so the
   *  key set below and `bodiedIn`/`outlinesIn` cannot come to mean different
   *  files. */
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  /** The files this revision re-decoded that the set still holds, in the
   *  store's own order — looked up once and offered to all three collections
   *  ({@link publishedOf}). */
  decoded: ReadonlyArray<Document>,
  moved: Moved,
  previous: Change<T> | undefined,
  /** Whether the store's diff ACCOUNTS FOR every file that left — see
   *  `complete` in {@link publishedOf}. `false` is a departure named by nobody,
   *  which no collection can rule out for itself. */
  complete: boolean,
): Sliced<T> => {
  const held = previous?.entries
  // WHAT MOVED IN THIS COLLECTION: the revision's own re-decoded files, offered
  // to this collection's predicate. The order is the store's, which is the
  // order the deltas below go out in.
  const touched = decoded.filter(holds)
  // A collection may not be told to drop a key it never had.
  const removes = moved.removed.filter((path) => held?.has(path) === true)
  const born = new Set(
    touched.flatMap((document) => (held?.has(document.path) === true ? [] : [document.path])),
  )

  // THIS COLLECTION'S MEMBERSHIP MOVED, SO ITS MAP IS REBUILT; anything else
  // moves the map it was handed. The three clauses are the three ways a key set
  // can change and there is no fourth: a key arrived (`born` — an arrival is
  // always re-decoded, so it is always here), a key left and the store said so
  // (`removes`, already narrowed to keys this collection actually held), or a
  // key left and the store could not say so (`complete`, which no collection
  // can answer for itself — and {@link minted} below is what the answer buys).
  // Nothing is left for a delete to do on the carried arm, which is why there
  // is not one — and why the arm cannot leave a key behind.
  const entries = held !== undefined && complete && born.size === 0 && removes.length === 0
    ? held
    : rebuilt(set, holds, build, new Set(touched.map((document) => document.path)), held)
  if (entries === held) {
    for (const document of touched) entries.set(document.path, build(document))
  }
  // THE DELTA THE STORE DID NOT NAME, minted here. `complete` is false exactly
  // when a departure the store could not name just REBUILT this map around a
  // key that was on the wire — so the minted remove is read off the rebuild
  // this revision already paid for: what `held` held, the rebuilt `entries`
  // do not, and `moved.removed` never said. Before this line the key was
  // dropped from what a FRESH subscriber reads and told to NOBODY — an open
  // reader kept it until reconnect, which is how a file removed via
  // `git checkout` + `resync` went on showing in every open sidebar
  // (`https://github.com/juspay/oss.olai/blob/main/_olai/Inbox.org`'s `phantom-sidebar-key-on-unnamed-remove`).
  const minted = complete || held === undefined ? NO_MINTED : mintedOf(held, entries, moved.removed)
  return {
    entries,
    // READ BACK OUT OF `entries`, never built a second time: the collection and
    // the delta are one object, which is what keeps a map whose identity
    // survives a revision from ever holding something the wire was not told.
    upserts: touched.flatMap((document) => {
      const entry = entries.get(document.path)
      return entry === undefined ? [] : [[document.path, entry] as const]
    }),
    // THE STORE'S OWN REMOVES FIRST, the minted ones after and in the held
    // map's order: one delta shape — a subscriber cannot tell a minted remove
    // from a named one, which is the whole of what the wire promises here.
    //
    // NO KEY IS REMOVED TWICE, in either direction: a minted key is gone from
    // `entries` from this revision on, so a LATER `removed` that still names
    // it is dropped by the `held` filter above; and a NAMED key is in
    // `moved.removed`, which `mintedOf` subtracts.
    removes: minted.length === 0 ? removes : [...removes, ...minted],
    born,
  }
}

/** No collection minted anything — one shared empty list, so the common
 *  revision allocates nothing for the seam. */
const NO_MINTED: ReadonlyArray<string> = []

/**
 * THE REMOVES THE STORE DID NOT NAME: the keys a revision held that the
 * rebuilt map does not, minus the ones its `removed` DID say.
 *
 * Asked of THIS collection and answered from its own two maps — never from
 * the directory's file count, which is the shape grok's review of `bcc15008`
 * killed. It runs only where `complete` is false ({@link publishedOf} asks
 * that ONCE, of the heads, the one collection that holds every file), and on
 * that arm `entries` is a fresh walk of the set: the `moved.removed` set is
 * the only thing subtracted, so a key the store named is removed exactly
 * once and a key it could not name is removed exactly once.
 */
const mintedOf = <T>(
  held: ReadonlyMap<string, T>,
  entries: ReadonlyMap<string, T>,
  removed: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const named = new Set(removed)
  return [...held.keys()].filter((key) => !entries.has(key) && !named.has(key))
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
   * THE FILES THIS REVISION RE-DECODED, looked up ONCE for all three
   * collections — a binary search per changed path over the order `assemble`
   * promises (`@olai/format`'s `documentAt`), rather than a walk of the
   * directory and rather than the same three searches done three times.
   *
   * A changed path the set no longer holds is left out here and is nobody's: it
   * is a file a probe read and a later probe lost, and the walk this replaced
   * came to the same nothing by never finding it in a source list.
   */
  const decoded = snapshot.changed.flatMap((path) => {
    const document = documentAt(set, path)
    return document === undefined ? [] : [document]
  })
  /**
   * WHETHER THE STORE'S DIFF ACCOUNTS FOR EVERY FILE THAT LEFT — the one
   * membership question no collection can answer for itself, asked once here.
   *
   * It is here because the store's diff is NOT total about departures.
   * `Snapshot.removed` is the LISTING's diff, taken against the stamp table the
   * last probe left — and `resync` forgets that table (`@olai/store`'s
   * `probe.forget`, which is the door a `git checkout`, an rsync or a harness
   * putting a fixture back comes through), so a file deleted before one is
   * re-listed as gone and named as removed by NOBODY. The walk this replaced
   * could not be hurt by that: it re-derived membership from the set every
   * revision, and a key nothing removed simply was not there to rebuild. A
   * projection that carries its maps can be, and was — one deleted file after a
   * resync stayed in the sidebar for the life of the process
   * (`quick_capture.feature`, "the sidebar offers no Inbox").
   *
   * So it is ARITHMETIC over the heads, which are the one collection that holds
   * every served file: what the wire holds, plus the files that arrived, minus
   * the files the store NAMED as gone and the set really no longer lists,
   * against what the set now lists. They agree exactly when nothing left
   * unannounced. Constant time, no walk, and it is `@olai/format`'s `viewOf`
   * move one layer up — a delta that does not line up with the set it is about
   * turns into a REBUILD rather than into a view holding something the set does
   * not.
   *
   * WHAT IT IS NOT is a collection's membership, and conflating the two is
   * exactly the bug grok's review of `bcc15008` found: a revision that drops an
   * outline and adds a `.md` leaves this arithmetic and the file count both
   * untouched, and the outlines still lost a key. Which keys a COLLECTION lost
   * is that collection's own `removes`, and {@link changeOf} reads it there.
   *
   * And it is the GATE FOR THE MINT, no more: `false` sends {@link changeOf}
   * to {@link mintedOf}, which names the keys itself and says their removes —
   * so a file that left unannounced is dropped from what a FRESH subscriber
   * reads AND told to every open one, and the shape the walk and this
   * projection used to share with the store (the phantom key held until
   * reconnect) is over.
   */
  const files = published?.heads.entries
  const complete = files === undefined ||
    files.size +
          decoded.filter((document) => !files.has(document.path)).length -
          snapshot.removed.filter((path) =>
            files.has(path) && documentAt(set, path) === undefined
          ).length ===
      set.documents.length

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
      decoded,
      snapshot,
      published?.outlines,
      complete,
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
      decoded,
      snapshot,
      published?.heads,
      complete,
    ),
    ...documentsOf(snapshot, published, broken, decoded, complete),
  }
}

/** The heads' membership, which is every served file — the one collection whose
 *  predicate narrows nothing. Spelled as a predicate anyway rather than given
 *  the whole list, so all three collections are the same statement and there is
 *  no second shape here for a reader to hold in mind. */
const everyFile = (_document: Document): _document is Document => true
