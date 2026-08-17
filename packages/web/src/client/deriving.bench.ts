/**
 * What a keystroke costs the tab, before and after — the benchmark
 * `docs/brainstorming/model-indices.md`'s open question 5 asks each slice for,
 * for the one this slice changed.
 *
 * IT IS A LEG, NOT A FILE (`just bench`): slice 3 ran its vault as a one-off
 * and did not commit the harness, and a benchmark nothing runs is a benchmark
 * that rots. It is deliberately not part of `just check` — a timing that fails
 * a lane on a busy machine teaches nobody anything — so it is a recipe somebody
 * runs when they have changed the fold.
 *
 * WHAT IT MEASURES is the real path and not an idealised one. The entries are
 * written into a Solid store through the framework's own merge
 * (`@kolu/surface/solid`'s `writeWrappedValue`, which is `reconcile` with
 * `key: null` — the write every collection frame takes), so the records the
 * derivation walks are STORE PROXIES exactly as they are in a browser, and the
 * memo's dependency tracking is the tracking a page really pays. What is left
 * out is the paint: rows, DOM and layout are downstream of this value and
 * unchanged by this slice, so what is timed is the frame → view step, which is
 * the whole of what the slice touched.
 *
 * THREE ARMS over one vault, each in its own reactive root, all driven with the
 * same frames:
 *
 *   - `store` — the frame written and NOTHING derived from it. The merge is
 *     what both memos below pay before they are reached, and a number that
 *     cannot be attributed is a number an argument can be built on either way.
 *   - `rebuild` — the memo as it was: flatten every entry's nodes in path
 *     order, `derive` the corpus.
 *   - `fold` — the memo as it is: read each entry's `rev`, and patch the held
 *     view with the files whose number moved (`./deriving.ts`).
 *
 * RUN IT WITH `just bench`, which is `bun --conditions browser`. Without that
 * condition Bun resolves SolidJS's server build, where a memo is computed once
 * and never invalidated — every arm would then measure an empty loop and report
 * a magnificent number. The guard in {@link run} is what makes that a failure
 * rather than a result.
 */

import { derive, type Derived, type Located } from "@olai/format"
import { nodesOf, seeded } from "@olai/format/testlib"
import { writeWrappedValue } from "@kolu/surface/solid"
import { createMemo, createRoot } from "solid-js"
import { createStore } from "solid-js/store"

import { type Entry, type View, viewOf } from "./deriving.ts"
import { sortByPath } from "./paths.ts"

// ── the vault ──────────────────────────────────────────────────────────

/** One file's JSONL: a root and its children, some marked, a few naming each
 *  other and a few standing for a record in the file before them — a directory
 *  with the shapes a real one has, so the dirty set is not always one record. */
const fileOf = (random: () => number, at: number, records: number): string => {
  const lines: Array<string> = []
  const root = `f${at}r`
  lines.push(JSON.stringify({ id: root, ord: "a0", title: `file ${at}` }))
  for (let which = 1; which < records; which++) {
    const id = `f${at}n${which}`
    const record: Record<string, unknown> = {
      id,
      parent: root,
      ord: `a${which}`,
      title: `record ${which} of file ${at}`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.15) record["done"] = true
    if (which > 1 && random() < 0.1) record["after"] = [`f${at}n${which - 1}`]
    // A placement pointing into the file before this one, so a mark that flips
    // reaches a file the frame never named.
    if (at > 0 && random() < 0.05) {
      lines.push(
        JSON.stringify({ id: `${id}m`, parent: root, ord: `b${which}`, mirror: `f${at - 1}n1` }),
      )
    }
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 40)

const random = seeded(20260817)
/** Paths a directory really holds: mostly flat, some nested, and a few in a
 *  directory named after a file beside it — the pair the two readings of path
 *  order used to disagree about. */
const pathOf = (at: number): string => {
  const roll = random()
  if (roll < 0.2) return `area${at % 20}/note${at}.olai`
  if (roll < 0.24) return `area${at % 20}.olai`
  return `note${at}.olai`
}

const corpus = new Map<string, string>()
for (let at = 0; at < FILES; at++) {
  const path = pathOf(at)
  if (corpus.has(path)) continue
  corpus.set(path, fileOf(random, at, RECORDS))
}

const records = [...corpus.values()].reduce((total, text) => total + text.split("\n").length, 0)

// ── the store the client reads ─────────────────────────────────────────

/** The fold `@kolu/surface`'s `useCollectionDeltas` keeps: values by key, and
 *  the keys in arrival order. Rebuilt per frame with the unchanged entries
 *  carried over by reference, which is what makes `reconcile` leave them (and
 *  their records' object identity) alone. */
interface Fold {
  byKey: Record<string, Entry>
  order: Array<string>
}

const snapshot = (): Fold => {
  const byKey: Record<string, Entry> = Object.create(null) as Record<string, Entry>
  const order: Array<string> = []
  for (const [file, text] of corpus) {
    byKey[file] = { rev: 1, nodes: nodesOf(text, file) }
    order.push(file)
  }
  return { byKey, order }
}

interface Arm {
  /** A frame, written the way the framework writes one. */
  readonly write: (next: Fold) => void
  /** The memo read, which is where the derivation actually happens: a memo
   *  nothing observes is recomputed when it is asked for. */
  readonly read: () => unknown
  readonly first: Fold
}

/** One arm: a store fed the frames, and a memo of the given shape over it. */
const arm = (memoOf: (read: () => Fold | undefined) => () => unknown): Arm =>
  createRoot(() => {
    const [store, setStore] = createStore<{ v: Fold | undefined }>({ v: undefined })
    const memo = memoOf(() => store.v)
    return {
      write: (next: Fold) => writeWrappedValue(setStore, next),
      read: () => memo(),
      first: snapshot(),
    }
  })

/** NO MEMO AT ALL: the frame written into the store and nothing derived from
 *  it. What it measures is the merge every arm pays — `reconcile` walking the
 *  keys of the fold — so the two arms below can be read as "the frame, plus
 *  what the view costs on top of it" rather than as one number nobody can
 *  attribute. */
const merged = arm((read) => () => read())

/** The memo as it WAS: every entry's nodes, flattened in path order, and the
 *  whole corpus derived from scratch on any frame. */
const rebuild = arm((read) =>
  createMemo(() => {
    const fold = read()
    if (fold === undefined) return undefined
    return derive(sortByPath(fold.order).flatMap((file) => fold.byKey[file]?.nodes ?? []))
  })
)

/** The memo as it IS: a revision per file, and the held view patched with
 *  whatever moved. */
const folded = arm((read) =>
  createMemo((held: View | undefined) => {
    const fold = read()
    if (fold === undefined) return undefined
    return viewOf(held, fold.order, (file) => fold.byKey[file])
  }, undefined)
)

// ── the run ────────────────────────────────────────────────────────────

/** Which file edit `which` rewrites — asked by the edit and by the guard that
 *  reads the answer back, so the two cannot come to mean different files. */
const fileFor = (which: number): string =>
  [...corpus.keys()][which % corpus.size] as string

/** One edit: the title of one record in one file, as a whole new entry for that
 *  file at the next revision — which is exactly the frame a probe tick sends
 *  for one edited outline. */
const editOf = (previous: Fold, which: number): Fold => {
  const file = fileFor(which)
  const text = (corpus.get(file) as string).replace(
    /"title":"record 1 of file (\d+)"/,
    `"title":"edited ${which}"`,
  )
  const byKey = Object.assign(Object.create(null) as Record<string, Entry>, previous.byKey)
  byKey[file] = { rev: previous.byKey[file]!.rev + 1, nodes: nodesOf(text, file) }
  return { byKey, order: previous.order }
}

const median = (times: ReadonlyArray<number>): number =>
  [...times].sort((one, other) => one - other)[Math.floor(times.length / 2)] as number

/**
 * One arm, driven and timed.
 *
 * THE FRAME IS THE MEASUREMENT. A memo is recomputed when the write that
 * invalidated it finishes, not when a reader gets round to asking, so the whole
 * of "a file changed and this tab has a view of it again" is inside the write —
 * and the read that follows is timed anyway, because a read that is not free is
 * a memo that did not run and a number that means nothing.
 *
 * THE GUARD IS TWO CLAIMS, and the second is the one that matters. `records`
 * says the arm derived the corpus rather than nothing, which the FIRST frame
 * answers — and a first frame is answered even by SolidJS's server build, where
 * a memo is computed once at creation and never invalidated again. So every
 * frame after it is checked too: the edit rewrites one record's title to
 * `edited <n>`, and the arm has to say so. An arm whose memo stopped re-running
 * would go on reporting the corpus at its first revision, forty times, very
 * fast — which is precisely the magnificent number this benchmark must never
 * print.
 */
const run = (name: string, end: Arm, probe: Probe): void => {
  const startedFirst = performance.now()
  end.write(end.first)
  const first = end.read()
  const firstFrame = performance.now() - startedFirst
  if (probe.records(first) !== records) {
    throw new Error(
      `${name} answered for ${probe.records(first)} records of ${records}` +
        ` — the arm is not measuring what it says`,
    )
  }

  const frames: Array<number> = []
  let previous = end.first
  for (let which = 0; which < EDITS; which++) {
    const next = editOf(previous, which)
    previous = next
    const before = performance.now()
    end.write(next)
    const answer = end.read()
    frames.push(performance.now() - before)
    // Off the clock, and about the value the clock was just stopped on.
    const said = probe.edited(answer, fileFor(which))
    if (said !== `edited ${which}`) {
      throw new Error(
        `${name} still says ${said ?? "nothing"} after edit ${which}` +
          ` — the arm answered a frame it never recomputed`,
      )
    }
  }

  const say = (ms: number) => `${ms.toFixed(2)}ms`
  console.log(
    `${name.padEnd(8)} first frame ${say(firstFrame)}` +
      `   one-file edit: median ${say(median(frames))}` +
      `, mean ${say(frames.reduce((one, other) => one + other, 0) / frames.length)}` +
      `, min ${say(Math.min(...frames))}, max ${say(Math.max(...frames))}`,
  )
}

/**
 * What an arm is asked about its own answer: how much of the corpus is in it,
 * and what it says the edited record's title is now.
 *
 * Per arm, because the three answer with three shapes — the frame itself, a
 * `Derived`, a {@link View} — and the guard has to read each of them the way a
 * reader of that arm would.
 */
interface Probe {
  readonly records: (answer: unknown) => number
  readonly edited: (answer: unknown, file: string) => string | undefined
}

/** The title this edit wrote, read out of one file's records — `undefined` when
 *  the arm is still holding a revision that has not heard about it. */
const editedIn = (nodes: ReadonlyArray<Located>): string | undefined =>
  nodes
    .map((at) => (at.node as { readonly title?: string }).title)
    .find((title) => title?.startsWith("edited "))

const frameProbe: Probe = {
  records: (answer) =>
    Object.values((answer as Fold | undefined)?.byKey ?? {})
      .reduce((total, entry) => total + entry.nodes.length, 0),
  edited: (answer, file) => editedIn((answer as Fold | undefined)?.byKey[file]?.nodes ?? []),
}

const viewProbe: Probe = {
  records: (answer) => (answer as Derived | undefined)?.nodes.length ?? 0,
  edited: (answer, file) => editedIn((answer as Derived | undefined)?.byFile.get(file) ?? []),
}

const foldProbe: Probe = {
  records: (answer) => (answer as View | undefined)?.derived.nodes.length ?? 0,
  edited: (answer, file) =>
    editedIn((answer as View | undefined)?.derived.byFile.get(file) ?? []),
}

console.log(
  `vault: ${corpus.size} files, ${records} records, ${EDITS} one-file edits\n` +
    `runtime: ${
      process.versions.bun !== undefined ? `bun ${process.versions.bun}` : `node ${process.version}`
    }\n`,
)
run("store", merged, frameProbe)
run("rebuild", rebuild, viewProbe)
run("fold", folded, foldProbe)
