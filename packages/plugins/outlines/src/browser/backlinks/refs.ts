/**
 * What refers to a node, resolved for drawing: the referrers, split by the way
 * they refer, each as a link a row can draw.
 *
 * The SPLIT is what this module is. `@olai/format`'s `referencesOf` answers one
 * list — the ONE reading every page that asks "who refers" uses — of
 * references with the ways each of them refers, because a record that both
 * points at this node and names it in a note is one reference; a `NodeRefs`
 * row is about ONE way and keys its links by target id, so a reference
 * appearing in both rows is two links under one key in two lists rather than a
 * duplicate in one. Same reading, two shapes, and the arithmetic between them
 * lives here rather than inside a component's JSX.
 *
 * A NEW KIND OF SOURCE came with the one reading: a BODY. A `.md` whose prose
 * links this node is as much a reference as a record's `see` is, and it has no
 * record to attribute it to — the source IS the face. The records still draw
 * as node links; a body has no node link of its own, so the shape of the row
 * below is the one the reading gives: the file it came from.
 *
 * THE SHAPING IS SEPARATE FROM THE ANSWER, and that is what makes a shut
 * section cost nothing: the referrers themselves ride on the page's reading (a
 * count is all the summary needs), and {@link rowsOf} is what the ROWS need. A
 * `<details>` renders its children whether or not it is open, so building the
 * rows eagerly would mint a `NodeRef` per referrer and an anchor per `NodeRef`
 * on every frame the server publishes — on exactly the hub node this feature
 * exists for, several hundred of each, none of them on screen. The component
 * calls this inside the `<Show>` that the reader's own toggle opens.
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
 * appears once. Here that is `referencesOf`'s own once-per-source rule — it
 * collects into a map keyed by the referring record or face, so a node that
 * both points at this one and names it in prose is one reference with two ways
 * rather than two entries — and each row below keeps whichever of those
 * entries claims its way. The rule is the format's (`backlinks.test.ts` pins
 * it); what is said here is that this row is spending it.
 */

import type { Reference, Way } from "@olai/format"

import { type NodeRef, refOf } from "../ref.ts"

/** A row for a BODY source: the file whose prose wrote the reference — the
 *  same shape the document page's referrers draw, so the two sections render
 *  one kind of row. */
export interface DocRef {
  readonly kind: "doc"
  readonly path: string
}

/** The rows the referrers are drawn as, once somebody has opened the section.
 *
 *  WHO REFERS is not worked out here any more: it rides on the node page's own
 *  reading, computed by the same `referencesOf` over the set the server holds
 *  (`@olai/format`'s `page.ts`). What is left in this module is the shaping —
 *  one row per WAY, which is a fact about how the section is drawn. */
export const rowsOf = (
  found: ReadonlyArray<Reference>,
): Record<Way, ReadonlyArray<NodeRef | DocRef>> => ({
  see: refsOf(found, "see"),
  mention: refsOf(found, "mention"),
  link: refsOf(found, "link"),
})

const refsOf = (found: ReadonlyArray<Reference>, way: Way): ReadonlyArray<NodeRef | DocRef> =>
  found.flatMap((one): ReadonlyArray<NodeRef | DocRef> => (one.ways.includes(way)
    ? ("path" in one.source ? [{ kind: "doc", path: one.source.path }] : [refOf(one.source)])
    : []))