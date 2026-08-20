/**
 * The served directory's files, as one list of paths, reachable from anywhere.
 *
 * ONE collection carries them (`./directory.ts`, over the wire's `heads`) and
 * three things want them: the sidebar, which draws them as a tree
 * (`./fileTree.ts`); the chat composer, which completes a path into a message
 * when somebody types `@`; and the two search doors, whose document rows are
 * the bodied ones matched by name (`./search/nodes.ts`, over one index on the
 * server). The composer asks through `./file/matching.ts`. The sidebar is
 * handed them as props because it is drawn one level under the app; the
 * composer is five levels under it, inside whichever of the two chat shells
 * this viewport uses, so it is a context for the reason `./reading.tsx` is one:
 * threading a list through `Panel` → `Face` → `Body` would make every
 * component's signature a function of what one descendant happens to need.
 *
 * The value is an ACCESSOR, again for `./reading.tsx`'s reason: a directory
 * gains and loses files while a tab is open, and a context holding the array
 * would hand out the one that was current when the panel mounted.
 *
 * ## And which revision each file is at
 *
 * The third thing this carries, and it is the same key set answering a third
 * question about itself (`./directory.ts`): a `.html` preview watches its own
 * file for changes and draws none of its bytes off the wire, so what it wants
 * is a NUMBER that moves when the file does. It rides here rather than in a
 * context of its own because it is one more reading of the directory, and a
 * second provider around the same value would be a second place to keep in step
 * with the one member that answers all three.
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

import { sameList } from "./lists.ts"

const ServedContext = createContext<Accessor<ReadonlyArray<string>>>()

export function ServedProvider(props: {
  /** Every served file as its FACE, in the directory's own order — the one
   *  list the app reads a directory as (`./directory.ts`). */
  readonly faces: ReadonlyArray<Face>
  /** Which revision one file is at — see the header. */
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
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
    { equals: sameList },
  )
  // The faces themselves, for the one reader that wants more than a path. An
  // ACCESSOR over the prop rather than the array, for the same reason the
  // paths are one: a directory gains and loses files while a tab is open.
  const faces = () => props.faces
  return (
    <ServedContext.Provider value={files}>
      <FacesContext.Provider value={faces}>
        <HeadContext.Provider value={props.head}>
          {props.children}
        </HeadContext.Provider>
      </FacesContext.Provider>
    </ServedContext.Provider>
  )
}

/** Every served path, in directory order — or a throw when a consumer is drawn
 *  outside the provider, which is a bug in this app rather than a state a
 *  reader can reach (`./reading.tsx`'s rule, kept). */
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

const HeadContext = createContext<
  (file: Accessor<string>) => Accessor<number | undefined>
>()

/** Which revision one served file is at — the question a reader asks when what
 *  it needs to know is that the file MOVED, and nothing about what it now says
 *  (`./document/Hypertext.tsx`). A throw outside the provider, for the reason
 *  above. */
export const useHead = (
  file: Accessor<string>,
): Accessor<number | undefined> => {
  const head = useContext(HeadContext)
  if (head === undefined) throw new Error("a head lookup outside <ServedProvider>")
  return head(file)
}
