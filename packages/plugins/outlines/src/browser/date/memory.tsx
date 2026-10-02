/** Unsubmitted row forms are owned by the retained tree pane. */
import { edgeMemory } from "../edges/memory.ts"
import { createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
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
const Context = createContext<{ rows: Rows; disposed: boolean }>()

export function RowForms(props: { readonly children: JSX.Element; readonly namespace?: string }) {
  const scope = { rows: new Map<string, RowForm>(), disposed: false }
  onCleanup(() => { scope.disposed = true; scope.rows.clear() })
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
