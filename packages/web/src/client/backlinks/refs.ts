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
 * A ROW PER `Way`, keyed by the format's own closed list rather than one field
 * per way: two fields carry a presence rule nothing enforces ("if a referrer
 * says `see` then `sees` holds it"), and a third way added where the rulings
 * live would type-check clean past a struct that had no field for it. The
 * record makes both mechanical, and `./way.ts` — total over the same list — is
 * what turns it into rows on screen.
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

/** The whole section's contents: a row per way, and the count over all of them.
 *  `total` is the RECORDS, not the links — a node that refers twice is one
 *  thing referring, and the summary says how many things. */
export interface Referrers {
  readonly total: number
  readonly rows: Record<Way, ReadonlyArray<NodeRef>>
}

/**
 * A row per way, as a `Record<Way, …>` LITERAL rather than a fold over
 * {@link WAYS}.
 *
 * The literal is what the compiler checks: a third way added where the rulings
 * live (`format/src/backlinks.ts`) is an error HERE, at the one place that
 * would otherwise have gone on answering two rows out of three. A
 * `fromEntries` over the list reads tidier and hands back a `{[k: string]: …}`
 * that only a cast can turn into this type — which is the check deleted and the
 * exhaustiveness put back as a promise.
 */
const rowsOf = (
  of: (way: Way) => ReadonlyArray<NodeRef>,
): Record<Way, ReadonlyArray<NodeRef>> => ({ see: of("see"), mention: of("mention") })

/** The empty answer, shared: most nodes have no referrers, and this is asked
 *  per node per frame the store publishes. */
const NOTHING: Referrers = { total: 0, rows: rowsOf(() => []) }

export const referrersOf = (
  derived: Derived | undefined,
  id: string,
): Referrers => {
  // A first frame has no indexes yet and nothing that needs them is drawn
  // (`../derived.tsx`), so this answers empty rather than waiting.
  if (derived === undefined) return NOTHING
  const found = backlinksOf(derived, id)
  if (found.length === 0) return NOTHING
  return { total: found.length, rows: rowsOf((way) => refsOf(found, way)) }
}

const refsOf = (found: ReadonlyArray<Backlink>, way: Way): ReadonlyArray<NodeRef> =>
  found.flatMap((one) =>
    one.ways.includes(way)
      ? [{ id: one.at.node.id, title: one.at.node.title, from: one.at.file }]
      : []
  )
