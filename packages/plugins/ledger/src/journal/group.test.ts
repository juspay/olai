import { expect, test } from "bun:test"

import { type Block, group } from "./group.ts"
import { classify } from "./line.ts"

/** The fold over a file's lines — classification then grouping, which is what
 *  `./read.ts` does and all the fold needs. */
const blocks = (text: string): ReadonlyArray<Block> => group(text.split("\n").map(classify))

/** The one transaction block of a file, for the cases that have exactly one. */
const txn = (text: string): Extract<Block, { kind: "transaction" }> => {
  const found = blocks(text).filter((one) => one.kind === "transaction")
  expect(found).toHaveLength(1)
  return found[0] as Extract<Block, { kind: "transaction" }>
}

/** An entry block as `[line, kind]`, in file order. */
const entries = (text: string): ReadonlyArray<ReadonlyArray<unknown>> =>
  blocks(text)
    .filter((one): one is Extract<Block, { kind: "entry" }> => one.kind === "entry")
    .map((one) => [one.line, one.entry])

// AN INDENTED COMMENT BELONGS TO WHAT IT SITS UNDER: the transaction before its
// postings, or the posting above it. It is never a posting to an account named
// after the comment. (from `hledger.test.ts`'s "an indented comment joins the
// transaction or the posting above it")
test("an indented comment joins the transaction or the posting above it", () => {
  const one = txn(
    "2026-01-05 x\n" +
      "    ; the bank's own words: settled\n" +
      "    expenses:food  $10\n" +
      "    ; paid by card\n" +
      "    assets:cash",
  )
  expect(one.comment).toBe("the bank's own words: settled")
  expect(one.tags).toEqual([{ key: "words", value: "settled" }])
  expect(one.postings.map((stated) => stated.posting.account)).toEqual(["expenses:food", "assets:cash"])
  expect(one.postings[0]!.posting.comment).toBe("paid by card")
  expect(one.postings[1]!.posting.comment).toBeNull()

  // …under a posting, as its own comment and tags.
  const under = txn("2026-01-05 x\n    expenses:food  $10\n    ; paid by card, tip:5\n    assets:cash")
  expect(under.postings[0]!.posting.tags).toEqual([{ key: "tip", value: "5" }])
})

// Directives, comments, comment BLOCKS and lines that are none of those are
// kept as the text they are, at their own line numbers — and an indented line
// CONTINUES the directive above it rather than becoming a line the page calls
// unknown. (from "what is not a transaction or a posting is kept raw, in line
// order")
test("what is not a transaction or a posting is kept raw, in line order", () => {
  const text =
    "; a header comment\n" +
    "account assets:bank\n" +
    "  ; a subdirective comment\n" +
    "  note the bank's own note\n" +
    "P 2026-01-01 $ 1.5 EUR\n" +
    "\n" +
    "comment\n" +
    "this is prose\n" +
    "end comment\n" +
    "2026-13-99 not a real day\n" +
    "  stray:thing"
  expect(entries(text)).toEqual([
    [1, "comment"],
    [2, "directive"],
    [5, "directive"],
    [7, "comment"],
    [8, "comment"],
    [9, "comment"],
    [10, "unknown"],
    [11, "unknown"],
  ])
  // A sub-line keeps its own indentation: the entry is the file's lines, not a
  // trim of them.
  const kept = blocks(text)
    .filter((one): one is Extract<Block, { kind: "entry" }> => one.kind === "entry")
    .map((one) => one.text)
  expect(kept[1]).toBe("account assets:bank\n  ; a subdirective comment\n  note the bank's own note")
  expect(kept[2]).toBe("P 2026-01-01 $ 1.5 EUR")
  expect(blocks(text).filter((one) => one.kind === "transaction")).toEqual([])
})

// A directive BETWEEN two transactions ends the first and does not become a
// posting of either. (from "a directive between two transactions belongs to
// neither")
test("a directive between two transactions belongs to neither", () => {
  const text = "2026-01-01 x\n    a  $1\n    b\n" + "\n" + "account foo\n" + "\n" + "2026-01-02 y\n    a  $2\n    b"
  expect(
    blocks(text)
      .filter((one): one is Extract<Block, { kind: "transaction" }> => one.kind === "transaction")
      .map((one) => one.header.date),
  ).toEqual(["2026-01-01", "2026-01-02"])
  const kept = blocks(text).filter((one): one is Extract<Block, { kind: "entry" }> => one.kind === "entry")
  expect(kept.map((one) => [one.line, one.text])).toEqual([[5, "account foo"]])
})
