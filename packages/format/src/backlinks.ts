/**
 * What refers to a node, read out of the indexes that were built forwards.
 *
 * Every reference in this format points ONE way on disk. A node writes
 * `see: ["herbs"]`, or writes `@herbs` in its title or its note, and the herb
 * bed's own record says nothing about either — so "who is talking about this?"
 * was a question nothing could answer without walking the whole directory, and
 * nothing asked it.
 *
 * The two reverse indexes {@link ./derive.ts} keeps are what makes it a lookup:
 * {@link Derived.namedBy} carries what records SAY with their fields (`see`
 * among them) and {@link Derived.taggedBy} carries what their prose tagged.
 * This module is the READING over the pair — which is where every question that
 * is about MEANING rather than about storage is asked, and there are four of
 * them.
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
 * references ({@link Derived.taggedBy}).
 *
 * **A `#topic` never counts, whatever it spells.** The index behind this reads
 * both sigils, under keys that keep them, so a set with a node called `herbs`
 * and a `#herbs` topic written across a dozen titles has two things there and
 * this section draws one of them. Sigil-stripped keys would have made that
 * ambiguity unreachable rather than decided.
 *
 * **A MIRROR DOES NOT COUNT, and that is the ruling this file was asked to
 * make.** A placement is a VIEW of a node, not a reference to one: the record
 * says nothing about the node except *draw it here too*, it carries no prose of
 * its own, and the node's page already answers "where else is this drawn"
 * through {@link Derived.mirrorsOf} — which `read_node` hands back as
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
 * ## Two rules it inherits rather than invents
 *
 * **A reference to a PLACEMENT of this node is a reference to this node.** A
 * `see` naming a mirror of `herbs` draws the herb bed's title and opens the
 * herb bed's page ({@link nodeNamed}, which every forward reader resolves
 * through), so the reverse reading has to agree — the ids asked about are this
 * node's and every mirror standing for it.
 *
 * **What is put away is on the Trash and nowhere else** (#226). A referrer
 * written in an `Archive.olai` is left out, the same way it is left out of
 * search, of the agenda and of blockedness — and there is no `is:archived` to
 * say otherwise at this door, because a section is not a query.
 */

import { Schema } from "effect"

import { type Address, printAddress } from "./address.ts"
import { byCorpus, type Derived, tagText } from "./derive.ts"
import type { Face } from "./document.ts"
import { recordLinks } from "./documents.ts"
import { isArchived, isRegular, type Located, type LocatedRegular } from "./node.ts"

/**
 * How one record refers to another: an edge somebody wrote with `set_see`, or a
 * word in a sentence.
 *
 * IN THE ORDER A REFERRER SAYS THEM — the edge first, because it is the claim
 * somebody made on purpose with a verb, and the prose after it — so two
 * referrers doing the same two things say them the same way round. One list, so
 * the order and the closure cannot be two facts.
 *
 * A SCHEMA beside it, and the wire vocabulary READS that one ({@link
 * ./reading.ts}'s `Reference`) — the arrangement `Progress` already has with
 * that module. The list is closed by the rulings in this file's header, so it
 * belongs beside them; a second `Schema.Literals(["see", "mention"])` on the
 * answer would be that closure respelled where nothing argues it, free to gain
 * a third member on one side only.
 */
export const WAYS = ["see", "mention"] as const
export const Way = Schema.Literals(WAYS)
export type Way = typeof Way.Type

/**
 * One record that refers to a node, and the ways it does.
 *
 * ONE ENTRY PER RECORD, so a node that both `see`s this one and names it in its
 * note is one referrer with two ways — {@link Naming}'s rule, and for its
 * reason: what asks this wants to know which records to draw.
 *
 * The ways come in {@link WAYS} order rather than in the order they were
 * discovered.
 */
export interface Backlink {
  /** The referring record — always a REGULAR node, since a mirror can carry
   *  neither an edge nor prose. */
  readonly at: LocatedRegular
  readonly ways: ReadonlyArray<Way>
}

/** The answer for a node nobody talks about, which is most of them: ONE list,
 *  shared, for {@link targetsOf}'s reason — a page asks this per frame. */
const NOTHING_REFERS: ReadonlyArray<Backlink> = []

/** How prose NAMES the node called `id` — the key {@link Derived.taggedBy}
 *  files that under, spelled through the format's own {@link tagText} so this
 *  reading cannot come to disagree with the fold about what an `@` tag looks
 *  like written down. */
const mentioned = (id: string): string => tagText({ sigil: "@", tag: id })

/**
 * Everything that refers to `id`, in corpus order.
 *
 * A LOOKUP rather than a walk: two index reads per id this node answers to,
 * which is one plus however many placements it has. Nothing here scans the
 * corpus, which is what lets a page ask it on every frame the store publishes.
 *
 * AN ID NOTHING CLAIMS HAS NO REFERRERS, and that line is the whole of where
 * the existence question is asked. `@alice` files under `@alice` whether or not
 * anybody is called that ({@link Derived.taggedBy}), so without this the tag
 * would be a reference to a node that is not there — and a caller asking about
 * a node it has in hand pays one map read for it.
 *
 * THE `@` HALF OF THAT INDEX AND NOTHING ELSE, which is what {@link mentioned}
 * spells: the index files both sigils under keys that carry them, and a
 * `#herbs` is a topic somebody wrote rather than a sentence about the node
 * called `herbs`. Prose refers to a node by NAMING it, and `@` is how this
 * format names one.
 */
export const backlinksOf = (derived: Derived, id: string): ReadonlyArray<Backlink> => {
  if (!derived.byId.has(id)) return NOTHING_REFERS
  const found = new Map<LocatedRegular, Set<Way>>()
  const file = (at: Located, way: Way): void => {
    // A record never refers to ITSELF: a node whose note says `@` its own id is
    // talking about the page it is on, and a `see` onto one of its own
    // placements is the same sentence through a mirror.
    if (at.node.id === id || isArchived(at.file)) return
    // A REFERRER IS A REGULAR NODE. `taggedBy` says so in its TYPE, so this
    // is asked only of the naming side, where `Located` is honest because
    // `mirror` is one of the fields that index files — and asked through the
    // format’s own guard, so this narrows the way every other consumer does.
    // It can never drop a `see`: a mirror carries no edge fields.
    if (!isRegular(at)) return
    const ways = found.get(at)
    if (ways === undefined) found.set(at, new Set([way]))
    else ways.add(way)
  }

  // This node, and every placement standing for it — the ids a forward reader
  // resolves through, read backwards.
  for (const named of [id, ...(derived.mirrorsOf.get(id) ?? [])]) {
    for (const naming of derived.namedBy.get(named) ?? []) {
      if (naming.fields.includes("see")) file(naming.at, "see")
    }
    for (const at of derived.taggedBy.get(mentioned(named)) ?? []) file(at, "mention")
  }

  if (found.size === 0) return NOTHING_REFERS
  return [...found]
    .map(([at, ways]): Backlink => ({ at, ways: WAYS.filter((way) => ways.has(way)) }))
    // Sorted rather than merged: both indexes promise corpus order on their
    // own, but this reads up to two of them per placement and the union of
    // several ordered lists is not one. A referrer count is a handful.
    .sort((one, other) => byCorpus(one.at, other.at))
}

// ── what points at an address ──────────────────────────────────────────

/**
 * ONE PLACE A REFERENCE WAS WRITTEN — a whole document, or one record inside
 * one.
 *
 * The two arms are the two kinds of thing that can hold a link, and the
 * difference is real rather than a convenience: a `.md` writes a link in its
 * prose and has no record to attribute it to, while an outline's link is
 * always SOME record's — the node that attached the document, wrote the `see`,
 * or put the link in its note. Saying "house.olai points here" where the honest
 * answer is "the node `kitchen` attaches it" would be the coarser answer
 * offered because it was the easier one.
 */
export interface Referrer {
  /** The document the reference is written in — what it is called and where it
   *  is, which is what a row draws. */
  readonly face: Face
  /** The RECORD that wrote it, for an outline. Absent for a document's body,
   *  which has no records. */
  readonly at?: LocatedRegular
}

/**
 * WHO POINTS AT AN ADDRESS — every document's forward `links`, read backwards.
 *
 * This is the half of the design that made a document's page possible to write
 * at all. A `doc` attachment, a `see`, a link in a note and a link in a body
 * all point ONE WAY on disk, so "what is talking about this document?" was a
 * question nothing could answer without walking the whole directory, and
 * nothing asked it. The faces answer it now, because every document carries the
 * addresses it points at and a face is small enough to travel
 * ({@link ./document.ts}).
 *
 * A LOOKUP OVER THE FACES and then a walk of ONE FILE: a face says whether its
 * document points here at all, and only for the outlines that do are the
 * records asked which of them wrote it — through {@link recordLinks}, the same
 * function that built the face, so the two cannot come to disagree about
 * whether a record points somewhere.
 *
 * WHAT IS PUT AWAY IS ON THE TRASH AND NOWHERE ELSE (#226), which is this
 * module's standing rule read once more: a referrer written in an
 * `Archive.olai` is left out, the same way it is left out of search, of the
 * agenda and of blockedness.
 *
 * A LINK ONTO A HEADING POINTS AT THE DOCUMENT, which is the one place this
 * reading is not a string comparison. `[the scope](brief.md#scope)` is a
 * reference to `brief.md` — the reader who opens that file is who wants to
 * know — and a page that showed it only under the heading would answer half the
 * question and hide the other half. The reverse does not hold: asking about the
 * heading is asking about the heading.
 *
 * A DOCUMENT DOES NOT REFER TO ITSELF, and that is one line rather than a
 * caller's job: a `.md` whose own body links a heading of itself is talking
 * about the page it is on.
 */
export const referrersTo = (
  address: Address,
  faces: ReadonlyArray<Face>,
  /** The records, for attributing an outline's link to the one that wrote it.
   *  `byFile` is the index that makes it a lookup rather than a corpus walk. */
  derived: Pick<Derived, "byFile">,
): ReadonlyArray<Referrer> => {
  // WRITTEN and compared, because a canonical spelling is what the grammar
  // promises: two addresses that name one place print one string, so nothing
  // here has to know how the arms are shaped.
  const wanted = printAddress(address)
  const here = address.kind === "node" ? null : address.path
  const points = (link: Address): boolean =>
    printAddress(link) === wanted ||
    (address.kind === "document" && link.kind === "heading" && link.path === address.path)
  const found: Array<Referrer> = []
  for (const face of faces) {
    if (face.path === here || isArchived(face.path)) continue
    if (!face.links.some(points)) continue
    const records = derived.byFile.get(face.path)
    // A face with no records behind it is a BODY — the link is the document's
    // own, and there is nothing finer to name.
    if (records === undefined) {
      found.push({ face })
      continue
    }
    for (const located of records) {
      if (!isRegular(located)) continue
      if (!recordLinks(located).some(points)) continue
      found.push({ face, at: located })
    }
  }
  return found
}
