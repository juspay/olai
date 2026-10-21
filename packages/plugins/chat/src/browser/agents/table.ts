/**
 * THE ROSTER BY NODE — a keyed projection of the rows, so `at(node)` wakes one
 * row's readers rather than every row's.
 *
 * `at(node)` is read once per outline row (its standing), per Chats row, per
 * fold and per dock. A `Map` minted on every roster frame woke every one of
 * those readers whenever ANY agent moved — which, while an agent is working, is
 * several times a turn. Here each node has a signal of its own, written only
 * when the row under that key SAYS something new: the next frame's row is
 * compared whole against the one the signal holds, and an equal row is not a
 * write. A node that left is written `undefined`, so its readers alone hear
 * it; a node nobody has heard of yet still has a signal, so a reader waiting
 * on it is woken by its arrival and by nothing else.
 *
 * ONE SIGNAL PER KEY, AND NOT A STORE. The rows are copies of the wire's cell
 * (`./answered.tsx`'s `rows`), and that cell is itself a keyed store: a row's
 * nested objects — its forecast, its last line — are that store's proxies,
 * and a `reconcile` of a copy into a second store writes THROUGH them: the
 * wire's signals fire with values its own records never took, a stale nested
 * record stays under this table's key for ever, and the first reader to look
 * without a listener reads the record rather than the signal. The rows are not
 * this table's to reconcile; they are read whole and compared whole.
 *
 * A `.ts` beside the provider rather than inside it, so the claim above can be
 * held by a count (`./table.browsertest.ts`) without a renderer on the graph.
 */
import { type Accessor, createComputed, createSignal, type Setter, untrack } from "solid-js"
import { Schema } from "effect"

import { NodeAgentRow } from "olai-plugin-chat/wire"
import type { Row } from "./roster.ts"

/** The wire's own equality for a row, with the one browser-derived fact
 *  beside it. `untrack`ed because a comparison that reads the cell's proxies
 *  would otherwise subscribe the comparer to every field of both rows. */
const sameNodeAgentRow = Schema.toEquivalence(NodeAgentRow)
const sameRow = (a: Row | undefined, b: Row | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && untrack(() => a.unread === b.unread && sameNodeAgentRow(a, b)))

export const createRosterTable = (rows: Accessor<ReadonlyArray<Row>>): { readonly at: (node: string) => Row | undefined } => {
  const cells = new Map<string, readonly [Accessor<Row | undefined>, Setter<Row | undefined>]>()
  const cellOf = (node: string) => {
    let cell = cells.get(node)
    if (cell === undefined) {
      cell = createSignal<Row | undefined>(undefined, { equals: sameRow })
      cells.set(node, cell)
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
  return { at: node => cellOf(node)[0]() }
}
