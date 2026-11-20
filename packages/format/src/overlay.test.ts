import { expect, test } from "bun:test"

import { seeded } from "./fixtures.testlib.ts"
import { overlay, type Read } from "./overlay.ts"

const at = (what: string): { readonly what: string } => ({ what })

type Held = { readonly what: string }

type Write = readonly [key: string, value: Held | undefined]

const oracle = (base: ReadonlyMap<string, Held>, writes: ReadonlyArray<Write>) => {
  const whole = new Map(base)
  const said: Array<boolean> = []
  for (const [key, value] of writes) {
    if (value === undefined) said.push(whole.delete(key))
    else whole.set(key, value)
  }
  return { whole, said }
}

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
  const held = overlay(base, read)
  const said: Array<boolean> = []
  for (const [key, value] of writes) {
    if (value === undefined) said.push(held.delete(key))
    else held.set(key, value)
    expect(held.has(key)).toBe(value !== undefined)
    expect(held.get(key)).toBe(value as Held)
  }
  const found = held.sealed()
  const want = oracle(base, writes)
  const keys = [...new Set([...base.keys(), ...writes.map(([key]) => key), ...asked])]
  expect(said).toEqual(want.said)
  expect(readable(found, keys)).toEqual(readable(want.whole, keys) as never)
  return found
}

const mapOf = (keys: ReadonlyArray<string>): ReadonlyMap<string, Held> =>
  new Map(keys.map((key) => [key, at(`${key} as it was`)]))

test("a layer answers as the map it stands for, over generated write sequences", () => {
  const random = seeded(20260821)
  for (let round = 0; round < 200; round++) {
    const keys = Array.from({ length: 1 + Math.floor(random() * 30) }, (_, key) => `k${key}`)
    const others = Array.from({ length: 6 }, (_, key) => `new${key}`)
    let held = mapOf(keys)
    for (let patch = 0; patch < 5; patch++) {
      const writes: Array<Write> = []
      for (const key of [...keys, ...others]) {
        const roll = random()
        if (roll < 0.2) writes.push([key, at(`${key} at ${round}.${patch}`)])
        else if (roll < 0.3) writes.push([key, undefined])
        else if (roll < 0.35) {
          writes.push([key, undefined])
          writes.push([key, at(`${key} back at ${round}.${patch}`)])
        }
      }
      held = same(held, writes, random() < 0.15 ? "whole" : "by key", others)
    }
  }
})

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
  expect(same(base, [], "whole")).toBe(base)
  expect(same(base, [["nope", undefined]], "whole")).toBe(base)
  expect(same(base, [["a", at("changed")]], "by key") instanceof Map).toBe(false)
})

test("a layer grown past half the map flattens into one", () => {
  const keys = Array.from({ length: 40 }, (_, key) => `k${key}`)
  const base = mapOf(keys)
  const layered = same(base, keys.slice(0, 10).map((key) => [key, at("changed")] as const))
  expect(layered instanceof Map).toBe(false)
  expect(same(base, keys.map((key) => [key, undefined] as const)) instanceof Map).toBe(true)
  let held: ReadonlyMap<string, Held> = base
  const flattened: Array<number> = []
  keys.forEach((key, which) => {
    held = same(held, [[key, at(`${key} changed`)]])
    if (held instanceof Map) flattened.push(which)
  })
  expect(flattened.length).toBeGreaterThan(0)
  expect([...held.values()].every((value) => value.what.endsWith("changed"))).toBe(true)
})

test("a sealed overlay is spent — a write afterwards is refused, not absorbed", () => {
  for (const read of ["by key", "whole"] as const) {
    const held = overlay(mapOf(["a", "b", "c"]), read)
    held.set("a", at("changed"))
    const sealed = held.sealed()
    expect(() => held.set("b", at("late"))).toThrow()
    expect(() => held.delete("c")).toThrow()
    expect(() => held.delete("nothing here")).toThrow()
    expect([...sealed.keys()]).toEqual(["a", "b", "c"])
    expect(sealed.get("c")).toEqual({ what: "c as it was" })
  }
})

const pinned = (
  built: ReadonlyArray<Write>,
  next: ReadonlyArray<Write>,
): void => {
  const base = mapOf(Array.from({ length: 20 }, (_, key) => `k${key}`))
  const asked = [...base.keys(), "arrived", "later"]
  const revision = same(base, built, "by key", asked)
  expect(revision instanceof Map).toBe(false)
  const before = readable(revision, asked)
  same(revision, next, "by key", asked)
  expect(readable(revision, asked)).toEqual(before as never)
}

test("a patch writing a REPLACEMENT does not move the value the revision behind answers", () => {
  pinned([["k0", at("N")]], [["k0", at("N+1")]])
})

test("a patch APPENDING a key does not add it to the revision behind", () => {
  pinned([["arrived", at("N")]], [["later", at("N+1")]])
})

test("a patch DROPPING a key does not drop it from the revision behind", () => {
  pinned([["k19", undefined]], [["k18", undefined]])
})

test("a patch writing all three ways leaves the revision behind whole", () => {
  pinned(
    [["k0", at("N")], ["arrived", at("N")], ["k19", undefined]],
    [
      ["k1", at("N+1")],
      ["later", at("N+1")],
      ["k18", undefined],
      ["k0", at("N+1 again")],
      ["arrived", undefined],
    ],
  )
})

test("two patches from one revision are two revisions, not one written twice", () => {
  const base = mapOf(Array.from({ length: 20 }, (_, key) => `k${key}`))
  const asked = [...base.keys(), "one", "other"]
  const revision = same(base, [["k0", at("N")], ["arrived", at("N")]], "by key", asked)
  const before = readable(revision, asked)
  const writes: ReadonlyArray<Write> = [["k0", at("one")], ["one", at("one")], ["k5", undefined]]
  const one = same(revision, writes, "by key", asked)
  const other = same(revision, [["k0", at("other")], ["other", at("other")]], "by key", asked)
  expect(readable(revision, asked)).toEqual(before as never)
  expect(one.get("k0")).toEqual({ what: "one" })
  expect(other.get("k0")).toEqual({ what: "other" })
  expect(one.has("other")).toBe(false)
  expect(other.has("one")).toBe(false)
  expect(one.has("k5")).toBe(false)
  expect(other.has("k5")).toBe(true)
})

test("an overlay nothing wrote to hands back the map it was given", () => {
  const base = mapOf(["a", "b"])
  expect(same(base, [])).toBe(base)
  const layered = same(base, [["a", at("changed")]])
  expect(same(layered, [])).toBe(layered)
  expect(same(layered, [["nope", undefined]])).toBe(layered)
})
