/**
 * THE GRAPH'S OWN ROUTE TABLE — the eight URLs this grammar spells, mounted
 * the way the app mounts them, and the negatives that must read as default
 * or must not read at all.
 *
 * Why here and not in `navigation/src/routes.testlib.ts`'s `ROUTES`: that
 * table is the vocabulary over NO roster (`routingIn([])` — every route the
 * app spells before a plugin is mounted), and navigation cannot spell the
 * graph, because the grammar lives in this package and the fence holds
 * navigation back from importing it. The same bijection a lossy tenant would
 * silently break is therefore held HERE, against a roster this file mounts
 * itself — the precedent is journal's own routes testbed and navigation's
 * "a plugin page holds both halves of an address".
 */

import { parseAddress } from "@olai/format"
import { defineAppPage, settleRoutePages } from "olai-plugin-navigation/routes"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
import { expect, test } from "bun:test"

import { graph, graphAround, wholeGraph, type GraphPage } from "./routes.ts"

const pages = settleRoutePages([{ plugin: "graph", face: defineAppPage(graph, () => null) }])
const mounted = routingIn(pages)

/** An address the grammar would WRITE, constructed the way it is READ:
 *  `parseAddress` is the one place a string becomes a branded address. */
const vertex = (text: string): NonNullable<GraphPage["around"]> => {
  const one = parseAddress(text)
  if (one === null || (one.kind !== "node" && one.kind !== "document")) {
    throw new Error(`no vertex address in ${text}`)
  }
  return one
}

const kitchen = vertex("#kitchen")
const note = vertex("notes/x.md")

/** The eight rows: written, read back, written again — both ways the same. */
const ROWS: ReadonlyArray<{ readonly name: string; readonly route: ReturnType<typeof graph.to>; readonly url: string }> = [
  // the whole reading
  { name: "whole", route: wholeGraph(), url: "/graph" },
  // the whole reading, narrowed — the query is part of the address
  { name: "whole narrowed", route: { ...wholeGraph(), filter: "#home" }, url: "/graph?q=%23home" },
  // one node's neighbourhood
  { name: "node centre", route: graphAround(kitchen, 1), url: "/graph/#kitchen" },
  // a document's neighbourhood, by its path half alone
  {
    name: "document centre",
    route: graphAround(note),
    url: "/graph/notes/x.md",
  },
  // a DOCUMENT at the second horizon: the query sits between the halves
  {
    name: "document centre, two hops",
    route: graphAround(note, 2),
    url: "/graph/notes/x.md?hops=2",
  },
  // the second horizon, the one query this route owns
  {
    name: "two hops",
    route: graphAround(kitchen, 2),
    url: "/graph/?hops=2#kitchen",
  },
  // ...narrowed, the tenant's own query holding next to the app's: the
  // tenant wrote `hops` first, so `q` merges after it.
  {
    name: "two hops narrowed",
    route: { ...graphAround(kitchen, 2), filter: "is:done" },
    url: "/graph/?hops=2&q=is%3Adone#kitchen",
  },
]

for (const row of ROWS) {
  test(`${row.name}: the address the app writes is the address it reads`, () => {
    expect(mounted.href(row.route)).toBe(row.url)
    expect(mounted.routeOf(row.url)).toEqual(row.route)
  })
}

test("an empty fragment and a trailing slash are the whole reading, not misses", () => {
  expect(mounted.routeOf("/graph/#")).toEqual(wholeGraph())
  expect(mounted.routeOf("/graph/")).toEqual(wholeGraph())
})

test("a route that is not this grammar's claims nothing", () => {
  expect(graph.parse("/graphs")).toBeNull()
  expect(graph.parse("/graph", undefined)).toEqual({ around: null, hops: 1 })
})

test("a horizon this page cannot draw is the default horizon", () => {
  expect(
    graph.parse("/graph/", { fragment: "a", query: new URLSearchParams("hops=9") }),
  ).toEqual({ around: vertex("#a"), hops: 1 })
})

test("an address's two halves ride the URL's two halves", () => {
  // A heading's element lands on its document, a row's element on its node:
  // the graph has no vertex for either, and reading them as their page is
  // what `pointing` already ruled.
  expect(
    graph.parse("/graph/README.md", { fragment: "install", query: new URLSearchParams() }),
  ).toEqual({ around: vertex("README.md"), hops: 1 })
  // The row-spelled form reads as the node, though the grammar never WRITES
  // it — the qualified spelling of the same page.
  expect(
    graph.parse("/graph/Tasks.olai", { fragment: "hinges", query: new URLSearchParams() }),
  ).toEqual({ around: vertex("#hinges"), hops: 1 })
})

test("what the route means is the request the page stream is asked", () => {
  expect(graph.request({ around: note, hops: 2 }, "2026-09-08"))
    .toEqual({ kind: "graph", around: note, hops: 2 })
})
