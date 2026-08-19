import { expect, test } from "bun:test"

import {
  filterOf,
  hrefOf,
  narrowedTo,
  type Route,
  routeIn,
  routeOf,
  samePage,
} from "./routes.ts"

/** Every route the app can be at, as its own case. A link the app WRITES that
 *  it cannot READ BACK is a page that loads as something else on a reload, and
 *  the round trip is the only thing that catches it. */
const ROUTES: ReadonlyArray<Route> = [
  { kind: "outline", file: null },
  { kind: "outline", file: "house.olai" },
  { kind: "outline", file: "wing/kitchen.olai" },
  { kind: "outline", file: "a file with spaces.olai" },
  { kind: "document", file: "finishes.md" },
  { kind: "document", file: "notes/deep/plan.md" },
  { kind: "node", id: "kitchen" },
  { kind: "node", id: "a-minted_id9" },
  { kind: "day", date: "2026-08-10" },
  { kind: "today" },
  { kind: "agenda" },
  { kind: "trash" },
  // ...and the same pages, narrowed. The filter is part of the address, so it
  // is part of the round trip: a query the app writes into the bar and cannot
  // read back is a page that loses its filter on reload.
  { kind: "outline", file: "house.olai", filter: "is:done" },
  // The four that grew one under `search-everywhere`. A day and the agenda are
  // date questions and the trash is read-only, and neither of those is a reason
  // not to be able to look through what they are showing.
  { kind: "day", date: "2026-08-10", filter: "is:todo" },
  { kind: "today", filter: "#home" },
  { kind: "agenda", filter: "is:blocked" },
  { kind: "trash", filter: "hinges" },
  { kind: "outline", file: null, filter: "#home -is:done" },
  // A narrowed NODE page is the case the query's position is decided by: the
  // address is a fragment, and a URL puts its query in front of one.
  { kind: "node", id: "kitchen", filter: "date:2026-08-01..2026-08-14" },
  { kind: "node", id: "kitchen", filter: "a query with  spaces & an ampersand" },
  // A quoted phrase is the query that puts a `"` — and the spaces it exists to
  // keep — into the address. A narrowed page is a link somebody sends, so the
  // quotes have to survive the trip both ways.
  { kind: "outline", file: "house.olai", filter: `"pick the hinges" OR knobs` },
  // …and a document at a place INSIDE it, which is the other thing an address
  // here carries. A `#` that could not be read back is a link into a section
  // that lands at the top of the page the moment it is reloaded or shared.
  { kind: "document", file: "garden.md", at: "beds" },
  { kind: "document", file: "notes/report.html", at: "Q3 revenue" },
]

test("every route survives being written to a URL and read back", () => {
  for (const route of ROUTES) {
    expect(routeOf(hrefOf(route))).toEqual(route)
  }
})

// A content URL is `/` and then the address — no prefix, because the suffix in
// the path already says which kind of page it opens and a node's address is a
// fragment (`@olai/format`'s `address.ts`).
test("the addresses are the documented ones", () => {
  expect(hrefOf({ kind: "outline", file: null })).toBe("/")
  expect(hrefOf({ kind: "outline", file: "house.olai" })).toBe("/house.olai")
  expect(hrefOf({ kind: "node", id: "kitchen" })).toBe("/#kitchen")
  expect(hrefOf({ kind: "document", file: "notes/finishes.md" })).toBe(
    "/notes/finishes.md",
  )
  expect(hrefOf({ kind: "document", file: "garden.md", at: "beds" })).toBe(
    "/garden.md#beds",
  )
  expect(hrefOf({ kind: "day", date: "2026-08-10" })).toBe("/d/2026-08-10")
  expect(hrefOf({ kind: "today" })).toBe("/today")
  expect(hrefOf({ kind: "agenda" })).toBe("/agenda")
  expect(hrefOf({ kind: "trash" })).toBe("/trash")
})

// Which PAGE a path opens is the suffix's answer: a `.olai` is a tree, and
// every other served kind is a body. One address grammar, two pages, and no
// prefix free to disagree with the name it carries.
test("the suffix decides which page a document address opens", () => {
  expect(routeOf("/house.olai")).toEqual({ kind: "outline", file: "house.olai" })
  expect(routeOf("/finishes.md")).toEqual({ kind: "document", file: "finishes.md" })
  expect(routeOf("/saved/report.html")).toEqual({
    kind: "document",
    file: "saved/report.html",
  })
})

// The node permalink is location-free: an id survives renames and moves
// between files, and the grammar's own spelling of a node carries no file.
test("a node is a fragment and nothing else", () => {
  expect(routeOf("/#kitchen")).toEqual({ kind: "node", id: "kitchen" })
  // Written with the file it lives in — which somebody who knows where it is
  // will write — and normalised to the bare id on the way in.
  expect(routeOf("/house.olai#kitchen")).toEqual({ kind: "node", id: "kitchen" })
  expect(hrefOf(routeOf("/house.olai#kitchen"))).toBe("/#kitchen")
})

// ── the filter, which is the one thing that is not a path ──────────────

// An unfiltered page is exactly the address it always was: no `?`, no empty
// query, so one page is one string in the bar and one entry in the history.
test("a page with no filter wears no query at all", () => {
  expect(hrefOf({ kind: "outline", file: "house.olai" })).toBe("/house.olai")
  expect(hrefOf({ kind: "outline", file: "house.olai", filter: "" })).toBe(
    "/house.olai",
  )
  expect(hrefOf({ kind: "node", id: "kitchen", filter: "   " })).toBe("/#kitchen")
  expect(routeOf("/house.olai?q=")).toEqual({
    kind: "outline",
    file: "house.olai",
  })
})

// The NEGATIVE round trip, and the only page that has one: a document takes no
// filter, and `routeOf`'s document arm is the single place that exclusion is
// enforced — it is the one arm that does not spread the parsed query onto the
// route. So an address somebody typed a `?q=` into by hand opens the document
// and nothing else: no filter on the route, no bar over the page (which is
// drawn on what the page DRAWS, `page.ts`), and the address the app writes back
// is the bare one.
test("a `?q=` typed onto a document address is dropped, not carried", () => {
  expect(routeOf("/finishes.md?q=hinges")).toEqual({
    kind: "document",
    file: "finishes.md",
  })
  // ...including beside the one thing that address DOES carry.
  expect(routeOf("/garden.md?q=hinges#beds")).toEqual({
    kind: "document",
    file: "garden.md",
    at: "beds",
  })
  expect(filterOf(routeOf("/finishes.md?q=hinges"))).toBe("")
  expect(hrefOf(routeOf("/finishes.md?q=hinges"))).toBe("/finishes.md")
})

// A URL puts its query BEFORE its fragment, so a narrowed node page is the one
// address whose two halves sit either side of the filter. Written any other
// way, the browser reads `?q=…` as part of the fragment and the page loses its
// filter.
test("a filtered page spells it in the query, in front of any fragment", () => {
  expect(hrefOf({ kind: "outline", file: "house.olai", filter: "#home" })).toBe(
    "/house.olai?q=%23home",
  )
  expect(hrefOf({ kind: "node", id: "kitchen", filter: "is:todo" })).toBe(
    "/?q=is%3Atodo#kitchen",
  )
  expect(routeOf("/?q=is%3Adone#kitchen")).toEqual({
    kind: "node",
    id: "kitchen",
    filter: "is:done",
  })
})

// Narrowing is asked of the module that knows which routes may carry one: a
// filter typed on a document page has nowhere to go, and spreading it on anyway
// would mint an address `hrefOf` drops and `routeOf` never returns.
test("every route but a document's takes a filter, and a blank one takes it off", () => {
  expect(narrowedTo({ kind: "node", id: "kitchen" }, "#home")).toEqual({
    kind: "node",
    id: "kitchen",
    filter: "#home",
  })
  expect(narrowedTo({ kind: "day", date: "2026-08-10" }, "#home")).toEqual({
    kind: "day",
    date: "2026-08-10",
    filter: "#home",
  })
  expect(narrowedTo({ kind: "trash" }, "hinges")).toEqual({
    kind: "trash",
    filter: "hinges",
  })
  // The one page this grammar has nothing to say about: prose is not nodes.
  expect(narrowedTo({ kind: "document", file: "finishes.md" }, "#home")).toEqual({
    kind: "document",
    file: "finishes.md",
  })
  // Cleared. What matters is the ADDRESS, which is where the one-spelling rule
  // actually bites: two routes for the same unfiltered page are one string in
  // the bar and one entry in the history.
  const cleared = narrowedTo(
    { kind: "outline", file: "house.olai", filter: "#home" },
    "",
  )
  expect(filterOf(cleared)).toBe("")
  expect(hrefOf(cleared)).toBe("/house.olai")
  expect(samePage(cleared, { kind: "outline", file: "house.olai" })).toBe(true)
})

// What the page memo is keyed on: a query typed one character at a time must
// not re-resolve the page under it (`App.tsx`).
test("two addresses for one page are the same page, whatever narrows them", () => {
  const bare: Route = { kind: "node", id: "install" }
  expect(samePage(bare, narrowedTo(bare, "#home"))).toBe(true)
  expect(samePage(narrowedTo(bare, "a"), narrowedTo(bare, "b"))).toBe(true)
  expect(samePage(bare, { kind: "node", id: "hinges" })).toBe(false)
  expect(samePage(bare, { kind: "outline", file: "house.olai" })).toBe(false)
})

test("what a page is narrowed by is read off the route", () => {
  expect(filterOf({ kind: "node", id: "kitchen", filter: "#home" })).toBe("#home")
  expect(filterOf({ kind: "node", id: "kitchen" })).toBe("")
  expect(filterOf({ kind: "trash", filter: "hinges" })).toBe("hinges")
  expect(filterOf({ kind: "trash" })).toBe("")
  expect(filterOf({ kind: "document", file: "finishes.md" })).toBe("")
})

// `/trash` spells no file for the agenda's reason: which archives exist is the
// set's answer, and an address that named one would mean something different
// the day a subdirectory gets its own. An archive's own outline address still
// parses — what page it opens is `page.ts`'s call, not this parser's.
test("the trash is one address, and an archive's path is still an outline's", () => {
  expect(routeOf("/trash")).toEqual({ kind: "trash" })
  expect(routeOf("/Archive.olai")).toEqual({
    kind: "outline",
    file: "Archive.olai",
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

// The computed pages are words this app claimed and are read FIRST; every
// other path is asked of the address grammar. The two cannot collide, because
// a served file carries a suffix the registry claims and a computed page
// spells none — so a file that WOULD collide is one this app never serves.
test("a computed page is not a document, and a document is not a day", () => {
  expect(routeOf("/today.md")).toEqual({ kind: "document", file: "today.md" })
  expect(routeOf("/d/2026-08-10")).toEqual({ kind: "day", date: "2026-08-10" })
  expect(routeOf("/agenda.olai")).toEqual({ kind: "outline", file: "agenda.olai" })
})

// A directory separator stays a separator, so the URL bar shows the path a
// reader recognises rather than a run of escapes.
test("an outline in a subdirectory keeps its slashes", () => {
  expect(hrefOf({ kind: "outline", file: "wing/kitchen.olai" })).toBe(
    "/wing/kitchen.olai",
  )
})

// Not a route the app writes — a reader typed it. The app they wanted is the
// one at `/`, not a blank screen. A path with no suffix the registry claims
// names no file this directory serves, so it names nothing at all.
test("an unrecognised path is the default outline", () => {
  expect(routeOf("/")).toEqual({ kind: "outline", file: null })
  expect(routeOf("/somewhere/else")).toEqual({ kind: "outline", file: null })
  expect(routeOf("/notes.txt")).toEqual({ kind: "outline", file: null })
})

// A link inside rendered markdown gets the STRICT reading, and the difference
// is the fallback: `routeOf` answers an unknown path with the front page, which
// as an answer to a link somebody wrote in a file would mean every address this
// app has no page for silently opening the default outline. What decides is the
// BIJECTION — an address this app would mint reads back as itself — which is
// the same test a title that NAMES a place is read by.
test("a link on the page is a route when it names a page of this app", () => {
  expect(routeIn("/notes/plan.md")).toEqual({
    kind: "document",
    file: "notes/plan.md",
  })
  // Every kind of page, because a pin may be written as a link and pressing one
  // opens the address (human, 2026-08-19).
  expect(routeIn("/#herbs")).toEqual({ kind: "node", id: "herbs" })
  expect(routeIn("/house.olai")).toEqual({ kind: "outline", file: "house.olai" })
  expect(routeIn("/d/2026-08-10")).toEqual({ kind: "day", date: "2026-08-10" })
  expect(routeIn("/agenda?q=is%3Atodo")).toEqual({ kind: "agenda", filter: "is:todo" })
  expect(routeIn("/today")).toEqual({ kind: "today" })
  for (
    const href of [
      "https://example.com",
      // Not a page of this app: the round trip answers `/`, which is the
      // front-page kindness the address bar gets and this refuses.
      "/somewhere/else",
      "/etc/passwd",
      // …nor one written with an escape nothing can read.
      "/%",
      // An anchor inside the page being read, which is the browser's: an
      // address of this app always starts with a slash.
      "#md-1a2b-beds",
      "",
    ]
  ) {
    expect(routeIn(href)).toBeNull()
  }
})

// A fragment is part of the ADDRESS since the addresses ruling, so a link
// written with one is claimed rather than left to the browser: `#install` after
// a document is a heading it can land on, and `#a1b2c3` on its own is a node.
test("a link into a section of a document is this app's", () => {
  expect(routeIn("/garden.md#beds")).toEqual({
    kind: "document",
    file: "garden.md",
    at: "beds",
  })
  // …including the qualified spelling of a node, which this app reads and would
  // not have written: what decides is whether the parser recognised it.
  expect(routeIn("/house.olai#kitchen")).toEqual({ kind: "node", id: "kitchen" })
})

// The two halves an address keeps apart. A `#` ends the query, so a filter and
// a fragment on one address must not bleed into each other — read the wrong way
// round, `?q=is:done#beds` narrows a page by a word nobody typed.
test("a fragment and a filter are read as themselves", () => {
  expect(routeOf("/garden.md#beds")).toEqual({
    kind: "document",
    file: "garden.md",
    at: "beds",
  })
  // The fragment is the ELEMENT half of the address — here an id in an
  // outline, which normalises to the node — and the query is neither half.
  expect(routeOf("/house.olai?q=is:done#beds")).toEqual({
    kind: "node",
    id: "beds",
    filter: "is:done",
  })
  expect(routeOf("/house.olai?q=is:done")).toEqual({
    kind: "outline",
    file: "house.olai",
    filter: "is:done",
  })
  // An empty fragment names no place, and neither does one that cannot be
  // decoded — both are a page that draws fine without one.
  expect(routeOf("/garden.md#")).toEqual({ kind: "document", file: "garden.md" })
  expect(routeOf("/garden.md#%zz")).toEqual({ kind: "document", file: "garden.md" })
})

// ── an address nothing could have written ──────────────────────────────

// `decodeURIComponent` throws on a malformed escape, and this parser is read
// in two places where a person types: the address bar, and a title in
// `Pins.olai` (docs/format.md's Pins). A throw there is a blank app, not a bad
// address — so every half of an address is total, the way the fragment always
// was.
test("a malformed escape names the front page rather than throwing", () => {
  for (const address of ["/%", "/%ZZ", "/%2", "/%.md", "/d/%ZZ", "/%2/notes.md"]) {
    expect(routeOf(address)).toEqual({ kind: "outline", file: null })
  }
})

test("…and it keeps whatever the address was narrowed by", () => {
  // The query is read by `URLSearchParams`, which is lenient where
  // `decodeURIComponent` is not, so the filter survives a path that does not.
  expect(routeOf("/%?q=is%3Atodo")).toEqual({
    kind: "outline",
    file: null,
    filter: "is:todo",
  })
})

test("a malformed FRAGMENT was always total, and still is", () => {
  expect(routeOf("/notes.md#%ZZ")).toEqual({ kind: "document", file: "notes.md" })
})

test("a markdown link this parser cannot read is left to the browser", () => {
  // The front-page fallback is the right kindness in the address bar and is
  // exactly the silent substitution `routeIn` exists to refuse.
  expect(routeIn("/%ZZ.md")).toBeNull()
  expect(routeIn("/notes.md")).toEqual({ kind: "document", file: "notes.md" })
})
