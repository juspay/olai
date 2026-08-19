/**
 * The WALK: which nodes a neighbourhood reaches, which arrows are drawn between
 * them, and what a filter leaves of both.
 *
 * What an edge IS is not tested here and is not decided here —
 * `./backlinks.test.ts` holds every ruling, in both directions, including the
 * whole-corpus promise that the two readings are about the same pairs. What the
 * rulings get here is a SPOT-CHECK apiece: the point of those cases is that the
 * walk spends the rulings rather than reinventing them, so each is one line
 * asserting the picture obeys a rule argued elsewhere.
 */

import { expect, test } from "bun:test"

import { setOf } from "./fixtures.testlib.ts"
import { derive } from "./derive.ts"
import {
  type Graph,
  graphOf,
  keepingGraph,
  matchedInGraph,
  placesInGraph,
} from "./graph.ts"

const viewOf = (files: Record<string, string>) => derive(setOf(files).nodes)

/**
 * A corpus with one of everything the rulings are about: a `see`, a mention, a
 * record doing both, a mirror (which is not a reference), a reference made
 * THROUGH a mirror (which is one, to the target), an ordering edge (which is
 * not), a self-mention, a dangling `@word`, and an archived record that does
 * both things and reaches nothing.
 */
const HOUSE = {
  "garden.olai": [
    `{"id":"garden","ord":"a0","title":"garden"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed"}`,
    `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil, beside @herbs"}`,
    `{"id":"frames","parent":"garden","ord":"a1","title":"the cold frames","see":["basil"]}`,
    `{"id":"itself","parent":"garden","ord":"a2","title":"@itself and @nobody","see":["itself"]}`,
    `{"id":"shed","parent":"garden","ord":"a3","title":"the shed","see":["retired"]}`,
  ].join("\n"),
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","see":["herbs"]}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","desc":"after @herbs is in","after":["order"]}`,
    `{"id":"both","parent":"kitchen","ord":"a3","title":"water @herbs","see":["herbs"]}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a4","mirror":"herbs"}`,
    `{"id":"through","parent":"kitchen","ord":"a5","title":"trim @kitchen-herbs","see":["kitchen-herbs"]}`,
  ].join("\n"),
  "Archive.olai": `{"id":"retired","ord":"a0","title":"the old bed, see @herbs","see":["herbs"]}`,
}

const edgesOf = (graph: Graph): ReadonlyArray<string> =>
  graph.edges.map((edge) => `${edge.from} -${edge.ways.join("+")}-> ${edge.to}`)

const drawnIn = (graph: Graph): ReadonlyArray<string> =>
  graph.nodes.map((node) => `${node.at.node.id}@${node.hops}`)

// ── what a neighbourhood is ──────────────────────────────────────────

test("one hop is the focus, what refers to it, and what it refers to", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  // `basil` mentions it, `order` sees it, `install` mentions it in its note,
  // `both` does both, `through` reaches it via a placement. In corpus order.
  expect(drawnIn(graph)).toEqual([
    "herbs@0",
    "basil@1",
    "order@1",
    "install@1",
    "both@1",
    "through@1",
  ])
})

test("an edge is drawn in the direction it was written, once per pair", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  expect(edgesOf(graph)).toEqual([
    "basil -mention-> herbs",
    "order -see-> herbs",
    "install -mention-> herbs",
    // ONE entry, both ways, in WAYS order — the edge first, the prose after it.
    "both -see+mention-> herbs",
    "through -see+mention-> herbs",
  ])
})

test("a second hop reaches the ring beyond, and its edges come with it", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 2 })
  // `frames` sees `basil`, which is one hop out — so it arrives at two.
  expect(drawnIn(graph)).toContain("frames@2")
  expect(edgesOf(graph)).toContain("frames -see-> basil")
})

test("an edge is drawn only where both of its ends are", () => {
  // At one hop `frames` is not drawn, so neither is the arrow it wrote at
  // `basil`: an arrow into the dark says less than no arrow.
  const near = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  expect(drawnIn(near)).not.toContain("frames@2")
  expect(edgesOf(near).some((edge) => edge.startsWith("frames"))).toBe(false)
})

test("a node nothing refers to is drawn alone rather than not at all", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "kitchen", hops: 2 })
  expect(drawnIn(graph)).toEqual(["kitchen@0"])
  expect(graph.edges).toEqual([])
})

test("an id nothing claims draws nothing", () => {
  expect(graphOf(viewOf(HOUSE), { kind: "around", focus: "nowhere", hops: 2 })).toEqual({
    nodes: [],
    edges: [],
  })
})

test("a focus that names a MIRROR draws nothing — a page resolves the chain first", () => {
  // The rule rather than a convenience: `pageOf` zooms before it asks, so the
  // focus arriving here is always canonical, and answering about a placement
  // would be a second resolution free to disagree with the page's.
  expect(graphOf(viewOf(HOUSE), { kind: "around", focus: "kitchen-herbs", hops: 1 }).nodes).toEqual([])
})

// ── the rulings, spot-checked (backlinks.test.ts argues them) ────────

test("a placement is not an edge, and a reference THROUGH one lands on the target", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 2 })
  // The mirror itself is nowhere in the picture...
  expect(drawnIn(graph).some((drawn) => drawn.startsWith("kitchen-herbs"))).toBe(false)
  // ...and `through`, which names it with both a `see` and an `@id`, has its
  // arrow on the herb bed.
  expect(edgesOf(graph)).toContain("through -see+mention-> herbs")
})

test("an ordering edge is not a reference", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "order", hops: 1 })
  // `install` comes after `order` and says so with `after`; the only thing on
  // this page is the `see` `order` itself wrote.
  expect(edgesOf(graph)).toEqual(["order -see-> herbs"])
})

test("what is put away is at neither end — the centre included", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 2 })
  expect(drawnIn(graph).some((drawn) => drawn.startsWith("retired"))).toBe(false)
  // ...and asking for the archived node's own graph draws nothing rather than a
  // one-way picture: #226 says it is drawn on the Trash and nowhere else.
  expect(graphOf(viewOf(HOUSE), { kind: "around", focus: "retired", hops: 2 })).toEqual({
    nodes: [],
    edges: [],
  })
})

// ── the corpus-wide reading ──────────────────────────────────────────

test("the corpus-wide reading is every node IN the graph, not every node", () => {
  const graph = graphOf(viewOf(HOUSE), { kind: "whole" })
  // `garden`, `kitchen` and the archive are absent: nothing refers to them and
  // they refer to nothing, so they are not part of the shape.
  expect(drawnIn(graph)).toEqual([
    "herbs@0",
    "basil@0",
    "frames@0",
    "order@0",
    "install@0",
    "both@0",
    "through@0",
  ])
})

test("a corpus with no references at all draws nothing", () => {
  const graph = graphOf(viewOf({ "a.olai": `{"id":"lonely","ord":"a0","title":"alone"}` }), {
    kind: "whole",
  })
  expect(graph).toEqual({ nodes: [], edges: [] })
})

// ── narrowed ─────────────────────────────────────────────────────────

test("a filter takes nodes away, keeps the focus, and drops the arrows it orphaned", () => {
  const whole = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  const narrowed = keepingGraph(whole, new Set(["order"]), "herbs")
  expect(drawnIn(narrowed)).toEqual(["herbs@0", "order@1"])
  expect(edgesOf(narrowed)).toEqual(["order -see-> herbs"])
})

test("a query matching everything hands the same value back", () => {
  const whole = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  expect(keepingGraph(whole, { has: () => true }, "herbs")).toBe(whole)
})

test("the two numbers are places and matches over the same walk", () => {
  const whole = graphOf(viewOf(HOUSE), { kind: "around", focus: "herbs", hops: 1 })
  expect(placesInGraph(whole)).toBe(6)
  expect(matchedInGraph(whole, new Set(["order", "both"]))).toBe(2)
})
