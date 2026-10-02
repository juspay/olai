import { batch, createMemo, createSignal, untrack } from "solid-js"
import type { LivePane } from "../routing.tsx"
import type { Route } from "../routes.ts"
import { isLone, panesOf, type Layout, type Workspace, type WorkspaceRouting } from "../workspace.ts"

/** Pane identity is local to a lane and never serialized. Each pane has narrow
 * signals: moving a neighbour cannot notify its route readers. */
export function createPaneState(seed: Workspace, routes: WorkspaceRouting) {
  const [workspace, publish] = createSignal(seed)
  const make = (id: string, index: number, route: Route, width?: number) => {
    const [at, setIndex] = createSignal(index)
    const [page, setRoute] = createSignal(route)
    const [size, setWidth] = createSignal(width)
    const [element, setElement] = createSignal<HTMLElement>()
    const value: LivePane = { element, mount: root => {
      setElement(root)
      return () => { if (untrack(element) === root) setElement(undefined) }
    }, id, index: at, route: page, width: size }
    return { value, setIndex, setRoute, setWidth }
  }
  let held = panesOf(seed).map((pane, index) => make(crypto.randomUUID(), index, pane.route, pane.width))
  const [panes, setPanes] = createSignal<readonly LivePane[]>(held.map(one => one.value))
  const ids = () => untrack(panes).map(one => one.id)
  const sameRoute = (a: Route, b: Route) => a.kind === b.kind && routes.href(a) === routes.href(b)
    && (a.kind !== "plugin" || b.kind !== "plugin" || a.source === b.source)
  const setWorkspace = (next: Workspace, keys?: readonly string[]) => batch(() => {
    const incoming = panesOf(next)
    const previous = held
    const unused = new Set(previous)
    const stable: Route[] = []
    held = incoming.map((pane, index) => {
      const old = keys ? previous.find(one => one.value.id === keys[index])
        : incoming.length === previous.length ? previous[index]
        : previous.find(one => unused.has(one) && sameRoute(one.value.route(), pane.route))
      if (old) unused.delete(old)
      const route = old && sameRoute(old.value.route(), pane.route) ? old.value.route() : pane.route
      stable.push(route)
      const one = old ?? make(keys?.[index] ?? crypto.randomUUID(), index, route, pane.width)
      one.setIndex(index); one.setRoute(route); one.setWidth(pane.width)
      return one
    })
    let index = 0
    const reuse = (layout: Layout): Layout => layout.kind === "leaf"
      ? { ...layout, route: stable[index++]! }
      : { ...layout, children: layout.children.map(child => ({ ...child, layout: reuse(child.layout) })) }
    publish({ ...next, layout: reuse(next.layout) })
    if (held.length !== previous.length || held.some((one, i) => one !== previous[i])) setPanes(held.map(one => one.value))
  })
  return { workspace, setWorkspace, panes, ids,
    focusIndex: createMemo(() => workspace().focus), split: createMemo(() => !isLone(workspace())) }
}
