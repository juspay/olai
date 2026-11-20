import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  type Corpus,
  corpusOf,
  deltaOf,
  editOf,
} from "./corpora.testlib.ts"
import { derive, type Derived, type Index, READ } from "./derive.ts"
import { FIXTURE_FILE, nodesOf, recordsOf, seeded, setOf } from "./fixtures.testlib.ts"
import { patch, patched, type SetDelta } from "./patch.ts"
import { nearestId } from "./suggest.ts"

const viewOf = (corpus: Corpus): Derived => derive(TEST_CLAIMS, recordsOf(setOf(corpus)))

const readable = (derived: Derived): unknown => ({
  nodes: derived.nodes,
  byId: [...derived.byId],
  byFile: [...derived.byFile],
  byDay: [...derived.byDay],
  owedByDay: [...derived.owedByDay],
  days: derived.days,
  namedBy: [...derived.namedBy],
  children: byKey(derived.children),
  status: byKey(derived.status),
  after: byKey(derived.after),
  blocked: byKey(derived.blocked),
  mirrorsOf: byKey(spread(derived.mirrorsOf)),
  edgesTo: byKey(spread(derived.edgesTo)),
  taggedBy: byKey(derived.taggedBy),
})

const byKey = <V>(map: ReadonlyMap<string, V>): ReadonlyArray<readonly [string, V]> =>
  [...map].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))

const spread = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, ReadonlyArray<string>> =>
  new Map([...index].map(([id, members]) => [id, [...members]]))

const same = (found: Derived, oracle: Derived, story: () => string): void => {
  try {
    expect(readable(found)).toEqual(readable(oracle) as never)
  } catch (cause) {
    throw new Error(`${cause instanceof Error ? cause.message : String(cause)}\n\n${story()}`)
  }
}

const ROUNDS = 500

test("the patched view is the derived view, for any corpus and any delta", () => {
  const random = seeded(20260816)
  let declined = 0
  let dated = 0
  let daysMoved = 0
  for (let round = 0; round < ROUNDS; round++) {
    const { files: before, used } = corpusOf(random)
    const after = editOf(random, before, used)
    const delta = deltaOf(before, after)
    const view = viewOf(before)
    const oracle = viewOf(after)
    const story = () =>
      `round ${round}\nbefore: ${JSON.stringify(before, null, 2)}\n` +
      `after: ${JSON.stringify(after, null, 2)}`

    if (view.byDay.size > 0) dated++
    if ([...view.byDay.keys()].join() !== [...oracle.byDay.keys()].join()) daysMoved++

    const incremental = patched(view, delta)
    if (incremental === undefined) declined++
    else same(incremental, oracle, story)
    same(patch(view, delta), oracle, story)
    same(view, viewOf(before), story)
  }
  expect(declined).toBeGreaterThan(ROUNDS / 20)
  expect(declined).toBeLessThan(ROUNDS / 4.5)
  expect(dated).toBeGreaterThan(ROUNDS / 2)
  expect(daysMoved).toBeGreaterThan(ROUNDS / 5)
})

const DEEP = 12

test("a view patched again and again is still the derived view", () => {
  const random = seeded(20260821)
  let carried = 0
  for (let round = 0; round < ROUNDS / 5; round++) {
    const { files: first, used } = corpusOf(random)
    let before = first
    let view = viewOf(before)
    for (let deep = 0; deep < DEEP; deep++) {
      const after = editOf(random, before, used)
      const delta = deltaOf(before, after)
      const oracle = viewOf(after)
      const story = () =>
        `round ${round}, edit ${deep}\nbefore: ${JSON.stringify(before, null, 2)}\n` +
        `after: ${JSON.stringify(after, null, 2)}`
      const incremental = patched(view, delta)
      if (incremental !== undefined) {
        same(incremental, oracle, story)
        carried++
      }
      const next = patch(view, delta)
      same(next, oracle, story)
      same(view, viewOf(before), story)
      view = next
      before = after
    }
  }
  expect(carried).toBeGreaterThan((ROUNDS / 5) * DEEP / 2)
})

const KITCHEN: Corpus = {
  "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
  "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
  "deep/c.olai": `{"id":"m2","ord":"a","mirror":"m"}`,
}

const editing = (file: string, text: string): SetDelta => ({
  upserts: [[file, { nodes: nodesOf(text, file) }]],
  removes: [],
})

test("a mark flips, and the placements standing for it two files away say so", () => {
  const view = viewOf(KITCHEN)
  const done = `{"id":"cook","ord":"a","title":"cook","done":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`
  const next = patched(view, editing("a.olai", done))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...KITCHEN, "a.olai": done }), () => "mark flip")
  expect((next as Derived).status.get("m2")).toBe("done")
  expect((next as Derived).blocked.has("eat")).toBe(false)
})

test("an edit keeps the files it did not touch, entry by entry", () => {
  const view = viewOf(KITCHEN)
  const next = patch(view, editing("a.olai", `{"id":"cook","ord":"a","title":"cook again"}`))
  expect(next.byFile.get("b.olai")).toBe(view.byFile.get("b.olai"))
  expect(next.byId.get("m")).toBe(view.byId.get("m"))
})

const SIX: Corpus = {
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, which) => [
      `f${which}.olai`,
      `{"id":"p${which}","ord":"a","title":"p${which}"}\n` +
        `{"id":"t${which}","ord":"b","parent":"p${which}","title":"t${which}",` +
        `"todo":true,"after":["g${which}"]}`,
    ]),
  ),
  "gates.olai": Array.from(
    { length: 6 },
    (_, which) => `{"id":"g${which}","ord":"${"abcdef"[which]}","title":"g${which}","todo":true}`,
  ).join("\n"),
  "mirrors.olai": Array.from(
    { length: 6 },
    (_, which) => `{"id":"m${which}","ord":"${"abcdef"[which]}","mirror":"t${which}"}`,
  ).join("\n"),
}

test("an edit layers the indexes read by key, and clones the ones read whole", () => {
  const typed = `{"id":"p0","ord":"a","title":"p0"}\n` +
    `{"id":"t0","ord":"b","parent":"p0","title":"t0 again","todo":true,"after":["g0"]}`
  const view = viewOf(SIX)
  const next = patched(view, editing("f0.olai", typed))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...SIX, "f0.olai": typed }), () => "a title typed")

  for (const index of Object.keys(READ) as ReadonlyArray<Index>) {
    expect([index, (next as Derived)[index] instanceof Map])
      .toEqual([index, READ[index] === "whole"])
  }
  expect(view.byId.get("t0")?.node).toMatchObject({ title: "t0" })
})

test("the flat list is one value however often it is asked for", () => {
  const before: Corpus = {
    "a.olai": `{"id":"p","ord":"a","title":"p"}`,
    "b.olai": `{"id":"r","ord":"a","title":"r"}`,
  }
  const view = viewOf(before)
  const next = patched(view, editing("a.olai", `{"id":"p","ord":"a","title":"p again"}`))
  expect(next).toBeDefined()
  expect((next as Derived).nodes).toBe((next as Derived).nodes)
  expect((next as Derived).nodes.map((at) => at.node.id)).toEqual(["p", "r"])
})

test("an index the edit says nothing about is the map the last view held", () => {
  const before: Corpus = {
    "a.olai": `{"id":"p","ord":"a","title":"p"}`,
    "b.olai": `{"id":"q","ord":"a","title":"q","after":["p"]}\n` +
      `{"id":"r","ord":"b","title":"r #tag","date":"2026-08-20","todo":true}\n` +
      `{"id":"under","ord":"c","title":"under","parent":"r"}`,
  }
  const typed = `{"id":"p","ord":"a","title":"p again"}`
  const view = viewOf(before)
  expect([view.children.size, view.namedBy.size, view.taggedBy.size, view.byDay.size])
    .toEqual([1, 1, 1, 1])
  expect([view.owedByDay.size, view.days.length]).toEqual([1, 1])

  const next = patched(view, editing("a.olai", typed))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": typed }), () => "a title typed")
  expect((next as Derived).children).toBe(view.children)
  expect((next as Derived).namedBy).toBe(view.namedBy)
  expect((next as Derived).taggedBy).toBe(view.taggedBy)
  expect((next as Derived).byDay).toBe(view.byDay)
  expect((next as Derived).owedByDay).toBe(view.owedByDay)
  expect((next as Derived).days).toBe(view.days)
})

test("a mirror chain that dangled resolves the moment its target arrives", () => {
  const before: Corpus = {
    "a.olai": `{"id":"here","ord":"a","title":"here"}`,
    "b.olai": `{"id":"one","ord":"a","mirror":"two"}\n{"id":"two","ord":"b","mirror":"far"}`,
  }
  const view = viewOf(before)
  expect(view.status.has("one")).toBe(false)
  const arrived = `{"id":"here","ord":"a","title":"here"}\n{"id":"far","ord":"b","title":"far","doing":true}`
  const next = patched(view, editing("a.olai", arrived))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": arrived }), () => "a target arrives")
  expect((next as Derived).status.get("one")).toBe("doing")
  expect([...((next as Derived).mirrorsOf.get("far") ?? [])]).toEqual(["one", "two"])
})

test("an edge written at a placement moves with the placement", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
      `{"id":"wash","ord":"b","title":"wash","todo":true}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
    "deep/c.olai": `{"id":"wait","ord":"a","title":"wait","todo":true,"after":["m"]}`,
  }
  const view = viewOf(before)
  expect(view.after.get("wait")).toEqual(["cook"])
  const moved = `{"id":"m","ord":"a","mirror":"wash"}`
  const next = patched(view, editing("b.olai", moved))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": moved }), () => "a placement moves")
  expect((next as Derived).after.get("wait")).toEqual(["wash"])
  expect([...((next as Derived).edgesTo.get("wash") ?? [])]).toEqual(["wait"])
})

test("a word typed into a note reaches the index, and taking it out empties the key", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"note","ord":"a","title":"a note"}`,
  }
  const view = viewOf(before)
  expect(view.taggedBy.has("@cook")).toBe(false)

  const said = `{"id":"note","ord":"a","title":"a note","desc":"see @cook first"}`
  const next = patched(view, editing("b.olai", said))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": said }), () => "a note names a node")
  expect((next as Derived).taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])

  const quiet = patched(next as Derived, editing("b.olai", before["b.olai"] as string))
  expect(quiet).toBeDefined()
  same(quiet as Derived, viewOf(before), () => "the word is deleted")
  expect((quiet as Derived).taggedBy.has("@cook")).toBe(false)
})

test("one record writing a tag twice is one entry, in the title and in the note", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"note","ord":"a","title":"a note"}`,
  }
  const both = `{"id":"note","ord":"a","title":"about @cook","desc":"and again: @cook"}`
  const view = viewOf(before)
  const next = patched(view, editing("b.olai", both))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": both }), () => "said twice")
  expect((next as Derived).taggedBy.get("@cook")?.length).toBe(1)
})

test("the two sigils are two keys, and an edit moves only the one it wrote", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"topic","ord":"a","title":"about #cook"}`,
    "deep/c.olai": `{"id":"note","ord":"a","title":"ask @cook"}`,
  }
  const view = viewOf(before)
  expect(view.taggedBy.get("#cook")?.map((at) => at.node.id)).toEqual(["topic"])
  expect(view.taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])

  const quiet = `{"id":"topic","ord":"a","title":"about nothing"}`
  const next = patched(view, editing("b.olai", quiet))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": quiet }), () => "the topic goes")
  expect((next as Derived).taggedBy.has("#cook")).toBe(false)
  expect((next as Derived).taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])
})

test("two records swapping lines are two keys swapping places", () => {
  const before: Corpus = {
    "a.olai": `{"id":"p","ord":"a","title":"p"}\n{"id":"q","ord":"b","title":"q"}`,
    "b.olai": `{"id":"r","ord":"a","title":"r"}`,
  }
  const swapped = `{"id":"q","ord":"b","title":"q"}\n{"id":"p","ord":"a","title":"p"}`
  const view = viewOf(before)
  const next = patched(view, editing("a.olai", swapped))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": swapped }), () => "lines swapped")
  expect([...(next as Derived).byId.keys()]).toEqual(["q", "p", "r"])
})

test("a record moved to another file takes its key to the end of the corpus", () => {
  const before: Corpus = {
    "a.olai": `{"id":"x","ord":"a","title":"x"}\n{"id":"keep","ord":"b","title":"keep"}`,
    "b.olai": `{"id":"y","ord":"a","title":"y"}`,
    "c.olai": `{"id":"z","ord":"a","title":"z"}`,
  }
  const emptied = `{"id":"keep","ord":"b","title":"keep"}`
  const landed = `{"id":"z","ord":"a","title":"z"}\n{"id":"x","ord":"a","title":"x"}`
  const view = viewOf(before)
  const next = patched(view, {
    upserts: [
      ["a.olai", { nodes: nodesOf(emptied, "a.olai") }],
      ["c.olai", { nodes: nodesOf(landed, "c.olai") }],
    ],
    removes: [],
  })
  expect(next).toBeDefined()
  const after = { ...before, "a.olai": emptied, "c.olai": landed }
  same(next as Derived, viewOf(after), () => "a record moves file")
  expect([...(next as Derived).byId.keys()]).toEqual(["keep", "y", "z", "x"])
  expect(nearestId("aa", (next as Derived).byId.keys()))
    .toBe(nearestId("aa", viewOf(after).byId.keys()))
})

test("siblings in two files with one `ord` and one line break the same way", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","parent":"p","ord":"a","title":"first file"}`,
    "b.olai": `{"id":"two","parent":"p","ord":"a","title":"second file"}`,
    "deep/c.olai": `{"id":"p","ord":"a","title":"the parent"}`,
  }
  const view = viewOf(before)
  expect(view.children.get("p")?.map((at) => at.node.id)).toEqual(["one", "two"])

  const later = `{"id":"two","parent":"p","ord":"a","title":"edited"}`
  const afterLater = patched(view, editing("b.olai", later))
  expect(afterLater).toBeDefined()
  same(afterLater as Derived, viewOf({ ...before, "b.olai": later }), () => "the later file")
  expect((afterLater as Derived).children.get("p")?.map((at) => at.node.id))
    .toEqual(["one", "two"])

  const earlier = `{"id":"one","parent":"p","ord":"a","title":"edited"}`
  const afterEarlier = patched(view, editing("a.olai", earlier))
  expect(afterEarlier).toBeDefined()
  same(afterEarlier as Derived, viewOf({ ...before, "a.olai": earlier }), () => "the earlier file")
  expect((afterEarlier as Derived).children.get("p")?.map((at) => at.node.id))
    .toEqual(["one", "two"])
})

test("a file that arrives takes its place in path order", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one"}`,
    "z.olai": `{"id":"three","ord":"a","title":"three"}`,
  }
  const view = viewOf(before)
  const added = { ...before, "b.olai": `{"id":"two","ord":"a","title":"two"}` }
  const next = patch(view, editing("b.olai", added["b.olai"] as string))
  same(next, viewOf(added), () => "a file arrives")
  expect(next.nodes.map((at) => at.node.id)).toEqual(["one", "two", "three"])
})

test("a file arriving in a directory named after its neighbour lands where a walk puts it", () => {
  const before: Corpus = {
    "a.olai": `{"id":"flat","ord":"a","title":"flat"}`,
    "b.olai": `{"id":"other","ord":"a","title":"other"}`,
  }
  const view = viewOf(before)
  const inner = `{"id":"nested","ord":"a","title":"nested"}`
  const next = patch(view, editing("a/inner.olai", inner))
  const after = { ...before, "a/inner.olai": inner }
  same(next, viewOf(after), () => "a nested file arrives")
  expect(next.nodes.map((at) => at.node.id)).toEqual(["nested", "flat", "other"])
  expect([...next.byFile.keys()]).toEqual(["a/inner.olai", "a.olai", "b.olai"])
})

test("a file that goes away takes its records with it", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one","todo":true,"after":["two"]}`,
    "b.olai": `{"id":"two","ord":"a","title":"two","todo":true}`,
    "deep/c.olai": `{"id":"three","ord":"a","mirror":"two"}`,
  }
  const view = viewOf(before)
  expect(view.blocked.has("one")).toBe(true)
  const { "b.olai": _gone, ...after } = before
  const next = patch(view, { upserts: [], removes: ["b.olai"] })
  same(next, viewOf(after), () => "a file leaves")
  expect(next.after.get("one")).toEqual(["two"])
  expect(next.blocked.has("one")).toBe(false)
  expect(next.status.has("three")).toBe(false)
})

test("a file arrives holding nothing, fills, empties, and goes", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one","todo":true}`,
    "deep/c.olai": `{"id":"far","ord":"a","title":"far"}`,
  }
  const view = viewOf(before)

  const arrived = patched(view, editing("b.olai", ""))
  expect(arrived).toBeDefined()
  same(arrived as Derived, viewOf({ ...before, "b.olai": "" }), () => "an empty file arrives")
  expect((arrived as Derived).byFile.has("b.olai")).toBe(false)

  const written = `{"id":"two","ord":"a","title":"two","after":["one"]}`
  const filled = patched(arrived as Derived, editing("b.olai", written))
  expect(filled).toBeDefined()
  same(filled as Derived, viewOf({ ...before, "b.olai": written }), () => "the file fills")
  expect((filled as Derived).byFile.get("b.olai")?.map((at) => at.node.id)).toEqual(["two"])
  expect([...((filled as Derived).edgesTo.get("one") ?? [])]).toEqual(["two"])

  const emptied = patched(filled as Derived, editing("b.olai", ""))
  expect(emptied).toBeDefined()
  same(emptied as Derived, viewOf({ ...before, "b.olai": "" }), () => "the file empties")
  expect((emptied as Derived).byFile.has("b.olai")).toBe(false)
  expect((emptied as Derived).byId.has("two")).toBe(false)
  expect((emptied as Derived).edgesTo.has("one")).toBe(false)

  const gone = patch(emptied as Derived, { upserts: [], removes: ["b.olai"] })
  same(gone, viewOf(before), () => "the file goes")
})

test("an empty delta is the same view, and says so by being it", () => {
  const view = viewOf(KITCHEN)
  expect(patch(view, { upserts: [], removes: [] })).toBe(view)
})

test("a duplicate id is handed back to the rebuild, and answered anyway", () => {
  const before: Corpus = {
    "a.olai": `{"id":"x","ord":"a","title":"first"}`,
    "b.olai": `{"id":"y","ord":"a","title":"second"}`,
    "deep/c.olai": `{"id":"z","ord":"a","title":"third"}`,
  }
  const view = viewOf(before)
  const clash = `{"id":"x","ord":"a","title":"clash"}`
  expect(patched(view, editing("b.olai", clash))).toBeUndefined()
  same(patch(view, editing("b.olai", clash)), viewOf({ ...before, "b.olai": clash }), () => "clash")

  const clashed = viewOf({ ...before, "b.olai": clash })
  expect(patched(clashed, editing("deep/c.olai", `{"id":"z","ord":"a","title":"other"}`)))
    .toBeUndefined()
})

test("a delta that leaves nothing standing is a rebuild", () => {
  const before: Corpus = { [FIXTURE_FILE]: `{"id":"one","ord":"a","title":"one"}` }
  const view = viewOf(before)
  const text = `{"id":"one","ord":"a","title":"two"}`
  expect(patched(view, editing(FIXTURE_FILE, text))).toBeUndefined()
  same(patch(view, editing(FIXTURE_FILE, text)), viewOf({ [FIXTURE_FILE]: text }), () => "one file")
})
