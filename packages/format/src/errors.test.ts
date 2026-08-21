import { expect, test } from "bun:test"

import {
  compareErrors,
  ErrorCode,
  isCrossFile,
  type OutlineError,
  reportStage,
  type Stage,
  stageOf,
} from "./errors.ts"

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
      error("b.olai", 1, "bad-id"),
      error("a.olai", 10, "bad-id"),
      error("a.olai", 2, "unknown-target"),
      error("a.olai", 2, "bad-date"),
    ]),
  ).toEqual([
    "a.olai:2:bad-date",
    "a.olai:2:unknown-target",
    "a.olai:10:bad-id",
    "b.olai:1:bad-id",
  ])
})

// Lines are compared as numbers. String order would file line 10 before line 2
// and make a long file's error list read at random.
test("line 10 sorts after line 2, not before it", () => {
  expect(compareErrors(error("a.olai", 10, "bad-id"), error("a.olai", 2, "bad-id")))
    .toBeGreaterThan(0)
})

// Files are compared by code point, not by `localeCompare`: a locale-sensitive
// sort orders `B.olai` after `a.olai` in English and elsewhere would not, so
// "two loads of the same broken set produce the same list" would stop being
// true between two machines — which is the whole reason to order it at all.
test("files sort by code point, not by locale", () => {
  expect(order([error("a.olai", 1, "bad-id"), error("B.olai", 1, "bad-id")]))
    .toEqual(["B.olai:1:bad-id", "a.olai:1:bad-id"])
  // `Order.Order` is still a comparator, which is what `sort` above is handed.
  expect(compareErrors(error("a.olai", 1, "bad-id"), error("B.olai", 1, "bad-id")))
    .toBeGreaterThan(0)
})

// The browser groups cross-file errors on their own, because "which file is
// broken" has no single answer for them — a duplicate id across two files
// implicates both.
test("an error is cross-file when a related site lives in another file", () => {
  expect(
    isCrossFile(
      error("b.olai", 1, "duplicate-id", [
        { file: "a.olai", line: 1, note: "first declared here" },
      ]),
    ),
  ).toBe(true)
  // Same file, and no related sites at all, are both squarely one file's
  // problem.
  expect(
    isCrossFile(
      error("a.olai", 3, "parent-cycle", [
        { file: "a.olai", line: 1, note: "also in the loop" },
      ]),
    ),
  ).toBe(false)
  expect(isCrossFile({ code: "bad-id", file: "a.olai", line: 1, message: "x" })).toBe(false)
})

// The stage is a pure function of the code rather than a stored field: two
// answers to "which stage is this" is one more than the report can have, and
// the code already decides it.
test("the stage is decided by the code alone", () => {
  expect(stageOf("not-json")).toBe("line")
  expect(stageOf("bad-date")).toBe("line")
  expect(stageOf("duplicate-id")).toBe("set")
  expect(stageOf("mirror-cycle")).toBe("set")
  expect(stageOf("missing-doc")).toBe("set")
})

// A whole report has a stage too, and it is the pessimistic one. A file is
// decoded whole or not at all, so one `line` error anywhere means the set was
// judged without that file's nodes: the rules ran, but the ones a missing file
// could have invented were withheld rather than guessed at. So the report has a
// question still open, and the view says so rather than letting a reader
// conclude from a short list that the rest of the set is fine.
test("a report is at the line stage while anything in it is", () => {
  const line = error("a.olai", 1, "not-json")
  const set = error("a.olai", 2, "unknown-parent")
  expect(reportStage([set, set])).toBe("set")
  expect(reportStage([line])).toBe("line")
  // One line error among many set errors still holds the whole report back —
  // the position in the list is not what decides it.
  expect(reportStage([set, line, set])).toBe("line")
  // Nothing wrong is a report that got all the way through both halves.
  expect(reportStage([])).toBe("set")
})

// The drift guard the old two-place declaration could not have: the codes and
// their stages are ONE table, so every code the schema publishes must classify,
// and it must classify as one of the two stages rather than `undefined` read
// through a lenient index type. A code added without a stage fails here.
test("every published code has a stage", () => {
  const stages: ReadonlyArray<Stage> = ["line", "set"]
  const classified = ErrorCode.literals.map((code) => [code, stageOf(code)] as const)
  expect(classified.length).toBe(new Set(ErrorCode.literals).size)
  for (const [code, stage] of classified) {
    expect({ code, ok: stages.includes(stage) }).toEqual({ code, ok: true })
  }
})

// The split is load-bearing, not cosmetic: a report holding any `line` error has
// not asked the `set` questions yet, so which side each code falls on is itself
// part of the contract — spelled out here so moving one is a deliberate edit.
test("the line/set split is exactly the two halves of the codec", () => {
  const of = (stage: Stage): ReadonlyArray<string> =>
    ErrorCode.literals.filter((code) => stageOf(code) === stage)
  expect(of("line")).toEqual([
    "not-json",
    "not-an-object",
    "bad-record",
    "bad-id",
    "several-marks",
    "bad-date",
    "bad-repeat",
    "unreadable-file",
  ])
  expect(of("set")).toEqual([
    "duplicate-id",
    "unknown-parent",
    "foreign-parent",
    "parent-not-a-node",
    "parent-cycle",
    "unknown-target",
    "after-cycle",
    "mirror-cycle",
    "missing-doc",
    // Not about the format at all — the DIRECTORY could not be read — and
    // `set` for the reason the split exists: it is a fact about the whole
    // load rather than about one record, and nothing about it is waiting on a
    // file that has yet to parse.
    "unreadable-directory",
  ])
  // Together, the whole catalogue: no code is in neither half, and none is in
  // both.
  expect(of("line").length + of("set").length).toBe(ErrorCode.literals.length)
})
