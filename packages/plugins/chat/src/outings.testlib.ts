/**
 * WHAT A FRAME SAYS NOTHING ABOUT, for the tests of the two things a call can
 * leave behind it.
 *
 * `@kolu/acp/wire`'s {@link Armed} and {@link Spawned} carry every field on
 * every frame and spell "this frame did not say" as `null` — so the arming
 * frame names a task and a description with `ended` and `report` null, and the
 * frame that settles it names the ending with the description null. A test
 * that wrote those nulls out by hand would be four keys of ceremony around the
 * one or two it is actually about, and a field added to either shape would
 * break every row of every table at once.
 *
 * So a test names the half it is about and these say the rest the way the wire
 * says it: nothing.
 */

import type { Armed, Spawned } from "@kolu/acp/wire"

/** A task the agent armed, as one frame reports it. */
export const armedTask = (said: Partial<Armed> = {}): Armed => ({
  task: "task-1",
  description: null,
  ended: null,
  report: null,
  ...said,
})

/** ... and an agent it sent out, under the same rule. */
export const sentAgent = (said: Partial<Spawned> = {}): Spawned => ({
  kind: null,
  said: null,
  ...said,
})
