/**
 * How this tab is reading, as opposed to what the files say.
 *
 * Three switches so far — what is folded, whether done nodes are drawn, and
 * how dense the notes are — and they have the same nature: they belong to a
 * reading, not to the outline. None goes to the server, none is written to
 * disk, and hiding what is done is a row not drawn rather than anything
 * marked. Two readers looking at the same node see the same outline and may
 * fold it differently, which is why this is client-local rather than a cell
 * on the wire.
 *
 * A reading is OF A PAGE, which is what makes navigating start fresh — a page
 * you zoom into is a new thing to read, and inheriting the last page's folds
 * would fold places this reader has never seen. That is `createStamped`
 * (./stamped.ts), not an effect watching the route: a reading stamped with
 * another page is simply never the one that gets read, so there is no frame in
 * which the held reading and the open page disagree.
 *
 * Per-note expansion (the first-line control toggled open) is also of a PLACE
 * (`Row.key`), like fold: the same node reached through two mirrors is two
 * rows, and opening one must not open the other.
 */

import type { Row } from "@olai/format"
import { withoutDone } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import { hrefOf, type Route } from "./routes.ts"
import { createStamped } from "./stamped.ts"

/** How this reading draws notes under rows. Two states, like done visibility:
 *  `first-line` (default) is one plain line you click to open or close the
 *  full note; `full` draws every note open. The zoomed subject's own note is
 *  never densified — it is the body of the page. */
export type DescDensity = "full" | "first-line"

export interface View {
  /** Places the reader has folded, keyed by PLACE (`Row.key`) — the same node
   *  reached through two mirrors is two rows, and folding one must not fold
   *  the other. */
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly toggle: (key: string) => void
  readonly doneHidden: Accessor<boolean>
  readonly toggleDone: () => void
  /** How dense notes are under rows. `first-line` is the default. */
  readonly density: Accessor<DescDensity>
  readonly toggleDensity: () => void
  /** Places whose note the reader has opened under first-line density, keyed
   *  by PLACE. Ignored when density is `full`. */
  readonly noteOpen: Accessor<ReadonlySet<string>>
  readonly toggleNote: (key: string) => void
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
  readonly density: DescDensity
  readonly noteOpen: ReadonlySet<string>
}

const fresh = (): Reading => ({
  collapsed: new Set<string>(),
  doneHidden: false,
  density: "first-line",
  noteOpen: new Set<string>(),
})

export const createView = (route: Accessor<Route>): View => {
  const reading = createStamped(() => hrefOf(route()), fresh)

  // Each switch is read through its OWN memo, not off the reading. A fold
  // mints a whole new reading, and a consumer that reached through it would be
  // invalidated by a click it does not care about — which, for the page's rows,
  // means rebuilding the tree (and re-rendering every note's markdown) every
  // time a reader folds one row.
  const collapsed = createMemo(() => reading.value().collapsed)
  const doneHidden = createMemo(() => reading.value().doneHidden)
  const density = createMemo(() => reading.value().density)
  const noteOpen = createMemo(() => reading.value().noteOpen)

  return {
    collapsed,
    toggle: (key) =>
      reading.edit((current) => {
        const collapsed = new Set(current.collapsed)
        if (!collapsed.delete(key)) collapsed.add(key)
        return { ...current, collapsed }
      }),
    doneHidden,
    toggleDone: () =>
      reading.edit((current) => ({ ...current, doneHidden: !current.doneHidden })),
    density,
    toggleDensity: () =>
      reading.edit((current) => ({
        ...current,
        density: current.density === "full" ? "first-line" : "full",
      })),
    noteOpen,
    toggleNote: (key) =>
      reading.edit((current) => {
        const noteOpen = new Set(current.noteOpen)
        if (!noteOpen.delete(key)) noteOpen.add(key)
        return { ...current, noteOpen }
      }),
    visible: (rows) => doneHidden() ? withoutDone(rows) : rows,
  }
}
