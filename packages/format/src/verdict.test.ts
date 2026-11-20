import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Document, outlineDocument } from "./document.ts"
import { type BrokenFile, type ErrorCode, implicatedBy, type OutlineError } from "./errors.ts"
import { findingsIn, seeded, setOf, validatedOf } from "./fixtures.testlib.ts"
import { brokenIn, documentAt, nodesIn, stopping } from "./set.ts"
import { validate } from "./validate.ts"
import {
  admits,
  blamed,
  darkened,
  isClean,
  NOTHING_WRONG,
  type Summary,
  summaryOf,
  type Verdict,
  verdictOf,
} from "./verdict.ts"

const entriesOf = (verdict: Verdict): ReadonlyArray<BrokenFile> => blamed(verdict.findings)

const faceOf = (verdict: Verdict, n: number): Summary => summaryOf(entriesOf(verdict), n)

const rowOf = (
  file: string,
  code: ErrorCode,
  related: ReadonlyArray<readonly [file: string, line: number]> = [],
): OutlineError => ({
  file,
  line: 1,
  code,
  message: `${code} in ${file}`,
  ...(related.length === 0 ? {} : {
    related: related.map(([at, line]) => ({ file: at, line, note: "here" })),
  }),
})

const flood = (file: string, many: number): Verdict =>
  verdictOf(
    Array.from({ length: many }, (_, at) => ({
      file,
      line: at + 1,
      code: "bad-prop" as const,
      message: `\`agent\` holds something \`roster\` does not declare (row ${at})`,
    })),
  )

test("a finding implicates where it was found", () => {
  expect(implicatedBy(rowOf("a.olai", "duplicate-id"))).toEqual(["a.olai"])
})

test("a finding implicates every file it names as related, once each", () => {
  const row = rowOf("a.olai", "parent-cycle", [
    ["b.olai", 4],
    ["a.olai", 9],
    ["b.olai", 7],
  ])
  expect(implicatedBy(row)).toEqual(["a.olai", "b.olai"])
})

test("the implicated files come out in path order, whatever order the rows are in", () => {
  const verdict = verdictOf([
    rowOf("wing/room.olai", "duplicate-id"),
    rowOf("a.olai", "unknown-target"),
    rowOf("wing.olai", "unknown-target"),
  ])
  expect(entriesOf(verdict).map((one) => one.file))
    .toEqual(["a.olai", "wing/room.olai", "wing.olai"])
})

test("a write to files no finding is about is admitted", () => {
  const verdict = verdictOf([rowOf("lanes.olai", "bad-prop")])
  expect(admits(entriesOf(verdict), ["roadmap/bugs.olai"])).toEqual({ _tag: "admitted" })
  expect(admits(entriesOf(verdict), ["roadmap/bugs.olai", "house.olai"])._tag).toBe("admitted")
})

test("a write to an implicated file is refused, and the refusal NAMES it", () => {
  const rows = [rowOf("lanes.olai", "bad-prop"), rowOf("lanes.olai", "duplicate-id")]
  const admission = admits(entriesOf(verdictOf(rows)), ["lanes.olai"])
  expect(admission).toEqual({ _tag: "implicated", file: "lanes.olai", rows })
})

test("the blocker named is the first of the write's own files that is implicated", () => {
  const verdict = verdictOf([rowOf("b.olai", "bad-prop"), rowOf("c.olai", "bad-prop")])
  const admission = admits(entriesOf(verdict), ["a.olai", "c.olai", "b.olai"])
  expect(admission._tag === "implicated" && admission.file).toBe("c.olai")
})

test("a cross-file finding implicates both ends, so a write to either is refused", () => {
  const verdict = verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])])
  expect(admits(entriesOf(verdict), ["a.olai"])._tag).toBe("implicated")
  expect(admits(entriesOf(verdict), ["b.olai"])._tag).toBe("implicated")
  expect(admits(entriesOf(verdict), ["c.olai"])._tag).toBe("admitted")
})

test("a declaration a bad value names is related, not broken — the blame and the gate say so", () => {
  const verdict = verdictOf([{
    file: "lanes.olai",
    line: 3,
    code: "bad-prop",
    message: "pr must be a day",
    related: [{
      file: "_olai/Properties.olai",
      line: 1,
      note: "declared here",
      broken: false,
    }],
  } as OutlineError])
  const entries = entriesOf(verdict)
  expect(implicatedBy(verdict.findings[0] as OutlineError))
    .toEqual(["lanes.olai", "_olai/Properties.olai"])
  expect(entries.map((one) => one.file)).toEqual(["lanes.olai"])
  expect(admits(entries, ["_olai/Properties.olai"])._tag).toBe("admitted")
  expect(admits(entries, ["lanes.olai"])._tag).toBe("implicated")
})

test("an unmarked related is broken by DEFAULT — a cycle's steps darken both files", () => {
  const verdict = verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])])
  expect(entriesOf(verdict).map((one) => one.file)).toEqual(["a.olai", "b.olai"])
})

test("a parent a foreign placement names is related, not broken", () => {
  const verdict = verdictOf([{
    file: "child.olai",
    line: 2,
    code: "foreign-parent",
    message: "`parent` is `kitchen`, which lives in another file",
    related: [{
      file: "parent.olai",
      line: 1,
      note: "the parent lives here",
      broken: false,
    }],
  } as OutlineError])
  const entries = entriesOf(verdict)
  expect(implicatedBy(verdict.findings[0] as OutlineError))
    .toEqual(["child.olai", "parent.olai"])
  expect(entries.map((one) => one.file)).toEqual(["child.olai"])
  expect(admits(entries, ["parent.olai"])._tag).toBe("admitted")
  expect(admits(entries, ["child.olai"])._tag).toBe("implicated")
})

const dark = (file: string): BrokenFile => ({
  file,
  errors: [rowOf(file, "bad-prop")],
})

test("a file this write put out is named, and one that was already out is not", () => {
  expect(darkened([], [dark("lanes.olai")])).toEqual(["lanes.olai"])
  expect(darkened([dark("lanes.olai")], [dark("lanes.olai")])).toEqual([])
  const worse: BrokenFile = {
    file: "lanes.olai",
    errors: [rowOf("lanes.olai", "bad-prop"), rowOf("lanes.olai", "unknown-target")],
  }
  expect(darkened([dark("lanes.olai")], [worse])).toEqual([])
})

test("a write that breaks nothing new darkens nothing, and a mend even less", () => {
  expect(darkened([], [])).toEqual([])
  expect(darkened([dark("lanes.olai")], [])).toEqual([])
})

test("the darkened files come out in the order the report filed them", () => {
  expect(darkened([dark("b.olai")], [dark("a.olai"), dark("b.olai"), dark("c.olai")]))
    .toEqual(["a.olai", "c.olai"])
})

test("the write's own files are the first half of the ask, answered by admits", () => {
  expect(admits([dark("garden.olai")], ["garden.olai"])._tag).toBe("implicated")
  expect(darkened([], [dark("garden.olai")])).toEqual(["garden.olai"])
})

const AGENTS = {
  "_olai/Properties.olai":
    `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
  "agents.olai": `{"id":"roster","ord":"a0","title":"the agents"}\n` +
    `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
  "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}`,
  "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
}

test("a write that strands a value in a third file is stopped, naming that file", () => {
  const standing = validatedOf(AGENTS)
  expect(standing.broken).toEqual([])

  const moved = validatedOf({
    ...AGENTS,
    "agents.olai": `{"id":"roster","ord":"a0","title":"the agents"}`,
    "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n` +
      `{"id":"claude","ord":"a1","title":"Claude"}`,
  })
  const paths = ["agents.olai", "garden.olai"]
  expect(moved.broken.map((one) => one.file)).toEqual(["lanes.olai"])
  expect(admits(moved.broken, paths)._tag).toBe("admitted")
  const stopped = stopping(moved, paths, standing)
  expect(stopped?.findings.map((one) => [one.file, one.code]))
    .toEqual([["lanes.olai", "bad-prop"]])
})

test("the same write lands once nothing names the moved variant", () => {
  const { "lanes.olai": _stranded, ...rest } = AGENTS
  const standing = validatedOf(rest)
  const moved = validatedOf({
    ...rest,
    "agents.olai": `{"id":"roster","ord":"a0","title":"the agents"}`,
    "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n` +
      `{"id":"claude","ord":"a1","title":"Claude"}`,
  })
  expect(moved.broken).toEqual([])
  expect(stopping(moved, ["agents.olai", "garden.olai"], standing)).toBeNull()
})

test("a declaration over unfit values in another file is stopped by the GATE", () => {
  const held = {
    "lanes.olai": [
      `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"not a path"}}`,
      `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"prose"}}`,
    ].join("\n"),
    "house.olai": `{"id":"house","ord":"a0","title":"the house"}`,
  }
  const standing = validatedOf(held)
  expect(standing.broken).toEqual([])

  const declared = validatedOf({
    ...held,
    "_olai/Properties.olai":
      `{"id":"p","ord":"a0","title":"brainstorm","custom":{"type":"doc"}}`,
  })
  expect(declared.broken.map((one) => one.file)).toEqual(["lanes.olai"])

  const paths = ["_olai/Properties.olai"]
  expect(admits(declared.broken, paths)._tag).toBe("admitted")
  expect(stopping(declared, paths, standing)?.findings.map((one) => one.file))
    .toEqual(["lanes.olai", "lanes.olai"])
})

test("a directory that could not be read implicates every write", () => {
  const verdict = verdictOf([rowOf(".", "unreadable-directory")])
  const admission = admits(entriesOf(verdict), ["anything.olai"])
  expect(admission._tag === "implicated" && admission.file).toBe(".")
})

test("a clean verdict admits everything, and says it is clean", () => {
  expect(isClean(NOTHING_WRONG)).toBe(true)
  expect(admits(entriesOf(NOTHING_WRONG), ["a.olai"])._tag).toBe("admitted")
  expect(verdictOf([])).toBe(NOTHING_WRONG)
})

test("a summary carries counts and never a row, whatever the row count", () => {
  const face = faceOf(flood("lanes.olai", 135), 5)
  expect(face.files).toEqual([{ file: "lanes.olai", state: "invalid", count: 135 }])
  expect(face.total).toBe(135)
  expect(face.more).toBe(0)
  expect(JSON.stringify(face)).not.toContain("message")
})

test("the face of a 135-row file is the face of a 5-row file, but for the count", () => {
  const many = faceOf(flood("lanes.olai", 135), 5)
  const few = faceOf(flood("lanes.olai", 5), 5)
  expect({ ...many, files: many.files.map((one) => ({ ...one, count: 0 })), total: 0 })
    .toEqual({ ...few, files: few.files.map((one) => ({ ...one, count: 0 })), total: 0 })
})

test("more implicated files than the clamp are counted, not drawn", () => {
  const verdict = verdictOf(
    ["a.olai", "b.olai", "c.olai", "d.olai"].map((file) => rowOf(file, "duplicate-id")),
  )
  const face = faceOf(verdict, 2)
  expect(face.files.map((one) => one.file)).toEqual(["a.olai", "b.olai"])
  expect(face.more).toBe(2)
  expect(face.total).toBe(4)
})

test("a file's state is the worst thing said about it", () => {
  const unreadable = faceOf(verdictOf([rowOf("a.olai", "unreadable-file")]), 5)
  expect(unreadable.files[0]?.state).toBe("unreadable")
  const unparsed = faceOf(
    verdictOf([rowOf("a.olai", "not-json"), rowOf("a.olai", "duplicate-id")]),
    5,
  )
  expect(unparsed.files[0]?.state).toBe("unparsed")
  const invalid = faceOf(verdictOf([rowOf("a.olai", "duplicate-id")]), 5)
  expect(invalid.files[0]?.state).toBe("invalid")
})

test("a cross-file finding is counted under both files, and counted twice", () => {
  const face = faceOf(verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])]), 5)
  expect(face.files.map((one) => one.count)).toEqual([1, 1])
  expect(face.total).toBe(2)
})

test("the face of a set's broken files is the face of the verdict that broke them", () => {
  const verdict = verdictOf([
    rowOf("a.olai", "mirror-cycle", [["b.olai", 3]]),
    rowOf("c.olai", "duplicate-id"),
  ])
  expect(faceOf(verdict, 5)).toEqual(faceOf(verdict, 5))
})

const healthy = (random: () => number): Record<string, string> => {
  const files: Record<string, string> = {}
  const many = 3 + Math.floor(random() * 3)
  for (let which = 0; which < many; which++) {
    const lines: Array<string> = []
    const own: Array<string> = []
    const records = 1 + Math.floor(random() * 4)
    for (let at = 0; at < records; at++) {
      const id = `f${which}n${at}`
      const record: Record<string, unknown> = { id, ord: "a0", title: `row ${at}` }
      if (own.length > 0 && random() < 0.5) {
        record["parent"] = own[Math.floor(random() * own.length)] as string
      }
      if (own.length > 0 && random() < 0.3) {
        record["see"] = [own[Math.floor(random() * own.length)] as string]
      }
      own.push(id)
      lines.push(JSON.stringify(record))
    }
    files[`f${which}.olai`] = lines.join("\n")
  }
  return files
}

const HOLE = `{"id":"x","ord"`

const dangled = (
  files: Record<string, string>,
  file: string,
  which: number,
): Record<string, string> => ({
  ...files,
  [file]: `${files[file] as string}\n${
    JSON.stringify({
      id: `dangler${which}`,
      ord: "z0",
      title: "points at nobody",
      see: ["nobody-declares-this"],
    })
  }`,
})

const adopted = (
  files: Record<string, string>,
  child: string,
  which: number,
): Record<string, string> => ({
  ...files,
  [child]: `${files[child] as string}\n${
    JSON.stringify({
      id: `adopted${which}`,
      ord: "z0",
      title: "placed in another file's tree",
      parent: "f0n0",
    })
  }`,
})

test("a value that fits no declaration is not washed out by an unparsed file", () => {
  const files = {
    "_olai/Properties.olai": `{"id":"p","ord":"a0","title":"records","custom":{"type":"int"}}`,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"records":"prose"}}`,
  }
  const clean = validatedOf(files)
  expect(clean.broken.map((one) => one.file)).toEqual(["lanes.olai"])

  const set = validatedOf(files, [], { "pantry.olai": `{"id":"pantry"` })
  expect(set.broken.map((one) => one.file).slice().sort())
    .toEqual(["lanes.olai", "pantry.olai"])
  expect(brokenIn(set, "lanes.olai")?.map((one) => one.code)).toEqual(["bad-prop"])
  expect(admits(set.broken, ["lanes.olai"])._tag).toBe("implicated")
})

test("a ref value IS still a guess while a file will not parse", () => {
  const files = {
    "_olai/Properties.olai":
      `{"id":"p","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
    "agents.olai": `{"id":"roster","ord":"a0","title":"the roster"}\n` +
      `{"id":"claude","parent":"roster","ord":"a1","title":"Claude"}`,
    "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"nobody"}}`,
  }
  const alone = validatedOf(files)
  expect(alone.broken.map((one) => one.file)).toEqual(["lanes.olai"])

  const set = validatedOf(files, [], { "pantry.olai": `{"id":"pantry"` })
  expect(set.broken.map((one) => one.file)).toEqual(["pantry.olai"])
  expect(admits(set.broken, ["lanes.olai"])._tag).toBe("admitted")
})

test("a set degrades per file, over generated broken sets", () => {
  const random = seeded(20260825)
  for (let round = 0; round < 200; round++) {
    const base = healthy(random)
    const paths = Object.keys(base)
    const hole = paths[round % paths.length] as string
    const rest = Object.fromEntries(Object.entries(base).filter(([file]) => file !== hole))

    const clean = validate(TEST_CLAIMS, setOf(base))
    expect([round, Result.isSuccess(clean)]).toEqual([round, true])
    if (Result.isSuccess(clean)) {
      expect([round, clean.success.set.broken.length]).toEqual([round, 0])
      for (const file of paths) {
        expect([round, file, admits(clean.success.set.broken, [file])._tag])
          .toEqual([round, file, "admitted"])
      }
    }

    const holed = setOf(rest, [], { [hole]: HOLE })
    expect([round, Result.isSuccess(validate(TEST_CLAIMS, holed))]).toEqual([round, true])
    expect([round, holed.broken.map((one) => one.file)]).toEqual([round, [hole]])

    const broke = paths[round % paths.length] as string
    const dangling = validate(TEST_CLAIMS, setOf(dangled(base, broke, round)))
    expect([round, Result.isSuccess(dangling)]).toEqual([round, true])
    if (Result.isSuccess(dangling)) {
      const set = dangling.success.set
      expect([round, set.broken.map((one) => one.file)]).toEqual([round, [broke]])
      expect([round, brokenIn(set, broke)?.length ?? 0]).toEqual([round, 1])
      expect([round, documentAt(set, broke)]).toEqual([round, outlineDocument(TEST_CLAIMS, broke, [])])
      for (const survivor of paths.filter((file) => file !== broke)) {
        expect([round, survivor, brokenIn(set, survivor)]).toEqual([round, survivor, undefined])
        expect([round, survivor, nodesIn(Result.succeed(documentAt(set, survivor) as Document)).length > 0])
          .toEqual([round, survivor, true])
        expect([round, survivor, admits(set.broken, [survivor])._tag]).toEqual([round, survivor, "admitted"])
      }
      expect([round, admits(set.broken, [broke])])
        .toEqual([round, {
          _tag: "implicated",
          file: broke,
          rows: brokenIn(set, broke) as ReadonlyArray<OutlineError>,
        }])
      const face = summaryOf(set.broken, 100)
      expect([round, face.files.map((one) => one.file)]).toEqual([round, [broke]])
      expect([round, face.total]).toEqual([round, brokenIn(set, broke)?.length ?? 0])
    }

    const away = paths[0] as string
    const home = paths.find((file) => file !== away) as string
    const across = validate(TEST_CLAIMS, setOf(adopted(base, home, round)))
    expect([round, Result.isSuccess(across)]).toEqual([round, true])
    if (Result.isSuccess(across)) {
      const set = across.success.set
      const found = findingsIn(set).filter((one) => one.code === "foreign-parent")
      expect([round, found.length]).toEqual([round, 1])
      expect([round, implicatedBy(found[0] as OutlineError).slice().sort()])
        .toEqual([round, [away, home].slice().sort()])
      expect([round, set.broken.map((one) => one.file)]).toEqual([round, [home]])
      expect([round, home, admits(set.broken, [home])._tag]).toEqual([round, home, "implicated"])
      for (const survivor of paths.filter((file) => file !== home)) {
        expect([round, survivor, brokenIn(set, survivor)]).toEqual([round, survivor, undefined])
        expect([round, survivor, admits(set.broken, [survivor])._tag]).toEqual([round, survivor, "admitted"])
      }
    }

    const other = paths.find((file) => file !== hole) as string
    const mixed = validate(TEST_CLAIMS,
      setOf(dangled(rest, other, round), [], { [hole]: HOLE }),
    )
    expect([round, Result.isSuccess(mixed)]).toEqual([round, true])
    if (Result.isSuccess(mixed)) {
      const set = mixed.success.set
      expect([round, set.broken.map((one) => one.file)]).toEqual([round, [hole]])
      expect([round, other, admits(set.broken, [other])._tag]).toEqual([round, other, "admitted"])
      expect([round, mixed.success.derived.byId.has("nobody-declares-this")])
        .toEqual([round, false])
      expect([round, mixed.success.derived.namedBy.has("nobody-declares-this")])
        .toEqual([round, true])
    }
  }
})
