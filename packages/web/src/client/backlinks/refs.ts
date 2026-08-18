/**
 * What refers to a node, resolved for drawing: the referrers, split by the way
 * they refer, each as a link a row can draw.
 *
 * The SPLIT is what this module is. `@olai/format`'s `backlinksOf` answers one
 * list of records with the ways each of them refers, because a record that both
 * points at this node and names it in a note is one record; a `NodeRefs` row is
 * about ONE relation and keys its links by target id, so a record appearing in
 * both rows is two links under one key in two lists rather than a duplicate in
 * one. Same reading, two shapes, and the arithmetic between them lives here
 * rather than inside a component's JSX.
 *
 * NOTHING IS RESOLVED THAT THE READING DID NOT ALREADY HAVE. A `see` row
 * resolves its target ids through `nodeNamed` (`../edges/named.ts`) because the
 * FIELD holds ids; this list is already records, so the title and the file are
 * read straight off them and there is nothing here that could disagree with the
 * page a link opens.
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

import type { NodeRef } from "../NodeRefs.tsx"

/** The whole section's contents: one reading, drawn as two rows and counted
 *  once. `total` is the RECORDS, not the links — a node that refers twice is
 *  one thing referring, and the summary says how many things. */
export interface Referrers {
  readonly total: number
  readonly sees: ReadonlyArray<NodeRef>
  readonly mentions: ReadonlyArray<NodeRef>
}

/** The empty answer, shared: most nodes have no referrers, and this is asked
 *  per node per frame the store publishes. */
const NOTHING: Referrers = { total: 0, sees: [], mentions: [] }

export const referrersOf = (
  derived: Derived | undefined,
  id: string,
): Referrers => {
  // A first frame has no indexes yet and nothing that needs them is drawn
  // (`../derived.tsx`), so this answers empty rather than waiting.
  if (derived === undefined) return NOTHING
  const found = backlinksOf(derived, id)
  if (found.length === 0) return NOTHING
  return {
    total: found.length,
    sees: refsOf(found, "see"),
    mentions: refsOf(found, "mention"),
  }
}

const refsOf = (found: ReadonlyArray<Backlink>, way: Way): ReadonlyArray<NodeRef> =>
  found.flatMap((one) =>
    one.ways.includes(way)
      ? [{ id: one.at.node.id, title: one.at.node.title, from: one.at.file }]
      : []
  )
