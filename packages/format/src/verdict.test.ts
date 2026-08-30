/**
 * THE VERDICT'S OWN SUITE — and the differential that says what a load does
 * with a finding.
 *
 * Two halves. The first asks the shape the questions it exists to answer
 * (`./verdict.ts`): what a finding implicates, how a refusal is read, what a
 * bounded face says. The second is where the human's ruling of 2026-08-29
 * lives, over generated broken sets: a finding breaks the FILES IT IS ABOUT and
 * nothing else, so a set with one bad outline in it is served with that outline
 * withheld and every other file live, readable and writable.
 *
 * IT USED TO PIN THE OPPOSITE, and the same corpora prove it: this arm was
 * written to say that the tier shelf shipped UNTURNED — every `set` class
 * refusing the whole vault, every `line` class carried — with a note that it
 * was expected to fail the day the human ruled, so that the ruling came through
 * a test saying what changed rather than through a value somebody edited. This
 * is that day, and this is that test.
 *
 * The corpora are grown here rather than taken from `./corpora.testlib.ts`,
 * and that is the one place this file goes its own way: those corpora are
 * deliberately awkward — dangling targets, duplicate ids, parents across files
 * — which is exactly right for the patcher and useless for a differential whose
 * whole subject is WHICH KIND of breakage a set has. What this needs is a set
 * that validates, and then one breakage of a known class put into it.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Document, outlineDocument } from "./document.ts"
import { type BrokenFile, type ErrorCode, implicatedBy, type OutlineError } from "./errors.ts"
import { seeded, setOf } from "./fixtures.testlib.ts"
import { brokenIn, documentAt, findingsIn, nodesIn, stopping } from "./set.ts"
import { validate } from "./validate.ts"
import {
  admits,
  blamed,
  implicatedIn,
  implicating,
  isClean,
  NOTHING_WRONG,
  type Summary,
  summaryOf,
  type Verdict,
  verdictOf,
} from "./verdict.ts"

/**
 * THE ONE STEP every reader of a verdict makes: it becomes per-file ENTRIES,
 * and every question below is asked of those.
 *
 * Both production callers that start from a verdict spell exactly this — the
 * banner before it draws a face (`@olai/web`'s `banner.ts`), the ops layer
 * before it names a refusal's blocker (`@olai/ops`' `ops.ts`) — and neither has
 * an export that hides it, deliberately. `summary(verdict, n)` was that export
 * and it was one composition; `admits(entriesOf(verdict), files)` was the other and it
 * re-partitioned the verdict per file to reach the entries a set already had.
 * The step is the shape of the ruling, so it is written where it happens.
 */
const entriesOf = (verdict: Verdict): ReadonlyArray<BrokenFile> => blamed(verdict.findings)

/** …and a verdict's bounded face, through it. */
const faceOf = (verdict: Verdict, n: number): Summary => summaryOf(entriesOf(verdict), n)

// ── fixtures ───────────────────────────────────────────────────────────

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

/** A verdict of `many` findings, all in one file — the afternoon that produced
 *  `last-good-banner-flood` was 135 of these. */
const flood = (file: string, many: number): Verdict =>
  verdictOf(
    Array.from({ length: many }, (_, at) => ({
      file,
      line: at + 1,
      code: "bad-prop" as const,
      message: `\`agent\` holds something \`roster\` does not declare (row ${at})`,
    })),
  )

// ── which files a finding is about ─────────────────────────────────────

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
    rowOf("a.olai", "missing-doc"),
    rowOf("wing.olai", "unknown-target"),
  ])
  // `byPath` and not a string sort: the order is the WALK's, so a directory
  // sorts before the file it shares a name with (`./paths.ts`) and a banner
  // reads down the directory the way the sidebar beside it does.
  expect(implicatedIn(verdict)).toEqual(["a.olai", "wing/room.olai", "wing.olai"])
})

// ── the write gate's question ──────────────────────────────────────────

// THE WHOLE OF `broken-file-blocks-healthy-writes`, at the socket. One file
// being wrong is not an answer a write can be given: the question is per file,
// and a write to files nothing is wrong with is admitted.
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

// FIRST in the caller's own order, because a refusal is a sentence somebody
// reads and the second blocker is one fix away from being the first.
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

// A directory nothing could LIST is the one finding that is about the whole
// load rather than about a file, so no file's health can be asserted under it.
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

// ── the bounded face ───────────────────────────────────────────────────

// `last-good-banner-flood`, pinned at the socket: the banner drew the rows
// because the rows were all it had. What `summary` hands back cannot carry one
// — the bound is the SHAPE, and the surface's clamp is on top of it.
test("a summary carries counts and never a row, whatever the row count", () => {
  const face = faceOf(flood("lanes.olai", 135), 5)
  expect(face.files).toEqual([{ file: "lanes.olai", state: "invalid", count: 135 }])
  expect(face.total).toBe(135)
  expect(face.more).toBe(0)
  // Said of the VALUE rather than of the type: nothing anywhere in it is a
  // message, a line or a code, so a surface drawing it has no rows to draw.
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

// A cross-file finding is ONE finding and TWO ROWS somebody has to go and look
// at, which is what the total is a size of.
test("a cross-file finding is counted under both files, and counted twice", () => {
  const face = faceOf(verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])]), 5)
  expect(face.files.map((one) => one.count)).toEqual([1, 1])
  expect(face.total).toBe(2)
})

// The face off the SET's own entries, which is where the banner reads it from:
// nothing is re-partitioned on the way, so the two constructors are one answer.
test("the face of a set's broken files is the face of the verdict that broke them", () => {
  const verdict = verdictOf([
    rowOf("a.olai", "mirror-cycle", [["b.olai", 3]]),
    rowOf("c.olai", "duplicate-id"),
  ])
  expect(faceOf(verdict, 5)).toEqual(faceOf(verdict, 5))
})

// ── the reference arm, over generated broken sets ──────────────────────

/** A set that validates: one file per outline, ids nothing else claims, every
 *  parent in its own file, no edge that leaves the corpus. */
const healthy = (random: () => number): Record<string, string> => {
  const files: Record<string, string> = {}
  // THREE AT LEAST, so every round has a file that is not either end of the
  // two-file finding below — the survivor is what the narrowing is about, and a
  // corpus that sometimes has none would assert nothing on those rounds.
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

/** Lines that are not records — the hole a file becomes when somebody is in the
 *  middle of editing it. */
const HOLE = `{"id":"x","ord"`

/** A SET RULE broken, in one named file: an edge naming an id the corpus does
 *  not declare. */
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

/**
 * A `foreign-parent`: a record in one outline whose `parent` is declared in
 * another.
 *
 * The VALIDATOR-PRODUCED two-file finding, and the reason this arm needs one:
 * a dangling `see` names an id rather than a site, so its finding implicates
 * the file it was found in and nothing else ({@link ../rules.ts}'s
 * `reportUnknownTargets`). `foreign-parent` carries a `related` site — the
 * parent's, in the parent's file — so it is a finding the rules really made
 * that names two files, which is what `admits` has to refuse at BOTH ends
 * while admitting everything else.
 *
 * `f0n0` is `healthy`'s first record of its first file and every file it
 * writes holds at least one, so the parent named here is always declared.
 */
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

/**
 * THE PER-FILE ANSWER, over three kinds of broken set.
 *
 * The ruling as a differential rather than as a table. `parse holes only` is
 * the arm the error scope decided on 2026-08-09 — the set is ACCEPTED with the
 * hole carried in it — and the other two are what the ruling of 2026-08-29 did
 * to the old blanket: they used to be REFUSED, whole vault and all, and they
 * are now the same acceptance with a different file withheld.
 *
 * Nothing here reads a policy value; there is none left to read. It asks
 * `validate` what it decided, which is the only thing a consumer ever saw, and
 * then asks the SET the two questions a reader and a writer ask of it — whose
 * records are gone, and what a write to each file is told.
 */
test("a set degrades per file, over generated broken sets", () => {
  const random = seeded(20260825)
  for (let round = 0; round < 200; round++) {
    const base = healthy(random)
    const paths = Object.keys(base)
    const hole = paths[round % paths.length] as string
    const rest = Object.fromEntries(Object.entries(base).filter(([file]) => file !== hole))

    // The base itself must be servable, or the round says nothing about what
    // the breakage below cost.
    const clean = validate(setOf(base))
    expect([round, Result.isSuccess(clean)]).toEqual([round, true])
    if (Result.isSuccess(clean)) {
      // A HEALTHY SET COMES BACK AS ITSELF, identity and all — the withholding
      // is not a rebuild every load pays for.
      expect([round, clean.success.set.broken.length]).toEqual([round, 0])
      for (const file of paths) {
        expect([round, file, stopping(clean.success.set, [file])])
          .toEqual([round, file, null])
      }
    }

    // PARSE HOLES ONLY — accepted, and the hole rides in the set.
    const holed = setOf(rest, [], { [hole]: HOLE })
    expect([round, Result.isSuccess(validate(holed))]).toEqual([round, true])
    expect([round, holed.broken.map((one) => one.file)]).toEqual([round, [hole]])

    // A SET RULE — accepted too, now, with the one file it is about withheld.
    const broke = paths[round % paths.length] as string
    const dangling = validate(setOf(dangled(base, broke, round)))
    expect([round, Result.isSuccess(dangling)]).toEqual([round, true])
    if (Result.isSuccess(dangling)) {
      const set = dangling.success.set
      // THE BROKEN FILE, AND ONLY IT: the set holds a place for it and no
      // content, and its rows are the ones the rules found about it.
      expect([round, set.broken.map((one) => one.file)]).toEqual([round, [broke]])
      expect([round, brokenIn(set, broke)?.length ?? 0]).toEqual([round, 1])
      expect([round, documentAt(set, broke)]).toEqual([round, outlineDocument(broke, [])])
      // EVERY OTHER FILE IS LIVE — its records are in the set, its page draws a
      // tree, and a write to it is admitted. This is the whole ruling in four
      // lines: the freeze is not narrowed, it is gone.
      for (const survivor of paths.filter((file) => file !== broke)) {
        expect([round, survivor, brokenIn(set, survivor)]).toEqual([round, survivor, undefined])
        expect([round, survivor, nodesIn(Result.succeed(documentAt(set, survivor) as Document)).length > 0])
          .toEqual([round, survivor, true])
        expect([round, survivor, stopping(set, [survivor])]).toEqual([round, survivor, null])
      }
      // …and a write to the file it IS about is stopped, carrying that file's
      // own rows.
      expect([round, stopping(set, [broke])])
        .toEqual([round, verdictOf(brokenIn(set, broke) as ReadonlyArray<OutlineError>)])
      // Nothing invented and nothing lost between the rows and the face.
      const face = summaryOf(set.broken, 100)
      expect([round, face.files.map((one) => one.file)]).toEqual([round, [broke]])
      expect([round, face.total]).toEqual([round, brokenIn(set, broke)?.length ?? 0])
    }

    // A FINDING THAT REALLY NAMES TWO FILES — `foreign-parent`, whose
    // `related` site is the parent's, in the parent's file. BOTH ENDS go dark
    // and everything else stays live, which is the one shape that has no single
    // answer to "which file is broken" and is therefore the one where blaming
    // one end would put a page on screen the validator has just refused.
    const away = paths[0] as string
    const home = paths.find((file) => file !== away) as string
    const across = validate(setOf(adopted(base, home, round)))
    expect([round, Result.isSuccess(across)]).toEqual([round, true])
    if (Result.isSuccess(across)) {
      const set = across.success.set
      const found = findingsIn(set).filter((one) => one.code === "foreign-parent")
      expect([round, found.length]).toEqual([round, 1])
      // The two files come off the FINDING, so this is the rules' own
      // implication rather than this file's opinion of it.
      expect([round, implicatedBy(found[0] as OutlineError).slice().sort()])
        .toEqual([round, [away, home].slice().sort()])
      expect([round, set.broken.map((one) => one.file).slice().sort()])
        .toEqual([round, [away, home].slice().sort()])
      for (const end of [home, away]) {
        expect([round, end, stopping(set, [end]) === null]).toEqual([round, end, false])
      }
      for (const survivor of paths.filter((file) => file !== home && file !== away)) {
        expect([round, survivor, stopping(set, [survivor])]).toEqual([round, survivor, null])
      }
    }

    // MIXED — a hole AND a dangling edge, in two different files. ONE file goes
    // dark, and it is the hole: while some file's lines will not parse, "no
    // node declares `nobody-declares-this`" is a GUESS about ids that may be on
    // exactly those lines, so the rule withholds it and a withheld finding
    // breaks nothing.
    //
    // THIS IS THE 2026-08-25 COLD BOOT, in three lines. Two dangling `see`
    // edges into a file somebody was in the middle of editing served an empty
    // vault for thirty minutes: the guesses were withheld from the report and
    // then counted anyway, because the old blanket asked the RAW findings
    // whether the set loaded. What the reader gets instead is the file that is
    // really broken, and an honest dangling face where the edge points.
    const other = paths.find((file) => file !== hole) as string
    const mixed = validate(
      setOf(dangled(rest, other, round), [], { [hole]: HOLE }),
    )
    expect([round, Result.isSuccess(mixed)]).toEqual([round, true])
    if (Result.isSuccess(mixed)) {
      const set = mixed.success.set
      expect([round, set.broken.map((one) => one.file)]).toEqual([round, [hole]])
      expect([round, other, stopping(set, [other])]).toEqual([round, other, null])
      // The edge is still THERE and still dangles — the record is in the set,
      // and nothing resolves the id.
      expect([round, mixed.success.derived.byId.has("nobody-declares-this")])
        .toEqual([round, false])
      expect([round, mixed.success.derived.namedBy.has("nobody-declares-this")])
        .toEqual([round, true])
    }
  }
})
