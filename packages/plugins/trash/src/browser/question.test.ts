import { expect, test } from "bun:test"

import { emptyQuestion, trashQuestion } from "./question.ts"

test("one row, named, with nothing under it: the singular all the way through", () => {
  expect(trashQuestion({ kind: "row", title: "pick the knobs" }, 0)).toBe(
    "Move “pick the knobs” to Trash? You can put it back from Trash in the sidebar.",
  )
})

test("one row with a subtree: the count is the blast radius, and it is “they”", () => {
  expect(trashQuestion({ kind: "row", title: "install them" }, 3)).toBe(
    "Move “install them” and the 3 rows under it to Trash? You can put " +
      "them back from Trash in the sidebar.",
  )
  expect(trashQuestion({ kind: "row", title: "install them" }, 1)).toContain(
    "and the row under it",
  )
})

test("a pick is counted rather than named, because nobody pointed at one row", () => {
  expect(trashQuestion({ kind: "rows", count: 2 }, 0)).toBe(
    "Move these 2 rows to Trash? You can put them back from Trash in the sidebar.",
  )
  expect(trashQuestion({ kind: "rows", count: 3 }, 5)).toContain(
    "these 3 rows and the 5 rows under them",
  )
})

test("a pick of ONE is still a pick, and the agreement follows what the write moves", () => {
  expect(trashQuestion({ kind: "rows", count: 1 }, 0)).toContain("Move this row to Trash?")
  expect(trashQuestion({ kind: "rows", count: 1 }, 0)).toContain("You can put it back")
  expect(trashQuestion({ kind: "rows", count: 1 }, 3)).toContain("the 3 rows under it")
  expect(trashQuestion({ kind: "rows", count: 1 }, 3)).toContain("You can put them back")
})

test("emptying names the count and says outright that nothing puts it back", () => {
  expect(emptyQuestion(12)).toBe(
    "Permanently delete all 12 rows in Trash? olai can't bring them back. " +
      "Only what git has already saved can be recovered.",
  )
})

test("one row is the singular all the way through, and is still counted", () => {
  expect(emptyQuestion(1)).toBe(
    "Permanently delete the one row in Trash? olai can't bring it back. " +
      "Only what git has already saved can be recovered.",
  )
})

test("the promise is unconditional, because the claim it makes is true either way", () => {
  for (const count of [1, 2, 40]) {
    expect(emptyQuestion(count)).toContain("Only what git has already saved can be recovered.")
    expect(emptyQuestion(count)).toContain("olai can't bring")
  }
})
