/**
 * THE THREE RULES `./held.ts` IS, held one at a time.
 *
 * Under the browser condition, because two of the three are about a memo
 * re-running: on a server-resolved Solid a memo never recomputes, so the
 * tracked-read claims below would PASS having observed nothing (`justfile`'s
 * `test` leg).
 */
import { expect, test } from "bun:test"
import { createMemo, createRoot } from "solid-js"

import { heldService } from "./held.ts"

test("two callers get two holders, so nothing is shared by minting one", () => {
  const one = heldService<string>()
  const other = heldService<string>()
  one.hold("first")
  expect(one.read()).toBe("first")
  expect(other.read()).toBeUndefined()
})

test("a stopped activation clears its own value and never a replacement's", () => {
  const held = heldService<string>()
  const first = held.hold("first")
  const second = held.hold("second")
  expect(held.read()).toBe("second")
  // The first activation's finalizer runs LAST, which is the ordering the
  // identity check exists for: without it this line takes the replacement's
  // value out from under a consumer that is using it.
  first()
  expect(held.read()).toBe("second")
  second()
  expect(held.read()).toBeUndefined()
})

test("the read is tracked, and the absence is a value rather than a wait", () => {
  const held = heldService<string>()
  createRoot((dispose) => {
    const seen: Array<string | undefined> = []
    const reading = createMemo(() => held.read())
    seen.push(reading())
    const stop = held.hold("arrived")
    seen.push(reading())
    stop()
    seen.push(reading())
    expect(seen).toEqual([undefined, "arrived", undefined])
    dispose()
  })
})

test("a service whose shape IS a function is stored rather than invoked", () => {
  // Solid treats a stored function as an updater. A provider — a reading, a
  // client thunk — is exactly that shape, so the wrapper inside `heldService`
  // is what keeps this generic rather than generic-over-non-callables.
  const held = heldService<() => string>()
  held.hold(() => "the provider itself")
  expect(held.read()?.()).toBe("the provider itself")
})
