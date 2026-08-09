import { expect, test } from "bun:test"

import { compareErrors, isCrossFile, kindOf, type OutlineError } from "./errors.ts"

const error = (
  file: string,
  line: number,
  code: OutlineError["code"],
  related: OutlineError["related"] = [],
): OutlineError => ({ code, file, line, message: `${code} at ${file}:${line}`, related })

const order = (errors: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  [...errors].sort(compareErrors).map((e) => `${e.file}:${e.line}:${e.code}`)

// This comparison is why a test can assert on "the first error" and a human can
// diff two error views: same set in, same list out, whatever order the rules
// happened to run in.
test("errors sort by file, then line, then code", () => {
  expect(
    order([
      error("b.jsonl", 1, "bad-id"),
      error("a.jsonl", 10, "bad-id"),
      error("a.jsonl", 2, "unknown-target"),
      error("a.jsonl", 2, "bad-date"),
    ]),
  ).toEqual([
    "a.jsonl:2:bad-date",
    "a.jsonl:2:unknown-target",
    "a.jsonl:10:bad-id",
    "b.jsonl:1:bad-id",
  ])
})

// Lines are compared as numbers. String order would file line 10 before line 2
// and make a long file's error list read at random.
test("line 10 sorts after line 2, not before it", () => {
  expect(compareErrors(error("a.jsonl", 10, "bad-id"), error("a.jsonl", 2, "bad-id")))
    .toBeGreaterThan(0)
})

// The browser groups cross-file errors on their own, because "which file is
// broken" has no single answer for them — a duplicate id across two files
// implicates both.
test("an error is cross-file when a related site lives in another file", () => {
  expect(
    isCrossFile(
      error("b.jsonl", 1, "duplicate-id", [
        { file: "a.jsonl", line: 1, note: "first declared here" },
      ]),
    ),
  ).toBe(true)
  // Same file, and no related sites at all, are both squarely one file's
  // problem.
  expect(
    isCrossFile(
      error("a.jsonl", 3, "parent-cycle", [
        { file: "a.jsonl", line: 1, note: "also in the loop" },
      ]),
    ),
  ).toBe(false)
  expect(isCrossFile({ code: "bad-id", file: "a.jsonl", line: 1, message: "x" })).toBe(false)
})

// The kind is a pure function of the code rather than a stored field: this
// format refuses derived state in its data, and storing it in its own errors
// would be the same mistake with a second way to disagree.
test("only the derived-state rule is a `derived` error", () => {
  expect(kindOf("stored-derived-state")).toBe("derived")
  expect(kindOf("not-json")).toBe("validation")
  expect(kindOf("mirror-cycle")).toBe("validation")
})
