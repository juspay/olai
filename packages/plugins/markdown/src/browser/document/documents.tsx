/** ONE module owns `client().collections.documents`. That rule is enforceable
 * only where the member is reached, so the member is reached here and nowhere
 * else. */

import { createDocumentEditors, type DocumentEditor } from "./drafts.ts"
import type { DocumentEntry } from "../../wire.ts"

import type { Ready } from "./ready.ts"
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
import { client } from "../../client.ts"

export type { Ready, Refused, Served } from "./ready.ts"
export { isServed } from "./ready.ts"

export interface Documents {
  readonly retainEditors: (active: ReadonlyMap<string, string | undefined>) => void
  readonly editor: (pane: string, file: string) => DocumentEditor
  readonly read: (
    file: Accessor<string | undefined>,
  ) => Accessor<Ready | undefined>
}

const arrived = (entry: DocumentEntry | undefined): entry is Ready =>
  entry !== undefined && (entry.refused || entry.text !== null)

export const createDocuments = (): Documents => {
  const editors = createDocumentEditors()
  const [askers, setAskers] = createSignal<ReadonlyMap<string, number>>(new Map())
  /** By value: a fresh array carrying the same paths notifies the framework's
   * `keys` memo, which re-diffs its `mapArray` and re-runs every per-key `read()`
   * accessor in the app
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §3.7). */
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

  const entries = client().collections.documents.use({ keys: wanted })

  return {
    editor: editors.editor,
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
        if (path === undefined) return undefined
        const entry = entries.byKey(path)?.()
        return arrived(entry) ? entry : undefined
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
): Accessor<Ready | undefined> => reader().read(file)

let ownedDocuments: Documents | undefined
export const holdDocuments = (value: Documents): (() => void) => {
 ownedDocuments = value
 return () => { if (ownedDocuments === value) ownedDocuments = undefined }
}

export const useDocumentEditor = (pane: string, file: string): DocumentEditor => reader().editor(pane, file)
