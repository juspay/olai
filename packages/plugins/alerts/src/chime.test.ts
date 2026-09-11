import { expect, test } from "bun:test"
import { createChime } from "./chime.ts"
test("attention withdrawal releases first-gesture listeners and closes acquired audio", async () => {
  const target = new EventTarget()
  let opened = 0, closed = 0
  const open = () => { opened++; return { resume: async () => {}, close: async () => { closed++ } } as AudioContext }
  const first = createChime(target, open)
  first.dispose()
  target.dispatchEvent(new Event("keydown"))
  expect(opened).toBe(0)
  const second = createChime(target, open)
  target.dispatchEvent(new Event("pointerdown"))
  target.dispatchEvent(new Event("keydown"))
  expect(opened).toBe(1)
  second.dispose()
  second.dispose()
  second.chime()
  expect(closed).toBe(1)
  const third = createChime(target, open)
  target.dispatchEvent(new Event("keydown"))
  expect(opened).toBe(2)
  third.dispose()
  expect(closed).toBe(2)
})
