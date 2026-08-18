/**
 * The layout, as arithmetic: it fits the frame, it is the same picture twice,
 * and it is not redone for a graph that would settle the same way.
 *
 * What is NOT asserted is where any particular dot lands. That is the force
 * library's answer and pinning it here would be a test of `d3-force`'s
 * constants — the first tuning change would fail it while the picture got
 * better. What matters to a reader is the three promises below.
 */

import type { Graph, GraphNode, LocatedRegular } from "@olai/format"
import { expect, test } from "bun:test"

import { HEIGHT, placed, sameShape, WIDTH } from "./layout.ts"

const at = (id: string, file: string): LocatedRegular => ({
  file,
  line: 1,
  node: { id, ord: "a0", title: id },
})

const node = (id: string, file = "a.olai"): GraphNode => ({ at: at(id, file), hops: 0 })

const graph = (
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<readonly [string, string]>,
): Graph => ({
  nodes,
  edges: edges.map(([from, to]) => ({ from, to, ways: ["see"] as const })),
})

const HOUSE = graph(
  [node("a"), node("b"), node("c", "b.olai"), node("d", "b.olai")],
  [["a", "b"], ["b", "c"], ["c", "d"]],
)

test("every dot lands inside the frame", () => {
  for (const spot of placed(HOUSE).at.values()) {
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.x).toBeLessThanOrEqual(WIDTH)
    expect(spot.y).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeLessThanOrEqual(HEIGHT)
  }
})

// The whole reason the simulation is run to rest rather than animated, and the
// reason its starting positions are derived rather than random: a reader who
// comes back to a link finds the shape they left, and a screenshot of this page
// is reproducible.
test("the same graph settles to the same picture, twice running", () => {
  expect([...placed(HOUSE).at.values()]).toEqual([...placed(HOUSE).at.values()])
})

test("one node is a picture of one node, in the middle of the frame", () => {
  const only = placed(graph([node("a")], []))
  expect(only.at.get("a")).toEqual({ id: "a", x: WIDTH / 2, y: HEIGHT / 2 })
})

test("a graph with nothing in it places nothing", () => {
  expect(placed(graph([], [])).at.size).toBe(0)
})

// "Files as groupings", as far as this module owns it: one point per file with
// anything on the page, in the sidebar's own path order, at the middle of what
// landed there.
test("each file gets one point, in path order, centred on and level with its own nodes", () => {
  const placement = placed(HOUSE)
  expect(placement.files.map((one) => one.file)).toEqual(["a.olai", "b.olai"])
  const named = placement.files.find((one) => one.file === "b.olai")!
  const ends = ["c", "d"].map((id) => placement.at.get(id)!)
  expect(named.x).toBeCloseTo((ends[0]!.x + ends[1]!.x) / 2, 6)
  // LEVEL with the lowest of them — the gap that clears that dot's own label
  // is the drawing's, in `rem` (`./Canvas.tsx` says why).
  expect(named.y).toBe(Math.max(ends[0]!.y, ends[1]!.y))
})

// ── what makes the memo above it cheap ────────────────────────────────

test("a graph is the same SHAPE when its ids, files and arrows are", () => {
  expect(sameShape(HOUSE, graph(
    [node("a"), node("b"), node("c", "b.olai"), node("d", "b.olai")],
    [["a", "b"], ["b", "c"], ["c", "d"]],
  ))).toBe(true)
})

// The point of comparing what the layout READS rather than the whole reading: a
// title somebody edited moves a label and must not move the picture out from
// under the reader mid-word.
test("a retitled node is the same shape, and a re-filed one is not", () => {
  const retitled: Graph = {
    ...HOUSE,
    nodes: HOUSE.nodes.map((one, index) =>
      index === 0 ? { ...one, at: { ...one.at, node: { ...one.at.node, title: "new" } } } : one
    ),
  }
  expect(sameShape(HOUSE, retitled)).toBe(true)

  const moved: Graph = {
    ...HOUSE,
    nodes: HOUSE.nodes.map((one, index) =>
      index === 0 ? { ...one, at: { ...one.at, file: "z.olai" } } : one
    ),
  }
  expect(sameShape(HOUSE, moved)).toBe(false)
})

test("a node or an arrow arriving is a different shape", () => {
  expect(sameShape(HOUSE, graph(HOUSE.nodes, [["a", "b"], ["b", "c"]]))).toBe(false)
  expect(sameShape(HOUSE, graph([...HOUSE.nodes, node("e")], [["a", "b"], ["b", "c"], [
    "c",
    "d",
  ]]))).toBe(false)
})

// The `ways` are a LOOK, not a placement: an edge that gains a second way keeps
// its ends, so the picture stays where it is and only the line changes.
test("an edge that gains a way is the same shape", () => {
  const both: Graph = {
    ...HOUSE,
    edges: HOUSE.edges.map((edge, index) =>
      index === 0 ? { ...edge, ways: ["see", "mention"] as const } : edge
    ),
  }
  expect(sameShape(HOUSE, both)).toBe(true)
})
