/** Editor state kept only across a rebuild of the same pane and history entry.
 * It is consumed on remount, never stored on disk, and includes the original
 * baseline so a rebuild cannot turn a conflicting save into an overwrite. */
import { createSignal } from "solid-js"

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
const saved = new Map<string, DocumentEditor>()
const key = (file: string, pane: number) => JSON.stringify([history.state?.key ?? location.href, pane, file])

export const takeDraft = (file: string, pane: number): DocumentEditor => {
  const at = key(file, pane)
  const editor = saved.get(at) ?? editorOf()
  saved.delete(at)
  return editor
}
export const keepDraft = (file: string, pane: number, editor: DocumentEditor): void => {
  if (editor.editing()) saved.set(key(file, pane), editor)
}
