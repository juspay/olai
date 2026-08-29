/**
 * How long the SERVER has been up, in a phrase.
 *
 * The header chip is furniture: `up 2h`, coarse on purpose, the same voice
 * as the committed pill's `· 3m ago`. The instant it is measured from is
 * the PROCESS's, crossed once on `app.get` (`./named.ts`), never this tab's
 * open and never a duration the wire would have to keep sending. The client
 * ticks locally from that one landing. A restart retires the tab; the page
 * that reloads is a new ask of a new process, which is why it can read
 * `up 12s`.
 *
 * The arithmetic is PURE and takes `now` as an argument, so it is a table
 * of cases in a unit test rather than something you have to wait an hour
 * to see. Only the ticking half touches a clock, and what it ticks is
 * `./clock.ts`'s — the same split {@link ./commit/ago.ts} makes.
 */

import type { Accessor } from "solid-js"
import { createEffect, createSignal, onCleanup } from "solid-js"

import { createTicking, DAY, HOUR, instantOf, MINUTE, SECOND } from "./clock.ts"

/**
 * `startedAt` as a phrase relative to `now`.
 *
 * Coarse on purpose, and it gets coarser as it goes on: seconds matter for
 * a process that just came back and nothing else does. A stamp ahead of the
 * reader — a clock that disagrees with the server's — reads as `up 0s`
 * rather than as a negative. A stamp that is not a time says nothing at
 * all, which is the cue to draw no chip.
 */
export const upOf = (startedAt: string, now: number): string => {
  const then = instantOf(startedAt)
  if (then === null) return ""
  const since = Math.max(0, now - then)
  if (since < MINUTE) return `up ${Math.floor(since / SECOND)}s`
  if (since < HOUR) return `up ${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `up ${Math.floor(since / HOUR)}h`
  return `up ${Math.floor(since / DAY)}d`
}

/**
 * Whether {@link upOf} still draws seconds — the band a one-second tick
 * is worth, and the band a one-minute tick is not yet.
 */
export const stillSeconds = (startedAt: string, now: number): boolean => {
  const then = instantOf(startedAt)
  if (then === null) return false
  return now - then < MINUTE
}

/**
 * The exact start instant, for the tip and the visually-hidden copy —
 * never hover-only, because the hidden span says the same sentence.
 *
 * The ISO the wire sent, not a local reformat: "exact" is the string the
 * process minted, and a locale spelling would be a second clock.
 */
export const sinceOf = (startedAt: string): string => {
  if (instantOf(startedAt) === null) return ""
  return `up since ${startedAt}`
}

/**
 * The clock this chip is drawn against — a second while seconds are the
 * question, a minute once they are not.
 *
 * {@link createTicking} takes a fixed interval, so the handoff is a
 * signal: `slow` flips when the start is a minute old, the seconds
 * clock's gate closes, the minute clock's opens. A page that has not
 * heard a start — or heard one that is not a time — keeps neither.
 */
export const createNow = (
  started: Accessor<string | undefined>,
): Accessor<number> => {
  const [slow, setSlow] = createSignal(false)
  /** A parseable start — the same refusal {@link upOf} makes. An
   *  unparseable stamp must not keep the seconds clock: there is no
   *  chip to redraw. */
  const armed = (): boolean => {
    const at = started()
    return at !== undefined && instantOf(at) !== null
  }
  createEffect(() => {
    const at = started()
    const then = at === undefined ? null : instantOf(at)
    if (then === null) {
      setSlow(false)
      return
    }
    const wait = MINUTE - Math.max(0, Date.now() - then)
    if (wait <= 0) {
      setSlow(true)
      return
    }
    setSlow(false)
    const handoff = setTimeout(() => setSlow(true), wait)
    onCleanup(() => clearTimeout(handoff))
  })
  const fast = createTicking(SECOND, () => armed() && !slow())
  const paced = createTicking(MINUTE, () => armed() && slow())
  return () => (slow() ? paced() : fast())
}
