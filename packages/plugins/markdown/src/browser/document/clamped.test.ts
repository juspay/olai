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

// THE BOUND, said. A table showing five hundred rows of a file that has more,
// with nothing saying so, is a lie a reader cannot see. What it does NOT say is
// how many more: the scan stopped, so that number was never read
// (`@olai/format`'s `csv.ts`).
test("a bounded page says which rows and columns it drew", () => {
  const rows = csvTable("h\n" + Array.from({ length: 20 }, (_, at) => `r${at}`).join("\n"), {
    rows: 3,
  })
  expect(clampSaid(rows)).toEqual({ tone: "aside", text: "Showing the first 3 rows." })

  const columns = csvTable("a,b,c,d\n1,2,3,4\n", { columns: 2 })
  expect(clampSaid(columns)?.text).toBe("Showing the first 2 columns.")

  // Both axes in one sentence, and only the clauses that are true of this file.
  const both = csvTable("a,b,c\n1,2,3\n4,5,6\n", { rows: 1, columns: 2 })
  expect(clampSaid(both)?.text).toBe("Showing the first 1 rows, and the first 2 columns.")
})

// THE CELL IS ITS OWN SENTENCE, because it is a different kind of fact: the
// other two say which part of the file is on screen, this one says that what is
// on screen has been shortened. The number is the format's constant, said with
// its thousands separated.
test("a page whose cells were cut says that too, in its own sentence", () => {
  const long = csvTable(`"${"x".repeat(50_000)}",b\n`)
  expect(clampSaid(long)?.text).toBe("Long cells are cut at 2,000 characters.")

  const both = csvTable(`"${"x".repeat(50_000)}",b\nc,d\n`, { rows: 1 })
  expect(clampSaid(both)?.text)
    .toBe("Showing the first 1 rows. Long cells are cut at 2,000 characters.")
})

// An ASIDE and never an alarm, whichever of the moods it is in: nothing was
// refused and nothing failed, so a screen reader is told politely rather than
// interrupted (`../SaidLine.tsx` owns what a mood means).
test("what it says is an aside, in every mood it has", () => {
  expect(clampSaid(csvTable(""))?.tone).toBe("aside")
  expect(clampSaid(csvTable("a\nb\nc\n", { rows: 1 }))?.tone).toBe("aside")
})
