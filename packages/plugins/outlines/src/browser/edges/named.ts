import type { RegularNode } from "@olai/format"
import type { Accessor } from "solid-js"

import type { Names } from "olai-plugin-outlines/names"
import type { NodeRef } from "../ref.ts"
import type { Relation } from "./relation.ts"

export const namedBy = (
  node: RegularNode,
  relation: Relation,
  names: Accessor<Names>,
): ReadonlyArray<NodeRef> => {
  const named = node[relation]
  if (named === undefined || named.length === 0) return []
  const table = names()
  return [...new Set(named)].map((id) => {
    const found = table(id)
    return {
      id,
      title: found?.title ?? id,
      from: found?.file ?? "",
    }
  })
}
