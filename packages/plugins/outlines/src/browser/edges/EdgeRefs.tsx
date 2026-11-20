import type { RegularNode } from "@olai/format"
import { createMemo } from "solid-js"

import { useNames } from "../reading.tsx"
import { NodeRefs } from "../NodeRefs.tsx"
import { namedBy } from "./named.ts"
import { type Relation, relating } from "./relation.ts"

export function EdgeRefs(props: {
  readonly node: RegularNode
  readonly relation: Relation
  readonly onRemove?: (id: string) => void
}) {
  const names = useNames()
  const refs = createMemo(() => namedBy(props.node, props.relation, names))

  return (
    <NodeRefs
      label={relating(props.relation).label}
      refs={refs()}
      testid={relating(props.relation).refs}
      onRemove={props.onRemove}
    />
  )
}
