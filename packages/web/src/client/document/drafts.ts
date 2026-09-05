/** Editor state kept across a rebuild of the same pane and route.
 * It is consumed on remount, never stored on disk, and includes the original
 * baseline so a rebuild cannot turn a conflicting save into an overwrite. */
import { createSignal } from "solid-js"
import type { Route } from "../routes.ts"

const draftOf = (base: string) => {
  const [text, setText] = createSignal(base)
  const [said, setSaid] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  return { base, text, setText, said, setSaid, busy, setBusy }
}
export type DocumentDraft = ReturnType<typeof draftOf>

const editorOf = () => {
  const [editing, setEditing] = createSignal(false)
  let held: DocumentDraft | null = null
  return {
    editing,
    open: () => setEditing(true),
    draft: (base: string) => held ??= draftOf(base),
    close: (draft: DocumentDraft) => {
      // A dispatched save may settle after Cancel and another edit. Its
      // completion belongs to the old draft, not the newly opened editor.
      if (held !== draft) return
      held = null
      setEditing(false)
    },
  }
}
export type DocumentEditor = ReturnType<typeof editorOf>
const saved = new WeakMap<Route, Map<string, DocumentEditor>>()
const key = (file: string, pane: number) => JSON.stringify([pane, file])

export const takeDraft = (file: string, pane: number, route: Route | undefined): DocumentEditor => {
  const at = key(file, pane)
  const entries = route === undefined ? undefined : saved.get(route)
  const editor = entries?.get(at) ?? editorOf()
  entries?.delete(at)
  return editor
}
export const keepDraft = (file: string, pane: number, route: Route, editor: DocumentEditor): void => {
  if (!editor.editing()) return
  const entries = saved.get(route) ?? new Map<string, DocumentEditor>()
  entries.set(key(file, pane), editor)
  saved.set(route, entries)
}
