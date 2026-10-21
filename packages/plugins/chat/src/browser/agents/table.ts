/**
 * THE ROSTER BY NODE — a keyed projection of the rows, so `at(node)` wakes one
 * row's readers rather than every row's.
 *
 * `at(node)` is read once per outline row (its standing), per Chats row, per
 * fold and per dock. A `Map` minted on every roster frame woke every one of
 * those readers whenever ANY agent moved — which, while an agent is working, is
 * several times a turn. A store written per key wakes exactly the readers of
 * the rows whose VALUE changed: the next table is built from the frame, each
 * entry compared field by field against what the store holds, and only a
 * changed entry is written; a node that left is cleared. The list keeps its
 * own identity for the readers that want the whole roster, ordered.
 *
 * A `.ts` beside the provider rather than inside it, so the claim above can be
 * held by a count (`./table.browsertest.ts`) without a renderer on the graph.
 */
import { type Accessor, createComputed } from "solid-js"
import { createStore } from "solid-js/store"

import type { Row } from "./roster.ts"

/** Whether two frames' rows for one node say the same thing. `said` and
 *  `sleep` are small objects a frame re-mints, so they are compared by their
 *  fields rather than by reference. */
const sameRow = (a: Row | undefined, b: Row): boolean => {
  if (a === undefined) return false
  for (const key of Object.keys(b) as Array<keyof Row>) {
    const one = a[key], other = b[key]
    if (one === other) continue
    if (typeof one === "object" && one !== null && typeof other === "object" && other !== null
      && JSON.stringify(one) === JSON.stringify(other)) continue
    return false
  }
  for (const key of Object.keys(a)) if (!(key in b)) return false
  return true
}

export const createRosterTable = (rows: Accessor<ReadonlyArray<Row>>): { readonly at: (node: string) => Row | undefined } => {
  const [byNode, setByNode] = createStore<Record<string, Row | undefined>>({})
  createComputed(() => {
    const next = new Map(rows().map(row => [row.id, row]))
    for (const id of Object.keys(byNode)) if (!next.has(id) && byNode[id] !== undefined) setByNode(id, undefined)
    for (const [id, row] of next) if (!sameRow(byNode[id], row)) setByNode(id, row)
  })
  return { at: node => byNode[node] }
}
