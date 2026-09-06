import { expect, test } from "bun:test"
import { createGhost } from "./ghost.ts"
test("navigation withdrawal releases an armed ghost and retained callers cannot rearm", () => {
  const target = new EventTarget()
  let added = 0, removed = 0
  const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target)
  target.addEventListener = (...args) => { added++; add(...args) }
  target.removeEventListener = (...args) => { removed++; remove(...args) }
  const click = () => { const event = new Event("click", { cancelable: true }); target.dispatchEvent(event); return event.defaultPrevented }
  const first = createGhost(target, () => 100)
  first.swallow()
  expect(click()).toBe(true)
  expect(click()).toBe(false)
  first.swallow()
  first.dispose()
  first.swallow()
  expect(click()).toBe(false)
  expect([added, removed]).toEqual([1, 1])
  const second = createGhost(target, () => 100)
  expect(click()).toBe(false)
  second.swallow()
  expect(click()).toBe(true)
  second.dispose()
  expect([added, removed]).toEqual([2, 2])
})
