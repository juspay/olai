import { expect, test } from "bun:test"

import { derive, type Row, rowsOf } from "./derive.ts"
import {
  keeping,
  matchedIn,
  matching,
  parseFilter,
  type Refusal,
  shownRecord,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

/** One corpus, standing in for a directory: marks, dates, notes, edges, tags,
 *  a mirror, and an archive beside it. Every assertion below is about this. */
const CORPUS = {
  "house.jsonl": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","desc":"walnut or birch","after":["demo"],"see":["herbs"]}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","doc":"finishes.md"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":"2026-08-11"}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  ].join("\n"),
  "garden.jsonl": [
    `{"id":"garden","ord":"a0","title":"garden #outdoors"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #home","doing":true}`,
    `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}`,
  ].join("\n"),
  "Archive.jsonl": [
    `{"id":"gone","ord":"a0","title":"the old kitchen table #home","done":"2026-06-01"}`,
  ].join("\n"),
}

const derived = derive(nodesOfFiles(CORPUS))

/** The ids a query selects, in the set's own order. */
const selects = (text: string): ReadonlyArray<string> =>
  matching(derived, parseFilter(text)).map(({ at }) => at.node.id)

// ── the grammar ────────────────────────────────────────────────────────

// The three states a query can be in, and they are three different things to
// DO: draw the page whole, draw nothing and say why, or ask.
test("nothing typed, refused, and asking are told apart", () => {
  expect(parseFilter("").kind).toBe("nothing")
  expect(parseFilter("   ").kind).toBe("nothing")
  expect(parseFilter("is:done").kind).toBe("asking")
  expect(parseFilter("is:blocked").kind).toBe("refused")
  expect(selects("is:blocked")).toEqual([])
})

test("words are case-folded substrings, and every one must be in the same node", () => {
  expect(selects("CABINETS")).toEqual(["order", "install"])
  expect(selects("cabinets order")).toEqual(["order"])
  expect(selects("cabinets herbs")).toEqual([])
})

test("a tag is found bare and as written", () => {
  expect(selects("#home")).toEqual(["kitchen", "hinges", "herbs"])
  // Bare, so it also reaches the word wherever else it appears.
  expect(selects("home")).toEqual(["kitchen", "hinges", "herbs"])
  expect(selects("#outdoors")).toEqual(["garden"])
})

test("`is:` reads the mark the node STORES, never a derived one", () => {
  expect(selects("is:done")).toEqual(["demo", "basil"])
  expect(selects("is:doing")).toEqual(["kitchen", "order", "herbs"])
  expect(selects("is:todo")).toEqual(["hinges"])
  // `install` has a done child and no mark of its own: a bullet is not a task,
  // and a rollup is not a status.
  expect(selects("is:marked")).toEqual([
    "kitchen",
    "demo",
    "order",
    "hinges",
    "herbs",
    "basil",
  ])
})

test("`has:` asks what the record carries, and an empty edge list is no edge", () => {
  expect(selects("has:desc")).toEqual(["order"])
  expect(selects("has:doc")).toEqual(["install"])
  expect(selects("has:see")).toEqual(["order"])
  expect(selects("has:after")).toEqual(["order"])
})

test("`date:` reads the two dates a journal reads — scheduled, and finished", () => {
  // `order` is scheduled for the 10th; `demo` was finished on the 3rd.
  expect(selects("date:2026-08-10")).toEqual(["order"])
  expect(selects("date:2026-08-03")).toEqual(["demo"])
  // A dated `doing` or `todo` is on no day here, exactly as a day page reads
  // it: `kitchen` carries `doing:2026-08-01` and is on no day.
  expect(selects("date:2026-08-01")).toEqual([])
  // ...and `hinges` carries `todo:2026-08-11`.
  expect(selects("date:2026-08-11")).toEqual([])
})

// `has:date` is `date:` with no bounds rather than a test of the `date` FIELD,
// so a node found by `date:2026-08-03` (a dated `done`) is also found by
// `has:date`. Two answers to one word is the thing that would be wrong.
test("`has:date` is the same walk `date:` reads, unbounded", () => {
  expect(selects("has:date")).toEqual(["demo", "order", "basil"])
  // `hinges` carries `todo:"2026-08-11"` and no `date` — a journal reads
  // neither a dated `doing` nor a dated `todo`, and neither does this.
  expect(selects("has:date")).not.toContain("hinges")
})

test("a month and a year are prefixes; a range is two comparisons", () => {
  expect(selects("date:2026-08")).toEqual(["demo", "order"])
  expect(selects("date:2026-07")).toEqual(["basil"])
  expect(selects("date:2026")).toEqual(["demo", "order", "basil"])
  expect(selects("date:2026-08-04..2026-08-20")).toEqual(["order"])
  expect(selects("date:..2026-08-03")).toEqual(["demo", "basil"])
  expect(selects("date:2026-08-04..")).toEqual(["order"])
})

test("`-` negates whichever kind of token it is in front of", () => {
  expect(selects("#home -is:done")).toEqual(["kitchen", "hinges", "herbs"])
  expect(selects("cabinets -is:doing")).toEqual(["install"])
  expect(selects("is:done -basil")).toEqual(["demo"])
  // A bare `-` is a character somebody typed, not a negation of nothing — so
  // it is a word to look for, and nothing in this corpus holds one.
  expect(parseFilter("-").kind).toBe("asking")
  expect(selects("-")).toEqual([])
})

test("clauses and words compose", () => {
  expect(selects("#home is:todo")).toEqual(["hinges"])
  expect(selects("has:date is:doing")).toEqual(["order"])
})

// ── refusals ───────────────────────────────────────────────────────────

/** What a refused query says, or `null` when it was not refused. Written as a
 *  narrowing rather than a field read, which is the union's own point: the
 *  refusals exist only on the arm that has them. */
const refusalsOf = (text: string): ReadonlyArray<Refusal> | null => {
  const filter = parseFilter(text)
  return filter.kind === "refused" ? filter.refusals : null
}

test("a known operator with an unknown value is refused, and teaches", () => {
  const refused = refusalsOf("is:blocked")
  expect(refused?.map((one) => one.token)).toEqual(["is:blocked"])
  expect(refused?.[0]?.reason).toContain("done, doing, todo, marked, archived")
  // Refused means it selects NOTHING — never "the half of the query I could
  // read", which is the silent error that would look like an answer. The union
  // is what makes that structural: a refused filter HAS no terms to fall back
  // on.
  expect(refusalsOf("is:blocked kitchen")).toHaveLength(1)
  expect(selects("is:blocked kitchen")).toEqual([])
})

test("each operator says what it takes", () => {
  expect(refusalsOf("has:tags")?.[0]?.reason).toContain("desc, date, see, after, doc")
  expect(refusalsOf("date:soon")?.[0]?.reason).toContain("2026-08-10")
  expect(refusalsOf("date:..")).toHaveLength(1)
  expect(refusalsOf("is:")).toHaveLength(1)
})

test("a colon after anything else is a colon in a word", () => {
  // Not refused, and not a clause: three tokens the matcher looks for as text.
  expect(refusalsOf("todo: http://example.com")).toBe(null)
  expect(selects("todo:")).toEqual([])
  expect(selects("order:")).toEqual([])
})

// ── the archive ────────────────────────────────────────────────────────

test("what was put away stays put away until it is asked for", () => {
  // `gone` carries `#home` and the word `kitchen`, and answers neither.
  expect(selects("#home")).not.toContain("gone")
  expect(selects("kitchen")).toEqual(["kitchen"])
  expect(selects("is:archived")).toEqual(["gone"])
  expect(selects("#home is:archived")).toEqual(["gone"])
  // Saying it out loud is the same default said out loud.
  expect(selects("#home -is:archived")).toEqual(["kitchen", "hinges", "herbs"])
})

// ── which field carried it ─────────────────────────────────────────────

test("the field a match is reported under is the highest-weighted one that held it", () => {
  const [hit] = matching(derived, parseFilter("cabinets order"))
  expect(hit?.match.field).toBe("title")
  const [note] = matching(derived, parseFilter("walnut"))
  expect(note?.match.field).toBe("desc")
  // A query of operators alone is carried by no field at all.
  const [marked] = matching(derived, parseFilter("is:todo"))
  expect(marked?.match.field).toBe(null)
})

// ── scope ──────────────────────────────────────────────────────────────

test("a scope narrows to one outline, or to one node and everything beneath it", () => {
  const home = parseFilter("#home")
  expect(
    matching(derived, home, { file: "garden.jsonl" }).map(({ at }) => at.node.id),
  ).toEqual(["herbs"])
  expect(
    matching(derived, home, { under: "kitchen" }).map(({ at }) => at.node.id),
  ).toEqual(["kitchen", "hinges"])
  // The node named is IN its own scope — "under `hinges`" is `hinges` and
  // nothing else, rather than nothing at all.
  expect(
    matching(derived, home, { under: "hinges" }).map(({ at }) => at.node.id),
  ).toEqual(["hinges"])
})

// ── the tree, narrowed ─────────────────────────────────────────────────

/** A tree flattened to `id` per line, indented — what the page draws. */
const drawn = (rows: ReadonlyArray<Row>, depth = 0): ReadonlyArray<string> =>
  rows.flatMap((row) => [
    `${"  ".repeat(depth)}${shownRecord(row).node.id}`,
    ...drawn(row.children, depth + 1),
  ])

const narrowed = (file: string, text: string): ReadonlyArray<string> => {
  const filter = parseFilter(text)
  const matched = new Set(matching(derived, filter).map(({ at }) => at.node.id))
  return drawn(keeping(rowsOf(derived, file), matched))
}

test("a match keeps the ancestors that lead to it, and drops everything else", () => {
  expect(narrowed("house.jsonl", "hinges")).toEqual([
    "kitchen",
    "  install",
    "    hinges",
  ])
})

test("a match keeps its whole subtree — you asked for the thing", () => {
  expect(narrowed("house.jsonl", "install")).toEqual([
    "kitchen",
    "  install",
    "    hinges",
  ])
})

test("nothing matching is an empty tree rather than the tree it started as", () => {
  expect(narrowed("house.jsonl", "nothing-is-called-this")).toEqual([])
})

test("a mirror is narrowed by the node it SHOWS, wherever it is drawn", () => {
  // `herbs` lives in garden.jsonl and is mirrored under `kitchen`. Filtering
  // house.jsonl for it keeps the placement, with its ancestor.
  expect(narrowed("house.jsonl", "herb")).toEqual([
    "kitchen",
    "  herbs",
    "    basil",
  ])
})

test("the count is of PLACES, which is what a reader counts on the screen", () => {
  const filter = parseFilter("#home")
  const matched = new Set(matching(derived, filter).map(({ at }) => at.node.id))
  const house = keeping(rowsOf(derived, "house.jsonl"), matched)
  // `kitchen`, `hinges`, and the mirror of `herbs` under `kitchen` — three
  // rows on screen for two nodes plus a placement.
  expect(matchedIn(house, matched)).toBe(3)
})
