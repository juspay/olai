/**
 * The layer against ITS oracle, which is a map.
 *
 * {@link ./overlay.ts} makes one promise and everything else follows from it:
 * an overlay written to and sealed answers exactly as a CLONE of the same map
 * written the same way does — same values, same size, same key ORDER, same
 * iteration — while copying the writes rather than the map. So this suite never
 * asserts what a layer is; it builds both and compares them whole, over
 * sequences generated the way `./patch.test.ts` generates corpora, plus the
 * corners a seed reaches only by luck.
 *
 * THE WRITES ARE SETS AND DELETES, because that is what a patch does to an
 * index and because the delete is what this module gained: the first layer kept
 * its base's key set exactly, which is why nine of the eleven indexes could not
 * have one. Every corner below is a place where the cheap answer and the real
 * one could quietly part company — a key nothing held (it goes to the end), a
 * key deleted and set again (it goes to the end TOO, which is the one rule a
 * layer that only remembered values gets wrong), a layer over a layer (a read
 * must not walk a session's history), and a layer grown past the half where it
 * stops being cheaper than the clone it replaced.
 */

import { expect, test } from "bun:test"

import { seeded } from "./fixtures.testlib.ts"
import { overlay, type Read } from "./overlay.ts"

/** A value that is an object, as every value this is used for is: the layer's
 *  fall-through reads `undefined` as "the layer does not hold this key", and
 *  its type says so. */
const at = (what: string): { readonly what: string } => ({ what })

type Held = { readonly what: string }

/** One thing a patch does to an index. `undefined` is the delete, which is the
 *  half the first layer could not spell. */
type Write = readonly [key: string, value: Held | undefined]

/** The map an overlay promises to be — written the obvious way, which is the
 *  way it is not allowed to cost. */
const oracle = (base: ReadonlyMap<string, Held>, writes: ReadonlyArray<Write>) => {
  const whole = new Map(base)
  const said: Array<boolean> = []
  for (const [key, value] of writes) {
    if (value === undefined) said.push(whole.delete(key))
    else whole.set(key, value)
  }
  return { whole, said }
}

/**
 * A whole map, in the shape the comparison is about: the entries IN ORDER, the
 * size, and every reading of it a caller has.
 *
 * All five, because a `ReadonlyMap` is five methods and a field and the layer
 * implements each of them by hand — a suite that spread the map and stopped
 * would be one where `values()` could return the base's stale answers and
 * nothing would say so. The `has` and `get` rows ask about the keys the map
 * DOES NOT hold as well, since a tombstone that answered the base's old value
 * is exactly the failure a walk of the surviving keys cannot see.
 */
const readable = (map: ReadonlyMap<string, Held>, asked: ReadonlyArray<string>): unknown => {
  const swept: Array<readonly [string, Held]> = []
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
    got: asked.map((key) => map.get(key)),
    has: asked.map((key) => map.has(key)),
  }
}

const same = (
  base: ReadonlyMap<string, Held>,
  writes: ReadonlyArray<Write>,
  read: Read = "by key",
  asked: ReadonlyArray<string> = [],
): ReadonlyMap<string, Held> => {
  const held = overlay(base)
  const said: Array<boolean> = []
  for (const [key, value] of writes) {
    if (value === undefined) said.push(held.delete(key))
    else held.set(key, value)
    // The overlay answers about ITSELF while it is being written, which is how
    // the patcher reads it — `mirrorsOf.get(id)` inside the loop that is
    // rewriting `mirrorsOf`. So the mid-write readings are compared too.
    expect(held.has(key)).toBe(value !== undefined)
    expect(held.get(key)).toBe(value as Held)
  }
  const found = held.sealed(read)
  const want = oracle(base, writes)
  const keys = [...new Set([...base.keys(), ...writes.map(([key]) => key), ...asked])]
  expect(said).toEqual(want.said)
  expect(readable(found, keys)).toEqual(readable(want.whole, keys) as never)
  return found
}

const mapOf = (keys: ReadonlyArray<string>): ReadonlyMap<string, Held> =>
  new Map(keys.map((key) => [key, at(`${key} as it was`)]))

// ── the property ───────────────────────────────────────────────────────

test("a layer answers as the map it stands for, over generated write sequences", () => {
  const random = seeded(20260821)
  for (let round = 0; round < 200; round++) {
    const keys = Array.from({ length: 1 + Math.floor(random() * 30) }, (_, key) => `k${key}`)
    // Names the base never held, so a sequence can bring a key in — and can
    // bring one in, drop it and bring it back, which is the corner where a
    // layer that filed appendings by value alone loses their order.
    const others = Array.from({ length: 6 }, (_, key) => `new${key}`)
    let held = mapOf(keys)
    // SEVERAL patches deep, because that is how the patcher uses it: every
    // round after the first is a layer built on whatever the last one returned,
    // which is where a chain would start costing a read and a stale base would
    // start answering.
    for (let patch = 0; patch < 5; patch++) {
      const writes: Array<Write> = []
      for (const key of [...keys, ...others]) {
        const roll = random()
        if (roll < 0.2) writes.push([key, at(`${key} at ${round}.${patch}`)])
        else if (roll < 0.3) writes.push([key, undefined])
        else if (roll < 0.35) {
          // Deleted and set again inside ONE patch, which a `Map` answers by
          // moving the key to the end.
          writes.push([key, undefined])
          writes.push([key, at(`${key} back at ${round}.${patch}`)])
        }
      }
      held = same(held, writes, random() < 0.15 ? "whole" : "by key", others)
    }
  }
})

// ── the corners ────────────────────────────────────────────────────────

test("a key the map never held goes to the end, as a map's own would", () => {
  const found = same(mapOf(["a", "b"]), [["c", at("arrived")], ["a", at("changed")]])
  expect([...found.keys()]).toEqual(["a", "b", "c"])
  expect(found.size).toBe(3)
})

test("a key deleted leaves, and takes its place with it", () => {
  const found = same(mapOf(["a", "b", "c"]), [["b", undefined]], "by key", ["b"])
  expect([...found.keys()]).toEqual(["a", "c"])
  expect(found.size).toBe(2)
  expect(found.has("b")).toBe(false)
  expect(found.get("b")).toBeUndefined()
})

test("a key deleted and set again goes to the END, which is where a map puts it", () => {
  const found = same(mapOf(["a", "b", "c"]), [["a", undefined], ["a", at("back")]])
  expect([...found.keys()]).toEqual(["b", "c", "a"])
  expect(found.size).toBe(3)
  expect(found.get("a")).toEqual({ what: "back" })
})

test("the map a layer stands on never moves — the previous reading still answers", () => {
  const base = mapOf(["a", "b"])
  const before = readable(base, ["a", "b"])
  const one = same(base, [["a", at("one")]])
  const two = same(one, [["a", at("two")], ["b", undefined]])
  expect(readable(base, ["a", "b"])).toEqual(before as never)
  expect(one.get("a")).toEqual({ what: "one" })
  expect(one.get("b")).toEqual({ what: "b as it was" })
  expect(two.get("a")).toEqual({ what: "two" })
  expect(two.has("b")).toBe(false)
})

test("a layer over a layer is one layer, so a read does not walk the history", () => {
  const keys = Array.from({ length: 100 }, (_, key) => `k${key}`)
  let held = mapOf(keys)
  for (let round = 0; round < 40; round++) {
    held = same(held, [[`k${round % 3}`, at(`r${round}`)], [`k${50 + (round % 3)}`, undefined]])
  }
  expect(held.get("k0")).toEqual({ what: "r39" })
  expect(held.get("k1")).toEqual({ what: "r37" })
  expect(held.get("k99")).toEqual({ what: "k99 as it was" })
  expect(held.has("k50")).toBe(false)
})

test("an index read WHOLE is a map, whatever the layer would have cost", () => {
  const base = mapOf(["a", "b", "c"])
  const found = same(base, [["a", at("changed")]], "whole")
  expect(found instanceof Map).toBe(true)
  // Which is a decision about COST and not about the answer: the same writes
  // sealed the other way are the same map, and this suite compares both against
  // one oracle.
  expect(same(base, [["a", at("changed")]], "by key") instanceof Map).toBe(false)
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
  // than copying the map it stands on. Deletes count towards the half exactly
  // as sets do — a tombstone is an entry the next patch copies.
  expect(same(base, keys.map((key) => [key, undefined] as const)) instanceof Map).toBe(true)
  // And a layer that grows past it ACROSS patches flattens on the way, rather
  // than only when one patch brings the whole map: the layer a patch is handed
  // is the one the patch before it left, so it is growth over a SESSION that
  // has to be bounded. It goes on being a layer afterwards — the flatten is
  // where a new base is taken, not where the module gives up.
  let held: ReadonlyMap<string, Held> = base
  const flattened: Array<number> = []
  keys.forEach((key, which) => {
    held = same(held, [[key, at(`${key} changed`)]])
    if (held instanceof Map) flattened.push(which)
  })
  expect(flattened.length).toBeGreaterThan(0)
  expect([...held.values()].every((value) => value.what.endsWith("changed"))).toBe(true)
})

test("an overlay nothing wrote to hands back the map it was given", () => {
  const base = mapOf(["a", "b"])
  expect(same(base, [])).toBe(base)
  // Including one that was HANDED a layer: an edit that touches nothing of an
  // index must not mint a second layer equal to the one it was passed.
  const layered = same(base, [["a", at("changed")]])
  expect(same(layered, [])).toBe(layered)
  // A delete that deleted nothing is not a write either.
  expect(same(layered, [["nope", undefined]])).toBe(layered)
})
