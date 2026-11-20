import { expect, test } from "bun:test"

import type { Stamp } from "./disk.ts"
import * as Vintage from "./vintage.ts"

const stamps = (
  entries: Readonly<Record<string, readonly [number, number]>>,
): ReadonlyMap<string, Stamp> =>
  new Map(
    Object.entries(entries).map((
      [path, [mtime, size]],
    ) => [path, { mtime, size } satisfies Stamp]),
  )

test("two identical tables disagree about nothing", () => {
  const table = stamps({ "a.txt": [10, 5], "sub/b.txt": [11, 6] })
  expect(Vintage.divergence(table, stamps({ "a.txt": [10, 5], "sub/b.txt": [11, 6] })))
    .toEqual([])
  expect(Vintage.divergence(table, table)).toEqual([])
})

test("an arrival, a departure and a file that moved are all divergence", () => {
  const held = stamps({ "a.txt": [10, 5], "gone.txt": [1, 1] })
  const now = stamps({ "a.txt": [99, 5], "arrived.txt": [2, 2] })
  expect(Vintage.divergence(now, held)).toEqual(["a.txt", "arrived.txt", "gone.txt"])
})

test("either half of a stamp moving is the file moving", () => {
  const held = stamps({ "a.txt": [10, 5] })
  expect(Vintage.divergence(stamps({ "a.txt": [11, 5] }), held)).toEqual(["a.txt"])
  expect(Vintage.divergence(stamps({ "a.txt": [10, 6] }), held)).toEqual(["a.txt"])
})

test("nothing proved diverges on every file there is", () => {
  const nothing = Vintage.nothingProved(1_000)
  expect(nothing.at).toBe(1_000)
  expect(Vintage.divergence(stamps({ "a.txt": [1, 1] }), nothing.stamps)).toEqual(["a.txt"])
})

test("a held answer's age is how long ago the loop last proved it", () => {
  const vintage = Vintage.vintageOf({ at: 1_000, stamps: new Map() }, 4_000, Vintage.HELD)
  expect(vintage).toEqual({ at: 1_000, age: 3_000, proof: { _tag: "Held" } })
  expect(Vintage.isStale(vintage)).toBe(false)
})

test("only a look that agreed resets the age", () => {
  const standing = { at: 1_000, stamps: new Map() }
  expect(Vintage.vintageOf(standing, 4_000, Vintage.CONFIRMED))
    .toEqual({ at: 4_000, age: 0, proof: { _tag: "Confirmed" } })

  const diverged = Vintage.vintageOf(standing, 4_000, {
    _tag: "Diverged",
    paths: ["a.txt"],
  })
  expect(diverged.at).toBe(1_000)
  expect(diverged.age).toBe(3_000)
  expect(Vintage.isStale(diverged)).toBe(true)
})

test("a look nobody could take is stale, and a look nobody took is not", () => {
  const standing = { at: 1_000, stamps: new Map() }
  const unchecked = Vintage.vintageOf(standing, 2_000, {
    _tag: "Unchecked",
    why: "cannot read the served directory",
  })
  expect(unchecked.age).toBe(1_000)
  expect(Vintage.isStale(unchecked)).toBe(true)
  expect(Vintage.isStale(Vintage.vintageOf(standing, 2_000, Vintage.HELD))).toBe(false)
})

test("a clock that stepped backwards is an age of nothing, never a negative one", () => {
  expect(Vintage.vintageOf({ at: 9_000, stamps: new Map() }, 1_000, Vintage.HELD).age)
    .toBe(0)
})
