/**
 * The reference graph, and the one promise that keeps it honest: the forward
 * reading and the backward one are about the same pairs.
 *
 * `./backlinks.test.ts` holds every ruling about what a reference IS. Nothing
 * here restates one — what is asserted is that {@link referencesOf} inherits
 * all of them, which is stated once, over a whole corpus, in both directions.
 * That is the only form of "these two agree" that cannot go stale while
 * somebody edits one of them, and it is why the rulings below are spot-checked
 * rather than re-derived: each of those tests would pass against a forward
 * reading that had quietly stopped agreeing, and the symmetry test would not.
 */

import { expect, test } from "bun:test"

import { setOf } from "./fixtures.testlib.ts"
import { backlinksOf } from "./backlinks.ts"
import { derive } from "./derive.ts"
import { isRegular } from "./node.ts"
import {
  type Graph,
  graphOf,
  keepingGraph,
  matchedInGraph,
  placesInGraph,
  referencesOf,
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

// ── the promise ──────────────────────────────────────────────────────

test("the forward reading and the backward one are about the same pairs", () => {
  const derived = viewOf(HOUSE)

  // Every (referrer, target, way) the FORWARD reading finds, over every live
  // record. An ARCHIVED one is skipped on both sides below rather than inside
  // `referencesOf`: that reading is asked about a record somebody named, and
  // the one caller who can name an archived one is a reader zooming a node that
  // was put away — whose page still says what it points at, exactly as
  // `backlinksOf` still says what points at it. Which records a WALK reaches is
  // the graph's own rule, and it never reaches into the Trash.
  const forward = new Set<string>()
  for (const at of derived.nodes) {
    if (!isRegular(at) || at.file === "Archive.olai") continue
    for (const { to, ways } of referencesOf(derived, at)) {
      for (const way of ways) forward.add(`${at.node.id} ${way} ${to}`)
    }
  }

  // ...and every one the BACKWARD reading finds. Asked of the NODES, never of
  // a mirror's id: `backlinksOf` answers about whatever a placement stands for
  // and files the pair under the id it was asked with, so asking about both
  // ends of a chain would be one relationship counted twice under two names.
  // The forward reading names the canonical end, which is the node.
  const backward = new Set<string>()
  for (const at of derived.nodes) {
    if (!isRegular(at)) continue
    // AN ARCHIVED TARGET is the one pair the two readings disagree about, and
    // it is stated here rather than papered over: `backlinksOf` asked about a
    // node that was put away still answers with its live referrers, because it
    // is a question about that node's own page. The graph leaves it out at
    // both ends — a picture may not grow a limb into the Trash — so the pairs
    // landing on `retired` are the backward reading's alone.
    if (at.file === "Archive.olai") continue
    for (const back of backlinksOf(derived, at.node.id)) {
      for (const way of back.ways) backward.add(`${back.at.node.id} ${way} ${at.node.id}`)
    }
  }

  expect([...backward].sort()).toEqual([...forward].sort())
  // ...and the exclusion above is real rather than vacuous: something live does
  // point into the archive, and neither the graph nor the forward reading has
  // it.
  expect(backlinksOf(derived, "retired").map((back) => back.at.node.id)).toEqual(["shed"])
  expect([...forward].some((pair) => pair.endsWith(" retired"))).toBe(false)
})

// ── what a neighbourhood is ──────────────────────────────────────────

test("one hop is the focus, what refers to it, and what it refers to", () => {
  const graph = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
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
  const graph = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
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
  const graph = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 2 })
  // `frames` sees `basil`, which is one hop out — so it arrives at two.
  expect(drawnIn(graph)).toContain("frames@2")
  expect(edgesOf(graph)).toContain("frames -see-> basil")
})

test("an edge is drawn only where both of its ends are", () => {
  // At one hop `frames` is not drawn, so neither is the arrow it wrote at
  // `basil`: an arrow into the dark says less than no arrow.
  const near = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
  expect(drawnIn(near)).not.toContain("frames@2")
  expect(edgesOf(near).some((edge) => edge.startsWith("frames"))).toBe(false)
})

test("a node nothing refers to is drawn alone rather than not at all", () => {
  const graph = graphOf(viewOf(HOUSE), { focus: "kitchen", hops: 2 })
  expect(drawnIn(graph)).toEqual(["kitchen@0"])
  expect(graph.edges).toEqual([])
})

test("an id nothing claims draws nothing", () => {
  expect(graphOf(viewOf(HOUSE), { focus: "nowhere", hops: 2 })).toEqual({
    nodes: [],
    edges: [],
  })
})

test("a focus that names a MIRROR draws nothing — a page resolves the chain first", () => {
  // The rule rather than a convenience: `pageOf` zooms before it asks, so the
  // focus arriving here is always canonical, and answering about a placement
  // would be a second resolution free to disagree with the page's.
  expect(graphOf(viewOf(HOUSE), { focus: "kitchen-herbs", hops: 1 }).nodes).toEqual([])
})

// ── the rulings, spot-checked (backlinks.test.ts argues them) ────────

test("a placement is not an edge, and a reference THROUGH one lands on the target", () => {
  const graph = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 2 })
  // The mirror itself is nowhere in the picture...
  expect(drawnIn(graph).some((drawn) => drawn.startsWith("kitchen-herbs"))).toBe(false)
  // ...and `through`, which names it with both a `see` and an `@id`, has its
  // arrow on the herb bed.
  expect(edgesOf(graph)).toContain("through -see+mention-> herbs")
})

test("an ordering edge is not a reference", () => {
  const graph = graphOf(viewOf(HOUSE), { focus: "order", hops: 1 })
  // `install` comes after `order` and says so with `after`; the only thing on
  // this page is the `see` `order` itself wrote.
  expect(edgesOf(graph)).toEqual(["order -see-> herbs"])
})

test("what is put away is at neither end — the centre included", () => {
  const graph = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 2 })
  expect(drawnIn(graph).some((drawn) => drawn.startsWith("retired"))).toBe(false)
  // ...and asking for the archived node's own graph draws nothing rather than a
  // one-way picture: #226 says it is drawn on the Trash and nowhere else.
  expect(graphOf(viewOf(HOUSE), { focus: "retired", hops: 2 })).toEqual({
    nodes: [],
    edges: [],
  })
})

test("a record never refers to itself, and a word nothing claims is not an edge", () => {
  const derived = viewOf(HOUSE)
  const itself = derived.byId.get("itself")!
  expect(isRegular(itself) ? referencesOf(derived, itself) : []).toEqual([])
})

// ── the corpus-wide reading ──────────────────────────────────────────

test("the corpus-wide reading is every node IN the graph, not every node", () => {
  const graph = graphOf(viewOf(HOUSE), { hops: 1 })
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
    hops: 2,
  })
  expect(graph).toEqual({ nodes: [], edges: [] })
})

// ── narrowed ─────────────────────────────────────────────────────────

test("a filter takes nodes away, keeps the focus, and drops the arrows it orphaned", () => {
  const whole = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
  const narrowed = keepingGraph(whole, new Set(["order"]), "herbs")
  expect(drawnIn(narrowed)).toEqual(["herbs@0", "order@1"])
  expect(edgesOf(narrowed)).toEqual(["order -see-> herbs"])
})

test("a query matching everything hands the same value back", () => {
  const whole = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
  expect(keepingGraph(whole, { has: () => true }, "herbs")).toBe(whole)
})

test("the two numbers are places and matches over the same walk", () => {
  const whole = graphOf(viewOf(HOUSE), { focus: "herbs", hops: 1 })
  expect(placesInGraph(whole)).toBe(6)
  expect(matchedInGraph(whole, new Set(["order", "both"]))).toBe(2)
})
