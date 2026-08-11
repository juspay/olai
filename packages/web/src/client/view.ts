/**
 * How this tab is reading, as opposed to what the files say.
 *
 * Two switches so far — what is folded, and whether done nodes are drawn —
 * and they have the same nature: they belong to a reading, not to the outline.
 * None goes to the server, none is written to disk, and hiding what is done is
 * a row not drawn rather than anything marked. Two readers looking at the same
 * node see the same outline and may fold it differently, which is why this is
 * client-local rather than a cell on the wire.
 *
 * A reading is OF A PAGE, which is what makes navigating start fresh — a page
 * you zoom into is a new thing to read, and inheriting the last page's folds
 * would fold places this reader has never seen. That is `createStamped`
 * (./stamped.ts), not an effect watching the route: a reading stamped with
 * another page is simply never the one that gets read, so there is no frame in
 * which the held reading and the open page disagree.
 *
 * Notes are not a reading switch. Every row draws one way (one dim clamped
 * line under the title; click or tap expands in place, click again or away
 * collapses) — see Tree.tsx and day/DayNode.tsx. There is no density cell and
 * no per-place unfold set.
 */

import type { Row } from "@olai/format"
import { withoutDone } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import { hrefOf, type Route } from "./routes.ts"
import { createStamped } from "./stamped.ts"

export interface View {
  /** Places the reader has folded, keyed by PLACE (`Row.key`) — the same node
   *  reached through two mirrors is two rows, and folding one must not fold
   *  the other. */
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly toggle: (key: string) => void
  /** Fold every named place. Used by the row menu's "Collapse all". */
  readonly collapseKeys: (keys: ReadonlyArray<string>) => void
  /** Unfold every named place. Used by the row menu's "Expand all". */
  readonly expandKeys: (keys: ReadonlyArray<string>) => void
  readonly doneHidden: Accessor<boolean>
  readonly toggleDone: () => void
  /** The rows this reading actually draws. The switch and what it does to a
   *  tree are one thing, so every page asks the same question rather than each
   *  re-deciding what "hidden" means. */
  readonly visible: (rows: ReadonlyArray<Row>) => ReadonlyArray<Row>
}

/** One page's reading — the switches, without the page they are of, which is
 *  the stamp rather than a field. */
interface Reading {
  readonly collapsed: ReadonlySet<string>
  readonly doneHidden: boolean
}

const fresh = (): Reading => ({
  collapsed: new Set(),
  doneHidden: false,
})

export const createView = (route: Accessor<Route>): View => {
  const reading = createStamped(() => hrefOf(route()), fresh)

  // Each switch is read through its OWN memo, not off the reading. A fold
  // mints a whole new reading, and a consumer that reached through it would be
  // invalidated by a click it does not care about — which, for the page's rows,
  // means rebuilding the tree every time a reader folds one row.
  const collapsed = createMemo(() => reading.value().collapsed)
  const doneHidden = createMemo(() => reading.value().doneHidden)

  return {
    collapsed,
    toggle: (key) =>
      reading.edit((current) => {
        const next = new Set(current.collapsed)
        if (!next.delete(key)) next.add(key)
        return { ...current, collapsed: next }
      }),
    collapseKeys: (keys) =>
      reading.edit((current) => {
        const next = new Set(current.collapsed)
        for (const key of keys) next.add(key)
        return { ...current, collapsed: next }
      }),
    expandKeys: (keys) =>
      reading.edit((current) => {
        const next = new Set(current.collapsed)
        for (const key of keys) next.delete(key)
        return { ...current, collapsed: next }
      }),
    doneHidden,
    toggleDone: () =>
      reading.edit((current) => ({ ...current, doneHidden: !current.doneHidden })),
    visible: (rows) => doneHidden() ? withoutDone(rows) : rows,
  }
}
