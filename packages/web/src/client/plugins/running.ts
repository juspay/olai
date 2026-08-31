/**
 * WHICH PLUGINS THIS SERVE IS RUNNING, as the browser learns it — the licence
 * a live face is drawn under.
 *
 * A tab REGISTERS what the build has, because import time is all it has
 * (`../live/dressings.ts`). Whether a registered face may actually draw is a
 * different question with a different answer at a different moment: it is a
 * fact about the SERVE, and it arrives on the `plugins` cell the same way the
 * git policy's pin does.
 *
 * ## Why the ordinary case is "everything"
 *
 * Before the first frame there is no roster, and this answers TRUE for every
 * plugin — the built-in default, which is what `--plugins` unset means and
 * therefore what nearly every serve is. The alternative was answering false and
 * drawing nothing until the cell lands, which would make every ordinary page
 * flash its faces off and then on. A tab that guesses the common case and is
 * corrected within a frame is right nearly always and briefly generous
 * otherwise; one that guesses the rare case is wrong nearly always.
 *
 * ## And why this is not read from the registry
 *
 * `@olai/plugins`' registry knows what the BUILD has and cannot know what this
 * serve composed — the two differ exactly when `--plugins` was given, which is
 * the only case this function exists for.
 */

import { createMemo } from "solid-js"

import { ALL_RUNNING, type Running } from "../live/seam.ts"
import { olai } from "../wire.ts"

export const createRunning = (): (() => Running) => {
  const roster = olai.cells.plugins.use()
  return createMemo<Running>(() => {
    const held = roster.value()
    // The seam names this answer and says why it is the generous one; a second
    // `() => true` spelled here would be the same decision with nowhere to
    // argue it.
    if (held === undefined) return ALL_RUNNING
    // A name the roster does not carry is a plugin this SERVE has never heard
    // of, which a tab can reach only by being newer than the server it dialled.
    // It draws — the same generosity the pre-roster answer shows, and for the
    // same reason: a face too many is a face, and a face too few is a hole
    // nobody can explain.
    const off = new Set(held.built.filter((one) => !one.running).map((one) => one.name))
    return (plugin) => !off.has(plugin)
  })
}
