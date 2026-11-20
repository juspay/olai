import { csvTable } from "@olai/format"
import { expect, test } from "bun:test"

import { clampSaid } from "./clamped.ts"

test("a page showing the whole file says nothing about what it left out", () => {
  expect(clampSaid(csvTable("a,b\nc,d\n"))).toBeNull()
})

test("a file with nothing in it says so", () => {
  expect(clampSaid(csvTable(""))).toEqual({
    tone: "aside",
    text: "This file is empty.",
  })
})

test("a bounded page says which rows and columns it drew", () => {
  const rows = csvTable("h\n" + Array.from({ length: 20 }, (_, at) => `r${at}`).join("\n"), {
    rows: 3,
  })
  expect(clampSaid(rows)).toEqual({ tone: "aside", text: "Showing the first 3 rows." })

  const columns = csvTable("a,b,c,d\n1,2,3,4\n", { columns: 2 })
  expect(clampSaid(columns)?.text).toBe("Showing the first 2 columns.")

  const both = csvTable("a,b,c\n1,2,3\n4,5,6\n", { rows: 1, columns: 2 })
  expect(clampSaid(both)?.text).toBe("Showing the first 1 rows, and the first 2 columns.")
})

test("a page whose cells were cut says that too, in its own sentence", () => {
  const long = csvTable(`"${"x".repeat(50_000)}",b\n`)
  expect(clampSaid(long)?.text).toBe("Long cells are cut at 2,000 characters.")

  const both = csvTable(`"${"x".repeat(50_000)}",b\nc,d\n`, { rows: 1 })
  expect(clampSaid(both)?.text)
    .toBe("Showing the first 1 rows. Long cells are cut at 2,000 characters.")
})

test("what it says is an aside, in every mood it has", () => {
  expect(clampSaid(csvTable(""))?.tone).toBe("aside")
  expect(clampSaid(csvTable("a\nb\nc\n", { rows: 1 }))?.tone).toBe("aside")
})
