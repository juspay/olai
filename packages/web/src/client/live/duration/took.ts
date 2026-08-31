/**
 * How long the work on a row TOOK, or is still TAKING — the ⏱ chip's two
 * voices.
 *
 * A SETTLED row — `done` or `cancelled` — wears the length of it, always
 * drawn, never ticking: `⏱ 2h 34m` in the quiet register every other fact
 * beside a title takes. A DOING row says how long it has been under way, and
 * that number moves: the stored `started` crosses the wire once with the row,
 * and the TICK IS LOCAL — the same seam the header's uptime chip wears
 * (`../../uptime.ts`): no polling, no duration the server would have to keep
 * sending, one clock read against the wire-carried instant.
 *
 * THE ARITHMETIC IS PURE and takes `now` as an argument, so the ladders are a
 * table of cases in `./took.test.ts` rather than something you have to wait
 * an hour to see. Only {@link createNow} touches a clock, and what it ticks
 * is `../../clock.ts`'s — the same split `../../uptime.ts` itself makes, and the one
 * `claims.test.ts` holds every readout to.
 *
 * What is NOT here: the settled span itself. That is derived once, on the
 * side that holds the set (@olai/format's `tookOf`), and the chip reads it
 * off the row the way it reads the instant — nothing about "started minus
 * settled" is spelled at a frame rate, and the two readers cannot drift.
 * What IS here is the running figure's one addition ({@link liveOf}):
 * banked plus live, the sum the closed rounds make possible.
 *
 * And the HOVER's sentences: the chip's face stays as concise as it was,
 * so the whole story of the work's timing is told on the tip
 * ({@link liveStoryOf} / {@link settledStoryOf}) — the rounds the record
 * can still enumerate, in order, and the bank where it can only sum them.
 * The breakdown is pure like the ladders, with `now` an argument.
 */

import type { Accessor } from "solid-js"

import { spanOf } from "@olai/format"

import { createTwoSpeed, HOUR, instantOf, SECOND } from "../../clock.ts"

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
 * `-3m` would only be a worse spelling of zero, so the boundary is clamped
 * here too and no caller of either can draw one.
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
 * A SETTLED span on the HOVER: the exact figure in words, at second
 * granularity — the chip's face says the coarse thing (`⏱ 2h 34m`), so the
 * tip is the one place the exact span can be read without fetching the
 * record: `took 2h 34m 44s`, silence dropped from every register that has
 * nothing to say (`took 41m 0s` says `41m`).
 */
export const exactOf = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  // Parts, dropping the registers that say nothing: 41m is `41m` on a hover
  // as on anything else, and a whole hour is `1h` — the exact figure, not
  // the ladder.
  const parts: Array<string> = []
  const minutes = Math.floor(s / 60)
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) parts.push(`${Math.floor(hours / 24)}d`)
  if (hours % 24 !== 0 || (hours >= 1 && hours < 24)) parts.push(`${hours % 24}h`)
  if (minutes % 60 !== 0 || hours === 0) parts.push(`${minutes % 60}m`)
  if (s % 60 !== 0 || minutes === 0) parts.push(`${s % 60}s`)
  return parts.join(" ")
}

/**
 * A RUNNING span in the pomodoro register the mock rules: under an hour the
 * tense `m:ss`, ticking by the second — the digit that tells a reader the
 * clock is alive; at an hour and past it the settled words, because by then
 * nobody is watching the last digit and a number that changes every second is
 * one the eye cannot rest on (`../../chat/elapsed.ts`'s ruling, read once more).
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
 * A RUNNING figure in milliseconds: the BANK (whole seconds, the rounds the
 * settles counted) plus the LIVE ROUND off the wire-carried instant. The
 * sum is the chip's whole honesty — rounds counted, the pauses between
 * them never — and it is one addition rather than a duration the wire
 * would have to keep sending: the bank crosses once, the instant crosses
 * once, and the clock doing the rest is the reader's own.
 *
 * The LIVE half alone is clamped: a stamp reading ahead of this clock is a
 * browser behind the server's, and a negative leg should eat nothing out
 * of a bank that was honestly counted ({@link tickingOf} clamps the sum
 * again, as the belt to this brace).
 */
export const liveOf = (
  bankedSeconds: number | undefined,
  startedAt: number,
  now: number,
): number => (bankedSeconds ?? 0) * SECOND + Math.max(0, now - startedAt)

/**
 * The clock a doing row's chip is drawn against — a second while the second
 * digit is the register, a minute once the words are the settled ones'. The
 * machinery is the uptime chip's own seam, `clock.ts`'s
 * ({@link createTwoSpeed} — which is WHERE it lives: two readouts asking the
 * same two-speed question is where a handoff stops being incidental); the
 * only thing this chip adds is its BAND, an hour. The whole thing exists for
 * the doing arm alone: a settled row's words never move, so a settled row
 * keeps no clock at all.
 *
 * TWO READOUTS WEAR THE HOUR BAND now — this chip and the CI chip's running
 * node — and they hold their stamps in different encodings, which is why the
 * door takes either: a record's `started` is ISO text and odu's `startedAt`
 * is milliseconds. {@link ../../clock.ts}'s `instantOf` is where that stops being
 * two questions.
 */
export const createNow = (
  started: Accessor<string | number | undefined | null>,
): Accessor<number> => createTwoSpeed(started, HOUR)

// ── the hover: the whole story the record can tell ─────────────────────

/**
 * What the record CAN enumerate, and what it can only sum.
 *
 * A round opens when `set_doing` stamps `started` and closes where its
 * `doing` comes off — settled, queued, or un-started — banking its span
 * into `worked` (@olai/ops's plan). The record therefore holds AT MOST one
 * round still windowed — the current one, or the one a settle just closed
 * (the stamp survives exactly so the pair with the settling instant stays
 * honest) — plus the SUM of every round before it. The earlier windows are
 * gone: restamping `started` on the next start is what made the pause
 * between rounds nobody's work, and it is also why round 2's opening
 * overwrote round 1's.
 *
 * So the rounds line up here the way the BANK knows them, never with
 * numbers a sum cannot vouch for: the rounds before the windowed one
 * arrive as one banked figure, the windowed one with its own span and its
 * instants. Where a round IS the whole story it is numbered, and its
 * window is also the WALL — first start to last settle, or to now while
 * running — because that span and the wall are the same subtraction when
 * exactly one round has ever run. Where several rounds ran, the wall's
 * first end left the record with the rest of the windows, and the tip
 * says the bank rather than inventing a start.
 */

/**
 * A DOING chip's tip: the rounds so far, in order, and the work in all.
 *
 * `started` is the wire's instant, KNOWN parseable — the chip's own arm
 * matched on exactly that before this ever ran, so an unreadable one here
 * says the words and no span rather than nothing at all. The live span and
 * the in-all total use the bank's own rounding ({@link spanOf}'s): the
 * figure the tip claims is the one the settle will bank, never the floor
 * of it the face's own tick is showing for one more second.
 */
export const liveStoryOf = (
  bankedSeconds: number | undefined,
  started: string,
  now: number,
): ReadonlyArray<string> => {
  const startedAt = instantOf(started)
  if (startedAt === null) return [`round 1, under way since ${started}`]
  const banked = bankedSeconds ?? 0
  const round = Math.max(0, Math.round((now - startedAt) / 1000))
  if (banked <= 0) return [`round 1, under way since ${started}`]
  return [
    `${exactOf(banked)} already banked over the rounds before this one`,
    `this round under way again since ${started} — ${exactOf(round)} so far`,
    `${exactOf(banked + round)} worked in all — the pauses between the rounds never counted`,
  ]
}

/**
 * A SETTLED chip's tip: `took` first — the total is the figure the chip's
 * face already coarsens, and it heads the story the way it headed the bare
 * tip before — then the split the bank makes possible.
 *
 * `settled` is the settling mark's own value, which can be the undated
 * `true` of work finished before olai stamped anything: then the close is
 * no instant and there is no window to show even when a stamp survives.
 * When the bank outruns the one windowed round there is a LUMP to say —
 * `worked` minus it — and a hand-written record can outrun the bank the
 * other way too, so the lump is asked with a floor of zero and no
 * reconciliation is ever claimed.
 */
export const settledStoryOf = (args: {
  /** The derived total, whole seconds — `tookOf`'s own answer. */
  readonly took: number
  /** The record's own `worked` — absent when no round has ever closed. */
  readonly banked: number | undefined
  /** The record's own `started` — the window's only living end. */
  readonly started: string | undefined
  /** The settling instant, or `true` on a settle before instants. */
  readonly settled: string | true
}): ReadonlyArray<string> => {
  const { took, banked, started, settled } = args
  const window =
    started !== undefined && typeof settled === "string"
      ? spanOf(started, settled)
      : undefined
  if (banked === undefined) {
    // The slimmer arm of `tookOf` — the span IS the one window, and the
    // chip only drew because there was one to take.
    return [`took ${exactOf(took)} — round 1: ${started} → ${settled}`]
  }
  if (window === undefined) {
    // Every round's window is gone (the stamp was buried, or the close
    // was never an instant): the bank is all of it, and the tip says so
    // rather than adding a figure the record cannot back. A hand-written
    // record can carry a ZERO bank, where even that claim is more than the
    // record supports — and the derived total alone is what it has.
    if (banked <= 0) return [`took ${exactOf(took)}`]
    return [
      `took ${exactOf(took)} — rounds banked where each closed, the pauses between them never counted`,
    ]
  }
  const lump = Math.max(0, banked - window)
  if (lump === 0) {
    // The one banked round: its window and the wall are one subtraction.
    return [`took ${exactOf(took)} — the one round: ${started} → ${settled}`]
  }
  return [
    `took ${exactOf(took)} — the pauses between the rounds never counted`,
    `the rounds before the last banked ${exactOf(lump)} of it`,
    `the last ran ${exactOf(window)}: ${started} → ${settled}`,
  ]
}
