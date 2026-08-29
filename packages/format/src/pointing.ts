/**
 * WHICH DOCUMENTS POINT WHERE — every face's forward `links`, filed backwards
 * and kept that way.
 *
 * A `doc` attachment, a `see`, a link in a note and a link in a body all point
 * ONE WAY on disk ({@link ./document.ts}'s {@link Face} carries the addresses a
 * file names). "What is talking about this document?" is that reading run
 * backwards, and until this module it was a WALK: {@link ./backlinks.ts}'s
 * `referrersTo` tested every link of every face in the directory, per revision,
 * per tab sitting on any page with a body. The node-to-node direction next door
 * has had its reverse indexes since `model-indices`
 * ({@link Derived.namedBy}, {@link Derived.taggedBy}); this is the one
 * direction that did not, and the roadmap node is `perf-doc-backlinks-index`.
 *
 * ## What it is keyed by
 *
 * THE ADDRESS, WRITTEN — {@link printAddress}, which is the canonical spelling
 * the grammar promises, so two addresses that name one place print one string
 * and nothing here has to know how the arms are shaped. It is the same key
 * {@link outlineDocument} already dedupes a face's own links by, which is what
 * keeps the forward half and this one from coming to disagree about when two
 * links are one.
 *
 * IT IS INJECTIVE over the three arms, which is what lets them share a map: a
 * path prints its segments percent-encoded, so a file literally called
 * `#notes.md` prints `%23notes.md` and can never collide with the node
 * addressed `#notes.md`; and a heading's `#` is the only unescaped one in
 * `README.md#install`, because the slug beside it is encoded too.
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
 * THE FACE and not the document, which is what {@link Referrer} draws and what
 * its type says. A `.md`'s body is the largest thing in a served directory and
 * the index carries a file's entry across every revision that leaves it alone —
 * so holding the whole {@link Document} would pin one body per pointing file
 * for as long as nothing rewrote it, to publish four fields.
 *
 * IN PATH ORDER, which is {@link ./set.ts}'s `assemble` promise read straight
 * through: the build walks the documents in the order the set holds them, and
 * the patch below sorts what it re-files by {@link byPath}. Paths are unique
 * across a set, so that order is TOTAL and the two sides of a re-file can never
 * tie — which is the tie question `perf-key-resort` made every client of the
 * patcher's SPLICE declare ({@link ./patch.ts}'s `refiled`, at its `filing.order`
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
 * A REBUILD is one walk of every link of every face — the walk `referrersTo`
 * used to make per read — and it happens where a derivation is rebuilt: a first
 * load, or a validation with nothing behind it.
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

/**
 * WHAT A LINK NAMES → the faces that write one there, in path order.
 *
 * A `ReadonlyMap` and nothing more: one index, so the type is the index rather
 * than a struct around it.
 */
export type Pointing = ReadonlyMap<string, ReadonlyArray<Face>>

/** The answer for an address nothing points at, which is most of them: ONE
 *  list, shared, for {@link ./backlinks.ts}'s reason — a page asks this per
 *  frame. */
const NOTHING_POINTS: ReadonlyArray<Face> = []

/**
 * WHO POINTS AT AN ADDRESS — the whole of what this index is read for, and one
 * lookup.
 *
 * The key is the address WRITTEN, which is the same spelling the fold below
 * files under, so the two cannot come to disagree about what naming a place
 * looks like.
 */
export const pointingAt = (pointing: Pointing, address: Address): ReadonlyArray<Face> =>
  pointing.get(printAddress(address)) ?? NOTHING_POINTS

/**
 * ONE FACE FILED — the whole of how this index is built, in one place, for
 * `./derive.ts`'s `nameInto` reason: the patch below runs this same fold over
 * the faces one revision brought in, and a second spelling of the heading rule
 * would be free to drift from this one. It is not exported, because unlike the
 * derivation's four folds both of its callers are in this file — the rebuild
 * and the carry are one module here, where there the patcher is a module of its
 * own.
 */
const pointInto = (into: Map<string, Array<Face>>, face: Face): void => {
  for (const link of face.links) {
    fileAt(into, printAddress(link), face)
    // A LINK ONTO A HEADING POINTS AT THE DOCUMENT as well, which is the
    // module header's one shape decision and the only place this fold does
    // more than write down what it read. A link onto a ROW points at its
    // outline for the same sentence's reason: the reader opening the file is
    // who wants to know, and the row's address already carries the file it
    // is a row of, so the second key costs one print and no rule.
    if (link.kind === "heading" || link.kind === "row") {
      fileAt(into, printAddress({ kind: "document", path: link.path }), face)
    }
  }
}

/**
 * One face under one key.
 *
 * A FACE APPEARS ONCE PER KEY, however many of its links land there: a document
 * that writes both `brief.md` and `brief.md#scope` points at `brief.md` once,
 * and a reader listing what refers to a document wants to know WHICH files to
 * draw. The entry to leave alone is the LAST one — a face's links are filed
 * together, so an entry already filed by the face in hand can only be the one
 * on the end, which is {@link tagInto}'s own trick and for its reason.
 */
const fileAt = (into: Map<string, Array<Face>>, key: string, face: Face): void => {
  const held = into.get(key)
  if (held === undefined) into.set(key, [face])
  else if (held[held.length - 1] !== face) held.push(face)
}

/**
 * THE INDEX, BUILT — every served file's face filed under everything it points
 * at.
 *
 * The FACE is taken here ({@link faceOf}) rather than the document, so nothing
 * this index holds onto is a body (the module header says why). It is one
 * projection per served file per rebuild, against a walk of every link in the
 * directory, which is the same walk this replaces one read of.
 */
export const pointingOf = (documents: ReadonlyArray<Document>): Pointing => {
  const into = new Map<string, Array<Face>>()
  // IN PATH ORDER, which is the order `assemble` puts the set in and the order
  // this index promises its members in — inherited from the walk rather than
  // sorted for, exactly as `derive`'s reverse indexes inherit corpus order from
  // the list they are handed.
  for (const document of documents) pointInto(into, faceOf(document))
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
 * face points at — {@link pointInto} is asked of both sides of the change.
 *
 * NOTHING MOVED, NOTHING CLONED. A revision whose faces all say what they said
 * hands back the very map it was given, so a keystroke in an outline that
 * writes no link pays nothing for this index at all — {@link ./patch.ts}'s own
 * economy, applied to a value it does not hold.
 *
 * A LAYER and not a clone ({@link ./overlay.ts}): this index is read BY KEY,
 * once per document page per revision, and never walked.
 */
export const repointed = (
  before: Pointing,
  was: ReadonlyArray<Document>,
  now: ReadonlyArray<Document>,
): Pointing => {
  const { touched, departing, arriving } = moved(was, now)
  const keys = new Set(arriving.keys())
  for (const key of departing.keys()) keys.add(key)
  if (keys.size === 0) return before
  const map: Editable<string, ReadonlyArray<Face>> = overlay(before, "by key")
  for (const key of keys) {
    // WHAT IS LEFT OF THE KEY plus WHAT ARRIVED — `refiled`'s rule, spelled
    // here because this index is re-filed by FILE rather than by record and
    // therefore cannot be one of that function's clients. A key left holding
    // nothing GOES AWAY rather than standing empty where a rebuild would have
    // had no key at all: the differential compares what the map HOLDS and not
    // only what it answers.
    const own = [
      ...(before.get(key) ?? []).filter((face) => !touched.has(face.path)),
      ...(arriving.get(key) ?? []),
    ].sort(byFace)
    if (own.length === 0) map.delete(key)
    else map.set(key, own)
  }
  return map.sealed()
}

/** Path order over two faces — the order this index promises its members in.
 *  Paths are unique across a set, so this never ties, and a survivor and an
 *  arrival therefore have exactly one order between them. */
const byFace = (one: Face, other: Face): number => byPath(one.path, other.path)

/**
 * WHICH FILES MOVED, and what their faces put in this index on each side.
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
 * what keeps the entry — and therefore the ARRAY holding it, and therefore the
 * page that read it — carried by identity across a document write.
 *
 * The face kept for such a file is the one the index already holds, which is
 * the previous revision's projection. That is the point rather than an
 * oversight: it is equal to the one this revision would have made, and it is
 * the same object, which is the only thing a reader downstream can tell.
 */
const moved = (
  was: ReadonlyArray<Document>,
  now: ReadonlyArray<Document>,
): {
  /** The paths whose entries have to come out of the keys they were under. */
  readonly touched: ReadonlySet<string>
  /** What those files pointed at BEFORE — for its KEYS, since the entries
   *  themselves are the ones being taken away. */
  readonly departing: ReadonlyMap<string, ReadonlyArray<Face>>
  readonly arriving: ReadonlyMap<string, ReadonlyArray<Face>>
} => {
  const touched = new Set<string>()
  const departing = new Map<string, Array<Face>>()
  const arriving = new Map<string, Array<Face>>()
  let here = 0
  let there = 0
  // THE PROJECTION on BOTH sides, though only this one's KEYS are ever read:
  // a `Document` is a `Face` plus its content, so handing the document itself in
  // would put a `.md`'s whole body in a map for the length of one carry — which
  // is the retention this index takes the face to avoid, and a departing side
  // that grew a second reader tomorrow would grow it silently.
  const left = (document: Document): void => {
    touched.add(document.path)
    pointInto(departing, faceOf(document))
  }
  const joined = (document: Document): void => {
    touched.add(document.path)
    pointInto(arriving, faceOf(document))
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
    } else {
      // The same path on both sides: the one case where the FACE decides, and
      // the case nearly every file of nearly every revision is in.
      if (!sameFace(one, other)) {
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
