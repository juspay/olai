import { afterEach, expect, test } from "bun:test"

import { randomUuid } from "./uuid.ts"

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

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
