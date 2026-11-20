import { type Accessor, createComputed, createSignal, type Setter, untrack } from "solid-js"
import { Schema } from "effect"

import { NodeAgentRow } from "olai-plugin-chat/wire"
import type { Row } from "./roster.ts"

const sameNodeAgentRow = Schema.toEquivalence(NodeAgentRow)
const sameRow = (a: Row | undefined, b: Row | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && untrack(() => a.unread === b.unread && sameNodeAgentRow(a, b)))

export const createRosterTable = (rows: Accessor<ReadonlyArray<Row>>): { readonly at: (key: string) => Row | undefined } => {
  const cells = new Map<string, readonly [Accessor<Row | undefined>, Setter<Row | undefined>]>()
  const cellOf = (key: string) => {
    let cell = cells.get(key)
    if (cell === undefined) {
      cell = createSignal<Row | undefined>(undefined, { equals: sameRow })
      cells.set(key, cell)
    }
    return cell
  }
  createComputed(() => {
    const next = rows()
    const seen = new Set<string>()
    for (const row of next) {
      seen.add(row.id)
      cellOf(row.id)[1](() => row)
    }
    for (const [id, [, write]] of cells) if (!seen.has(id)) write(undefined)
  })
  return { at: key => cellOf(key)[0]() }
}
