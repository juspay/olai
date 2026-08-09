import { expect, test } from "bun:test"

import { hrefOf, type Route, routeOf } from "./routes.ts"

/** Every route the app can be at, as its own case. A link the app WRITES that
 *  it cannot READ BACK is a page that loads as something else on a reload, and
 *  the round trip is the only thing that catches it. */
const ROUTES: ReadonlyArray<Route> = [
  { kind: "outline", file: null },
  { kind: "outline", file: "house.jsonl" },
  { kind: "outline", file: "wing/kitchen.jsonl" },
  { kind: "outline", file: "a file with spaces.jsonl" },
  { kind: "node", id: "kitchen" },
  { kind: "node", id: "a-minted_id9" },
]

test("every route survives being written to a URL and read back", () => {
  for (const route of ROUTES) {
    expect(routeOf(hrefOf(route))).toEqual(route)
  }
})

test("the addresses are the two documented ones", () => {
  expect(hrefOf({ kind: "outline", file: null })).toBe("/")
  expect(hrefOf({ kind: "outline", file: "house.jsonl" })).toBe("/o/house.jsonl")
  expect(hrefOf({ kind: "node", id: "kitchen" })).toBe("/n/kitchen")
})

// A directory separator stays a separator, so the URL bar shows the path a
// reader recognises rather than a run of escapes.
test("an outline in a subdirectory keeps its slashes", () => {
  expect(hrefOf({ kind: "outline", file: "wing/kitchen.jsonl" })).toBe(
    "/o/wing/kitchen.jsonl",
  )
})

// Not a route the app writes — a reader typed it. The app they wanted is the
// one at `/`, not a blank screen.
test("an unrecognised path is the default outline", () => {
  expect(routeOf("/")).toEqual({ kind: "outline", file: null })
  expect(routeOf("/somewhere/else")).toEqual({ kind: "outline", file: null })
})

// `/n/` with nothing after it is a node route for an id nothing declares —
// which the page already knows how to say. Treating it as the default outline
// would answer a broken permalink by silently showing something else.
test("a node route with an empty id is still a node route", () => {
  expect(routeOf("/n/")).toEqual({ kind: "node", id: "" })
})
