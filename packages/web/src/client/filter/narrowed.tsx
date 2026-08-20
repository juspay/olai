/**
 * Whether a filter is on, reachable from wherever a row is drawn.
 *
 * Two things every row of a filtered tree has to know, and neither is a
 * property of the row: WHY IT IS DRAWN — whether the query selected it, and
 * where in it the words landed, so the row can say so rather than leaving the
 * reader to guess — and whether folds are suspended.
 *
 * This file is the WAY THERE and not the answers: what a row asks of the value
 * below is `./why.ts`, which is pure and takes the view rather than the
 * context. The two are split because this one is a component and that one is
 * asked by three surfaces and by a test.
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

import { NO_NEEDLES } from "./lit.ts"
import { NOTHING_MATCHED, type Narrowing } from "./narrowing.ts"

/**
 * The three parts of the page's reading (`./narrowing.ts`) that a ROW asks for:
 * whether a filter is on, which nodes it selected and why, and the words to
 * light up in the one it selected.
 *
 * A VIEW of that one value rather than a second declaration of the same fields
 * — the page has exactly one narrowing, and a parallel interface saying the
 * same thing is a second place for the two to drift. What it adds is a DEFAULT
 * (below), which is the whole reason a row asks a context instead of the page.
 */
export type Narrowed = Pick<Narrowing, "active" | "answered" | "matched" | "needles">

const NOTHING: Narrowed = {
  active: () => false,
  // Nothing was asked, so nothing is outstanding: an unfiltered page is
  // answered by definition, and a row outside a provider draws no match facts
  // because there is no filter rather than because one is in flight.
  answered: () => true,
  matched: () => NOTHING_MATCHED,
  needles: () => NO_NEEDLES,
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
