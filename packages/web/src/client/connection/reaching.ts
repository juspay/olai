/**
 * Can a QUESTION reach the server right now?
 *
 * A different question from what the pill DRAWS (`./status.ts`, which is the
 * look and only the look), and it arrived the day a page started asking things
 * it used to answer for itself: the filter over the page is a procedure call
 * now (`../filter/asking.ts`), and a call sent down a socket that is not there
 * is not a slower answer, it is no answer.
 *
 * IT IS ALSO THE FREEZE. `./Offline.tsx` draws its overlay over the whole app
 * exactly while this says no — the human's §5b ruling — so "a door may not
 * speak" and "the app is frozen" are one predicate rather than two lists of
 * state names that could drift apart. That is why what is left here is a
 * BOOLEAN: a door used to draw its own inert face wearing the pill's sentence,
 * and under an overlay that covers the app there is no door to draw it on.
 *
 * A `Record` over the readout's own states rather than a comparison, so a sixth
 * state arriving upstream is a type error here — a door that has to decide
 * whether to speak must not inherit a default about a state nobody has thought
 * about.
 *
 * `degraded` is `true` on purpose, and it is the one line worth arguing: it
 * means a subscription riding this socket stopped, not that the socket did, so
 * a procedure sent down it still lands and still answers. What is missing under
 * a degraded readout is whatever those subscriptions carry, which the pill
 * already says in its own words — and the app is not frozen for it.
 */

import type { SurfaceReadout, SurfaceReadoutStatus } from "./status.ts"

const REACHES: Record<SurfaceReadoutStatus, boolean> = {
  /** The first dial has not answered yet — there is nowhere to send it. */
  connecting: false,
  live: true,
  degraded: true,
  /** The link is re-dialling on its own; what is on screen is the last thing
   *  the server said, and a question asked now is asked into nothing. */
  reconnecting: false,
  /** The server that served this page has been replaced. There is nothing to
   *  wait for — recovery is a reload, which the overlay offers. */
  retired: false,
}

export const reachable = (readout: SurfaceReadout): boolean => REACHES[readout.status]
