/**
 * How long a call has been running, reachable from the row that draws one.
 *
 * The RULE is {@link ./elapsed.ts} and there is still only one of it: this is
 * how its answer reaches the frames. It is the arrangement `../today.tsx` has
 * with `../clock.ts`, and it is here for that file's own argument, one panel
 * over: the readout is drawn by {@link ./ToolFrame.tsx}, the answer needs two
 * things only the LIST can hold — whether a turn is in flight at all, and one
 * clock for the panel rather than one per row — and threading it down would
 * make `Entry`'s signature, and its six-armed switch, a function of what one
 * leaf draws. A tool frame already reaches for `./folds.ts` the same way rather
 * than taking an `open` prop.
 *
 * WHAT IS PROVIDED IS THE READING, not its two ingredients. A consumer handed
 * `live` and a clock would have to compose them with `elapsedOf` itself, which
 * is a rule re-assembled at every call site and free to be assembled
 * differently at the next one; handed the reading, there is one answer and the
 * only way to ask is to ask.
 *
 * IT IS ALSO WHAT KEEPS THE TICK CHEAP. The reading is a plain function rather
 * than a signal, so nothing subscribes to the clock by holding it: a row that
 * is not a running call never gets past `elapsedOf`'s gates, so it never reads
 * `now` and a tick does not wake it. What computes the answer is the `<Show>`
 * in the frame that draws it — which exists only for tool rows.
 *
 * The provider owns the CLOCK, so its lifetime is the panel's: opened and shut
 * with the drawer, gated on the same `live` the words are, and stopped by the
 * framework rather than by anybody remembering to.
 */

import type { ChatEntry } from "@olai/surface"
import { createContext, type JSX, useContext } from "solid-js"

import { createNow, elapsedOf } from "./elapsed.ts"

/** What the transcript says about how long a row has been running. */
type Elapsed = (entry: ChatEntry) => string | null

const ElapsedContext = createContext<Elapsed>()

export function ElapsedProvider(props: {
  /** Whether a turn is in flight in this conversation at all — the half a ROW
   *  cannot see, and the reason this is a provider rather than a call the frame
   *  could make for itself ({@link ./elapsed.ts}). A value rather than an
   *  accessor, like `../today.tsx`'s day: props are getters, so reading it
   *  inside the reading below is already a subscription. */
  readonly live: boolean
  readonly children: JSX.Element
}) {
  const now = createNow(() => props.live)
  return (
    <ElapsedContext.Provider value={(entry) => elapsedOf(entry, props.live, now)}>
      {props.children}
    </ElapsedContext.Provider>
  )
}

/** How long a row has been running, for a component under the provider — or a
 *  throw, which is a bug in this app rather than a state a reader can reach. */
export const useElapsed = (): Elapsed => {
  const elapsed = useContext(ElapsedContext)
  if (elapsed === undefined) throw new Error("an elapsed lookup outside <ElapsedProvider>")
  return elapsed
}
