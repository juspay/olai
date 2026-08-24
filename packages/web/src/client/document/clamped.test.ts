import { csvTable } from "@olai/format"
import { expect, test } from "bun:test"

import { clampSaid } from "./clamped.ts"

// THE ORDINARY PAGE says nothing, and that has to be the shape of it: a line
// under every table saying "showing all of it" is noise that teaches a reader
// to stop reading the line that matters.
test("a page showing the whole file says nothing about what it left out", () => {
  expect(clampSaid(csvTable("a,b\nc,d\n"))).toBeNull()
})

// A file that is really empty is a fact about the file, not a failure — and it
// is SAID rather than drawn as an empty table, which reads as a page that
// failed to load.
test("a file with nothing in it says so", () => {
  expect(clampSaid(csvTable(""))).toEqual({
    tone: "aside",
    text: "Nothing in it — the file has no rows.",
  })
})

// THE CLAMP, which is the half of a bound that makes it honest. A table
// showing five hundred rows of twelve thousand with nothing saying so is a lie
// a reader cannot see.
test("a clamped page says which rows and columns it drew", () => {
  const rows = csvTable("h\n" + Array.from({ length: 20 }, (_, at) => `r${at}`).join("\n"), {
    rows: 3,
  })
  expect(clampSaid(rows)).toEqual({
    tone: "aside",
    text: "Showing the first 3 of 21 rows.",
  })

  const columns = csvTable("a,b,c,d\n1,2,3,4\n", { columns: 2 })
  expect(clampSaid(columns)?.text).toBe("Showing the first 2 of 4 columns.")

  // Both axes in one sentence, and only the clauses that are true of this file.
  const both = csvTable("a,b,c\n1,2,3\n4,5,6\n", { rows: 1, columns: 2 })
  expect(clampSaid(both)?.text)
    .toBe("Showing the first 1 of 3 rows, and the first 2 of 3 columns.")
})

// The counts are GROUPED, which is a fact about reading a number off a screen:
// four digits in a row is a number a reader has to count.
test("a count in the sentence is grouped in threes", () => {
  const many = csvTable(Array.from({ length: 12_431 }, (_, at) => `r${at}`).join("\n"), {
    rows: 500,
  })
  expect(clampSaid(many)?.text).toBe("Showing the first 500 of 12,431 rows.")
})

// An ASIDE and never an alarm, whichever of the two it is saying: nothing was
// refused and nothing failed, so a screen reader is told politely rather than
// interrupted (`../SaidLine.tsx` owns what a mood means).
test("what it says is an aside, in both moods it has", () => {
  expect(clampSaid(csvTable(""))?.tone).toBe("aside")
  expect(clampSaid(csvTable("a\nb\nc\n", { rows: 1 }))?.tone).toBe("aside")
})
