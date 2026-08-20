import { expect, test } from "bun:test"

import { sameList, sameMap } from "./same.ts"

// ── lists ──────────────────────────────────────────────────────────────

test("the same values in the same places are the same list", () => {
  expect(sameList(["a", "b"], ["a", "b"])).toBe(true)
  expect(sameList([], [])).toBe(true)
})

test("a value added or removed is a different list", () => {
  expect(sameList(["a"], ["a", "b"])).toBe(false)
  expect(sameList(["a", "b"], ["a"])).toBe(false)
})

test("a value swapped for another is a different list", () => {
  expect(sameList(["a", "b"], ["a", "c"])).toBe(false)
})

test("the same values in another order are a different list", () => {
  // The conservative reading, stated here so it is a decision rather than an
  // oversight — see the module header for why neither caller can reach it.
  expect(sameList(["a", "b"], ["b", "a"])).toBe(false)
})

// ── maps ───────────────────────────────────────────────────────────────

test("the same keys holding the same values are the same map", () => {
  const one = { it: 1 }
  expect(sameMap(new Map([["a", one]]), new Map([["a", one]]))).toBe(true)
  expect(sameMap(new Map(), new Map())).toBe(true)
})

test("the order the keys were inserted in is not part of a map", () => {
  const [one, other] = [{ it: 1 }, { it: 2 }]
  expect(sameMap(new Map([["a", one], ["b", other]]), new Map([["b", other], ["a", one]])))
    .toBe(true)
})

test("a key added or removed is a different map", () => {
  const one = { it: 1 }
  expect(sameMap(new Map([["a", one]]), new Map([["a", one], ["b", one]]))).toBe(false)
  expect(sameMap(new Map([["a", one], ["b", one]]), new Map([["a", one]]))).toBe(false)
})

test("the same count of other keys is a different map", () => {
  // The size check alone would pass this; the walk is what refuses it.
  const one = { it: 1 }
  expect(sameMap(new Map([["a", one]]), new Map([["b", one]]))).toBe(false)
})

test("values are compared by identity unless the caller says otherwise", () => {
  // What a map of things the wire minted wants: an entry is replaced when the
  // frame carrying it is, so two equal-looking objects are two answers…
  expect(sameMap(new Map([["a", { it: 1 }]]), new Map([["a", { it: 1 }]]))).toBe(false)
  // …until a caller says which field it is that decides.
  expect(
    sameMap(
      new Map([["a", { it: 1 }]]),
      new Map([["a", { it: 1 }]]),
      (one, other) => one.it === other.it,
    ),
  ).toBe(true)
})
