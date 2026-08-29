/**
 * How long the work on a row TOOK, or is still TAKING — the ⏱ chip's two
 * voices.
 *
 * A SETTLED row — `done` or `cancelled` — wears the length of it, always
 * drawn, never ticking: `⏱ 2h 34m` in the quiet register every other fact
 * beside a title takes. A DOING row says how long it has been under way, and
 * that number moves: the stored `started` crosses the wire once with the row,
 * and the TICK IS LOCAL — the same seam the header's uptime chip wears
 * (`./uptime.ts`): no polling, no duration the server would have to keep
 * sending, one clock read against the wire-carried instant.
 *
 * THE ARITHMETIC IS PURE and takes `now` as an argument, so the ladders are a
 * table of cases in `./took.test.ts` rather than something you have to wait
 * an hour to see. Only {@link createNow} touches a clock, and what it ticks
 * is `./clock.ts`'s — the same split `./uptime.ts` itself makes, and the one
 * `claims.test.ts` holds every readout to.
 *
 * What is NOT here: the span itself. That is derived once, on the side that
 * holds the set (@olai/format's `tookOf`), and the chip reads it off the row
 * the way it reads the instant — nothing about "started minus settled" is
 * spelled at a frame rate, and the two readers cannot drift.
 */

import type { Accessor } from "solid-js"

import { createTwoSpeed, HOUR, SECOND } from "./clock.ts"

/**
 * A SETTLED span in the chip's own words — the coarsest that still tell the
 * length, coarser as it grows.
 *
 * Seconds below a minute because a `47s` is the pomodoro's own unit; minutes
 * alone below an hour, and an hour keeps its remainder (`2h 34m`, never
 * `2.5h`): the chip is a count, not a measurement. Past a day the minutes
 * stop mattering to a reader and the hours are the remainder.
 *
 * A NEGATIVE arrives AS `0s` and not as a negative: a `started` after the
 * settle is a browser clock behind the server's or a record a hand wrote, and
 * @olai/format's `tookOf` already clamps the value it derived — a word like
 * `-3m` would only be a worse spelling of zero. Asked at the boundary, so an
 * honest input floats nothing up.
 */
export const wordsOf = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/**
 * A RUNNING span in the pomodoro register the mock rules: under an hour the
 * tense `m:ss`, ticking by the second — the digit that tells a reader the
 * clock is alive; at an hour and past it the settled words, because by then
 * nobody is watching the last digit and a number that changes every second is
 * one the eye cannot rest on (`./chat/elapsed.ts`'s ruling, read once more).
 */
export const tickingOf = (elapsedMs: number): string => {
  const elapsed = Math.max(0, elapsedMs)
  if (elapsed < HOUR) {
    const seconds = Math.floor(elapsed / SECOND)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  }
  return wordsOf(elapsed / SECOND)
}

/**
 * The clock a doing row's chip is drawn against — a second while the second
 * digit is the register, a minute once the words are the settled ones'. The
 * machinery is the uptime chip's own seam, `clock.ts`'s
 * ({@link createTwoSpeed} — which is WHERE it lives: two readouts asking the
 * same two-speed question is where a handoff stops being incidental); the
 * only thing this chip adds is its BAND, an hour. The whole thing exists for
 * the doing arm alone: a settled row's words never move, so a settled row
 * keeps no clock at all.
 */
export const createNow = (
  started: Accessor<string | undefined>,
): Accessor<number> => createTwoSpeed(started, HOUR)
