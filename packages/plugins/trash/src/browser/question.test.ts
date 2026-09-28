/**
 * ONE OP, ONE PROMISE, ONE WORDING — the sentence the Trash asks before it
 * moves anything, held as arithmetic over what the write actually touches.
 *
 * It was `@olai/web`'s `client/trash/question.test.ts`, a directory holding a
 * test and nothing else: the module it reads became this row's when the Trash
 * did, and the test stayed behind naming `olai-plugin-trash` from a general
 * package. `@olai/bundle`'s `fence.test.ts` holds that equality, and a bench is
 * not exempt from it.
 */

import { expect, test } from "bun:test"

import { emptyQuestion, trashQuestion } from "./question.ts"

test("one row, named, with nothing under it: the singular all the way through", () => {
  expect(trashQuestion({ kind: "row", title: "pick the knobs" }, 0)).toBe(
    "Move “pick the knobs” to Trash? You can put it back from Trash in the sidebar.",
  )
})

test("one row with a subtree: the count is the blast radius, and it is “they”", () => {
  // The `•••` menu's own sentence, unchanged by the move into this module —
  // which is the point of the move: one op, one promise, one wording.
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
  // Picked rather than pointed at, so it has no title in the sentence — but
  // the it/them agreement is about the RECORDS going, not about the subject.
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
  // "the one row" rather than "all 1 rows": the sentence a person reads about
  // the last thing in their trash should not read like a template.
  expect(emptyQuestion(1)).toBe(
    "Permanently delete the one row in Trash? olai can't bring it back. " +
      "Only what git has already saved can be recovered.",
  )
})

test("the promise is unconditional, because the claim it makes is true either way", () => {
  // "what git has ALREADY saved" is deliberately the wording rather than "git
  // still has them": a directory with no repository, one served `commit: off`,
  // and one whose archive has been waiting uncommitted since the row was put
  // away are all told the truth by it — and none of them is told that
  // something is recoverable when it is not. Nothing here reads a git state,
  // so there is no second reading of the repository to keep in step with the
  // header's.
  for (const count of [1, 2, 40]) {
    expect(emptyQuestion(count)).toContain("Only what git has already saved can be recovered.")
    expect(emptyQuestion(count)).toContain("olai can't bring")
  }
})
