import { expect, test } from "bun:test"
import { createChime } from "./chime.ts"

test("a chime before a gesture is skipped and never opens audio", () => {
  let opened = 0
  const target = new EventTarget()
  const sound = createChime(target, () => { opened++; throw new Error("not reached") })
  expect(() => sound.chime()).not.toThrow()
  expect(opened).toBe(0)
  sound.dispose()
})
