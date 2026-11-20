const OUTLINE_EXT = mintExt(TEST_CLAIMS, [...TEST_CLAIMS.byKind.values()].find(claim => claim.holds === "nodes")!.kind)!
import { TEST_CLAIMS } from "@olai/format/testlib"
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
import { fileKind, mintExt } from "./kinds.ts"
import { assemble } from "./set.ts"
import { shelfIn, shelfOf } from "./shelf.ts"
import { type Reading, validate } from "./validate.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const REVISIONS = Number(process.env["OLAI_BENCH_EDITS"] ?? 25)

type Corpus = Record<string, string>

const PINS = Array.from(
  { length: 8 },
  (_, at) => JSON.stringify({ id: `pin${at}`, ord: `a${at}`, title: `/#f${at}r` }),
).join("\n")

const CAPTURES = Array.from(
  { length: 12 },
  (_, at) =>
    JSON.stringify({ id: `cap${at}`, ord: `a${at}`, title: `a capture ${at}`, todo: true }),
).join("\n")

const vault = (): Corpus => ({
  ...Object.fromEntries(settled(vaultOf({ files: FILES, records: RECORDS }))),
  "Pins.olai": PINS,
  "notes/Inbox.olai": CAPTURES,
})

interface Revision {
  readonly read: Reading
  readonly moved: PathsMoved
}

const revised = (files: Corpus, before?: readonly [Corpus, Reading]): Revision => {
  const outcome = validate(TEST_CLAIMS,
    assemble(TEST_CLAIMS, decodedOf(files)),
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

const typed = (text: string, at: number): string => retitled(text, at)

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

const edited = (files: Corpus, which: number): string => {
  const paths = Object.keys(files).filter((path) => TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, path) ?? "")?.holds === "nodes")
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

const before = (revisions: ReadonlyArray<Revision>) => (): void => {
  for (const { read } of revisions) {
    shelfOf(read.derived)
    inboxHeldOf(read.set, read.derived)
  }
}

const after = (revisions: ReadonlyArray<Revision>) => (): void => {
  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  for (const { read, moved } of revisions) {
    shelfFile = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    shelfIn(read.derived, shelfFile.file)
    inboxFile = conventionServed(TEST_CLAIMS, inboxIn, read.set, moved, inboxFile)
    inboxHeldIn(read.derived, inboxFile.file)
  }
}

const walksOf = (revisions: ReadonlyArray<Revision>): number => {
  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  let walks = 0
  for (const { read, moved } of revisions) {
    const shelfNext = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    const inboxNext = conventionServed(TEST_CLAIMS, inboxIn, read.set, moved, inboxFile)
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

  let shelfFile: Convention | undefined
  let inboxFile: Convention | undefined
  for (const { read, moved } of revisions) {
    shelfFile = conventionRecorded(pinsIn, read.derived, moved, shelfFile)
    inboxFile = conventionServed(TEST_CLAIMS, inboxIn, read.set, moved, inboxFile)
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
            pinsIn(TEST_CLAIMS, read.derived.byFile.keys())
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
