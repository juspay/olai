/** Mutable draft state outlives a rebuild of its page; readers and DOM
 * listeners are recreated by the new editor. Sharing the queue also lets a
 * dispatched write settle before the remounted editor sends another one. */
import { moveMemory } from "../move/memory.ts"
import { createContext, useContext, createSignal } from "solid-js"
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
  const caretReaders = new Set<() => void>()
  let caretQueued = false
  const requestCaret = () => {
    if (caretQueued) return
    caretQueued = true
    queueMicrotask(() => { caretQueued = false; for (const take of caretReaders) take() })
  }
  const onCaret = (take: () => void) => { caretReaders.add(take); return () => { caretReaders.delete(take) } }
  const [resuming, setResuming] = createSignal<string | null>(null)
  const [placements, setPlacements] = createSignal<ReadonlyMap<string, Anchor>>(new Map())
  let slots = 0
  return {
    range: undefined as EditorRange | undefined,
    completion: { slot: undefined as Slot | undefined, dismissed: createSignal<string | null>(null) },
    draft, setDraft, ghosts, setGhosts, requestCaret, onCaret, resuming, setResuming, placements, setPlacements,
    mintSlot: () => `d${++slots}`,
    enqueue: (step: () => unknown) => queued(() => born === activation ? step() : undefined),
    selection: selectionMemory(),
    moving: moveMemory(),
  }
}
export type EditorMemory = ReturnType<typeof editorMemory>

export const clearEditorMemory = (): void => { activation++ }

const Context = createContext<EditorMemory>()
export const EditorMemoryProvider = Context.Provider
export const useEditorMemory = (): EditorMemory => useContext(Context) ?? editorMemory()

export const resetEditorMemory = (memory: EditorMemory): void => {
  memory.setDraft(null)
  memory.completion.slot = undefined
  memory.completion.dismissed[1](null)
  memory.setGhosts([])
  memory.setPlacements(new Map())
  memory.setResuming(null)
  memory.range = undefined
  memory.selection.keys[1](new Set<string>())
  memory.selection.anchor[1](null)
  memory.selection.focus[1](null)
  memory.selection.said[1](null)
  memory.moving.standing[1](null)
  memory.moving.query[1]("")
  memory.moving.judging[1](null)
}
