/** Unsubmitted row forms belong to a tree pane, across wire rebuilds and
 * phone tab switches. Leaving that route or removing the row discards them. */
import { printAddress } from "@olai/format"
import { createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
import { useHere, useRouter } from "../router.tsx"
import type { Route } from "../routes.ts"
import { panesOf } from "../workspace.ts"

const form = () => {
  const [day, setDay] = createSignal<string | null>(null)
  const [rule, setRule] = createSignal<string | null>(null)
  return { day, setDay, rule, setRule }
}
type Form = ReturnType<typeof form>
type Rows = Map<string, Form>
const saved = new WeakMap<Route, Map<number, Rows>>()
const Context = createContext<{ rows: Rows; disposed: boolean }>()

export function RowForms(props: { readonly children: JSX.Element }) {
  const router = useRouter()
  const pane = useHere()()
  const route = panesOf(router.workspace())[pane]?.route
  const panes = route === undefined ? undefined : saved.get(route)
  const rows = panes?.get(pane) ?? new Map<string, Form>()
  panes?.delete(pane)
  const scope = { rows, disposed: false }
  onCleanup(() => {
    scope.disposed = true
    const now = panesOf(router.workspace())[pane]?.route
    // Filtering changes the route while this tree stays mounted. A later
    // rebuild must retain its drafts under the current route object.
    if (route?.kind !== "at" || now?.kind !== "at"
      || (now.address === null ? null : printAddress(now.address))
        !== (route.address === null ? null : printAddress(route.address))) return
    const open = new Map([...rows].filter(([, value]) => value.day() !== null || value.rule() !== null))
    if (open.size === 0) return
    const entries = saved.get(now) ?? new Map<number, Rows>()
    entries.set(pane, open)
    saved.set(now, entries)
  })
  return <Context.Provider value={scope}>{props.children}</Context.Provider>
}

export const useRowForms = (key: string): Form => {
  const scope = useContext(Context)
  if (scope === undefined) throw new Error("row forms need their tree pane")
  let value = scope.rows.get(key)
  if (value === undefined) {
    value = form()
    scope.rows.set(key, value)
  }
  const held = value
  onCleanup(() => {
    // Solid cleans children before their provider. By the microtask we know
    // whether the whole tree left, or just this row was removed/collapsed.
    queueMicrotask(() => {
      if (!scope.disposed && scope.rows.get(key) === held) scope.rows.delete(key)
    })
  })
  return value
}
