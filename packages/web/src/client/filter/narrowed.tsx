/**
 * Whether a filter is on, reachable from wherever a row is drawn.
 *
 * Two things every row of a filtered tree has to know, and neither is a
 * property of the row: whether it MATCHED (so the page can say which rows the
 * query actually found, rather than which ones are ancestors of one), and
 * whether folds are suspended.
 *
 * FOLDS ARE SUSPENDED WHILE A FILTER IS ON, and that is the decision this
 * context exists to carry. A fold is a claim about a tree the reader was
 * reading; a filter produces a different tree, and honouring a collapse inside
 * it would hide the very match the filter was typed to find. Nothing is
 * written: the fold memory (`../fold/memory.ts`) is untouched, and clearing the
 * filter restores every collapse exactly as it was.
 *
 * A context rather than a prop for the reason `../derived.tsx` is one: a tree
 * of a thousand rows should not thread two more arguments through every level
 * to answer what one binding on each row asks. The default is the honest
 * "nothing is filtered", for a `<Tree>` drawn outside the provider — which no
 * page does today (both tree pages sit inside it), so it is a promise about the
 * component rather than a state a reader can reach. A default rather than a
 * throw because "no filter" is a real thing to be, unlike a missing router.
 */

import { createContext, type JSX, useContext } from "solid-js"

import { NOTHING_MATCHED, type Narrowing } from "./narrowing.ts"

/**
 * The two halves of the page's reading (`./narrowing.ts`) that a ROW asks for:
 * whether a filter is on, and which nodes it selected.
 *
 * A VIEW of that one value rather than a second declaration of the same two
 * fields — the page has exactly one narrowing, and a parallel interface saying
 * the same thing is a second place for the two to drift. What it adds is a
 * DEFAULT (below), which is the whole reason a row asks a context instead of
 * the page.
 */
export type Narrowed = Pick<Narrowing, "active" | "matched">

const NOTHING: Narrowed = {
  active: () => false,
  matched: () => NOTHING_MATCHED,
}

const NarrowedContext = createContext<Narrowed>(NOTHING)

export function NarrowedProvider(props: {
  readonly narrowed: Narrowed
  readonly children: JSX.Element
}) {
  return (
    <NarrowedContext.Provider value={props.narrowed}>
      {props.children}
    </NarrowedContext.Provider>
  )
}

/** What this page is narrowed by — "nothing", for a tree drawn outside a
 *  provider. A default rather than a throw, because "no filter" is a real
 *  state a page can be in and not a bug. */
export const useNarrowed = (): Narrowed => useContext(NarrowedContext)
