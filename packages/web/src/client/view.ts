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
 * Starting fresh is not the same as starting at a constant, and the Done switch
 * is where those two come apart. Which places are folded is a fact about the
 * page you are on and nothing else; whether you want to look at finished work
 * at all is a fact about the READER, and pressing it again on every page opened
 * is what a preference exists to stop. So the reading holds `undefined` there
 * until somebody presses the switch on this page, and `undefined` reads
 * `settings/done.ts` — which means changing the preference moves every page
 * nobody has pressed it on, including this one, and leaves the pages somebody
 * has exactly as they left them.
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
import { doneHiddenDefault } from "./settings/done.ts"
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
  /** `undefined` is "nobody has pressed the switch on this page", which is a
   *  different fact from "shown" and is what defers to the preference. */
  readonly doneHidden: boolean | undefined
}

const fresh = (): Reading => ({
  collapsed: new Set(),
  doneHidden: undefined,
})

export const createView = (route: Accessor<Route>): View => {
  const reading = createStamped(() => hrefOf(route()), fresh)

  // Each switch is read through its OWN memo, not off the reading. A fold
  // mints a whole new reading, and a consumer that reached through it would be
  // invalidated by a click it does not care about — which, for the page's rows,
  // means rebuilding the tree every time a reader folds one row.
  const collapsed = createMemo(() => reading.value().collapsed)
  /** What this page was told, or — on a page nobody has told anything — the
   *  preference. The ONE statement of that rule: pressing the switch is a
   *  negation of this memo rather than of the reading behind it, because
   *  `!undefined` is "hidden" for a reader whose preference already is, which
   *  is a switch whose first press does nothing. */
  const doneHidden = createMemo(() =>
    reading.value().doneHidden ?? doneHiddenDefault()
  )

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
    // Pressed against what is ON SCREEN — the memo above, not the reading it
    // is derived from.
    toggleDone: () =>
      reading.edit((current) => ({ ...current, doneHidden: !doneHidden() })),
    visible: (rows) => doneHidden() ? withoutDone(rows) : rows,
  }
}
