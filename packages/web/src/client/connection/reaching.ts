/**
 * Can a QUESTION reach the server right now?
 *
 * A different question from what the pill DRAWS (`./status.ts`, which is the
 * look and only the look), and it arrived the day a page started asking things
 * it used to answer for itself: the filter over the page is a procedure call
 * now (`../filter/asking.ts`), and a call sent down a socket that is not there
 * is not a slower answer, it is no answer.
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
 * already says in its own words.
 */

import { lookOf, type SurfaceReadout, type SurfaceReadoutStatus } from "./status.ts"

const REACHES: Record<SurfaceReadoutStatus, boolean> = {
  /** The first dial has not answered yet — there is nowhere to send it. */
  connecting: false,
  live: true,
  degraded: true,
  /** The link is re-dialling on its own; what is on screen is the last thing
   *  the server said, and a question asked now is asked into nothing. */
  reconnecting: false,
  /** The server that served this page has been replaced. There is nothing to
   *  wait for — recovery is a reload. */
  retired: false,
}

export const reachable = (readout: SurfaceReadout): boolean => REACHES[readout.status]

/**
 * ...and WHY NOT, in the connection pill's own words — `null` while a question
 * can be asked.
 *
 * The half a door actually draws, and it is here rather than in the door
 * because it is the same sentence wherever it is said: the pill is where this
 * app tells somebody what its wire is doing (`./status.ts`'s `lookOf`), and a
 * second wording of it beside a disabled box would be two claims about one
 * socket, free to disagree.
 */
export const unreachable = (readout: SurfaceReadout): string | null =>
  reachable(readout) ? null : lookOf(readout).detail
