import { createDocumentEditors, type DocumentEditor } from "./drafts.ts"
import type { DocumentEntry } from "../../wire.ts"

import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import { sameList } from "@olai/web/client/same.ts"
import { documentEntries } from "../../client.ts"

export type { Refused, Served } from "./ready.ts"
export { isServed } from "./ready.ts"

export interface Documents {
  readonly retainEditors: (active: ReadonlyMap<string, string | undefined>) => void
  readonly editor: (pane: string, file: string) => DocumentEditor
  readonly mintEditing: (file: string) => void
  readonly read: (
    file: Accessor<string | undefined>,
  ) => Accessor<DocumentEntry | undefined>
}

export const createDocuments = (): Documents => {
  const editors = createDocumentEditors()
  const [askers, setAskers] = createSignal<ReadonlyMap<string, number>>(new Map())
  const wanted = createMemo(() => [...askers().keys()], [], { equals: sameList })
  const held = (file: string, by: number): void => {
    setAskers((before) => {
      const after = new Map(before)
      const now = (after.get(file) ?? 0) + by
      if (now > 0) after.set(file, now)
      else after.delete(file)
      return after
    })
  }

  const entries = documentEntries(wanted)

  return {
    editor: editors.editor,
    mintEditing: editors.mintEditing,
    retainEditors: editors.retain,
    read: (file) => {
      createEffect(() => {
        const path = file()
        if (path === undefined) return
        held(path, 1)
        onCleanup(() => held(path, -1))
      })
      return () => {
        const path = file()
        return path === undefined ? undefined : entries.byKey(path)?.()
      }
    },
  }
}

const DocumentsContext = createContext<Documents>()

export function DocumentsProvider(props: {
  readonly documents: Documents
  readonly children: JSX.Element
}) {
  return (
    <DocumentsContext.Provider value={props.documents}>
      {props.children}
    </DocumentsContext.Provider>
  )
}

const reader = (): Documents => {
  const documents = useContext(DocumentsContext) ?? ownedDocuments
  if (documents === undefined) {
    throw new Error("a document reference outside <DocumentsProvider>")
  }
  return documents
}

export const useDocument = (
  file: () => string | undefined,
): Accessor<DocumentEntry | undefined> => reader().read(file)

let ownedDocuments: Documents | undefined
export const holdDocuments = (value: Documents): (() => void) => {
 ownedDocuments = value
 return () => { if (ownedDocuments === value) ownedDocuments = undefined }
}

export const useDocumentEditor = (pane: string, file: string): DocumentEditor => reader().editor(pane, file)

export const mintEditing = (file: string): void => reader().mintEditing(file)
