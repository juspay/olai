/**
 * WHAT ONE PUBLISHED REVISION COSTS — the maps it builds and the keys it writes
 * into them, before and after `perf-published-maps`, both arms in one run.
 *
 * Publishing used to rebuild the three collections whole on every revision:
 * each walked its own list of every served file and minted a fresh `Map` of
 * every entry, so one keystroke saved into one outline of a two-thousand-file
 * vault paid about three maps of two thousand keys. It now CARRIES those maps,
 * writing only the files a probe moved into them and rebuilding one only where
 * a key was BORN ({@link ./published.ts}). That is a claim about cost, and this
 * is the number for it.
 *
 * BOTH ARMS ARE IN THE TREE, which is what this repository requires of a pair
 * of figures: the "before" is the walk kept as the differential's reference
 * implementation ({@link ./published.testlib.ts}'s `publishedAsWalked`), so a
 * reader re-running this gets both halves and can compare them on their own
 * hardware rather than taking one laptop's milliseconds on trust.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and deliberately not a dependency of
 * `check`: a timing that fails a lane on a busy machine teaches nobody
 * anything, and perf numbers are reported artifacts and never gates. What the
 * equivalence rests on is `./published.equivalence.test.ts` — the same two
 * projections, compared for their FRAMES, in the suite.
 *
 * ONE THING HERE DOES FAIL THE RUN, and it is not a timing: the two arms are
 * replayed against each other over this leg's own corpus before anything is
 * measured, and a single divergence throws. Two projections that published
 * different frames are two projections nobody may compare, and the one shape a
 * flattering ratio takes is an arm that reported magnificently by doing less
 * than it was supposed to.
 *
 * TWO MEASUREMENTS, because the interesting one is not a timing:
 *
 *   - THE ALLOCATION, which is the subject. `Map` is swapped for a counting
 *     subclass and every map's own `set` for a counting one, around the call and
 *     put back afterwards, so what is reported is maps CONSTRUCTED and keys
 *     WRITTEN per revision — the figures the roadmap node is about, and the ones
 *     that do not move with the weather. Both halves are needed and the second
 *     is the load-bearing one: a map CARRIED from the revision before was built
 *     before the counter existed, so a subclass alone would report the write
 *     this change is all about as costing nothing.
 *   - THE TIME, uninstrumented and alternating, because allocation that costs
 *     no wall clock would be an optimisation nobody needed.
 *
 * THREE REVISIONS, because a collection is carried, written into or rebuilt and
 * the three cost differently: ONE FILE SAVED is the commonest revision there is
 * and the one the whole change is about; A FILE CREATED is the one thing that
 * still rebuilds a map, so its row is what the change did NOT buy; and a
 * `git pull` moving twenty files at once is the burst the store coalesces into
 * a single revision.
 *
 * Size the vault with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS.
 */

import type { Reading } from "@olai/format"
import { median, runtimeSaid, timed, vaultOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"

import { type Published, publishedOf } from "./published.ts"
import {
  differential,
  type Projection,
  publishedAsWalked,
  revisionsOf,
  type Step,
} from "./published.testlib.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1200)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 20)

/**
 * The vault, with the OTHER kinds beside the outlines — `vaultOf` mints `.olai`
 * and nothing else, and a directory of nothing but outlines is one where the
 * documents collection is empty and a third of what is being measured is never
 * asked for anything.
 */
const vault = ((): ReadonlyMap<string, string> => {
  const files = new Map(vaultOf({ files: FILES, records: RECORDS }))
  for (let at = 0; at < FILES / 4; at++) {
    files.set(`note${at}/page${at}.md`, `# page ${at}\n\nsome prose about the kitchen.\n`)
    if (at % 5 === 0) files.set(`note${at}/saved${at}.html`, "")
  }
  return files
})()

const outlines = [...vault.keys()].filter((file) => file.endsWith(".olai"))
const documents = [...vault.keys()].filter((file) => file.endsWith(".md"))

/** One outline's worth of JSONL, minted per revision so no two writes of a file
 *  are the same bytes. */
const minted = (at: number): string =>
  [
    JSON.stringify({ id: `b${at}root`, ord: "a0", title: `written at revision ${at}` }),
    JSON.stringify({ id: `b${at}kid`, parent: `b${at}root`, ord: "a1", title: `a child ${at}` }),
  ].join("\n")

/** The three revisions measured, each as a run of {@link ROUNDS} of the same
 *  shape — one shape per arm run, so what is timed is that shape and not a
 *  corpus's whole history. */
const SHAPES: ReadonlyArray<readonly [string, (at: number) => Step]> = [
  ["one file saved", (at) => ({ writes: [[outlines[at % outlines.length] as string, minted(at)]] })],
  ["a file created", (at) => ({ writes: [[`born${at}.olai`, minted(at)]] })],
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

/** How many revisions of a shape one arm run folds. Enough that one revision's
 *  cost is not one clock tick, few enough that the corpus below is built in
 *  seconds. */
const ROUNDS = 12

/** The snapshots for one shape, built ONCE and folded by both arms — a bench
 *  that built a revision per arm would be timing two corpora. */
const revisionsFor = (step: (at: number) => Step): ReadonlyArray<Snapshot<Reading>> =>
  revisionsOf(vault, Array.from({ length: ROUNDS }, (_, at) => step(at)))

/**
 * ONE ARM: fold every revision after the first, from a store already holding
 * one.
 *
 * The FIRST revision is deliberately outside this. Both sides build three whole
 * maps there, once per store, and a leg that folded it into the average would
 * be reporting a figure a running server pays once at boot as if it were the
 * cost of a keystroke.
 *
 * The seed is a parameter rather than something this builds, and that is not
 * tidiness: the projection under test CONSUMES the revision it is handed (it
 * carries its maps forward and writes into them), so an arm run twice from one
 * seed would be folding from a map the first run already moved. Every run gets
 * its own, built outside whatever is measuring.
 */
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

/**
 * TWO ARMS, warmed and then timed in alternating order — `@olai/format`'s
 * `alternating` with one thing added, which is why it is not simply called: a
 * run of an arm needs a seed built for it, and that build must be outside the
 * clock. Everything else is that helper's argument verbatim — two arms run one
 * after the other are two arms of a machine in two moods, and going second in a
 * round is worth more than some of the differences this leg is asked to see.
 */
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

// ── the counting Map ───────────────────────────────────────────────────

/** What one arm allocated: maps constructed, and keys written into them. */
interface Allocated {
  readonly maps: number
  readonly writes: number
}

/**
 * The same fold, with `Map` swapped for a subclass that counts — the
 * measurement this leg exists for.
 *
 * A GLOBAL SWAP rather than a parameter, because the thing being counted is a
 * `new Map()` written in production code and the alternative is production code
 * that takes an allocator so a benchmark can watch it. It is put back in a
 * `finally`, and the counted region is the fold and nothing else: the corpus is
 * built before this is ever installed.
 */
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
  // THE PROTOTYPE, not the subclass's own `set`. A map CARRIED from the
  // revision before was built before this counter existed, so a write into it
  // would be invisible to a subclass — which is precisely the write this leg is
  // trying to see. Patching the method every map shares counts them all, the
  // carried ones included, and a map built from another calls it per entry by
  // specification so a clone is counted as the work it is.
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

/** One arm's fold, counted — with its seed built BEFORE the counter is
 *  installed, for {@link foldFrom}'s reason. */
const allocated = (
  projection: Projection,
  revisions: ReadonlyArray<Snapshot<Reading>>,
): Allocated => {
  const seed = seedOf(projection, revisions)
  return counting(() => foldFrom(projection, revisions, seed))
}

// ── the gate, and then the numbers ─────────────────────────────────────

// THE TWO ARMS MUST PUBLISH THE SAME FRAMES, asserted at this leg's own size
// before a millisecond is quoted — the differential from the suite, run over
// the corpus the ratios below are about.
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
  // The seed is built OUTSIDE the counter for the same reason it is built
  // outside the clock — see {@link foldFrom}.
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

// ...and what the FIRST revision of a store costs, which is the one both sides
// pay in full and the one nothing here claims to have improved. Printed rather
// than left out, so a reader is not left thinking publishing became free.
const first = revisionsFor(SHAPES[0]![1])[0] as Snapshot<Reading>
const firstWalked = counting(() => void publishedAsWalked(first, null))
const firstCarried = counting(() => void publishedOf(first, null))
console.log(
  `the first revision of a store (excluded above): ` +
    `${count(firstWalked.writes)} keys written by the walk and ` +
    `${count(firstCarried.writes)} by the carried map — the same three maps, ` +
    `built the same way, in ${ms(timed(() => void publishedOf(first, null)))}`,
)
