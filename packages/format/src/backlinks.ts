/**
 * WHAT REFERS TO A PLACE, read out of the indexes that were built forwards.
 *
 * Every reference in this format points ONE WAY on disk. A record writes
 * `see: ["herbs"]` or `@herbs` in its title or its note; a body writes
 * `@herbs` in its prose or links `[x](#herbs)`; a note links a document or
 * one of its headings — and the thing all of them talk about says nothing
 * back. "Who is talking about this?" was a question nothing could answer
 * without walking the whole directory, and nothing asked it.
 *
 * This module is the one reading over the two indexes that make it a lookup:
 * {@link ./pointing.ts} carries what every file POINTS AT (its links, its `@`
 * tags, its records' `see`s and the links in their notes — everything the
 * fold reads at build time), and {@link ./derive.ts}'s reverse indexes
 * (`namedBy`, `taggedBy`) are what the pointing index was built from. Every
 * page that asks "who refers" — a node, a document, a heading, a body — asks
 * THIS function, and every wire that carries the answer carries ONE shape.
 *
 * ONE SHAPE, and it is {@link Reference}: the thing that wrote the reference,
 * and the way(s) it did. A record and a document are the two kinds of source,
 * and the union is the whole of it — a `.md` has no finer grain than itself.
 *
 * ## What counts, and what deliberately does not
 *
 * **A `see` counts.** It is the format's own free cross-reference — the one
 * edge no derivation reads — so the reverse of it is the whole of what it is
 * for.
 *
 * **An `@id` in prose counts, exactly when the word names a node.** `@` is a
 * tag sigil in a title ({@link titleParts}: `#topic` and `@person`, two
 * namespaces), and `@herbs` is one whether or not a record claims `herbs`.
 * What turns a tag into a reference is the id existing, and that question is
 * asked HERE rather than in the index, so that minting a node does not have to
 * re-read every note in the directory to find the mentions that just became
 * references.
 *
 * **A LINK counts, whatever it names.** A record's note writing `[x](#herbs)`
 * is as much a sentence about the herb bed as a `see` is; a body writing
 * `[x](brief.md)` or `[x](brief.md#scope)` names a document, and pointing at
 * a heading is pointing at the document it is in. {@link ./pointing.ts}
 * files every link under everything it names; this reading says what each
 * entry means.
 *
 * **A `#topic` never counts, whatever it spells.** The index behind this files
 * both sigils under keys that keep them, so a set with a node called `herbs`
 * and a `#herbs` topic written across a dozen titles has two things there and
 * this section draws one of them. Sigil-stripped keys would have made that
 * ambiguity unreachable rather than decided.
 *
 * **A MIRROR DOES NOT COUNT, and that is the ruling this file was asked to
 * make.** A placement is a VIEW of a node, not a reference to one: the record
 * says nothing about the node except *draw it here too*, it carries no prose of
 * its own, and the node's page already answers "where else is this drawn"
 * through {@link Derived.mirrorsOf} — which `outlines_read` hands back as
 * `mirrors`. Listing placements as references would put one fact under two
 * names, and would fill the section on exactly the nodes a curated list points
 * at with entries that say nothing about them.
 *
 * **`after` and `blocks` do not count either.** They are the ORDERING graph,
 * and a page already draws both directions of it: what this node is waiting on
 * ({@link Derived.blocked}, the `blocked by` row) and what it declares for
 * itself (the `after` row). Collecting the other end here would say the same
 * edge a second time on the same page, under a word that means something else.
 *
 * ## Three rules it inherits rather than invents
 *
 * **A reference to a PLACEMENT of this node is a reference to this node.** A
 * `see` naming a mirror of `herbs` draws the herb bed's title and opens the
 * herb bed's page ({@link nodeNamed}, which every forward reader resolves
 * through), so the reverse reading has to agree — the ids asked about are this
 * node's and every mirror standing for it.
 *
 * **A record never refers to itself, and neither does a document.** A node
 * whose note says `@` its own id is talking about the page it is on, and a
 * `see` onto one of its own placements is the same sentence through a mirror;
 * a document whose prose links itself is a file pointing at its own page.
 *
 * **What is put away is on the Trash and nowhere else** (#226). A referrer
 * written in an `_olai/Trash.olai` is left out, the same way it is left out of
 * search, of the agenda and of blockedness — and there is no `is:trashed` to
 * say otherwise at this door, because a section is not a query.
 */

import { Schema } from "effect"

import { type Address, addressOf, DocumentPath } from "./address.ts"
import { byCorpus, tagText, type Derived } from "./derive.ts"
import { Face, type FaceHead } from "./document.ts"
import { isPutAway, isRegular, LocatedRegular } from "./node.ts"
import { byPath } from "./paths.ts"
import { type Pointing, pointingAt, type Source } from "./pointing.ts"
import type { Reading } from "./validate.ts"

/**
 * How one record refers to another: an edge somebody wrote with `outlines_see`, or a
 * word in a sentence.
 *
 * IN THE ORDER A REFERRER SAYS THEM — the edge first, because it is the claim
 * somebody made on purpose with a verb, and the prose after it — so two
 * referrers doing the same two things say them the same way round. One list, so
 * the order and the closure cannot be two facts.
 *
 * THE LINK WAY is the newest: a link in a record's note — or a body's own
 * prose — onto a node, a heading or a document is a reference to what it lands
 * on, and this way is how the references reading says so. The ways exist so a
 * row can tell "this record wrote an edge" from "this record named the node in
 * prose" from "this file links to the page".
 *
 * A SCHEMA beside it, and the wire vocabulary READS that one ({@link
 * ./reading.ts}`s `Reference` — the arrangement `Progress` already has with
 * that module). The list is closed by the rulings in this file's header, so it
 * belongs beside them; a second `Schema.Literals(["see", "mention", "link"])`
 * on the answer would be that closure respelled where nothing argues it, free
 * to gain a fourth member on one side only.
 *
 * THE LIST ITSELF lives in ./imports.ts now, READ rather than re-declared:
 * the fold files under the same ways this schema spells, so the words are
 * one fact — the list here was the second copy and both headers used to
 * argue the other was wrong.
 */
import { WAYS } from "./imports.ts"
export const Way = Schema.Literals(WAYS)
export type Way = typeof Way.Type

/**
 * ONE PLACE A REFERENCE WAS WRITTEN — a whole document, or one record inside
 * one — and the ways that place says the target.
 *
 * The two arms are the two kinds of thing that can hold a reference, and the
 * difference is real rather than a convenience: a `.md` writes a link in its
 * prose and has no record to attribute it to, while an outline's reference is
 * always SOME record's — the node that wrote the `see`, put the link in its
 * note, or wrote the `@id` in its title. Saying "house.olai points here" where
 * the honest answer is "the node `kitchen` links it" would be the coarser
 * answer offered because it was the easier one.
 *
 * THE ONE WIRE SHAPE: the node page's backlinks and the document page's
 * referrers used to be two schemas (`Backlink`, `Referrer`) for one question,
 * and every consumer had to know which door it was standing at. They are this
 * now, whichever page asked.
 *
 * ONE ENTRY PER SOURCE, so a record that both `see`s this node, names it in a
 * note and links it is one reference with three ways. The ways come in
 * {@link WAYS} order rather than in the order they were discovered.
 */
export const Reference = Schema.Struct({
  /** The referring record, or the document whose body wrote it. Always a
   *  REGULAR node when it is a record — a mirror can carry neither an edge nor
   *  prose, so no entry ever names one. A document source is its {@link FaceHead}
   *  — the path and title the rows draw — never the full face, whose body-only
   *  halves (`links`, `tags`, `props`) no consumer of this wire reads. */
  source: Schema.Union([LocatedRegular, Schema.Struct({ path: DocumentPath, title: Schema.String })]),
  ways: Schema.Array(Way),
})
export type Reference = typeof Reference.Type

/** The answer for a place nothing refers to, which is most of them: ONE list,
 *  shared, for {@link targetsOf}'s reason — a page asks this per frame. */
const NOTHING_REFERS: ReadonlyArray<Reference> = []

/**
 * THE ONE READING: everything that refers to an address, in path order, as
 * {@link Reference}s — the node page's backlinks, the document page's
 * referrers, and `outlines_read`'s `referencedBy` alike.
 *
 * A LOOKUP rather than a walk: two index reads for a document address, and a
 * handful per node (one per id the node answers to, times the two keyspaces —
 * the node's own and the `@` prose half). Nothing here scans the corpus, which
 * is what lets a page ask it on every frame the store publishes.
 *
 * THE NODE ARM reads the pointing index under `#<id>` and `@<id>` for the node
 * and every placement standing for it — the sees, the links and the mentions
 * all file there at the fold ({@link ./imports.ts}). The derivation's own
 * reverse indexes built the same answers and are read by other doors
 * (`namedBy` by the refusal that asks "does anything point at this record",
 * `taggedBy` by the tag vocabulary); nothing about the two of them is spelled
 * again here.
 *
 * AN ID NOTHING CLAIMS HAS NO REFERRERS, and that line is the whole of where
 * the existence question is asked. `@alice` files under `@alice` whether or not
 * anybody is called that, so without this the tag would be a reference to a
 * node that is not there — and a caller asking about a node it has in hand
 * pays one map read for it.
 *
 * THE DOCUMENT, HEADING AND ROW ARMS are one index key: {@link ./pointing.ts}
 * files a link onto a heading or a row under BOTH the element and the document,
 * so asking about a document is a lookup under its path and asking about a
 * heading or a row is a lookup under the exact key — the page that draws one
 * normalises to the whole document first (`./page.ts`'s `shownOf`), which is
 * why the two answers cannot drift.
 */
export const referencesOf = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  address: Address,
): ReadonlyArray<Reference> => {
  if (address.kind === "node") return nodeRefs(at, address.id)
  return documentRefs(at, address)
}

/**
 * The node arm: every source under the node's own ids — `#<id>`, `@<id>`, and
 * the same pair for every placement standing for it — gathered, merged by
 * source, and ruled.
 *
 * The ways are the INDEX's own: the fold files a `see` under the id it names,
 * a link from a note or a body's prose under the id it links, and a `@id`
 * prose half — so a source that both sees and mentions the node carries both
 * ways when its two keys are merged here.
 */
const nodeRefs = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  id: string,
): ReadonlyArray<Reference> => {
  const { derived, pointing } = at
  // AN ID NOTHING CLAIMS HAS NO REFERRERS — see {@link referencesOf}.
  if (!derived.byId.has(id)) return NOTHING_REFERS
  /** Per source — the record object, or the face for a body — the ways it
   *  says the node. Keyed by object identity; a Map is the identity hash. */
  const found = new Map<object, Reference>()

  const file = (source: Source): void => {
    // A record never refers to ITSELF: a node whose note says `@` its own id
    // is talking about the page it is on, and a `see` onto one of its own
    // placements is the same sentence through a mirror. What is put away is
    // on the Trash and nowhere else.
    if (isPutAway(derived.claims, source.face.path)) return
    if (source.at !== undefined) {
      if (source.at.node.id === id || !isRegular(source.at)) return
    }
    const key: object = source.at ?? source.face
    const held = found.get(key)
    if (held === undefined) {
      found.set(key, { source: source.at ?? headOf(source.face), ways: source.ways })
      return
    }
    // THE SAME SOURCE THROUGH TWO KEYS (`#id` and `@id`): the ways merge, in
    // {@link WAYS} order, however many keys the source answered through.
    const merged = WAYS.filter((one) => held.ways.includes(one) || source.ways.includes(one))
    if (merged.length !== held.ways.length) found.set(key, { source: held.source, ways: merged })
  }
  // THIS NODE, AND EVERY PLACEMENT STANDING FOR IT — the ids a forward reader
  // resolves through, read backwards. The fold files under `#<id>` the sees
  // and links, and under `@<id>` the mentions.
  for (const named of [id, ...(derived.mirrorsOf.get(id) ?? [])]) {
    const node = addressOf(at.claims, null, named)
    if (node === null) continue
    for (const source of pointingAt(pointing, node)) file(source)
    for (const source of pointing.get(tagText({ sigil: "@", tag: named })) ?? []) file(source)
  }
  return [...found.values()]
    // Sorted rather than merged: the index promises path order per key, and
    // the node arm reads up to four keys per placement. A referrer count is a
    // handful.
    .sort(byReference)
}

/**
 * The document, heading and row arms: everything under the address's own key,
 * with the face-level rulings.
 */
const documentRefs = (
  at: Pick<Reading, "claims" | "derived" | "pointing">,
  address: Exclude<Address, { readonly kind: "node" }>,
): ReadonlyArray<Reference> => {
  const sources = pointingAt(at.pointing, address)
  if (sources.length === 0) return NOTHING_REFERS
  const found: Array<Reference> = []
  for (const source of sources) {
    // The document this page is about never refers to itself, and what is put
    // away is on the Trash and nowhere else.
    if (source.face.path === address.path || isPutAway(at.derived.claims, source.face.path)) continue
    if (source.at !== undefined && !isRegular(source.at)) continue
    found.push({ source: source.at ?? headOf(source.face), ways: source.ways })
  }
  return found.length === 0 ? NOTHING_REFERS : found
}

/** Path order over two references: by file, and by CORPUS ORDER within a file —
 *  the promise {@link byCorpus} makes, with a BODY's entry ordered ahead of the
 *  file's records: the body IS the file, so its entry is the FILE's. The file
 *  half is {@link byPath} — the same order the directory is read in — so a
 *  `wing.olai` and a `wing/held.olai` cannot come out in the wrong-< order.
 *  Two files can never tie, which is {@link byPath}'s promise. */
const byReference = (one: Reference, other: Reference): number => {
  const side = byPath(pathOf(one.source), pathOf(other.source))
  if (side !== 0) return side
  const oneRecord = "file" in one.source
  const otherRecord = "file" in other.source
  if (oneRecord !== otherRecord) return oneRecord ? 1 : -1
  if (!oneRecord) return 0
  return byCorpus(one.source as LocatedRegular, other.source as LocatedRegular)
}

const pathOf = (source: LocatedRegular | FaceHead): string =>
  "path" in source ? source.path : source.file

/** A document source's head — the path and title a reference row draws. */
const headOf = (face: Face): FaceHead => ({ path: face.path, title: face.title })