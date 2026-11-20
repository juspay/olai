import { TEST_CLAIMS } from "@olai/ops/testlib"
import {
  apart,
  assemble,
  didYouMean,
  didYouMeanDeclared,
  following,
  type OutlineSet,
  outlinePaths,
  NO_KINDS,
  type Reading,
  reading as formatReading,
  withDocuments,
} from "@olai/format"
import { alternating, runtimeSaid, vaultOf } from "@olai/format/testlib"
import { readingOfVault } from "@olai/format/testlib/scope"
import { Result } from "effect"

import { steady } from "./fixtures.testlib.ts"
import { folding } from "./following.ts"
import { assembling } from "./following.testlib.ts"
import { plan, type Scope, scoping } from "./plan.ts"
import * as Query from "./query.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 20)

const reading: Reading = readingOfVault(vaultOf({ files: FILES, records: RECORDS }))

const set: OutlineSet = reading.set
const paths = outlinePaths(set)
const records = reading.derived.nodes.length

console.log(
  `vault: ${paths.length} outlines, ${records} records\n${runtimeSaid()}\n`,
)

const listedPaths = (at: Reading): ReadonlyArray<string> =>
  Query.outlines(at.set, at.derived).map((row) => row.file)

if (JSON.stringify(listedPaths(reading)) !== JSON.stringify(Query.paths(TEST_CLAIMS, [...TEST_CLAIMS.byKind.values()].find(claim => claim.holds === "nodes")!.kind, set).paths)) {
  throw new Error("the listing and the paths question disagree about the directory")
}

const [listingMs, pathsMs] = alternating([
  () => listedPaths(reading),
  () => Query.paths(TEST_CLAIMS, [...TEST_CLAIMS.byKind.values()].find(claim => claim.holds === "nodes")!.kind, set),
])

console.log(`capture's landing (perf-capture-paths)`)
console.log(`  listing   ${listingMs.toFixed(3)}ms`)
console.log(`  paths     ${pathsMs.toFixed(3)}ms`)
console.log(`  ${(listingMs / pathsMs).toFixed(1)}× per capture, and a race pays it twice\n`)

const opsOf = (howMany: number) =>
  reading.derived.nodes
    .filter((located) => !("mirror" in located.node))
    .slice(0, howMany)
    .map((located) => ({ op: "desc" as const, id: located.node.id, desc: "a note this batch wrote" }))

const batched = (
  ops: ReadonlyArray<{ readonly op: "desc"; readonly id: string; readonly desc: string }>,
  fold: (from: Scope) => (made: never) => Result.Result<Scope, never>,
): Scope => {
  let at = scoping(reading, steady(), NO_KINDS, [...TEST_CLAIMS.byKind.values()].find(claim => claim.holds === "nodes")!.kind)
  const folding = fold(at)
  for (const op of ops) {
    const made = plan(at, op)
    if (Result.isFailure(made)) throw new Error(`\`${op.op} ${op.id}\` refused`)
    const next = folding(made.success as never)
    if (Result.isFailure(next)) throw new Error("the fold refused")
    at = next.success
  }
  return at
}

const carriedFold = folding as unknown as (from: Scope) => (made: never) => Result.Result<Scope, never>
const assemblingFold = assembling as unknown as (from: Scope) => (made: never) => Result.Result<Scope, never>

console.log(`a batch (perf-batch-assemble)`)
for (const howMany of [10, 100]) {
  const ops = opsOf(howMany)
  const one = batched(ops, assemblingFold)
  const other = batched(ops, carriedFold)
  if (JSON.stringify(one.set.documents) !== JSON.stringify(other.set.documents)) {
    throw new Error(`the two folds disagree about the set after ${howMany} ops`)
  }
  const [assembledMs, splicedMs] = alternating([
    () => batched(ops, assemblingFold),
    () => batched(ops, carriedFold),
  ], 5)
  console.log(
    `  ${String(howMany).padStart(3)} ops   assembled ${assembledMs.toFixed(1)}ms   ` +
      `spliced ${splicedMs.toFixed(1)}ms   ${(assembledMs / splicedMs).toFixed(1)}×`,
  )
}

const rewritten = set.documents[Math.floor(paths.length / 2)] as never
const [perOpAssembled, perOpSpliced] = alternating([
  () => {
    const decoded = apart(set)
    decoded.set((rewritten as { path: string }).path, Result.succeed(rewritten))
    return assemble(TEST_CLAIMS, decoded)
  },
  () => withDocuments(set, [rewritten]),
])
console.log(
  `  one op's SET   assembled ${perOpAssembled.toFixed(3)}ms   ` +
    `spliced ${perOpSpliced.toFixed(3)}ms   ` +
    `${(perOpAssembled / perOpSpliced).toFixed(1)}×`,
)

const written = rewritten as unknown as {
  readonly path: string
  readonly nodes: ReadonlyArray<never>
}
const checkedDoor = (): Reading =>
  formatReading(TEST_CLAIMS, withDocuments(set, [rewritten]), {
    read: reading,
    delta: { upserts: [[written.path, { nodes: written.nodes }]], removes: [] },
  })
const carriedDoor = (): Reading => following(reading, [rewritten])

{
  const one = checkedDoor()
  const other = carriedDoor()
  if (
    JSON.stringify(one.set.documents) !== JSON.stringify(other.set.documents) ||
    JSON.stringify([...one.derived.byFile.keys()]) !==
      JSON.stringify([...other.derived.byFile.keys()]) ||
    one.derived.nodes.length !== other.derived.nodes.length ||
    !one.derived.nodes.every((at, index) => at === other.derived.nodes[index])
  ) {
    throw new Error("the two doors disagree about the reading one write leaves")
  }
}

const [perOpChecked, perOpCarried] = alternating([checkedDoor, carriedDoor])
console.log(
  `  one op's DOOR  checked ${perOpChecked.toFixed(3)}ms   ` +
    `carried ${perOpCarried.toFixed(3)}ms   ` +
    `${(perOpChecked / perOpCarried).toFixed(1)}×   ` +
    `(perf-reading-patched-check)`,
)
console.log("")

const walkedHomes = (at: Reading, ids: ReadonlyArray<string>, files: ReadonlyArray<string>) => {
  const homes: Array<{ readonly id: string; readonly file: string }> = []
  for (const id of new Set(ids)) {
    const found = at.derived.byId.get(id)
    if (found !== undefined) homes.push({ id, file: found.file })
  }
  const served = new Set(outlinePaths(at.set))
  const broken = new Map(at.set.broken.map((entry) => [entry.file, entry.errors]))
  const loaded = [...new Set(files)].filter((file) => served.has(file) && !broken.has(file))
  return { homes, loaded }
}

const clicked = {
  ids: reading.derived.nodes.slice(0, 12).map((located) => located.node.id),
  files: paths.slice(0, 1),
}

if (
  JSON.stringify(walkedHomes(reading, clicked.ids, clicked.files)) !==
    JSON.stringify(Query.homes(reading, clicked))
) {
  throw new Error("the walked homes and the held ones disagree")
}

const CLICKS = 20
const [walkedMs, heldMs] = alternating([
  () => {
    for (let click = 0; click < CLICKS; click++) {
      walkedHomes(reading, clicked.ids, clicked.files)
    }
  },
  () => {
    for (let click = 0; click < CLICKS; click++) Query.homes(reading, clicked)
  },
])

console.log(`a fold click (perf-homes-files), ${CLICKS} clicks on one revision`)
console.log(`  walked    ${walkedMs.toFixed(3)}ms`)
console.log(`  held      ${heldMs.toFixed(3)}ms`)
console.log(`  ${(walkedMs / heldMs).toFixed(1)}×\n`)

const typoOf = (id: string): string => `${id.slice(0, 2)}${id[2] === "z" ? "y" : "z"}${id.slice(3)}`

const mintedIds = ((): ReadonlyMap<string, unknown> => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let held = 123456789
  const roll = (below: number): number => {
    held ^= held << 13
    held ^= held >>> 17
    held ^= held << 5
    held |= 0
    return Math.abs(held) % below
  }
  const minted = new Map<string, string>()
  while (minted.size < records) {
    const id = Array.from({ length: 8 }, () => alphabet[roll(alphabet.length)]).join("")
    minted.set(id, id)
  }
  return minted
})()

const refusing = (what: string, ids: ReadonlyMap<string, unknown>): void => {
  const known = [...ids.keys()]
  const one = typoOf(known[Math.floor(known.length / 2)] as string)
  const burst = known.slice(0, 20).map(typoOf)
  for (const asked of [one, ...burst]) {
    if (didYouMean(asked, ids.keys()) !== didYouMeanDeclared(asked, ids)) {
      throw new Error(`the two offers disagree about \`${asked}\``)
    }
  }
  const [oneWalkedMs, oneIndexedMs] = alternating([
    () => didYouMean(one, ids.keys()),
    () => didYouMeanDeclared(one, ids),
  ])
  const [burstWalkedMs, burstIndexedMs] = alternating([
    () => {
      for (const asked of burst) didYouMean(asked, ids.keys())
    },
    () => {
      for (const asked of burst) didYouMeanDeclared(asked, ids)
    },
  ])
  console.log(`  ${what} (${ids.size} ids)`)
  console.log(
    `    one refusal      walked ${oneWalkedMs.toFixed(3)}ms   ` +
      `indexed ${oneIndexedMs.toFixed(3)}ms   ${(oneWalkedMs / oneIndexedMs).toFixed(1)}×`,
  )
  console.log(
    `    ${burst.length} in a burst    walked ${burstWalkedMs.toFixed(3)}ms   ` +
      `indexed ${burstIndexedMs.toFixed(3)}ms   ${(burstWalkedMs / burstIndexedMs).toFixed(1)}×`,
  )
}

console.log(`a refused reference (perf-didyoumean)`)
refusing("the vault's own ids", reading.derived.byId)
refusing("minted ids", mintedIds)
console.log(
  `\nthe index is built once per revision and held against it, so a burst pays\n` +
    `for one pass over the ids however many refusals it replays; what an ask\n` +
    `then costs is the length band, and what it SAVES is the matrix per\n` +
    `candidate the character bound rules out.`,
)
