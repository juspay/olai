import { expect, test } from "bun:test"

import { filterOf, hrefOf, narrowedTo, type Route, routeIn, routeOf } from "./routes.ts"

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
  { kind: "agenda" },
  { kind: "trash" },
  // ...and the same two pages, narrowed. The filter is part of the address, so
  // it is part of the round trip: a query the app writes into the bar and
  // cannot read back is a page that loses its filter on reload.
  { kind: "outline", file: "house.jsonl", filter: "is:done" },
  { kind: "outline", file: null, filter: "#home -is:done" },
  { kind: "node", id: "kitchen", filter: "date:2026-08-01..2026-08-14" },
  { kind: "node", id: "kitchen", filter: "a query with  spaces & an ampersand" },
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
  expect(hrefOf({ kind: "agenda" })).toBe("/agenda")
  expect(hrefOf({ kind: "trash" })).toBe("/trash")
})

// ── the filter, which is the one thing that is not a path ──────────────

// An unfiltered page is exactly the address it always was: no `?`, no empty
// query, so one page is one string in the bar and one entry in the history.
test("a page with no filter wears no query at all", () => {
  expect(hrefOf({ kind: "outline", file: "house.jsonl" })).toBe("/o/house.jsonl")
  expect(hrefOf({ kind: "outline", file: "house.jsonl", filter: "" })).toBe(
    "/o/house.jsonl",
  )
  expect(hrefOf({ kind: "node", id: "kitchen", filter: "   " })).toBe("/n/kitchen")
  expect(routeOf("/o/house.jsonl?q=")).toEqual({
    kind: "outline",
    file: "house.jsonl",
  })
})

test("a filtered page spells it in the query", () => {
  expect(hrefOf({ kind: "outline", file: "house.jsonl", filter: "#home" })).toBe(
    "/o/house.jsonl?q=%23home",
  )
  expect(routeOf("/n/kitchen?q=is%3Adone")).toEqual({
    kind: "node",
    id: "kitchen",
    filter: "is:done",
  })
})

// Narrowing is asked of the module that knows which routes may carry one: a
// filter typed on a day page has nowhere to go, and spreading it on anyway
// would mint an address `hrefOf` drops and `routeOf` never returns.
test("only the two tree routes take a filter, and a blank one takes it off", () => {
  expect(narrowedTo({ kind: "node", id: "kitchen" }, "#home")).toEqual({
    kind: "node",
    id: "kitchen",
    filter: "#home",
  })
  expect(narrowedTo({ kind: "day", date: "2026-08-10" }, "#home")).toEqual({
    kind: "day",
    date: "2026-08-10",
  })
  // Cleared, and the key is GONE rather than empty — an unfiltered page has
  // one spelling.
  const cleared = narrowedTo(
    { kind: "outline", file: "house.jsonl", filter: "#home" },
    "",
  )
  expect(cleared).toEqual({ kind: "outline", file: "house.jsonl" })
  expect(cleared).not.toHaveProperty("filter")
})

test("what a page is narrowed by is read off the route", () => {
  expect(filterOf({ kind: "node", id: "kitchen", filter: "#home" })).toBe("#home")
  expect(filterOf({ kind: "node", id: "kitchen" })).toBe("")
  expect(filterOf({ kind: "trash" })).toBe("")
})

// `/trash` spells no file for the agenda's reason: which archives exist is the
// set's answer, and an address that named one would mean something different
// the day a subdirectory gets its own. An archive's own outline address still
// parses — what page it opens is `page.ts`'s call, not this parser's.
test("the trash is one address, and an archive's path is still an outline's", () => {
  expect(routeOf("/trash")).toEqual({ kind: "trash" })
  expect(routeOf("/o/Archive.jsonl")).toEqual({
    kind: "outline",
    file: "Archive.jsonl",
  })
})

// `/agenda` spells nothing at all — not a day, not a horizon. An address that
// carried how far ahead it looked would be a link that meant something else
// tomorrow, and the answer is derived from the clock either way.
test("the agenda is one address, and it names no date", () => {
  expect(routeOf("/agenda")).toEqual({ kind: "agenda" })
  expect(routeOf("/agenda/2026-08-12")).toEqual({ kind: "outline", file: null })
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

// A link inside rendered markdown gets the STRICT reading, and the difference
// is the fallback: `routeOf` answers an unknown path with the front page, which
// as an answer to a link somebody wrote in a file would mean every address this
// app has no page for silently opening the default outline.
test("a link on the page is a route only when it names a document's page", () => {
  expect(routeIn("/doc/notes/plan.md")).toEqual({
    kind: "document",
    file: "notes/plan.md",
  })
  for (
    const href of [
      "https://example.com",
      "/o/house.jsonl",
      "/d/2026-08-10",
      "/somewhere/else",
      "#md-1a2b-beds",
      "",
    ]
  ) {
    expect(routeIn(href)).toBeNull()
  }
})

// A fragment is left to the browser on purpose: what it names on a rendered
// page is an id minted per BLOCK, so claiming the click would be this app
// promising an anchor it does not land on.
test("a document link carrying a fragment is left to the browser", () => {
  expect(routeIn("/doc/garden.md#beds")).toBeNull()
})

// `/n/` with nothing after it is a node route for an id nothing declares —
// which the page already knows how to say. Treating it as the default outline
// would answer a broken permalink by silently showing something else.
test("a node route with an empty id is still a node route", () => {
  expect(routeOf("/n/")).toEqual({ kind: "node", id: "" })
})
