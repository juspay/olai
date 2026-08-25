/**
 * WHAT FOUR TOOL-CALL WALKS COST — one row per cost, each timed against the
 * computation it replaced.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`). Perf numbers are reported artifacts,
 * never CI gates — a timing that fails a lane on a busy machine teaches nobody
 * anything. What IS a gate is beside each row and lives in the suite: the
 * equalities (`./walks.test.ts`, `./following.equivalence.test.ts`,
 * `../../format/src/set.walks.test.ts`, `../../format/src/validate.walks.test.ts`,
 * `../../format/src/suggest.test.ts`) and the counts
 * (`./following.equivalence.test.ts`'s identity, `set.walks`'s comparisons,
 * `validate.walks`'s record reads, `suggest.walks`'s matrices).
 *
 * FOUR ROWS, because the ops bundle is four costs and blending them would be a
 * number nobody pays:
 *
 *   - CAPTURE'S LANDING (`perf-capture-paths`) — the outline listing, which
 *     materialises every record in the directory, against the paths-only
 *     question. The unit is one capture, and the retry the race needs means a
 *     capture can pay it twice;
 *   - A BATCH (`perf-batch-assemble`, and under it `perf-reading-patched-check`)
 *     — a run of ops through the fold as it stood (the directory taken apart and
 *     re-assembled per op, and the patched view then held against the whole
 *     corpus) against the carried one (the written files spliced into the set the
 *     last op left, the view held against those files, and the asking carried).
 *     Two sizes, because the shape of the before column IS the finding: the bill
 *     grows with the ops × the directory. The two per-op rows under it are what
 *     each of those nodes actually moved, since a fold op is four things;
 *   - A FOLD CLICK (`perf-homes-files`) — the two all-files structures built per
 *     call against the two held with the set. The unit is one click, and a
 *     reader folding a page presses it dozens of times against one revision;
 *   - A REFUSED REFERENCE (`perf-didyoumean`) — the did-you-mean walked against
 *     the same offer off the index the ids are held in. Two units: one refusal,
 *     and a BURST of twenty, which is the stale-tab shape the node was filed on.
 *
 * EVERY ROW CHECKS ITS ARMS FIRST. Two arms answering different things are two
 * arms nobody may compare, and the one shape a flattering ratio takes is an arm
 * that reported magnificently by answering nothing.
 *
 * Alternating, warmed, median of several rounds ({@link alternating}): two arms
 * run one after the other are two arms of a machine in two moods.
 *
 * Size the vault with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS, like the legs that
 * share `vaultOf`.
 */

import {
  apart,
  assemble,
  didYouMean,
  didYouMeanDeclared,
  following,
  type OutlineSet,
  outlinePaths,
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

/** The vault, assembled and derived the way a served directory is — the pairing
 *  a store publishes, which is what every arm below is handed. It is the SAME
 *  generated vault the patcher, the completion and the day readings run on, so
 *  these numbers and theirs are about one directory. */
const reading: Reading = readingOfVault(vaultOf({ files: FILES, records: RECORDS }))

const set: OutlineSet = reading.set
const paths = outlinePaths(set)
const records = reading.derived.nodes.length

console.log(
  `vault: ${paths.length} outlines, ${records} records\n${runtimeSaid()}\n`,
)

// ── capture's landing ──────────────────────────────────────────────────

/** The reading a capture used to resolve against: the whole listing, with the
 *  file names kept off it. */
const listedPaths = (at: Reading): ReadonlyArray<string> =>
  Query.outlines(at.set, at.derived).map((row) => row.file)

if (JSON.stringify(listedPaths(reading)) !== JSON.stringify(Query.paths(set).paths)) {
  throw new Error("the listing and the paths question disagree about the directory")
}

const [listingMs, pathsMs] = alternating([
  () => listedPaths(reading),
  () => Query.paths(set),
])

console.log(`capture's landing (perf-capture-paths)`)
console.log(`  listing   ${listingMs.toFixed(3)}ms`)
console.log(`  paths     ${pathsMs.toFixed(3)}ms`)
console.log(`  ${(listingMs / pathsMs).toFixed(1)}× per capture, and a race pays it twice\n`)

// ── a batch ────────────────────────────────────────────────────────────

/** A run of ops over the vault: marks on records the corpus really holds, which
 *  is what a batch mostly is. The ids come off the derivation so the script is
 *  about the vault rather than about a fixture. */
const opsOf = (howMany: number) =>
  reading.derived.nodes
    .filter((located) => !("mirror" in located.node))
    .slice(0, howMany)
    .map((located) => ({ op: "desc" as const, id: located.node.id, desc: "a note this batch wrote" }))

/** One batch, folded — the arm is which fold it goes through. The last op is
 *  folded too, unlike the planner's own run, so the two arms are compared over
 *  the same number of folds. */
const batched = (
  ops: ReadonlyArray<{ readonly op: "desc"; readonly id: string; readonly desc: string }>,
  fold: (from: Scope) => (made: never) => Result.Result<Scope, never>,
): Scope => {
  let at = scoping(reading, steady())
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

/**
 * THE SET-BUILDING ALONE, and then THE DOOR — the honest inside of the two rows
 * above.
 *
 * A fold op is a serialise, a parse, a set and a patched view, and the two nodes
 * measured here changed one of those four each — so an end-to-end ratio is
 * either change DILUTED by the three beside it, and printing only that would let
 * a reader conclude they did nothing. What they actually did is here; what they
 * are worth to a batch is above. What is left un-narrowed either way is the
 * file's own bytes, which is the serialise/parse pair and the dominant term.
 *
 *   - THE SET (`perf-batch-assemble`): the directory taken apart and
 *     re-assembled per op, against the previous set with the written file
 *     spliced in;
 *   - THE DOOR (`perf-reading-patched-check`): the whole call the fold makes per
 *     op — the set AND the patched view AND the check that holds them together.
 *     The before arm is `reading` with the delta the fold used to build beside
 *     the files, whose guard then walks every record in the directory; the after
 *     arm is `following`, which builds both halves out of the one list and holds
 *     them together at the files the op wrote. The two are checked against each
 *     other before they are timed, view and set both, because two arms answering
 *     different things are two arms nobody may compare.
 */
const rewritten = set.documents[Math.floor(paths.length / 2)] as never
const [perOpAssembled, perOpSpliced] = alternating([
  () => {
    const decoded = apart(set)
    decoded.set((rewritten as { path: string }).path, Result.succeed(rewritten))
    return assemble(decoded)
  },
  () => withDocuments(set, [rewritten]),
])
console.log(
  `  one op's SET   assembled ${perOpAssembled.toFixed(3)}ms   ` +
    `spliced ${perOpSpliced.toFixed(3)}ms   ` +
    `${(perOpAssembled / perOpSpliced).toFixed(1)}×`,
)

/** The DOOR, both ways over one written file: what a fold op hands the format
 *  and what it gets back. The delta is the one the fold used to build beside
 *  the files it wrote, which is what makes the before arm the call that
 *  actually stood here. */
const written = rewritten as unknown as {
  readonly path: string
  readonly nodes: ReadonlyArray<never>
}
const checkedDoor = (): Reading =>
  formatReading(withDocuments(set, [rewritten]), {
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

// ── a fold click ───────────────────────────────────────────────────────

/** The file half as it stood: a fresh `Set` of every outline path and a fresh
 *  map of every broken file, per call. */
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

/** What one fold click asks: the ids a reader has collapsed in the file it is
 *  looking at, and that file. */
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

// ── a refused reference ────────────────────────────────────────────────
//
// TWO ID SPACES, and the pair is the honest reading of this cost rather than a
// second corpus for its own sake. The bound the index rules candidates out
// with is the CHARACTERS a candidate is made of, so what it buys depends
// entirely on how alike the ids in a directory are:
//
//   - the VAULT's own, which the generator spells `f160n2` — a handful of
//     characters, one shape, every id inside every other id's alphabet. The
//     bound rules little out there, and the row says so;
//   - MINTED ids, eight base-36 characters, which is what `Ops`' minter
//     produces (`./ops.ts`) and therefore what a directory an agent has been
//     writing into is mostly made of. Two of those share almost no characters,
//     so the bound rules nearly everything out.
//
// What holds in BOTH is the count the suite asserts
// (`@olai/format`'s `suggest.walks.test.ts`): the matrices stop scaling with
// the vault. What the clock says about that is what these rows are for — the
// matrix over a six-character id is cheap enough that ruling it out is worth
// less than it sounds, which is a thing to know before anybody files the next
// node on this.

const typoOf = (id: string): string => `${id.slice(0, 2)}${id[2] === "z" ? "y" : "z"}${id.slice(3)}`

/** An id space of the shape the minter produces, at the vault's own size —
 *  deterministic, and not drawn from `Math.random` for `alternating`'s reason:
 *  a benchmark nobody can re-run is a number nobody can check. */
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

/** One row: the two arms, checked against each other and then timed, over one
 *  id space — a single refusal, and the BURST a stale tab replays. */
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
