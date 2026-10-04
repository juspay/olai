import { createEffect, createMemo, mapArray, on, onCleanup, untrack, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { LivePane } from "./routing.tsx"
import { atElement, atNode, fileNamed, type Route } from "./routes.ts"
import { nodeTargets } from "./nodes.ts"
import { directory, fileClaims } from "./pages.ts"

export type RevealState = "finding" | "missing" | "unavailable"
type How = "push" | "replace"

/** The node a reveal route asks for, or nothing. */
const revealed = (route: Route): string | undefined =>
  route.kind === "at" && route.reveal && route.address?.kind === "node" ? route.address.id : undefined

/** A lane resolves each pane's reveal reactively: one reading of the node's
 *  home per node and provider, landing once the claim table names the file.
 *  A followed link is ASKED while the pane keeps its page and lands as a push;
 *  a reveal route already in the pane (first paint, a split) resolves in place
 *  of its own entry. Nothing is retried here; the provider re-asks on its wire. */
export function createReveal(panes: Accessor<readonly LivePane[]>, arrive: (index: number, route: Route | undefined, how: How) => void) {
  const [status, setStatus] = createStore<Record<string, RevealState | undefined>>({})
  const [asked, setAsked] = createStore<Record<string, string | undefined>>({})
  const ready = createMemo(() => !!fileClaims() && directory()?.standing() !== "reading")
  const watch = mapArray(panes, pane => {
    createEffect(on(pane.route, () => setAsked(pane.id, undefined), { defer: true }))
    const want = createMemo(() => {
      const id = asked[pane.id]
      return id === undefined ? { id: revealed(pane.route()), how: "replace" as How } : { id, how: "push" as How }
    }, undefined, { equals: (a, b) => a.id === b.id && a.how === b.how })
    createEffect(() => {
      const { id, how } = want(), provider = nodeTargets.read()
      setStatus(pane.id, id === undefined || how === "push" ? undefined : "finding")
      if (id === undefined || !provider || !ready()) return
      const home = provider.home(id)
      createEffect(() => {
        const file = home(), claims = fileClaims()
        if (file === null || file instanceof Error) {
          // A followed link that cannot land shows why, at its own address.
          if (how === "push") return untrack(() => arrive(pane.index(), atNode(id), "push"))
          return setStatus(pane.id, file === null ? "missing" : "unavailable")
        }
        const route = file === undefined || !claims ? undefined : atElement(claims, file, id)
        if (route && fileNamed(route) !== undefined) untrack(() => arrive(pane.index(), route, how))
      })
    })
    onCleanup(() => { setStatus(pane.id, undefined); setAsked(pane.id, undefined) })
  })
  createEffect(watch)
  /** Select the row in place when this pane already draws it. */
  const visible = (index: number, route: Route): boolean => {
    const pane = panes()[index], id = revealed(route)
    if (!pane || id === undefined || !nodeTargets.read()?.reveal(pane.id, id)) return false
    arrive(index, undefined, "replace")
    return true
  }
  return {
    visible,
    /** Follow a reveal from this pane: in place when the pane draws the row,
     *  otherwise asked while the page stays. False when the route must be
     *  committed as it is. */
    follow(index: number, route: Route): boolean {
      if (visible(index, route)) return true
      const pane = panes()[index], id = revealed(route)
      if (!pane || id === undefined || !nodeTargets.read() || !ready()) return false
      setAsked(pane.id, id)
      return true
    },
    status(index: number) { const id = panes()[index]?.id; return id ? status[id] : undefined },
  }
}
