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
 * among them) and {@link Derived.mentionedBy} carries what their prose says.
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
 * references ({@link Derived.mentionedBy}).
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

import { byCorpus, type Derived } from "./derive.ts"
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

/**
 * Everything that refers to `id`, in corpus order.
 *
 * A LOOKUP rather than a walk: two index reads per id this node answers to,
 * which is one plus however many placements it has. Nothing here scans the
 * corpus, which is what lets a page ask it on every frame the store publishes.
 *
 * AN ID NOTHING CLAIMS HAS NO REFERRERS, and that line is the whole of where
 * the existence question is asked. `@alice` files under `alice` whether or not
 * anybody is called that ({@link Derived.mentionedBy}), so without this the
 * word would be a reference to a node that is not there — and a caller asking
 * about a node it has in hand pays one map read for it.
 */
export const backlinksOf = (derived: Derived, id: string): ReadonlyArray<Backlink> => {
  if (!derived.byId.has(id)) return NOTHING_REFERS
  const found = new Map<LocatedRegular, Set<Way>>()
  const file = (at: Located, way: Way): void => {
    // A record never refers to ITSELF: a node whose note says `@` its own id is
    // talking about the page it is on, and a `see` onto one of its own
    // placements is the same sentence through a mirror.
    if (at.node.id === id || isArchived(at.file)) return
    // A REFERRER IS A REGULAR NODE, asked rather than asserted — through the
    // format’s own guard (`isRegular`), so this narrows the way every other
    // consumer does. Both indexes answer it already (a mirror carries no edge
    // fields and no prose), so it can never drop anything; a cast leaning on
    // that would be a claim about two other modules held in a comment.
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
    for (const at of derived.mentionedBy.get(named) ?? []) file(at, "mention")
  }

  if (found.size === 0) return NOTHING_REFERS
  return [...found]
    .map(([at, ways]): Backlink => ({ at, ways: WAYS.filter((way) => ways.has(way)) }))
    // Sorted rather than merged: both indexes promise corpus order on their
    // own, but this reads up to two of them per placement and the union of
    // several ordered lists is not one. A referrer count is a handful.
    .sort((one, other) => byCorpus(one.at, other.at))
}
