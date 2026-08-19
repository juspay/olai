import { expect, test } from "bun:test"

import { trashQuestion, emptyQuestion } from "./question.ts"

test("one row, named, with nothing under it: the singular all the way through", () => {
  expect(trashQuestion({ kind: "row", title: "pick the knobs" }, 0)).toBe(
    "Move “pick the knobs” to the Trash? It keeps its id, and the Trash in " +
      "the sidebar is where to put it back.",
  )
})

test("one row with a subtree: the count is the blast radius, and it is “they”", () => {
  // The `•••` menu's own sentence, unchanged by the move into this module —
  // which is the point of the move: one op, one promise, one wording.
  expect(trashQuestion({ kind: "row", title: "install them" }, 3)).toBe(
    "Move “install them” and the 3 rows under it to the Trash? They keep " +
      "their ids, and the Trash in the sidebar is where to put them back.",
  )
  expect(trashQuestion({ kind: "row", title: "install them" }, 1)).toContain(
    "and the row under it",
  )
})

test("a pick is counted rather than named, because nobody pointed at one row", () => {
  expect(trashQuestion({ kind: "rows", count: 2 }, 0)).toBe(
    "Move these 2 rows to the Trash? They keep their ids, and the Trash in " +
      "the sidebar is where to put them back.",
  )
  expect(trashQuestion({ kind: "rows", count: 3 }, 5)).toContain(
    "these 3 rows and the 5 rows under them",
  )
})

test("a pick of ONE is still a pick, and the agreement follows what the write moves", () => {
  // Picked rather than pointed at, so it has no title in the sentence — but
  // the it/them agreement is about the RECORDS going, not about the subject.
  expect(trashQuestion({ kind: "rows", count: 1 }, 0)).toContain("Move this row to the Trash?")
  expect(trashQuestion({ kind: "rows", count: 1 }, 0)).toContain("It keeps its id")
  expect(trashQuestion({ kind: "rows", count: 1 }, 3)).toContain("the 3 rows under it")
  expect(trashQuestion({ kind: "rows", count: 1 }, 3)).toContain("They keep their ids")
})

test("emptying names the count and says outright that nothing puts it back", () => {
  expect(emptyQuestion(12)).toBe(
    "Permanently delete all 12 rows in the Trash? Nothing in olai puts them " +
      "back — the records leave the archive the way every other write does, so " +
      "what survives is whatever git has already recorded.",
  )
})

test("one row is the singular all the way through, and is still counted", () => {
  // "the one row" rather than "all 1 rows": the sentence a person reads about
  // the last thing in their trash should not read like a template.
  expect(emptyQuestion(1)).toBe(
    "Permanently delete the one row in the Trash? Nothing in olai puts it " +
      "back — the record leaves the archive the way every other write does, so " +
      "what survives is whatever git has already recorded.",
  )
})

test("the promise is unconditional, because the claim it makes is true either way", () => {
  // "whatever git has ALREADY recorded" is deliberately the wording rather
  // than "git still has them": a directory with no repository, one served
  // `--no-commit`, and one whose archive has been waiting uncommitted since
  // the row was put away are all told the truth by it — and none of them is
  // told that something is recoverable when it is not. Nothing here reads a
  // git state, so there is no second reading of the repository to keep in
  // step with the header's.
  for (const count of [1, 2, 40]) {
    expect(emptyQuestion(count)).toContain("whatever git has already recorded")
    expect(emptyQuestion(count)).toContain("Nothing in olai puts")
  }
})
