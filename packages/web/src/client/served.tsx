/**
 * The served directory's files, as one list of paths, reachable from anywhere.
 *
 * Two collections carry them and always have — the outlines' keys and the
 * documents' key set — and two things now want them TOGETHER: the sidebar,
 * which draws them as a tree (`./fileTree.ts`), and the chat composer, which
 * completes a path into a message when somebody types `@` (`./chat/files.ts`).
 * The sidebar is handed them as props because it is drawn one level under the
 * app; the composer is five levels under it, inside whichever of the two chat
 * shells this viewport uses, so it is a context for the reason `./derived.tsx`
 * is one: threading a list through `Panel` → `Face` → `Body` would make every
 * component's signature a function of what one descendant happens to need.
 *
 * The value is an ACCESSOR, again for `./derived.tsx`'s reason: a directory
 * gains and loses files while a tab is open, and a context holding the array
 * would hand out the one that was current when the panel mounted.
 *
 * ## Everything the directory holds, archives included
 *
 * The sidebar hides `Archive.olai` from its tree — an archive is not an
 * outline a reader opens and edits, and the Trash entry below the tree is its
 * one way in. This list keeps it, because it is answering a different
 * question: what a message may NAME. The agent reads files, an archive is a
 * file, and "what did we put away last month" is a fair thing to ask about.
 * Nothing is added to the set that the server does not serve — this is the
 * two key sets, joined and ordered, and never a third reading of the disk.
 */

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

import { sortByPath } from "./paths.ts"

const ServedContext = createContext<Accessor<ReadonlyArray<string>>>()

/** The same paths in the same order — what "the directory has not changed"
 *  means for a list that is rebuilt whenever either half of it speaks. Both
 *  lists are already sorted, so this is a walk rather than a set comparison. */
const same = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean => a.length === b.length && a.every((path, at) => path === b[at])

export function ServedProvider(props: {
  /** The outlines' keys — every `.olai` the directory holds. */
  readonly outlines: ReadonlyArray<string>
  /** The documents' key set — every `.md` and `.html`, paths only, no bodies
   *  (`./document/documents.tsx` says why that distinction is load-bearing). */
  readonly documents: ReadonlyArray<string>
  readonly children: JSX.Element
}) {
  // ONE ORDER for the two lists, and it is the directory's own
  // (`./paths.ts`): the outlines arrive in the collection's arrival order and
  // the documents in theirs, so a file created while the tab was open would
  // otherwise sit at the bottom of every list that shows it.
  //
  // `equals` COMPARES THE MEMBERSHIP, and that is what makes this list's
  // IDENTITY mean "the directory changed" rather than "a frame arrived". Both
  // sources mint a fresh array whenever their own stream speaks — a key set
  // re-sent unchanged is still a new array — and downstream there is a fold
  // kept against this very array (`./chat/files.ts`, a `WeakMap`), so without
  // this the vault would be re-folded for frames that said nothing. A memo
  // with no `equals` compares by reference and would never notice.
  const files = createMemo(
    () => sortByPath([...props.outlines, ...props.documents]),
    undefined,
    { equals: same },
  )
  return (
    <ServedContext.Provider value={files}>
      {props.children}
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
