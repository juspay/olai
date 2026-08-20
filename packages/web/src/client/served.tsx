/**
 * The served directory's files, as one list of paths, reachable from anywhere.
 *
 * Two collections carry them and always have — the outlines' keys and the
 * documents' key set — and three things now want them TOGETHER: the sidebar,
 * which draws them as a tree (`./fileTree.ts`); the chat composer, which
 * completes a path into a message when somebody types `@`; and the two search
 * doors, whose document rows are the bodied ones matched by name
 * (`./search/nodes.ts`, over one index on the server). The composer asks
 * through `./file/matching.ts`. The sidebar is handed them as props because it is
 * drawn one level under the app; the composer is five levels under it, inside
 * whichever of the two chat shells this viewport uses, so it is a context for
 * the reason `./derived.tsx` is one: threading a list through `Panel` → `Face`
 * → `Body` would make every component's signature a function of what one
 * descendant happens to need.
 *
 * The value is an ACCESSOR, again for `./derived.tsx`'s reason: a directory
 * gains and loses files while a tab is open, and a context holding the array
 * would hand out the one that was current when the panel mounted.
 *
 * ## Everything the directory holds, archives included
 *
 * The sidebar hides `_olai/Trash.olai` from its tree — an archive is not an
 * outline a reader opens and edits, and the Trash entry below the tree is its
 * one way in. This list keeps it, because it is answering a different
 * question: what a message may NAME. The agent reads files, an archive is a
 * file, and "what did we put away last month" is a fair thing to ask about.
 * Nothing is added to the set that the server does not serve — this is the
 * two key sets, joined and ordered, and never a third reading of the disk.
 */

import type { Face } from "@olai/format"
import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

const ServedContext = createContext<Accessor<ReadonlyArray<string>>>()

/** The same paths in the same order — what "the directory has not changed"
 *  means for a list that is rebuilt whenever either half of it speaks. Both
 *  lists are already sorted, so this is a walk rather than a set comparison. */
const same = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean => a.length === b.length && a.every((path, at) => path === b[at])

export function ServedProvider(props: {
  /** Every served file as its FACE, in the directory's own order — the one
   *  collection the app reads a directory as (`./page.ts`'s `Found`). */
  readonly faces: ReadonlyArray<Face>
  readonly children: JSX.Element
}) {
  // `equals` COMPARES THE MEMBERSHIP, and that is what makes this list's
  // IDENTITY mean "the directory changed" rather than "a frame arrived". The
  // faces are minted fresh whenever either collection speaks — a key set
  // re-sent unchanged is still a new array — and downstream there is a fold
  // kept against this very array (`./file/matching.ts`, a `WeakMap`), so without
  // this the vault would be re-folded for frames that said nothing. A memo
  // with no `equals` compares by reference and would never notice.
  const files = createMemo(
    () => props.faces.map((face) => face.path),
    undefined,
    { equals: same },
  )
  // The faces themselves, for the one reader that wants more than a path. An
  // ACCESSOR over the prop rather than the array, for the same reason the
  // paths are one: a directory gains and loses files while a tab is open.
  const faces = () => props.faces
  return (
    <ServedContext.Provider value={files}>
      <FacesContext.Provider value={faces}>
        {props.children}
      </FacesContext.Provider>
    </ServedContext.Provider>
  )
}

/** Every served path, in directory order — or a throw when a consumer is drawn
 *  outside the provider, which is a bug in this app rather than a state a
 *  reader can reach (`./derived.tsx`'s rule, kept). */
export const useServed = (): Accessor<ReadonlyArray<string>> => {
  const files = useContext(ServedContext)
  if (files === undefined) {
    throw new Error("a served-file lookup outside <ServedProvider>")
  }
  return files
}

/** The same directory as its FACES — what a file is called, where it points,
 *  what it tags — for the one reader that needs more than a path: a document's
 *  page, which says who points at it (`./document/Referrers.tsx`). */
export const useFaces = (): Accessor<ReadonlyArray<Face>> => {
  const faces = useContext(FacesContext)
  if (faces === undefined) {
    throw new Error("a served-face lookup outside <ServedProvider>")
  }
  return faces
}

const FacesContext = createContext<Accessor<ReadonlyArray<Face>>>()
