/**
 * The id a page mints without a secure context, pinned.
 *
 * The case that matters is the second: with `crypto.randomUUID` taken away —
 * which is what a browser does to a page read over plain http from another
 * machine — an id still comes out, and still has the shape `randomUUID`'s has.
 */

import { afterEach, expect, test } from "bun:test"

import { randomUuid } from "./uuid.ts"

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Shadowed on the instance rather than removed from the prototype, where bun
// declares it unconfigurable; deleting the shadow puts the real one back.
afterEach(() => {
  delete (crypto as { randomUUID?: unknown }).randomUUID
})

test("a version-4 UUID, different every time", () => {
  const ids = Array.from({ length: 1000 }, randomUuid)
  for (const id of ids) expect(id).toMatch(V4)
  expect(new Set(ids).size).toBe(ids.length)
})

test("minted where crypto.randomUUID is absent, as on a page that is not a secure context", () => {
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined })
  expect((crypto as { randomUUID?: unknown }).randomUUID).toBeUndefined()
  expect(randomUuid()).toMatch(V4)
})
