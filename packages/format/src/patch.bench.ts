/**
 * What ONE EDIT costs the view: patched against rebuilt, on a vault-sized
 * directory.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and that is the whole reason it
 * exists. Slice 3 of `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/model-indices.md` measured this pair
 * as a one-off on a laptop, quoted the ratio in `docs/architecture.md`, and did
 * not commit the harness — so the tree carried a number nobody could re-run,
 * and said so in the same breath ("one laptop sample that this tree cannot
 * reproduce", open question 5). This is that harness. Deliberately NOT part of
 * `just check`, for `./filter.bench.ts`'s reason: a timing that fails a lane on
 * a busy machine teaches nobody anything.
 *
 * THREE ARMS over one generated vault, driven with the same edits:
 *
 *   - `rebuild` — {@link derive} over the whole corpus, which is what the write
 *     gate cost before the patcher and what the patcher falls back to;
 *   - `patch` — {@link patched}, the incremental answer with the fallback taken
 *     OFF, so an arm that quietly declined would fail here rather than report
 *     the rebuild's number under the patcher's name;
 *   - `patch+residue` — the same patch paying the two corpus-sized costs it
 *     used to owe every edit, the `new Map(byId)` and the flat list, which is
 *     the before/after printed rather than quoted ({@link patching} states what
 *     it puts back and what it cannot).
 *
 * AND FOUR MEASUREMENTS UNDER THEM, because a claim this file did not print
 * would be the unreproducible laptop sample the paragraph above says it
 * retired. Two are about the layer rather than the patch:
 *
 *   - what the layer COSTS a reader — a corpus-wide walk of `byId` on each
 *     arm's own final view ({@link walked}). It times `get`, which is how every
 *     production caller reads this index; a whole-index spread pays one extra
 *     lookup per entry and nothing in the tree does one;
 *   - what the layer SAVES — the copy-on-write step timed both ways over the
 *     same edits, cloned against layered ({@link lever}), for a spread of files
 *     and for one file typed in, with the eight indexes that stay clones sized
 *     beside them.
 *
 * ...the third is what a TOUCHED KEY costs — the re-filing of one key timed as
 * a rebuild against a splice ({@link resorting}), on the biggest key each of
 * the four re-filed indexes has. It is the line `perf-key-resort` changed, and
 * it is on its own here for {@link lever}'s reason: the `patch` arm above pays
 * it on every edit, so what that arm's number does across the branch point is
 * the end-to-end figure and this is where it comes from.
 *
 * ...and the fourth is about the TAG INDEX's width: the corpus-wide fold timed
 * filing `@` alone against filing both sigils ({@link folds}), which is the
 * cost half of the trade `taggedBy` makes. The saving half is a leg of its own
 * beside it (`./vocabulary.bench.ts`), and the WALK under both — `titleParts`
 * in the three shapes it has been written in — is
 * {@link walks}, which exists because the figures for it were once quoted in a
 * comment and printed by nothing.
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
 * `./vocabulary.bench.ts` runs on, so the two benches' numbers are about one
 * directory. Size it with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
 * OLAI_BENCH_EDITS — and the last of those is worth turning up: the layer
 * flattens when it has grown past half the map, which forty edits over
 * twenty-record files come nowhere near. `OLAI_BENCH_EDITS=900` reaches it,
 * and {@link lever} prints the edit it happened at rather than leaving a reader
 * to work out whether it ever did.
 */

import {
  byCorpus,
  derive,
  type Derived,
  type Index,
  mayHoldTag,
  READ,
  tagInto,
  tagText,
  titleParts,
  titleTagRe,
} from "./derive.ts"
import {
  alternating,
  median,
  nodesOf,
  retitled,
  retitledIn,
  runtimeSaid,
  timed,
  timesSaid,
  vaultOf,
} from "./fixtures.testlib.ts"
import { heapStats } from "bun:jsc"

import { isRegular, type Located, type LocatedRegular } from "./node.ts"
import { overlay, type Read } from "./overlay.ts"
import { bySibling, patched, type SetDelta, spliced } from "./patch.ts"
import { byPath } from "./paths.ts"

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
  const records = nodesOf(retitled(corpus.get(file) as string, which), file)
  return { file, records, delta: { upserts: [[file, { nodes: records }]], removes: [] } }
}

const edits = Array.from({ length: EDITS }, (_, which) => editOf(which))

// ── the run ────────────────────────────────────────────────────────────

const first = derive(flat(parsed))
const records = first.nodes.length

/** The view the layered arm ends on, which the oracle below is compared with
 *  and the reader-walk is timed on. Assigned by {@link patching}. */
let carried = first

/** `new Map(byId)` and a `set` per arriving record — the expression
 *  {@link ./patch.ts}'s `ids` held before this branch, kept here because two
 *  arms below are about exactly what it costs. */
const cloned: CopyOnWrite = (base, changes) => {
  const next = new Map(base)
  for (const [id, at] of changes) next.set(id, at)
  return next
}

/** The two ways a patch can hand the id map forward, as one shape. */
type CopyOnWrite = (
  base: ReadonlyMap<string, Located>,
  changes: ReadonlyArray<readonly [string, Located]>,
) => ReadonlyMap<string, Located>

/** WHICH EDIT an arm says it is at, read back off the arm's OWN answer after
 *  every one of them — because an arm that stopped recomputing would otherwise
 *  go on reporting the first revision very fast, which is precisely the
 *  magnificent number a benchmark must never print. Its size is checked with
 *  it: an arm answering for the wrong corpus is not measuring what it says.
 *
 *  IT COUNTS THE GROUPING rather than reading the flat list, and that is not
 *  tidiness: `Derived.nodes` is built when somebody asks, so a fence that asked
 *  would make the `patch` arm allocate a corpus-sized array after every one of
 *  its forty edits — outside the timed window, but leaving the collector work
 *  the arm it is compared against never made. A fence must not be the thing
 *  that moves the number. */
const said = (name: string, view: Derived, which: number): void => {
  const found = retitledIn(view.byFile.get(fileFor(which)) ?? [])
  if (found !== which) {
    throw new Error(
      `${name} is at edit ${found ?? "none"} after edit ${which} — the arm` +
        ` answered a view it never recomputed`,
    )
  }
  let held = 0
  for (const own of view.byFile.values()) held += own.length
  if (held !== records) {
    throw new Error(
      `${name} answered for ${held} records of ${records}` +
        ` — the arm is not measuring what it says`,
    )
  }
}

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

/**
 * The patch, with the view carried forward: each edit lands on the view the one
 * before it left. A LOOP rather than the `map` the rebuild arm is, and the
 * difference is the measurement: that arm's forty answers are independent and
 * this one is a fold, which is the whole reason copy-on-write over a session is
 * visible here and not there.
 *
 * RUN TWICE, and the second run is the before/after rather than a claim about
 * it (#231, grok — a figure the harness cannot print is the unreproducible
 * sample this file exists to retire). `alsoResidue` puts back, inside the timed
 * window, the two corpus-sized costs a patch used to owe whatever the edit was:
 *
 *   - `new Map(byId)` and a `set` per arriving record, the exact expression
 *     {@link ./patch.ts}'s `ids` used to hold — carried forward as THAT index,
 *     so the arm patches against a plain `Map` every time and the layer is paid
 *     for and thrown away;
 *   - the FLAT LIST, which the spread below forces: {@link Derived.nodes} is
 *     built on demand now, and a whole-view spread asks for it. That is the same
 *     `[...byFile.values()].flat()` `regrouped` used to run on every patch, so
 *     it is in this arm by the same act that made it visible.
 *
 * The other six index clones are NOT here, and cannot faithfully be: the arm
 * would have to clone the layers this patcher produced, and `new Map(layer)`
 * walks a generator where the old code walked a plain map — an arm slower than
 * the thing it stands for by an amount that is about the reconstruction. What
 * they cost is {@link beside}, measured on its own.
 *
 * It is a reconstruction and the tree cannot make it more than one: a true A/B
 * would need two patchers in it, and a second patcher nothing runs is worse
 * than an arm whose approximations are stated. They are: the layers are built
 * and discarded (which {@link lever} prices at under a hundredth of a
 * millisecond), and the reads INSIDE the patch go through them rather than
 * through the plain maps the old code had (which {@link walked} prices at
 * nothing). Both make this arm slightly slower than the code it stands for, so
 * the saving it shows is a ceiling rather than a flattering floor.
 */
const patching = (name: string, alsoResidue: boolean): ReadonlyArray<number> => {
  const times: Array<number> = []
  let carrying = first
  for (const [which, { delta, records: own }] of edits.entries()) {
    const changes = own.map((at) => [at.node.id, at] as const)
    let next: Derived | undefined
    times.push(timed(() => {
      next = patched(carrying, delta)
      if (next !== undefined && alsoResidue) {
        next = { ...next, byId: cloned(carrying.byId, changes) }
      }
    }))
    if (next === undefined) {
      throw new Error(
        `${name} DECLINED edit ${which} — a benchmark of the incremental answer` +
          ` cannot be a benchmark of the rebuild it fell back to`,
      )
    }
    carrying = next
    said(name, carrying, which)
  }
  if (!alsoResidue) carried = carrying
  return times
}

// WARMED FIRST, both of them, and then measured. One of the two arms has to go
// first, and going first means paying for a JIT the other one then finds warm —
// which on this pair pushes the wrong way twice over: it inflates `patch`, the
// arm that runs first, against the `patch+residue` it is supposed to be cheaper
// than. A discarded round each is a tenth of a second and takes the question
// away. (The two reconstructions {@link patching} names still stand, and they
// push the other way: they make the clone arm slower than the code it stands
// for. What is left is a figure with a stated bias in one direction rather than
// two that cancel by luck.)
patching("patch", false)
patching("patch+residue", true)
const patchedMs = patching("patch", false)
const patchedResidueMs = patching("patch+residue", true)

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
/** Every claim the index makes, WITH THE RECORD — not the place alone. The edit
 *  under test is a title change, so a layer that dropped an earlier patch's
 *  entries would restore old titles at the very same `file:line` and a
 *  place-only comparison would wave it through (#231, grok). */
const claims = (view: Derived): string =>
  [...view.byId].map(([id, at]) => `${id}@${at.file}:${at.line} ${JSON.stringify(at.node)}`)
    .join("\n")
if (carried.nodes.length !== oracle.nodes.length || claims(carried) !== claims(oracle)) {
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
    const order = [...views.keys()]
    if (round % 2 === 1) order.reverse()
    const times: Array<number> = []
    for (const which of order) times[which] = once(views[which] as Derived)
    return times
  })
  return views.map((_, which) => median(rounds.map((round) => round[which] as number)))
}

// ── the lever itself ───────────────────────────────────────────────────

/**
 * THE COPY-ON-WRITE STEP, TIMED BOTH WAYS — the A/B this PR's own numbers rest
 * on, printed by the leg rather than quoted from a laptop (#231, grok: a figure
 * the committed harness cannot reproduce is the unreproducible sample this
 * whole file exists to retire, moved one file over).
 *
 * The two arms are the two spellings of one line in {@link ./patch.ts}'s `ids`,
 * given the real index and the real arriving records of each edit:
 *
 *   - `cloned` — `new Map(byId)` and then a `set` per arriving record, which is
 *     what a patch paid before this branch;
 *   - `layered` — {@link overlay}, which is what it pays now.
 *
 * CARRIED FORWARD, both of them, because the layer a patch is handed is the one
 * the patch before it left: the layer grows over a session and the clone never
 * does, and that difference is invisible to a run that does one edit. The two
 * are then compared whole, so an arm that got cheaper by answering differently
 * fails the run.
 *
 * IT IS THE STEP AND NOT THE WHOLE PATCH, which the `patch+residue` arm above
 * already shows: this one isolates the line, so the two can be read against
 * each other — the gap between those arms should be about what the `cloned`
 * number here is, and when it is not, one of them is measuring something else.
 * It also reaches the two things the arm above cannot: what the step costs when
 * the edits are ONE FILE typed in rather than a walk across the directory, and
 * WHICH EDIT the layer flattened at, if it did.
 */
const layered: CopyOnWrite = (base, changes) => {
  const held = overlay(base, "by key")
  for (const [id, at] of changes) held.set(id, at)
  return held.sealed()
}

/** One stream of edits, run through one strategy from the first view's index —
 *  the times per edit, what it ended holding, and every edit after which the
 *  answer was a plain `Map` again, which for the layer is where it flattened. */
const handedOn = (
  apply: CopyOnWrite,
  stream: ReadonlyArray<{ readonly records: ReadonlyArray<Located> }>,
): {
  readonly times: ReadonlyArray<number>
  readonly held: ReadonlyMap<string, Located>
  readonly flattenedAt: ReadonlyArray<number>
} => {
  let held: ReadonlyMap<string, Located> = first.byId
  const times: Array<number> = []
  const flattenedAt: Array<number> = []
  stream.forEach(({ records: own }, which) => {
    const changes = own.map((at) => [at.node.id, at] as const)
    times.push(timed(() => {
      held = apply(held, changes)
    }))
    if (held instanceof Map) flattenedAt.push(which)
  })
  return { times, held, flattenedAt }
}

/** THE SAME FILE EVERY TIME, which is what typing is — the case the layer's
 *  argument rests on and the one `fileFor` deliberately does not run, since a
 *  patch-vs-rebuild figure wants the harsher spread. Each edit re-sets the ids
 *  already in the layer, so it never grows and never flattens. */
const typing = Array.from(
  { length: EDITS },
  (_, which) => ({
    records: nodesOf(retitled(corpus.get(paths[0] as string) as string, which), paths[0] as string),
  }),
)

/** Both arms over one stream, in ALTERNATING ORDER for {@link walked}'s
 *  reason, compared whole at the end. */
const lever = (
  what: string,
  stream: ReadonlyArray<{ readonly records: ReadonlyArray<Located> }>,
): void => {
  handedOn(cloned, stream)
  handedOn(layered, stream)
  const rounds = Array.from({ length: 5 }, (_, round) => {
    const first = round % 2 === 0 ? cloned : layered
    const second = round % 2 === 0 ? layered : cloned
    const one = handedOn(first, stream)
    const other = handedOn(second, stream)
    return round % 2 === 0 ? [one, other] as const : [other, one] as const
  })
  const [asClone, asLayer] = [0, 1].map((which) =>
    median(rounds.map((round) => median(round[which as 0 | 1].times)))
  )
  const ends = rounds[0] as readonly [ReturnType<typeof handedOn>, ReturnType<typeof handedOn>]
  const sameAnswer = (one: ReadonlyMap<string, Located>, other: ReadonlyMap<string, Located>) =>
    one.size === other.size &&
    [...one].every(([id, at]) => other.get(id) === at) &&
    [...one.keys()].join("\n") === [...other.keys()].join("\n")
  if (!sameAnswer(ends[0].held, ends[1].held)) {
    throw new Error(
      `${what}: the cloned index and the layered one disagree after ${stream.length} edits` +
        ` — an arm that is cheaper by being wrong is not an arm`,
    )
  }
  const flattens = ends[1].flattenedAt
  console.log(
    `  ${what.padEnd(28)} ${(asClone as number).toFixed(3)}ms cloned,` +
      ` ${(asLayer as number).toFixed(3)}ms layered` +
      `   (layer flattened ${
        flattens.length === 0 ? "never" : `at ${flattens.map((at) => `edit ${at}`).join(", ")}`
      })`,
  )
}

/** The indexes a patch LAYERS, and the ones it still clones — READ OUT OF THE
 *  TABLE that decides it ({@link ./derive.ts}'s `READ`) rather than listed
 *  again here, so that an index changing sides changes one row and this leg
 *  follows it. A second list would be a second answer, and the arm's whole
 *  claim is that it prices what the patcher actually does. */
const sides = (which: Read): ReadonlyArray<Index> =>
  (Object.keys(READ) as ReadonlyArray<Index>).filter((index) => READ[index] === which)
const LAYERED = sides("by key")
const CLONED = sides("whole")

/**
 * THE ELEVEN INDEXES, CLONED — what a patch used to pay before a word from
 * every index's readers decided which of them needed to be, split into the
 * seven that are layered now and the four that are not.
 *
 * Measured as a pair rather than as two figures from two moments, for
 * {@link walked}'s reason — and measured ON THEIR OWN, which is what keeps this
 * a ceiling rather than a sum: an arm that allocates every map and drops them
 * leaves garbage a patch's own clones did not, and the ones read whole were
 * already skipped outright by an edit that named no key of them. What the pair
 * is for is the SHAPE of the residue, and the before/after inside a timed
 * window is the `patch+residue` arm above and the leg run against the branch
 * point.
 *
 * Both lists are spelled out rather than derived from the view's keys, because
 * the arm is "what a patch pays", and an index missing from them is a clone the
 * pair silently does not count.
 */
const beside = (): readonly [layered: number, cloned: number] => {
  const mapsIn = (keys: ReadonlyArray<Index>) =>
    keys.map((key) => first[key] as ReadonlyMap<string, unknown>)
  const wasLayered = mapsIn(LAYERED)
  const stayCloned = mapsIn(CLONED)
  const arms = [
    () => {
      for (const map of wasLayered) new Map(map)
    },
    () => {
      for (const map of stayCloned) new Map(map)
    },
  ] as const
  return alternating(arms)
}

/**
 * THE CORPUS READ FLAT, which a patch used to build and now hands on unbuilt —
 * one array per record in the directory, allocated on every write however small
 * the edit ({@link ./patch.ts}'s `flattened`, and the roadmap's
 * `perf-patch-residue`, which named this line).
 *
 * It is timed against the walk that ANSWERS the same question without the
 * array, because "it is lazy now" is only a saving if somebody actually
 * declines to ask: the duplicate-id gate at the top of a patch wanted a LENGTH,
 * and a length is a walk of the grouping.
 */
const flatly = (): readonly [built: number, counted: number] => {
  const byFile = first.byFile
  return alternating([
    () => {
      const flat = [...byFile.values()].flat()
      if (flat.length !== records) throw new Error("the flat list is not the corpus")
    },
    () => {
      let held = 0
      for (const own of byFile.values()) held += own.length
      if (held !== records) throw new Error("the count is not the corpus")
    },
  ] as const)
}

/**
 * WHAT A WHOLE-INDEX WALK COSTS THROUGH A LAYER — the measurement behind the
 * sealing rule, which is that an index read BY KEY gets a layer and an index
 * read WHOLE stays a map.
 *
 * `namedBy` is the one to time it on: the validator reads every entry of it on
 * every write ({@link ./validate.ts}'s `checkTargets`), so if a layer were free
 * to walk this index would be layered too. Both arms answer the same list of
 * pairs, checked before either is timed, and the layer is built the way a patch
 * builds one — a handful of keys re-filed over the map that stood.
 */
const wholly = (): readonly [asMap: number, asLayer: number] => {
  const base = first.namedBy
  const keys = [...base.keys()].slice(0, 20)
  const held = overlay(base, "by key")
  for (const key of keys) held.set(key, base.get(key) as NonNullable<ReturnType<typeof base.get>>)
  const layer = held.sealed()
  if (layer instanceof Map) throw new Error("the layer flattened — this measures one map twice")
  const sweep = (map: ReadonlyMap<string, unknown>) => () => {
    let seen = 0
    for (const [, namings] of map) seen += (namings as ReadonlyArray<unknown>).length
    return seen
  }
  const [one, other] = [sweep(base)(), sweep(layer)()]
  if (one !== other) throw new Error("the map and the layer walk to different answers")
  return alternating([sweep(base), sweep(layer)] as const)
}

// ── what an UNTOUCHED index costs ──────────────────────────────────────

/**
 * THE CARRY ITSELF, TIMED BOTH WAYS — the A/B `perf-overlay-copies` rests on,
 * and it is a leg for {@link lever}'s reason.
 *
 * A patch opens every index of the view and writes to the ones its edit
 * reached. What the others cost is the subject: the overlay used to copy its
 * carried layer's three structures in the CONSTRUCTOR and hand the layer
 * straight back at the sealing, so an index no key of the edit reached paid
 * three copies of bookkeeping that was then thrown away untouched. It copies at
 * the first WRITE now, so it pays nothing.
 *
 * The two arms are the two spellings of that constructor, over a layer grown to
 * the BOUND the module flattens at — half the map — which is the most any
 * carried layer can hold and therefore the ceiling on what one can cost:
 *
 *   - `eager` — the overlay as it is, plus the three copies its constructor used
 *     to take. A RECONSTRUCTION, for {@link cloned}'s reason: the constructor it
 *     stands for is gone, and a before/after this harness cannot print is the
 *     laptop sample this file exists to retire. It is faithful because the layer
 *     is built HERE — every write below re-sets a key `byId` already had, so its
 *     `changed` holds the half and its `appended` and `gone` are empty, which is
 *     what the two `Set`s copy;
 *   - `lazy` — `overlay(layer, "by key").sealed()`, which is what a patch pays
 *     now. It must hand back the very layer it was given, and that is checked
 *     before either arm is timed: an arm that returned an equal layer would be
 *     an arm that wrote.
 *
 * AND WHAT EACH ONE ALLOCATES, counted rather than timed, because the time is
 * an amount of copying and the count is the copying itself. Counted by
 * retaining what the arm made, which is what makes the number exact: a
 * collector running mid-count would report a fact about the collector.
 * Only `Map` and `Set` are counted, so the tuple the eager arm returns its three
 * copies in — the one allocation this reconstruction has that the constructor
 * did not — is not counted and, at a half-corpus copy each, is not timed either.
 */
const KEPT = 20

const unwritten = (): void => {
  const base = first.byId
  const ids = [...base.keys()]
  const half = ids.slice(0, Math.floor(ids.length / 2))
  const growing = overlay(base, "by key")
  for (const id of half) growing.set(id, base.get(id) as Located)
  const layer = growing.sealed()
  if (layer instanceof Map) {
    throw new Error("the layer flattened — this would measure a map and call it a carry")
  }
  /** The three the constructor used to copy, in the shape it copied them. */
  const changed = new Map(half.map((id) => [id, base.get(id) as Located]))
  const appended = new Set<string>()
  const gone = new Set<string>()
  const eager = () => {
    const held = overlay(layer, "by key")
    const three = [new Map(changed), new Set(appended), new Set(gone)] as const
    held.sealed()
    return three
  }
  const lazy = () => overlay(layer, "by key").sealed()
  if (lazy() !== layer) {
    throw new Error("the lazy arm did not hand its layer back — it wrote to something")
  }
  // WHAT THE RECONSTRUCTION ASSUMES, asked of the LAYER rather than of itself.
  // The eager arm hand-builds the three the constructor used to copy, and the
  // two empty ones are only right because every write above re-set a key
  // `base` already had: a key it lacked would have gone into the layer's
  // `appended` and moved its size, and the arm would then be copying two empty
  // sets where the constructor copied one holding something. `size` is the
  // arithmetic that says so from outside — `base.size - gone.size +
  // appended.size` — and it is the only reading of those two `Layer` keeps that
  // does not need them exported. Asking the arm whether its own `new
  // Map(changed)` came out the size of `changed` was the fence here before, and
  // it could not fail (#392, pi).
  if (layer.size !== base.size) {
    throw new Error(
      `the layer holds ${layer.size} of ${base.size} keys — it added or dropped one,` +
        " so the empty sets this arm copies are not the ones the constructor did",
    )
  }
  const [asEager, asLazy] = alternating([eager, lazy] as const)
  const made = (arm: () => unknown): { readonly maps: number; readonly sets: number } => {
    const kept: Array<unknown> = []
    Bun.gc(true)
    const before = heapStats().objectTypeCounts
    for (let round = 0; round < KEPT; round++) kept.push(arm())
    const after = heapStats().objectTypeCounts
    if (kept.length !== KEPT) throw new Error("the count dropped what it was keeping")
    const each = (what: "Map" | "Set") => ((after[what] ?? 0) - (before[what] ?? 0)) / KEPT
    return { maps: each("Map"), sets: each("Set") }
  }
  const [eagerMade, lazyMade] = [made(eager), made(lazy)]
  console.log(
    `  a layer of ${changed.size} over ${base.size} keys, carried and not written:` +
      ` ${asEager.toFixed(3)}ms eager, ${asLazy.toFixed(3)}ms lazy` +
      ` (${eagerMade.maps} map + ${eagerMade.sets} sets against` +
      ` ${lazyMade.maps} + ${lazyMade.sets}, per index per patch)`,
  )
}

/**
 * ...AND HOW OFTEN A CARRY IS ALL A PATCH DOES TO AN INDEX, which is where the
 * ceiling above lands.
 *
 * Read off the patcher's own answers rather than out of it: an index no write
 * reached is handed back BY IDENTITY ({@link ./overlay.ts}'s sealing rule), so
 * whether a patch wrote to one is a `===` against the view it started from, and
 * this leg does not have to be told. Beside it the index's SIZE, since the
 * layer that was being copied is bounded by half of it.
 *
 * It says what the A/B above cannot: `byId` is written by every edit and never
 * pays a carry, while `blocked` on this vault is carried untouched by nearly
 * all of them. A vault's own shape decides that, which is why this is a count
 * over the same edits the arms above run rather than a claim.
 */
const untouched = (): void => {
  const never = new Map<Index, number>()
  let view = first
  for (const [which, { delta }] of edits.entries()) {
    const next = patched(view, delta)
    if (next === undefined) throw new Error(`the patcher declined edit ${which}`)
    for (const index of LAYERED) {
      const was = view[index] as ReadonlyMap<string, unknown>
      if ((next[index] as ReadonlyMap<string, unknown>) === was) {
        never.set(index, (never.get(index) ?? 0) + 1)
      }
    }
    view = next
  }
  for (const index of LAYERED) {
    const held = (view[index] as ReadonlyMap<string, unknown>).size
    console.log(
      `  ${index.padEnd(10)} ${String(held).padStart(6)} keys —` +
        ` carried without a write on ${never.get(index) ?? 0} of ${EDITS} edits`,
    )
  }
}

// ── what a TOUCHED KEY costs ───────────────────────────────────────────

/**
 * THE RE-FILING OF ONE KEY, TIMED BOTH WAYS — the A/B `perf-key-resort` rests
 * on, and the reason it is a leg rather than a sentence.
 *
 * The two arms are the two spellings of one line in {@link ./patch.ts}'s
 * `refiled`, given a real key of a real index and the real members one file
 * takes out of it and puts back:
 *
 *   - `rebuild` — what survives the touched file, then whatever arrived,
 *     sorted. What a patch paid before this branch, for EVERY key an edit
 *     reached;
 *   - `splice` — {@link spliced}, which takes the departing members out of the
 *     list that stood and binary-searches the arriving ones back in.
 *
 * ON THE BIGGEST KEY EACH INDEX HAS, because that is the whole subject: a key
 * with three members costs the same either way and a key with three hundred is
 * a keystroke paying for the directory. The vault's `#area` tags are written by
 * a twentieth of the corpus each, its busiest day by a scatter of records
 * across many files, and its biggest parent by one file's rows — three shapes,
 * two of which span files nobody touched.
 *
 * IT IS THE STEP AND NOT THE WHOLE PATCH, exactly as {@link lever} is: the
 * `patch` arm above already pays this on every edit (the fold re-files every
 * key the touched file's records reach, not only the edited record's), so what
 * that arm's number does across the branch point is the end-to-end figure and
 * this is the line it came from.
 *
 * REPEATED INSIDE THE TIMED WINDOW, because one splice of a three-hundred
 * member key is tens of microseconds and `Bun.nanoseconds` around a single call
 * would be measuring the call.
 */
const REPEATS = 200

const resorting = <T>(
  what: string,
  index: ReadonlyMap<string, ReadonlyArray<T>>,
  at: (one: T) => Located,
  order: (one: Located, other: Located) => number,
): void => {
  const [key, held] = biggest(index)
  // The file that holds the key's FIRST member — one real file of the several a
  // popular key spans, and the one an edit would be typed into.
  const file = at(held[0] as T).file
  const left = (one: T): boolean => at(one).file === file
  const arriving = held.filter(left)
  const inOrder = (one: T, other: T): number => order(at(one), at(other))
  const arms = [
    () => {
      for (let round = 0; round < REPEATS; round++) {
        [...held.filter((one) => !left(one)), ...arriving].sort(inOrder)
      }
    },
    () => {
      for (let round = 0; round < REPEATS; round++) spliced(held, arriving, left, inOrder)
    },
  ] as const
  // An arm that is cheaper by answering differently is not an arm — the same
  // fence {@link lever} puts on the copy-on-write pair, checked before either
  // is timed.
  const said = (own: ReadonlyArray<T>): string =>
    own.map((one) => `${at(one).file}:${at(one).line}`).join("|")
  const asRebuilt = said([...held.filter((one) => !left(one)), ...arriving].sort(inOrder))
  if (asRebuilt !== said(spliced(held, arriving, left, inOrder))) {
    throw new Error(`${what}: the rebuilt key and the spliced one are not the same key`)
  }
  const [rebuild, splice] = alternating(arms)
  console.log(
    `  ${what.padEnd(12)} \`${key}\``.padEnd(34) +
      ` ${held.length} members, ${arriving.length} from the touched file:` +
      ` ${((rebuild as number) / REPEATS * 1000).toFixed(1)}µs rebuilt,` +
      ` ${((splice as number) / REPEATS * 1000).toFixed(1)}µs spliced`,
  )
}

/** The key an index holds the most of — what a keystroke near a popular key
 *  is a keystroke near. */
const biggest = <T>(
  index: ReadonlyMap<string, ReadonlyArray<T>>,
): readonly [string, ReadonlyArray<T>] => {
  let found: readonly [string, ReadonlyArray<T>] = ["", []]
  for (const entry of index) if (entry[1].length > found[1].length) found = entry
  if (found[1].length === 0) throw new Error("the vault holds no key to re-file")
  return found
}

// ── what the tag index's WIDTH costs ───────────────────────────────────

/**
 * THE FOLD, TIMED BOTH WAYS: the tag index filed under one sigil against under
 * both — the corpus-wide half of the trade the `taggedBy` branch was asked to
 * measure (`mentions-index-one-sigil`, deferred at #237 precisely because
 * nobody had).
 *
 * The narrow arm is a RECONSTRUCTION of the fold as it was, kept here for the
 * reason {@link cloned} is kept: a before/after this harness cannot print is
 * the unreproducible laptop sample this file exists to retire. What it costs a
 * READER to have the wider index is `./vocabulary.bench.ts`, which prints the
 * other half of the same trade.
 *
 * IT IS THE FOLD AND NOT THE WHOLE DERIVE, on purpose: the rest of `derive` is
 * byte-identical across the change, so a rebuild-vs-rebuild figure would put
 * this difference inside forty milliseconds of unrelated work and two noisy
 * machines apart. What is timed is every record of the vault filed, which is
 * exactly what a rebuild pays and forty times what one patched edit does.
 */
const folds = (): readonly [narrow: number, wide: number] => {
  const arms = [
    () => {
      const index = new Map<string, Array<LocatedRegular>>()
      for (const at of first.nodes) mentionOnlyInto(index, at)
      return index
    },
    () => {
      const index = new Map<string, Array<LocatedRegular>>()
      for (const at of first.nodes) tagInto(index, at)
      return index
    },
  ] as const
  // The wide arm files every key the narrow one does, and more; an arm that
  // had quietly stopped filing anything would report a magnificent number.
  const narrow = arms[0]()
  const wide = arms[1]()
  if (narrow.size === 0) {
    throw new Error("the vault holds no `@` prose — the narrow arm measures nothing")
  }
  if (wide.size <= narrow.size) {
    throw new Error("the wide arm files no more keys than the narrow one — check the vault")
  }
  return alternating(arms)
}

/**
 * The `@`-only fold, as {@link ./derive.ts} spelled it before `taggedBy` — the
 * expression the arm above is the before of.
 *
 * A private copy, and it may not be shared with the module it stands for: that
 * module now has one fold and this is the one it replaced.
 *
 * HELD TO THE SHAPE OF THE ONE IT STANDS FOR, down to what it allocates, so
 * that the two arms differ in exactly one thing — how many sigils the walk
 * claims. That is not a tidiness rule here, it is the measurement: the first
 * spelling of this looped over `[title, desc ?? ""]`, which is an array per
 * record that {@link tagInto} does not build and an empty string walked for
 * every record with no note. It made the BEFORE arm slower and so made the
 * second sigil look cheaper than it is. Two statements now, as next door, and
 * a note is not read when there is none.
 */
const mentionOnlyInto = (
  index: Map<string, Array<LocatedRegular>>,
  located: Located,
): void => {
  if (!isRegular(located)) return
  mentionsFrom(index, located, located.node.title)
  if (located.node.desc !== undefined) mentionsFrom(index, located, located.node.desc)
}

/** One string of one record's prose, filed under every `@word` it holds —
 *  {@link mentionOnlyInto}'s inner half, which is one function here because the
 *  fold it stands for asks it of a title and of a note. */
const mentionsFrom = (
  index: Map<string, Array<LocatedRegular>>,
  regular: LocatedRegular,
  text: string,
): void => {
  if (!text.includes("@")) return
  for (const part of titleParts(text)) {
    if (part.kind !== "tag" || part.sigil !== "@") continue
    const held = index.get(part.tag)
    if (held === undefined) index.set(part.tag, [regular])
    else if (held[held.length - 1] !== regular) held.push(regular)
  }
}

// ── ...and what the WALK under it costs, three ways ────────────────────

/**
 * THE TAG WALK ITSELF, timed in the three shapes it has been written in — the
 * pair of figures {@link ./derive.ts}'s `titleParts` and `writtenTagsIn` used
 * to quote from a laptop, printed by the leg instead (both reviewers of #249
 * asked for exactly this, and they were right: a number in a comment that no
 * harness prints is the unreproducible sample this whole file exists to
 * retire).
 *
 * Over every string of prose in the corpus, since that is what a rebuild walks:
 *
 *   - `parts` — {@link titleParts} as it is, stepping one fresh `/g` regex with
 *     `exec`;
 *   - `matchAll` — the same function as it stood before #249, asking the regex
 *     for an iterator per call. That is the rewrite the PR made on the way past
 *     and the one this pair exists to justify — it is a GLOBAL change, since
 *     the search matcher and the browser's two renderings of a pill walk the
 *     same function;
 *   - `loop` — the shape this file's own note REJECTS: a private walk over
 *     {@link titleTagRe}, which would not allocate the prose between the tags
 *     and would take the written form off the match. It is timed so that the
 *     rejection stays a measurement rather than a memory.
 *
 * ALL THREE MUST FIND THE SAME TAGS, checked over the whole corpus before
 * anything is timed: two of them build parts and one builds only the written
 * forms, so what is compared is what a fold would take out of each.
 */
const walks = (): { parts: number; matchAll: number; loop: number } => {
  const prose: Array<string> = []
  for (const at of first.nodes) {
    if (!isRegular(at)) continue
    prose.push(at.node.title)
    if (at.node.desc !== undefined) prose.push(at.node.desc)
  }

  /** What a fold takes out of a walk: the written tags, in order. */
  const viaParts = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      for (const part of titleParts(text)) if (part.kind === "tag") found.push(tagText(part))
    }
    return found
  }
  /** {@link titleParts} as it was: `matchAll` per call, same parts out. */
  const viaMatchAll = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      let at = 0
      const parts: Array<{ kind: "text" | "tag"; written?: string }> = []
      for (const match of text.matchAll(titleTagRe())) {
        const start = match.index
        if (start > at) parts.push({ kind: "text" })
        parts.push({ kind: "tag", written: match[0] })
        at = start + match[0].length
      }
      if (at < text.length) parts.push({ kind: "text" })
      for (const part of parts) if (part.written !== undefined) found.push(part.written)
    }
    return found
  }
  /**
   * The private loop, which is the one this tree declines to have — stepping
   * the regex exactly as {@link titleParts} does, so the ONLY difference is
   * what it declines to build: no part per segment of prose, and the written
   * form taken off the match rather than re-assembled. A loop written with
   * `matchAll` would be measuring the rewrite above a second time and calling
   * it the loop's cost.
   */
  const viaLoop = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      const tags = titleTagRe()
      let match: RegExpExecArray | null
      while ((match = tags.exec(text)) !== null) found.push(match[0])
    }
    return found
  }

  const answers = [viaParts(), viaMatchAll(), viaLoop()].map((tags) => tags.join(" "))
  if (answers[0] === "" ) throw new Error("the vault's prose holds no tags — this measures nothing")
  if (answers[0] !== answers[1] || answers[0] !== answers[2]) {
    throw new Error("the three walks disagree about the corpus's tags — none of them is a number")
  }
  // Two pairs rather than one three-way: `alternating` fairly compares two arms
  // at a time, and the two questions are separate — what the rewrite bought,
  // and what the rejected shape would buy on top of it.
  const [parts, matchAll] = alternating([viaParts, viaMatchAll])
  const [again, loop] = alternating([viaParts, viaLoop])
  return { parts: median([parts, again]), matchAll, loop }
}

const say = (name: string, times: ReadonlyArray<number>): void => {
  console.log(timesSaid(name, times, 14))
}

console.log(
  `vault: ${corpus.size} files, ${records} records, ` +
    `${EDITS} one-file edits, each to a different file\n` +
    `${runtimeSaid()}\n`,
)
say("rebuild", rebuilt)
say("patch+residue", patchedResidueMs)
say("patch", patchedMs)
console.log(
  `\npatch is ${(median(rebuilt) / median(patchedMs)).toFixed(1)}× the rebuild's speed` +
    ` on one file's edit, and ${
      (median(patchedResidueMs) / median(patchedMs)).toFixed(1)
    }× the same patch paying the corpus-sized residue it used to owe`,
)
const [asMap, asLayer] = walked([oracle, carried])
console.log(
  `byId read, one lookup per record: ${(asMap as number).toFixed(2)}ms rebuilt,` +
    ` ${(asLayer as number).toFixed(2)}ms patched`,
)
console.log(`\nthe id map handed forward, per edit:`)
lever("a different file each time", edits)
lever("the same file every time", typing)
console.log(`\nthe index handed on and NOT written, per index per edit:`)
unwritten()
untouched()
console.log(`\nthe biggest key of each re-filed index, across one file's edit:`)
resorting("taggedBy", first.taggedBy, (one) => one, byCorpus)
resorting("byDay", first.byDay, (one) => one.at, byCorpus)
resorting("children", first.children, (one) => one, bySibling)
resorting("namedBy", first.namedBy, (one) => one.at, byCorpus)
const [wasLayered, stayCloned] = beside()
console.log(
  `\nthe indexes, cloned on their own: ${wasLayered.toFixed(3)}ms for the ${LAYERED.length}` +
    ` a patch layers now, ${stayCloned.toFixed(3)}ms for the ${CLONED.length} it still clones` +
    ` — the residue this took off, against what is left`,
)
const [flatBuilt, flatCounted] = flatly()
console.log(
  `the corpus read flat: ${flatBuilt.toFixed(3)}ms to build the list a patch used to hand on,` +
    ` ${flatCounted.toFixed(3)}ms to walk the grouping for the length it wanted it for`,
)
const [wholeMap, wholeLayer] = wholly()
console.log(
  `namedBy walked whole: ${wholeMap.toFixed(3)}ms as a map, ${wholeLayer.toFixed(3)}ms` +
    ` through a layer — which is why the four read whole are not layered`,
)
const [narrowFold, wideFold] = folds()
console.log(
  `\nthe tag fold over the whole corpus: ${narrowFold.toFixed(2)}ms filing \`@\` alone,` +
    ` ${wideFold.toFixed(2)}ms filing both sigils` +
    ` — the width this index pays per REBUILD (${first.taggedBy.size} keys)`,
)
const walked3 = walks()
console.log(
  `the tag walk over the same prose: ${walked3.parts.toFixed(2)}ms as \`titleParts\` is` +
    ` (\`exec\`), ${walked3.matchAll.toFixed(2)}ms as it was (\`matchAll\`),` +
    ` ${walked3.loop.toFixed(2)}ms for the private loop this tree declines to have`,
)
