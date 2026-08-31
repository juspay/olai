/**
 * THE FLEET A TAB HOLDS — the accumulator, with no JSX around it.
 *
 * Split out of `./fleet.tsx` so it can be driven by hand: the provider is a
 * component and the fold is arithmetic, and the arithmetic is where the two
 * things that can go wrong live — a delta applied to the wrong map, and a
 * re-seed that keeps a row the server has forgotten.
 *
 * It is the shape `../directory.ts` keeps for the head set, one collection
 * over, and for the same reason: what a reader depends on must move when the
 * fleet does and stay put when it does not, or every property chip on the page
 * re-runs for a frame that said nothing about it.
 */

import type { FleetTerminal } from "@olai/kolu-client/wire"

/**
 * The rows, and a number that moves when they do.
 *
 * TWO FIELDS RATHER THAN ONE MAP, because they answer two different needs. The
 * map is what a chip reads (by id, once, no walk); the counter is what a chip
 * DEPENDS on. Handing out a fresh map per frame would be the copy this fold
 * exists to avoid — thirty rows rebuilt per change on a busy machine — and
 * handing out the same map with no counter would be a value that never appears
 * to change, so nothing would re-run at all.
 */
export interface Held<T = FleetTerminal> {
  readonly rows: Map<string, T>
  readonly at: number
}

/** Nothing held yet — a fresh map each time, because it is about to be written
 *  into. This went GENERIC the day the events ring (`./EventsFeed.tsx`'s
 *  fold) started running the same arithmetic over the watcher's log: a
 *  second accumulator's file would be the two things that can go wrong,
 *  fenced twice. */
export const holdingNothing = <T = FleetTerminal,>(): Held<T> => ({ rows: new Map(), at: 0 })

/**
 * One frame, applied.
 *
 * MUTATES `held.rows` and hands back a fresh wrapper. That is the same split
 * `../directory.ts`'s fold makes and for its reason: the accumulator is
 * reachable from nowhere but the fold, so writing into it is safe, and the
 * wrapper is what a reactive reader compares.
 *
 * TOTAL OVER A REMOVE IT HAS NEVER SEEN, which the framework requires and is
 * not merely tolerant of: the server's tick coalescer turns an
 * upsert-then-remove within one tick into a BARE remove, so a terminal opened
 * and closed between two frames reaches a tab as a remove with no upsert
 * before it. `Map.delete` of an absent key is the whole of the handling.
 */
export const after = <T,>(
  held: Held<T>,
  upserts: ReadonlyArray<readonly [string, T]>,
  removes: ReadonlyArray<string>,
): Held<T> => {
  for (const [id, row] of upserts) held.rows.set(id, row)
  for (const id of removes) held.rows.delete(id)
  // The counter moves on EVERY frame, including one that changed nothing. That
  // costs a memo re-run per chip and no allocation; comparing thirty rows to
  // save it would cost more than it saves, and a frame that says nothing is
  // rare — the server publishes a row when padi moves it, not on a timer.
  return { rows: held.rows, at: held.at + 1 }
}

/**
 * A FULL SET — the wire's first frame, every reconnect snapshot, and the
 * seeding a fold registered mid-stream is given.
 *
 * A FRESH MAP, and that is the one line in this module that is a decision
 * rather than bookkeeping: a snapshot REPLACES. Applying it onto the map in
 * hand would keep any row padi dropped while the socket was down — a terminal
 * that was killed during a link flap would sit on the page wearing its last
 * face, forever, because nothing will ever send a remove for it.
 */
export const seeded = <T,>(
  entries: ReadonlyArray<readonly [string, T]>,
): Held<T> => after(holdingNothing<T>(), entries, NO_REMOVES)

const NO_REMOVES: ReadonlyArray<string> = []
