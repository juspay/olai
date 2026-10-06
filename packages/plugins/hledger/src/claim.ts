import type { FileClaim } from "@olai/plugin-api/services"
export const name = "hledger"
export const claim: FileClaim = {
  exts: [".journal", ".hledger", ".ledger"], holds: "text", kept: false, fetched: false,
  noun: "ledger", article: "a",
}
