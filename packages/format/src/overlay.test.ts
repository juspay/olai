/**
 * The layer against ITS oracle, which is a map.
 *
 * {@link ./overlay.ts} makes one promise and everything else follows from it:
 * `overlaid(base, changes)` answers exactly as `new Map([...base, ...changes])`
 * does — same values, same size, same key ORDER, same iteration — while
 * copying the changes rather than the map. So this suite never asserts what a
 * layer is; it builds both and compares them whole, over sequences generated
 * the way `./patch.test.ts` generates corpora, plus the corners a seed reaches
 * only by luck.
 *
 * The corners matter more here than the rounds do, because each of them is a
 * case where the cheap answer and the real one could quietly part company: a
 * change to a key nothing holds (the layer keeps the base's key set, so it must
 * decline), a layer over a layer (a read must not walk a session's history),
 * and a layer grown past the half where it stops being cheaper than the clone
 * it replaced.
 */

import { expect, test } from "bun:test"

import { seeded } from "./fixtures.testlib.ts"
import { overlaid } from "./overlay.ts"

/** The map `overlaid` promises to be — written the obvious way, which is the
 *  way it is not allowed to cost. */
const oracle = <K, V extends {}>(
  base: ReadonlyMap<K, V>,
  changes: ReadonlyArray<readonly [K, V]>,
): ReadonlyMap<K, V> => new Map([...base, ...changes])

/**
 * A whole map, in the shape the comparison is about: the entries IN ORDER, the
 * size, and every reading of it a caller has.
 *
 * All five, because a `ReadonlyMap` is five methods and a field and the layer
 * implements each of them by hand — a suite that spread the map and stopped
 * would be one where `values()` could return the base's stale answers and
 * nothing would say so.
 */
const readable = <K, V extends {}>(map: ReadonlyMap<K, V>): unknown => {
  const swept: Array<readonly [K, V]> = []
  map.forEach((value, key, self) => {
    expect(self).toBe(map)
    swept.push([key, value])
  })
  return {
    size: map.size,
    entries: [...map.entries()],
    spread: [...map],
    keys: [...map.keys()],
    values: [...map.values()],
    swept,
    got: [...map.keys()].map((key) => map.get(key)),
    has: [...map.keys()].map((key) => map.has(key)),
  }
}

const same = <K, V extends {}>(
  base: ReadonlyMap<K, V>,
  changes: ReadonlyArray<readonly [K, V]>,
): ReadonlyMap<K, V> => {
  const found = overlaid(base, changes)
  expect(readable(found)).toEqual(readable(oracle(base, changes)) as never)
  return found
}

/** A value that is an object, as every value this is used for is: the layer's
 *  fall-through reads `undefined` as "the layer does not hold this key", and
 *  its type says so. */
const at = (what: string): { readonly what: string } => ({ what })

const mapOf = (keys: ReadonlyArray<string>): ReadonlyMap<string, { readonly what: string }> =>
  new Map(keys.map((key) => [key, at(`${key} as it was`)]))

// ── the property ───────────────────────────────────────────────────────

test("a layer answers as the map it stands for, over generated sequences", () => {
  const random = seeded(20260817)
  for (let round = 0; round < 200; round++) {
    const keys = Array.from({ length: 1 + Math.floor(random() * 30) }, (_, key) => `k${key}`)
    let held = mapOf(keys)
    // SEVERAL patches deep, because that is how the patcher uses it: every
    // round after the first is a layer built on whatever the last one returned,
    // which is where a chain would start costing a read and a stale base would
    // start answering.
    for (let patch = 0; patch < 5; patch++) {
      const changes = keys
        .filter(() => random() < 0.3)
        .map((key) => [key, at(`${key} at round ${round}.${patch}`)] as const)
      held = same(held, changes)
    }
  }
})

// ── the corners ────────────────────────────────────────────────────────

test("a key the map does not hold is not a layer's to add, so it declines", () => {
  const base = mapOf(["a", "b"])
  const found = same(base, [["c", at("arrived")], ["a", at("changed")]])
  // The map's own answer, which appends: it is what `new Map([...base, ...])`
  // does and therefore what every caller already got.
  expect([...found.keys()]).toEqual(["a", "b", "c"])
  expect(found.size).toBe(3)
})

test("the map a layer stands on never moves — the previous reading still answers", () => {
  const base = mapOf(["a", "b"])
  const before = readable(base)
  const one = same(base, [["a", at("one")]])
  const two = same(one, [["a", at("two")], ["b", at("two")]])
  expect(readable(base)).toEqual(before as never)
  expect(one.get("a")).toEqual({ what: "one" })
  expect(one.get("b")).toEqual({ what: "b as it was" })
  expect(two.get("a")).toEqual({ what: "two" })
})

test("a layer over a layer is one layer, so a read does not walk the history", () => {
  const keys = Array.from({ length: 100 }, (_, key) => `k${key}`)
  let held = mapOf(keys)
  for (let round = 0; round < 40; round++) held = same(held, [[`k${round % 3}`, at(`r${round}`)]])
  expect(held.get("k0")).toEqual({ what: "r39" })
  expect(held.get("k1")).toEqual({ what: "r37" })
  expect(held.get("k99")).toEqual({ what: "k99 as it was" })
})

test("a layer grown past half the map flattens into one", () => {
  const keys = Array.from({ length: 40 }, (_, key) => `k${key}`)
  const base = mapOf(keys)
  // Under the half: still a layer, and it is the layer that is the point of
  // this module — a patch that copied the map would be the bug, and nothing
  // else in the tree can see the difference, so this is where it is said.
  const layered = same(base, keys.slice(0, 10).map((key) => [key, at("changed")] as const))
  expect(layered instanceof Map).toBe(false)
  // Past it: a plain map, because copying the layer would by then cost more
  // than copying the map it stands on.
  const flat = same(base, keys.map((key) => [key, at("changed")] as const))
  expect(flat instanceof Map).toBe(true)
  // And a layer that grows past it ACROSS patches flattens on the way, rather
  // than only when one patch brings the whole map: the layer a patch is handed
  // is the one the patch before it left, so it is growth over a SESSION that
  // has to be bounded. It goes on being a layer afterwards — the flatten is
  // where a new base is taken, not where the module gives up.
  let held: ReadonlyMap<string, { readonly what: string }> = base
  const flattened: Array<number> = []
  keys.forEach((key, which) => {
    held = same(held, [[key, at(`${key} changed`)]])
    if (held instanceof Map) flattened.push(which)
  })
  expect(flattened.length).toBeGreaterThan(0)
  expect([...held.values()].every((value) => value.what.endsWith("changed"))).toBe(true)
})

test("nothing changed is still the same map", () => {
  const base = mapOf(["a", "b"])
  expect(same(base, [])).not.toBe(base)
  expect([...same(base, [])]).toEqual([...base])
})
