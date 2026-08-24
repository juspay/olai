import { expect, test } from "bun:test"

import { csvRows, csvTable } from "./csv.ts"

// The ordinary file, and the whole of what a page draws from one: a header row
// and the rows under it. Asserted as rows-of-fields rather than as anything the
// browser would do with them — what a `.csv` SAYS is this package's answer, and
// what a table looks like is the client's.
test("a csv is its rows, each as the fields it holds", () => {
  expect(csvRows("region,units\nnorth,12\nsouth,9\n")).toEqual([
    ["region", "units"],
    ["north", "12"],
    ["south", "9"],
  ])
})

// THE REASON THIS IS A SCAN AND NOT TWO SPLITS. A quoted field is exactly the
// field that may hold the comma and the newline a naive reader separates on, so
// the quoting has to be read before the separators are found — and a `""` in
// one is a quote somebody wrote.
test("a quoted field may hold a comma, a newline and a quote", () => {
  expect(csvRows('a,"b,c",d\n')).toEqual([["a", "b,c", "d"]])
  expect(csvRows('"line one\nline two",next\n')).toEqual([["line one\nline two", "next"]])
  expect(csvRows('"he said ""hi""",next\n')).toEqual([['he said "hi"', "next"]])
  // A quote that opens and never closes is not an error: the rest of the file
  // is that field. A reader who typed one sees it, which is the failure a
  // person can fix — and nothing here throws over somebody else's export.
  expect(csvRows('a,"unterminated\nstill going')).toEqual([["a", "unterminated\nstill going"]])
})

// A file written on another machine is the ordinary case rather than the exotic
// one, so all three endings are read — and a `\r\n` INSIDE a quoted field
// survives as itself, because it is content there and normalising it would be
// this reader editing somebody's data on the way past.
test("every line ending is one line ending, except inside a quoted field", () => {
  expect(csvRows("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows("a,b\rc,d")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows('"a\r\nb",c')).toEqual([["a\r\nb", "c"]])
})

// A BLANK LINE IS NOT A ROW — the trailing newline every writer ends a file
// with, the extra one an editor left, the gap between two files somebody
// concatenated. A line of commas IS one, because the commas are fields somebody
// wrote, and that is the distinction the rule turns on.
test("blank lines are not rows, and a line of commas is", () => {
  expect(csvRows("")).toEqual([])
  expect(csvRows("\n\n")).toEqual([])
  expect(csvRows("a,b\n\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows(",,")).toEqual([["", "", ""]])
  // No trailing newline is still a whole last row.
  expect(csvRows("a,b")).toEqual([["a", "b"]])
})

// A ragged file is a real file and a table is a rectangle, so the squaring off
// is the READING's rather than the drawing's — a page that padded per row would
// be a second place deciding what a short row means. A missing field is empty;
// a row wider than the rectangle is cut, and `totalColumns` is what says so.
test("the table is squared off, and says how wide the file really was", () => {
  const table = csvTable("a,b,c\nd\ne,f", { columns: 2 })
  expect(table.rows).toEqual([["a", "b"], ["d", ""], ["e", "f"]])
  expect(table.columns).toBe(2)
  expect(table.totalColumns).toBe(3)
  expect(table.totalRows).toBe(3)
})

// THE BOUND. What was left out is the READER's sentence and lives with the
// page that says it (`@olai/web`'s `document/clamped.ts`); what is here is the
// arithmetic that sentence is derived from, which is what this package owes.
test("a bounded table says what it drew and what was there", () => {
  const whole = csvTable("a,b\nc,d\n")
  expect(whole.rows).toHaveLength(2)
  expect([whole.totalRows, whole.totalColumns]).toEqual([2, 2])

  const rows = csvTable("h\n" + Array.from({ length: 20 }, (_, at) => `r${at}`).join("\n"), {
    rows: 3,
  })
  expect(rows.rows).toHaveLength(3)
  expect(rows.totalRows).toBe(21)

  const columns = csvTable("a,b,c,d\n1,2,3,4\n", { columns: 2 })
  expect(columns.columns).toBe(2)
  expect(columns.totalColumns).toBe(4)
})
