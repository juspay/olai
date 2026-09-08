/**
 * The sixth shape's three answers, proved — `../page.ts` says the shapes are
 * one kind each, and this file's suite says it answers the bar over dots the
 * way the others answer it over rows.
 *
 * THE SPAN here is the whole of it and its point is simple: `narrowed`
 * holds the centre on an unmatched query, discards both a vertex and every
 * edge one of whose ends went with it, and holds both halves of a page's
 * the query selects — the node's (selected) and the document's (documents).
 * `placesIn` is the page held; `matchesIn` is the answer matched.
 */

import { expect, test } from "bun:test"

import type { MatchedDocument, Vertex } from "@olai/format"

import { matchesIn, narrowed, placesIn } from "./drawn.ts"
import type { Drawn } from "../page.ts"

const vertex = (id: string): Vertex => ({
  key: `#${id}`,
  address: { kind: "node", id: id as Vertex["address"] extends { kind: "node" } ? never : never },
  kind: "node",
  title: id,
  file: "garden.olai",
  crumbs: [],
  hops: 0,
})

const document = (path: string): Vertex => ({
  key: path,
  address: { kind: "document", path: path as Vertex["address"] extends { kind: "document" } ? never : never },
  kind: "document",
  title: path,
  file: path,
  crumbs: [],
  hops: 0,
})

const CENTRE: Vertex = vertex("herbs")

const around = { kind: "vertex" as const, vertex: CENTRE }

// The page: centre → order → worktop, centre → brief.md. `order` is done,
// `worktop` alive; a document reads as a vertex one kind over. The note-side
// arms answer nothing here and the crop's whole page answers one.
const thePage = (): Extract<Drawn, { kind: "graph" }> => ({
  kind: "graph",
  around,
  vertices: [CENTRE, vertex("order"), vertex("worktop"), document("notes/brief.md")],
  edges: [
    { from: "#herbs", to: "#order", ways: ["see"] },
    { from: "#order", to: "#worktop", ways: ["see"] },
    { from: "#herbs", to: "notes/brief.md", ways: ["see"] },
  ],
  held: 4,
})

test("an unfiltered page holds every vertex, and the page is about the centre", () => {
  const page = thePage()
  expect(placesIn(page)).toBe(4)
  expect(narrowed(page, new Set<string>(), new Map()).vertices).toHaveLength(1)
  expect(matchesIn(page, new Set<string>(["worktop"]), new Map())).toBe(1)
})

test("the centre is kept either way, matched or not — the page is its answer", () => {
  // A match on the centre keeps it; the filter's answer has no say there.
  const asking = thePage()
  const held = narrowed(asking, new Set(["herbs"]), new Map())
  expect(held.kind).toBe("graph")
  if (held.kind !== "graph") throw new Error("shape")
  expect(held.vertices.map((one) => one.key)).toEqual(["#herbs"])
  // One edge centres, no line left without its ends.
  expect(held.edges).toEqual([])
})

test("a match keeps its vertex and the road to the centre; an unmatched falls, its lines with it", () => {
  const page = thePage()
  // `worktop` is the answer: its line through `order` stays because `order`
  // leads to the centre, and `order` has no other kept line.
  const held = narrowed(page, new Set(["worktop"]), new Map())
  if (held.kind !== "graph") throw new Error("shape")
  expect(held.vertices.map((one) => one.key)).toEqual(["#herbs", "#worktop"])
  expect(held.edges).toEqual([])
  // The count the bar is read from: only the match is percent-age.
  expect(matchesIn(page, new Set(["worktop"]), new Map())).toBe(1)
  expect(placesIn(page)).toBe(4)
  // The page holds the same count when read with matched NOTHING — the
  // prune not has it.
  expect(matchesIn(page, new Set(), new Map())).toBe(0)
})

test("a document dot is kept in step its words select", () => {
  const page = thePage()
  const documents = new Map<string, MatchedDocument>([
    ["notes/brief.md", { path: "notes/brief.md", matched: "body" }],
  ])
  const held = narrowed(page, new Set(), documents)
  if (held.kind !== "graph") throw new Error("shape")
  expect(held.vertices.map((one) => one.key)).toEqual(["#herbs", "notes/brief.md"])
  // A document edge needs BOTH ends: the document alone is a dot, its line
  // back to the centre stands exactly as one side of it: the centre.
  expect(held.edges).toEqual([{ from: "#herbs", to: "notes/brief.md", ways: ["see"] }])
  expect(matchesIn(page, new Set(), documents)).toBe(1)
})

// The prune's no-arg count: `matchesIn` over the whole page answers the
// query's count the way the bar reads it, and `narrowed` rebalances it.
test("the prune and the match count add up", () => {
  const page = thePage()
  const matched = new Set(["order", "worktop"])
  const held = narrowed(page, matched, new Map())
  if (held.kind !== "graph") throw new Error("shape")
  // Both matches live and the road to the centre does; the brief goes with
  // its words.
  expect(held.vertices.map((one) => one.key)).toEqual(["#herbs", "#order", "#worktop"])
  expect(held.edges).toEqual([
    { from: "#herbs", to: "#order", ways: ["see"] },
    { from: "#order", to: "#worktop", ways: ["see"] },
  ])
  expect(matchesIn(page, matched, new Map())).toBe(2)
  expect(placesIn(page)).toBe(4)
})
