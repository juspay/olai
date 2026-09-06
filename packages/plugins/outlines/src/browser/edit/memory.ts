/** Mutable draft state outlives a rebuild of its page; readers and DOM
 * listeners are recreated by the new editor. Sharing the queue also lets a
 * dispatched write settle before the remounted editor sends another one. */
import { moveMemory } from "../move/memory.ts"
import { createSignal } from "solid-js"
import type { Draft, Pending, Slot } from "./draft.ts"
import { selectionMemory } from "../select/memory.ts"
import { serial } from "./queue.ts"
import type { Anchor } from "@olai/surface"
import type { Route } from "olai-plugin-navigation/routes"

export interface EditorRange {
  readonly slot: Slot
  readonly start: number
  readonly end: number
  readonly direction: "forward" | "backward" | "none"
}

let activation = 0

export const editorMemory = () => {
  const born = activation
  const queued = serial()
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [ghosts, setGhosts] = createSignal<ReadonlyArray<Pending>>([])
  const [caret, setCaret] = createSignal(0)
  const [resuming, setResuming] = createSignal<string | null>(null)
  const [placements, setPlacements] = createSignal<ReadonlyMap<string, Anchor>>(new Map())
  let slots = 0
  return {
    range: undefined as EditorRange | undefined,
    completion: { slot: undefined as Slot | undefined, dismissed: createSignal<string | null>(null) },
    draft, setDraft, ghosts, setGhosts, caret, setCaret, resuming, setResuming, placements, setPlacements,
    mintSlot: () => `d${++slots}`,
    enqueue: (step: () => unknown) => queued(() => born === activation ? step() : undefined),
    selection: selectionMemory(),
    moving: moveMemory(),
  }
}
export type EditorMemory = ReturnType<typeof editorMemory>

let saved = new WeakMap<Route, Map<string, EditorMemory>>()
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
    && memory.selection.keys[0]().size === 0 && memory.selection.said[0]() === null
    && memory.moving.standing[0]() === null) return
  const entries = saved.get(route) ?? new Map<string, EditorMemory>()
  entries.set(key(pane, page), memory)
  saved.set(route, entries)
}

export const clearEditorMemory = (): void => { activation++; saved = new WeakMap() }
