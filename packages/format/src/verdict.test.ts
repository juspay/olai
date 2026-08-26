/**
 * THE VERDICT'S OWN SUITE — and the differential that says it changed nothing.
 *
 * Two halves, and the second is the one that mattered while this landed. The
 * first asks the shape the questions it exists to answer (`./verdict.ts`): what
 * a finding implicates, whether a write is admissible, what a bounded face says.
 * The second holds the new shape to the OLD ANSWER over generated broken sets —
 * because a socket that quietly re-rules what a load does is a socket that
 * shipped a policy nobody approved, and which classes brick a boot is the
 * human's ruling and not this PR's (roadmap `verdict-boot-policy`, `#human`).
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

import { ErrorCode, implicatedBy, type OutlineError, stageOf } from "./errors.ts"
import { seeded, setOf } from "./fixtures.testlib.ts"
import { validate } from "./validate.ts"
import {
  admits,
  implicatedIn,
  implicating,
  isClean,
  NOTHING_WRONG,
  refusesLoad,
  summary,
  type Tier,
  tierOf,
  type Verdict,
  verdictOf,
} from "./verdict.ts"

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
  expect(admits(verdict, ["roadmap/bugs.olai"])).toEqual({ _tag: "admitted" })
  expect(admits(verdict, ["roadmap/bugs.olai", "house.olai"])._tag).toBe("admitted")
})

test("a write to an implicated file is refused, and the refusal NAMES it", () => {
  const rows = [rowOf("lanes.olai", "bad-prop"), rowOf("lanes.olai", "duplicate-id")]
  const admission = admits(verdictOf(rows), ["lanes.olai"])
  expect(admission).toEqual({ _tag: "implicated", file: "lanes.olai", rows })
})

// FIRST in the caller's own order, because a refusal is a sentence somebody
// reads and the second blocker is one fix away from being the first.
test("the blocker named is the first of the write's own files that is implicated", () => {
  const verdict = verdictOf([rowOf("b.olai", "bad-prop"), rowOf("c.olai", "bad-prop")])
  const admission = admits(verdict, ["a.olai", "c.olai", "b.olai"])
  expect(admission._tag === "implicated" && admission.file).toBe("c.olai")
})

test("a cross-file finding implicates both ends, so a write to either is refused", () => {
  const verdict = verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])])
  expect(admits(verdict, ["a.olai"])._tag).toBe("implicated")
  expect(admits(verdict, ["b.olai"])._tag).toBe("implicated")
  expect(admits(verdict, ["c.olai"])._tag).toBe("admitted")
})

// A directory nothing could LIST is the one finding that is about the whole
// load rather than about a file, so no file's health can be asserted under it.
test("a directory that could not be read implicates every write", () => {
  const verdict = verdictOf([rowOf(".", "unreadable-directory")])
  const admission = admits(verdict, ["anything.olai"])
  expect(admission._tag === "implicated" && admission.file).toBe(".")
})

test("a clean verdict admits everything, and says it is clean", () => {
  expect(isClean(NOTHING_WRONG)).toBe(true)
  expect(admits(NOTHING_WRONG, ["a.olai"])._tag).toBe("admitted")
  expect(verdictOf([])).toBe(NOTHING_WRONG)
})

// ── the bounded face ───────────────────────────────────────────────────

// `last-good-banner-flood`, pinned at the socket: the banner drew the rows
// because the rows were all it had. What `summary` hands back cannot carry one
// — the bound is the SHAPE, and the surface's clamp is on top of it.
test("a summary carries counts and never a row, whatever the row count", () => {
  const face = summary(flood("lanes.olai", 135), 5)
  expect(face.files).toEqual([{ file: "lanes.olai", state: "invalid", count: 135 }])
  expect(face.total).toBe(135)
  expect(face.more).toBe(0)
  // Said of the VALUE rather than of the type: nothing anywhere in it is a
  // message, a line or a code, so a surface drawing it has no rows to draw.
  expect(JSON.stringify(face)).not.toContain("message")
})

test("the face of a 135-row file is the face of a 5-row file, but for the count", () => {
  const many = summary(flood("lanes.olai", 135), 5)
  const few = summary(flood("lanes.olai", 5), 5)
  expect({ ...many, files: many.files.map((one) => ({ ...one, count: 0 })), total: 0 })
    .toEqual({ ...few, files: few.files.map((one) => ({ ...one, count: 0 })), total: 0 })
})

test("more implicated files than the clamp are counted, not drawn", () => {
  const verdict = verdictOf(
    ["a.olai", "b.olai", "c.olai", "d.olai"].map((file) => rowOf(file, "duplicate-id")),
  )
  const face = summary(verdict, 2)
  expect(face.files.map((one) => one.file)).toEqual(["a.olai", "b.olai"])
  expect(face.more).toBe(2)
  expect(face.total).toBe(4)
})

test("a file's state is the worst thing said about it", () => {
  const unreadable = summary(verdictOf([rowOf("a.olai", "unreadable-file")]), 5)
  expect(unreadable.files[0]?.state).toBe("unreadable")
  const unparsed = summary(
    verdictOf([rowOf("a.olai", "not-json"), rowOf("a.olai", "duplicate-id")]),
    5,
  )
  expect(unparsed.files[0]?.state).toBe("unparsed")
  const invalid = summary(verdictOf([rowOf("a.olai", "duplicate-id")]), 5)
  expect(invalid.files[0]?.state).toBe("invalid")
})

// A cross-file finding is ONE finding and TWO faces, which is the one place
// the counts deliberately do not partition the total.
test("a cross-file finding is counted under both files and once in the total", () => {
  const face = summary(verdictOf([rowOf("a.olai", "mirror-cycle", [["b.olai", 3]])]), 5)
  expect(face.files.map((one) => one.count)).toEqual([1, 1])
  expect(face.total).toBe(1)
})

// ── the shelf ──────────────────────────────────────────────────────────

/**
 * THE DIFFERENTIAL, said as one line over the closed catalogue.
 *
 * The validator used to hold two sentences and neither was a tier: "any error
 * at all refuses the set", which is every rule this file's siblings run and
 * therefore every `set` code; and the 2026-08-09 error scope, "a file whose
 * lines do not parse is a hole the rest is rendered around", which is every
 * `line` code. The table is those two sentences, one row at a time — so this is
 * the assertion that the shelf shipped UNTURNED.
 *
 * It is expected to fail the day the human rules (`verdict-boot-policy`), and
 * that is the whole of its job: the ruling has to come through a test that says
 * what changed, rather than through a value somebody edited.
 */
test("every class is at the tier the validator already gave it", () => {
  // THE WHOLE CATALOGUE, walked — the drift guard next door already spells this
  // shape ({@link ./errors.test.ts}'s "every published code has a stage"), and
  // for the same reason: a claim about "every class" made over four samples is
  // a claim three quarters of the table can break silently. Turning ANY code to
  // `carried` fails here, which is what the boot-policy child is gated on.
  const tiers = ErrorCode.literals.map((code) => [code, tierOf(code)] as const)
  expect(tiers.length).toBe(new Set(ErrorCode.literals).size)
  for (const [code, tier] of tiers) {
    expect({ code, tier }).toEqual({
      code,
      tier: stageOf(code) === "set" ? "refuses" : "carried",
    })
  }
})

// …and the same table read the other way, so a new code cannot arrive at a tier
// by inheriting a stage nobody looked at: the two halves are named in full, and
// they are exactly the catalogue.
test("the refuses/carried split is the set/line split, named in full", () => {
  const at = (tier: Tier): ReadonlyArray<string> =>
    ErrorCode.literals.filter((code) => tierOf(code) === tier)
  expect(at("carried")).toEqual([
    "not-json",
    "not-an-object",
    "bad-record",
    "bad-id",
    "several-marks",
    "bad-date",
    "bad-repeat",
    "unreadable-file",
  ])
  expect(at("refuses")).toEqual([
    "duplicate-id",
    "unknown-parent",
    "foreign-parent",
    "parent-not-a-node",
    "parent-cycle",
    "unknown-target",
    "after-cycle",
    "mirror-cycle",
    "missing-doc",
    "bad-prop",
    "unreadable-directory",
  ])
  expect(at("carried").length + at("refuses").length).toBe(ErrorCode.literals.length)
})

test("a report of parse errors alone refuses nothing; one set finding refuses", () => {
  expect(refusesLoad([rowOf("a.olai", "not-json")])).toBe(false)
  expect(refusesLoad([rowOf("a.olai", "not-json"), rowOf("b.olai", "duplicate-id")]))
    .toBe(true)
  expect(refusesLoad([])).toBe(false)
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
 * THE OLD ANSWER, over three kinds of broken set.
 *
 * `parse holes only` is the arm the error scope decided on 2026-08-09 and the
 * one a tier table could most easily have re-ruled by accident: the set is
 * ACCEPTED, with the hole carried in it. `set rules` and `mixed` are the old
 * blanket. Nothing here reads the tier table — it asks `validate` what it
 * decided, which is the only thing a consumer ever saw.
 */
test("the tier default answers what the validator answered, over generated broken sets", () => {
  const random = seeded(20260825)
  for (let round = 0; round < 200; round++) {
    const base = healthy(random)
    const paths = Object.keys(base)
    const hole = paths[round % paths.length] as string
    const rest = Object.fromEntries(Object.entries(base).filter(([file]) => file !== hole))

    // The base itself must be servable, or the round says nothing about what
    // the breakage below cost.
    expect([round, Result.isSuccess(validate(setOf(base)))]).toEqual([round, true])

    // PARSE HOLES ONLY — accepted, and the hole rides in the set.
    const holed = setOf(rest, [], { [hole]: HOLE })
    expect([round, Result.isSuccess(validate(holed))]).toEqual([round, true])
    expect([round, holed.broken.map((one) => one.file)]).toEqual([round, [hole]])

    // A SET RULE — refused, exactly as the blanket refused it.
    const broke = paths[round % paths.length] as string
    const dangling = validate(setOf(dangled(base, broke, round)))
    expect([round, Result.isFailure(dangling)]).toEqual([round, true])
    if (Result.isFailure(dangling)) {
      // THE OLD BOOLEAN: the whole-set verdict IS the new shape asked about
      // every file. That equivalence is what makes `admits` a NARROWING of the
      // old answer rather than a different answer.
      expect([round, admits(dangling.failure, paths)._tag]).toEqual([round, "implicated"])
      // …AND THE NEW ANSWER, which is the freeze dying: every file the rules
      // did NOT find anything about admits a write. Asked of a verdict the
      // validator produced over a generated corpus rather than of a row this
      // file wrote by hand — the whole-set arm above would go on passing if
      // `admits` had quietly stayed a boolean about the set.
      for (const survivor of paths.filter((file) => file !== broke)) {
        expect([round, survivor, admits(dangling.failure, [survivor])._tag])
          .toEqual([round, survivor, "admitted"])
      }
      // …and the file it IS about is refused, naming itself.
      expect([round, admits(dangling.failure, [broke])])
        .toEqual([round, {
          _tag: "implicated",
          file: broke,
          rows: implicating(dangling.failure, broke),
        }])
      // Nothing invented and nothing lost between the rows and the face.
      const face = summary(dangling.failure, 100)
      expect([round, face.total]).toEqual([round, dangling.failure.findings.length])
      for (const one of face.files) {
        expect([round, one.count])
          .toEqual([round, implicating(dangling.failure, one.file).length])
      }
    }

    // A FINDING THAT REALLY NAMES TWO FILES — `foreign-parent`, whose
    // `related` site is the parent's, in the parent's file. Both ends are
    // implicated and everything else is admitted, which is the same narrowing
    // asked of the shape that has no single answer to "which file is broken".
    const away = paths[0] as string
    const home = paths.find((file) => file !== away) as string
    const across = validate(setOf(adopted(base, home, round)))
    expect([round, Result.isFailure(across)]).toEqual([round, true])
    if (Result.isFailure(across)) {
      const found = across.failure.findings.filter((one) => one.code === "foreign-parent")
      expect([round, found.length]).toEqual([round, 1])
      // The two files come off the FINDING, so this is the rules' own
      // implication rather than this file's opinion of it.
      expect([round, implicatedBy(found[0] as OutlineError).slice().sort()])
        .toEqual([round, [away, home].slice().sort()])
      for (const end of [home, away]) {
        expect([round, end, admits(across.failure, [end])._tag])
          .toEqual([round, end, "implicated"])
      }
      for (const survivor of paths.filter((file) => file !== home && file !== away)) {
        expect([round, survivor, admits(across.failure, [survivor])._tag])
          .toEqual([round, survivor, "admitted"])
      }
    }

    // MIXED — a hole AND a set rule. Refused, and a hole alone would not have
    // been: the two arms above are what makes this one say something.
    const mixed = validate(
      setOf(dangled(rest, paths.find((file) => file !== hole) as string, round), [], {
        [hole]: HOLE,
      }),
    )
    expect([round, Result.isFailure(mixed)]).toEqual([round, true])
  }
})
