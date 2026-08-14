/**
 * What a node itself SAYS it comes after — its own `after` list, drawn out.
 *
 * `../SeeRefs.tsx` over the other field, and the same three lines of it: the
 * format stores target ids, the link text is each target's title resolved at
 * view time by the format's own rule for what an id names (`nodeNamed`, which
 * follows a mirror), and a dangling id keeps the id as its text so the page
 * says what the file says.
 *
 * ## Why this is not `../Blocked.tsx`, which draws `after` too
 *
 * They are two different claims, and only one of them is writable.
 *
 * `blocked by` is DERIVED (`@olai/format`'s `blocked` index): it is what is IN
 * THE WAY right now — unfinished work only, with `a blocks b` folded in from
 * the other record, both ends resolved through mirrors. Half of what it draws
 * may therefore live on somebody ELSE's record, and a finished blocker is not in
 * it at all. There is no single edge an `×` there would name.
 *
 * This row is the FIELD: what this node declares, exactly as written, whether
 * or not the target is still standing in the way — which is precisely what
 * `set_after` writes and what a person may drop (`parity-after`). So the two
 * rows sit one above the other on a node's page and say different true things,
 * and the editable one is the one that names a field.
 *
 * Drawn only where a node is READ in full (its own page), like `blocked by` and
 * for its reason: a tree row is a title in a column of titles, and what it can
 * afford about its dependencies is the dim and the mark column's glyph.
 */

import { nodeNamed, type RegularNode } from "@olai/format"
import { createMemo } from "solid-js"

import { useDerived } from "../derived.tsx"
import { NodeRefs } from "../NodeRefs.tsx"
import { TESTID } from "../testids.ts"

export function AfterRefs(props: {
  /** The regular node being shown — for a mirror, the node it stands for, since
   *  a placement carries no edges of its own. */
  readonly node: RegularNode
  /** Drop one of them — `set_after`'s removal half. Absent is read-only. */
  readonly onRemove?: (id: string) => void
}) {
  const derived = useDerived()

  const refs = createMemo(() => {
    // BEFORE the indexes are read, so a node with no `after` — almost every
    // node — never subscribes to the whole set and never re-runs on a frame
    // that cannot concern it. `../SeeRefs.tsx`'s rule, for the same reason.
    const after = props.node.after
    if (after === undefined || after.length === 0) return []
    const indexes = derived()
    if (indexes === undefined) return []
    return after.map((id) => {
      const named = nodeNamed(indexes, id)
      return { id, title: named?.node.title ?? id, from: named?.file ?? "" }
    })
  })

  return (
    <NodeRefs
      label="after"
      refs={refs()}
      testid={TESTID.afterRefs}
      onRemove={props.onRemove}
    />
  )
}
