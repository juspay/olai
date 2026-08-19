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
 * THREE ARMS over one generated vault, driven with the same edits:
 *
 *   - `rebuild` — {@link derive} over the whole corpus, which is what the write
 *     gate cost before the patcher and what the patcher falls back to;
 *   - `patch` — {@link patched}, the incremental answer with the fallback taken
 *     OFF, so an arm that quietly declined would fail here rather than report
 *     the rebuild's number under the patcher's name;
 *   - `patch+clone` — the same patch paying the `new Map(byId)` this branch
 *     replaced, which is this PR's own before/after printed rather than quoted
 *     ({@link patching} states the two ways it is a reconstruction).
 *
 * AND THREE MEASUREMENTS UNDER THEM, because a claim this file did not print
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
 * ...and the third is about the TAG INDEX's width: the corpus-wide fold timed
 * filing `@` alone against filing both sigils ({@link folds}), which is the
 * cost half of the trade `taggedBy` makes. The saving half is a leg of its own
 * one package up (`@olai/web`'s `complete/tags.bench.ts`).
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
 * OLAI_BENCH_EDITS — and the last of those is worth turning up: the layer
 * flattens when it has grown past half the map, which forty edits over
 * twenty-record files come nowhere near. `OLAI_BENCH_EDITS=900` reaches it,
 * and {@link lever} prints the edit it happened at rather than leaving a reader
 * to work out whether it ever did.
 */

import { derive, type Derived, tagInto, titleParts } from "./derive.ts"
import {
  alternating,
  median,
  nodesOf,
  retitled,
  retitledIn,
  timed,
  timesSaid,
  vaultOf,
} from "./fixtures.testlib.ts"
import { isRegular, type Located, type LocatedRegular } from "./node.ts"
import { overlaid } from "./overlay.ts"
import { patched, type SetDelta } from "./patch.ts"
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
 *  it: an arm answering for the wrong corpus is not measuring what it says. */
const said = (name: string, view: Derived, which: number): void => {
  const found = retitledIn(view.byFile.get(fileFor(which)) ?? [])
  if (found !== which) {
    throw new Error(
      `${name} is at edit ${found ?? "none"} after edit ${which} — the arm` +
        ` answered a view it never recomputed`,
    )
  }
  if (view.nodes.length !== records) {
    throw new Error(
      `${name} answered for ${view.nodes.length} records of ${records}` +
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
 * RUN TWICE, and the second run is this PR's before/after rather than a claim
 * about it (#231, grok — a figure the harness cannot print is the
 * unreproducible sample this file exists to retire). `alsoCloned` adds, inside
 * the timed window, the exact expression {@link ./patch.ts}'s `ids` used to
 * hold — `new Map(byId)` and a `set` per arriving record — and carries THAT
 * index forward, so the arm patches against a plain `Map` every time and the
 * layer is paid for and thrown away.
 *
 * It is a reconstruction and the tree cannot make it more than one: a true A/B
 * would need two patchers in it, and a second patcher nothing runs is worse
 * than an arm whose two approximations are stated. They are: the layer is built
 * and discarded (which {@link lever} prices at under a hundredth of a
 * millisecond), and the reads INSIDE the patch go through it rather than
 * through the plain map the old code had (which {@link walked} prices at
 * nothing). Both make this arm slightly slower than the code it stands for, so
 * the saving it shows is a ceiling rather than a flattering floor.
 */
const patching = (name: string, alsoCloned: boolean): ReadonlyArray<number> => {
  const times: Array<number> = []
  let carrying = first
  for (const [which, { delta, records: own }] of edits.entries()) {
    const changes = own.map((at) => [at.node.id, at] as const)
    let next: Derived | undefined
    times.push(timed(() => {
      next = patched(carrying, delta)
      if (next !== undefined && alsoCloned) next = { ...next, byId: cloned(carrying.byId, changes) }
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
  if (!alsoCloned) carried = carrying
  return times
}

// WARMED FIRST, both of them, and then measured. One of the two arms has to go
// first, and going first means paying for a JIT the other one then finds warm —
// which on this pair pushes the wrong way twice over: it inflates `patch`, the
// arm that runs first, against the `patch+clone` it is supposed to be cheaper
// than. A discarded round each is a tenth of a second and takes the question
// away. (The two reconstructions {@link patching} names still stand, and they
// push the other way: they make the clone arm slower than the code it stands
// for. What is left is a figure with a stated bias in one direction rather than
// two that cancel by luck.)
patching("patch", false)
patching("patch+clone", true)
const patchedMs = patching("patch", false)
const patchedCloneMs = patching("patch+clone", true)

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
 *   - `layered` — {@link overlaid}, which is what it pays now.
 *
 * CARRIED FORWARD, both of them, because the layer a patch is handed is the one
 * the patch before it left: the layer grows over a session and the clone never
 * does, and that difference is invisible to a run that does one edit. The two
 * are then compared whole, so an arm that got cheaper by answering differently
 * fails the run.
 *
 * IT IS THE STEP AND NOT THE WHOLE PATCH, which the `patch+clone` arm above
 * already shows: this one isolates the line, so the two can be read against
 * each other — the gap between those arms should be about what the `cloned`
 * number here is, and when it is not, one of them is measuring something else.
 * It also reaches the two things the arm above cannot: what the step costs when
 * the edits are ONE FILE typed in rather than a walk across the directory, and
 * WHICH EDIT the layer flattened at, if it did.
 */
const layered: CopyOnWrite = (base, changes) => overlaid(base, changes)

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

/**
 * `byId` cloned, against all NINE other indexes cloned together — the number
 * behind "`byId` is the one that gets a layer", measured as a pair rather than
 * as two figures from two moments, for {@link walked}'s reason.
 *
 * Clones on both sides, because the nine are what the patcher GOES ON doing:
 * eight of them delete keys across a patch, which a layer keeping the base's
 * key set cannot, and the one that does not is walked whole by the validator.
 *
 * `taggedBy` joined the list when it joined the view, and it is named here
 * rather than left out because the arm is "what a patch still pays": an index
 * missing from it is a clone the pair silently does not count.
 */
const beside = (): readonly [byId: number, others: number] => {
  const others = (["children", "status", "after", "blocked", "byFile", "mirrorsOf", "edgesTo",
    "namedBy", "taggedBy"] as const).map((key) => first[key] as ReadonlyMap<string, unknown>)
  const arms = [
    () => {
      new Map(first.byId)
    },
    () => {
      for (const map of others) new Map(map)
    },
  ] as const
  return alternating(arms)
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
 * READER to have the wider index is `@olai/web`'s `complete/tags.bench.ts`,
 * which prints the other half of the same trade.
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

const say = (name: string, times: ReadonlyArray<number>): void => {
  console.log(timesSaid(name, times, 12))
}

console.log(
  `vault: ${corpus.size} files, ${records} records, ` +
    `${EDITS} one-file edits, each to a different file\n` +
    `runtime: bun ${Bun.version}\n`,
)
say("rebuild", rebuilt)
say("patch+clone", patchedCloneMs)
say("patch", patchedMs)
console.log(
  `\npatch is ${(median(rebuilt) / median(patchedMs)).toFixed(1)}× the rebuild's speed` +
    ` on one file's edit, and ${
      (median(patchedCloneMs) / median(patchedMs)).toFixed(1)
    }× the same patch with the clone this branch replaced`,
)
const [asMap, asLayer] = walked([oracle, carried])
console.log(
  `byId read, one lookup per record: ${(asMap as number).toFixed(2)}ms rebuilt,` +
    ` ${(asLayer as number).toFixed(2)}ms patched`,
)
console.log(`\nthe id map handed forward, per edit:`)
lever("a different file each time", edits)
lever("the same file every time", typing)
const [byIdClone, othersClone] = beside()
console.log(
  `\none clone of each index: ${byIdClone.toFixed(3)}ms for byId,` +
    ` ${othersClone.toFixed(3)}ms for all nine others together` +
    ` — which is the work a patch still does`,
)
const [narrowFold, wideFold] = folds()
console.log(
  `\nthe tag fold over the whole corpus: ${narrowFold.toFixed(2)}ms filing \`@\` alone,` +
    ` ${wideFold.toFixed(2)}ms filing both sigils` +
    ` — the width this index pays per REBUILD (${first.taggedBy.size} keys)`,
)
