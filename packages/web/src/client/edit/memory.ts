/** Mutable draft state outlives a rebuild of its page; readers and DOM
 * listeners are recreated by the new editor. Sharing the queue also lets a
 * dispatched write settle before the remounted editor sends another one. */
import { createSignal } from "solid-js"
import type { Draft, Pending } from "./draft.ts"
import { serial } from "./queue.ts"

export const editorMemory = () => {
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [ghosts, setGhosts] = createSignal<ReadonlyArray<Pending>>([])
  const [caret, setCaret] = createSignal(0)
  let slots = 0
  return {
    draft, setDraft, ghosts, setGhosts, caret, setCaret,
    mintSlot: () => `d${++slots}`,
    enqueue: serial(),
  }
}
export type EditorMemory = ReturnType<typeof editorMemory>

const saved = new Map<string, EditorMemory>()
const key = (pane: number, page: string) => JSON.stringify([history.state?.key ?? location.href, pane, page])

export const takeEditor = (pane: number, page: string): EditorMemory => {
  const at = key(pane, page)
  const memory = saved.get(at) ?? editorMemory()
  saved.delete(at)
  return memory
}

export const keepEditor = (pane: number, page: string, memory: EditorMemory): void => {
  if (memory.draft() !== null || memory.ghosts().length > 0) saved.set(key(pane, page), memory)
}
