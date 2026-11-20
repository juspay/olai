import { TEST_CLAIMS } from "@olai/format/testlib"
import { addressOf } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { alternating, median, runtimeSaid, seeded, timed, timesSaid } from "./fixtures.testlib.ts"
import { type Pointing, pointingOf, repointed } from "./pointing.ts"
import {
  documentsAmong,
  facesIn,
  linkyRevisions,
  linkyVault,
  type Revision,
  scannedReferrers,
} from "./pointing.testlib.ts"
import { decodedVault } from "./scope.testlib.ts"
import { assemble, type OutlineSet } from "./set.ts"
import { type Reading, reading } from "./validate.ts"

const OUTLINES = Number(process.env["OLAI_BENCH_OUTLINES"] ?? 300)
const BODIES = Number(process.env["OLAI_BENCH_BODIES"] ?? 1500)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const PAGES = Number(process.env["OLAI_BENCH_PAGES"] ?? 10)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 20)

const vault = linkyVault({ outlines: OUTLINES, bodies: BODIES, records: RECORDS })
const random = seeded(20260825)
const stream = linkyRevisions(vault, random, EDITS)

const readings: Array<{ readonly set: OutlineSet; readonly at: Reading }> = []
{
  const decoded = decodedVault(new Map())
  let held: Revision = new Map()
  let previous: Reading | null = null
  for (const revision of stream) {
    for (const file of held.keys()) if (!revision.has(file)) decoded.delete(file)
    const moved = new Map<string, string>()
    for (const [file, text] of revision) if (held.get(file) !== text) moved.set(file, text)
    for (const [file, one] of decodedVault(moved)) decoded.set(file, one)
    held = revision
    const set = assemble(TEST_CLAIMS, decoded)
    previous = reading(TEST_CLAIMS, set)
    readings.push({ set, at: previous })
  }
}

const first = readings[0] as { readonly set: OutlineSet; readonly at: Reading }
const faces = facesIn(first.set)

const bodies = documentsAmong(first.set.documents.map((one) => one.path))
const open = bodies
  .filter((_, which) => which % Math.max(1, Math.floor(bodies.length / PAGES)) === 0)
  .slice(0, PAGES)
  .map((path) => addressOf(TEST_CLAIMS, path, null)!)

const unpointed = addressOf(TEST_CLAIMS, "nobody-points-here.md", null)!

const readIndex = (at: Reading, which = open): number =>
  which.reduce((held, address) => held + referencesOf(at, address).length, 0)

const readScan = (at: Reading, which = open): number =>
  which.reduce((held, address) => held + scannedReferrers(address, faces, at.derived).length, 0)

const drawn = readIndex(first.at)
if (drawn !== readScan(first.at)) {
  throw new Error("the two read arms disagree, so there is nothing to compare")
}

const ROUNDS = 9

const [scan, index] = alternating(
  [() => readScan(first.at), () => readIndex(first.at)],
  ROUNDS,
)
const [scanCold, indexCold] = alternating(
  [
    () => readScan(first.at, [unpointed]),
    () => readIndex(first.at, [unpointed]),
  ],
  ROUNDS,
)

const pairs = readings.slice(1).map((one, at) => ({
  was: (readings[at] as { readonly set: OutlineSet }).set,
  now: one.set,
  before: (readings[at] as { readonly at: Reading }).at.pointing,
}))
const carries = pairs.map((pair) => timed(() => repointed(pair.before, TEST_CLAIMS, pair.was.documents, pair.now.documents)))
const rebuilds = pairs.map((pair) => timed(() => pointingOf(TEST_CLAIMS, pair.now.documents)))

const carried = pairs.filter((pair) =>
  repointed(pair.before, TEST_CLAIMS, pair.was.documents, pair.now.documents) === pair.before
).length

const density = bodies
  .map((path) => referencesOf(first.at, addressOf(TEST_CLAIMS, path, null)!).length)
  .sort((one, other) => one - other)

console.log(
  `pointing.bench — ${first.set.documents.length} files ` +
    `(${OUTLINES} outlines × ${RECORDS} records, ${BODIES} bodies), ` +
    `${first.at.pointing.size} keys, ${PAGES} pages open, ${drawn} referrers drawn`,
)
console.log(
  `  referrers per body: min ${density[0]}, median ${
    density[Math.floor(density.length / 2)]
  }, max ${density[density.length - 1]}`,
)
console.log(runtimeSaid())
console.log("")
console.log(`  read              scan ${scan.toFixed(3)}ms   index ${index.toFixed(3)}ms`)
console.log(
  `  read (unpointed)  scan ${scanCold.toFixed(3)}ms   index ${indexCold.toFixed(3)}ms`,
)
console.log(
  `  write             rebuild ${median(rebuilds).toFixed(3)}ms   carry ${
    median(carries).toFixed(3)
  }ms   (${carried} of ${pairs.length} edits carried uncloned)`,
)
console.log("")
console.log(timesSaid("carry", carries, 8))
console.log(timesSaid("rebuild", rebuilds, 8))
