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

// This comparison is why a test can assert on "the first error" and a human can
// diff two error views: same set in, same list out, whatever order the rules
// happened to run in.
test("errors sort by file, then line, then code", () => {
  expect(
    order([
      error("b.org", 1, "bad-id"),
      error("a.org", 10, "bad-id"),
      error("a.org", 2, "unknown-target"),
      error("a.org", 2, "bad-date"),
    ]),
  ).toEqual([
    "a.org:2:bad-date",
    "a.org:2:unknown-target",
    "a.org:10:bad-id",
    "b.org:1:bad-id",
  ])
})

// Lines are compared as numbers. String order would file line 10 before line 2
// and make a long file's error list read at random.
test("line 10 sorts after line 2, not before it", () => {
  expect(compareErrors(error("a.org", 10, "bad-id"), error("a.org", 2, "bad-id")))
    .toBeGreaterThan(0)
})

// Files are compared by code point, not by `localeCompare`: a locale-sensitive
// sort orders `B.org` after `a.org` in English and elsewhere would not, so
// "two loads of the same broken set produce the same list" would stop being
// true between two machines — which is the whole reason to order it at all.
test("files sort by code point, not by locale", () => {
  expect(order([error("a.org", 1, "bad-id"), error("B.org", 1, "bad-id")]))
    .toEqual(["B.org:1:bad-id", "a.org:1:bad-id"])
  // `Order.Order` is still a comparator, which is what `sort` above is handed.
  expect(compareErrors(error("a.org", 1, "bad-id"), error("B.org", 1, "bad-id")))
    .toBeGreaterThan(0)
})

// The browser groups cross-file errors on their own, because "which file is
// broken" has no single answer for them — a duplicate id across two files
// implicates both.
test("an error is cross-file when a related site lives in another file", () => {
  expect(
    isCrossFile(
      error("b.org", 1, "duplicate-id", [
        { file: "a.org", line: 1, note: "first declared here" },
      ]),
    ),
  ).toBe(true)
  // Same file, and no related sites at all, are both squarely one file's
  // problem.
  expect(
    isCrossFile(
      error("a.org", 3, "parent-cycle", [
        { file: "a.org", line: 1, note: "also in the loop" },
      ]),
    ),
  ).toBe(false)
  expect(isCrossFile({ code: "bad-id", file: "a.org", line: 1, message: "x" })).toBe(false)
})

// THE TWO PLANES, and one reading of the field that separates them. A site
// marked `broken: false` is NAMED and not blamed — the ground a judgement
// stands on, or the thing a broken record reached at — so the about axis
// reaches it (a reader draws it; the drift check at a refusal has to be able
// to ask about a stale judge) and the blame does not. `isCrossFile` is the
// second counted rather than a third reading of `Related.broken`, which is the
// drift this pair exists to make impossible.
test("a site the finding NAMES but does not break is on one plane and not the other", () => {
  const named = error("lanes.org", 3, "bad-prop", [
    { file: "_olai/Properties.org", line: 1, note: "declared here", broken: false },
  ])
  expect(implicatedBy(named)).toEqual(["lanes.org", "_olai/Properties.org"])
  expect(blamedOn(named)).toEqual(["lanes.org"])
  expect(isCrossFile(named)).toBe(false)

  // …and an unmarked site is on both, which is the safe default: a rule that
  // forgets over-darkens rather than drawing a page out of records the
  // validator has just refused.
  const shared = error("b.org", 1, "duplicate-id", [
    { file: "a.org", line: 1, note: "first declared here" },
  ])
  expect(implicatedBy(shared)).toEqual(blamedOn(shared))
  expect(blamedOn(shared)).toEqual(["b.org", "a.org"])

  // One file named TWICE — once as ground, once as broken — is broken,
  // whichever order the sites came in, and appears once on each plane.
  const both = error("lanes.org", 3, "bad-prop", [
    { file: "a.org", line: 1, note: "declared here", broken: false },
    { file: "a.org", line: 9, note: "first declared here" },
  ])
  expect(blamedOn(both)).toEqual(["lanes.org", "a.org"])
  expect(implicatedBy(both)).toEqual(["lanes.org", "a.org"])
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
  const line = error("a.org", 1, "not-json")
  const set = error("a.org", 2, "unknown-parent")
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
    // A property that does not fit what its key declares, and a declaration
    // that does not say a type this format knows — one code for the two ends
    // of one arrangement (`./typing.ts`).
    "bad-prop",
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

/**
 * THE FORCING HALF of the two-plane rule, and the reason it is here rather
 * than in the catalogue itself.
 *
 * `Related.broken` is a per-SITE fact set by the rule that makes a finding —
 * which is right, because the two kinds of related site are not two kinds of
 * CODE: a `bad-prop` names its judge, a `foreign-parent` names what it reached
 * at, a `duplicate-id` and a cycle name sites that share the fault, and a code
 * that one day names both a ground and a fault has one row on a per-code table
 * and two sites on this axis. What a per-site field does NOT have is the thing
 * `Reach` has one level up: a place a new code is made to answer.
 *
 * So the forcing lives here, in the same shape {@link stageOf}'s split is
 * pinned in above. Every code is in exactly one of the two lists, so adding
 * one to the catalogue fails this test until somebody says which — and the
 * answer is checked against the RULES rather than taken on trust, so the list
 * cannot quietly drift into being the second axis it exists to avoid.
 *
 * ABSENT MEANS BROKEN, so the safe direction is the default: a rule that
 * forgets over-darkens a page a reader can still reach, where the opposite
 * mistake draws a page out of records the validator has just refused.
 */
const NAMES_WITHOUT_BREAKING: ReadonlyArray<ErrorCode> = [
  // The parent's file did nothing but be pointed at; the `parent` field that
  // reached across is the whole of the fix, and it is in the other file.
  "foreign-parent",
  // The declaration that judged the value is the judgement's ground: named so
  // the fixer knows who said no, lit and writable because it said no.
  "bad-prop",
]

test("every code says whether it can name a file it does not break", () => {
  // SPELLED OUT, both halves, exactly the way the line/set split above is —
  // and for the same reason. A membership filter would be a tautology here
  // (the complement of a list is always the rest of the list); what forces a
  // new code to answer is the OTHER half being written down, so adding one to
  // the catalogue fails this test until somebody puts it in a half.
  const breaking = ErrorCode.literals.filter((code) => !NAMES_WITHOUT_BREAKING.includes(code))
  expect(breaking).toEqual([
    "not-json",
    "not-an-object",
    "bad-record",
    "bad-id",
    "several-marks",
    "bad-date",
    "bad-repeat",
    // Two files that both claim one id are two files nobody can draw the
    // second of: the fault is shared, so both go dark.
    "duplicate-id",
    "unknown-parent",
    "parent-not-a-node",
    // A cycle's every step is in the loop; whichever one a reader edits, the
    // rest were wrong together.
    "parent-cycle",
    "unknown-target",
    "after-cycle",
    "mirror-cycle",
    "missing-doc",
    "unreadable-directory",
    "unreadable-file",
  ])
  expect(breaking.length + NAMES_WITHOUT_BREAKING.length).toBe(ErrorCode.literals.length)
})

// …AND THE LIST IS HELD TO THE RULES, over a corpus that provokes one finding
// of each code that names a second file at all. Without this the list would be
// a per-code table beside the rows — free to say `foreign-parent` is a pointer
// long after somebody changed the rule that emits it.
test("the two planes differ for exactly the codes that say they do", () => {
  const found = findingsIn(validatedOf({
    // `boxes` twice, across two files: both ends share the fault.
    "attic.org": `{"id":"attic","ord":"a0","title":"the attic"}\n` +
      `{"id":"boxes","parent":"attic","ord":"a1","title":"sort the boxes"}`,
    "cellar.org": `{"id":"cellar","ord":"a0","title":"the cellar"}\n` +
      // …and a `parent` reaching into attic.org: named, not blamed.
      `{"id":"shelves","parent":"attic","ord":"a1","title":"put up shelves"}\n` +
      `{"id":"boxes","parent":"cellar","ord":"a2","title":"sort the crates"}`,
    // A value judged by a declaration one file over: the judge is named.
    "_olai/Properties.org":
      `{"id":"p","ord":"a0","title":"records","custom":{"type":"int"}}`,
    "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"records":"prose"}}`,
  }))

  // Every finding names at least what it breaks — the planes are nested, never
  // crossing, which is what makes "about" the wider one.
  for (const finding of found) {
    expect({ code: finding.code, nested: blamedOn(finding).every((file) => implicatedBy(finding).includes(file)) })
      .toEqual({ code: finding.code, nested: true })
  }

  // …and the ones that name MORE than they break are exactly the declared list.
  const wider = [
    ...new Set(
      found
        .filter((finding) => implicatedBy(finding).length > blamedOn(finding).length)
        .map((finding) => finding.code),
    ),
  ].sort()
  expect(wider).toEqual(["bad-prop", "foreign-parent"])
  expect(wider.every((code) => NAMES_WITHOUT_BREAKING.includes(code as ErrorCode))).toBe(true)

  // The corpus really did provoke a shared-fault cross-file finding too, or
  // the assertion above would pass on a corpus that proves nothing.
  const shared = found.filter((finding) => finding.code === "duplicate-id")
  expect(shared.length).toBeGreaterThan(0)
  expect(blamedOn(shared[0] as OutlineError).length).toBe(2)
})
