import { expect, test } from "bun:test"

import { CSV_CELL, CSV_COLUMNS, CSV_ROWS, csvRows, csvTable } from "./csv.ts"

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
// be a second place deciding what a short row means. A missing field is empty.
test("the table is squared off to its widest kept row", () => {
  const table = csvTable("a,b,c\nd\ne,f")
  expect(table.rows).toEqual([["a", "b", "c"], ["d", "", ""], ["e", "f", ""]])
  expect(table.columns).toBe(3)
  expect([table.moreRows, table.moreColumns, table.longCells]).toEqual([false, false, false])
})

// ── the bound is on the WORK ───────────────────────────────────────────
//
// The correction this module was rewritten for. What follows is not "the page
// shows less"; it is that the scan STOPS, which is the only claim that keeps a
// million-row export from taking the tab down under a clamp saying everything
// is fine.

// A row exactly as wide as the rectangle is not a row with more in it. This is
// the off-by-one the flag was written wrong for the first time: reaching the
// bound means the NEXT field would be dropped, and only a next field that
// really arrives means one was.
test("a table exactly at its bounds says nothing was left out", () => {
  const table = csvTable("a,b\nc,d\n", { rows: 2, columns: 2 })
  expect(table.rows).toEqual([["a", "b"], ["c", "d"]])
  expect([table.moreRows, table.moreColumns]).toEqual([false, false])
})

// …and one field past it is.
test("a row wider than the rectangle is cut, and says so", () => {
  const table = csvTable("a,b,c\n1,2,3\n", { columns: 2 })
  expect(table.rows).toEqual([["a", "b"], ["1", "2"]])
  expect(table.columns).toBe(2)
  expect(table.moreColumns).toBe(true)
})

// THE SCAN REALLY STOPPED, and this is the shape of evidence that says so: a
// tail that WOULD change the answer, and does not. A five-thousand-column row
// and a huge cell sit past the row bound; an implementation that scanned the
// whole file and sliced afterwards reports both, and this one reports neither
// because it never read them.
test("nothing past the row bound is read at all", () => {
  const text = [
    ...Array.from({ length: 3 }, (_, at) => `${at},row`),
    Array.from({ length: 5_000 }, (_, at) => `wide${at}`).join(","),
    `enormous,${"x".repeat(200_000)}`,
  ].join("\n")

  const table = csvTable(text, { rows: 3 })
  expect(table.rows).toEqual([["0", "row"], ["1", "row"], ["2", "row"]])
  expect(table.columns).toBe(2)
  // There IS more — that much a stopped scan can say, and must.
  expect(table.moreRows).toBe(true)
  // …and nothing about the tail, because the tail was never touched.
  expect(table.moreColumns).toBe(false)
  expect(table.longCells).toBe(false)
})

// HOW MANY rows are left is deliberately not asked: that is the number a full
// scan is for, and paying for the whole file to print a total the bound exists
// to avoid reading is the defect wearing an honest sentence. What is asked is
// whether there is ONE more, and a file that ends in nothing but newlines has
// not got one.
test("more rows is one more row, not a count — and trailing newlines are not one", () => {
  expect(csvTable("a\nb\nc\n", { rows: 2 }).moreRows).toBe(true)
  expect(csvTable("a\nb\n", { rows: 2 }).moreRows).toBe(false)
  expect(csvTable("a\nb\n\n\n\n", { rows: 2 }).moreRows).toBe(false)
  expect(csvTable("a\nb", { rows: 2 }).moreRows).toBe(false)
})

// THE AXIS THE OTHER TWO CANNOT COVER. A file that is one quoted field is ONE
// row and ONE column, so both other bounds are silent while the whole file
// lands in a single cell. The cap is what stops that, and it is said.
test("a single enormous field is cut, and the cut is reported", () => {
  const table = csvTable(`"${"x".repeat(50_000)}",b\n`, { cell: 10 })
  expect(table.rows).toEqual([["xxxxxxxxxx", "b"]])
  expect(table.longCells).toBe(true)
  // Neither of the other two axes ran out, which is exactly why this one has
  // to exist: nothing else here would have said a word.
  expect([table.moreRows, table.moreColumns]).toEqual([false, false])
})

// A BIG FIXTURE, read at the shipped bounds: what comes back is the bound and
// not the file. The row count is the memory claim in the form a test can make —
// an implementation that materialised every row and sliced would return the
// same rows and hold ten thousand of them on the way.
test("a big file is read to the shipped bounds and no further", () => {
  const rows = ["row,squared"]
  for (let at = 1; at <= 10_000; at++) rows.push(`${at},${at * at}`)
  const table = csvTable(rows.join("\n"))

  expect(table.rows).toHaveLength(CSV_ROWS)
  expect(table.rows[0]).toEqual(["row", "squared"])
  // The last row drawn is the 499th of the file, because the header is one of
  // the five hundred: a `.csv` has no line that is not a row.
  expect(table.rows[CSV_ROWS - 1]).toEqual(["499", String(499 * 499)])
  expect(table.moreRows).toBe(true)
})

// The shipped numbers, asserted where a reader looks for them: they are named
// constants rather than literals in a scan, and the face's sentence spends the
// cell one by name (`@olai/web`'s `document/clamped.ts`).
test("the bounds are the numbers this package publishes", () => {
  expect([CSV_ROWS, CSV_COLUMNS, CSV_CELL]).toEqual([500, 100, 2_000])
})
