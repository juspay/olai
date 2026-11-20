import type { Row } from "@olai/format"
import type { Anchor } from "@olai/surface"
import { expect, test } from "bun:test"

import { emptyPending } from "./draft.ts"
import { flatten, neighbour, reanchored, seated, wired } from "./order.ts"
import type { Wire } from "./order.ts"
const row = (id: string, key: string, children: ReadonlyArray<Row> = []): Row =>
  ({
    kind: "node",
    key,
    children,
    at: { file: "house.olai", node: { id } },
    shows: { file: "house.olai", node: { id } },
  } as unknown as Row)

const tree: ReadonlyArray<Row> = [
  row("a", "/a", [
    row("a1", "/a/a1", [row("a1x", "/a/a1/a1x")]),
    row("a2", "/a/a2"),
    row("a3", "/a/a3"),
  ]),
  row("b", "/b"),
]

const keys = (rows: ReadonlyArray<Row>): ReadonlyArray<string> => rows.map((r) => r.key)

test("the drawn order is the order they are painted in", () => {
  expect(keys(flatten(tree, new Set()))).toEqual([
    "/a",
    "/a/a1",
    "/a/a1/a1x",
    "/a/a2",
    "/a/a3",
    "/b",
  ])
})

test("a folded branch's children are not on screen, so they are not in it", () => {
  expect(keys(flatten(tree, new Set(["a1"])))).toEqual([
    "/a",
    "/a/a1",
    "/a/a2",
    "/a/a3",
    "/b",
  ])
})

test("the fold set is read by NODE, not by the place the row sits in", () => {
  expect(keys(flatten(tree, new Set(["/a/a1"])))).toEqual([
    "/a",
    "/a/a1",
    "/a/a1/a1x",
    "/a/a2",
    "/a/a3",
    "/b",
  ])
})

test("the arrows step through what is drawn, across levels", () => {
  expect(neighbour(flatten(tree, new Set()), "/a/a1/a1x", 1)?.key).toBe("/a/a2")
  expect(neighbour(flatten(tree, new Set()), "/a/a3", 1)?.key).toBe("/b")
  expect(neighbour(flatten(tree, new Set()), "/b", -1)?.key).toBe("/a/a3")
})

test("`↓` over a folded branch skips what it is hiding", () => {
  expect(neighbour(flatten(tree, new Set(["a1"])), "/a/a1", 1)?.key).toBe("/a/a2")
})

test("either end of the page is where the caret stays", () => {
  expect(neighbour(flatten(tree, new Set()), "/a", -1)).toBeUndefined()
  expect(neighbour(flatten(tree, new Set()), "/b", 1)).toBeUndefined()
})

test("a place that is not drawn has no neighbours", () => {
  expect(neighbour(flatten(tree, new Set()), "/gone", 1)).toBeUndefined()
})

const spelled = (list: ReadonlyArray<Wire>): ReadonlyArray<string> =>
  list.map((one) => one.kind === "row" ? one.row.key : `(${one.pending.slot})`)

test("a draft stands exactly where its ghost is drawn", () => {
  expect(
    spelled(wired(tree, new Set(), [
      emptyPending({ kind: "before", id: "a1" }, "d1"),
      emptyPending({ kind: "after", id: "a1" }, "d2"),
      emptyPending({ kind: "under", id: "b" }, "d3"),
    ])),
  ).toEqual([
    "/a",
    "(d1)",
    "/a/a1",
    "/a/a1/a1x",
    "(d2)",
    "/a/a2",
    "/a/a3",
    "/b",
    "(d3)",
  ])
})

test("a folded branch's floor is the row itself", () => {
  expect(
    spelled(wired(tree, new Set(["a1"]), [emptyPending({ kind: "after", id: "a1" }, "d1")])),
  ).toEqual(["/a", "/a/a1", "(d1)", "/a/a2", "/a/a3", "/b"])
})

test("drafts on the same spot keep the order they were laid out in", () => {
  expect(
    spelled(wired(tree, new Set(), [
      emptyPending({ kind: "after", id: "a2" }, "d1"),
      emptyPending({ kind: "after", id: "a2" }, "d2"),
      emptyPending({ kind: "after", id: "a2" }, "d3"),
    ])),
  ).toEqual(["/a", "/a/a1", "/a/a1/a1x", "/a/a2", "(d1)", "(d2)", "(d3)", "/a/a3", "/b"])
})

test("an empty page's start line is the whole walk", () => {
  expect(
    spelled(wired([], new Set(), [emptyPending({ kind: "first", file: "house.olai" }, "d1")])),
  ).toEqual(["(d1)"])
})

test("no drafts is the flattening itself, and the same values it answers", () => {
  const list = wired(tree, new Set(), [])
  expect(spelled(list)).toEqual(keys(flatten(tree, new Set())))
  expect(list.every((one) => one.kind === "row")).toBe(true)
})

const seat = (
  rows: ReadonlyArray<Row> = tree,
  collapsed: ReadonlySet<string> = new Set(),
  at: Anchor,
  way: Parameters<typeof reanchored>[3],
  drafts: Parameters<typeof reanchored>[4] = [],
) => reanchored(rows, collapsed, emptyPending(at, "seat"), way, drafts)

test("Tab seats the blank as the previous sibling's LAST child, one level in", () => {
  expect(seat(tree, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a1x" }, "in"))
    .toEqual({ at: { kind: "under", id: "a1x" } })
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "in"))
    .toEqual({ at: { kind: "under", id: "b" } })
  expect(seat(tree, new Set(), { kind: "before", id: "a1" }, "in")).toBeUndefined()
})

test("Tab is ONE level, however deep the trailing subtree", () => {
  const chain: ReadonlyArray<Row> = [
    row("a", "/a", [
      row("a1", "/a/a1", [
        row("a1x", "/a/a1/a1x", [row("a1xy", "/a/a1/a1x/a1xy")]),
      ]),
    ]),
    row("b", "/b"),
  ]
  expect(seat(chain, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  expect(seat(chain, new Set(), { kind: "after", id: "a1" }, "out"))
    .toEqual({ at: { kind: "after", id: "a" } })
})

test("Tab under a childless MIRROR names the node it shows", () => {
  const mirrored: ReadonlyArray<Row> = [
    { ...row("m", "/m"), kind: "mirror", shows: { file: "house.olai", node: { id: "target" } } },
    row("b", "/b"),
  ] as unknown as ReadonlyArray<Row>
  expect(seat(mirrored, new Set(), { kind: "after", id: "m" }, "in"))
    .toEqual({ at: { kind: "under", id: "target" } })
})

test("Tab into a FOLDED branch names the fold to lift", () => {
  expect(seat(tree, new Set(["a"]), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" }, open: { id: "a", file: "house.olai" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" } })
})

test("Shift+Tab slips the blank out of the sibling list it sits in", () => {
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "out"))
    .toEqual({ at: { kind: "after", id: "a" } })
  expect(seat(tree, new Set(), { kind: "under", id: "a1" }, "out"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "out")).toBeUndefined()
})

test("Alt+Shift walks the blank one slot within its sibling list", () => {
  expect(seat(tree, new Set(), { kind: "after", id: "a1" }, "up"))
    .toEqual({ at: { kind: "before", id: "a1" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a1x" }, "up"))
    .toEqual({ at: { kind: "before", id: "a1x" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "up"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a3" }, "up"))
    .toEqual({ at: { kind: "after", id: "a2" } })
  expect(seat(tree, new Set(), { kind: "before", id: "a2" }, "down"))
    .toEqual({ at: { kind: "after", id: "a2" } })
  expect(seat(tree, new Set(), { kind: "before", id: "a1" }, "up")).toBeUndefined()
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "down")).toBeUndefined()
})

test("the structure keys step PAST a parked blank — an anchor names records", () => {
  const cluster = [
    emptyPending({ kind: "after", id: "a2" }, "d1"),
    emptyPending({ kind: "after", id: "a2" }, "d2"),
  ]
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "up", cluster))
    .toEqual({ at: { kind: "after", id: "a1" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "down", cluster))
    .toEqual({ at: { kind: "after", id: "a3" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "in", cluster))
    .toEqual({ at: { kind: "under", id: "a2" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "out", cluster))
    .toEqual({ at: { kind: "after", id: "a" } })
  expect(
    seat(tree, new Set(), { kind: "after", id: "a2" }, "up", [
      emptyPending({ kind: "after", id: "a1x" }, "d1"),
    ]),
  ).toEqual({ at: { kind: "after", id: "a1" } })
})

test("one wire answers where every key stands on it", () => {
  const drafts = [emptyPending({ kind: "after", id: "a1" }, "d1")]
  expect(seated(tree, new Set(), drafts, { kind: "row", place: "/a/a2" }).at).toBe(4)
  expect(seated(tree, new Set(), drafts, { kind: "draft", slot: "d1" }).at).toBe(3)
  expect(seated(tree, new Set(), drafts, { kind: "draft", slot: "gone" }).at).toBe(-1)
  expect(seated(tree, new Set(), drafts, { kind: "row", place: "/nowhere" }).at).toBe(-1)
  expect(seated(tree, new Set(["a1"]), [], { kind: "row", place: "/a/a1/a1x" }).at).toBe(-1)
})
