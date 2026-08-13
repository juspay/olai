/**
 * What day it is, reachable from wherever a DATE is drawn.
 *
 * The clock itself is `./clock.ts` and there is still only one of it: this is
 * how its answer reaches the rows. A date badge takes the attention tone when
 * the node it belongs to is overdue (`@olai/format`'s `isOverdue`), and that
 * predicate needs today — so every row of a thousand-row tree needs today, and
 * threading it through `Tree` → `Row` → `NodeLine` would make three signatures
 * a function of what one leaf draws. That is the same argument `./derived.tsx`
 * makes about the indexes, and the same one the router makes about navigation.
 *
 * The value is an ACCESSOR, for the reason the derivation's is: today MOVES —
 * at the next local midnight, and whenever a sleeping tab comes back — and a
 * context holding the string itself would hand out the day the page mounted
 * on, which is exactly the stale thing this app promises never to show.
 */

import { createContext, type JSX, useContext } from "solid-js"

const TodayContext = createContext<() => string>()

export function TodayProvider(props: {
  /** Today, in the reader's own time zone, as the ISO text the format stores. */
  readonly today: string
  readonly children: JSX.Element
}) {
  return (
    <TodayContext.Provider value={() => props.today}>
      {props.children}
    </TodayContext.Provider>
  )
}

/** Today, for a component under the provider — or a throw, which is a bug in
 *  this app rather than a state a reader can reach. */
export const useToday = (): (() => string) => {
  const today = useContext(TodayContext)
  if (today === undefined) throw new Error("a today lookup outside <TodayProvider>")
  return today
}
