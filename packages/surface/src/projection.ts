/**
 * ONE COLLECTION'S published revision, as the wire holds it — the rule, and not
 * any row's use of it.
 *
 * This is a PROJECTION and nothing more. The set is assembled and judged in
 * `@olai/format`, published by `@olai/store`, and cut into per-file slices
 * here — so the browser reads the same records the validator approved, one
 * file at a time. Nothing is decided in this file except which slice a record
 * belongs to, and the record already says (`located.file`, `document.file`).
 *
 * IT NAMES NO COLLECTION, and that is what changed. This module used to hold a
 * `publishedOf` that built `outlines`, `documents` and `heads` in one pass and
 * a `Published` shape that was the three of them together — the monolith's
 * projection, in a general package, for members that are now three separate
 * rows' (`olai-plugin-outlines`, `olai-plugin-markdown`, `olai-plugin-vault`).
 * Each row builds its own member from its own entry schema now, out of the two
 * exports below: {@link frame} reads what a revision moved, {@link changeOf}
 * turns that into one collection's entries and deltas. What is left here is the
 * part that was never about any of them — an outline file is a key, a document
 * is a key, and a document's HEAD is that same key with the body left off, and
 * the slicing rule is the same statement for all three. Written once and called
 * three times by three owners rather than three loops that could come to
 * disagree about what a changed file is.
 *
 * A body the SET does not keep passes through as what the set says about it: a
 * key, and a `null` where its text would be (`@olai/format`'s `kinds.ts`). This
 * file invents nothing about that and reads nothing off a disk — the entry is
 * the set's own answer projected, as every other entry here is, and the read
 * that fills one in belongs to whoever a reader asked (`olai-plugin-markdown`'s
 * `server/bodies.ts`).
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
 * TWO functions and not one, which is the shape a row-owned member forces and
 * the one deliberate cost of the split. `frame` is the reading of the revision
 * every collection needs and none of them owns — which paths were re-decoded,
 * whether the store's diff accounts for every departure, the census the next
 * revision compares against, the broken table — and `changeOf` is the slice.
 * Three rows each call both, so the reading is done three times per revision
 * where the monolith did it once. What that buys is that a row that is not
 * running does no work at all and declares nothing: the walk is proportional to
 * the collections somebody actually stood up, and `frame` is arithmetic over
 * two arrays the store already handed over rather than a walk of the directory.
 * What it costs is that the three READINGS must agree, and they do because they
 * are one function over one snapshot. What is NOT here is the `manifest`:
 * whether a directory has a set at all is a fact about the store having
 * published anything, which is answered where the snapshot is read and needs no
 * projection.
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
 * The revision handed in is CONSUMED. {@link changeOf} writes into the maps of
 * the `previous` slice and hands them back inside the one it returns, so a
 * caller must not go on reading the old one — which is exactly what each row's
 * server half does (it replaces its `held` projection with what this returns,
 * on the same synchronous stack that writes the deltas, so no reader can be
 * between the two). A caller that wanted both revisions at once would have to
 * say so, and nothing does.
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
 * asks about its own keys ({@link changeOf}), and the one question none of them
 * can answer alone — a departure the store cannot NAME — is asked as `complete`
 * in {@link frame}, where the argument and the failure that made it necessary
 * are written down.
 *
 * WHAT KEEPS THE REUSED MAP FROM SWALLOWING A DELTA. A map whose identity
 * survives a revision is the one thing that can quietly go stale — a subscriber
 * folding by identity would skip an update it needed — so the rule here is that
 * an entry the wire is told about and an entry the map holds are written in the
 * SAME statement: `upserts` reads its values back out of `entries`, so there is
 * no path on which the collection holds one thing and the delta says another.
 * The claim is not left to the reading: `@olai/bundle`'s
 * `published.equivalence.test.ts` replays an op corpus against the three rows'
 * projections and against the walk they replaced (`published.testlib.ts`'s
 * `publishedAsWalked`) and holds the two to the same delta sequence and the
 * same final `readAll`, and proves the harness can see the hazard by injecting
 * it. It lives in the registry rather than beside this file because a claim
 * about three rows at once is a claim only the package that has all three can
 * make.
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
  type BrokenFile,
  type Document,
  documentAt,
  type OutlineSet,
  type Reading,
} from "@olai/format"
import type { Snapshot } from "@olai/store"

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
 *  is what `complete` ({@link frame}) gates and {@link mintedOf} says. */
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
 * (`olai-plugin-markdown`'s `documentsOf`, deciding whether a bodyless entry
 * may be written over a key somebody is showing) takes it from here.
 */
export interface Sliced<T> extends Change<T> {
  readonly born: ReadonlySet<string>
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
 * {@link mintedOf} — gated by `complete` ({@link frame}) — for the
 * departures the store cannot name at all.
 *
 * The store's `changed` names every path it re-decoded — outlines and
 * documents together, since it is talking about a directory — so the SET is
 * what says which of them is a key of THIS collection: the paths are looked up
 * ONCE per collection ({@link frame}'s `decoded`) and each of them
 * offers them to its own predicate. A path that changed and is not this
 * collection's belongs to the other one; a path that changed and is in no set
 * at all (a file the probe read and a later probe lost) is nobody's.
 */
export const changeOf = <S extends Document, T>(
  set: OutlineSet,
  /** WHICH FILES ARE THIS COLLECTION'S, asked one file at a time — the same
   *  predicate `@olai/format`'s own list narrowings are written with, so the
   *  key set below and `bodiedIn`/`outlinesIn` cannot come to mean different
   *  files. */
  holds: (document: Document) => document is S,
  build: (source: S) => T,
  /** The files this revision re-decoded that the set still holds, in the
   *  store's own order — {@link frame} looks them up, and the row offers them
   *  to its own predicate. */
  decoded: ReadonlyArray<Document>,
  moved: Moved,
  previous: Change<T> | undefined,
  /** Whether the store's diff ACCOUNTS FOR every file that left — see
   *  `complete` in {@link frame}. `false` is a departure named by nobody,
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
  // (`https://github.com/juspay/oss.olai/blob/main/_olai/Inbox.olai`'s `phantom-sidebar-key-on-unnamed-remove`).
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
 * killed. It runs only where `complete` is false ({@link frame} asks
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
 * WHAT ONE ROW CARRIES BETWEEN REVISIONS: its own entries and deltas, and the
 * file-name census that is the only thing it holds about files that are not
 * its own.
 *
 * The census is here and not derivable, and that is the whole reason this type
 * exists rather than a bare {@link Change}. `complete` — whether the store's
 * diff accounts for every file that left — is arithmetic against the number of
 * files the collection was looking at LAST revision, and a row that kept only
 * its own keys could not ask it: `heads` holds every file, `outlines` holds the
 * `.olai` ones, and a `.md` deleted in a revision a `resync` swallowed moves
 * neither of the outlines' counts while still being a departure nobody named.
 * So each row keeps the directory's own path set, shared by identity across
 * every revision that did not move it ({@link frame} returns `previous`
 * unchanged when nothing was born and nothing went), which is a set of strings
 * per row rather than a fourth copy of anybody's entries.
 *
 * IT RETAINS NOTHING OF ANOTHER ROW: no bodies, no records, no entries. A row
 * that is disabled drops its whole projection and the census with it, and the
 * rows beside it do not notice — which is what makes a content row absent
 * rather than merely quiet.
 */
export interface Projection<T> {
  readonly files: ReadonlySet<string>
  readonly change: Change<T>
}

/**
 * The reading of ONE revision that every collection needs and none of them
 * owns — done per row, over the snapshot the store just published.
 *
 * Four answers, and each is used by {@link changeOf} rather than by the caller:
 * `decoded` is the files this revision re-decoded that the set still holds, in
 * the store's own order; `complete` is whether the store's `removed` accounts
 * for every departure (see the header's closing paragraph, and {@link
 * mintedOf} for what a `false` costs); `files` is the census to carry into the
 * next revision; `broken` is the decode-failure table, keyed by path, that
 * `heads` reads for `olai-plugin-vault`'s `Head.broken` and `documents` reads
 * for `olai-plugin-markdown`'s `DocumentEntry.refused`.
 *
 * THE CENSUS IS RETURNED BY IDENTITY when nothing was born and nothing went,
 * which is what keeps a row's {@link Projection} from allocating a set of every
 * path on every keystroke. A revision that MOVED the membership rebuilds it,
 * for the reason the entry maps are rebuilt there and nowhere else.
 *
 * `broken` IS REBUILT EVERY REVISION and deliberately: it is the set's own
 * short list of files that would not decode, which is empty in a healthy
 * directory and never the size of the corpus.
 */
export const frame = (snapshot: Snapshot<Reading>, previous?: ReadonlySet<string>) => {
  const decoded = snapshot.changed.flatMap(path => {
    const document = documentAt(snapshot.value.set, path)
    return document ? [document] : []
  })
  const born = decoded.filter(document => !previous?.has(document.path))
  const gone = snapshot.removed.filter(path => previous?.has(path) && !documentAt(snapshot.value.set, path))
  const complete = previous === undefined || previous.size + born.length - gone.length === snapshot.value.set.documents.length
  const files = previous && complete && born.length === 0 && gone.length === 0 ? previous
    : new Set(snapshot.value.set.documents.map(document => document.path))
  return { decoded, complete, files, broken: new Map(snapshot.value.set.broken.map(file => [file.file, file])) }
}
