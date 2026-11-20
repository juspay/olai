import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  ancestorsOf,
  ancestryOver,
  blockersOf,
  changesUnder,
  countedChildren,
  derive,
  type Derived,
  nodesOf as recordsOf,
  type Progress,
  progressOf,
  type Row,
  rowsOf,
  situate,
  standingBefore,
  type Status,
  isTagName,
  memoryFiles,
  mayHoldTag,
  nearestAtOrAbove,
  TAG_SIGILS,
  tagOpensAt,
  tagText,
  titleParts,
  titleTagRe,
  tookOf,
  under,
  unfinishedWithin,

  withoutDone,
} from "./derive.ts"
import { FIXTURE_FILE, nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import { isMirror, type Located, type RegularNode, storedMarker } from "./node.ts"

const statusesOf = (contents: string): ReadonlyMap<string, Status> =>
  derive(TEST_CLAIMS, nodesOf(contents)).status

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

test("the nearest selected node may be the node itself or its closest ancestor", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"root","ord":"a","title":"root"}\n` +
      `{"id":"middle","parent":"root","ord":"a","title":"middle"}\n` +
      `{"id":"leaf","parent":"middle","ord":"a","title":"leaf"}`,
  ))
  expect(nearestAtOrAbove(derived, "leaf", new Set(["root", "middle"]))).toBe("middle")
  expect(nearestAtOrAbove(derived, "leaf", new Set(["root", "leaf"]))).toBe("leaf")
  expect(nearestAtOrAbove(derived, "leaf", new Set(["elsewhere"]))).toBeNull()
})

const members = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
  id: string,
): ReadonlyArray<string> => [...(index.get(id) ?? [])]

const namers = (derived: Derived, id: string): ReadonlyArray<string> =>
  (derived.namedBy.get(id) ?? []).map((one) =>
    `${one.at.node.id} ${one.fields.join(",")}`
  )

const taggers = (derived: Derived, tag: string): ReadonlyArray<string> =>
  (derived.taggedBy.get(tag) ?? []).map((at) => at.node.id)

const regulars = (contents: string): ReadonlyArray<RegularNode> =>
  nodesOf(contents).flatMap((located) => isMirror(located.node) ? [] : [located.node])

const shape = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [`${row.key} ${row.kind}`, ...shape(row.children)])

const drawn = (
  rows: ReadonlyArray<Row>,
  index: number,
): Extract<Row, { readonly kind: "node" | "mirror" }> => {
  const row = rows[index]
  if (row === undefined) throw new Error(`expected a row at ${index}, got none`)
  if (row.kind !== "node" && row.kind !== "mirror") {
    throw new Error(`expected row ${index} to draw a node, got a \`${row.kind}\` stub`)
  }
  return row
}

const stubbed = (row: Row): string =>
  row.kind === "dangling"
    ? `dangling ${row.missing}`
    : row.kind === "cycle"
    ? `cycle ${row.through}`
    : `drawn ${row.kind}`

test("a leaf reports what it stores, and an unmarked one reports nothing", () => {
  const status = statusesOf(
    `{"id":"a","ord":"a","title":"a","done":true}\n` +
      `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
      `{"id":"c","ord":"c","title":"c"}`,
  )
  expect(status.get("a")).toBe("done")
  expect(status.get("b")).toBe("doing")
  expect(status.get("c")).toBeUndefined()
  expect(status.has("c")).toBe(false)
})

test("the stored marker is the field a record actually carries, or nothing", () => {
  expect(
    regulars(
      `{"id":"a","ord":"a","title":"a","done":true}\n` +
        `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
        `{"id":"t","ord":"c","title":"t","todo":true}\n` +
        `{"id":"c","ord":"d","title":"c"}`,
    ).map(storedMarker),
  ).toEqual(["done", "doing", "todo", undefined])

  expect(storedMarker({ id: "x", ord: "a", title: "x", done: true, doing: true }))
    .toBe("done")
  expect(storedMarker({ id: "x", ord: "a", title: "x", doing: true, todo: true }))
    .toBe("doing")
})

test("a parent says what it stores, whatever hangs under it", () => {
  const unmarked = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","done":true}`,
  )
  expect(unmarked.get("p")).toBeUndefined()

  const overNotes = statusesOf(
    `{"id":"p","ord":"a","title":"p","todo":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(overNotes.get("p")).toBe("todo")

  const disagreeing = statusesOf(
    `{"id":"p","ord":"a","title":"p","done":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","doing":true}`,
  )
  expect(disagreeing.get("p")).toBe("done")
  expect(disagreeing.get("c1")).toBe("doing")
})

test("the rollup counts the child tasks, and only the child tasks", () => {
  const progress = (contents: string, id: string): Progress | undefined =>
    progressOf(derive(TEST_CLAIMS, nodesOf(contents)), id)

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3","todo":true}`,
    "p",
  )).toEqual({ done: 1, total: 3 })

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","todo":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3","cancelled":"2026-08-25"}`,
    "p",
  )).toEqual({ done: 1, total: 2 })

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","cancelled":true}`,
    "p",
  )).toEqual({ done: 1, total: 1 })

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","cancelled":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","cancelled":"2026-08-25"}`,
    "p",
  )).toBeUndefined()

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"aside","parent":"p","ord":"b","title":"how it went"}`,
    "p",
  )).toEqual({ done: 1, total: 1 })

  expect(progress(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}`,
    "p",
  )).toBeUndefined()
  expect(progress(`{"id":"p","ord":"a","title":"p","done":true}`, "p")).toBeUndefined()

  expect(progress(
    `{"id":"top","ord":"a","title":"top"}\n` +
      `{"id":"mid","parent":"top","ord":"a","title":"mid","doing":true}\n` +
      `{"id":"leaf","parent":"mid","ord":"a","title":"leaf","done":true}`,
    "top",
  )).toEqual({ done: 0, total: 1 })
})

test("took is the settling instant minus the stored start, in whole seconds", () => {
  const took = (record: string): number | undefined => {
    const [located] = nodesOf(record)
    if (located === undefined || isMirror(located.node)) throw new Error("fixture")
    return tookOf(located.node)
  }

  expect(took(
    `{"id":"a","ord":"a","title":"t","done":"2026-08-29T12:26:44-04:00","started":"2026-08-29T09:52:00-04:00"}`,
  )).toBe(9284)

  expect(took(
    `{"id":"a","ord":"a","title":"t","cancelled":"2026-08-29T10:33:00-04:00","started":"2026-08-29T09:52:00-04:00"}`,
  )).toBe(2460)

  expect(took(
    `{"id":"a","ord":"a","title":"t","done":"2026-08-29T09:52:00-04:00","started":"2026-08-29T09:52:00-04:00"}`,
  )).toBe(0)

  expect(took(`{"id":"a","ord":"a","title":"t","done":"2026-08-29T12:26:44-04:00","created":"2026-08-01T09:52:00-04:00"}`))
    .toBeUndefined()
  expect(took(
    `{"id":"a","ord":"a","title":"t","doing":true,"started":"2026-08-29T09:52:00-04:00"}`,
  )).toBeUndefined()
  expect(took(
    `{"id":"a","ord":"a","title":"t","todo":true,"started":"2026-08-29T09:52:00-04:00"}`,
  )).toBeUndefined()
  expect(took(
    `{"id":"a","ord":"a","title":"t","done":true,"started":"2026-08-29T09:52:00-04:00"}`,
  )).toBeUndefined()
})

test("took is the bank when there is one — rounds summed, pauses never in it", () => {
  const took = (node: RegularNode): number | undefined => tookOf(node)
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "2026-08-29T09:58:00-04:00",
    started: "2026-08-29T09:50:00-04:00",
    worked: 1080,
  })).toBe(1080)
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "2026-08-29T12:26:44-04:00",
    worked: 600,
  })).toBe(600)
  expect(took({ id: "a", ord: "a", title: "t", done: true, worked: 41 * 60 }))
    .toBe(2460)
  expect(took({
    id: "a", ord: "a", title: "t",
    cancelled: "2026-08-29T10:33:00-04:00",
    started: "2026-08-29T09:52:00-04:00",
    worked: 1080,
  })).toBe(1080)
  expect(took({
    id: "a", ord: "a", title: "t",
    doing: true,
    started: "2026-08-29T09:50:00-04:00",
    worked: 600,
  })).toBeUndefined()
  expect(took({ id: "a", ord: "a", title: "t", done: "2026-08-29T12:26:44-04:00", worked: -30 }))
    .toBe(0)
})

test("took says nothing the record cannot support, and never goes under zero", () => {
  const took = (node: RegularNode): number | undefined => tookOf(node)
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "2026-08-29T12:26:44-04:00",
    started: "not a date",
  })).toBeUndefined()
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "still not one",
    started: "2026-08-29T09:52:00-04:00",
  })).toBeUndefined()
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "2026-08-29T09:52:00-04:00",
    started: "2026-08-29T09:58:36-04:00",
  })).toBe(0)
  expect(took({
    id: "a", ord: "a", title: "t",
    done: "2026-08-29T09:52:12.726Z",
    started: "2026-08-29T09:52:09.185Z",
  })).toBe(4)
})

test("the unfinished ones are the tasks in the subtree that are not done", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"c3","parent":"p","ord":"c","title":"c3","todo":true}\n` +
      `{"id":"aside","parent":"p","ord":"d","title":"a note about it"}\n` +
      `{"id":"m","parent":"p","ord":"e","mirror":"c3"}`,
  ))
  expect(ids(unfinishedWithin(derived, "p"))).toEqual(["c2", "c3"])
  expect(unfinishedWithin(derived, "c1")).toEqual([])
})

test("it descends the whole branch, through bullets and finished work alike", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"root","ord":"a","title":"root"}\n` +
      `{"id":"near","parent":"root","ord":"a","title":"near","todo":true}\n` +
      `{"id":"note","parent":"root","ord":"b","title":"a note"}\n` +
      `{"id":"deep","parent":"note","ord":"a","title":"deep","doing":true}\n` +
      `{"id":"shut","parent":"root","ord":"c","title":"shut","done":true}\n` +
      `{"id":"under","parent":"shut","ord":"a","title":"under a done one","todo":true}`,
  ))
  expect(ids(unfinishedWithin(derived, "root"))).toEqual(["near", "deep", "under"])
})

test("a mirror is never counted and never walked through", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"here","ord":"a","title":"here"}\n` +
      `{"id":"place","parent":"here","ord":"a","mirror":"there"}\n` +
      `{"id":"there","ord":"b","title":"there","todo":true}\n` +
      `{"id":"below","parent":"there","ord":"a","title":"below","todo":true}`,
  ))
  expect(unfinishedWithin(derived, "here")).toEqual([])
  expect(ids(unfinishedWithin(derived, "there"))).toEqual(["below"])
})

test("a parent loop is walked once", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a","todo":true}\n` +
      `{"id":"b","parent":"a","ord":"a","title":"b","todo":true}`,
  ))
  expect(ids(unfinishedWithin(derived, "a"))).toEqual(["b"])
})

test("a mirror reports its target's mark, through as many hops as it takes", () => {
  const status = statusesOf(
    `{"id":"p","ord":"a","title":"p","done":"2026-08-03"}\n` +
      `{"id":"hop","ord":"b","mirror":"p"}\n` +
      `{"id":"far","ord":"c","mirror":"hop"}`,
  )
  expect(status.get("p")).toBe("done")
  expect(status.get("hop")).toBe("done")
  expect(status.get("far")).toBe("done")
})

test("a mirror row draws its target's mark, whichever of them it is", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS, nodesOfFiles({
      "a.olai": `{"id":"working","ord":"a","title":"working","doing":"2026-08-11"}\n` +
        `{"id":"waiting","ord":"b","title":"waiting","todo":"2026-08-11"}\n` +
        `{"id":"finished","ord":"c","title":"finished","done":"2026-08-11"}\n` +
        `{"id":"note","ord":"d","title":"a note about all three"}`,
      "b.olai": `{"id":"m-working","ord":"a","mirror":"working"}\n` +
        `{"id":"m-waiting","ord":"b","mirror":"waiting"}\n` +
        `{"id":"m-finished","ord":"c","mirror":"finished"}\n` +
        `{"id":"m-note","ord":"d","mirror":"note"}`,
    })),
    "b.olai",
  )
  expect(rows.map((row) => [row.at.node.id, row.status])).toEqual([
    ["m-working", "doing"],
    ["m-waiting", "todo"],
    ["m-finished", "done"],
    ["m-note", undefined],
  ])
})

test("a mirror child does not count toward the rollup of the node it sits under", () => {
  const contents = `{"id":"elsewhere","ord":"z","title":"somewhere else","todo":true}\n` +
    `{"id":"p","ord":"a","title":"p"}\n` +
    `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
    `{"id":"m","parent":"p","ord":"b","mirror":"elsewhere"}`
  const derived = derive(TEST_CLAIMS, nodesOf(contents))
  expect(derived.status.get("m")).toBe("todo")
  expect(progressOf(derived, "p")).toEqual({ done: 1, total: 1 })

  expect(ids(derived.children.get("p") ?? [])).toEqual(["c", "m"])
  expect(ids(countedChildren(derived, "p"))).toEqual(["c"])
})

test("siblings sort by string comparison of ord, never numerically", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"two","parent":"p","ord":"a2","title":"two"}\n` +
      `{"id":"ten","parent":"p","ord":"a10","title":"ten"}\n` +
      `{"id":"upper","parent":"p","ord":"Z","title":"upper"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["upper", "ten", "two"])
})

test("equal ords break on line, not on sort stability", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"later","parent":"p","ord":"m","title":"later"}\n` +
      `{"id":"earlier","parent":"p","ord":"m","title":"earlier"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["later", "earlier"])
})

test("a duplicated id resolves to the record that claimed it first", () => {
  const within = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"first"}\n{"id":"x","ord":"b","title":"second"}`,
  ))
  expect(within.byId.get("x")?.line).toBe(1)

  const across = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"first"}`,
    "b.olai": `{"id":"x","ord":"a","title":"second"}`,
  }))
  expect([across.byId.get("x")?.file, across.byId.get("x")?.line]).toEqual(["a.olai", 1])
  expect(across.byId.size).toBe(1)
})

test("a file's records come back in line order, whatever order the set is in", () => {
  const nodes = nodesOfFiles({
    "a.olai": `{"id":"a1","ord":"b","title":"one"}\n` +
      `{"id":"a2","ord":"a","title":"two"}\n` +
      `{"id":"m","parent":"a1","ord":"a","mirror":"b1"}`,
    "b.olai": `{"id":"b1","ord":"a","title":"elsewhere"}`,
  })
  const derived = derive(TEST_CLAIMS, [...nodes].reverse())
  expect(ids(recordsOf(derived, "a.olai"))).toEqual(["a1", "a2", "m"])
  expect(ids(recordsOf(derived, "b.olai"))).toEqual(["b1"])
  expect(derived.byFile.has("c.olai")).toBe(false)
  expect(recordsOf(derived, "c.olai")).toEqual([])
})

const waiting = (
  derived: ReturnType<typeof derive>,
  id: string,
): ReadonlyArray<string> =>
  blockersOf(derived, id).map((one) => `${one.at.node.id} ${one.status}`)

const waitingIn = (contents: string, id: string): ReadonlyArray<string> =>
  waiting(derive(TEST_CLAIMS, nodesOf(contents)), id)

test("an after target blocks while it is a task nobody has settled", () => {
  const of = (mark: string): ReadonlyArray<string> =>
    waitingIn(
      `{"id":"a","ord":"a","title":"a","doing":true,"after":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b"${mark}}`,
      "a",
    )
  expect(of(`,"doing":true`)).toEqual(["b doing"])
  expect(of(`,"todo":true`)).toEqual(["b todo"])
  expect(of(`,"done":"2026-08-10"`)).toEqual([])
  expect(of(`,"cancelled":"2026-08-25T15:40:03-04:00"`)).toEqual([])
  expect(of(`,"cancelled":true`)).toEqual([])
})

test("a cancelled node is waiting on nothing, and stands in nobody's way", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","cancelled":"2026-08-25T15:40:03-04:00","after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","todo":true,"after":["a"]}`,
  ))
  expect(waiting(derived, "a")).toEqual([])
  expect(waiting(derived, "c")).toEqual([])
  expect(standingBefore(derived, "c").map((one) => one.at.node.id)).toEqual([])
  expect(standingBefore(derived, "a").map((one) => one.at.node.id)).toEqual(["b"])
})

test("a cancelled task is not unfinished work in the branch below a node", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"top","ord":"a","title":"top","todo":true}\n` +
      `{"id":"fin","parent":"top","ord":"a","title":"fin","done":"2026-08-10"}\n` +
      `{"id":"off","parent":"top","ord":"b","title":"off","cancelled":"2026-08-25"}\n` +
      `{"id":"deep","parent":"off","ord":"a","title":"deep","todo":true}\n` +
      `{"id":"note","parent":"top","ord":"c","title":"note"}`,
  ))
  expect(unfinishedWithin(derived, "top").map((at) => at.node.id)).toEqual(["deep"])

  const settled = derive(TEST_CLAIMS, nodesOf(
    `{"id":"top","ord":"a","title":"top","todo":true}\n` +
      `{"id":"off","parent":"top","ord":"a","title":"off","cancelled":"2026-08-25"}\n` +
      `{"id":"deep","parent":"off","ord":"a","title":"deep","cancelled":true}`,
  ))
  expect(unfinishedWithin(settled, "top")).toEqual([])
})

test("a target nobody marked never blocks, however unfinished it looks", () => {
  expect(
    waitingIn(
      `{"id":"a","ord":"a","title":"a","todo":true,"after":["note"]}\n` +
        `{"id":"note","ord":"b","title":"a note nobody marked"}`,
      "a",
    ),
  ).toEqual([])

  expect(
    waitingIn(
      `{"id":"a","ord":"a","title":"a","todo":true,"after":["notes"]}\n` +
        `{"id":"notes","ord":"b","title":"notes"}\n` +
        `{"id":"one","parent":"notes","ord":"a","title":"one"}`,
      "a",
    ),
  ).toEqual([])
})

test("a node that is done or unmarked is waiting on nothing", () => {
  const set = (mark: string): string =>
    `{"id":"a","ord":"a","title":"a"${mark},"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}`
  expect(waitingIn(set(`,"doing":true`), "a")).toEqual(["b doing"])
  expect(waitingIn(set(`,"done":"2026-08-10"`), "a")).toEqual([])
  expect(waitingIn(set(""), "a")).toEqual([])
})

test("blocks is the same edge, and both halves land in one answer", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","todo":true,"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","doing":true,"blocks":["a"]}`,
  ))
  expect(waiting(derived, "a")).toEqual(["b doing", "c doing"])
  expect(derived.after.get("a")).toEqual(["b", "c"])
  expect(derived.blocked.has("b")).toBe(false)
})

test("an edge named twice, however it is spelled, is one edge", () => {
  const repeated = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","todo":true,"after":["b","b","b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}`,
  ))
  expect(repeated.after.get("a")).toEqual(["b"])
  expect(waiting(repeated, "a")).toEqual(["b doing"])

  const both = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","todo":true,"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true,"blocks":["a"]}`,
  ))
  expect(both.after.get("a")).toEqual(["b"])
  expect(waiting(both, "a")).toEqual(["b doing"])

  const mirrored = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["b","b-here"]}\n` +
      `{"id":"b-here","ord":"b","mirror":"b"}`,
    "b.olai": `{"id":"b","ord":"a","title":"b","doing":true}`,
  }))
  expect(mirrored.after.get("a")).toEqual(["b"])
  expect(waiting(mirrored, "a")).toEqual(["b doing"])

  const ordered = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","todo":true,"after":["c","b","c"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","todo":true}`,
  ))
  expect(ordered.after.get("a")).toEqual(["c", "b"])
})

test("archived work neither blocks nor is blocked", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "house.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["put-away"]}`,
    "_olai/Trash.olai":
      `{"id":"put-away","ord":"a","title":"put away half-finished","doing":true}\n` +
        `{"id":"old","ord":"b","title":"old","todo":true,"after":["a"]}`,
  }))
  expect(waiting(derived, "a")).toEqual([])
  expect(waiting(derived, "old")).toEqual([])
  expect(derived.status.get("put-away")).toBe("doing")
})

test("leftover Archive.olai work neither blocks nor is blocked", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "house.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["old"]}`,
    "Archive.olai":
      `{"id":"old","ord":"a","title":"leftover half-finished","doing":true}\n` +
        `{"id":"waiting","ord":"b","title":"waiting","todo":true,"after":["a"]}`,
  }))
  expect(waiting(derived, "a")).toEqual([])
  expect(waiting(derived, "waiting")).toEqual([])
  expect(derived.status.get("old")).toBe("doing")
})

test("a leftover Archive.olai mirror does not make a node is:mirrored", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "house.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
    "Archive.olai": `{"id":"m","ord":"a","mirror":"herbs"}`,
  }))
  expect(derived.mirrorsOf.has("herbs")).toBe(false)
})

test("standingBefore asks the same question of a node that is not work yet", () => {
  const before = (
    derived: ReturnType<typeof derive>,
    id: string,
  ): ReadonlyArray<string> =>
    standingBefore(derived, id).map((one) => `${one.at.node.id} ${one.status}`)

  const bullet = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}`,
  ))
  expect(waiting(bullet, "a")).toEqual([])
  expect(before(bullet, "a")).toEqual(["b doing"])

  const clear = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a","after":["note","fin","gone"]}\n` +
      `{"id":"note","ord":"b","title":"a note"}\n` +
      `{"id":"fin","ord":"c","title":"fin","done":"2026-08-10"}`,
    "_olai/Trash.olai": `{"id":"gone","ord":"a","title":"gone","todo":true}`,
  }))
  expect(before(clear, "a")).toEqual([])

  const both = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true}\n` +
      `{"id":"c","ord":"c","title":"c","todo":true,"blocks":["a"]}`,
  ))
  expect(before(both, "a")).toEqual(["b doing", "c todo"])

  expect(before(both, "b")).toEqual([])
})

test("an archive beside any outline is an archive", () => {
  expect(
    waiting(
      derive(TEST_CLAIMS, nodesOfFiles({
        "work/plans.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["old"]}`,
        "_olai/Trash.olai": `{"id":"old","ord":"a","title":"old","doing":true}`,
      })),
      "a",
    ),
  ).toEqual([])
})

test("an edge naming a mirror means the node it shows", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"a","ord":"a","title":"a","todo":true,"after":["m"]}\n` +
      `{"id":"b","ord":"b","title":"the real one","doing":true}\n` +
      `{"id":"m","ord":"c","mirror":"b"}\n` +
      `{"id":"c","ord":"d","title":"c","doing":true,"blocks":["m2"]}\n` +
      `{"id":"m2","ord":"e","mirror":"a"}`,
  }))
  expect(waiting(derived, "a")).toEqual(["b doing", "c doing"])
  expect(derived.blocked.has("m2")).toBe(false)
  expect(derived.after.get("a")).toEqual(["b", "c"])
  expect(derived.after.has("m2")).toBe(false)
})

test("a node's own after targets come before anything that blocks it", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"early","ord":"a","title":"early","doing":true,"blocks":["subject"]}\n` +
      `{"id":"own","ord":"b","title":"own","doing":true}\n` +
      `{"id":"subject","ord":"c","title":"subject","todo":true,"after":["own"]}`,
  ))
  expect(waiting(derived, "subject")).toEqual(["own doing", "early doing"])

  const paired = derive(TEST_CLAIMS, nodesOf(
    `{"id":"early","ord":"a","title":"early","doing":true,"blocks":["subject"]}\n` +
      `{"id":"own","ord":"b","title":"own","doing":true,"blocks":["subject"]}\n` +
      `{"id":"subject","ord":"c","title":"subject","todo":true,"after":["own"]}`,
  ))
  expect(paired.after.get("subject")).toEqual(["own", "early"])
  expect(waiting(paired, "subject")).toEqual(["own doing", "early doing"])
})

test("a row, a mirror row and a page all say what the node is waiting on", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"first","ord":"a","title":"first","doing":true}\n` +
      `{"id":"second","ord":"b","title":"second","todo":true,"after":["first"]}\n` +
      `{"id":"m","ord":"c","mirror":"second"}`,
  ))
  const rows = rowsOf(derived, FIXTURE_FILE)
  expect(rows.map((row) => row.blocked.map((one) => one.at.node.id))).toEqual([
    [],
    ["first"],
    ["first"],
  ])
  expect(situate(derived, drawn(rows, 1).shows).blocked.map((one) => one.at.node.id))
    .toEqual(["first"])
})

test("a mirror row carries both halves of the waiting glyph", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"first","ord":"a","title":"first","doing":true}\n` +
      `{"id":"second","ord":"b","title":"second","todo":true,"after":["first"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"second"}`,
  }))
  const mirror = drawn(rowsOf(derived, "b.olai"), 0)
  expect(mirror.kind).toBe("mirror")
  expect(mirror.status).toBe("todo")
  expect(mirror.blocked.map((one) => `${one.at.node.id} ${one.status}`)).toEqual([
    "first doing",
  ])
})

test("a dangling row is waiting on nothing", () => {
  const rows = rowsOf(derive(TEST_CLAIMS, nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)), FIXTURE_FILE)
  expect(rows[0]?.blocked).toEqual([])
})

test("an after loop derives without hanging", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"a","doing":true,"after":["b"]}\n` +
      `{"id":"b","ord":"b","title":"b","doing":true,"after":["a"]}`,
  ))
  expect(waiting(derived, "a")).toEqual(["b doing"])
  expect(waiting(derived, "b")).toEqual(["a doing"])
})

test("a loop closing through a mirror is one loop in the graph", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"x","doing":true,"after":["m"]}\n` +
      `{"id":"y","ord":"b","title":"y","doing":true,"after":["x"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"y"}`,
  }))
  expect(waiting(derived, "x")).toEqual(["y doing"])
  expect(waiting(derived, "y")).toEqual(["x doing"])
  expect(derived.after.get("x")).toEqual(["y"])
  expect(derived.after.get("y")).toEqual(["x"])
})

test("a mirror is filed under the node its chain ends at, not the hop before", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"the real one"}`,
    "b.olai": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"x"}`,
  }))
  expect(members(derived.mirrorsOf, "x")).toEqual(["m1", "m2"])
  expect(derived.mirrorsOf.has("m2")).toBe(false)
})

test("a chain that shows no node, and a node that shows itself, are filed nowhere", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"gone","ord":"a","mirror":"nobody"}\n` +
      `{"id":"loop","ord":"b","mirror":"loop"}\n` +
      `{"id":"plain","ord":"c","title":"plain"}`,
  ))
  expect(derived.mirrorsOf.size).toBe(0)
})

test("a node's mirrors are listed once each", () => {
  const derived = derive(TEST_CLAIMS, nodesOfFiles({
    "a.olai": `{"id":"x","ord":"a","title":"x"}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"x"}`,
    "c.olai": `{"id":"m","ord":"a","mirror":"x"}`,
  }))
  expect(members(derived.mirrorsOf, "x")).toEqual(["m"])
})

test("the ordering graph reversed says who was waiting on a node", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x","doing":true,"blocks":["e"]}\n` +
      `{"id":"m","ord":"b","mirror":"x"}\n` +
      `{"id":"a","ord":"c","title":"a","todo":true,"after":["m"]}\n` +
      `{"id":"e","ord":"d","title":"e","todo":true}`,
  ))
  expect(derived.after.get("a")).toEqual(["x"])
  expect(derived.after.get("e")).toEqual(["x"])
  expect(members(derived.edgesTo, "x")).toEqual(["a", "e"])
  expect(derived.edgesTo.has("m")).toBe(false)
  expect(derived.edgesTo.has("a")).toBe(false)
})

test("a target named twice is one edge, read forwards and backwards", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x","doing":true}\n` +
      `{"id":"a","ord":"b","title":"a","todo":true,"after":["x","x"]}`,
  ))
  expect(derived.after.get("a")).toEqual(["x"])
  expect(members(derived.edgesTo, "x")).toEqual(["a"])
})

test("a record is filed under the id it wrote, not the node that id means", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"m","ord":"b","mirror":"x"}\n` +
      `{"id":"a","ord":"c","title":"a","after":["m"],"see":["m"]}\n` +
      `{"id":"b","ord":"d","title":"b","blocks":["m"]}`,
  ))
  expect(namers(derived, "m")).toEqual(["a after,see", "b blocks"])
  expect(derived.edgesTo.has("m")).toBe(false)
  expect(namers(derived, "x")).toEqual(["m mirror"])
})

test("a field naming the same id twice is named once", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"a","after":["x","x"],"see":["x"]}`,
  ))
  expect(namers(derived, "x")).toEqual(["a after,see"])
})

test("a tag is filed under the tag as written, in prose of either kind", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"about @x"}\n` +
      `{"id":"b","ord":"c","title":"b","desc":"and @x again, and @alice"}`,
  ))
  expect(taggers(derived, "@x")).toEqual(["a", "b"])
  expect(taggers(derived, "@alice")).toEqual(["b"])
})

test("a `#topic` and an `@person` spelled alike are two keys", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"a","ord":"b","title":"ask @herbs"}\n` +
      `{"id":"b","ord":"c","title":"filed under #herbs"}`,
  ))
  expect(taggers(derived, "@herbs")).toEqual(["a"])
  expect(taggers(derived, "#herbs")).toEqual(["b"])
  expect(derived.taggedBy.has("herbs")).toBe(false)
})

test("a record writing one tag twice is one entry of it", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"@x and @x","desc":"still @x"}`,
  ))
  expect(taggers(derived, "@x")).toEqual(["a"])
})

test("a mirror tags nothing, having no prose to tag with", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"x","ord":"a","title":"x"}\n{"id":"m","ord":"b","mirror":"x"}`,
  ))
  expect(derived.taggedBy.size).toBe(0)
})

test("the alphabet is the title's own, and a sigil inside a word starts nothing", () => {
  const derived = derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","ord":"a","title":"write to sam@herbs.example"}\n` +
      `{"id":"b","ord":"b","title":"filed under #herbs"}\n` +
      `{"id":"c","ord":"c","title":"(@herbs) and @work/olai"}`,
  ))
  expect(taggers(derived, "@herbs")).toEqual(["c"])
  expect(taggers(derived, "#herbs")).toEqual(["b"])
  expect(taggers(derived, "@work/olai")).toEqual(["c"])
})

test("a mirror row is drawn with its target's children", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p","doing":true}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = rowsOf(derive(TEST_CLAIMS, nodes), "a.olai")
  const mirror = drawn(rows, 0)
  expect(mirror.kind).toBe("mirror")
  expect(mirror.at.node.id).toBe("m")
  expect(mirror.shows.node.id).toBe("p")
  expect(mirror.shows.node.title).toBe("p")
  expect(mirror.children.map((row) => row.at.node.id)).toEqual(["c"])
  expect(mirror.status).toBe("doing")
  expect(mirror.progress).toEqual({ done: 1, total: 1 })
  const node = drawn(rows, 1)
  expect(node.kind).toBe("node")
  expect(node.at).toBe(node.shows)
})

test("a mirror of a mirror shows the node at the end of the chain, with its children", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"c","title":"the real one"}\n` +
      `{"id":"kid","parent":"p","ord":"a","title":"kid"}\n` +
      `{"id":"hop","ord":"b","mirror":"p"}\n` +
      `{"id":"far","ord":"a","mirror":"hop"}`,
  )
  const far = drawn(rowsOf(derive(TEST_CLAIMS, nodes), "a.olai"), 0)
  expect(far.at.node.id).toBe("far")
  expect(far.kind).toBe("mirror")
  expect(far.shows.node.id).toBe("p")
  expect(far.shows.node.title).toBe("the real one")
  expect(shape([far])).toEqual(["/far mirror", "/far/kid node"])
})

test("one node reached through two places has two keys", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c"}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = shape(rowsOf(derive(TEST_CLAIMS, nodes), "a.olai"))
  expect(rows).toEqual(["/m mirror", "/m/c node", "/p node", "/p/c node"])
  expect(new Set(rows).size).toBe(rows.length)
})

test("a mirror with no target is a dangling row with no children", () => {
  const nodes = nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)
  const rows = rowsOf(derive(TEST_CLAIMS, nodes), "a.olai")
  expect(rows.map(stubbed)).toEqual(["dangling gone"])
  expect(rows.map((row) => "shows" in row)).toEqual([false])
  expect(rows[0]?.children).toEqual([])
})

test("a dangling row names where the chain died, not the first hop", () => {
  const nodes = nodesOf(
    `{"id":"a","ord":"a","mirror":"b"}\n{"id":"b","ord":"b","mirror":"c"}`,
  )
  const rows = rowsOf(derive(TEST_CLAIMS, nodes), "a.olai")
  expect(rows.map(stubbed)).toEqual(["dangling c", "dangling c"])
  expect(rows.map((row) => row.at.node.id)).toEqual(["a", "b"])
})

test("a mirror chain that closes on itself is a cycle naming where it closed", () => {
  const itself = nodesOf(`{"id":"m","ord":"a","mirror":"m"}`)
  expect(rowsOf(derive(TEST_CLAIMS, itself), "a.olai").map(stubbed)).toEqual(["cycle m"])

  const pair = nodesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  const rows = rowsOf(derive(TEST_CLAIMS, pair), "a.olai")
  expect(rows.map(stubbed)).toEqual(["cycle m1", "cycle m2"])
  expect(rows.every((row) => row.children.length === 0)).toBe(true)

  const into = nodesOf(
    `{"id":"a","ord":"a","mirror":"b"}\n` +
      `{"id":"b","ord":"b","mirror":"c"}\n` +
      `{"id":"c","ord":"c","mirror":"b"}`,
  )
  expect(rowsOf(derive(TEST_CLAIMS, into), "a.olai").map(stubbed))
    .toEqual(["cycle b", "cycle b", "cycle c"])
})

test("a mirror inside its own subtree is a cycle stub, not a hang", () => {
  const nodes = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  )
  const rows = rowsOf(derive(TEST_CLAIMS, nodes), "a.olai")
  expect(shape(rows)).toEqual(["/a node", "/a/m cycle"])
  expect(rows[0]?.children.map(stubbed)).toEqual(["cycle a"])

  const deep = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"a","title":"b"}\n` +
      `{"id":"m","parent":"b","ord":"b","mirror":"a"}`,
  )
  const deepRows = rowsOf(derive(TEST_CLAIMS, deep), "a.olai")
  expect(shape(deepRows)).toEqual(["/a node", "/a/b node", "/a/b/m cycle"])
  expect(deepRows[0]?.children[0]?.children.map(stubbed)).toEqual(["cycle a"])
})

test("roots are the requested file's own top-level nodes, in ord order", () => {
  const nodes = nodesOfFiles({
    "a.olai": `{"id":"second","ord":"b","title":"b"}\n` +
      `{"id":"first","ord":"a","title":"a"}\n` +
      `{"id":"kid","parent":"first","ord":"a","title":"kid"}`,
    "b.olai": `{"id":"elsewhere","ord":"a","title":"elsewhere"}`,
  })
  const derived = derive(TEST_CLAIMS, nodes)
  expect(shape(rowsOf(derived, "a.olai")))
    .toEqual(["/first node", "/first/kid node", "/second node"])
  expect(shape(rowsOf(derived, "b.olai"))).toEqual(["/elsewhere node"])
  expect(rowsOf(derived, "c.olai")).toEqual([])
})

const HOUSEWORK = `{"id":"kitchen","ord":"a0","title":"kitchen","doing":true}\n` +
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demo","done":true}\n` +
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install"}\n` +
  `{"id":"handles","parent":"install","ord":"a0","title":"handles","doing":true}`

test("hiding what is done drops the done rows and keeps the rest", () => {
  const rows = rowsOf(derive(TEST_CLAIMS, nodesOf(HOUSEWORK)), FIXTURE_FILE)
  expect(shape(rows)).toEqual([
    "/kitchen node",
    "/kitchen/demo node",
    "/kitchen/install node",
    "/kitchen/install/handles node",
  ])
  expect(shape(withoutDone(rows))).toEqual([
    "/kitchen node",
    "/kitchen/install node",
    "/kitchen/install/handles node",
  ])
})

test("a stored done hides the whole subtree under it, bullets included", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS,
      nodesOf(
        `{"id":"finished","ord":"a0","title":"finished","done":"2026-08-10"}\n` +
          `{"id":"one","parent":"finished","ord":"a0","title":"one","done":true}\n` +
          `{"id":"two","parent":"finished","ord":"a1","title":"two","doing":true}\n` +
          `{"id":"aside","parent":"finished","ord":"a2","title":"how it went"}`,
      ),
    ),
    FIXTURE_FILE,
  )
  expect(withoutDone(rows)).toEqual([])
})

test("a parent nobody marked is not hidden, however finished its children are", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS,
      nodesOf(
        `{"id":"agents","ord":"a0","title":"agents"}\n` +
          `{"id":"chat","parent":"agents","ord":"a0","title":"chat","done":true}\n` +
          `{"id":"acp","parent":"agents","ord":"a1","title":"acp","done":true}\n` +
          `{"id":"finding","parent":"agents","ord":"a2","title":"nothing wakes a chat agent"}`,
      ),
    ),
    FIXTURE_FILE,
  )
  expect(shape(withoutDone(rows))).toEqual([
    "/agents node",
    "/agents/finding node",
  ])
  const agents = drawn(rows, 0)
  expect(agents.status).toBeUndefined()
  expect(agents.progress).toEqual({ done: 2, total: 2 })
})

test("done-hidden drops a mirror of a done node with the subtree it draws", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS, nodesOfFiles({
      "a.olai": `{"id":"finished","ord":"a","title":"finished","done":"2026-08-11"}\n` +
        `{"id":"how","parent":"finished","ord":"a","title":"how it went"}\n` +
        `{"id":"open","ord":"b","title":"open","doing":true}`,
      "b.olai": `{"id":"m-finished","ord":"a","mirror":"finished"}\n` +
        `{"id":"m-open","ord":"b","mirror":"open"}`,
    })),
    "b.olai",
  )
  expect(shape(rows)).toEqual([
    "/m-finished mirror",
    "/m-finished/how node",
    "/m-open mirror",
  ])
  expect(shape(withoutDone(rows))).toEqual(["/m-open mirror"])
})

test("hiding leaves the rows it was given alone", () => {
  const rows = rowsOf(derive(TEST_CLAIMS, nodesOf(HOUSEWORK)), FIXTURE_FILE)
  const before = shape(rows)
  withoutDone(rows)
  expect(shape(rows)).toEqual(before)
})

test("a kept place is drawn — and nothing the path did not name comes back with it", () => {
  const rows = rowsOf(derive(TEST_CLAIMS, nodesOf(HOUSEWORK)), FIXTURE_FILE)
  const keep = new Set([rows[0]!.children[0]!.key])
  expect(shape(withoutDone(rows, keep))).toEqual([
    "/kitchen node",
    "/kitchen/demo node",
    "/kitchen/install node",
    "/kitchen/install/handles node",
  ])
  expect(shape(withoutDone(rows, new Set(["nobody/home"])))).toEqual(
    shape(withoutDone(rows)),
  )
})

test("a kept DONE ANCESTOR re-asks the question of every child — done children under it stay hidden", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS,
      nodesOf(
        `{"id":"finished","ord":"a0","title":"finished","done":"2026-08-10"}\n` +
          `{"id":"one","parent":"finished","ord":"a0","title":"one","done":true}\n` +
          `{"id":"two","parent":"finished","ord":"a1","title":"two","doing":true}`,
      ),
    ),
    FIXTURE_FILE,
  )
  const keep = new Set([rows[0]!.key, rows[0]!.children[1]!.key])
  expect(shape(withoutDone(rows, keep))).toEqual([
    "/finished node",
    "/finished/two node",
  ])
})

test("the reservation is keyed on the PLACE — a kept node leaves its other mirrors hidden", () => {
  const rows = rowsOf(
    derive(TEST_CLAIMS, nodesOfFiles({
      "a.olai": `{"id":"finished","ord":"a","title":"finished","done":"2026-08-11"}\n` +
        `{"id":"open","ord":"b","title":"open","doing":true}`,
      "b.olai": `{"id":"m-finished","ord":"a","mirror":"finished"}\n` +
        `{"id":"m-open","ord":"b","mirror":"open"}`,
    })),
    "b.olai",
  )
  expect(shape(withoutDone(rows, new Set([rows[0]!.key])))).toEqual([
    "/m-finished mirror",
    "/m-open mirror",
  ])
})

const tags = (title: string): ReadonlyArray<string> =>
  titleParts(title).flatMap((part) => (part.kind === "tag" ? [tagText(part)] : []))

test("a title splits into text and tags, and rejoins to itself", () => {
  const parts = titleParts("call #alice about #work/olai now")
  expect(parts).toEqual([
    { kind: "text", text: "call " },
    { kind: "tag", sigil: "#", tag: "alice" },
    { kind: "text", text: " about " },
    { kind: "tag", sigil: "#", tag: "work/olai" },
    { kind: "text", text: " now" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? tagText(part) : part.text)).join(""),
  ).toBe("call #alice about #work/olai now")
})

test("an @tag is a tag, and the sigil comes back out with it", () => {
  const parts = titleParts("ask @alice about #work")
  expect(parts).toEqual([
    { kind: "text", text: "ask " },
    { kind: "tag", sigil: "@", tag: "alice" },
    { kind: "text", text: " about " },
    { kind: "tag", sigil: "#", tag: "work" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? tagText(part) : part.text)).join(""),
  ).toBe("ask @alice about #work")
})

test("the sigils are two namespaces", () => {
  expect(tags("@alice and #alice")).toEqual(["@alice", "#alice"])
})

test("an @ inside a word is text, and a # inside one is still a tag", () => {
  expect(tags("mail srid@srid.ca about it")).toEqual([])
  expect(tags("(@alice) and [@bob]")).toEqual(["@alice", "@bob"])
  expect(tags("@carol first")).toEqual(["@carol"])
  expect(tags("issue#42")).toEqual(["#42"])
})

test("a bare sigil is text", () => {
  expect(titleParts("issue # 42")).toEqual([{ kind: "text", text: "issue # 42" }])
  expect(tags("issue # 42")).toEqual([])
  expect(tags("reply @ noon")).toEqual([])
})

test("tags come out in reading order, over the tag alphabet", () => {
  expect(tags("#b then #a then #b again")).toEqual(["#b", "#a", "#b"])
  expect(tags("#Tag-1 #tag_2")).toEqual(["#Tag-1", "#tag_2"])
})

test("titleTagRe is the alphabet titleParts uses, fresh each call", () => {
  const one = titleTagRe()
  const other = titleTagRe()
  expect(one).not.toBe(other)
  expect(one.source).toBe(other.source)
  expect([..."#work/olai mid @a-b".matchAll(one)].map((m) => m[0])).toEqual([
    "#work/olai",
    "@a-b",
  ])
})

test("TAG_SIGILS is what titleTagRe matches", () => {
  expect([...TAG_SIGILS]).toEqual(["#", "@"])
  for (const sigil of TAG_SIGILS) {
    expect(tags(`a ${sigil}thing`)).toEqual([`${sigil}thing`])
  }
})

test("the tag predicates agree with the alphabet they are about", () => {
  for (const name of ["home", "work/olai", "Tag-1", "tag_2", ""]) {
    expect(isTagName(name)).toBe(true)
    if (name !== "") expect(tags(`a #${name}`)).toEqual([`#${name}`])
  }
  for (const name of ["a b", "a.b", "a!", "a#b"]) expect(isTagName(name)).toBe(false)
})

test("a sigil opens a tag at a word start and nowhere else", () => {
  expect(tagOpensAt("@a", 0)).toBe(true)
  for (const before of [" ", "(", "[", "{"]) {
    expect(tagOpensAt(`x${before}@a`, 2)).toBe(true)
    expect(tags(`x${before}@a`)).toEqual(["@a"])
  }
  expect(tagOpensAt("srid@srid", 4)).toBe(false)
  expect(tags("srid@srid")).toEqual([])
})

test("a title with no sigil in it cannot hold a tag", () => {
  expect(mayHoldTag("order the new cabinets")).toBe(false)
  expect(mayHoldTag("issue # 42")).toBe(true)
  expect(mayHoldTag("srid@srid.ca")).toBe(true)
  for (const title of ["a #home", "a @alice"]) {
    expect(mayHoldTag(title)).toBe(true)
    expect(tags(title).length).toBe(1)
  }
})

test("a cyclic set derives without hanging", () => {
  const parents = statusesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a","doing":true}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )
  expect(parents.get("a")).toBe("doing")
  expect(parents.get("b")).toBeUndefined()
  expect(progressOf(derive(TEST_CLAIMS, nodesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a","doing":true}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )), "b")).toEqual({ done: 0, total: 1 })

  const mirrors = statusesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  expect(mirrors.get("m1")).toBeUndefined()
  expect(mirrors.get("m2")).toBeUndefined()

  expect(statusesOf(`{"id":"m","ord":"a","mirror":"gone"}`).get("m")).toBeUndefined()
})

const UNDER_HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
].join("\n")
const UNDER_GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
].join("\n")

const UNDER = derive(TEST_CLAIMS,
  nodesOfFiles({ "house.olai": UNDER_HOUSE, "garden.olai": UNDER_GARDEN }),
)

const underRow = (rows: ReadonlyArray<Row>, id: string): Row => {
  for (const row of rows) {
    if (row.at.node.id === id) return row
    const deeper = underRowOrNone(row.children, id)
    if (deeper !== undefined) return deeper
  }
  throw new Error(`no row for \`${id}\``)
}
const underRowOrNone = (rows: ReadonlyArray<Row>, id: string): Row | undefined => {
  for (const row of rows) {
    if (row.at.node.id === id) return row
    const deeper = underRowOrNone(row.children, id)
    if (deeper !== undefined) return deeper
  }
  return undefined
}

test("the count is the records an archive would move", () => {
  expect(under(UNDER, "kitchen")).toBe(5)
  expect(underRow(rowsOf(UNDER, "house.olai"), "kitchen").under).toBe(5)
})

test("a leaf takes nothing with it", () => {
  expect(under(UNDER, "handles")).toBe(0)
  expect(underRow(rowsOf(UNDER, "house.olai"), "handles").under).toBe(0)
})

test("a mirror's row counts what its TARGET holds, which is what it draws", () => {
  expect(underRow(rowsOf(UNDER, "house.olai"), "kitchen-herbs").under).toBe(1)
})

test("hiding what is done does not shrink what an archive would take", () => {
  const showing = withoutDone(rowsOf(UNDER, "house.olai"))
  expect(underRow(showing, "kitchen").children.some((row) => row.at.node.id === "demo"))
    .toBe(false)
  expect(underRow(showing, "kitchen").under).toBe(5)
})

const walkOver = (records: ReadonlyArray<Located>): ((id: string) => Located | undefined) => {
  const byId = new Map(records.map((at) => [at.node.id, at]))
  return (id) => byId.get(id)
}

const HOUSE = [
  `{"id":"house","ord":"a0","title":"house"}`,
  `{"id":"kitchen","parent":"house","ord":"a0","title":"kitchen"}`,
  `{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}`,
  `{"id":"shed","ord":"a1","title":"shed"}`,
].join("\n")

test("the ancestry walk climbs whatever index it is handed", () => {
  const standing = nodesOf(HOUSE)
  expect(ids(ancestryOver(walkOver(standing), "sink"))).toEqual(["house", "kitchen"])
  expect(ids(ancestorsOf(derive(TEST_CLAIMS, standing), "sink"))).toEqual(["house", "kitchen"])
})

test("…so a record that has not been written yet has an ancestry", () => {
  const planned = nodesOf(HOUSE.replace(`"parent":"kitchen"`, `"parent":"shed"`))
  expect(ids(ancestryOver(walkOver(planned), "sink"))).toEqual(["shed"])
  expect(ids(ancestorsOf(derive(TEST_CLAIMS, nodesOf(HOUSE)), "sink"))).toEqual(["house", "kitchen"])
})

test("the stopping rules travelled with the walk, not with the derivation", () => {
  const mirrored = nodesOf([
    `{"id":"house","ord":"a0","title":"house"}`,
    `{"id":"ghost","parent":"house","ord":"a0","mirror":"shed"}`,
    `{"id":"sink","parent":"ghost","ord":"a0","title":"sink"}`,
  ].join("\n"))
  expect(ids(ancestryOver(walkOver(mirrored), "sink"))).toEqual([])

  const looped = nodesOf([
    `{"id":"one","parent":"two","ord":"a0","title":"one"}`,
    `{"id":"two","parent":"one","ord":"a1","title":"two"}`,
  ].join("\n"))
  expect(ids(ancestryOver(walkOver(looped), "one"))).toEqual(["two"])

  expect(ids(ancestryOver(walkOver(nodesOf(HOUSE)), "nobody"))).toEqual([])
})
test("changesUnder counts what moved under a node, and never the node's own record", () => {
  const derived = derive(TEST_CLAIMS, nodesOf([
    `{"id":"health","ord":"a0","title":"health","created":"2026-08-01T09:00:00+00:00","changed":"2026-08-30T09:00:00+00:00"}`,
    `{"id":"old","parent":"health","ord":"a0","title":"old","changed":"2026-08-02T09:00:00+00:00"}`,
    `{"id":"deep","parent":"old","ord":"a0","title":"deep","changed":"2026-08-10T09:00:00+00:00"}`,
  ].join("\n")))

  expect(changesUnder(derived, "health", "2026-08-09T00:00:00+00:00"))
    .toEqual({ rows: 1, newest: Date.parse("2026-08-10T09:00:00+00:00"), oldest: Date.parse("2026-08-10T09:00:00+00:00") })
  expect(changesUnder(derived, "health", "2026-08-30T09:00:00+00:00"))
    .toEqual({ rows: 0, newest: Date.parse("2026-08-10T09:00:00+00:00"), oldest: null })
  expect(changesUnder(derived, "health", null)).toEqual({
    rows: 2,
    newest: Date.parse("2026-08-10T09:00:00+00:00"),
    oldest: Date.parse("2026-08-02T09:00:00+00:00"),
  })
  expect(changesUnder(derived, "old", null)).toEqual({
    rows: 1,
    newest: Date.parse("2026-08-10T09:00:00+00:00"),
    oldest: Date.parse("2026-08-10T09:00:00+00:00"),
  })
})

test("a stamp in another zone is compared by its instant, not its spelling", () => {
  const derived = derive(TEST_CLAIMS, nodesOf([
    `{"id":"health","ord":"a0","title":"health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"synced","changed":"2026-10-12T09:00:00-07:00"}`,
  ].join("\n")))

  expect(changesUnder(derived, "health", "2026-10-12T20:00:00+05:30").rows).toBe(1)
  expect(changesUnder(derived, "health", "2026-10-12T20:00:00+00:00").rows).toBe(0)
})

test("changesUnder answers nothing at all for a subtree nothing has ever stamped", () => {
  const derived = derive(TEST_CLAIMS, nodesOf([
    `{"id":"health","ord":"a0","title":"health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"note"}`,
  ].join("\n")))
  expect(changesUnder(derived, "health", null)).toEqual({ rows: 0, newest: null, oldest: null })
  expect(changesUnder(derived, "health", "2026-01-01T00:00:00+00:00")).toEqual({ rows: 0, newest: null, oldest: null })
  expect(changesUnder(derived, "note", null).rows).toBe(0)
})

test("changesUnder walks through a mirror and terminates on a loop", () => {
  const derived = derive(TEST_CLAIMS, nodesOf([
    `{"id":"health","ord":"a0","title":"health"}`,
    `{"id":"placed","parent":"health","ord":"a0","mirror":"elsewhere"}`,
    `{"id":"deep","parent":"placed","ord":"a0","title":"deep","changed":"2026-09-01T09:00:00+00:00"}`,
  ].join("\n")))
  expect(changesUnder(derived, "health", "2026-08-01T00:00:00+00:00").rows).toBe(1)

  const looped = derive(TEST_CLAIMS, nodesOf([
    `{"id":"one","parent":"two","ord":"a0","title":"one","changed":"2026-09-01T09:00:00+00:00"}`,
    `{"id":"two","parent":"one","ord":"a1","title":"two"}`,
  ].join("\n")))
  expect(changesUnder(looped, "two", null).rows).toBe(1)
  expect(changesUnder(looped, "one", null).rows).toBe(0)
  expect(changesUnder(looped, "two", "2026-09-01T09:00:00+00:00").rows).toBe(0)
})

test("a node agent under another is not part of its memory", () => {
  const derived = derive(TEST_CLAIMS, [
    ...nodesOf([
      `{"id":"health","ord":"a0","title":"health"}`,
      `{"id":"helper","parent":"health","ord":"a0","title":"helper","custom":{"agent-session":"claude:h"}}`,
    ].join("\n"), "Work.olai"),
    ...nodesOf(
      `{"id":"note","parent":"helper","ord":"a0","title":"the helper's own","changed":"2026-10-12T09:00:00+00:00"}`,
      "Helper.olai",
    ),
  ])
  const stop = new Set(["helper"])

  expect(changesUnder(derived, "health", "2026-10-12T08:00:00+00:00", stop).rows).toBe(0)
  expect([...memoryFiles(derived, "health", stop)].sort()).toEqual(["Work.olai"])

  expect(changesUnder(derived, "health", "2026-10-12T08:00:00+00:00").rows).toBe(1)
  expect([...memoryFiles(derived, "health")].sort()).toEqual(["Helper.olai", "Work.olai"])
})