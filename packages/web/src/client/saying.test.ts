/**
 * A said-line's three rules (`./saying.ts`).
 *
 * They used to be spelled once per surface — inside the `•••` menu's component
 * and again inside the Trash's row — where nothing could hold them and the two
 * had already drifted into different shapes for the same behaviour. `SAID_MS`
 * being shared was half the job; this is the test the other half earns.
 *
 * That no OTHER file counts `SAID_MS` down is the receptacle's grip and is a
 * claim about every other file, so it is a sweep rather than a test here:
 * `./claims.test.ts`, with the rest of them.
 */

import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"

import { createSaying, type Saying } from "./saying.ts"

/** An owner, because `createSaying` registers a cleanup — and disposing it is
 *  not a formality: it is the third rule. */
const withSaying = (run: (saying: Saying) => void): void => {
  createRoot((dispose) => {
    run(createSaying())
    dispose()
  })
}

test("a sentence is on screen the moment it is said", () => {
  withSaying(({ said, say }) => {
    expect(said()).toBeNull()
    say({ tone: "aside", text: "link copied" })
    expect(said()).toEqual({ tone: "aside", text: "link copied" })
  })
})

test("saying NOTHING clears the line rather than drawing an empty one", () => {
  // The shape both callers hand this: a write answers `undefined` when it has
  // nothing to add, and passing that straight through has to mean "clear".
  // Drawn instead, it is a bordered box with no words in it, which this client
  // shipped once.
  withSaying(({ said, say }) => {
    say({ tone: "alarm", text: "no" })
    say(undefined)
    expect(said()).toBeNull()
  })
})

/**
 * The timers a run armed and the ones it cancelled, WATCHED rather than
 * replaced: both spies do the real thing as well as recording it, so nothing
 * here leaves a six-second timeout behind for whichever file `bun test` runs
 * next. Six seconds is too long for a test to wait, so the two rules about
 * countdowns are asserted as the cancellation itself.
 */
const watchingTimers = <T>(run: (seen: {
  armed: ReadonlyArray<unknown>
  cancelled: ReadonlyArray<unknown>
}) => T): T => {
  const armed: Array<unknown> = []
  const cancelled: Array<unknown> = []
  const realArm = globalThis.setTimeout
  const realStop = globalThis.clearTimeout
  const arm = spyOn(globalThis, "setTimeout").mockImplementation(((...args: never[]) => {
    const handle = (realArm as (...a: never[]) => unknown)(...args)
    armed.push(handle)
    return handle
  }) as typeof globalThis.setTimeout)
  const stop = spyOn(globalThis, "clearTimeout").mockImplementation(((handle: never) => {
    cancelled.push(handle)
    ;(realStop as (h: never) => void)(handle)
  }) as typeof globalThis.clearTimeout)
  try {
    return run({ armed, cancelled })
  } finally {
    arm.mockRestore()
    stop.mockRestore()
  }
}

test("a new sentence replaces the one before it, countdown and all", () => {
  // Both halves matter and only one of them is visible: the second sentence
  // shows, AND the first one's timer is cancelled. Left running, it would take
  // the new sentence away six seconds after the WRONG verb.
  watchingTimers((seen) => {
    withSaying(({ said, say }) => {
      say({ tone: "aside", text: "first" })
      say({ tone: "aside", text: "second" })
      expect(said()).toEqual({ tone: "aside", text: "second" })
      expect(seen.cancelled).toContain(seen.armed[0])
    })
  })
})

test("the timer dies with the owner", () => {
  // A surface that has gone cannot be written to, and a pending write to it is
  // a leak: the handle the last `say` armed is the handle disposal cancels.
  watchingTimers((seen) => {
    createRoot((dispose) => {
      createSaying().say({ tone: "aside", text: "gone in a moment" })
      expect(seen.armed).toHaveLength(1)
      expect(seen.cancelled).not.toContain(seen.armed[0])
      dispose()
    })
    expect(seen.cancelled).toContain(seen.armed[0])
  })
})
