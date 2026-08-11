/**
 * The documents of the set, read one at a time, from wherever one is drawn.
 *
 * A node's `doc` shows a line of its document, and a node is drawn on every
 * page there is — a tree row, a zoomed heading, a day. Threading the set's
 * documents through every row of a thousand-row tree to answer that would make
 * every component's signature a function of what one of its descendants
 * happens to need, which is exactly the reason the router is a context too.
 *
 * What this holds is no longer a map of the corpus: it is the set of documents
 * SOMEBODY IS SHOWING, which is the `keys` of one narrowed subscription over
 * the `documents` collection. A `.md` body reaches this tab when a component
 * asks for it and stops arriving when the last one that asked goes away —
 * because the wire's whole shape (`@olai/surface`: `keys` + `get`, no
 * `deltas`) is that a body is fetched per key rather than pushed per set. A
 * directory with a thousand documents in it costs a thousand paths and the
 * bodies of the one or two on screen.
 *
 * ONE subscription per PATH, however many components ask: the count is what
 * decides membership, so two rows attached to the same document share the
 * stream, and neither one's unmount cancels the other's. A narrowed `.use()`
 * is honestly its own subscription with no dedup of its own, so a per-consumer
 * `.use()` here would be one socket stream per doc-carrying ROW.
 *
 * The value is an ACCESSOR, not a record: documents change under an open page
 * — that is the whole point of the live store — and what a per-key `get`
 * delivers on an edit is the new body on the same key.
 */

import type { DocumentEntry } from "@olai/surface"
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import { olai } from "../wire.ts"

/** Ask for one document by path, for as long as the calling owner lives. */
type Reader = (file: Accessor<string>) => Accessor<DocumentEntry | undefined>

const DocumentsContext = createContext<Reader>()

export function DocumentsProvider(props: { readonly children: JSX.Element }) {
  /** The paths asked for, and how many askers each has. The signal is what the
   *  subscription watches; the map is the bookkeeping that keeps a path in it
   *  until the LAST asker is gone. */
  const [wanted, setWanted] = createSignal<string[]>([])
  const askers = new Map<string, number>()

  const hold = (file: string): void => {
    const before = askers.get(file) ?? 0
    askers.set(file, before + 1)
    if (before === 0) setWanted((paths) => [...paths, file])
  }
  const release = (file: string): void => {
    const before = askers.get(file) ?? 0
    if (before > 1) {
      askers.set(file, before - 1)
      return
    }
    askers.delete(file)
    setWanted((paths) => paths.filter((path) => path !== file))
  }

  // A NARROWED subscription: `keys` is the set above rather than the server's
  // whole key set, so the per-key streams the framework opens are exactly the
  // documents being shown. A key leaving `wanted` disposes its own reactive
  // owner, which closes that stream server-side — no teardown to write here.
  const entries = olai.collections.documents.use({ keys: wanted })

  const read: Reader = (file) => {
    // An EFFECT, so the interest follows a component whose `file` moves (a doc
    // reference re-keyed onto another node) and is dropped when the component
    // that wanted it goes away — the cleanup runs on both.
    createEffect(() => {
      const path = file()
      hold(path)
      onCleanup(() => release(path))
    })
    return () => entries.byKey(file())?.()
  }

  return (
    <DocumentsContext.Provider value={read}>
      {props.children}
    </DocumentsContext.Provider>
  )
}

/** One served document, by its path. `undefined` while its body is still on the
 *  way — which is the normal first state now, and also what a set being edited
 *  answers for a `doc` naming a file that is no longer there (a valid set
 *  cannot produce that: `doc` is validated against the documents found). */
export const useDocument = (
  file: () => string,
): Accessor<DocumentEntry | undefined> => {
  const read = useContext(DocumentsContext)
  if (read === undefined) {
    throw new Error("a document reference outside <DocumentsProvider>")
  }
  return read(file)
}
