/**
 * A MOUNT THAT WAITS FOR A CHUNK — the two closes, and they are two different
 * failures.
 *
 * `.browsertest.ts` and not `.test.ts`, which is the whole reason this file has
 * a suffix: under bun's default resolution SolidJS is the SERVER build, where an
 * effect never runs at all — so a `.test.ts` here would be green having mounted
 * nothing and released nothing, which is the exact shape of the bug it is
 * supposed to be watching.
 *
 * The claims:
 *
 *   1. CLOSED AFTER THE CHUNK ARRIVED — what was made is released. This is the
 *      one that regressed: the release was registered on a later microtask, in
 *      a frame Solid had already left, so it was an empty statement.
 *   2. CLOSED WHILE THE CHUNK WAS IN FLIGHT — nothing is made at all. This is
 *      the one a `runWithOwner` rescue does NOT reach, because `onCleanup` on a
 *      disposed owner is a no-op too, and it is the case with the longest
 *      window: the first open of a pane pays a real network fetch.
 */

import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { mountLater } from "./mounting.ts"

/** A load that has not come back yet, and the hand that decides when it does. */
const pending = <A>(): { readonly load: () => Promise<A>; readonly arrive: (value: A) => Promise<void> } => {
  const { promise, resolve } = Promise.withResolvers<A>()
  return { load: () => promise, arrive: async (value) => { resolve(value); await promise } }
}

test("what the mount made is released when its owner goes", async () => {
  const chunk = pending<string>()
  let made = 0
  let released = 0
  let failed = 0
  const dispose = createRoot((dispose) => {
    mountLater(chunk.load, () => { made += 1; return () => { released += 1 } }, () => { failed += 1 })
    return dispose
  })
  await chunk.arrive("the emulator")
  expect([made, released, failed]).toEqual([1, 0, 0])
  dispose()
  expect([made, released, failed]).toEqual([1, 1, 0])
})

test("a mount whose owner goes while the chunk is in flight never makes anything", async () => {
  const chunk = pending<string>()
  let made = 0
  let released = 0
  let failed = 0
  const dispose = createRoot((dispose) => {
    mountLater(chunk.load, () => { made += 1; return () => { released += 1 } }, () => { failed += 1 })
    return dispose
  })
  dispose()
  await chunk.arrive("the emulator")
  expect([made, released, failed]).toEqual([0, 0, 0])
})

test("a chunk that will not fetch is said, and not said to an owner that has gone", async () => {
  for (const closed of [false, true]) {
    const { promise, reject } = Promise.withResolvers<string>()
    let failed = 0
    const dispose = createRoot((dispose) => {
      mountLater(() => promise, () => () => {}, () => { failed += 1 })
      return dispose
    })
    if (closed) dispose()
    reject(new Error("no network"))
    await promise.catch(() => undefined)
    expect(failed).toBe(closed ? 0 : 1)
    dispose()
  }
})
