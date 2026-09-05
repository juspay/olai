/** Unsubmitted row forms belong to a tree pane, across plugin provider changes and
 * phone tab switches. Leaving that route or removing the row discards them. */
import { edgeMemory } from "../edges/memory.ts"
import { printAddress } from "@olai/format"
import { createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
import { useHere, useRouter } from "../router.tsx"
import type { Route } from "../routes.ts"
import { panesOf } from "../workspace.ts"
import { createSubmission } from "../edit/submission.ts"

const form = () => {
  const [day, setDay] = createSignal<string | null>(null)
  const [rule, setRule] = createSignal<string | null>(null)
  return { edges: edgeMemory(), day, setDay, rule, setRule, dateSubmission: createSubmission(), repeatSubmission: createSubmission() }
}
type Form = ReturnType<typeof form>
type Rows = Map<string, Form>
const saved = new WeakMap<Route, Map<string, Rows>>()
const Context = createContext<{ rows: Rows; disposed: boolean }>()

export function RowForms(props: { readonly children: JSX.Element; readonly namespace?: string }) {
  const router = useRouter()
  const pane = useHere()()
  const key = JSON.stringify([pane, props.namespace ?? "tree"])
  const route = panesOf(router.workspace())[pane]?.route
  const panes = route === undefined ? undefined : saved.get(route)
  const rows = panes?.get(key) ?? new Map<string, Form>()
  panes?.delete(key)
  const scope = { rows, disposed: false }
  onCleanup(() => {
    scope.disposed = true
    const now = panesOf(router.workspace())[pane]?.route
    // Filtering changes the route while this tree stays mounted. A later
    // rebuild must retain its drafts under the current route object.
    if (route?.kind !== "at" || now?.kind !== "at"
      || (now.address === null ? null : printAddress(now.address))
        !== (route.address === null ? null : printAddress(route.address))) return
    const open = new Map([...rows].filter(([, value]) => value.day() !== null || value.rule() !== null || value.edges.open[0]() !== null))
    if (open.size === 0) return
    const entries = saved.get(now) ?? new Map<string, Rows>()
    entries.set(key, open)
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
