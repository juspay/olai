/**
 * What one of a node's edge fields NAMES, resolved for reading: the ids it
 * holds, each with the title to show for it.
 *
 * ONE reading, because two surfaces do it — the row of links a node draws
 * (`./EdgeRefs.tsx`) and the panel that writes them (`./EdgePanel.tsx`, which
 * lists what the node says now with an `×` on each) — and they had already
 * disagreed about the case where the indexes have not arrived: one kept the raw
 * ids, the other drew nothing. That is the shape of drift `./relation.ts` was
 * written to prevent one field over, so the resolution lives beside the words.
 *
 * NOTHING ABOUT A TARGET IS STORED ON THE SOURCE, which is why this is resolved
 * at view time at all: a retitle on the target is free, and a link cannot
 * disagree with the page it opens. The rule for what an id names is the
 * format's own (`nodeNamed`, which follows a mirror to the node standing at
 * it) — the same one blockedness resolves its own targets with. A set under the
 * stale banner can hold a dangling id the validator would refuse; the title
 * falls back to the id, so the page says what the file says rather than drawing
 * a blank.
 *
 * THE INDEXES ARRIVE AS AN ACCESSOR and are read LAST, which is a reactivity
 * decision rather than a signature accident: a node carrying nothing on this
 * field — almost every node — must not subscribe to the whole set, or every row
 * of a large outline re-runs on every frame the store publishes. Called inside
 * the caller's own memo, this reads the cheap field first and the set only when
 * there is something to look up.
 */

import { type Derived, listOf, nodeNamed, type RegularNode } from "@olai/format"
import type { Accessor } from "solid-js"

import type { NodeRef } from "../NodeRefs.tsx"
import type { Relation } from "./relation.ts"

export const namedBy = (
  node: RegularNode,
  relation: Relation,
  indexes: Accessor<Derived | undefined>,
): ReadonlyArray<NodeRef> => {
  const named = listOf(node, relation)
  if (named.length === 0) return []
  const at = indexes()
  if (at === undefined) return []
  return named.map((id) => {
    const found = nodeNamed(at, id)
    return {
      id,
      title: found?.node.title ?? id,
      // from "" when dangling: the title is the id, not outline prose.
      from: found?.file ?? "",
    }
  })
}
