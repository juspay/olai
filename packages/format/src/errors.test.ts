import { expect, test } from "bun:test"

import {
  blamedOn,
  compareErrors,
  ErrorCode,
  implicatedBy,
  isCrossFile,
  type OutlineError,
  reportStage,
  type Stage,
  stageOf,
} from "./errors.ts"
import { findingsIn, validatedOf } from "./fixtures.testlib.ts"

const error = (
  file: string,
  line: number,
  code: OutlineError["code"],
  related: OutlineError["related"] = [],
): OutlineError => ({ code, file, line, message: `${code} at ${file}:${line}`, related })

const order = (errors: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  [...errors].sort(compareErrors).map((e) => `${e.file}:${e.line}:${e.code}`)

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

test("line 10 sorts after line 2, not before it", () => {
  expect(compareErrors(error("a.olai", 10, "bad-id"), error("a.olai", 2, "bad-id")))
    .toBeGreaterThan(0)
})

test("files sort by code point, not by locale", () => {
  expect(order([error("a.olai", 1, "bad-id"), error("B.olai", 1, "bad-id")]))
    .toEqual(["B.olai:1:bad-id", "a.olai:1:bad-id"])
  expect(compareErrors(error("a.olai", 1, "bad-id"), error("B.olai", 1, "bad-id")))
    .toBeGreaterThan(0)
})

test("an error is cross-file when a related site lives in another file", () => {
  expect(
    isCrossFile(
      error("b.olai", 1, "duplicate-id", [
        { file: "a.olai", line: 1, note: "first declared here", blamed: true },
      ]),
    ),
  ).toBe(true)
  expect(
    isCrossFile(
      error("a.olai", 3, "parent-cycle", [
        { file: "a.olai", line: 1, note: "also in the loop", blamed: true },
      ]),
    ),
  ).toBe(false)
  expect(isCrossFile({ code: "bad-id", file: "a.olai", line: 1, message: "x" })).toBe(false)
})

test("a site the finding NAMES but does not break is on one plane and not the other", () => {
  const named = error("lanes.olai", 3, "bad-prop", [
    { file: "_olai/Properties.olai", line: 1, note: "declared here", blamed: false },
  ])
  expect(implicatedBy(named)).toEqual(["lanes.olai", "_olai/Properties.olai"])
  expect(blamedOn(named)).toEqual(["lanes.olai"])
  expect(isCrossFile(named)).toBe(false)

  const shared = error("b.olai", 1, "duplicate-id", [
    { file: "a.olai", line: 1, note: "first declared here", blamed: true },
  ])
  expect(implicatedBy(shared)).toEqual(blamedOn(shared))
  expect(blamedOn(shared)).toEqual(["b.olai", "a.olai"])

  const both = error("lanes.olai", 3, "bad-prop", [
    { file: "a.olai", line: 1, note: "declared here", blamed: false },
    { file: "a.olai", line: 9, note: "first declared here", blamed: true },
  ])
  expect(blamedOn(both)).toEqual(["lanes.olai", "a.olai"])
  expect(implicatedBy(both)).toEqual(["lanes.olai", "a.olai"])
})

test("the stage is decided by the code alone", () => {
  expect(stageOf("not-json")).toBe("line")
  expect(stageOf("bad-date")).toBe("line")
  expect(stageOf("duplicate-id")).toBe("set")
  expect(stageOf("mirror-cycle")).toBe("set")
})

test("a report is at the line stage while anything in it is", () => {
  const line = error("a.olai", 1, "not-json")
  const set = error("a.olai", 2, "unknown-parent")
  expect(reportStage([set, set])).toBe("set")
  expect(reportStage([line])).toBe("line")
  expect(reportStage([set, line, set])).toBe("line")
  expect(reportStage([])).toBe("set")
})

test("every published code has a stage", () => {
  const stages: ReadonlyArray<Stage> = ["line", "set"]
  const classified = ErrorCode.literals.map((code) => [code, stageOf(code)] as const)
  expect(classified.length).toBe(new Set(ErrorCode.literals).size)
  for (const [code, stage] of classified) {
    expect({ code, ok: stages.includes(stage) }).toEqual({ code, ok: true })
  }
})

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
    "ambiguous-convention",
    "unknown-parent",
    "foreign-parent",
    "parent-not-a-node",
    "parent-cycle",
    "unknown-target",
    "after-cycle",
    "mirror-cycle",
    "bad-prop",
    "unreadable-directory",
  ])
  expect(of("line").length + of("set").length).toBe(ErrorCode.literals.length)
})

const NAMES_WITHOUT_BREAKING: ReadonlyArray<ErrorCode> = [
  "foreign-parent",
  "bad-prop",
]

test("every code says whether it can name a file it does not break", () => {
  const breaking = ErrorCode.literals.filter((code) => !NAMES_WITHOUT_BREAKING.includes(code))
  expect(breaking).toEqual([
    "not-json",
    "not-an-object",
    "bad-record",
    "bad-id",
    "several-marks",
    "bad-date",
    "bad-repeat",
    "duplicate-id",
    "ambiguous-convention",
    "unknown-parent",
    "parent-not-a-node",
    "parent-cycle",
    "unknown-target",
    "after-cycle",
    "mirror-cycle",
    "unreadable-directory",
    "unreadable-file",
  ])
  expect(breaking.length + NAMES_WITHOUT_BREAKING.length).toBe(ErrorCode.literals.length)
})

test("the two planes differ for exactly the codes that say they do", () => {
  const found = findingsIn(validatedOf({
    "attic.olai": `{"id":"attic","ord":"a0","title":"the attic"}\n` +
      `{"id":"boxes","parent":"attic","ord":"a1","title":"sort the boxes"}`,
    "cellar.olai": `{"id":"cellar","ord":"a0","title":"the cellar"}\n` +
      `{"id":"shelves","parent":"attic","ord":"a1","title":"put up shelves"}\n` +
      `{"id":"boxes","parent":"cellar","ord":"a2","title":"sort the crates"}`,
    "_olai/Properties.olai":
      `{"id":"p","ord":"a0","title":"records","custom":{"type":"int"}}`,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"records":"prose"}}`,
  }))

  for (const finding of found) {
    expect({ code: finding.code, nested: blamedOn(finding).every((file) => implicatedBy(finding).includes(file)) })
      .toEqual({ code: finding.code, nested: true })
  }

  const wider = [
    ...new Set(
      found
        .filter((finding) => implicatedBy(finding).length > blamedOn(finding).length)
        .map((finding) => finding.code),
    ),
  ].sort()
  expect(wider).toEqual(["bad-prop", "foreign-parent"])
  expect(wider.every((code) => NAMES_WITHOUT_BREAKING.includes(code as ErrorCode))).toBe(true)

  const shared = found.filter((finding) => finding.code === "duplicate-id")
  expect(shared.length).toBeGreaterThan(0)
  expect(blamedOn(shared[0] as OutlineError).length).toBe(2)
})
