/** Editors belong to the documents activation, keyed by the pane and file.
 * Page presentation may withdraw independently; the baseline stays with the
 * document owner until that owner stops. No Route object is used as storage. */
import { createSignal, onCleanup } from "solid-js"

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
export const createDocumentEditors = () => {
  const panes = new Map<string, Map<string, DocumentEditor>>()
  onCleanup(() => panes.clear())
  const editor = (pane: string, file: string): DocumentEditor => {
    let entries = panes.get(pane)
    if (entries === undefined) panes.set(pane, entries = new Map())
    let editor = entries.get(file)
    if (editor === undefined) entries.set(file, editor = editorOf())
    return editor
  }
  return { editor, retain: (active: ReadonlyMap<string, string | undefined>): void => {
    for (const [pane, entries] of panes) {
      const file = active.get(pane)
      for (const key of entries.keys()) if (key !== file) entries.delete(key)
      if (entries.size === 0) panes.delete(pane)
    }
  } }
}
