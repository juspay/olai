/** What a chat row stands for in the browser, read through the router's own
 *  grammar — and the server's half agreeing with it for files and rows. */
import { describe, expect, test } from "bun:test"
import { type Place, placeWritten } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

import { placeOfRoute, standsFor } from "./place.ts"

const routes = routingIn()
const everything = () => true
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
    test(said, () => expect(standsFor(routes, title, everything)).toEqual(place))
  }

  test("a file that is not there stands for nothing", () => {
    expect(standsFor(routes, "[plan](/notes/plan.md)", (place) => place.kind !== "file")).toBeNull()
  })
  test("a row that does not exist stands for nothing", () => {
    expect(standsFor(routes, "/#gone", (place) => place.kind !== "row")).toBeNull()
  })
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
    test(title, () => expect(standsFor(routes, title, everything)).toEqual(placeWritten(TEST_CLAIMS, title)))
  }
})
