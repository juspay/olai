import { expect, test } from "bun:test"

import { type Branch, doneUnder, foldSays } from "./hidden.ts"

const leaf = (status: Branch["status"]): Branch => ({ status, children: [] })
const under = (status: Branch["status"], ...children: Branch[]): Branch => ({
  status,
  children,
})

test("a leaf is holding nothing back", () => {
  expect(doneUnder(leaf("todo"))).toBe(0)
})

test("done children are counted, and nothing else is", () => {
  expect(
    doneUnder(under(undefined, leaf("done"), leaf("todo"), leaf(undefined), leaf("doing"))),
  ).toBe(1)
})

test("the count reaches every depth", () => {
  expect(
    doneUnder(
      under(
        undefined,
        under("done", leaf("done"), under("todo", leaf("done"))),
        leaf("doing"),
      ),
    ),
  ).toBe(3)
})

test("the row itself is never in its own count — it is the one still on screen", () => {
  expect(doneUnder(under("done", leaf("todo")))).toBe(0)
})

// ── and whether the fold says it ───────────────────────────────────────

test("a fold hiding nothing finished says nothing, rollup or no rollup", () => {
  expect(foldSays(0, undefined)).toBeUndefined()
  expect(foldSays(0, { done: 0, total: 3 })).toBeUndefined()
})

test("a row that is not collapsed is not a fold, and reports nothing", () => {
  expect(foldSays(undefined, { done: 2, total: 4 })).toBeUndefined()
})

test("the rollup already saying it is the fold saying nothing", () => {
  expect(foldSays(3, { done: 3, total: 4 })).toBeUndefined()
  expect(foldSays(2, { done: 2, total: 2 })).toBeUndefined()
})

// The rollup is one level deep and blind to mirrors; this count is the whole
// subtree. Where they disagree, the count is the only thing saying what went.
test("a fold hiding more than the rollup counts still says so", () => {
  expect(foldSays(2, { done: 1, total: 2 })).toBe(2)
  expect(foldSays(5, { done: 0, total: 1 })).toBe(5)
})

test("a branch with no rollup at all has nothing else to say it", () => {
  expect(foldSays(4, undefined)).toBe(4)
})
