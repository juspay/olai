import { expect, test } from "bun:test"

import { atElement, atFile, atNode, defineAppPage, defineAppRoute, filterOf, HOME_ROUTE, hrefOf, narrowedTo, type Route, routeIn, routeOf, samePage, settleRoutePages } from "./routes.ts"
import { ROUTES } from "./routes.testlib.ts"

test("every route survives being written to a URL and read back", () => {
  for (const route of ROUTES) {
    expect(routeOf(hrefOf(route))).toEqual(route)
  }
})

// A content URL is `/` and then the address — no prefix, because the suffix in
// the path already says which kind of page it opens and a node's address is a
// fragment (`@olai/format`'s `address.ts`).
test("the addresses are the documented ones", () => {
  expect(hrefOf(HOME_ROUTE)).toBe("/")
  expect(hrefOf(atFile("house.olai"))).toBe("/house.olai")
  expect(hrefOf(atNode("kitchen"))).toBe("/#kitchen")
  expect(hrefOf(atFile("notes/finishes.md"))).toBe(
    "/notes/finishes.md",
  )
  expect(hrefOf(atElement("garden.md", "beds"))).toBe(
    "/garden.md#beds",
  )
  expect(hrefOf({ kind: "trash" })).toBe("/trash")
})

// Which PAGE a path opens is the suffix's answer: a `.olai` is a tree, and
// every other served kind is a body. One address grammar, two pages, and no
// prefix free to disagree with the name it carries.
test("the suffix decides which page a document address opens", () => {
  expect(routeOf("/house.olai")).toEqual(atFile("house.olai"))
  expect(routeOf("/finishes.md")).toEqual(atFile("finishes.md"))
  expect(routeOf("/saved/report.html")).toEqual(atFile("saved/report.html"))
})

// The node permalink is location-free: an id survives renames and moves
// between files, and the grammar's own spelling of a node carries no file.
test("a node is a fragment and nothing else", () => {
  expect(routeOf("/#kitchen")).toEqual(atNode("kitchen"))
})

// Written with the file it lives in — which somebody who knows where it is
// will write — a node address KEEPS its file: the qualified spelling is what
// the outline's landing answers, `/File.olai#id`, and zoom is what the bare
// one still means. The two were one address until the outline arm gained its
// landing, and they are two rather than one normalised away, because the file
// half is now where the reader LANDS rather than a fact to discard before the
// page can go stale.
test("a node's row keeps its file", () => {
  expect(routeOf("/house.olai#kitchen")).toEqual(atElement("house.olai", "kitchen"))
  expect(hrefOf(routeOf("/house.olai#kitchen"))).toBe("/house.olai#kitchen")
})

// ── the filter, which is the one thing that is not a path ──────────────

// An unfiltered page is exactly the address it always was: no `?`, no empty
// query, so one page is one string in the bar and one entry in the history.
test("a page with no filter wears no query at all", () => {
  expect(hrefOf(atFile("house.olai"))).toBe("/house.olai")
  expect(hrefOf({ ...atFile("house.olai"), filter: "" })).toBe(
    "/house.olai",
  )
  expect(hrefOf({ ...atNode("kitchen"), filter: "   " })).toBe("/#kitchen")
  expect(routeOf("/house.olai?q=")).toEqual(atFile("house.olai"))
})

// The NEGATIVE round trip, and the only page that has one: a document takes no
// filter, and `routeOf`'s document arm is the single place that exclusion is
// enforced — it is the one arm that does not spread the parsed query onto the
// route. So an address somebody typed a `?q=` into by hand opens the document
// and nothing else: no filter on the route, no bar over the page (which is
// drawn on what the page DRAWS, `page.ts`), and the address the app writes back
// is the bare one.
test("a `?q=` typed onto a document address is dropped, not carried", () => {
  expect(routeOf("/finishes.md?q=hinges")).toEqual(atFile("finishes.md"))
  // ...including beside the one thing that address DOES carry.
  expect(routeOf("/garden.md?q=hinges#beds")).toEqual(atElement("garden.md", "beds"))
  expect(filterOf(routeOf("/finishes.md?q=hinges"))).toBe("")
  expect(hrefOf(routeOf("/finishes.md?q=hinges"))).toBe("/finishes.md")
})

// A URL puts its query BEFORE its fragment, so a narrowed node page is the one
// address whose two halves sit either side of the filter. Written any other
// way, the browser reads `?q=…` as part of the fragment and the page loses its
// filter.
test("a filtered page spells it in the query, in front of any fragment", () => {
  expect(hrefOf({ ...atFile("house.olai"), filter: "#home" })).toBe(
    "/house.olai?q=%23home",
  )
  expect(hrefOf({ ...atNode("kitchen"), filter: "is:todo" })).toBe(
    "/?q=is%3Atodo#kitchen",
  )
  expect(routeOf("/?q=is%3Adone#kitchen")).toEqual({ ...atNode("kitchen"), filter: "is:done" })
})

// Narrowing is asked of the module that knows which routes may carry one: a
// filter typed on a document page has nowhere to go, and spreading it on anyway
// would mint an address `hrefOf` drops and `routeOf` never returns.
test("every narrowable core route takes a filter, and a blank one takes it off", () => {
  expect(narrowedTo(atNode("kitchen"), "#home")).toEqual({ ...atNode("kitchen"), filter: "#home" })
  expect(narrowedTo({ kind: "trash" }, "hinges")).toEqual({
    kind: "trash",
    filter: "hinges",
  })
  // The one page this grammar has nothing to say about: prose is not nodes.
  expect(narrowedTo(atFile("finishes.md"), "#home")).toEqual(atFile("finishes.md"))
  // Cleared. What matters is the ADDRESS, which is where the one-spelling rule
  // actually bites: two routes for the same unfiltered page are one string in
  // the bar and one entry in the history.
  const cleared = narrowedTo(
    { ...atFile("house.olai"), filter: "#home" },
    "",
  )
  expect(filterOf(cleared)).toBe("")
  expect(hrefOf(cleared)).toBe("/house.olai")
  expect(samePage(cleared, atFile("house.olai"))).toBe(true)
})

// What the page memo is keyed on: a query typed one character at a time must
// not re-resolve the page under it (`App.tsx`).
test("two addresses for one page are the same page, whatever narrows them", () => {
  const bare: Route = atNode("install")
  expect(samePage(bare, narrowedTo(bare, "#home"))).toBe(true)
  expect(samePage(narrowedTo(bare, "a"), narrowedTo(bare, "b"))).toBe(true)
  expect(samePage(bare, atNode("hinges"))).toBe(false)
  expect(samePage(bare, atFile("house.olai"))).toBe(false)
})

test("what a page is narrowed by is read off the route", () => {
  expect(filterOf({ ...atNode("kitchen"), filter: "#home" })).toBe("#home")
  expect(filterOf(atNode("kitchen"))).toBe("")
  expect(filterOf({ kind: "trash", filter: "hinges" })).toBe("hinges")
  expect(filterOf({ kind: "trash" })).toBe("")
  expect(filterOf(atFile("finishes.md"))).toBe("")
})

// `/trash` spells no file for the agenda's reason: which archives exist is the
// set's answer, and an address that named one would mean something different
// the day a subdirectory gets its own. An archive's own outline address still
// parses — what page it opens is `page.ts`'s call, not this parser's.
test("the trash is one address, and an archive's path is still an outline's", () => {
  expect(routeOf("/trash")).toEqual({ kind: "trash" })
  expect(routeOf("/_olai/Trash.olai")).toEqual(atFile("_olai/Trash.olai"))
})

test("a core document is not a journal route", () => {
  expect(routeOf("/today.md")).toEqual(atFile("today.md"))
  expect(routeOf("/agenda.olai")).toEqual(atFile("agenda.olai"))
})

test("journal addresses are absent when no journal route is registered", () => {
  for (const address of ["/today", "/agenda", "/d/2026-08-10"]) {
    expect(routeOf(address)).toEqual(HOME_ROUTE)
    expect(routeIn(address)).toBeNull()
  }
})

test("a colliding plugin route is dropped without taking the claim table down", () => {
  const page = (claims: ReadonlyArray<{ readonly kind: "exact" | "prefix"; readonly path: `/${string}` }>) => {
    const route = defineAppRoute({
      claims,
      parse: () => "page",
      href: () => "/page" as const,
      breadcrumb: () => "page",
      narrowable: false,
      request: () => ({ kind: "trash" } as const),
      stream: { use: () => () => undefined },
    })
    return defineAppPage(route, () => null)
  }
  const logged: Array<string> = []
  const settled = settleRoutePages([
    { plugin: "first", face: page([{ kind: "exact", path: "/today" }]) },
    { plugin: "second", face: page([{ kind: "prefix", path: "/tod" }]) },
    { plugin: "third", face: page([{ kind: "exact", path: "/agenda" }]) },
  ], (message) => logged.push(message))

  expect(settled.map((one) => one.plugin)).toEqual(["first", "third"])
  expect(logged).toEqual([
    "app route prefix /tod from second overlaps first's exact /today; keeping first and dropping second",
  ])
})

// A directory separator stays a separator, so the URL bar shows the path a
// reader recognises rather than a run of escapes.
test("an outline in a subdirectory keeps its slashes", () => {
  expect(hrefOf(atFile("wing/kitchen.olai"))).toBe(
    "/wing/kitchen.olai",
  )
})

// Not a route the app writes — a reader typed it. The app they wanted is the
// one at `/`, not a blank screen. A path with no suffix the registry claims
// names no file this directory serves, so it names nothing at all.
test("an unrecognised path is the default outline", () => {
  expect(routeOf("/")).toEqual(HOME_ROUTE)
  expect(routeOf("/somewhere/else")).toEqual(HOME_ROUTE)
  expect(routeOf("/notes.txt")).toEqual(HOME_ROUTE)
})

// A link inside rendered markdown gets the STRICT reading, and the difference
// is the fallback: `routeOf` answers an unknown path with the front page, which
// as an answer to a link somebody wrote in a file would mean every address this
// app has no page for silently opening the default outline. What decides is the
// BIJECTION — an address this app would mint reads back as itself — which is
// the same test a title that NAMES a place is read by.
test("a link on the page is a route when it names a page of this app", () => {
  expect(routeIn("/notes/plan.md")).toEqual(atFile("notes/plan.md"))
  // Every core kind of page, because a pin may be written as a link and
  // pressing one opens the address (human, 2026-08-19).
  expect(routeIn("/#herbs")).toEqual(atNode("herbs"))
  expect(routeIn("/house.olai")).toEqual(atFile("house.olai"))
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
  expect(routeIn("/garden.md#beds")).toEqual(atElement("garden.md", "beds"))
  // …including the qualified spelling of a node — the outline's landing,
  // which is the page that spelling draws since the outline arm gained one.
  expect(routeIn("/house.olai#kitchen")).toEqual(atElement("house.olai", "kitchen"))
})

/**
 * A SCHEME GOES WHERE IT SAYS, and this app does not get a vote.
 *
 * `routeIn` answers `null` for anything that is not an address of this app, and
 * `useFollow` leaves a `null` alone — no `preventDefault`, no navigation — so
 * the browser follows the href, and a scheme the browser has no page for is
 * handed to the OS. That is what makes a captured mail's `message://` link open
 * Mail.app rather than being swallowed by a router that thought every anchor on
 * the page was its own — written into the note by whoever captured it
 * (docs/running.md's mail recipe), not composed by olai.
 *
 * It is already true, and the test is what makes it STAY true: nothing about
 * "this link is not ours" is expressed as a scheme list anywhere — it falls out
 * of the leading `/` — so a future rule about external links has no one line to
 * fail on. This is that line.
 */
test("a link that is not this app's address is left to the browser", () => {
  for (
    const href of [
      // The scheme quick capture writes.
      "message://%3Cabc123@mail.example%3E",
      "message:%3Cabc123@mail.example%3E",
      // The ordinary ones, and the point is that they are the same case.
      "https://example.com/a",
      "mailto:someone@example.com",
      "tel:+15551234",
      // A relative link between two files is resolved before it is followed
      // (`@olai/format`), so what arrives here always starts at the root — one
      // that has not been is not this app's either.
      "notes/plan.md",
    ]
  ) {
    expect([href, routeIn(href)]).toEqual([href, null])
  }
})

// The two halves an address keeps apart. A `#` ends the query, so a filter and
// a fragment on one address must not bleed into each other — read the wrong way
// round, `?q=is:done#beds` narrows a page by a word nobody typed.
test("a fragment and a filter are read as themselves", () => {
  expect(routeOf("/garden.md#beds")).toEqual(atElement("garden.md", "beds"))
  // The fragment is the ELEMENT half of the address — here the row of an
  // outline — and the query is neither half. A row route is narrowable like
  // the outline it opens, so both halves ride.
  expect(routeOf("/house.olai?q=is:done#beds"))
    .toEqual({ ...atElement("house.olai", "beds"), filter: "is:done" })
  expect(routeOf("/house.olai?q=is:done")).toEqual({ ...atFile("house.olai"), filter: "is:done" })
  // An empty fragment names no place, and neither does one that cannot be
  // decoded — both are a page that draws fine without one.
  expect(routeOf("/garden.md#")).toEqual(atFile("garden.md"))
  expect(routeOf("/garden.md#%zz")).toEqual(atFile("garden.md"))
})

// ── an address nothing could have written ──────────────────────────────

// `decodeURIComponent` throws on a malformed escape, and this parser is read
// in two places where a person types: the address bar, and a title in
// `Pins.olai` (docs/format.md's Pins). A throw there is a blank app, not a bad
// address — so every half of an address is total, the way the fragment always
// was.
test("a malformed escape names the front page rather than throwing", () => {
  for (const address of ["/%", "/%ZZ", "/%2", "/%.md", "/d/%ZZ", "/%2/notes.md"]) {
    expect(routeOf(address)).toEqual(HOME_ROUTE)
  }
})

test("…and it keeps whatever the address was narrowed by", () => {
  // The query is read by `URLSearchParams`, which is lenient where
  // `decodeURIComponent` is not, so the filter survives a path that does not.
  expect(routeOf("/%?q=is%3Atodo")).toEqual({ ...HOME_ROUTE, filter: "is:todo" })
})

test("a malformed FRAGMENT was always total, and still is", () => {
  expect(routeOf("/notes.md#%ZZ")).toEqual(atFile("notes.md"))
})

test("a markdown link this parser cannot read is left to the browser", () => {
  // The front-page fallback is the right kindness in the address bar and is
  // exactly the silent substitution `routeIn` exists to refuse.
  expect(routeIn("/%ZZ.md")).toBeNull()
  expect(routeIn("/notes.md")).toEqual(atFile("notes.md"))
})

// An absent plugin prints the fallback URL, but its stale request must not
// suppress the core home request when the router reinterprets that address.
test("an unavailable plugin page is distinct from home and replacement providers", () => {
  const source = () => {
    const route = defineAppRoute({
      claims: [{ kind: "exact", path: "/gone" }],
      parse: () => "gone",
      href: () => "/gone" as const,
      breadcrumb: () => "gone",
      narrowable: false,
      request: () => ({ kind: "trash" } as const),
      stream: { use: () => () => undefined },
    })
    return settleRoutePages([{ plugin: "absent", face: defineAppPage(route, () => null) }])[0]!.page.route
  }
  const gone: Route = { kind: "plugin", source: source(), value: "gone" }
  expect(hrefOf(gone)).toBe(hrefOf(HOME_ROUTE))
  expect(samePage(gone, HOME_ROUTE)).toBe(false)
  expect(samePage(HOME_ROUTE, gone)).toBe(false)
  expect(samePage(gone, { ...gone, source: source() })).toBe(false)
  expect(samePage(gone, gone)).toBe(true)
})
