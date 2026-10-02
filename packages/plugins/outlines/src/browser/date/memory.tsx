/** Unsubmitted row forms are owned by the retained tree pane. */
import { edgeMemory } from "../edges/memory.ts"
import { createComponent, createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
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
type HeldForm = { readonly value: RowForm; readers: number }
type Rows = Map<string, HeldForm>
const Context = createContext<{ rows: Rows; disposed: boolean }>()

export function RowForms(props: { readonly children: JSX.Element; readonly namespace?: string }) {
  const scope = { rows: new Map<string, HeldForm>(), disposed: false }
  onCleanup(() => { scope.disposed = true; scope.rows.clear() })
  return createComponent(Context.Provider, { value: scope, get children() { return props.children } })
}

export const useRowForms = (key: string): RowForm => {
  const scope = useContext(Context)
  if (scope === undefined) throw new Error("row forms need their tree pane")
  let held = scope.rows.get(key)
  if (held === undefined) {
    held = { value: createRowForm(), readers: 0 }
    scope.rows.set(key, held)
  }
  const entry = held
  entry.readers++
  onCleanup(() => {
    entry.readers--
    // A replacement row can acquire the same forms during this update.
    // Its lease must survive the outgoing row's deferred cleanup.
    queueMicrotask(() => {
      if (!scope.disposed && entry.readers === 0 && scope.rows.get(key) === entry) scope.rows.delete(key)
    })
  })
  return entry.value
}
