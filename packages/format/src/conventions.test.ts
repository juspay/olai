/**
 * A BY-NAME ANSWER CARRIED ACROSS REVISIONS, held to the walk it replaces.
 *
 * `./conventions.ts` makes one claim with two halves, so this file has two
 * kinds of assertion in it:
 *
 * - THE ANSWER IS THE SAME ANSWER. At every revision of a scripted sequence
 *   the carried convention equals the one the plain walk gives — the REFERENCE
 *   ARM being `./node.ts`'s own `pinsIn` / `inboxIn` over the list each reader
 *   used to build for itself — and so do the READINGS above it, `shelfOf` and
 *   `inboxHeldOf` held against their lifted twins.
 * - AND IT REALLY WAS CARRIED. The walk runs once per PATH-SET CHANGE and not
 *   once per revision, counted over the same sequence against an oracle
 *   computed from the corpus rather than from the thing under test.
 *
 * The count is read off IDENTITY, which is the carrier's own contract rather
 * than an instrument bolted onto it: a convention that is carried is handed
 * back as the same object, so `next !== held` is exactly "the walk ran".
 * Nothing in `./conventions.ts` counts anything — which is what
 * `perf-git-per-write`'s counting wrapper was for, measuring what is spent
 * from outside whatever spends it.
 *
 * THE REVISIONS ARE BUILT THE WAY THE STORE BUILDS THEM (`@olai/ops`'
 * `codec.ts`): the set is `assemble`d from the files, the view is PATCHED from
 * the one before it, and the carrier is handed the same two lists the store
 * publishes beside a snapshot. A harness that re-derived the whole corpus per
 * step, or that compared path sets instead of reading a delta, would exercise
 * the same comparisons and would not be the shape the claim is about.
 *
 * AND THE BROKEN CARRIERS, because a differential that cannot fail is not
 * evidence: one that never re-walks, one that reads the delta and skips the
 * COUNT (which is what catches a departure the store did not name), one that
 * checks the count and skips the DELTA (which a rename walks straight
 * through), and one that re-walks every revision — the first three caught by
 * the answers, the last by the count.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import {
  type Convention,
  conventionRecorded,
  conventionServed,
  type PathSet,
  type PathsMoved,
} from "./conventions.ts"
import type { Derived } from "./derive.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { bodyKind } from "./kinds.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import { nodesOf, outlineOf, seeded } from "./fixtures.testlib.ts"
import { inboxHeldIn, inboxHeldOf } from "./inbox.ts"
import { inboxIn, pinsIn } from "./node.ts"
import type { SetDelta } from "./patch.ts"
import { assemble, documentAt, type OutlineSet, outlinePaths } from "./set.ts"
import { shelfIn, shelfOf } from "./shelf.ts"
import { type Reading, validate } from "./validate.ts"

// ── the corpus, and the revisions it is read in ────────────────────────

/** A corpus as the fixtures spell one: path → the file's JSONL. */
type Corpus = Record<string, string>

/** One capture, so an inbox file has something in it to count. A todo, which
 *  is what `inboxHeldOf` counts, so a step that moves WHICH file the inbox is
 *  moves the NUMBER as well — a carried answer gone stale shows up in the
 *  reading and not only in the path. */
const capture = (which: string): string =>
  `{"id":"c-${which}","ord":"a0","title":"the ${which} capture","todo":true}`

/** One pin, addressed at a node another file holds — so the shelf's rows are a
 *  reading of the whole directory and not of one file. */
const pin = (which: string): string => `{"id":"p-${which}","ord":"a0","title":"/#herbs"}`

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"kitchen","ord":"a1","title":"the kitchen"}`,
].join("\n")

const START: Corpus = {
  "garden.olai": GARDEN,
  "notes/Inbox.olai": [capture("first"), capture("second")].join("\n"),
  "notes/Pins.olai": pin("deep"),
}

/**
 * The corpus decoded the way the store's codec decodes one: a file whose
 * content is a BODY decodes to its bytes and everything else is an outline to
 * parse (`@olai/ops`' `codec.ts`, the same branch in the same words).
 *
 * WHICH IS WHICH IS THE REGISTRY'S, never a suffix spelled here
 * ({@link ./kinds.ts}'s `bodyKind`): a harness that decided by name would be
 * a second answer to what a served file IS, which is the one thing that file
 * exists to prevent.
 *
 * Spelled at all rather than taken from `./fixtures.testlib.ts`'s `decodedOf`,
 * which parses every file as an outline: the whole reason a document is in
 * this harness is that the set SERVES it and the grouping never sees it, which
 * is the difference the two carriers are built on.
 */
const decoded = (
  files: Corpus,
): Map<string, Result.Result<Document, Verdict>> =>
  new Map(
    Object.entries(files).map(([path, text]) => [
      path,
      Result.succeed<Document>(
        bodyKind(path) !== null ? bodiedDocument(path, text) : outlineOf(text, path),
      ),
    ]),
  )

/** …and what moved between two of them, in the patcher's own vocabulary. A
 *  bodied file contributes no records, which is what the codec's `nodesIn`
 *  answers for one. */
const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) =>
      [file, { nodes: bodyKind(file) === null ? nodesOf(text, file) : [] }] as const
    ),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

/** One revision as the store publishes one: the reading, and the two lists it
 *  says moved to get there. */
interface Revision {
  readonly read: Reading
  readonly moved: PathsMoved
}

/** What the store would say moved between two corpora — the same diff
 *  `./corpora.testlib.ts`'s `deltaOf` takes, said as paths. */
const movedOf = (before: Corpus, after: Corpus): PathsMoved => ({
  changed: Object.keys(after).filter((file) => before[file] !== after[file]),
  removed: Object.keys(before).filter((file) => !(file in after)),
})

/**
 * The next revision, built the way the store builds one — `assemble` over the
 * files, and the view PATCHED from the reading this one follows.
 *
 * It throws on a refusal rather than answering one: every corpus here is a
 * directory that validates, and a script step that quietly stopped publishing
 * would be a sequence with fewer revisions in it than it says it has.
 */
const revised = (files: Corpus, before?: readonly [Corpus, Reading]): Revision => {
  const outcome = validate(
    assemble(decoded(files)),
    before === undefined
      ? undefined
      : { read: before[1], delta: deltaOf(before[0], files) },
  )
  if (Result.isFailure(outcome)) {
    throw new Error(
      `the script published a set nobody could serve: ${
        outcome.failure.findings.map((error) => `${error.file}:${error.line} ${error.message}`)
          .join("; ")
      }`,
    )
  }
  return {
    read: outcome.success,
    moved: before === undefined
      ? { changed: Object.keys(files), removed: [] }
      : movedOf(before[0], files),
  }
}

const without = (files: Corpus, file: string): Corpus => {
  const rest = { ...files }
  delete rest[file]
  return rest
}

// ── the arms ───────────────────────────────────────────────────────────

/** THE REFERENCE ARM, one convention each: the walk the reader ran for itself
 *  before there was anything to carry, kept verbatim. */
const walkedShelf = (derived: Derived): string | undefined => pinsIn(derived.byFile.keys())
const walkedInbox = (set: OutlineSet): string | undefined => inboxIn(outlinePaths(set))

/** A carrier, as this harness drives one — the real ones and the broken ones
 *  wear the same two shapes, so nothing here knows which it is holding. */
interface Carrier {
  readonly shelf: (
    derived: Derived,
    moved: PathsMoved,
    held: Convention | undefined,
  ) => Convention
  readonly inbox: (
    set: OutlineSet,
    moved: PathsMoved,
    held: Convention | undefined,
  ) => Convention
}

const CARRIED: Carrier = {
  shelf: (derived, moved, held) => conventionRecorded(pinsIn, derived, moved, held),
  inbox: (set, moved, held) => conventionServed(inboxIn, set, moved, held),
}

// ── the script ─────────────────────────────────────────────────────────

/** One step: what it does to the corpus, and what it is here to cover. */
interface Step {
  readonly what: string
  readonly to: (files: Corpus) => Corpus
}

/**
 * THE SEQUENCE THE GATE IS SPELLED OVER, and every clause of it is a case the
 * lane's brief names: an edit that moves no path (the HOT one — the walk must
 * not run), an add, a remove, a rename, and a rename that changes nothing but
 * the CASE of a name.
 *
 * Three more are here because they are the shapes where the two carriers must
 * DISAGREE with each other and each still be right: a file emptied and filled
 * again (which leaves the set serving it while taking it out of `byFile`, so
 * the shelf's list moves and the inbox's does not), and a count that moves
 * with no path moving at all.
 */
const SCRIPT: ReadonlyArray<Step> = [
  {
    what: "a title edited — no path moves (the hot case)",
    to: (files) => ({ ...files, "garden.olai": GARDEN.replace("herb bed", "herb patch") }),
  },
  {
    what: "a record added to the inbox — no path moves",
    to: (files) => ({
      ...files,
      "notes/Inbox.olai": `${files["notes/Inbox.olai"]}\n${capture("third")}`,
    }),
  },
  {
    what: "an ordinary file added",
    to: (files) => ({ ...files, "shed.olai": `{"id":"shed","ord":"a0","title":"the shed"}` }),
  },
  {
    what: "a SHALLOWER inbox added — the answer moves with the path set",
    to: (files) => ({ ...files, "Inbox.olai": capture("root") }),
  },
  {
    what: "a shallower shelf added — the same, one convention over",
    to: (files) => ({ ...files, "Pins.olai": pin("root") }),
  },
  {
    what: "an unrelated file removed",
    to: (files) => without(files, "shed.olai"),
  },
  {
    what: "the shallow inbox RENAMED to a name no convention reads",
    to: (files) => ({ ...without(files, "Inbox.olai"), "kept.olai": capture("root") }),
  },
  {
    what: "a CASE-ONLY rename of the shelf — Pins.olai → pins.olai",
    to: (files) => ({ ...without(files, "Pins.olai"), "pins.olai": pin("root") }),
  },
  {
    what: "another title edited — no path moves",
    to: (files) => ({ ...files, "garden.olai": GARDEN.replace("kitchen", "scullery") }),
  },
  {
    what: "the shelf file EMPTIED — served still, holding nothing: only byFile moves",
    to: (files) => ({ ...files, "pins.olai": "" }),
  },
  {
    what: "…and filled again",
    to: (files) => ({ ...files, "pins.olai": pin("root") }),
  },
  {
    what: "the shallow shelf removed — the answer falls back to the deep one",
    to: (files) => without(files, "pins.olai"),
  },
  {
    what: "the last shelf removed — there is none, and undefined is the answer",
    to: (files) => without(files, "notes/Pins.olai"),
  },
  {
    what: "a shelf minted where olai mints one",
    to: (files) => ({ ...files, "_olai/Pins.olai": pin("minted") }),
  },
  {
    what: "every capture marked done — the count moves, the path set does not",
    to: (files) => ({
      ...files,
      "notes/Inbox.olai": (files["notes/Inbox.olai"] as string)
        .replaceAll(`"todo":true`, `"done":true`),
    }),
  },
]

// ── the run ────────────────────────────────────────────────────────────

/** What one revision of a run says about itself. */
interface Round {
  readonly what: string
  /** The walk ran — read off identity, which is the carrier's contract. */
  readonly shelfWalked: boolean
  readonly inboxWalked: boolean
  /** THE ORACLE, computed from the revision rather than from the carrier: the
   *  path set this reader is found in is not the one the last revision had. */
  readonly shelfMoved: boolean
  readonly inboxMoved: boolean
  readonly wrong: ReadonlyArray<string>
}

const sameMembers = (
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
): boolean => before.size === after.size && [...after].every((path) => before.has(path))

/** The two path sets a revision is judged by, read off the revision itself. */
const servedIn = (read: Reading): ReadonlySet<string> =>
  new Set(read.set.documents.map((document) => document.path))
const recordedIn = (read: Reading): ReadonlySet<string> => new Set(read.derived.byFile.keys())

/**
 * The whole script through one carrier, with the answers compared and the
 * walks counted at every revision.
 *
 * The oracle's two path sets are read as MEMBERSHIP: a revision that serves
 * the same files answers the same convention however its grouping happens to
 * iterate them, which is why the carrier never looks at an order.
 */
const run = (carrier: Carrier): ReadonlyArray<Round> => {
  let files = START
  let revision = revised(files)
  let shelfHeld = carrier.shelf(revision.read.derived, revision.moved, undefined)
  let inboxHeld = carrier.inbox(revision.read.set, revision.moved, undefined)
  let shelfPaths = recordedIn(revision.read)
  let inboxPaths = servedIn(revision.read)
  const rounds: Array<Round> = []

  for (const step of SCRIPT) {
    const next = step.to(files)
    const after = revised(next, [files, revision.read])
    files = next
    revision = after
    const { read, moved } = after

    const shelfNext = carrier.shelf(read.derived, moved, shelfHeld)
    const inboxNext = carrier.inbox(read.set, moved, inboxHeld)
    const shelfWalked = shelfNext !== shelfHeld
    const inboxWalked = inboxNext !== inboxHeld
    shelfHeld = shelfNext
    inboxHeld = inboxNext

    const shelfNow = recordedIn(read)
    const inboxNow = servedIn(read)
    const shelfMoved = !sameMembers(shelfPaths, shelfNow)
    const inboxMoved = !sameMembers(inboxPaths, inboxNow)
    shelfPaths = shelfNow
    inboxPaths = inboxNow

    // THE ANSWERS, at the convention and at the reading above it. Both,
    // because a convention that is right and a reading that was handed it are
    // two claims: `shelfIn` is what the server actually calls.
    const wrong: Array<string> = []
    const walkedShelfFile = walkedShelf(read.derived)
    const walkedInboxFile = walkedInbox(read.set)
    if (shelfHeld.file !== walkedShelfFile) {
      wrong.push(`shelf file: carried ${shelfHeld.file} against walked ${walkedShelfFile}`)
    }
    if (inboxHeld.file !== walkedInboxFile) {
      wrong.push(`inbox file: carried ${inboxHeld.file} against walked ${walkedInboxFile}`)
    }
    if (!Bun.deepEquals(shelfIn(read.derived, shelfHeld.file), shelfOf(read.derived))) {
      wrong.push(`the shelf itself`)
    }
    if (
      !Bun.deepEquals(
        inboxHeldIn(read.derived, inboxHeld.file),
        inboxHeldOf(read.set, read.derived),
      )
    ) {
      wrong.push(`the inbox count`)
    }

    rounds.push({ what: step.what, shelfWalked, inboxWalked, shelfMoved, inboxMoved, wrong })
  }
  return rounds
}

// ── the differential ───────────────────────────────────────────────────

const CARRIED_ROUNDS = run(CARRIED)

test("the carried answer is the walked answer, at every step of the script", () => {
  expect(CARRIED_ROUNDS.filter((round) => round.wrong.length > 0)).toEqual([])
})

test("the walk runs once per path-set change, and never per revision", () => {
  // Per ROUND rather than as two totals: two counts that happen to add up
  // while firing on different revisions is precisely the mistake a total
  // cannot see.
  expect(
    CARRIED_ROUNDS.map((round) => [round.what, round.shelfWalked, round.inboxWalked]),
  ).toEqual(
    CARRIED_ROUNDS.map((round) => [round.what, round.shelfMoved, round.inboxMoved]),
  )
})

test("the hot case is covered, and the two lists really do disagree", () => {
  // The count assertion above is vacuous over a script where every step moves
  // a path, so the coverage is floored rather than hoped for.
  const quiet = CARRIED_ROUNDS.filter((round) => !round.shelfMoved && !round.inboxMoved)
  expect(quiet.length).toBeGreaterThanOrEqual(4)
  // …and a file emptied is served still while holding no records, which is why
  // there are two carriers and not one.
  expect(CARRIED_ROUNDS.some((round) => round.shelfMoved !== round.inboxMoved)).toBe(true)
  // …and the script really does reach the convention answers it names.
  expect(CARRIED_ROUNDS.filter((round) => round.shelfMoved || round.inboxMoved).length)
    .toBeGreaterThanOrEqual(8)
})

// ── the departure the store did not name ───────────────────────────────

test("a departure the delta never names is caught by the count", () => {
  // `removed` is the weaker of the store's two lists: a `resync` forgets the
  // stamp table the listing diff is taken against, so a file that went away can
  // be in neither list (`@olai/server`'s `published.ts` says so and mints the
  // remove itself). The carrier must not take an empty delta as "nothing
  // moved", and this is the case that says it does not.
  const files: Corpus = { ...START, "Pins.olai": pin("root"), "Inbox.olai": capture("root") }
  const first = revised(files)
  const shelfHeld = conventionRecorded(pinsIn, first.read.derived, first.moved, undefined)
  const inboxHeld = conventionServed(inboxIn, first.read.set, first.moved, undefined)
  expect(shelfHeld.file).toBe("Pins.olai")
  expect(inboxHeld.file).toBe("Inbox.olai")

  const after = revised(without(without(files, "Pins.olai"), "Inbox.olai"))
  const SILENT: PathsMoved = { changed: [], removed: [] }
  const shelfNext = conventionRecorded(pinsIn, after.read.derived, SILENT, shelfHeld)
  const inboxNext = conventionServed(inboxIn, after.read.set, SILENT, inboxHeld)
  expect(shelfNext).not.toBe(shelfHeld)
  expect(inboxNext).not.toBe(inboxHeld)
  expect(shelfNext.file).toBe("notes/Pins.olai")
  expect(inboxNext.file).toBe("notes/Inbox.olai")
})

// ── the mutation proof ─────────────────────────────────────────────────

/** A carrier that walks once and then never again — the whole claim, denied. */
const NEVER: Carrier = {
  shelf: (derived, moved, held) =>
    held ?? conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved, held) => held ?? conventionServed(inboxIn, set, moved, undefined),
}

/** A carrier that reads the delta and skips the COUNT — right about everything
 *  the store names, and blind to the departure it does not. */
const DELTA_ONLY: Carrier = {
  shelf: (derived, moved, held) => {
    if (held !== undefined && !namedMoved(held.paths, moved, (path) => derived.byFile.has(path))) {
      return held
    }
    return conventionRecorded(pinsIn, derived, moved, undefined)
  },
  inbox: (set, moved, held) => {
    if (
      held !== undefined &&
      !namedMoved(held.paths, moved, (path) => documentAt(set, path) !== undefined)
    ) return held
    return conventionServed(inboxIn, set, moved, undefined)
  },
}

const namedMoved = (
  held: PathSet,
  moved: PathsMoved,
  serves: (path: string) => boolean,
): boolean => {
  for (const path of moved.removed) if (held.has(path)) return true
  for (const path of moved.changed) if (serves(path) !== held.has(path)) return true
  return false
}

/** A carrier that checks the COUNT and skips the delta — which a RENAME walks
 *  straight through, because a rename keeps the number of files and moves
 *  which one a convention means. */
const COUNT_ONLY: Carrier = {
  shelf: (derived, moved, held) =>
    held !== undefined && held.paths.size === derived.byFile.size
      ? held
      : conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved, held) =>
    held !== undefined && held.paths.size === set.documents.length
      ? held
      : conventionServed(inboxIn, set, moved, undefined),
}

/** A carrier that carries nothing — right at every step, and paying for it. */
const ALWAYS: Carrier = {
  shelf: (derived, moved) => conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved) => conventionServed(inboxIn, set, moved, undefined),
}

test("a carrier that never re-walks is caught by the answers", () => {
  expect(run(NEVER).filter((round) => round.wrong.length > 0).length).toBeGreaterThan(0)
})

test("a carrier that skips the count is caught by the unnamed departure", () => {
  // Not by the script — every step of it names what it moved — but by the case
  // above, run through the broken arm. Which is the point of having both: the
  // count is not there for the sequences a generator writes.
  const files: Corpus = { ...START, "Pins.olai": pin("root") }
  const first = revised(files)
  const held = DELTA_ONLY.shelf(first.read.derived, first.moved, undefined)
  const after = revised(without(files, "Pins.olai"))
  const next = DELTA_ONLY.shelf(after.read.derived, { changed: [], removed: [] }, held)
  expect(next).toBe(held)
  expect(next.file).not.toBe(walkedShelf(after.read.derived))
})

test("a carrier that skips the delta is caught by a rename", () => {
  const wrong = run(COUNT_ONLY).filter((round) => round.wrong.length > 0)
  expect(wrong.length).toBeGreaterThan(0)
  expect(wrong.some((round) => round.what.includes("RENAMED"))).toBe(true)
})

test("a carrier that re-walks every revision answers correctly and fails the count", () => {
  const rounds = run(ALWAYS)
  expect(rounds.filter((round) => round.wrong.length > 0)).toEqual([])
  expect(rounds.every((round) => round.shelfWalked && round.inboxWalked)).toBe(true)
  expect(rounds.some((round) => !round.shelfMoved && !round.inboxMoved)).toBe(true)
})

// ── the same claim over generated sequences ────────────────────────────

/**
 * The path pool the generated round draws from — every shape the convention
 * walk has an opinion about, so a sequence really does exercise the rule and
 * not just the check in front of it.
 *
 * `Pins.olai` and `pins.olai` are both here on purpose: they are two paths of
 * one depth a directory can serve at once, which is the TIE the walk breaks on
 * path order (`P` sorts before `p`), and a carrier that got the tie-break
 * wrong would have to be caught by the reference arm.
 */
const POOL = [
  "a.olai",
  "b.olai",
  "wing/a.olai",
  "wing.olai",
  "notes.md",
  "Pins.olai",
  "pins.olai",
  "wing/Pins.olai",
  "_olai/Pins.olai",
  "Inbox.olai",
  "wing/inbox.olai",
  "deep/down/Inbox.olai",
  "_olai/Inbox.olai",
] as const

/** One file's records — its own id space, so a path may come and go without
 *  ever colliding with another's claim. A file whose content is a BODY holds
 *  prose instead ({@link ./kinds.ts}'s `bodyKind`, the decode's own question):
 *  the set serves it and the grouping never sees it. */
const holding = (at: number, revision: number): string =>
  bodyKind(POOL[at] as string) !== null
    ? `a note, revised ${revision}`
    : `{"id":"g${at}","ord":"a0","title":"file ${at} at ${revision}","todo":true}`

/**
 * A sequence of corpora: add a file, remove one, edit one without moving a
 * path, or empty one.
 *
 * EMPTY IS A CASE OF ITS OWN and is a fifth of the rolls, because it is the
 * one edit that moves one of the two path sets and not the other — the file
 * goes on being served and stops holding records — and a generator without it
 * would never put the two carriers in disagreement.
 */
const sequenceOf = (seed: number, steps: number): ReadonlyArray<Corpus> => {
  const random = seeded(seed)
  const corpora: Array<Corpus> = []
  let files: Corpus = { "a.olai": holding(0, 0) }
  for (let revision = 1; revision <= steps; revision++) {
    const at = Math.floor(random() * POOL.length)
    const path = POOL[at] as string
    const roll = random()
    const next = { ...files }
    if (!(path in next)) next[path] = holding(at, revision)
    else if (roll < 0.3) delete next[path]
    else if (roll < 0.5) next[path] = ""
    else next[path] = holding(at, revision)
    // A directory with nothing in it is a set the store cannot publish
    // (nothing to validate is not the case under test), so a step that would
    // empty it is spent as a no-op revision instead — which is itself the hot
    // case and is counted like any other.
    files = Object.keys(next).length === 0 ? files : next
    corpora.push(files)
  }
  return corpora
}

test("over generated sequences: same answers, and the walks are the path-set changes", () => {
  let revisions = 0
  let walked = 0
  let quiet = 0
  let disagreed = 0
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let files: Corpus = { "a.olai": holding(0, 0) }
    let revision = revised(files)
    let shelfHeld = conventionRecorded(pinsIn, revision.read.derived, revision.moved, undefined)
    let inboxHeld = conventionServed(inboxIn, revision.read.set, revision.moved, undefined)
    let shelfPaths = recordedIn(revision.read)
    let inboxPaths = servedIn(revision.read)

    for (const next of sequenceOf(seed, 60)) {
      const after = revised(next, [files, revision.read])
      files = next
      revision = after
      const { read, moved } = after
      revisions++

      const shelfNext = conventionRecorded(pinsIn, read.derived, moved, shelfHeld)
      const inboxNext = conventionServed(inboxIn, read.set, moved, inboxHeld)
      const shelfWalked = shelfNext !== shelfHeld
      const inboxWalked = inboxNext !== inboxHeld
      shelfHeld = shelfNext
      inboxHeld = inboxNext

      const shelfNow = recordedIn(read)
      const inboxNow = servedIn(read)
      const shelfMoved = !sameMembers(shelfPaths, shelfNow)
      const inboxMoved = !sameMembers(inboxPaths, inboxNow)
      shelfPaths = shelfNow
      inboxPaths = inboxNow

      expect([shelfWalked, inboxWalked]).toEqual([shelfMoved, inboxMoved])
      expect(shelfHeld.file).toBe(walkedShelf(read.derived))
      expect(inboxHeld.file).toBe(walkedInbox(read.set))
      expect(shelfIn(read.derived, shelfHeld.file)).toEqual(shelfOf(read.derived))
      expect(inboxHeldIn(read.derived, inboxHeld.file))
        .toEqual(inboxHeldOf(read.set, read.derived))

      walked += (shelfWalked ? 1 : 0) + (inboxWalked ? 1 : 0)
      if (!shelfMoved && !inboxMoved) quiet++
      if (shelfMoved !== inboxMoved) disagreed++
    }
  }
  // COUNTED AND FLOORED, so a generator that quietly stopped producing one of
  // the shapes is a failure rather than a run that says nothing. The headline
  // is the middle one: most revisions of a real directory move no path at all,
  // and those are the ones that used to pay for the walk.
  expect(revisions).toBe(480)
  expect(quiet).toBeGreaterThan(revisions / 4)
  expect(disagreed).toBeGreaterThan(20)
  // What the old shape spent is two walks per revision, one per reader. The
  // generator moves a path far oftener than a directory somebody is typing
  // into does, which is why the margin here is modest and the bench is where
  // the real ratio is read.
  expect(walked).toBeLessThan(revisions * 2)
})
