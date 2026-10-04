import { createEffect, createMemo, mapArray, on, onCleanup, untrack, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { LivePane } from "./routing.tsx"
import { atElement, fileNamed, type Route } from "./routes.ts"
import { nodeTargets } from "./nodes.ts"
import { directory, fileClaims } from "./pages.ts"

const BUSY_RETRY_MS = 200
const BUSY_RETRIES = 50

/** A lane owns these requests. Each pane observes only its route and provider;
 * an answer, including absence, is remembered until either identity changes. */
export function createReveal(panes: Accessor<readonly LivePane[]>, arrive: (index: number, route: Route | undefined, how: "push" | "replace") => void) {
  type Request = { before: Route; next: Route; how: "push" | "replace"; provider: ReturnType<typeof nodeTargets.read> }
  const requests = new Map<string, Request>()
  const [status, setStatus] = createStore<Record<string, "finding" | "missing" | undefined>>({})
  const retries = new Set<ReturnType<typeof setTimeout>>()
  let alive = true
  onCleanup(() => { alive = false; requests.clear(); for (const timer of retries) clearTimeout(timer) })
  const ready = createMemo(() => !!fileClaims() && directory()?.standing() !== "reading")
  const reveal = (index: number, next: Route, how: "push" | "replace", retry = false): boolean => {
    if (next.kind !== "at" || !next.reveal || next.address?.kind !== "node") return false
    const pane = panes()[index], provider = nodeTargets.read()
    if (!pane || !provider || !ready()) return false
    const before = pane.route(), old = requests.get(pane.id)
    if (retry && old?.before === before && old.provider === provider) return true
    const request = { before, next, how, provider }
    requests.set(pane.id, request)
    const id = next.address.id
    if (!(before.kind === "at" && before.reveal) && provider.reveal(pane.id, id)) {
      requests.delete(pane.id)
      arrive(index, undefined, "replace")
      return true
    }
    setStatus(pane.id, "finding")
    const current = () => alive && nodeTargets.read() === provider && requests.get(pane.id) === request && pane.route() === before && panes().includes(pane)
    // Not yet answerable, so asked again: `undefined` is busy (the call's
    // connection was replaced, as at every boot whose roster lands after first
    // paint), and a home whose suffix the claim table does not hold yet would
    // land on the front page instead of the file.
    let attempts = 0
    const again = () => {
      if (++attempts > BUSY_RETRIES) { setStatus(pane.id, "missing"); return }
      const timer = setTimeout(() => { retries.delete(timer); ask() }, BUSY_RETRY_MS)
      retries.add(timer)
    }
    const ask = (): void => void provider.home(id).then(file => {
      if (!current()) return
      if (file === undefined) return again()
      if (file === null) { setStatus(pane.id, "missing"); return }
      const claims = fileClaims()
      const route = claims && atElement(claims, file, id)
      if (!route || fileNamed(route) === undefined) return again()
      requests.delete(pane.id)
      setStatus(pane.id, undefined)
      arrive(panes().indexOf(pane), route, how)
    }).catch(() => { if (current()) setStatus(pane.id, "missing") })
    ask()
    return true
  }
  const watch = mapArray(panes, pane => {
    createEffect(on([pane.route, nodeTargets.read, ready], ([route]) => {
      const previous = requests.get(pane.id)
      if (previous && previous.before !== route) { requests.delete(pane.id); setStatus(pane.id, undefined) }
      untrack(() => reveal(pane.index(), previous?.before === route ? previous.next : route,
        previous?.before === route ? previous.how : "replace", true))
    }))
    onCleanup(() => { requests.delete(pane.id); setStatus(pane.id, undefined) })
  })
  createEffect(watch)
  return {
    reveal,
    visible(index: number, route: Route) {
      const pane = panes()[index]
      if (!pane || route.kind !== "at" || !route.reveal || route.address?.kind !== "node" || !nodeTargets.read()?.reveal(pane.id, route.address.id)) return false
      requests.delete(pane.id)
      arrive(index, undefined, "replace")
      return true
    },
    cancel(index: number) { const pane = panes()[index]; if (pane) { requests.delete(pane.id); setStatus(pane.id, undefined) } },
    status(index: number) { const id = panes()[index]?.id; return id ? status[id] : undefined },
  }
}
