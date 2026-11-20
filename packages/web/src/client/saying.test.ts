import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"

import { createSaying, type Saying } from "./saying.ts"

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
  withSaying(({ said, say }) => {
    say({ tone: "alarm", text: "no" })
    say(undefined)
    expect(said()).toBeNull()
  })
})

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
