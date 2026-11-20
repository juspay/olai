import { TEST_CLAIMS } from "@olai/format/testlib"
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

type Corpus = Record<string, string>

const capture = (which: string): string =>
  `{"id":"c-${which}","ord":"a0","title":"the ${which} capture","todo":true}`

const pin = (which: string): string => `{"id":"p-${which}","ord":"a0","title":"/#herbs"}`

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"kitchen","ord":"a1","title":"the kitchen"}`,
].join("\n")

const START: Corpus = {
  "garden.olai": GARDEN,
  "_olai/Inbox.olai": [capture("first"), capture("second")].join("\n"),
  "_olai/Pins.olai": pin("deep"),
}

const decoded = (
  files: Corpus,
): Map<string, Result.Result<Document, Verdict>> =>
  new Map(
    Object.entries(files).map(([path, text]) => [
      path,
      Result.succeed<Document>(
        bodyKind(TEST_CLAIMS, path) !== null ? bodiedDocument(TEST_CLAIMS, path, text) : outlineOf(text, path),
      ),
    ]),
  )

const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) =>
      [file, { nodes: bodyKind(TEST_CLAIMS, file) === null ? nodesOf(text, file) : [] }] as const
    ),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

interface Revision {
  readonly read: Reading
  readonly moved: PathsMoved
}

const movedOf = (before: Corpus, after: Corpus): PathsMoved => ({
  changed: Object.keys(after).filter((file) => before[file] !== after[file]),
  removed: Object.keys(before).filter((file) => !(file in after)),
})

const revised = (files: Corpus, before?: readonly [Corpus, Reading]): Revision => {
  const outcome = validate(TEST_CLAIMS,
    assemble(TEST_CLAIMS, decoded(files)),
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

const walkedShelf = (derived: Derived): string | undefined => pinsIn(TEST_CLAIMS, derived.byFile.keys())
const walkedInbox = (set: OutlineSet): string | undefined => inboxIn(TEST_CLAIMS, outlinePaths(set))

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
  inbox: (set, moved, held) => conventionServed(TEST_CLAIMS, inboxIn, set, moved, held),
}

interface Step {
  readonly what: string
  readonly to: (files: Corpus) => Corpus
}

const SCRIPT: ReadonlyArray<Step> = [
  {
    what: "a title edited — no path moves (the hot case)",
    to: (files) => ({ ...files, "garden.olai": GARDEN.replace("herb bed", "herb patch") }),
  },
  {
    what: "a record added to the inbox — no path moves",
    to: (files) => ({
      ...files,
      "_olai/Inbox.olai": `${files["_olai/Inbox.olai"]}\n${capture("third")}`,
    }),
  },
  {
    what: "an ordinary file added",
    to: (files) => ({ ...files, "shed.olai": `{"id":"shed","ord":"a0","title":"the shed"}` }),
  },
  {
    what: "a SHALLOWER inbox added — the answer moves with the path set",
    to: (files) => ({ ...files, "_olai/inbox.olai": capture("root") }),
  },
  {
    what: "a shallower shelf added — the same, one convention over",
    to: (files) => ({ ...files, "_olai/pins.olai": pin("root") }),
  },
  {
    what: "an unrelated file removed",
    to: (files) => without(files, "shed.olai"),
  },
  {
    what: "the shallow inbox RENAMED to a name no convention reads",
    to: (files) => ({ ...without(files, "_olai/inbox.olai"), "kept.olai": capture("root") }),
  },
  {
    what: "a CASE-ONLY rename of the shelf — Pins.olai → pins.olai",
    to: (files) => ({ ...without(files, "_olai/pins.olai"), "_olai/PINS.olai": pin("root") }),
  },
  {
    what: "another title edited — no path moves",
    to: (files) => ({ ...files, "garden.olai": GARDEN.replace("kitchen", "scullery") }),
  },
  {
    what: "the shelf file EMPTIED — served still, holding nothing: only byFile moves",
    to: (files) => ({ ...files, "_olai/PINS.olai": "" }),
  },
  {
    what: "…and filled again",
    to: (files) => ({ ...files, "_olai/PINS.olai": pin("root") }),
  },
  {
    what: "the shallow shelf removed — the answer falls back to the deep one",
    to: (files) => without(files, "_olai/PINS.olai"),
  },
  {
    what: "the last shelf removed — there is none, and undefined is the answer",
    to: (files) => without(files, "_olai/Pins.olai"),
  },
  {
    what: "a shelf minted where olai mints one",
    to: (files) => ({ ...files, "_olai/PiNs.olai": pin("minted") }),
  },
  {
    what: "every capture marked done — the count moves, the path set does not",
    to: (files) => ({
      ...files,
      "_olai/Inbox.olai": (files["_olai/Inbox.olai"] as string)
        .replaceAll(`"todo":true`, `"done":true`),
    }),
  },
]

interface Round {
  readonly what: string
  readonly shelfWalked: boolean
  readonly inboxWalked: boolean
  readonly shelfMoved: boolean
  readonly inboxMoved: boolean
  readonly wrong: ReadonlyArray<string>
}

const sameMembers = (
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
): boolean => before.size === after.size && [...after].every((path) => before.has(path))

const servedIn = (read: Reading): ReadonlySet<string> =>
  new Set(read.set.documents.map((document) => document.path))
const recordedIn = (read: Reading): ReadonlySet<string> => new Set(read.derived.byFile.keys())

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

const CARRIED_ROUNDS = run(CARRIED)

test("the carried answer is the walked answer, at every step of the script", () => {
  expect(CARRIED_ROUNDS.filter((round) => round.wrong.length > 0)).toEqual([])
})

test("the walk runs once per path-set change, and never per revision", () => {
  expect(
    CARRIED_ROUNDS.map((round) => [round.what, round.shelfWalked, round.inboxWalked]),
  ).toEqual(
    CARRIED_ROUNDS.map((round) => [round.what, round.shelfMoved, round.inboxMoved]),
  )
})

test("the hot case is covered, and the two lists really do disagree", () => {
  const quiet = CARRIED_ROUNDS.filter((round) => !round.shelfMoved && !round.inboxMoved)
  expect(quiet.length).toBeGreaterThanOrEqual(4)
  expect(CARRIED_ROUNDS.some((round) => round.shelfMoved !== round.inboxMoved)).toBe(true)
  expect(CARRIED_ROUNDS.filter((round) => round.shelfMoved || round.inboxMoved).length)
    .toBeGreaterThanOrEqual(8)
})

test("a departure the delta never names is caught by the count", () => {
  const files: Corpus = { ...START, "_olai/pins.olai": pin("root"), "_olai/inbox.olai": capture("root") }
  const first = revised(files)
  const shelfHeld = conventionRecorded(pinsIn, first.read.derived, first.moved, undefined)
  const inboxHeld = conventionServed(TEST_CLAIMS, inboxIn, first.read.set, first.moved, undefined)
  expect(shelfHeld.file).toBeUndefined()
  expect(inboxHeld.file).toBeUndefined()

  const after = revised(without(without(files, "_olai/pins.olai"), "_olai/inbox.olai"))
  const SILENT: PathsMoved = { changed: [], removed: [] }
  const shelfNext = conventionRecorded(pinsIn, after.read.derived, SILENT, shelfHeld)
  const inboxNext = conventionServed(TEST_CLAIMS, inboxIn, after.read.set, SILENT, inboxHeld)
  expect(shelfNext).not.toBe(shelfHeld)
  expect(inboxNext).not.toBe(inboxHeld)
  expect(shelfNext.file).toBe("_olai/Pins.olai")
  expect(inboxNext.file).toBe("_olai/Inbox.olai")
})

const NEVER: Carrier = {
  shelf: (derived, moved, held) =>
    held ?? conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved, held) => held ?? conventionServed(TEST_CLAIMS, inboxIn, set, moved, undefined),
}

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
    return conventionServed(TEST_CLAIMS, inboxIn, set, moved, undefined)
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

const COUNT_ONLY: Carrier = {
  shelf: (derived, moved, held) =>
    held !== undefined && held.paths.size === derived.byFile.size
      ? held
      : conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved, held) =>
    held !== undefined && held.paths.size === set.documents.length
      ? held
      : conventionServed(TEST_CLAIMS, inboxIn, set, moved, undefined),
}

const ALWAYS: Carrier = {
  shelf: (derived, moved) => conventionRecorded(pinsIn, derived, moved, undefined),
  inbox: (set, moved) => conventionServed(TEST_CLAIMS, inboxIn, set, moved, undefined),
}

test("a carrier that never re-walks is caught by the answers", () => {
  expect(run(NEVER).filter((round) => round.wrong.length > 0).length).toBeGreaterThan(0)
})

test("a carrier that skips the count is caught by the unnamed departure", () => {
  const files: Corpus = { ...START, "_olai/pins.olai": pin("root") }
  const first = revised(files)
  const held = DELTA_ONLY.shelf(first.read.derived, first.moved, undefined)
  const after = revised(without(files, "_olai/pins.olai"))
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

const POOL = [
  "a.olai",
  "b.olai",
  "wing/a.olai",
  "wing.olai",
  "notes.md",
  "_olai/pins.olai",
  "_olai/PINS.olai",
  "wing/Pins.olai",
  "_olai/PiNs.olai",
  "_olai/inbox.olai",
  "wing/inbox.olai",
  "deep/down/Inbox.olai",
  "_olai/InBoX.olai",
] as const

const holding = (at: number, revision: number): string =>
  bodyKind(TEST_CLAIMS, POOL[at] as string) !== null
    ? `a note, revised ${revision}`
    : `{"id":"g${at}","ord":"a0","title":"file ${at} at ${revision}","todo":true}`

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
    let inboxHeld = conventionServed(TEST_CLAIMS, inboxIn, revision.read.set, revision.moved, undefined)
    let shelfPaths = recordedIn(revision.read)
    let inboxPaths = servedIn(revision.read)

    for (const next of sequenceOf(seed, 60)) {
      const after = revised(next, [files, revision.read])
      files = next
      revision = after
      const { read, moved } = after
      revisions++

      const shelfNext = conventionRecorded(pinsIn, read.derived, moved, shelfHeld)
      const inboxNext = conventionServed(TEST_CLAIMS, inboxIn, read.set, moved, inboxHeld)
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
  expect(revisions).toBe(480)
  expect(quiet).toBeGreaterThan(revisions / 4)
  expect(disagreed).toBeGreaterThan(20)
  expect(walked).toBeLessThan(revisions * 2)
})
