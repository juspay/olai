/**
 * The comparison a `verified` read is, without a directory under it.
 *
 * {@link Vintage.check} is one walk and one call to {@link Vintage.divergence},
 * and the walk is the file system's business — proved against a real tree in
 * `./store.test.ts`, where the whole point is that something moved underneath.
 * What is here is the other half: given two stamp tables, which paths do they
 * disagree about, and what does an age look like once a proof has been reached.
 *
 * It is a separate file because these are answers about VALUES. A case that
 * needs a temp directory to say "a file that left is a divergence" is a case
 * that will one day fail for a reason that has nothing to do with the sentence
 * it is making.
 */

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
  // The same map compared with itself, because a caller can hand the same
  // reference twice and must not get a different answer for it.
  expect(Vintage.divergence(table, table)).toEqual([])
})

// The three ways a tree stops being the one an answer was read from, and all
// three are one list: a consumer told about any of them does the same thing
// about it, so splitting them would be three questions where there is one.
test("an arrival, a departure and a file that moved are all divergence", () => {
  const held = stamps({ "a.txt": [10, 5], "gone.txt": [1, 1] })
  const now = stamps({ "a.txt": [99, 5], "arrived.txt": [2, 2] })
  expect(Vintage.divergence(now, held)).toEqual(["a.txt", "arrived.txt", "gone.txt"])
})

// Both halves of a stamp, because a file rewritten to the same length in a
// later second and one rewritten to a different length in the same second are
// the two shapes the probe's own comparison exists to catch.
test("either half of a stamp moving is the file moving", () => {
  const held = stamps({ "a.txt": [10, 5] })
  expect(Vintage.divergence(stamps({ "a.txt": [11, 5] }), held)).toEqual(["a.txt"])
  expect(Vintage.divergence(stamps({ "a.txt": [10, 6] }), held)).toEqual(["a.txt"])
})

// A store that has published nothing has proved nothing, and says so by
// diverging on everything it can see rather than by confirming an empty set.
test("nothing proved diverges on every file there is", () => {
  const nothing = Vintage.nothingProved(1_000)
  expect(nothing.at).toBe(1_000)
  expect(Vintage.divergence(stamps({ "a.txt": [1, 1] }), nothing.stamps)).toEqual(["a.txt"])
})

// ── what an age says ───────────────────────────────────────────────────

test("a held answer's age is how long ago the loop last proved it", () => {
  const vintage = Vintage.vintageOf({ at: 1_000, stamps: new Map() }, 4_000, Vintage.HELD)
  expect(vintage).toEqual({ at: 1_000, age: 3_000, proof: { _tag: "Held" } })
  expect(Vintage.isStale(vintage)).toBe(false)
})

// A look that AGREED is a proof, so it moves the instant and the age with it.
// A look that disagreed proves nothing: the age it reports is the standing one,
// which is exactly how long the answer has been unproved.
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

// The two arms a consumer must not act on are one question, asked once, here —
// so "what counts as stale" cannot come to mean two things in two surfaces.
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

// A clock that went backwards — an NTP step, a suspended laptop — is not a
// negative age. It is an age of nothing, which is the only reading that does
// not turn a machine's own confusion into a claim about a directory.
test("a clock that stepped backwards is an age of nothing, never a negative one", () => {
  expect(Vintage.vintageOf({ at: 9_000, stamps: new Map() }, 1_000, Vintage.HELD).age)
    .toBe(0)
})
