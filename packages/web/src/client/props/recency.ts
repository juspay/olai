/**
 * THE CLOCK, which is the only half of recency that is olai's.
 *
 * `@kolu/solid-dockrow` deliberately does not own one — the README says so and
 * gives the reason: a ticking `now` is ambient app state and its cadence is the
 * app's call. Everything that is NOT the clock is the package's, and as of
 * kolu#2219 that now includes the phrase itself (`recencyText`), which this file
 * used to spell by hand and got wrong in both modes — the compact spelling for
 * every mode, and `""` where the wait-chip's own rule requires a dash.
 *
 * ## The cadence is a minute, and kolu's is a second
 *
 * kolu's Dock ticks the wait chip every second, because a terminal that has been
 * waiting on you for eleven seconds is a number a person watches climb. This
 * ticks every MINUTE, and that is a deliberate difference rather than a
 * shortfall: kolu's dock is a dozen rows a person is staring at, and this is an
 * outline where forty lanes can carry a terminal each — a per-second tick per
 * row is a re-render storm bought for a digit nobody is watching, in a document
 * somebody is reading.
 */

import type { Accessor } from "solid-js"

import { createTicking, MINUTE } from "../clock.ts"

/** A clock at the resolution the Dock's phrase needs here — see the header on
 *  why it is a minute and not a second. */
export const createRecencyNow = (): Accessor<number> => createTicking(MINUTE)
