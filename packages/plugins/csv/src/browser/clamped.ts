import { CSV_CELL, type CsvTable } from "@olai/format"

import type { Said } from "@olai/web/client/saying.ts"

export const clampSaid = (table: CsvTable): Said | null => {
  if (table.rows.length === 0) {
    return { tone: "aside", text: "This file is empty." }
  }
  const drawn: Array<string> = []
  if (table.moreRows) drawn.push(`the first ${grouped(table.rows.length)} rows`)
  if (table.moreColumns) drawn.push(`the first ${grouped(table.columns)} columns`)
  const said: Array<string> = []
  if (drawn.length > 0) said.push(`Showing ${drawn.join(", and ")}.`)
  if (table.longCells) {
    said.push(`Long cells are cut at ${grouped(CSV_CELL)} characters.`)
  }
  return said.length === 0 ? null : { tone: "aside", text: said.join(" ") }
}

const grouped = (count: number): string => {
  const digits = String(count)
  let out = ""
  for (let at = 0; at < digits.length; at++) {
    if (at > 0 && (digits.length - at) % 3 === 0) out += ","
    out += digits[at]
  }
  return out
}
