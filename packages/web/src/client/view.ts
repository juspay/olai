/**
 * How this tab is reading, as opposed to what the files say.
 *
 * Two switches so far — what is folded, and whether done nodes are drawn — and
 * they have the same nature: they belong to a reading, not to the outline.
 * Neither goes to the server, neither is written to disk, and hiding what is
 * done is a row not drawn rather than anything marked. Two readers looking at
 * the same node see the same outline and may fold it differently, which is why
 * this is client-local rather than a cell on the wire.
 *
 * PER VIEW, and that is what makes navigating reset them: a page you zoom into
 * is a new thing to read, and inheriting the last page's folds would fold
 * places this reader has never seen.
 */

import { type Accessor, createEffect, createSignal, on } from "solid-js"

import type { Route } from "./routes.ts"

export interface View {
  /** Places the reader has folded, keyed by PLACE (`Row.key`) — the same node
   *  reached through two mirrors is two rows, and folding one must not fold
   *  the other. */
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly toggle: (key: string) => void
  readonly doneHidden: Accessor<boolean>
  readonly toggleDone: () => void
}

export const createView = (route: Accessor<Route>): View => {
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set<string>())
  const [doneHidden, setDoneHidden] = createSignal(false)

  createEffect(
    on(route, () => {
      setCollapsed(new Set<string>())
      setDoneHidden(false)
    }, { defer: true }),
  )

  return {
    collapsed,
    toggle: (key) =>
      setCollapsed((previous) => {
        const next = new Set(previous)
        if (!next.delete(key)) next.add(key)
        return next
      }),
    doneHidden,
    toggleDone: () => setDoneHidden((hidden) => !hidden),
  }
}
