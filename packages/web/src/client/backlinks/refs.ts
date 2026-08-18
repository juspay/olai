/**
 * What refers to a node, resolved for drawing: the referrers, split by the way
 * they refer, each as a link a row can draw.
 *
 * The SPLIT is what this module is. `@olai/format`'s `backlinksOf` answers one
 * list of records with the ways each of them refers, because a record that both
 * points at this node and names it in a note is one record; a `NodeRefs` row is
 * about ONE way and keys its links by target id, so a record appearing in both
 * rows is two links under one key in two lists rather than a duplicate in one.
 * Same reading, two shapes, and the arithmetic between them lives here rather
 * than inside a component's JSX.
 *
 * TWO FUNCTIONS RATHER THAN ONE ANSWER, and that is what makes a shut section
 * cost nothing: {@link referringTo} is what the summary needs (a count), and
 * {@link rowsOf} is what the rows need. A `<details>` renders its children
 * whether or not it is open, so a single call answering both would build a
 * `NodeRef` per referrer and an anchor per `NodeRef` on every frame the store
 * publishes — on exactly the hub node this feature exists for, several hundred
 * of each, none of them on screen. The component calls the second inside the
 * `<Show>` that the reader's own toggle opens.
 *
 * A ROW PER `Way`, keyed by the format's own closed list rather than one field
 * per way: two fields carry a presence rule nothing enforces ("if a referrer
 * says `see` then `sees` holds it"), and a third way added where the rulings
 * live would type-check clean past a struct that had no field for it. The
 * `Record<Way, …>` LITERAL is what the compiler checks — a `fromEntries` fold
 * over the list reads tidier and hands back a `{[k: string]: …}` that only a
 * cast turns into this type, which is the check deleted and put back as a
 * promise. `./way.ts`, total over the same list, is what turns it into rows.
 *
 * NOTHING IS RESOLVED THAT THE READING DID NOT ALREADY HAVE. A `see` row
 * resolves its target ids through `nodeNamed` (`../edges/named.ts`) because the
 * FIELD holds ids; this list is already records, so `refOf` reads the title and
 * the file straight off them and there is nothing here that could disagree with
 * the page a link opens.
 *
 * AND WHAT MAKES THE KEY HONEST is named rather than inherited, because it is
 * the promise `../NodeRefs.tsx` demands and the one that took a page down when
 * a neighbouring row broke it (PR #202): a refs row draws a link per target
 * KEYED BY THE TARGET'S ID, and a key names a row only while each target
 * appears once. Here that is `backlinksOf`'s own once-per-record rule — it
 * collects into a map keyed by the referring RECORD, so a node that both points
 * at this one and names it in prose is one entry with two ways rather than two
 * entries — and each row below keeps whichever of those entries claims its way.
 * The rule is the format's (`backlinks.test.ts` pins it); what is said here is
 * that this row is spending it.
 */

import { type Backlink, backlinksOf, type Derived, type Way } from "@olai/format"

import { type NodeRef, refOf } from "../ref.ts"

/** The referrers of one node, or nothing at all. A first frame has no indexes
 *  yet and nothing that needs them is drawn (`../derived.tsx`), so this answers
 *  empty rather than waiting. */
export const referringTo = (
  derived: Derived | undefined,
  id: string,
): ReadonlyArray<Backlink> => (derived === undefined ? NOTHING : backlinksOf(derived, id))

const NOTHING: ReadonlyArray<Backlink> = []

/** ...and the rows they are drawn as, once somebody has opened the section. */
export const rowsOf = (
  found: ReadonlyArray<Backlink>,
): Record<Way, ReadonlyArray<NodeRef>> => ({
  see: refsOf(found, "see"),
  mention: refsOf(found, "mention"),
})

const refsOf = (found: ReadonlyArray<Backlink>, way: Way): ReadonlyArray<NodeRef> =>
  found.flatMap((one) => (one.ways.includes(way) ? [refOf(one.at)] : []))
