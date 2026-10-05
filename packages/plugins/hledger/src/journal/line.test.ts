import { expect, test } from "bun:test"

import { classify } from "./line.ts"

// A date in a comment is a comment and not a transaction, which is the whole
// reason lines are classified before they are parsed. (from `hledger.test.ts`'s
// "a date in a comment is a comment")
test("a date in a comment is a comment", () => {
  expect([classify("; 2026-01-05 something").kind, classify("# 2026-01-05 too").kind, classify("* 2026-01-05 as well").kind])
    .toEqual(["comment", "comment", "comment"])
})

// The whole vocabulary, told from the line alone — no transaction and no
// comment block in sight.
test("a line is classified by its own shape", () => {
  expect(classify("").kind).toBe("blank")
  expect(classify("   \t").kind).toBe("blank")
  expect(classify("; a comment").kind).toBe("comment")
  expect(classify("account assets:bank").kind).toBe("directive")
  expect(classify("comment").kind).toBe("blockOpen")
  expect(classify("    expenses:food  $10").kind).toBe("indented")
  expect(classify("    ; paid by card").kind).toBe("indentedComment")
  expect(classify("    # too").kind).toBe("indentedComment")
  expect(classify("2026-01-05 x").kind).toBe("header")
  expect(classify("2024-02-31 not a day").kind).toBe("headerRefused")
})

// A line that looks like a header but names no real day is refused rather than
// believed, and the caller keeps it as raw text.
test("a date-shaped line with no real day is refused", () => {
  const refused = classify("2024-02-31 nothing happens")
  expect(refused.kind).toBe("headerRefused")
  expect(classify("2026-01-01x y").kind).toBe("headerRefused")
})
