/** Mutable draft state outlives a rebuild of its page; readers and DOM
 * listeners are recreated by the new editor. Sharing the queue also lets a
 * dispatched write settle before the remounted editor sends another one. */
import { createSignal } from "solid-js"
import type { Draft, Pending } from "./draft.ts"
import { selectionMemory } from "../select/memory.ts"
import { serial } from "./queue.ts"
import type { Route } from "../routes.ts"

export const editorMemory = () => {
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [ghosts, setGhosts] = createSignal<ReadonlyArray<Pending>>([])
  const [caret, setCaret] = createSignal(0)
  let slots = 0
  return {
    draft, setDraft, ghosts, setGhosts, caret, setCaret,
    mintSlot: () => `d${++slots}`,
    enqueue: serial(),
    selection: selectionMemory(),
  }
}
export type EditorMemory = ReturnType<typeof editorMemory>

const saved = new WeakMap<Route, Map<string, EditorMemory>>()
const key = (pane: number, page: string) => JSON.stringify([pane, page])

export const takeEditor = (pane: number, page: string, route: Route | undefined): EditorMemory => {
  const at = key(pane, page)
  const entries = route === undefined ? undefined : saved.get(route)
  const memory = entries?.get(at) ?? editorMemory()
  entries?.delete(at)
  return memory
}

export const keepEditor = (pane: number, page: string, route: Route, memory: EditorMemory): void => {
  if (memory.draft() === null && memory.ghosts().length === 0
    && memory.selection.keys[0]().size === 0 && memory.selection.said[0]() === null) return
  const entries = saved.get(route) ?? new Map<string, EditorMemory>()
  entries.set(key(pane, page), memory)
  saved.set(route, entries)
}
