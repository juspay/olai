import { expect, test } from "bun:test"

import { archiveQuestion } from "./question.ts"

test("one row, named, with nothing under it: the singular all the way through", () => {
  expect(archiveQuestion({ kind: "row", title: "pick the knobs" }, 0)).toBe(
    "Move “pick the knobs” to the Trash? It keeps its id, and the Trash in " +
      "the sidebar is where to put it back.",
  )
})

test("one row with a subtree: the count is the blast radius, and it is “they”", () => {
  // The `•••` menu's own sentence, unchanged by the move into this module —
  // which is the point of the move: one op, one promise, one wording.
  expect(archiveQuestion({ kind: "row", title: "install them" }, 3)).toBe(
    "Move “install them” and the 3 rows under it to the Trash? They keep " +
      "their ids, and the Trash in the sidebar is where to put them back.",
  )
  expect(archiveQuestion({ kind: "row", title: "install them" }, 1)).toContain(
    "and the row under it",
  )
})

test("a pick is counted rather than named, because nobody pointed at one row", () => {
  expect(archiveQuestion({ kind: "rows", count: 2 }, 0)).toBe(
    "Move these 2 rows to the Trash? They keep their ids, and the Trash in " +
      "the sidebar is where to put them back.",
  )
  expect(archiveQuestion({ kind: "rows", count: 3 }, 5)).toContain(
    "these 3 rows and the 5 rows under them",
  )
})

test("a pick of ONE is still a pick, and the agreement follows what the write moves", () => {
  // Picked rather than pointed at, so it has no title in the sentence — but
  // the it/them agreement is about the RECORDS going, not about the subject.
  expect(archiveQuestion({ kind: "rows", count: 1 }, 0)).toContain("Move this row to the Trash?")
  expect(archiveQuestion({ kind: "rows", count: 1 }, 0)).toContain("It keeps its id")
  expect(archiveQuestion({ kind: "rows", count: 1 }, 3)).toContain("the 3 rows under it")
  expect(archiveQuestion({ kind: "rows", count: 1 }, 3)).toContain("They keep their ids")
})
