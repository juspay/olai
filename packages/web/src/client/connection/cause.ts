/**
 * WHY A SOCKET THAT HAD OPENED ENDED — picked from typed facts the page itself
 * gathered on that socket, never from an error's text.
 *
 * The first question is who closed it. A socket the page never called `close()`
 * on was ended by the server or the network, and its close code says the rest.
 * A socket the page did close was closed by kolu's own recovery or by olai, and
 * the facts below say which, in this order:
 *
 *   1. a frame on it was larger than the wire's cap — the decoder refused it;
 *   2. the heartbeat gave up on it — it was open and silent;
 *   3. olai declared it — a redial, a roster refresh, the page going away;
 *   4. none of those: kolu closed it for a reason only kolu saw (its keep-alive
 *      timing out, a line that was not valid JSON). What its subscriptions
 *      were told is on the drop beside it, verbatim, as `heard`.
 *
 * The order is the strength of the evidence: the cap and the heartbeat are
 * facts about this socket, and a declaration only says what olai meant to do.
 */
import type { Cause } from "@olai/log/link"

/** What the page knows about one socket when it ended. */
export interface DropFacts {
  /** The page called `close()` on it (or was itself going away). */
  readonly pageClosed: boolean
  /** A frame on it was over the cap. */
  readonly overCap: boolean
  /** The heartbeat's verdict fell on it. */
  readonly stale: boolean
  /** What olai declared when it closed it, if it did. */
  readonly intent: "roster-refresh" | "redial" | "unload" | undefined
}

export const causeOf = (facts: DropFacts): Cause =>
  !facts.pageClosed
    ? "peer-closed"
    : facts.overCap
    ? "frame-over-cap"
    : facts.stale
    ? "half-open"
    : facts.intent ?? "severed"
