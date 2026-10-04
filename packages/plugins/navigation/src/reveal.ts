import { createEffect, createMemo, mapArray, onCleanup, untrack, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { LivePane } from "./routing.tsx"
import { atElement, fileNamed, type Route } from "./routes.ts"
import { nodeTargets } from "./nodes.ts"
import { directory, fileClaims } from "./pages.ts"

export type RevealState = "finding" | "missing" | "unavailable"

/** The node a reveal route asks for, or nothing. */
const revealed = (route: Route): string | undefined =>
  route.kind === "at" && route.reveal && route.address?.kind === "node" ? route.address.id : undefined

/** A lane resolves each pane's reveal route reactively: one reading of the
 *  node's home per route and provider, landing once the claim table names the
 *  file. Nothing is retried here; the provider re-asks on its own wire. */
export function createReveal(panes: Accessor<readonly LivePane[]>, arrive: (index: number, route: Route | undefined) => void) {
  const [status, setStatus] = createStore<Record<string, RevealState | undefined>>({})
  const ready = createMemo(() => !!fileClaims() && directory()?.standing() !== "reading")
  const watch = mapArray(panes, pane => {
    const node = createMemo(() => revealed(pane.route()))
    createEffect(() => {
      const id = node(), provider = nodeTargets.read()
      setStatus(pane.id, id === undefined ? undefined : "finding")
      if (id === undefined || !provider || !ready()) return
      const home = provider.home(id)
      createEffect(() => {
        const file = home(), claims = fileClaims()
        if (file === null) return setStatus(pane.id, "missing")
        if (file instanceof Error) return setStatus(pane.id, "unavailable")
        const route = file === undefined || !claims ? undefined : atElement(claims, file, id)
        if (route && fileNamed(route) !== undefined) untrack(() => arrive(pane.index(), route))
      })
    })
    onCleanup(() => setStatus(pane.id, undefined))
  })
  createEffect(watch)
  return {
    /** Select the row in place when this pane already draws it. */
    visible(index: number, route: Route): boolean {
      const pane = panes()[index], id = revealed(route)
      if (!pane || id === undefined || !nodeTargets.read()?.reveal(pane.id, id)) return false
      arrive(index, undefined)
      return true
    },
    status(index: number) { const id = panes()[index]?.id; return id ? status[id] : undefined },
  }
}
