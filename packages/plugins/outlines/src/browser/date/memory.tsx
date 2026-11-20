import { edgeMemory } from "../edges/memory.ts"
import { createComponent, createContext, createSignal, onCleanup, useContext, type JSX } from "solid-js"
import { createSubmission } from "../edit/submission.ts"
import type { Chosen } from "./pick.ts"

export const createRowForm = () => {
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
    queueMicrotask(() => {
      if (!scope.disposed && entry.readers === 0 && scope.rows.get(key) === entry) scope.rows.delete(key)
    })
  })
  return entry.value
}
