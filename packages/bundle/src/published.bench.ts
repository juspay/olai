import { TEST_CLAIMS } from "@olai/format/testlib"
import { bodyKind,  type Reading } from "@olai/format"
import { median, runtimeSaid, timed, vaultOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"

import type { Published } from "./published.testlib.ts"
import { publishedOf } from "./published.testlib.ts"
import {
  differential,
  type Projection,
  publishedAsWalked,
  revisionsOf,
  type Step,
} from "./published.testlib.ts"

const OUTLINE = TEST_CLAIMS.byKind.get("outline-olai")!.exts[0]

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1200)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 20)

const vault = ((): ReadonlyMap<string, string> => {
  const files = new Map(vaultOf({ files: FILES, records: RECORDS }))
  for (let at = 0; at < FILES / 4; at++) {
    files.set(`note${at}/page${at}.md`, `# page ${at}\n\nsome prose about the kitchen.\n`)
    if (at % 5 === 0) files.set(`note${at}/saved${at}.html`, "")
  }
  return files
})()

const outlines = [...vault.keys()].filter((file) => bodyKind(TEST_CLAIMS, file) === null)
const documents = [...vault.keys()].filter((file) => bodyKind(TEST_CLAIMS, file) === "document")

const minted = (at: number): string =>
  [
    JSON.stringify({ id: `b${at}root`, ord: "a0", title: `written at revision ${at}` }),
    JSON.stringify({ id: `b${at}kid`, parent: `b${at}root`, ord: "a1", title: `a child ${at}` }),
  ].join("\n")

const SHAPES: ReadonlyArray<readonly [string, (at: number) => Step]> = [
  ["one file saved", (at) => ({ writes: [[outlines[at % outlines.length] as string, minted(at)]] })],
  ["a file created", (at) => ({ writes: [[`born${at}${OUTLINE}`, minted(at)]] })],
  [
    "a `git pull` — 20 files",
    (at) => ({
      writes: [
        ...Array.from(
          { length: 16 },
          (_, which) =>
            [outlines[(at * 16 + which) % outlines.length] as string, minted(at * 100 + which)] as const,
        ),
        ...Array.from(
          { length: 4 },
          (_, which) => [documents[(at + which) % documents.length] as string, `# pulled ${at}\n`] as const,
        ),
      ],
    }),
  ],
]

const ROUNDS = 12

const revisionsFor = (step: (at: number) => Step): ReadonlyArray<Snapshot<Reading>> =>
  revisionsOf(vault, Array.from({ length: ROUNDS }, (_, at) => step(at)))

const foldFrom = (
  projection: Projection,
  revisions: ReadonlyArray<Snapshot<Reading>>,
  seed: Published,
): void => {
  let held = seed
  for (let at = 1; at < revisions.length; at++) {
    held = projection(revisions[at] as Snapshot<Reading>, held)
  }
}

const seedOf = (
  projection: Projection,
  revisions: ReadonlyArray<Snapshot<Reading>>,
): Published => projection(revisions[0] as Snapshot<Reading>, null)

const ARMS = [publishedAsWalked, publishedOf] as const

const paired = (
  revisions: ReadonlyArray<Snapshot<Reading>>,
  rounds = 5,
): readonly [number, number] => {
  for (const arm of ARMS) foldFrom(arm, revisions, seedOf(arm, revisions))
  const runs = Array.from({ length: rounds }, (_, round) => {
    const times: Array<number> = []
    for (const which of round % 2 === 0 ? [0, 1] : [1, 0]) {
      const arm = ARMS[which as 0 | 1]
      const seed = seedOf(arm, revisions)
      times[which] = timed(() => foldFrom(arm, revisions, seed))
    }
    return times
  })
  return [
    median(runs.map((round) => round[0] as number)),
    median(runs.map((round) => round[1] as number)),
  ]
}

interface Allocated {
  readonly maps: number
  readonly writes: number
}

const counting = (run: () => void): Allocated => {
  let maps = 0
  let writes = 0
  const Real = globalThis.Map
  const realSet = Real.prototype.set
  class Counting<K, V> extends Real<K, V> {
    constructor(entries?: Iterable<readonly [K, V]> | null) {
      super(entries)
      maps += 1
    }
  }
  ;(Real.prototype as { set: unknown }).set = function <K, V>(
    this: Map<K, V>,
    key: K,
    value: V,
  ): Map<K, V> {
    writes += 1
    return realSet.call(this, key, value)
  }
  globalThis.Map = Counting as unknown as MapConstructor
  try {
    run()
  } finally {
    globalThis.Map = Real
    ;(Real.prototype as { set: unknown }).set = realSet
  }
  return { maps, writes }
}

const allocated = (
  projection: Projection,
  revisions: ReadonlyArray<Snapshot<Reading>>,
): Allocated => {
  const seed = seedOf(projection, revisions)
  return counting(() => foldFrom(projection, revisions, seed))
}

const agreed = differential(
  vault,
  SHAPES.flatMap(([, step]) => Array.from({ length: 3 }, (_, at) => step(at))),
  publishedOf,
)
if (agreed.divergences.length > 0) {
  throw new Error(
    `the two arms are not publishing the same revision, so the figures below ` +
      `mean nothing (./published.equivalence.test.ts):\n  ` +
      agreed.divergences.slice(0, 5).join("\n  "),
  )
}

console.log(
  `vault: ${vault.size} files (${outlines.length} outlines, ${documents.length} documents), ` +
    `${RECORDS} records each\n${runtimeSaid()}\n` +
    `${ROUNDS} revisions per arm run; the first revision of a store is excluded — ` +
    `both sides build three whole maps there, once.\n`,
)

const row = (
  what: string,
  before: number,
  after: number,
  said: (at: number) => string,
): string =>
  `${what.padEnd(26)}${said(before).padStart(12)}${said(after).padStart(12)}` +
  `${(after === 0 ? "∞" : `${(before / after).toFixed(1)}×`).padStart(9)}`

const count = (at: number): string => at.toLocaleString("en-US")
const ms = (at: number): string => `${at.toFixed(2)}ms`

for (const [what, step] of SHAPES) {
  const revisions = revisionsFor(step)
  const wasAlloc = allocated(publishedAsWalked, revisions)
  const nowAlloc = allocated(publishedOf, revisions)
  const [wasMs, nowMs] = paired(revisions)
  const per = (at: number): number => at / (revisions.length - 1)
  console.log(`${what}\n${"".padEnd(26)}${"before".padStart(12)}${"after".padStart(12)}`)
  console.log(row("  maps built / revision", per(wasAlloc.maps), per(nowAlloc.maps), count))
  console.log(row("  keys written / revision", per(wasAlloc.writes), per(nowAlloc.writes), count))
  console.log(row("  ms / revision", per(wasMs), per(nowMs), ms))
  console.log()
}

const first = revisionsFor(SHAPES[0]![1])[0] as Snapshot<Reading>
const firstWalked = counting(() => void publishedAsWalked(first, null))
const firstCarried = counting(() => void publishedOf(first, null))
console.log(
  `the first revision of a store (excluded above): ` +
    `${count(firstWalked.writes)} keys written by the walk and ` +
    `${count(firstCarried.writes)} by the carried map — the same three maps, ` +
    `built the same way, in ${ms(timed(() => void publishedOf(first, null)))}`,
)
