/**
 * `at` as the Dock spells it — and the spelling DEPENDS ON THE MODE, which is
 * the thing this file got wrong for a while.
 *
 * kolu renders the same instant two ways and the difference is not cosmetic:
 *
 *   - `ago` is a sentence in the row's body — "just now", "5m ago" — and a row
 *     with no activity to date renders NOTHING, because an empty line is
 *     absence and reads as absence.
 *   - `wait-chip` is the violet capsule in the reserved eight-character track.
 *     It is compact — `2m`, not `2m ago`, because the suffix wraps the capsule,
 *     and because "waiting on you for 20h ago" is not a sentence — and a row
 *     with no activity to date renders a DASH. kolu's reason, verbatim: "A
 *     never-active row has no honest duration, and the capsule cannot render
 *     empty." An empty capsule reads as a rendering bug rather than as unknown.
 *
 * This file returned the compact spelling for every mode and `""` for every
 * null, so an asking terminal padi had no activity for drew the empty violet
 * capsule kolu's own comment forbids. `DASH` is imported rather than respelled
 * for the obvious reason.
 *
 * ## The cadence is a minute, and kolu's is a second
 *
 * kolu's Dock ticks the wait chip every second, because a terminal that has
 * been waiting on you for eleven seconds is a number a person watches climb.
 * This ticks every MINUTE, and that is a deliberate difference rather than a
 * shortfall: kolu's dock is a dozen rows a person is staring at, and this is an
 * outline where forty lanes can carry a terminal each — a per-second tick per
 * row is a re-render storm bought for a digit nobody is watching, in a document
 * somebody is reading. Under a minute the phrase says `<1m` in the capsule and
 * "just now" in the body, which is honest about its own resolution.
 *
 * The arithmetic is PURE and takes `now`, so it is a table of cases in a unit
 * test rather than something you wait an hour to see — `../commit/ago.ts`'s
 * arrangement exactly, and the clock machinery under it is the same one
 * (`../clock.ts`).
 */

import type { Accessor } from "solid-js"

import type { RecencyMode } from "@kolu/solid-dockrow/rowValues"
import { DASH } from "@kolu/terminal-vocab/agentProjection"

import { createTicking, DAY, HOUR, MINUTE } from "../clock.ts"

/** The compact capsule spelling: `<1m`, `7m`, `3h`, `2d`. Coarser as it goes
 *  back for `agoOf`'s reason — seconds matter for something that just happened
 *  and nothing else does. A future stamp (two machines whose clocks disagree,
 *  which is ordinary) reads as `<1m` rather than as a negative number. */
const compact = (since: number): string => {
  if (since < MINUTE) return "<1m"
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `${Math.floor(since / HOUR)}h`
  return `${Math.floor(since / DAY)}d`
}

/** The body spelling, which is a phrase rather than a measurement. */
const ago = (since: number): string =>
  since < MINUTE ? "just now" : `${compact(since)} ago`

/** `at` as the row's MODE wants it said. */
export const recencyText = (mode: RecencyMode, at: number | null, now: number): string => {
  if (at === null) return mode === "wait-chip" ? DASH : ""
  const since = now - at
  return mode === "ago" ? ago(since) : compact(since)
}

/** A clock at the resolution the phrase above needs — see the header on why it
 *  is a minute and not a second. */
export const createRecencyNow = (): Accessor<number> => createTicking(MINUTE)
