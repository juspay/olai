import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { atElement, atFile, atNode, routingOver, NO_PAGES, labelIn, nameIn, lineFragment, lineAt, defineAppPage, defineAppRoute, defineSelfDrawnPage, defineSelfDrawnRoute, HOME_ROUTE, type Route, settleRoutePages } from "./routes.ts"
import { ROUTES, routingIn } from "./routes.testlib.ts"

const routes = routingIn()
const { face: routeFace, filterOf, href: hrefOf, narrowable, narrowedTo, routeIn, routeOf, samePage } = routes


test("every route survives being written to a URL and read back", () => {
  for (const route of ROUTES) {
    expect(routeOf(hrefOf(route))).toEqual(route)
  }
})

test("the addresses are the documented ones", () => {
  expect(hrefOf(HOME_ROUTE)).toBe("/")
  expect(hrefOf(atFile("house.olai"))).toBe("/house.olai")
  expect(hrefOf(atNode("kitchen"))).toBe("/#kitchen")
  expect(hrefOf(atFile("notes/finishes.md"))).toBe(
    "/notes/finishes.md",
  )
  expect(hrefOf(atElement(TEST_CLAIMS, "garden.md", "beds"))).toBe(
    "/garden.md#beds",
  )
  expect(hrefOf({ kind: "trash" })).toBe("/trash")
})

test("the suffix decides which page a document address opens", () => {
  expect(routeOf("/house.olai")).toEqual(atFile("house.olai"))
  expect(routeOf("/finishes.md")).toEqual(atFile("finishes.md"))
  expect(routeOf("/saved/report.html")).toEqual(atFile("saved/report.html"))
})

test("a node is a fragment and nothing else", () => {
  expect(routeOf("/#kitchen")).toEqual(atNode("kitchen"))
})

test("a node's row keeps its file", () => {
  expect(routeOf("/house.olai#kitchen")).toEqual(atElement(TEST_CLAIMS, "house.olai", "kitchen"))
  expect(hrefOf(routeOf("/house.olai#kitchen"))).toBe("/house.olai#kitchen")
})

test("a page with no filter wears no query at all", () => {
  expect(hrefOf(atFile("house.olai"))).toBe("/house.olai")
  expect(hrefOf({ ...atFile("house.olai"), filter: "" })).toBe(
    "/house.olai",
  )
  expect(hrefOf({ ...atNode("kitchen"), filter: "   " })).toBe("/#kitchen")
  expect(routeOf("/house.olai?q=")).toEqual(atFile("house.olai"))
})

test("a `?q=` typed onto a document address is dropped, not carried", () => {
  expect(routeOf("/finishes.md?q=hinges")).toEqual(atFile("finishes.md"))
  expect(routeOf("/garden.md?q=hinges#beds")).toEqual(atElement(TEST_CLAIMS, "garden.md", "beds"))
  expect(filterOf(routeOf("/finishes.md?q=hinges"))).toBe("")
  expect(hrefOf(routeOf("/finishes.md?q=hinges"))).toBe("/finishes.md")
})

test("a filtered page spells it in the query, in front of any fragment", () => {
  expect(hrefOf({ ...atFile("house.olai"), filter: "#home" })).toBe(
    "/house.olai?q=%23home",
  )
  expect(hrefOf({ ...atNode("kitchen"), filter: "is:todo" })).toBe(
    "/?q=is%3Atodo#kitchen",
  )
  expect(routeOf("/?q=is%3Adone#kitchen")).toEqual({ ...atNode("kitchen"), filter: "is:done" })
})

test("every narrowable core route takes a filter, and a blank one takes it off", () => {
  expect(narrowedTo(atNode("kitchen"), "#home")).toEqual({ ...atNode("kitchen"), filter: "#home" })
  expect(narrowedTo({ kind: "trash" }, "hinges")).toEqual({
    kind: "trash",
    filter: "hinges",
  })
  expect(narrowedTo(atFile("finishes.md"), "#home")).toEqual(atFile("finishes.md"))
  const cleared = narrowedTo(
    { ...atFile("house.olai"), filter: "#home" },
    "",
  )
  expect(filterOf(cleared)).toBe("")
  expect(hrefOf(cleared)).toBe("/house.olai")
  expect(samePage(cleared, atFile("house.olai"))).toBe(true)
})

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

test("an outline in a subdirectory keeps its slashes", () => {
  expect(hrefOf(atFile("wing/kitchen.olai"))).toBe(
    "/wing/kitchen.olai",
  )
})

test("unclaimed files retain their path; non-file routes fall back to home", () => {
  expect(routeOf("/")).toEqual(HOME_ROUTE)
  expect(routeOf("/somewhere/else")).toEqual(HOME_ROUTE)
  expect(routeOf("/dir.d/name")).toEqual(HOME_ROUTE)
  expect(routeOf("/notes.txt")).toEqual(atFile("notes.txt"))
})

test("a link on the page is a route when it names a page of this app", () => {
  expect(routeIn("/notes/plan.md")).toEqual(atFile("notes/plan.md"))
  expect(routeIn("/#herbs")).toEqual(atNode("herbs"))
  expect(routeIn("/house.olai")).toEqual(atFile("house.olai"))
  for (
    const href of [
      "https://example.com",
      "/somewhere/else",
      "/etc/passwd",
      "/%",
      "#md-1a2b-beds",
      "",
    ]
  ) {
    expect(routeIn(href)).toBeNull()
  }
})

test("a link into a section of a document is this app's", () => {
  expect(routeIn("/garden.md#beds")).toEqual(atElement(TEST_CLAIMS, "garden.md", "beds"))
  expect(routeIn("/house.olai#kitchen")).toEqual(atElement(TEST_CLAIMS, "house.olai", "kitchen"))
})

test("a link that is not this app's address is left to the browser", () => {
  for (
    const href of [
      "message://%3Cabc123@mail.example%3E",
      "message:%3Cabc123@mail.example%3E",
      "https://example.com/a",
      "mailto:someone@example.com",
      "tel:+15551234",
      "notes/plan.md",
    ]
  ) {
    expect([href, routeIn(href)]).toEqual([href, null])
  }
})

test("a fragment and a filter are read as themselves", () => {
  expect(routeOf("/garden.md#beds")).toEqual(atElement(TEST_CLAIMS, "garden.md", "beds"))
  expect(routeOf("/house.olai?q=is:done#beds"))
    .toEqual({ ...atElement(TEST_CLAIMS, "house.olai", "beds"), filter: "is:done" })
  expect(routeOf("/house.olai?q=is:done")).toEqual({ ...atFile("house.olai"), filter: "is:done" })
  expect(routeOf("/garden.md#")).toEqual(atFile("garden.md"))
  expect(routeOf("/garden.md#%zz")).toEqual(atFile("garden.md"))
})

test("a malformed escape names the front page rather than throwing", () => {
  for (const address of ["/%", "/%ZZ", "/%2", "/%.md", "/d/%ZZ", "/%2/notes.md"]) {
    expect(routeOf(address)).toEqual(HOME_ROUTE)
  }
})

test("…and it keeps whatever the address was narrowed by", () => {
  expect(routeOf("/%?q=is%3Atodo")).toEqual({ ...HOME_ROUTE, filter: "is:todo" })
})

test("a malformed FRAGMENT was always total, and still is", () => {
  expect(routeOf("/notes.md#%ZZ")).toEqual(atFile("notes.md"))
})

test("a markdown link this parser cannot read is left to the browser", () => {
  expect(routeIn("/%ZZ.md")).toBeNull()
  expect(routeIn("/notes.md")).toEqual(atFile("notes.md"))
})

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

test("a source-line document link preserves its query without making the page narrowable", () => {
  const route = { ...atElement(TEST_CLAIMS, "notes/a.md", lineFragment(140)), filter: "word #tag" }
  expect(hrefOf(route)).toBe("/notes/a.md?q=word+%23tag#L140")
  expect(routeOf(hrefOf(route))).toEqual(route)
  expect(narrowable(route)).toBe(false)
  expect(lineAt("L999")).toBe(999)
  expect(lineAt("L0")).toBeUndefined()
  expect(lineAt("L9007199254740992")).toBeUndefined()
})

test("a page's short name: a node's id, a file's path, a tenant's breadcrumb, and a departed tenant's fallback", () => {
  const route = defineAppRoute({
    claims: [{ kind: "exact", path: "/named" }],
    parse: () => "named",
    href: () => "/named" as const,
    breadcrumb: () => "a named page",
    narrowable: false,
    request: () => ({ kind: "trash" } as const),
    stream: { use: () => () => undefined },
  })
  const pages = settleRoutePages([{ plugin: "named", face: defineAppPage(route, () => null) }])
  const plugin: Route = { kind: "plugin", source: pages[0]!.page.route, value: "named" }
  expect(labelIn(pages, HOME_ROUTE)).toBe("Home")
  expect(labelIn(pages, atNode("kitchen"))).toBe("kitchen")
  expect(labelIn(pages, atFile("wing/kitchen.olai"))).toBe("wing/kitchen.olai")
  expect(labelIn(pages, { kind: "trash" })).toBe("Trash")
  expect(labelIn(pages, plugin)).toBe("a named page")
  expect(labelIn([], plugin)).toBe("Page")
})

test("a document is named by the files sidebar's stem, and a file that is not one keeps its suffix", () => {
  expect(nameIn(TEST_CLAIMS, atFile("garden.olai"))).toBe("garden")
  expect(nameIn(TEST_CLAIMS, atFile("notes/plan.md"))).toBe("plan")
  expect(nameIn(TEST_CLAIMS, atElement(TEST_CLAIMS, "garden.md", "beds"))).toBe("garden")
  expect(nameIn(TEST_CLAIMS, atFile("art/report.pdf"))).toBe("report.pdf")
  expect(nameIn(TEST_CLAIMS, atFile("rows.csv"))).toBe("rows.csv")
  expect(nameIn(TEST_CLAIMS, atFile("handle.png"))).toBe("handle.png")
  expect(nameIn(TEST_CLAIMS, atNode("kitchen"))).toBeUndefined()
  expect(nameIn(TEST_CLAIMS, atElement(TEST_CLAIMS, "house.olai", "kitchen"))).toBeUndefined()
  expect(nameIn(TEST_CLAIMS, HOME_ROUTE)).toBeUndefined()
  expect(nameIn(TEST_CLAIMS, { kind: "trash" })).toBeUndefined()
  expect(nameIn(undefined, atFile("garden.olai"))).toBeUndefined()
})

test("node addresses keep their identity before the file claims arrive", () => {
  const early = routingOver(() => undefined, () => NO_PAGES)
  expect(early.routeOf("/#herbs")).toEqual(atNode("herbs"))
  expect(early.href(early.routeOf("/zoom/#herbs"))).toBe("/zoom/#herbs")
})

const drawnRoute = () => defineSelfDrawnRoute<{ readonly word: string }>({
  claims: [{ kind: "prefix", path: "/drawn/" }],
  parse: (pathname) => {
    const word = pathname.slice("/drawn/".length)
    return /^[a-z]+$/.test(word) ? { word } : null
  },
  href: ({ word }) => `/drawn/${word}`,
  breadcrumb: ({ word }) => `Drawn ${word}`,
  narrowable: true,
})

test("a self-drawn page reads, prints and names itself through the same grammar", () => {
  const route = drawnRoute()
  const pages = settleRoutePages([{ plugin: "drawn", face: defineSelfDrawnPage(route, () => null) }])
  const mounted = routingIn(pages)
  const opened = mounted.routeOf("/drawn/alpha")
  expect(opened).toEqual(route.to({ word: "alpha" }))
  expect(route.value(opened)).toEqual({ word: "alpha" })
  expect(mounted.href(opened)).toBe("/drawn/alpha")
  expect(mounted.routeIn("/drawn/alpha")).toEqual(opened)
  expect(mounted.label(opened)).toBe("Drawn alpha")
  expect(mounted.face(opened)?.kind).toBe("self-drawn")
  expect(mounted.routeOf("/drawn/alpha?q=x")).toEqual({ ...opened, filter: "x" })
  expect(mounted.href(mounted.narrowedTo(opened, "x y"))).toBe("/drawn/alpha?q=x+y")
  expect(mounted.samePage(opened, mounted.narrowedTo(opened, "x"))).toBe(true)
  expect(mounted.samePage(opened, mounted.routeOf("/drawn/beta"))).toBe(false)
  expect(mounted.routeIn("/drawn/Not-A-Word")).toBeNull()
  expect(mounted.routeOf("/drawn/Not-A-Word")).toEqual(HOME_ROUTE)
})

test("a self-drawn page's kind rides on its source, so outlines can refuse it even after the tenant has left", () => {
  const route = drawnRoute()
  const opened = route.to({ word: "alpha" })
  expect(opened.kind === "plugin" && opened.source.kind).toBe("self-drawn")
  expect(routeFace(opened)).toBeNull()
  expect(hrefOf(opened)).toBe(hrefOf(HOME_ROUTE))
  expect(samePage(opened, HOME_ROUTE)).toBe(false)
  expect(routes.label(opened)).toBe("Page")
  const node = defineAppRoute({
    claims: [{ kind: "exact", path: "/node" }],
    parse: () => "node",
    href: () => "/node" as const,
    breadcrumb: () => "node",
    narrowable: false,
    request: () => ({ kind: "trash" } as const),
    stream: { use: () => () => undefined },
  })
  const nodeRoute = node.to("node")
  expect(nodeRoute.kind === "plugin" && nodeRoute.source.kind).toBe("node")
})

test("self-drawn and node claims settle in one table, colliding as one", () => {
  const node = defineAppRoute({
    claims: [{ kind: "exact", path: "/drawn/alpha" }],
    parse: () => "node",
    href: () => "/drawn/alpha" as const,
    breadcrumb: () => "node",
    narrowable: false,
    request: () => ({ kind: "trash" } as const),
    stream: { use: () => () => undefined },
  })
  const logged: Array<string> = []
  const settled = settleRoutePages([
    { plugin: "drawn", face: defineSelfDrawnPage(drawnRoute(), () => null) },
    { plugin: "node", face: defineAppPage(node, () => null) },
  ], (message) => logged.push(message))
  expect(settled.map((one) => [one.plugin, one.page.kind])).toEqual([["drawn", "self-drawn"]])
  expect(logged).toEqual([
    "app route exact /drawn/alpha from node overlaps drawn's prefix /drawn/; keeping drawn and dropping node",
  ])
})

test("an app.route entry not built by a definer is dropped", () => {
  const logged: Array<string> = []
  const route = drawnRoute()
  const forged = { route: { ...route.source }, face: () => null }
  expect(settleRoutePages([{ plugin: "forged", face: forged }], (message) => logged.push(message))).toEqual([])
  expect(logged).toHaveLength(1)
})
