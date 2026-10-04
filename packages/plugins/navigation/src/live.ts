import { createStore } from "solid-js/store"
import type { Lane, Router } from "./routing.tsx"
import {
batch,
createEffect,
createSignal,
createMemo,
onCleanup,
untrack
} from "solid-js"

import {
asTheyWere,
landingOf,
type Landings,
landingsOf,
marked,
NOWHERE,
spent
} from "./landing.ts"
import { createReveal } from "./reveal.ts"
import type { Route } from "./routes.ts"
import { routing } from "./pages.ts"
import {
closeAt,
closeFocused,
collapseAt,
expandAt,
focusAt,
focusBy,
focusedRoute,
hrefOfWorkspace,
isLone,
navigateIn,
openRight,
panesOf,
reorder as reorderPanes,
resizeTo,
type Workspace,
workspaceOf,
} from "./workspace.ts"

import type { PageInfo } from "./index.ts"
import { createPaneState } from "./pane/state.ts"

// A report and the focused-page projection expose the same semantic fields.
const samePageInfo = (a: PageInfo | undefined, b: PageInfo | undefined) =>
  a?.file === b?.file && a?.title === b?.title && a?.history === b?.history && a?.pending === b?.pending && a?.failure === b?.failure

/** One workspace and its reports. Its root belongs to navigation, not to the
 * tab strip or to a particular layout mode. Only the front lane writes history. */
export function createLane(seed: Workspace, shared: Pick<Router, "lane">,
  shown: () => boolean, write: (next: Workspace, how: "push" | "replace", apply: () => void) => void, initialAddress?: string) {
  let address = initialAddress ?? hrefOfWorkspace(routing, seed)
  const first = seed
  const { workspace, setWorkspace, panes, ids, focusIndex, split } = createPaneState(first, routing)
  const [landings, setLandings] = createSignal<Landings>(landingsOf(first))

  // A newly available plugin can claim the address already in the bar (for
  // example, Back into a disabled journal followed by enabling journal).
  // Reinterpret those routes when the claim table changes without navigating
  // or replacing the route objects that still mean the same thing.
  createEffect(() => {
    const parsed = workspaceOf(routing, address)
    const current = untrack(workspace)
    let next = current
    let arrivals = untrack(landings)
    const previous = panesOf(current)
    for (const [index, pane] of panesOf(parsed).entries()) {
      const before = previous[index]?.route
      if (before === undefined) continue
      if (before.kind === pane.route.kind && routing.href(before) === routing.href(pane.route)
        && (before.kind !== "plugin" || pane.route.kind !== "plugin"
          || before.source === pane.route.source)) continue
      next = navigateIn(next, index, pane.route)
      arrivals = marked(arrivals, index, landingOf(pane.route))
    }
    if (next !== current) batch(() => {
      setLandings(arrivals)
      setWorkspace({ ...next, focus: current.focus })
    })
  })


  const commit = (next: Workspace, how: "push" | "replace", land: (all: Landings) => Landings, keys?: readonly string[]) => {
    write(next, how, () => batch(() => { address = hrefOfWorkspace(routing, next); setLandings(land); setWorkspace(next, keys) }))
  }
  const [reports, setReports] = createStore<Record<string, (() => PageInfo) | undefined>>({})
  const info = (index: number) => reports[panes()[index]?.id ?? ""]?.()
  const focused = createMemo(() => info(focusIndex()), undefined, { equals: samePageInfo })
  // A reveal resolves IN PLACE of its own entry: the route it replaces is the
  // one that asked, so a followed reference is still one step of history.
  const resolving = createReveal(panes, (index, route) => route
    ? commit(navigateIn(workspace(), index, route), "replace", all => marked(all, index, landingOf(route)))
    : commit(focusAt(workspace(), index), "replace", asTheyWere))
  const goIn = (index: number, next: Route): void => {
    if (resolving.visible(index, next)) return
    commit(
      navigateIn(workspace(), index, next),
      "push",
      (all) => marked(all, index, landingOf(next)),
    )
  }
  const replaceIn = (index: number, next: Route): void => {
    // A REPLACE IS NOT AN ARRIVAL — it is the same page at a different address
    // (a filter narrowed, a focus recorded), and the scroll is deliberately
    // left where it is. So this pane is owed nothing, and no other pane hears.
    commit(
      navigateIn(workspace(), index, next),
      "replace",
      (all) => marked(all, index, undefined),
    )
  }


  const value: Lane = {
    ...shared, shown, panes, focusIndex, split, info, focused,
    report(index, reading) {
      const id = ids()[untrack(index)]!
      const row = createMemo(reading, undefined, { equals: samePageInfo })
      setReports(id, () => row)
      onCleanup(() => { if (untrack(() => reports[id]) === row) setReports(id, undefined) })
    },
    // THE ROSTER-DEPENDENT HALF OF THE GRAMMAR, on the router that holds the
    // routes — one binding over this row's own claim table (`./pages.ts`), so
    // every `<Link>`, every pane label and every consuming row asks one thing.
    routes: routing,
    workspace,
    route: createMemo(() => focusedRoute(workspace())),
    landing: (index) => landings().get(index),
    landed: (index, file, at) =>
      setLandings((all) => spent(all, index, file, at)),
    go: (next) => goIn(workspace().focus, next),
    goIn,
    revealState: resolving.status,
    replace: (next) => replaceIn(workspace().focus, next),
    replaceIn,
    open: (next) => commit(next, "push", () => landingsOf(next)),
    openWorkspaceRight: (from, next, forceNew) => {
        let after = workspace(), cursor = from
        const nextIds = [...ids()]
        for (const [offset, pane] of panesOf(next).entries()) {
          const before = nextIds.length
          after = openRight(after, cursor, pane.route, forceNew === true || offset > 0)
          cursor = after.focus
          if (panesOf(after).length > before) nextIds.splice(cursor, 0, crypto.randomUUID())
        }
        commit({ ...after, focus: from + 1 }, "push", () => landingsOf(after), nextIds)
    },
    openRight: (from, next, forceNew) => {
      const after = openRight(workspace(), from, next, forceNew === true)
      // A PANE IS BORN, so every index at or after it means a different pane
      // than it did a moment ago: only the arrival this verb is about survives.
      const nextIds = [...ids()]
      if (panesOf(after).length > nextIds.length) nextIds.splice(after.focus, 0, crypto.randomUUID())
      commit(after, "push", () => marked(NOWHERE, after.focus, landingOf(next)), nextIds)
    },
    close: (index) => {
      const here = workspace()
      const after = index === undefined ? closeFocused(here) : closeAt(here, index)
      if (after === here) return
      // Closing the second-to-last returns a plain page: push, so Back
      // restores the split. A pane is gone, so the indices moved.
      const nextIds = [...ids()]
      nextIds.splice(index ?? here.focus, 1)
      commit(after, "push", () => NOWHERE, nextIds)
    },
    focus: (index) => {
      const here = workspace()
      const after = focusAt(here, index)
      if (after.focus === here.focus) return
      // Focus is part of the address so a reload restores it, but it is
      // not a page you went TO: replace, so Back is not an un-focus. No pane
      // changed page, so no pane's landing changed either.
      commit(after, "replace", asTheyWere)
    },
    stepFocus: (delta) => {
      const here = workspace()
      if (isLone(here)) return
      const after = focusBy(here, delta)
      if (after.focus === here.focus) return
      commit(after, "replace", asTheyWere)
    },
    collapse: (index) => {
      commit(collapseAt(workspace(), index), "replace", asTheyWere)
    },
    expand: (index) => {
      commit(expandAt(workspace(), index), "replace", asTheyWere)
    },
    resize: (widths) => {
      commit(resizeTo(workspace(), widths), "replace", asTheyWere)
    },
    reorder: (from, to) => {
      // The panes are permuted, so every mark names the wrong one.
      const after = reorderPanes(workspace(), from, to)
      if (after === workspace()) return
      const leaves = (layout: import("./workspace.ts").Layout): readonly import("./workspace.ts").Leaf[] => layout.kind === "leaf" ? [layout] : layout.children.flatMap(child => leaves(child.layout))
      const before = leaves(workspace().layout)
      const keys = ids()
      // Reorder moves sibling subtrees, which can contain several leaves.
      const nextIds = leaves(after.layout).map(pane => keys[before.indexOf(pane)]!)
      commit(after, "push", () => NOWHERE, nextIds)
    },

  }
  return { value, revealVisible: (route: Route) => resolving.visible(focusIndex(), route), setWorkspace: (next: Workspace, requested?: string) => { address = requested ?? hrefOfWorkspace(routing, next); setWorkspace(next) }, setLandings }
}
