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

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

import { sameList } from "./same.ts"

const ServedContext = createContext<Accessor<ReadonlyArray<string>>>()

export function ServedProvider(props: {
  /** Every served file's PATH, in the directory's own order — the one list the
   *  app reads a directory as (`./directory.ts`). */
  readonly paths: ReadonlyArray<string>
  /** Which revision one file is at — see the header. */
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
  readonly children: JSX.Element
}) {
  // `equals` COMPARES THE MEMBERSHIP, and that is what makes this list's
  // IDENTITY mean "the directory changed" rather than "a frame arrived".
  // Downstream there is a fold of the vault kept against this very array
  // (`./file/matching.ts`, a `WeakMap`), so a list that moves for any other
  // reason re-folds the vault for a frame that said nothing. A memo with no
  // `equals` compares by reference and would never notice.
  //
  // AND IT IS A NARROWER JOB THAN IT WAS, which is why it is still here. The
  // directory used to mint a fresh list on every frame it published; it rides
  // the head collection's own `fold` now and hands back the very array unless a
  // file arrived or left (`./directory.ts`). What that leaves for this compare
  // is the case the fold cannot answer: a SNAPSHOT re-seeds every registered
  // fold and `init` has no previous accumulator to hand back, so a reconnect
  // mints a fresh list naming the same files. A link flap must not re-fold the
  // vault, and this is the one line that says so.
  //
  // A PLAIN HOLD, and that is the whole of it now. It used to be a `map` off
  // the faces — `n` property reads per frame to rebuild a list the directory's
  // own walk was already holding — and what is left is the comparison, which is
  // the part that has to live here beside the memo it guards.
  const files = createMemo(() => props.paths, undefined, { equals: sameList })
  return (
    <ServedContext.Provider value={files}>
      <HeadContext.Provider value={props.head}>
        {props.children}
      </HeadContext.Provider>
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

/** THE FACES REACH THIS FILE NO LONGER, and the absence is worth a line
 *  because it was two things. There was a `useFaces` beside the two contexts
 *  here, for "the one reader that needs more than a path" — a document's page,
 *  saying who points at it — and that reader moved onto the page's own reading
 *  when the browser stopped holding the vault (#279), leaving a third provider
 *  mounted and a closure over the app's props held open for nobody. With it
 *  gone, nothing under this provider wanted a `Face` at all, and the `map` that
 *  turned them back into paths was `n` property reads per frame to rebuild a
 *  list the directory's own walk was already holding. So the directory hands
 *  over the paths (`./directory.ts`'s `paths`), and what a `Face` is remains a
 *  fact about the wire rather than about this column. */

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
