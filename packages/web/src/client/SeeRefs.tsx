/**
 * A node's free cross-references (`see`), drawn as links.
 *
 * The format stores target ids; the link TEXT is each target's title, resolved
 * at view time through the set's indexes (./derived.tsx) by the format's own
 * rule for what an id names (`nodeNamed`, which follows a mirror to the node
 * standing at it — the same rule blockedness resolves its targets with). That
 * is the same discipline as status and tags: nothing about the target is
 * stored on the source, so a retitle on the target is free and a link cannot
 * disagree with the page it opens. The HREF is the target's id as written —
 * `/n/<id>` is a permalink, and a mirror id lands on the same canonical page a
 * bullet would.
 *
 * A set under the stale banner can hold a dangling id the validator would
 * refuse; the link is still drawn, with the id as its text rather than a blank,
 * so the page says what the file says.
 *
 * Drawn wherever a node is drawn (./NodeBody.tsx): a tree row, a day entry,
 * the subject's own page. Absent when the node carries no `see`. What one of
 * these rows LOOKS like is ./NodeRefs.tsx, which `after` draws too.
 */

import { nodeNamed, type RegularNode } from "@olai/format"
import { createMemo } from "solid-js"

import { useDerived } from "./derived.tsx"
import { NodeRefs } from "./NodeRefs.tsx"
import { TESTID } from "./testids.ts"

export function SeeRefs(props: {
  /** The regular node being shown — for a mirror row, the node it stands for. */
  readonly node: RegularNode
}) {
  const derived = useDerived()

  const refs = createMemo(() => {
    // BEFORE the indexes are read, so a node with no `see` — almost every node
    // with a body drawn — never subscribes to the whole set and never re-runs
    // on a frame that cannot concern it.
    const see = props.node.see
    if (see === undefined || see.length === 0) return []
    const indexes = derived()
    if (indexes === undefined) return []
    return see.map((id) => ({ id, title: nodeNamed(indexes, id)?.node.title ?? id }))
  })

  return <NodeRefs label="see" refs={refs()} testid={TESTID.seeRefs} />
}
