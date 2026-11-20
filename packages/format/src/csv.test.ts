import { expect, test } from "bun:test"

import { CSV_CELL, CSV_COLUMNS, CSV_ROWS, csvRows, csvTable } from "./csv.ts"

test("a csv is its rows, each as the fields it holds", () => {
  expect(csvRows("region,units\nnorth,12\nsouth,9\n")).toEqual([
    ["region", "units"],
    ["north", "12"],
    ["south", "9"],
  ])
})

test("a quoted field may hold a comma, a newline and a quote", () => {
  expect(csvRows('a,"b,c",d\n')).toEqual([["a", "b,c", "d"]])
  expect(csvRows('"line one\nline two",next\n')).toEqual([["line one\nline two", "next"]])
  expect(csvRows('"he said ""hi""",next\n')).toEqual([['he said "hi"', "next"]])
  expect(csvRows('a,"unterminated\nstill going')).toEqual([["a", "unterminated\nstill going"]])
})

test("every line ending is one line ending, except inside a quoted field", () => {
  expect(csvRows("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows("a,b\rc,d")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows('"a\r\nb",c')).toEqual([["a\r\nb", "c"]])
})

test("blank lines are not rows, and a line of commas is", () => {
  expect(csvRows("")).toEqual([])
  expect(csvRows("\n\n")).toEqual([])
  expect(csvRows("a,b\n\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]])
  expect(csvRows(",,")).toEqual([["", "", ""]])
  expect(csvRows("a,b")).toEqual([["a", "b"]])
})

test("the table is squared off to its widest kept row", () => {
  const table = csvTable("a,b,c\nd\ne,f")
  expect(table.rows).toEqual([["a", "b", "c"], ["d", "", ""], ["e", "f", ""]])
  expect(table.columns).toBe(3)
  expect([table.moreRows, table.moreColumns, table.longCells]).toEqual([false, false, false])
})

test("a table exactly at its bounds says nothing was left out", () => {
  const table = csvTable("a,b\nc,d\n", { rows: 2, columns: 2 })
  expect(table.rows).toEqual([["a", "b"], ["c", "d"]])
  expect([table.moreRows, table.moreColumns]).toEqual([false, false])
})

test("a row wider than the rectangle is cut, and says so", () => {
  const table = csvTable("a,b,c\n1,2,3\n", { columns: 2 })
  expect(table.rows).toEqual([["a", "b"], ["1", "2"]])
  expect(table.columns).toBe(2)
  expect(table.moreColumns).toBe(true)
})

test("nothing past the row bound is read at all", () => {
  const text = [
    ...Array.from({ length: 3 }, (_, at) => `${at},row`),
    Array.from({ length: 5_000 }, (_, at) => `wide${at}`).join(","),
    `enormous,${"x".repeat(200_000)}`,
  ].join("\n")

  const table = csvTable(text, { rows: 3 })
  expect(table.rows).toEqual([["0", "row"], ["1", "row"], ["2", "row"]])
  expect(table.columns).toBe(2)
  expect(table.moreRows).toBe(true)
  expect(table.moreColumns).toBe(false)
  expect(table.longCells).toBe(false)
})

test("more rows is one more row, not a count — and trailing newlines are not one", () => {
  expect(csvTable("a\nb\nc\n", { rows: 2 }).moreRows).toBe(true)
  expect(csvTable("a\nb\n", { rows: 2 }).moreRows).toBe(false)
  expect(csvTable("a\nb\n\n\n\n", { rows: 2 }).moreRows).toBe(false)
  expect(csvTable("a\nb", { rows: 2 }).moreRows).toBe(false)
})

test("a single enormous field is cut, and the cut is reported", () => {
  const table = csvTable(`"${"x".repeat(50_000)}",b\n`, { cell: 10 })
  expect(table.rows).toEqual([["xxxxxxxxxx", "b"]])
  expect(table.longCells).toBe(true)
  expect([table.moreRows, table.moreColumns]).toEqual([false, false])
})

test("a big file is read to the shipped bounds and no further", () => {
  const rows = ["row,squared"]
  for (let at = 1; at <= 10_000; at++) rows.push(`${at},${at * at}`)
  const table = csvTable(rows.join("\n"))

  expect(table.rows).toHaveLength(CSV_ROWS)
  expect(table.rows[0]).toEqual(["row", "squared"])
  expect(table.rows[CSV_ROWS - 1]).toEqual(["499", String(499 * 499)])
  expect(table.moreRows).toBe(true)
})

test("the bounds are the numbers this package publishes", () => {
  expect([CSV_ROWS, CSV_COLUMNS, CSV_CELL]).toEqual([500, 100, 2_000])
})
