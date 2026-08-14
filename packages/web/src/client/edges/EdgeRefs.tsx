/**
 * ONE of a node's edges, drawn out: the targets it names, as links, with the
 * `×` that drops one when the surface offers it.
 *
 * It was two components — `SeeRefs.tsx` beside the tree, and an `AfterRefs.tsx`
 * written by copying it — and the two were the same twenty lines with one word
 * changed: read the field, resolve each id to a title by the format's own rule
 * (`nodeNamed`, which follows a mirror to the node standing at it), draw a
 * labelled row. Worse than the copy was what the copy FRAGMENTED: the row's
 * label and its testid are facts about a RELATION, they already lived in
 * `./relation.ts`, and each component spelled its own — so renaming `see` in
 * the table would have left both components saying the old word, with
 * everything still compiling.
 *
 * So the relation arrives as a value and the words come out of the one table.
 * A third writable edge field would be a row there and nothing here.
 *
 * WHAT IS RESOLVED AT VIEW TIME, and why: nothing about a target is stored on
 * the source, so a retitle on the target is free and a link cannot disagree with
 * the page it opens. A set under the stale banner can hold a dangling id the
 * validator would refuse; the link is still drawn, with the id as its text
 * rather than a blank, so the page says what the file says.
 *
 * ## Where each relation is drawn, which is not the same place
 *
 * `see` is drawn wherever a node is (`../NodeBody.tsx`): a tree row's expanded
 * note, a day entry, the node's own page. `after` is drawn only where a node is
 * READ in full — its own page — for `../Blocked.tsx`'s reason: a tree row is a
 * title in a column of titles, and what it can afford about its dependencies is
 * the dim and the mark column's glyph.
 *
 * ## And it is not `../Blocked.tsx`, which draws `after` too
 *
 * Two different claims, and only one is writable. `blocked by` is DERIVED
 * (`@olai/format`'s `blocked` index): what is IN THE WAY right now — unfinished
 * work only, with `a blocks b` folded in from the other record and both ends
 * resolved through mirrors. Half of what it draws may live on somebody ELSE's
 * record, and a finished blocker is not in it at all, so there is no single edge
 * an `×` there would name. This row is the FIELD: what this node declares,
 * exactly as written, which is precisely what `set_after` writes.
 */

import { nodeNamed, type RegularNode } from "@olai/format"
import { createMemo } from "solid-js"

import { useDerived } from "../derived.tsx"
import { NodeRefs } from "../NodeRefs.tsx"
import { type Relation, relating } from "./relation.ts"

export function EdgeRefs(props: {
  /** The regular node being shown — for a mirror, the node it stands for,
   *  since a placement carries no edges of its own. */
  readonly node: RegularNode
  readonly relation: Relation
  /** Drop one of them — the removal half of `set_see` / `set_after`, drawn as
   *  an `×` per link (`../NodeRefs.tsx`). ABSENT is read-only, which is what a
   *  day page and the agenda pass: they draw a node they do not offer to
   *  change, the rule a title's own `onEdit` already follows. */
  readonly onRemove?: (id: string) => void
}) {
  const derived = useDerived()

  const refs = createMemo(() => {
    // BEFORE the indexes are read, so a node carrying nothing on this field —
    // almost every node — never subscribes to the whole set and never re-runs
    // on a frame that cannot concern it.
    const named = props.node[props.relation]
    if (named === undefined || named.length === 0) return []
    const indexes = derived()
    if (indexes === undefined) return []
    return named.map((id) => {
      const at = nodeNamed(indexes, id)
      return {
        id,
        title: at?.node.title ?? id,
        // from "" when dangling: the title is the id, not outline prose.
        from: at?.file ?? "",
      }
    })
  })

  return (
    <NodeRefs
      label={relating(props.relation).label}
      refs={refs()}
      testid={relating(props.relation).refs}
      onRemove={props.onRemove}
    />
  )
}
