/**
 * WHAT THE TWO SIDEBAR READINGS COST PER PUBLISHED REVISION, before and after
 * `perf-filename-conventions` — both arms in one run, on one vault, on the
 * reader's own machine.
 *
 * The pinned shelf and the inbox door's count are re-answered on every
 * revision the store publishes, which is on every keystroke anybody makes in
 * the directory (`@olai/server`'s `runtime.ts`). Each of them began by asking
 * WHICH FILE it is about — every served basename sliced, folded and compared,
 * the matches collected and sorted (`./node.ts`) — for an answer that moves
 * only when a file is added, removed or renamed. That is a claim about COST
 * and this is the number for it.
 *
 * BOTH ARMS ARE IN THE TREE, which is what `./scope.bench.ts` says a pair of
 * figures has to be to be worth quoting: the "before" is `shelfOf` /
 * `inboxHeldOf`, the plain readings, kept as the differential's reference
 * implementations (`./conventions.test.ts`) rather than transcribed here. The
 * "after" is what the server runs — the carried convention (`./conventions.ts`)
 * and the same two readings with the walk lifted out of them.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`). What the equivalence rests on is
 * `./conventions.test.ts` — the same two arms, compared for their ANSWERS at
 * every revision of a scripted and a generated sequence, in the suite. Perf
 * numbers are reported artifacts and never gates.
 *
 * ONE THING HERE DOES FAIL THE RUN, and it is not a timing: if the two arms
 * do not answer the same shelf and the same count the ratio between them means
 * nothing, so the row throws rather than printing.
 *
 * THREE ROWS, because the shape of the revision is the whole claim:
 *
 * - a KEYSTROKE — one record retitled, no path moved. The commonest revision
 *   there is, and the one this lane is about;
 * - a `git pull` of twenty files edited, no path moved. Bigger delta, same
 *   answer to the only question the carrier asks;
 * - a FILE CREATED, every revision. The honest null: the path set moves every
 *   time, so the walk runs every time and this row is what the change did NOT
 *   buy.
 *
 * Its vault is `./fixtures.testlib.ts`'s `vaultOf` with a shelf and an inbox
 * put in beside the outlines — a directory with neither is one where both
 * readings answer `undefined` off the first mismatch and half of what is being
 * timed never happens.
 */

import { Result } from "effect"

import {
  type Convention,
  conventionRecorded,
  conventionServed,
  type PathsMoved,
} from "./conventions.ts"
import { deltaOf } from "./corpora.testlib.ts"
import { alternating, decodedOf, retitled, settled, vaultOf } from "./fixtures.testlib.ts"
import { inboxHeldIn, inboxHeldOf } from "./inbox.ts"
import { inboxIn, pinsIn } from "./node.ts"
import { fileKind, OUTLINE_EXT } from "./kinds.ts"
import { assemble } from "./set.ts"
import { shelfIn, shelfOf } from "./shelf.ts"
import { type Reading, validate } from "./validate.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
/** How many revisions each row is timed over. The unit is one revision, so
 *  this is only how long a row takes to say it. */
const REVISIONS = Number(process.env["OLAI_BENCH_EDITS"] ?? 25)

type Corpus = Record<string, string>

/** The shelf the vault is given: rows addressing nodes in OTHER files, which
 *  is what makes drawing one a reading of the directory rather than of a file. */
const PINS = Array.from(
  { length: 8 },
  (_, at) => JSON.stringify({ id: `pin${at}`, ord: `a${at}`, title: `/#f${at}r` }),
).join("\n")

/** …and the inbox, deep enough that finding it is a walk rather than a hit on
 *  the first path. Every row a todo, so the count has something to count. */
const CAPTURES = Array.from(
  { length: 12 },
  (_, at) =>
    JSON.stringify({ id: `cap${at}`, ord: `a${at}`, title: `a capture ${at}`, todo: true }),
).join("\n")

const vault = (): Corpus => ({
  // SETTLED, because this leg PUBLISHES its revisions: `vaultOf` leaves a
  // handful of placements naming files the generator skipped, and a directory
  // with one finding in it is one nobody publishes
  // ({@link ./fixtures.testlib.ts}'s `settled`).
  ...Object.fromEntries(settled(vaultOf({ files: FILES, records: RECORDS }))),
  "Pins.olai": PINS,
  "notes/Inbox.olai": CAPTURES,
})

/** One revision as the store publishes one: the reading, and the two lists it
 *  says moved to get there — which is what a carrier reads. */
interface Revision {
  readonly read: Reading
  readonly moved: PathsMoved
}

/** One revision, built the way the store builds one (`@olai/ops`' `codec.ts`):
 *  assembled from the files, and the view PATCHED from the reading before it. */
const revised = (files: Corpus, before?: readonly [Corpus, Reading]): Revision => {
  const outcome = validate(
    assemble(decodedOf(files)),
    before === undefined ? undefined : { read: before[1], delta: deltaOf(before[0], files) },
  )
  if (Result.isFailure(outcome)) {
    throw new Error(
      `the bench built a set nobody could serve: ${outcome.failure.findings[0]?.message ?? "?"}`,
    )
  }
  return {
    read: outcome.success,
    moved: before === undefined
      ? { changed: Object.keys(files), removed: [] }
      : {
        changed: Object.keys(files).filter((file) => before[0][file] !== files[file]),
        removed: Object.keys(before[0]).filter((file) => !(file in files)),
      },
  }
}

/** One file's text with one record retitled — a keystroke, as
 *  `./patch.bench.ts` spells one. */
const typed = (text: string, at: number): string => retitled(text, at)

/**
 * The revisions of one shape, built OUTSIDE the timed region: what is being
 * measured is what the two readings cost a revision, not what the store cost
 * to make one.
 */
const revisionsOf = (
  shape: (files: Corpus, revision: number) => Corpus,
): ReadonlyArray<Revision> => {
  let files = vault()
  let held = revised(files)
  const revisions: Array<Revision> = []
  for (let revision = 1; revision <= REVISIONS; revision++) {
    const next = shape(files, revision)
    held = revised(next, [files, held.read])
    files = next
    revisions.push(held)
  }
  return revisions
}

/** The paths of the vault, in the order it was generated — a row that edits
 *  "one file" has to name one, and naming the same one every revision would
 *  measure a delta the patcher has already seen.
 *
 *  The OUTLINES of it, asked of the registry rather than of a suffix spelled
 *  here ({@link ./kinds.ts}): a keystroke is a record edited, and a row that
 *  picked a document would be timing a delta with no records in it. */
const edited = (files: Corpus, which: number): string => {
  const paths = Object.keys(files).filter((path) => fileKind(path) === "outline")
  return paths[which % paths.length] as string
}

const ROWS: ReadonlyArray<readonly [string, (files: Corpus, revision: number) => Corpus]> = [
  [
    "a keystroke",
    (files, revision) => {
      const path = edited(files, revision * 7)
      return { ...files, [path]: typed(files[path] as string, revision) }
    },
  ],
  [
    "a pull of 20 files",
    (files, revision) => {
      const next = { ...files }
      for (let at = 0; at < 20; at++) {
        const path = edited(files, revision * 31 + at)
        next[path] = typed(next[path] as string, revision + at)
      }
      return next
    },
  ],
  [
    "a file created",
    (files, revision) => ({
      ...files,
      [`fresh/note${revision}${OUTLINE_EXT}`]: JSON.stringify({
        id: `fresh${revision}`,
        ord: "a0",
        title: `a new file ${revision}`,
      }),
    }),
  ],
]

/** THE BEFORE ARM: the two readings as they stood, each walking the directory
 *  for the file it is about. */
const before = (revisions: ReadonlyArray<Revision>) => (): void => {
  for (const { read } of revisions) {
    shelfOf(read.derived)
    inboxHeldOf(read.set, read.derived)
  }
}

/** THE AFTER ARM: the same two readings, over conventions CARRIED from the
 *  revision before — which is exactly what the two connectors do. The carriers
 *  start empty inside the arm, so a run pays the first walk the way a server
 *  that has just booted does. */
const after = (revisions: ReadonlyArray<Revision>) => (): void => {
  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  for (const { read, moved } of revisions) {
    shelfFile = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    shelfIn(read.derived, shelfFile.file)
    inboxFile = conventionServed(inboxIn, read.set, moved, inboxFile)
    inboxHeldIn(read.derived, inboxFile.file)
  }
}

/** How many revisions of this row actually re-walked — the count the suite
 *  asserts, printed here beside the milliseconds so a row whose ratio is 1.0
 *  says WHY out loud rather than leaving it to be inferred. */
const walksOf = (revisions: ReadonlyArray<Revision>): number => {
  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  let walks = 0
  for (const { read, moved } of revisions) {
    const shelfNext = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    const inboxNext = conventionServed(inboxIn, read.set, moved, inboxFile)
    if (shelfNext !== shelfFile) walks++
    if (inboxNext !== inboxFile) walks++
    shelfFile = shelfNext
    inboxFile = inboxNext
  }
  return walks
}

console.log(
  `${FILES} files / ${RECORDS} records each, ${REVISIONS} revisions per row, ` +
    `two readings per revision`,
)
console.log(
  `${"revision".padEnd(22)}${"before".padStart(10)}${"after".padStart(10)}` +
    `${"ratio".padStart(9)}${"walks".padStart(12)}`,
)

for (const [what, shape] of ROWS) {
  const revisions = revisionsOf(shape)

  // THE TWO ARMS MUST ANSWER THE SAME THING, and the run fails where they do
  // not — this repository's rule for a bench with two arms in it, not a
  // flourish (`./scope.bench.ts` argues it). Asked once per revision, outside
  // the timing, over the same carriers the after arm uses.
  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  for (const { read, moved } of revisions) {
    shelfFile = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    inboxFile = conventionServed(inboxIn, read.set, moved, inboxFile)
    const carried = {
      shelf: shelfIn(read.derived, shelfFile.file),
      inbox: inboxHeldIn(read.derived, inboxFile.file),
    }
    const walked = {
      shelf: shelfOf(read.derived),
      inbox: inboxHeldOf(read.set, read.derived),
    }
    if (!Bun.deepEquals(carried, walked)) {
      throw new Error(
        `${what}: the two arms are not answering the same question — ` +
          `carried ${JSON.stringify(carried.inbox)} over ${shelfFile.file}, ` +
          `walked ${JSON.stringify(walked.inbox)} over ${
            pinsIn(read.derived.byFile.keys())
          }. The ratio beside it is meaningless until they agree ` +
          `(./conventions.test.ts).`,
      )
    }
  }

  const [was, is] = alternating([before(revisions), after(revisions)])
  const walks = walksOf(revisions)
  console.log(
    `${what.padEnd(22)}${`${was.toFixed(2)}ms`.padStart(10)}` +
      `${`${is.toFixed(2)}ms`.padStart(10)}` +
      `${`${(was / is).toFixed(1)}×`.padStart(9)}` +
      `${`${walks}/${revisions.length * 2}`.padStart(12)}`,
  )
}
