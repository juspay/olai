/**
 * What ONE EDIT costs the view: patched against rebuilt, on a vault-sized
 * directory.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and that is the whole reason it
 * exists. Slice 3 of `docs/brainstorming/model-indices.md` measured this pair
 * as a one-off on a laptop, quoted the ratio in `docs/architecture.md`, and did
 * not commit the harness — so the tree carried a number nobody could re-run,
 * and said so in the same breath ("one laptop sample that this tree cannot
 * reproduce", open question 5). This is that harness. Deliberately NOT part of
 * `just check`, for `./filter.bench.ts`'s reason: a timing that fails a lane on
 * a busy machine teaches nobody anything.
 *
 * TWO ARMS over one generated vault, driven with the same edits:
 *
 *   - `rebuild` — {@link derive} over the whole corpus, which is what the write
 *     gate cost before the patcher and what the patcher falls back to;
 *   - `patch` — {@link patched}, the incremental answer with the fallback taken
 *     OFF, so an arm that quietly declined would fail here rather than report
 *     the rebuild's number under the patcher's name.
 *
 * AND ONE MORE MEASUREMENT under them, because the layer below makes a trade
 * rather than a saving: a corpus-wide walk of `byId` on each arm's own final
 * view, which is what a saving in the patch that came straight back out of
 * every read afterwards would show up as ({@link walked}).
 *
 * THE PATCHED ARM CARRIES ITS VIEW FORWARD, edit after edit, because that is
 * what both callers do — the write gate patches the last published view, the
 * tab patches the one it is holding — and because it is the only way to see
 * what copy-on-write costs over a session rather than once. {@link ./overlay.ts}
 * is exactly that: the id-map's clone is replaced by a layer over the map the
 * previous patch left standing, so a run that patched once and threw the view
 * away would measure the one case the overlay cannot help.
 *
 * The vault is generated (`./fixtures.testlib.ts`'s `vaultOf`) rather than read,
 * so the figure is reproducible and is a figure about a stated shape:
 * {@link FILES} outlines of {@link RECORDS} records, a third of them marked, a
 * twentieth of them mirrors reaching into the file before. It is the SAME vault
 * `@olai/web`'s `deriving.bench.ts` runs on, so the two benches' numbers are
 * about one directory. Size it with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
 * OLAI_BENCH_EDITS.
 */

import { derive, type Derived } from "./derive.ts"
import { median, nodesOf, retitled, timed, vaultOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { patched, type SetDelta } from "./patch.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 40)

// ── the vault ──────────────────────────────────────────────────────────

const corpus = vaultOf({ files: FILES, records: RECORDS })

/** The paths in the order an assembled set holds them, which is the order the
 *  flat list below is in: a corpus in any other order is not the corpus either
 *  arm is supposed to be answering about. */
const paths = [...corpus.keys()].sort(byPath)

/** file → its records, parsed once. Parsing is not what either arm measures,
 *  and a `nodesOf` inside the timed window would put the same JSON.parse on
 *  both sides of a comparison that is not about it. */
const parsed = new Map<string, ReadonlyArray<Located>>(
  paths.map((file) => [file, nodesOf(corpus.get(file) as string, file)]),
)

const flat = (held: ReadonlyMap<string, ReadonlyArray<Located>>): ReadonlyArray<Located> =>
  paths.flatMap((file) => held.get(file) ?? [])

// ── the edits ──────────────────────────────────────────────────────────

/** Which file edit `which` rewrites. Successive edits land on DIFFERENT files
 *  — the harsher case for the overlay, which holds one layer over the map the
 *  first patch was given and grows it with every file a later patch touches;
 *  re-editing one file, which is what typing is, re-sets the ids already in
 *  that layer and never grows it at all. */
const fileFor = (which: number): string => paths[which % paths.length] as string

/** One edit, in the vocabulary the wire already speaks: one file re-decoded,
 *  with one record's title rewritten. */
const editOf = (which: number): {
  readonly file: string
  readonly records: ReadonlyArray<Located>
  readonly delta: SetDelta
} => {
  const file = fileFor(which)
  const records = nodesOf(retitled(corpus.get(file) as string, `edited ${which}`), file)
  return { file, records, delta: { upserts: [[file, { nodes: records }]], removes: [] } }
}

const edits = Array.from({ length: EDITS }, (_, which) => editOf(which))

// ── the run ────────────────────────────────────────────────────────────

/** What the arm said the edited record's title is now — read back off the
 *  arm's OWN answer, per edit, because an arm that stopped recomputing would
 *  otherwise go on reporting the first revision very fast, which is precisely
 *  the magnificent number a benchmark must never print. */
const edited = (view: Derived, file: string): string | undefined =>
  (view.byFile.get(file) ?? [])
    .map((at) => (at.node as { readonly title?: string }).title)
    .find((title) => title?.startsWith("edited "))

const said = (name: string, view: Derived, which: number): void => {
  const found = edited(view, fileFor(which))
  if (found !== `edited ${which}`) {
    throw new Error(
      `${name} says ${found ?? "nothing"} after edit ${which} — the arm answered` +
        ` a view it never recomputed`,
    )
  }
  if (view.nodes.length !== records) {
    throw new Error(
      `${name} answered for ${view.nodes.length} records of ${records}` +
        ` — the arm is not measuring what it says`,
    )
  }
}

const first = derive(flat(parsed))
const records = first.nodes.length

/** The rebuild: the whole corpus derived again, which is the answer the
 *  patcher is held to and the one it falls back to. */
const rebuilt = edits.map(({ file, records: own }, which) => {
  const held = new Map(parsed)
  held.set(file, own)
  const nodes = flat(held)
  let view: Derived | undefined
  const ms = timed(() => {
    view = derive(nodes)
  })
  said("rebuild", view as Derived, which)
  return ms
})

/** The patch, with the view carried forward: each edit lands on the view the
 *  one before it left. A LOOP rather than the `map` the rebuild arm is, and
 *  the difference is the measurement: that arm's forty answers are independent
 *  and this one is a fold, which is the whole reason copy-on-write over a
 *  session is visible here and not there. */
const patchedMs: Array<number> = []
let carried = first
for (const [which, { delta }] of edits.entries()) {
  let next: Derived | undefined
  patchedMs.push(timed(() => {
    next = patched(carried, delta)
  }))
  if (next === undefined) {
    throw new Error(
      `patch DECLINED edit ${which} — a benchmark of the incremental answer` +
        ` cannot be a benchmark of the rebuild it fell back to`,
    )
  }
  carried = next
  said("patch", carried, which)
}

// THE CARRIED VIEW AGAINST THE ORACLE, once and outside every timed window.
// Forty patches deep, each layered on the last, is where a copy-on-write bug
// would show — and a benchmark whose fast arm is answering wrongly is worse
// than no benchmark, because it reports the saving without the answer. What
// proves the patcher in GENERAL is the property test next door; this says only
// that the arm just timed is still that patcher, and it reads `byId` because
// `./overlay.ts` is what this run is here to size.
const oracle = derive(flat(edits.reduce(
  (held, { file, records: own }) => held.set(file, own),
  new Map(parsed),
)))
const places = (view: Derived): string =>
  [...view.byId].map(([id, at]) => `${id}@${at.file}:${at.line}`).join("\n")
if (carried.nodes.length !== oracle.nodes.length || places(carried) !== places(oracle)) {
  throw new Error(
    `${EDITS} patches deep, the carried view and a fresh derive disagree about the corpus`,
  )
}

/**
 * WHAT THE LAYER COSTS A READER, which is the other half of the trade
 * {@link ./overlay.ts} makes and the half a benchmark of the patch alone would
 * hide: an id the layer does not hold is looked for there before the map
 * underneath answers, and the validator asks `byId` once per record on every
 * write ({@link ./validate.ts}'s `checkParents`). So one corpus-wide walk of
 * that index, timed on both arms' own final view — the patched one, which is a
 * layer, and the rebuilt one, which is a plain `Map`. A saving in the patch
 * that came straight back out of every read afterwards would show up here as
 * the two lines diverging.
 */
const walked = (views: ReadonlyArray<Derived>): ReadonlyArray<number> => {
  const once = (view: Derived): number =>
    timed(() => {
      let found = 0
      for (const at of view.nodes) if (view.byId.get(at.node.id) !== undefined) found++
      if (found !== view.nodes.length) throw new Error("byId does not hold every record")
    })
  // ALTERNATED, warmed first, and the ORDER alternated too. Two walks run one
  // after the other are two walks of a machine in two moods — the difference
  // this is asked to see is one lookup per record, smaller than the drift
  // between them, and smaller again than what going second in a round is worth.
  for (const view of views) once(view)
  const rounds = Array.from({ length: 10 }, (_, round) => {
    const order = views.map((_view, which) => which)
    if (round % 2 === 1) order.reverse()
    const times: Array<number> = []
    for (const which of order) times[which] = once(views[which] as Derived)
    return times
  })
  return views.map((_, which) => median(rounds.map((round) => round[which] as number)))
}

const say = (name: string, times: ReadonlyArray<number>): void => {
  const ms = (at: number) => `${at.toFixed(2)}ms`
  console.log(
    `${name.padEnd(8)} median ${ms(median(times))}` +
      `, mean ${ms(times.reduce((one, other) => one + other, 0) / times.length)}` +
      `, min ${ms(Math.min(...times))}, max ${ms(Math.max(...times))}`,
  )
}

console.log(
  `vault: ${corpus.size} files, ${records} records, ${EDITS} one-file edits\n` +
    `runtime: bun ${Bun.version}\n`,
)
say("rebuild", rebuilt)
say("patch", patchedMs)
console.log(
  `\npatch is ${(median(rebuilt) / median(patchedMs)).toFixed(1)}× the rebuild's speed` +
    ` on one file's edit`,
)
const [asMap, asLayer] = walked([oracle, carried])
console.log(
  `byId read, one lookup per record: ${(asMap as number).toFixed(2)}ms rebuilt,` +
    ` ${(asLayer as number).toFixed(2)}ms patched`,
)
