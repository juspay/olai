/**
 * WHICH DOCUMENTS POINT WHERE — every source's forward references, filed
 * backwards and kept that way. THE ONE TABLE: a record's fields and a
 * document's links are one answer to "who points at this", in four parts.
 *
 * A note link, a `see`, an `after`, a placement, a link in a body and a tag
 * written in prose all point ONE WAY on disk. "What is talking about this
 * node?" and "what is talking about this document?" are that reading run
 * backwards, and until this module they were WALKS: {@link ./backlinks.ts}'s
 * two readers tested every link of every face in the directory, per revision,
 * per tab sitting on any page with a body. The roadmap node is
 * `perf-doc-backlinks-index`.
 *
 * ## The four parts, and why they are four
 *
 * BY WHAT IS POINTED AT ({@link ./imports.ts}'s `PARTS`), each part keyed in
 * the plainest spelling of that thing:
 *
 *   - `rows` — a row's own id (`herbs`): the fields `mirror`, `after`,
 *     `blocks` and `see`, and every link that lands on a row;
 *   - `files` — a path (`brief.md`), or a path and an element
 *     (`brief.md#scope`, `house.olai#kitchen`), written by {@link printAddress};
 *   - `names` — a wikilink's folded key, which the reading resolves against
 *     the revision's own membership when it reads;
 *   - `tags` — a tag AS WRITTEN, both sigils (`#herbs`, `@herbs`).
 *
 * FOUR MAPS AND NOT ONE OF STRINGS, because a row PRINTS as `#herbs`
 * ({@link printAddress}) and a topic is WRITTEN `#herbs`: in one map those are
 * one key holding two unrelated things, and no spelling rule can tell them
 * apart — the words are the same words. The parts do it instead, so the
 * question decides the map before a key is ever looked up and no reader has to
 * know what the other three hold.
 *
 * WITHIN A PART THE KEY IS INJECTIVE, which is what lets `files` hold the
 * three path-rooted arms of the grammar together: a path prints its segments
 * percent-encoded, so a file literally called `#notes.md` prints `%23notes.md`,
 * and a heading's `#` is the only unescaped one in `README.md#install`,
 * because the slug beside it is encoded too.
 *
 * A LINK ONTO A HEADING IS FILED TWICE, and that is this table's whole shape
 * decision. `[the scope](brief.md#scope)` is a reference to the heading AND a
 * reference to `brief.md` — the reader who opens that file is who wants to know
 * ({@link ./backlinks.ts} rules it, and the reverse does not hold: asking about
 * the heading is asking about the heading). A reader that had to collect the
 * document's answer out of its headings' keys would have to know every heading
 * anybody had ever written, so the FOLD pays it instead: one extra key per
 * heading link, written once where the link is read, and the question a page
 * asks is one lookup.
 *
 * EACH READER NAMES THE WAYS IT COUNTS. The table files every way a document
 * can point at something ({@link ./imports.ts}'s `FILED_WAYS`) and holds no
 * opinion about which of them a question is about: **Referenced by** counts
 * `see`, the mention half of `tags` and `link`, and says so in its own words
 * ({@link ./backlinks.ts}'s `WAYS`); a refusal that asks "does anything still
 * name this record" counts the field ways. A table that filed only what one
 * reader counts would send the others back to walking the corpus.
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
 * its own: every reader of this table asks it by key. That is what lets the
 * carry add and drop keys in place rather than rebuilding a map to keep an
 * order nobody promised.
 *
 * WHAT IS PUT AWAY IS IN IT, like every index of this format, and is left out
 * at the READ ({@link ./backlinks.ts} says it in its own words): a table that
 * knew about `_olai/Trash.olai` would be the format's storage rule wired into a
 * fold that is about what a file points at.
 *
 * ## Where it lives, and why it is not on `Derived`
 *
 * It travels on the {@link Reading} — beside the set and the derivation, for
 * the reason those two travel together ({@link ./derive.ts}): a table of one
 * revision's documents handed to a reader holding another's is a plausible
 * answer about the wrong directory.
 *
 * It is NOT a thirteenth index on {@link Derived}, and the reason is
 * structural rather than tidy. `derive` is the derivation of the RECORDS — it
 * is handed a flat list of them and nothing else — and `patch` answers a
 * {@link SetDelta}, which carries a file's records and no face at all. A table
 * inside that value would need every served file's face in both
 * places: in `derive`, which has never been shown a document; in the delta,
 * which the wire already speaks; and in `patch`'s own fallback, which rebuilds
 * from the delta applied to the previous grouping and therefore could not
 * reach the faces of the files the delta does NOT name. What this table needs
 * instead is exactly what {@link ./validate.ts} has in hand at the one place a
 * `Reading` is made: the set, and the reading this one follows.
 *
 * ## What it costs
 *
 * A REBUILD is one walk of every reference of every file — the walks the
 * reverse readings used to make per read — and it happens where
 * a derivation is rebuilt: a first load, or a validation with nothing behind it.
 *
 * A CARRY costs the files that MOVED. The two sets are both in path order, so
 * finding them is one step through the pair ({@link moved}), and a file whose
 * face and records are the ones it had is stepped over — which is nearly every
 * file of nearly every revision. An edit that moves no file at all hands back
 * the table that stood, uncloned, and an edit that moves one hands on the
 * parts it did not write, exactly as {@link ./patch.ts}'s re-filings do.
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
import { type Document, type Face, faceOf, sameFace, isOutline } from "./document.ts"
import { type Editable, overlay } from "./overlay.ts"
import { byPath } from "./paths.ts"
import { type Located } from "./node.ts"
import { contributionsOf, type Part, PARTS, type Way } from "./imports.ts"
import { byCorpus } from "./derive.ts"
import { type Claims } from "./kinds.ts"
import type { WikilinkName } from "@olai/prose/wikilink.ts"

/**
 * ONE SOURCE UNDER ONE KEY — a record of an outline, or the BODY itself when
 * the file holds no records, and the ways that source says the target.
 *
 * A body's source carries `at: undefined`: a `.md` has no finer grain than
 * itself, and the file IS the referrer. An outline's record is regular except
 * under one way: a PLACEMENT is a source with the way `mirror`, and nothing
 * else — it carries no prose, no edge and no link of its own.
 *
 * The {@link Face} is the file's own, shared: a document's every entry under
 * every key points at one object, so the row a reader draws needs no fetch and
 * the table holds nothing a serving document does not already.
 */
export interface Source {
  /** The record, for an outline; `undefined` for a body. */
  readonly at: Located | undefined
  /** The document the source lives in — its name, its path, and where it
   *  points. One object per file, shared across the file's entries. */
  readonly face: Face
  /** The ways it says the target, in the order the fold filed them. */
  readonly ways: ReadonlyArray<Way>
  /** In the NAMES part, the names this source writes under that key, which the
   *  reading resolves; in the ROWS part, the names of the wikilinks to a ROW
   *  of that id — counted only where the name finds a file that draws that row
   *  ({@link ./backlinks.ts}). */
  readonly written?: ReadonlyArray<WikilinkName>
  /** In the ROWS part, the files a standard link to a ROW of that id names —
   *  `[x](house.olai#kitchen)` is filed under `kitchen` with `house.olai` —
   *  counted only where the file draws that row. */
  readonly rows?: ReadonlyArray<string>
}

/** Whether a source counts only when the reading finds its link lands — a
 *  row link under a row's key — rather than by being filed there at all. */
export const conditional = (source: Source): boolean =>
  source.rows !== undefined || source.written !== undefined

/**
 * THE TABLE: four maps, by what is pointed at, each from a key to the sources
 * that write one there, in path order.
 *
 * A struct of maps and nothing more — the parts are the type, so a reader asks
 * the part its question is about and a key cannot be looked up in a map it does
 * not belong to (the header's four-maps argument).
 */
export type Pointing = { readonly [K in Part]: ReadonlyMap<string, ReadonlyArray<Source>> }

/** The table while it is still being filled — the same four parts, writable,
 *  which is what the fold and both sides of the carry hand about. */
type Filling = { readonly [K in Part]: Map<string, Array<Source>> }

const filling = (): Filling => ({
  rows: new Map(),
  files: new Map(),
  names: new Map(),
  tags: new Map(),
})

/** The answer for a key nothing points at, which is most of them: ONE
 *  list, shared, for {@link ./backlinks.ts}'s reason — a page asks this per
 *  frame. */
const NOTHING_POINTS: ReadonlyArray<Source> = []

/**
 * WHO POINTS AT AN ADDRESS — the two parts an address can land in, and one
 * lookup.
 *
 * A bare node address is a ROW, by its id; everything else is path-rooted and
 * is a FILE, by the address WRITTEN — the same spellings the fold files under,
 * so the two cannot come to disagree about what naming a place looks like. The
 * other two parts are not addressable at all: a wikilink's name is resolved by
 * the reading and a tag is a word, so each is asked for by its own reader
 * ({@link ./backlinks.ts}).
 */
export const pointingAt = (pointing: Pointing, address: Address): ReadonlyArray<Source> =>
  (address.kind === "node"
    ? pointing.rows.get(address.id)
    : pointing.files.get(printAddress(address))) ?? NOTHING_POINTS

/**
 * ONE DOCUMENT FILED — the whole of how this table is built, in one place, for
 * `./derive.ts`'s `nameInto` reason: the carry below runs this same fold over
 * the documents one revision brought in, and a second spelling of the heading
 * rule would be free to drift from this one. It is not exported, because unlike
 * the derivation's four folds both of its callers are in this file — the
 * rebuild and the carry are one module here, where there the patcher is a
 * module of its own.
 */
const pointInto = (
  into: Filling,
  claims: Claims,
  document: Document,
): void => {
  const face = faceOf(document)
  const records = document.holds === "nodes" ? document.nodes : undefined
  for (const contribution of contributionsOf(claims, face, records)) {
    const source: Source = contribution.wikilink === undefined
      ? { at: contribution.at, face, ways: [contribution.way] }
      : { at: contribution.at, face, ways: [contribution.way], written: [contribution.wikilink] }
    fileAt(into[contribution.part], contribution.key, source)
    // A LINK ONTO A HEADING OR A ROW POINTS AT THE DOCUMENT AS WELL — one
    // extra key per heading link, the shape decision the module header
    // argues. The reverse is false: asking about a document does not make a
    // heading of it answer. A BARE NODE LINK (`[x](#herbs)`) files under the
    // row alone — it is a reference to the id, not to the file the link was
    // written in.
    const address = contribution.address
    if (address !== undefined && address.kind !== "node" && address.kind !== "document") {
      fileAt(into.files, printAddress({ kind: "document", path: address.path }), source)
    }
    // ...and a link onto a ROW points at the row in it: filed under the row's
    // own id with the file it names, which the row arm checks draws it.
    if (address?.kind === "row") {
      fileAt(into.rows, address.id, { at: contribution.at, face, ways: [contribution.way], rows: [address.path] })
    }
  }
}


/**
 * THE TABLE, BUILT — every served file's references filed under everything it
 * points at, in the part that thing belongs to.
 *
 * The face is taken here ({@link faceOf}) rather than the document, so nothing
 * this table holds onto is a body (the module header says why). It is one
 * projection per served file per rebuild, against a walk of every reference of
 * every record and body of the directory, which is the walk this replaces one
 * read of.
 */
export const pointingOf = (claims: Claims, documents: ReadonlyArray<Document>): Pointing => {
  const into = filling()
  // IN PATH ORDER, which is the order `assemble` puts the set in and the order
  // this table promises its members in — inherited from the walk rather than
  // sorted for, exactly as `derive`'s reverse indexes inherit corpus order from
  // the list they are handed.
  for (const document of documents) pointInto(into, claims, document)
  return into
}

/**
 * THE TABLE, CARRIED ACROSS A REVISION — what the last one held, plus what the
 * files that moved did to it. ONE CARRY for all four parts: the documents that
 * moved are found once, and each part is re-filed from the same two sides.
 *
 * Held to {@link pointingOf} by a differential over generated corpora and over
 * this repository's own `docs/` (`./pointing.test.ts`), which is the
 * arrangement `./patch.ts` has with `derive`: this is an optimisation, that is
 * the definition, and nothing here is allowed to be a second reading of what a
 * document points at — {@link pointInto} is asked of both sides of the change.
 *
 * NOTHING MOVED, NOTHING CLONED. A revision whose faces all say what they said
 * hands back the very table it was given, so a keystroke in an outline that
 * writes no reference pays nothing for this table at all — {@link ./patch.ts}'s
 * own economy, applied to a value it does not hold. A part no moved file wrote
 * a key in is handed on as the very map it was: a revision that moves one link
 * leaves the tags, the names and the rows where they were, by identity, which
 * is what lets a reader of one part be told nothing happened.
 *
 * A LAYER and not a clone ({@link ./overlay.ts}): this table is read BY KEY,
 * once per page per revision, and never walked.
 */
export const repointed = (
  before: Pointing,
  claims: Claims,
  was: ReadonlyArray<Document>,
  now: ReadonlyArray<Document>,
): Pointing => {
  const { touched, departing, arriving } = moved(was, claims, now)
  if (touched.size === 0) return before
  const parts: Partial<Record<Part, ReadonlyMap<string, ReadonlyArray<Source>>>> = {}
  let changed = false
  for (const part of PARTS) {
    const keys = new Set(arriving[part].keys())
    for (const key of departing[part].keys()) keys.add(key)
    if (keys.size === 0) {
      parts[part] = before[part]
      continue
    }
    changed = true
    const held = before[part]
    const map: Editable<string, ReadonlyArray<Source>> = overlay(held, "by key")
    for (const key of keys) {
      // WHAT IS LEFT OF THE KEY plus WHAT ARRIVED — `refiled`'s rule, spelled
      // here because this table is re-filed by FILE rather than by record and
      // therefore cannot be one of that function's clients. A key left holding
      // nothing GOES AWAY rather than standing empty where a rebuild would have
      // had no key at all: the differential compares what the table HOLDS and
      // not only what it answers.
      const own = [
        ...(held.get(key) ?? []).filter((source) => !touched.has(source.face.path)),
        ...(arriving[part].get(key) ?? []),
      ].sort(bySource)
      if (own.length === 0) map.delete(key)
      else map.set(key, own)
    }
    parts[part] = map.sealed()
  }
  // A FILE WHOSE DOCUMENT CONTRIBUTES NOTHING can still be touched — an empty
  // outline, a `.md` with no links — so the table itself is handed back
  // uncloned here rather than only at the step above.
  return changed ? (parts as Pointing) : before
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
const fileAt = (into: Map<string, Array<Source>>, key: string, entry: Source): void => {
  const held = into.get(key)
  if (held === undefined) {
    into.set(key, [entry])
    return
  }
  // THE SAME SOURCE — the same record, by identity, or the same body file,
  // which is the ONE source a body's file can contribute per key: every
  // contribution of one document comes from one `pointInto` call, so two
  // entries with the same record object (or two body entries, which always
  // carry the same `undefined` record) are the same source. A different
  // record of the same file is a different object and files separately.
  //
  // ONE ENTRY PER SOURCE PER CLASS: a node's key holds what counts by being
  // there, and — apart, so a stale one cannot lend its way to the rest — the
  // standard row links and the row wikilinks the reading checks
  // ({@link conditional}). A source's entries sit together at the end.
  for (let at = held.length - 1; at >= 0; at--) {
    const last = held[at] as Source
    if (last.at !== entry.at || last.face !== entry.face) break
    if (classOf(last) !== classOf(entry)) continue
    // The ways arrive one at a time from the fold; a second way for a source
    // already filed is merged in, keeping {@link Way} order. A second thing
    // written under one key (`[[Note]]` and `[[Note#Part]]`, or two rows'
    // files) joins the first, so the reading checks each.
    const way = entry.ways[0] as Way
    const written = joined(last.written, entry.written, sameName)
    const rows = joined(last.rows, entry.rows, samePath)
    if (last.ways.includes(way) && written === last.written && rows === last.rows) return
    held[at] = {
      at: last.at,
      face: last.face,
      ways: last.ways.includes(way) ? last.ways : [...last.ways, way],
      ...(written === undefined ? {} : { written }),
      ...(rows === undefined ? {} : { rows }),
    }
    return
  }
  held.push(entry)
}

/** Which of a row key's three kinds of entry a source is — see {@link fileAt}. */
const classOf = (source: Source): 0 | 1 | 2 =>
  source.rows !== undefined ? 1 : source.written !== undefined ? 2 : 0

/** Two lists of things written, as one, keeping the first when the second
 *  adds nothing. `same` says when two of them are one. */
const joined = <T>(
  held: ReadonlyArray<T> | undefined,
  more: ReadonlyArray<T> | undefined,
  same: (one: T, other: T) => boolean,
): ReadonlyArray<T> | undefined => {
  const added = more?.filter((one) => !(held ?? []).some((other) => same(one, other))) ?? []
  return added.length === 0 ? held : [...(held ?? []), ...added]
}

/** Two wikilinks name one thing when their targets and their `#` parts do. */
const sameName = (one: WikilinkName, other: WikilinkName): boolean =>
  one.target === other.target && one.fragments.length === other.fragments.length &&
  one.fragments.every((part, at) => part === other.fragments[at])

const samePath = (one: string, other: string): boolean => one === other

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
 * A file whose face is unchanged, and whose RECORDS are the very objects they
 * were, has also contributed the SAME record-granular sources to the SAME keys
 * with the SAME ways — the face carries a body's links, tags and wikilinks,
 * and the records array carries every field and every text the fold reads off
 * a record — which is the assumption the identity carry rests on.
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
  readonly departing: Filling
  readonly arriving: Filling
} => {
  const touched = new Set<string>()
  const departing = filling()
  const arriving = filling()
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
      const records = isOutline(one) && isOutline(other)
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