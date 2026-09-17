/**
 * WHICH DOCUMENTS POINT WHERE — every source's forward references, filed
 * backwards and kept that way.
 *
 * A note link, a `see`, a link in a note, a link in a body and an `@id`
 * written in prose all point ONE WAY on disk. "What is talking about this
 * node?" and "what is talking about this document?" are that reading run
 * backwards, and until this module they were WALKS: {@link ./backlinks.ts}'s
 * two readers tested every link of every face in the directory, per revision,
 * per tab sitting on any page with a body. The node-to-node direction next
 * door has had its reverse indexes since `model-indices`
 * ({@link Derived.namedBy}, {@link Derived.taggedBy}); this is the one
 * direction that did not, and the roadmap node is `perf-doc-backlinks-index`.
 *
 * ## What it is keyed by
 *
 * THE ADDRESS, WRITTEN — {@link printAddress}, which is the canonical spelling
 * the grammar promises, so two addresses that name one place print one string
 * and nothing here has to know how the arms are shaped. The MENTION lands on a
 * key by the same rule ({@link ./imports.ts} files an `@id` under the tag
 * `@id`, which is the very word the address's id half is made of, prefixed
 * with the sigil that says it was spoken rather than linked). Two namespaces,
 * one index, ways kept apart.
 *
 * IT IS INJECTIVE over the arms, which is what lets them share a map: a path
 * prints its segments percent-encoded, so a file literally called `#notes.md`
 * prints `%23notes.md` and can never collide with the node addressed
 * `#notes.md`; and a heading's `#` is the only unescaped one in
 * `README.md#install`, because the slug beside it is encoded too. And the
 * MENTION lives in the `@`-namespace, one sigil apart from every address the
 * grammar can write — `printAddress` never prints one.
 *
 * A LINK ONTO A HEADING IS FILED TWICE, and that is this index's whole shape
 * decision. `[the scope](brief.md#scope)` is a reference to the heading AND a
 * reference to `brief.md` — the reader who opens that file is who wants to know
 * ({@link ./backlinks.ts} rules it, and the reverse does not hold: asking about
 * the heading is asking about the heading). A reader that had to collect the
 * document's answer out of its headings' keys would have to know every heading
 * anybody had ever written, so the FOLD pays it instead: one extra key per
 * heading link, written once where the link is read, and the question a page
 * asks is one lookup.
 *
 * ## What it holds
 *
 * FOR EACH KEY, THE SOURCES THAT POINT AT IT, once per source, with the ways
 * each one says it — computed at the FOLD, in {@link ./imports.ts}, where a
 * record's prose is read once and the face already exists
 * ({@link ./document.ts}'s {@link faceOf}). A source is a record of an
 * outline, or the BODY itself when the file holds no records.
 *
 * THE FACE IS HELD, ONE SHARED OBJECT PER FILE — the very object the document
 * carries, so an outline whose twenty records point at one target files
 * twenty small `Source`s that all point at one `Face`, and the reading draws
 * the referrer's title from it without opening a body it would have to fetch
 * anyway. What is never held is the BODY: a `.md`'s prose is the largest
 * thing in a served directory, and it enters this index spent.
 *
 * IN PATH ORDER per key, which is {@link ./set.ts}'s `assemble` promise read
 * straight through: the build walks the documents in the order the set holds
 * them, and the patch below sorts what it re-files by {@link byPath}. Paths are
 * unique across a set, so that order is TOTAL and the two sides of a re-file can
 * never tie — which is the tie question `perf-key-resort` made every client of
 * the patcher's SPLICE declare ({@link ./patch.ts}'s `refiled`, at its `filing.order`
 * option: an arriving member is placed after every member it compares equal to,
 * so an order that CAN tie the two sides reorders silently). It is asked and
 * answered here rather than registered there, because this index is not one of
 * that function's clients: `Listed` is `Derived`'s own list-valued indexes and
 * this is keyed on DOCUMENTS rather than on records, so it carries itself with
 * the fold below and `./splice.test.ts` has nothing to cover for it.
 *
 * NOTHING READS THE KEYS IN ORDER, exactly as {@link Derived.taggedBy} says of
 * its own: one reader asks this index and it asks by key. That is what lets the
 * patch add and drop keys in place rather than rebuilding the map to keep an
 * order nobody promised.
 *
 * WHAT IS PUT AWAY IS IN IT, like every index of this format, and is left out
 * at the READ ({@link ./backlinks.ts} says it in its own words): an index that
 * knew about `_olai/Trash.olai` would be the format's storage rule wired into a
 * fold that is about what a file points at.
 *
 * ## Where it lives, and why it is not on `Derived`
 *
 * It travels on the {@link Reading} — beside the set and the derivation, for
 * the reason those two travel together ({@link ./derive.ts}): an index of one
 * revision's documents handed to a reader holding another's is a plausible
 * answer about the wrong directory.
 *
 * It is NOT a thirteenth index on {@link Derived}, and the reason is
 * structural rather than tidy. `derive` is the derivation of the RECORDS — it
 * is handed a flat list of them and nothing else — and `patch` answers a
 * {@link SetDelta}, which carries a file's records and no face at all. A
 * links index inside that value would need every served file's face in both
 * places: in `derive`, which has never been shown a document; in the delta,
 * which the wire already speaks; and in `patch`'s own fallback, which rebuilds
 * from the delta applied to the previous grouping and therefore could not
 * reach the faces of the files the delta does NOT name. What this index needs
 * instead is exactly what {@link ./validate.ts} has in hand at the one place a
 * `Reading` is made: the set, and the reading this one follows.
 *
 * ## What it costs
 *
 * A REBUILD is one walk of every reference of every file — the walks
 * `backlinksOf` and `referrersTo` used to make per read — and it happens where
 * a derivation is rebuilt: a first load, or a validation with nothing behind it.
 *
 * A PATCH costs the files that MOVED. The two sets are both in path order, so
 * finding them is one step through the pair ({@link moved}), and a file whose
 * face is unchanged is stepped over — which is nearly every file of nearly
 * every revision. An edit that moves no face at all hands back the map that
 * stood, uncloned, exactly as {@link ./patch.ts}'s re-filings do.
 *
 * THE SETS ARE COMPARED, NOT THE DELTA, and that is deliberate. A delta names
 * the files a probe re-decoded; the sets say what those files ARE. Two things
 * fall out of reading the sets: a `.md` written inside a batch is carried (the
 * ops layer's fold does not put a document write in the delta at all — its
 * upserts are the outlines it planned), and a file re-decoded to a face that
 * says the same thing costs nothing, because {@link sameFace} answers before
 * anything is re-filed. The comparison is one step per served file, which is
 * what `assemble` already spends building the list.
 */

import { type Address, printAddress } from "./address.ts"
import { type Document, type Face, faceOf, sameFace } from "./document.ts"
import { type Editable, overlay } from "./overlay.ts"
import { byPath } from "./paths.ts"
import { type Located } from "./node.ts"
import { contributionsOf, type Way } from "./imports.ts"
import { byCorpus } from "./derive.ts"
import { type Claims } from "./kinds.ts"

/**
 * ONE SOURCE UNDER ONE KEY — a record of an outline, or the BODY itself when
 * the file holds no records, and the ways that source says the target.
 *
 * A body's source carries `at: undefined`: a `.md` has no finer grain than
 * itself, and the file IS the referrer. An outline's record is ALWAYS regular
 * — a mirror writes nothing, so no entry ever names one.
 *
 * The {@link Face} is the file's own, shared: a document's every entry under
 * every key points at one object, so the row a reader draws needs no fetch and
 * the index holds nothing a serving document does not already.
 */
export interface Source {
  /** The record, for an outline; `undefined` for a body. */
  readonly at: Located | undefined
  /** The document the source lives in — its name, its path, and where it
   *  points. One object per file, shared across the file's entries. */
  readonly face: Face
  /** The ways it says the target, in {@link Way} order. */
  readonly ways: ReadonlyArray<Way>
}

/**
 * WHAT A REFERENCE NAMES → the sources that write one there, in path order.
 *
 * A `ReadonlyMap` and nothing more: one index, so the type is the index rather
 * than a struct around it.
 */
export type Pointing = ReadonlyMap<string, ReadonlyArray<Source>>

/** The answer for an address nothing points at, which is most of them: ONE
 *  list, shared, for {@link ./backlinks.ts}'s reason — a page asks this per
 *  frame. */
const NOTHING_POINTS: ReadonlyArray<Source> = []

/**
 * WHO POINTS AT AN ADDRESS — the whole of what this index is read for, and one
 * lookup.
 *
 * The key is the address WRITTEN, which is the same spelling the fold below
 * files under, so the two cannot come to disagree about what naming a place
 * looks like.
 */
export const pointingAt = (pointing: Pointing, address: Address): ReadonlyArray<Source> =>
  pointing.get(printAddress(address)) ?? NOTHING_POINTS

/**
 * ONE DOCUMENT FILED — the whole of how this index is built, in one place, for
 * `./derive.ts`'s `nameInto` reason: the patch below runs this same fold over
 * the documents one revision brought in, and a second spelling of the heading
 * rule would be free to drift from this one. It is not exported, because unlike
 * the derivation's four folds both of its callers are in this file — the
 * rebuild and the carry are one module here, where there the patcher is a
 * module of its own.
 */
const pointInto = (
  into: Map<string, Array<Source>>,
  claims: Claims,
  document: Document,
): void => {
  const face = faceOf(document)
  const records = document.holds === "nodes" ? document.nodes : undefined
  for (const contribution of contributionsOf(claims, face, records)) {
    const source: Source = { at: contribution.at, face, ways: [contribution.way] }
    fileAt(into, contribution.key, source)
    // A LINK ONTO A HEADING OR A ROW POINTS AT THE DOCUMENT AS WELL — one
    // extra key per heading link, the shape decision the module header
    // argues. The reverse is false: asking about a document does not make a
    // heading of it answer. A BARE NODE LINK (`[x](#herbs)`) files under the
    // node alone — it is a reference to the id, not to the file the link was
    // written in.
    const address = contribution.address
    if (address !== undefined && address.kind !== "node" && address.kind !== "document") {
      fileAt(into, printAddress({ kind: "document", path: address.path }), source)
    }
  }
}


/**
 * THE INDEX, BUILT — every served file's references filed under everything it
 * points at.
 *
 * The face is taken here ({@link faceOf}) rather than the document, so nothing
 * this index holds onto is a body (the module header says why). It is one
 * projection per served file per rebuild, against a walk of every reference of
 * every record and body of the directory, which is the walk this replaces one
 * read of.
 */
export const pointingOf = (claims: Claims, documents: ReadonlyArray<Document>): Pointing => {
  const into = new Map<string, Array<Source>>()
  // IN PATH ORDER, which is the order `assemble` puts the set in and the order
  // this index promises its members in — inherited from the walk rather than
  // sorted for, exactly as `derive`'s reverse indexes inherit corpus order from
  // the list they are handed.
  for (const document of documents) pointInto(into, claims, document)
  return into
}

/**
 * THE INDEX, CARRIED ACROSS A REVISION — what the last one held, plus what the
 * files that moved did to it.
 *
 * Held to {@link pointingOf} by a differential over generated corpora and over
 * this repository's own `docs/` (`./pointing.test.ts`), which is the
 * arrangement `./patch.ts` has with `derive`: this is an optimisation, that is
 * the definition, and nothing here is allowed to be a second reading of what a
 * document points at — {@link pointInto} is asked of both sides of the change.
 *
 * NOTHING MOVED, NOTHING CLONED. A revision whose faces all say what they said
 * hands back the very map it was given, so a keystroke in an outline that
 * writes no reference pays nothing for this index at all — {@link ./patch.ts}'s
 * own economy, applied to a value it does not hold.
 *
 * A LAYER and not a clone ({@link ./overlay.ts}): this index is read BY KEY,
 * once per page per revision, and never walked.
 */
export const repointed = (
  before: Pointing,
  claims: Claims,
  was: ReadonlyArray<Document>,
  now: ReadonlyArray<Document>,
): Pointing => {
  const { touched, departing, arriving } = moved(was, claims, now)
  const keys = new Set(arriving.keys())
  for (const key of departing.keys()) keys.add(key)
  if (keys.size === 0) return before
  const map: Editable<string, ReadonlyArray<Source>> = overlay(before, "by key")
  for (const key of keys) {
    // WHAT IS LEFT OF THE KEY plus WHAT ARRIVED — `refiled`'s rule, spelled
    // here because this index is re-filed by FILE rather than by record and
    // therefore cannot be one of that function's clients. A key left holding
    // nothing GOES AWAY rather than standing empty where a rebuild would have
    // had no key at all: the differential compares what the map HOLDS and not
    // only what it answers.
    const own = [
      ...(before.get(key) ?? []).filter((source) => !touched.has(source.face.path)),
      ...(arriving.get(key) ?? []),
    ].sort(bySource)
    if (own.length === 0) map.delete(key)
    else map.set(key, own)
  }
  return map.sealed()
}

/**
 * One source under one key.
 *
 * A RECORD APPEARS ONCE PER KEY, however many of its links land there, and a
 * BODY appears once per key too: a record whose prose writes both `brief.md`
 * and `brief.md#scope` points at `brief.md` twice and files once (both links
 * are one way), and the same record writing a `see` beside a link files ONCE
 * with both ways. The entry to leave alone is the LAST one — a document's
 * contributions are filed together, in record order, so an entry already filed
 * by the source in hand can only be the one on the end, which is
 * {@link tagInto}'s own trick and for its reason.
 *
 * TWO RECORDS OF ONE FILE are two sources and file as such, however close
 * together they sit: {@link bySource} sorts the key by their corpus order,
 * which is the order the records were walked in.
 */
export const fileAt = (into: Map<string, Array<Source>>, key: string, entry: Source): void => {
  const held = into.get(key)
  if (held === undefined) {
    into.set(key, [entry])
    return
  }
  const last = held[held.length - 1] as Source
  // THE SAME SOURCE — the same record, by identity, or the same body file,
  // which is the ONE source a body's file can contribute per key: every
  // contribution of one document comes from one `pointInto` call, so two
  // entries with the same record object (or two body entries, which always
  // carry the same `undefined` record) are the same source. A different
  // record of the same file is a different object and files separately.
  if (last.at === entry.at && last.face === entry.face) {
    // The ways arrive one at a time from the fold; a second way for a source
    // already filed is merged in, keeping {@link Way} order.
    if (!last.ways.includes(entry.ways[0] as Way)) {
      held[held.length - 1] = { at: last.at, face: last.face, ways: [...last.ways, entry.ways[0] as Way] }
    }
    return
  }
  held.push(entry)
}

/** Path order over two sources: by file, and by CORPUS ORDER within a file —
 *  the promise {@link byCorpus} makes, which the module header claimed in
 *  path words. One record of an outline writing two keys files under each,
 *  and a BODY files at the file itself, ordered ahead of the file's records:
 *  the body IS the file, so its entry is the FILE's. */
const bySource = (one: Source, other: Source): number => {
  const side = byPath(one.face.path, other.face.path)
  if (side !== 0) return side
  if (one.at === undefined && other.at === undefined) return 0
  if (one.at === undefined) return -1
  if (other.at === undefined) return 1
  return byCorpus(one.at, other.at)
}

/**
 * WHICH FILES MOVED, and what their documents put in this index on each side.
 *
 * ONE STEP THROUGH THE PAIR, because both lists are in path order — `assemble`
 * sorts for itself rather than trusting whoever built the map it read
 * ({@link ./set.ts}), so this is a merge and not a lookup per file.
 *
 * A FILE WHOSE FACE SAYS THE SAME THING HAS NOT MOVED, whatever happened to its
 * bytes. That is {@link sameFace}, the equivalence the tape holds two revisions
 * of the served files to ({@link ./tape.ts}), asked here for the same reason it
 * is asked there: a `.md` whose BODY changed and whose face did not is a file
 * whose name, links, tags and properties are where they were, and no answer
 * this index feeds is a function of the bytes underneath. Stepping over it is
 * what keeps the entry — and therefore the ARRAY holding it — carried by
 * identity across a document write.
 *
 * A file whose face is unchanged has also contributed the SAME record-granular
 * sources to the SAME keys with the SAME ways ({@link ./imports.ts} reads the
 * face's own links and tags, and the records' fields and `@` tags — everything
 * `sameFace` compares, and nothing else), which is the assumption the identity
 * carry rests on.
 */
const moved = (
  was: ReadonlyArray<Document>,
  claims: Claims,
  now: ReadonlyArray<Document>,
): {
  /** The paths whose entries have to come out of the keys they were under. */
  readonly touched: ReadonlySet<string>
  /** What those files pointed at BEFORE — for its KEYS, since the entries
   *  themselves are the ones being taken away. */
  readonly departing: ReadonlyMap<string, ReadonlyArray<Source>>
  readonly arriving: ReadonlyMap<string, ReadonlyArray<Source>>
} => {
  const touched = new Set<string>()
  const departing = new Map<string, Array<Source>>()
  const arriving = new Map<string, Array<Source>>()
  let here = 0
  let there = 0
  // THE PROJECTION on BOTH sides, though only this one's KEYS are ever read:
  // a `Document` is a `Face` plus its content, so handing the document itself
  // in would put a `.md`'s whole body in a map for the length of one carry —
  // which is the retention this index takes the face to avoid, and a departing
  // side that grew a second reader tomorrow would grow it silently.
  const left = (document: Document): void => {
    touched.add(document.path)
    pointInto(departing, claims, document)
  }
  const joined = (document: Document): void => {
    touched.add(document.path)
    pointInto(arriving, claims, document)
  }
  while (here < was.length && there < now.length) {
    const one = was[here] as Document
    const other = now[there] as Document
    const side = byPath(one.path, other.path)
    if (side < 0) {
      left(one)
      here++
    } else if (side > 0) {
      joined(other)
      there++
    } else if (one === other) {
      // THE VERY SAME DOCUMENT OBJECT on both sides — the set carried it
      // across by identity ({@link ./set.ts}'s `withDocuments`), which is the
      // commonest shape a revision takes. Nothing to compare: it filed what it
      // filed, and asking even the face would be paying for a sentence the
      // carry already said.
      here++
      there++
    } else {
      // THE SAME PATH, DIFFERENT OBJECTS. The face decides for a BODY — a
      // `.md` whose prose changed and whose face did not is not a file whose
      // references moved (its links and tags ARE the face). An OUTLINE is
      // different: the index files its RECORDS, and the face is the records'
      // links DEDUPED PER ADDRESS — so a record gaining a `see` an existing
      // face already lists, or the same-title duplicate case, changes the
      // index's entries without changing the face at all. The decode cache
      // hands INCOMPUTED bytes back as the very same record objects, so the
      // two revisions' `nodes` arrays differ by identity exactly when a record
      // changed, at no comparison cost; only a plain equality would be a walk.
      const faces = sameFace(one, other)
      const records = one.holds === "nodes"
        ? one.nodes !== other.nodes
        : false
      if (!faces || records) {
        left(one)
        joined(other)
      }
      here++
      there++
    }
  }
  for (; here < was.length; here++) left(was[here] as Document)
  for (; there < now.length; there++) joined(now[there] as Document)
  return { touched, departing, arriving }
}