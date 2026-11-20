import { createStore } from "solid-js/store"
import { randomUuid } from "@olai/web/client/uuid.ts"
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

const samePageInfo = (a: PageInfo | undefined, b: PageInfo | undefined) =>
  a?.file === b?.file && a?.title === b?.title && a?.history === b?.history && a?.pending === b?.pending && a?.failure === b?.failure

export function createLane(seed: Workspace, shared: Pick<Router, "lane">,
  shown: () => boolean, write: (next: Workspace, how: "push" | "replace", apply: () => void) => void, initialAddress?: string) {
  let address = initialAddress ?? hrefOfWorkspace(routing, seed)
  const first = seed
  const { workspace, setWorkspace, panes, ids, focusIndex, split } = createPaneState(first, routing)
  const [landings, setLandings] = createSignal<Landings>(landingsOf(first))

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
  const resolving = createReveal(panes, (index, route, how) => route
    ? commit(navigateIn(workspace(), index, route), how, all => marked(all, index, landingOf(route)))
    : commit(focusAt(workspace(), index), "replace", asTheyWere))
  const goIn = (index: number, next: Route): void => {
    if (resolving.follow(index, next)) return
    commit(
      navigateIn(workspace(), index, next),
      "push",
      (all) => marked(all, index, landingOf(next)),
    )
  }
  const replaceIn = (index: number, next: Route): void => {
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
          if (panesOf(after).length > before) nextIds.splice(cursor, 0, randomUuid())
        }
        commit({ ...after, focus: from + 1 }, "push", () => landingsOf(after), nextIds)
    },
    openRight: (from, next, forceNew) => {
      const after = openRight(workspace(), from, next, forceNew === true)
      const nextIds = [...ids()]
      if (panesOf(after).length > nextIds.length) nextIds.splice(after.focus, 0, randomUuid())
      commit(after, "push", () => marked(NOWHERE, after.focus, landingOf(next)), nextIds)
    },
    close: (index) => {
      const here = workspace()
      const after = index === undefined ? closeFocused(here) : closeAt(here, index)
      if (after === here) return
      const nextIds = [...ids()]
      nextIds.splice(index ?? here.focus, 1)
      commit(after, "push", () => NOWHERE, nextIds)
    },
    focus: (index) => {
      const here = workspace()
      const after = focusAt(here, index)
      if (after.focus === here.focus) return
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
      const after = reorderPanes(workspace(), from, to)
      if (after === workspace()) return
      const leaves = (layout: import("./workspace.ts").Layout): readonly import("./workspace.ts").Leaf[] => layout.kind === "leaf" ? [layout] : layout.children.flatMap(child => leaves(child.layout))
      const before = leaves(workspace().layout)
      const keys = ids()
      const nextIds = leaves(after.layout).map(pane => keys[before.indexOf(pane)]!)
      commit(after, "push", () => NOWHERE, nextIds)
    },

  }
  return { value, revealVisible: (route: Route) => resolving.visible(focusIndex(), route), setWorkspace: (next: Workspace, requested?: string) => { address = requested ?? hrefOfWorkspace(routing, next); setWorkspace(next) }, setLandings }
}
