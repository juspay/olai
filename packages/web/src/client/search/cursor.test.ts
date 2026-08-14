/**
 * The cursor every shortlist in this client is walked with.
 *
 * A Solid primitive, so it is exercised inside a root — which is also what
 * makes the GUARD testable: the effect that keeps the cursor on a row that
 * exists only runs where there is an owner to run it.
 */

import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import { createCursor } from "./cursor.ts"

/** Run a body inside a disposed-after root, with a settable count. */
const over = <A>(
  start: number,
  body: (cursor: ReturnType<typeof createCursor>, setCount: (n: number) => void) => A,
): A =>
  createRoot((dispose) => {
    const [count, setCount] = createSignal(start)
    const answer = body(createCursor(count), setCount)
    dispose()
    return answer
  })

test("it starts at the top", () => {
  expect(over(3, (cursor) => cursor.at())).toBe(0)
})

test("stepping wraps at both ends", () => {
  expect(
    over(3, (cursor) => {
      const seen = [cursor.at()]
      for (let i = 0; i < 3; i++) {
        cursor.step(1)
        seen.push(cursor.at())
      }
      cursor.step(-1)
      seen.push(cursor.at())
      return seen
    }),
  ).toEqual([0, 1, 2, 0, 2])
})

test("an empty list is not walkable, and is not an error either", () => {
  expect(
    over(0, (cursor) => {
      cursor.step(1)
      cursor.step(-1)
      return cursor.at()
    }),
  ).toBe(0)
})

test("a hover points straight at a row", () => {
  expect(
    over(4, (cursor) => {
      cursor.to(3)
      return cursor.at()
    }),
  ).toBe(3)
})

test("a new question puts it back at the top", () => {
  expect(
    over(4, (cursor) => {
      cursor.to(3)
      cursor.top()
      return cursor.at()
    }),
  ).toBe(0)
})

// A list that gets SHORTER under somebody standing near the bottom of it —
// both lists this serves are fed by a server, so both can. There is no frame in
// which the answer is out of range, because the clamp is where it is READ.
test("a list that gets shorter keeps the cursor on a row that exists", () => {
  expect(
    over(5, (cursor, setCount) => {
      cursor.to(4)
      setCount(2)
      return cursor.at()
    }),
  ).toBe(1)
})

test("a list that empties leaves the cursor at the top", () => {
  expect(
    over(5, (cursor, setCount) => {
      cursor.to(4)
      setCount(0)
      return cursor.at()
    }),
  ).toBe(0)
})

// ...and what is remembered underneath is where the person put it, so a list
// that comes back finds them where they were rather than at the top.
test("a list that grows back puts them where they were", () => {
  expect(
    over(5, (cursor, setCount) => {
      cursor.to(4)
      setCount(2)
      setCount(5)
      return cursor.at()
    }),
  ).toBe(4)
})

// Stepping is from where the cursor IS, which over a shortened list is not
// where it was put — so the step after a shrink lands on a neighbour of the
// row that is drawn, never of one that is gone.
test("stepping starts from the row that is drawn", () => {
  expect(
    over(5, (cursor, setCount) => {
      cursor.to(4)
      setCount(2)
      cursor.step(1)
      return cursor.at()
    }),
  ).toBe(0)
})
