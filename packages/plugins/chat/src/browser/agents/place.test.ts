/** What a chat row stands for in the browser, read through the router's own
 *  grammar — and the server's half agreeing with it for files and rows. */
import { describe, expect, test } from "bun:test"
import { type Place, placeWritten } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

import { isCurrent, placeIn, placeOfRoute } from "./place.ts"

const routes = routingIn()
const file = (path: string): Place => ({ kind: "file", path })
const row = (id: string): Place => ({ kind: "row", id })

describe("what a chat row stands for", () => {
  const cases: ReadonlyArray<readonly [string, string, Place | null]> = [
    ["a plain title stands for itself", "install the cabinets", null],
    ["a bare address", "/notes/plan.md", file("notes/plan.md")],
    ["a named link", "[plan](/notes/plan.md)", file("notes/plan.md")],
    ["a row by its bare id", "/#order", row("order")],
    ["the same row, zoomed", "/zoom/#order", row("order")],
    ["the same row, at its file", "/house.olai#order", row("order")],
    ["a heading inside a file is the file", "[budget](/notes/plan.md#budget)", file("notes/plan.md")],
    ["a filter is not part of the place", "/trash?q=hinges", { kind: "page", href: "/trash" }],
    ["a whole outline", "[house](/house.olai)", file("house.olai")],
    ["a path olai does not serve", "/etc/passwd", null],
  ]
  for (const [said, title, place] of cases) {
    test(said, () => expect(placeIn(routes, title)).toEqual(place))
  }

  test("the front page is the page /", () => {
    expect(placeOfRoute(routes, routes.routeOf("/"))).toEqual({ kind: "page", href: "/" })
  })
})

describe("the server's half agrees with the browser's", () => {
  const titles = [
    "/notes/plan.md", "[plan](/notes/plan.md)", "/notes/plan.md#budget", "[house](/house.olai)",
    "/photos/kitchen.png", "/data/costs.csv", "/#order", "/zoom/#order", "/house.olai#order",
    "[order](/house.olai#order)", "/report.pdf", "/a%20file%20with%20spaces.olai",
  ]
  for (const title of titles) {
    test(title, () => expect(placeIn(routes, title)).toEqual(placeWritten(TEST_CLAIMS, title)))
  }
})

describe("the dot on a tab and the lit Chats row follow the place", () => {
  const inbox = { id: "plan", file: "_olai/Inbox.olai" }
  const plan: Place = file("notes/plan.md")
  test("a chat about a document is current on that document, a heading in it included", () => {
    expect(isCurrent(routes, routes.routeOf("/notes/plan.md"), inbox, plan, false)).toBe(true)
    expect(isCurrent(routes, routes.routeOf("/notes/plan.md#budget"), inbox, plan, false)).toBe(true)
  })
  test("...and not on the outline its chat row is filed in, unfolded or not", () => {
    expect(isCurrent(routes, routes.routeOf("/_olai/Inbox.olai"), inbox, plan, true)).toBe(false)
  })
  test("a chat about a whole outline is current at its file, the front page that shows it, and a row landed in it", () => {
    const house = file("house.olai")
    expect(isCurrent(routes, routes.routeOf("/house.olai"), inbox, house, false)).toBe(true)
    expect(isCurrent(routes, routes.routeOf("/house.olai#install"), inbox, house, false)).toBe(true)
    expect(isCurrent(routes, routes.routeOf("/"), inbox, house, false, "house.olai")).toBe(true)
  })
  test("a row chat keeps its rule: its own page, or its outline with it unfolded", () => {
    const own = { id: "install", file: "house.olai" }
    expect(isCurrent(routes, routes.routeOf("/zoom/#install"), own, row("install"), false)).toBe(true)
    expect(isCurrent(routes, routes.routeOf("/house.olai"), own, row("install"), true)).toBe(true)
    expect(isCurrent(routes, routes.routeOf("/house.olai"), own, row("install"), false)).toBe(false)
  })
})
