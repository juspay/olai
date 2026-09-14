/** Unsubmitted row forms belong to a tree pane, across plugin provider changes and
 * phone tab switches. Leaving that route or removing the row discards them. */
import { edgeMemory } from "../edges/memory.ts"
import { printAddress } from "@olai/format"
import { createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
import { useHere, useRouter } from "olai-plugin-navigation/routing"
import type { Route } from "olai-plugin-navigation/routes"
import { panesOf } from "olai-plugin-navigation/workspace"
import { createSubmission } from "../edit/submission.ts"
import type { Chosen } from "./pick.ts"

/** One row's unsubmitted forms. A tree row's live in its pane's
 * {@link RowForms}, so they outlive a rebuild of the row; a dated row on a day
 * page or the agenda has no pane-held tree and owns its forms itself. */
export const createRowForm = () => {
  // The date picker's draft — its day and time together, and `null` while the
  // picker is closed: one value, so opening and closing cannot leave half of it.
  const [date, setDate] = createSignal<Chosen | null>(null)
  const [rule, setRule] = createSignal<string | null>(null)
  return { edges: edgeMemory(), date, setDate, rule, setRule, dateSubmission: createSubmission(), repeatSubmission: createSubmission() }
}
export type RowForm = ReturnType<typeof createRowForm>
type Rows = Map<string, RowForm>
let saved = new WeakMap<Route, Map<string, Rows>>()
const Context = createContext<{ rows: Rows; disposed: boolean }>()

export function RowForms(props: { readonly children: JSX.Element; readonly namespace?: string }) {
  const router = useRouter()
  const pane = useHere()()
  const key = JSON.stringify([pane, props.namespace ?? "tree"])
  const route = panesOf(router.workspace())[pane]?.route
  const panes = route === undefined ? undefined : saved.get(route)
  const rows = panes?.get(key) ?? new Map<string, RowForm>()
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
    const open = new Map([...rows].filter(([, value]) => value.date() !== null || value.rule() !== null || value.edges.open[0]() !== null))
    if (open.size === 0) return
    const entries = saved.get(now) ?? new Map<string, Rows>()
    entries.set(key, open)
    saved.set(now, entries)
  })
  return <Context.Provider value={scope}>{props.children}</Context.Provider>
}

export const useRowForms = (key: string): RowForm => {
  const scope = useContext(Context)
  if (scope === undefined) throw new Error("row forms need their tree pane")
  let value = scope.rows.get(key)
  if (value === undefined) {
    value = createRowForm()
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

export const clearRowForms = (): void => { saved = new WeakMap() }
