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
  { kind: "document", file: "finishes.md" },
  { kind: "document", file: "notes/deep/plan.md" },
  { kind: "node", id: "kitchen" },
  { kind: "node", id: "a-minted_id9" },
  { kind: "day", date: "2026-08-10" },
  { kind: "today" },
]

test("every route survives being written to a URL and read back", () => {
  for (const route of ROUTES) {
    expect(routeOf(hrefOf(route))).toEqual(route)
  }
})

test("the addresses are the documented ones", () => {
  expect(hrefOf({ kind: "outline", file: null })).toBe("/")
  expect(hrefOf({ kind: "outline", file: "house.jsonl" })).toBe("/o/house.jsonl")
  expect(hrefOf({ kind: "node", id: "kitchen" })).toBe("/n/kitchen")
  expect(hrefOf({ kind: "document", file: "notes/finishes.md" })).toBe(
    "/doc/notes/finishes.md",
  )
  expect(hrefOf({ kind: "day", date: "2026-08-10" })).toBe("/d/2026-08-10")
  expect(hrefOf({ kind: "today" })).toBe("/today")
})

// `/today` names no day: it names the day it IS, and which day that is takes a
// clock. Reading the URL must not have one, or the same address would parse as
// a different route tomorrow and the page it opened could never be cached,
// linked or reasoned about here.
test("`/today` parses as itself, not as a date", () => {
  expect(routeOf("/today")).toEqual({ kind: "today" })
  expect(routeOf("/today/")).toEqual({ kind: "outline", file: null })
})

// A directory separator stays a separator, so the URL bar shows the path a
// reader recognises rather than a run of escapes.
test("an outline in a subdirectory keeps its slashes", () => {
  expect(hrefOf({ kind: "outline", file: "wing/kitchen.jsonl" })).toBe(
    "/o/wing/kitchen.jsonl",
  )
})

// A document address and a day address share a first letter and nothing else:
// the prefixes are whole segments, so `/doc/` is never read as `/d/`.
test("a document is not a day", () => {
  expect(routeOf("/doc/a.md")).toEqual({ kind: "document", file: "a.md" })
  expect(routeOf("/d/2026-08-10")).toEqual({ kind: "day", date: "2026-08-10" })
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
