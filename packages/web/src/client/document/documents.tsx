/**
 * The documents of the set, reachable from wherever a `doc` is drawn.
 *
 * A node's `doc` shows a line of its document, and a node is drawn on every
 * page there is — a tree row, a zoomed heading, a day. Threading the set's
 * documents through every row of a thousand-row tree to answer that would make
 * every component's signature a function of what one of its descendants
 * happens to need, which is exactly the reason the router is a context too.
 *
 * The value is an ACCESSOR, not a map: documents change under an open page —
 * that is the whole point of the live store — and a context holding the map
 * itself would hand out the one that was current when the page mounted.
 */

import type { Document } from "@olai/format"
import { createContext, createMemo, type JSX, useContext } from "solid-js"

const DocumentsContext = createContext<() => ReadonlyMap<string, Document>>()

export function DocumentsProvider(props: {
  readonly documents: ReadonlyArray<Document>
  readonly children: JSX.Element
}) {
  // Indexed once per frame rather than scanned per row: a `doc` is looked up
  // by path, and a page can draw many of them.
  const byFile = createMemo(
    () =>
      new Map<string, Document>(
        props.documents.map((document) => [document.file, document] as const),
      ),
  )
  return (
    <DocumentsContext.Provider value={byFile}>
      {props.children}
    </DocumentsContext.Provider>
  )
}

/** One served document, by its path — `undefined` when the set has none by
 *  that name, which a valid set cannot produce (`doc` is validated against the
 *  documents found) but a set being edited can. */
export const useDocument = (file: () => string): () => Document | undefined => {
  const documents = useContext(DocumentsContext)
  if (documents === undefined) {
    throw new Error("a document reference outside <DocumentsProvider>")
  }
  return () => documents().get(file())
}
