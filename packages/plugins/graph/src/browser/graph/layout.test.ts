/**
 * The layout, as arithmetic: it fits the frame, it is the same picture twice,
 * and it is not redone for a graph that would settle the same way.
 *
 * What is NOT asserted is where any particular dot lands. That is the force
 * library's answer and pinning it here would be a test of `d3-force`'s
 * constants — the first tuning change would fail it while the picture got
 * better. What matters to a reader is the three promises below.
 */

import type { DocumentPath, Edge, NodeId, Vertex } from "@olai/format"
import { expect, test } from "bun:test"

import { type Frame, placed, sameShape, type Shaped } from "./layout.ts"

/** A box to draw in — the numbers are a fixture rather than a constant now that
 *  the real one is measured off the page (`./looking.ts`). */
const FRAME: Frame = { width: 1000, height: 560 }

const node = (id: string, file = "a.olai"): Vertex => ({
  key: `#${id}`,
  address: { kind: "node", id: id as NodeId },
  kind: "node",
  title: id,
  file: file as DocumentPath,
  crumbs: [],
  hops: 0,
})

/** A DOCUMENT vertex — a `.md` somebody wrote that a record named: its dot is
 *  square and its file's name is NOT written, which is what the `named` rule
 *  is for. */
const doc = (path: string, file = path): Vertex => ({
  key: path,
  address: { kind: "document", path: path as DocumentPath },
  kind: "document",
  title: path,
  file: file as DocumentPath,
  crumbs: [],
  hops: 0,
})

const graph = (
  vertices: ReadonlyArray<Vertex>,
  ways: ReadonlyArray<readonly [string, string]>,
): Shaped => ({
  vertices,
  edges: ways.map(([from, to]): Edge => ({ from, to, ways: ["see"] })),
})

const HOUSE = graph(
  [node("a"), node("b"), node("c", "b.olai"), node("d", "b.olai")],
  [["#a", "#b"], ["#b", "#c"], ["#c", "#d"]],
)

test("every dot lands inside the frame", () => {
  for (const spot of placed(HOUSE, FRAME).at.values()) {
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.x).toBeLessThanOrEqual(FRAME.width)
    expect(spot.y).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeLessThanOrEqual(FRAME.height)
  }
})

// The whole reason the simulation is run to rest rather than animated, and the
// reason its starting positions are derived rather than random: a reader who
// comes back to a link finds the shape they left, and a screenshot of this page
// is reproducible.
test("the same graph settles to the same picture, twice running", () => {
  expect([...placed(HOUSE, FRAME).at.values()]).toEqual([...placed(HOUSE, FRAME).at.values()])
})

test("one vertex is a picture of one vertex, in the middle of the frame", () => {
  const only = placed(graph([node("a")], []), FRAME)
  expect(only.at.get("#a")).toEqual({ id: "#a", x: FRAME.width / 2, y: FRAME.height / 2 })
})

test("a graph with nothing in it places nothing", () => {
  expect(placed(graph([], []), FRAME).at.size).toBe(0)
})

// "Files as groupings", as far as this module owns it: one point per file with
// anything on the page, in the sidebar's own path order, at the middle of what
// landed there.
test("each file gets one point, in path order, centred on and level with its own nodes", () => {
  const placement = placed(HOUSE, FRAME)
  expect(placement.files.map((one) => one.file)).toEqual(["a.olai", "b.olai"])
  const named = placement.files.find((one) => one.file === "b.olai")!
  const ends = ["#c", "#d"].map((id) => placement.at.get(id)!)
  expect(named.x).toBeCloseTo((ends[0]!.x + ends[1]!.x) / 2, 6)
  // LEVEL with the lowest of them — the gap that clears that dot's own label
  // is the drawing's, in `rem` (`./Canvas.tsx` says why).
  expect(named.y).toBe(Math.max(ends[0]!.y, ends[1]!.y))
})

// The `named` rule, worded the way the page says it: the picture is a
// directory, so a lone DOCUMENT names itself by its dot — there is no second
// file whose record carries a note.
test("a file holding only document vertices writes no label; one holding an outline writes its own", () => {
  const papers = graph([doc("notes/plan.md"), doc("finishes.md")], [["notes/plan.md", "finishes.md"]])
  expect(placed(papers, FRAME).files).toEqual([])
  const board = graph([doc("Tasks.olai", "Tasks.olai")], [])
  const titled: Vertex = { ...board.vertices[0]!, kind: "outline" }
  expect(placed({ vertices: [titled], edges: [] }, FRAME).files.map((one) => one.file)).toEqual(["Tasks.olai"])
})

// ── what makes the memo above it cheap ────────────────────────────────

test("a graph is the same SHAPE when its keys, files and arrows are", () => {
  expect(sameShape(HOUSE, graph(
    [node("a"), node("b"), node("c", "b.olai"), node("d", "b.olai")],
    [["#a", "#b"], ["#b", "#c"], ["#c", "#d"]],
  ))).toBe(true)
})

// The point of comparing what the layout READS rather than the whole reading: a
// title somebody edited moves a label and must not move the picture out from
// under the reader mid-word.
test("a retitled vertex is the same shape; a re-filed or re-kinded one is not", () => {
  const retitled: Shaped = {
    ...HOUSE,
    vertices: HOUSE.vertices.map((one, index) => index === 0 ? { ...one, title: "new" } : one),
  }
  expect(sameShape(HOUSE, retitled)).toBe(true)

  const moved: Shaped = {
    ...HOUSE,
    vertices: HOUSE.vertices.map((one, index) => index === 0 ? { ...one, file: "z.olai" as DocumentPath } : one),
  }
  expect(sameShape(HOUSE, moved)).toBe(false)

  // A node somebody LINKED as a file: the same key holds a document address
  // now, and the dot has changed SHAPE, so the picture settles again rather
  // than pretending nothing moved.
  const rekinded: Shaped = {
    ...HOUSE,
    vertices: HOUSE.vertices.map((one, index) =>
      index === 0 ? { ...one, kind: "outline" as const } : one
    ),
  }
  expect(sameShape(HOUSE, rekinded)).toBe(false)
})

test("a vertex or an arrow arriving is a different shape", () => {
  expect(sameShape(HOUSE, graph(HOUSE.vertices, [["#a", "#b"], ["#b", "#c"]]))).toBe(false)
  expect(sameShape(
    HOUSE,
    graph([...HOUSE.vertices, node("e")], [["#a", "#b"], ["#b", "#c"], ["#c", "#d"]]),
  )).toBe(false)
})

// The `ways` are a LOOK, not a placement: an edge that gains a second way keeps
// its ends, so the picture stays where it is and only the line changes.
test("an edge that gains a way is the same shape", () => {
  const both: Shaped = {
    ...HOUSE,
    edges: HOUSE.edges.map((edge, index) =>
      index === 0 ? { ...edge, ways: ["see", "mention"] as const } : edge
    ),
  }
  expect(sameShape(HOUSE, both)).toBe(true)
})
