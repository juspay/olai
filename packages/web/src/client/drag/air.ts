/**
 * WHAT IS IN THE AIR, for the whole workspace — the records a live drag is
 * carrying, and nothing else about the gesture.
 *
 * It is here rather than inside `./dragging.ts` because it is the one fact
 * about a drag that EVERY page has to know and only one page can answer. A
 * gesture belongs to the page the press landed on (that is what makes its
 * lifetime a page's, which is the whole argument in `../edit/Editable.tsx`),
 * but the rows it lifts may be DRAWN in two panes at once — two views of one
 * file — and a subtree that faded on one side while standing solid on the
 * other would be the affordance disagreeing with itself about what is moving.
 *
 * RECORDS, NOT PLACES, and that is the difference from what this replaced. A
 * `Row.key` is a chain from the roots of ITS page, so a set of keys is a
 * sentence only the page that minted them can read; a set of record ids is
 * legible in every page that draws them. It is also the more honest answer
 * inside one page: a node drawn twice — its own row, and again under an
 * expanded mirror of its parent — is ONE record moving, and both drawings of
 * it now fade.
 *
 * ONE SIGNAL FOR THE APP, because one gesture is live at a time (`../pointer.ts`
 * serialises them per owner, and two hands on two bullets is a pinch every
 * gesture here already refuses). Empty is the ordinary state and the one the
 * readers below are shaped for.
 */

import { type Accessor, createContext, createSignal, useContext } from "solid-js"

import { chainOf } from "../select/range.ts"

export interface Air {
  /** The records being carried right now — empty when nothing is. */
  readonly held: Accessor<ReadonlySet<string>>
  /** Lift these, or (with an empty set) put everything down. Called by the one
   *  gesture that is live, at the moment it becomes a drag and at the moment it
   *  ends, whichever way it ended. */
  readonly lift: (ids: ReadonlySet<string>) => void
}

const AirContext = createContext<Air>()

/** What is in the air. A throw outside the provider, for the reason
 *  `useDragging` throws: a row drawn outside the app is not one anybody can
 *  pick up. */
export const useAir = (): Air => {
  const air = useContext(AirContext)
  if (air === undefined) throw new Error("a drag consumer outside <App>")
  return air
}

export const AirProvider = AirContext.Provider

export const createAir = (): Air => {
  const [held, setHeld] = createSignal<ReadonlySet<string>>(new Set())
  return { held, lift: setHeld }
}

/**
 * Is the row at this place in the air — either lifted, or drawn under
 * something that was?
 *
 * A subtree moves whole, so the whole of it fades: a branch that lifted while
 * its children stayed solid would be saying the children are staying behind,
 * which is the one thing this gesture never does.
 *
 * THE EMPTY CASE FIRST, and it is not a micro-optimisation: this is asked once
 * per row on every frame the store publishes, and nothing is being dragged in
 * nearly all of them — without it, every row of the tree would split its key
 * to walk a set that has nothing in it.
 */
export const airborne = (held: ReadonlySet<string>, key: string): boolean =>
  held.size > 0 && chainOf(key).some((id) => held.has(id))
