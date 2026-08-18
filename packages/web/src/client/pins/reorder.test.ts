/**
 * WHERE A DRAGGED PIN LANDS — the arithmetic, without a pointer.
 *
 * The one subtlety worth a suite: the gap the pointer is over is counted
 * against the shelf AS DRAWN, with the carried row still in it, and the
 * neighbour a `place` names has to be read off the shelf WITHOUT it. Getting
 * that wrong puts a row after itself, which is a write the ops layer would
 * take and a reader would not recognise.
 */

import { expect, test } from "bun:test"

import type { Pin } from "./pins.ts"
import { gapAt, placing } from "./reorder.ts"

const pin = (id: string): Pin => ({ id, route: { kind: "agenda" }, named: undefined })
const SHELF = ["a", "b", "c", "d"].map(pin)

/** Four rows, 20px tall, starting at 100 — midpoints at 110, 130, 150, 170. */
const MIDDLES = [110, 130, 150, 170]

test("above every row is gap 0, below every row is gap n", () => {
  expect(gapAt(MIDDLES, 0)).toBe(0)
  expect(gapAt(MIDDLES, 109)).toBe(0)
  expect(gapAt(MIDDLES, 999)).toBe(4)
})

test("a pointer past a row's middle is past that row", () => {
  expect(gapAt(MIDDLES, 111)).toBe(1)
  expect(gapAt(MIDDLES, 131)).toBe(2)
  expect(gapAt(MIDDLES, 151)).toBe(3)
})

test("an empty shelf has one gap, and it is 0", () => {
  expect(gapAt([], 500)).toBe(0)
})

test("carrying the first row to the end names the last row as its neighbour", () => {
  expect(placing(SHELF, 0, 4)).toEqual({
    verb: "place",
    id: "a",
    parent: null,
    after: "d",
  })
})

test("carrying the last row to the front names no neighbour at all", () => {
  expect(placing(SHELF, 3, 0)).toEqual({
    verb: "place",
    id: "d",
    parent: null,
    after: null,
  })
})

test("the neighbour is read off the shelf the row has LEFT", () => {
  // `c` into gap 1 sits between `a` and `b` — after `a`. Read off the
  // undisturbed list, gap 1's neighbour would still be `a`, which happens to
  // agree; `b` into gap 3 is the case that does not: the row above it there is
  // `c` once `b` has gone, not `b` itself.
  expect(placing(SHELF, 2, 1)).toMatchObject({ id: "c", after: "a" })
  expect(placing(SHELF, 1, 3)).toMatchObject({ id: "b", after: "c" })
})

test("a drag that came back where it started writes nothing", () => {
  // Both gaps either side of a carried row are that row's own place, which is
  // what a pointer that travelled and returned is over.
  expect(placing(SHELF, 1, 1)).toBeUndefined()
  expect(placing(SHELF, 1, 2)).toBeUndefined()
})

test("a gap over a shelf that has moved under the gesture writes nothing", () => {
  expect(placing([], 0, 0)).toBeUndefined()
})
