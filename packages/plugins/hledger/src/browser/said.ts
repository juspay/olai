import { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS, type Journal } from "../journal/index.ts"

import type { Said } from "@olai/web/client/saying.ts"

export const hledgerSaid = (ledger: Journal): Said | null => {
  const said: Array<string> = []
  if (ledger.moreTransactions) {
    said.push(`Showing the first ${grouped(HLEDGER_TRANSACTIONS)} transactions.`)
  }
  if (ledger.truncated) {
    said.push(`The file is longer than ${grouped(HLEDGER_LINES)} lines; only the beginning was read.`)
  }
  if (ledger.longCells) {
    said.push(`Long lines are cut at ${grouped(HLEDGER_CELL)} characters.`)
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
