import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { addressOf } from "@olai/format"

import type { Names } from "olai-plugin-outlines/names"
import { atElement, atFile, atNode, HOME_ROUTE } from "olai-plugin-navigation/routes"
import { ROUTES, routingIn } from "olai-plugin-navigation/routes.testlib.ts"
import { requestFor } from "./page.ts"
import { addressIn as addressWith, labelIn, nameOf as nameWith, shownIn } from "olai-plugin-navigation/address/address.ts"

const routes = routingIn()
const { href: hrefOf, routeIn, routeOf } = routes
const addressIn = (title: string) => addressWith(routes, title)
const nameOf = (route: Parameters<typeof nameWith>[1], shows: Parameters<typeof nameWith>[2]) => nameWith(routes, route, shows)

test("an address this app would mint is a pin, whatever page it names", () => {
  for (const address of [
    "/#herbs",
    "/notes/finishes.md",
    "/garden.olai",
    "/trash",
    "/",
  ]) {
    expect(hrefOf(addressIn(address)!)).toBe(address)
  }
})

test("a title carrying an address gets the link's own answer — one grammar, one door", () => {
  const addresses = ROUTES.map(hrefOf)
  const doors = addresses.map((address) => {
    expect(routeIn(address)).not.toBeNull()
    return routeIn(address) ?? undefined
  })
  expect(addresses.map((address) => addressIn(address))).toEqual(doors)
  expect(addresses.map((address) => addressIn(`[named it](${address})`))).toEqual(doors)
  for (const address of ["/etc/passwd", "/notes and things", "/%"]) {
    expect(routeIn(address)).toBeNull()
    expect(addressIn(address)).toBeUndefined()
    expect(addressIn(`[named it](${address})`)).toBeUndefined()
  }
})

test("the query rides along, and is read back as the filter it is", () => {
  const route = addressIn("/trash?q=is%3Atodo")
  expect(route).toEqual({ kind: "trash", filter: "is:todo" })
})

test("a query somebody wrote by hand is the same pin as the one a browser mints", () => {
  expect(addressIn("/trash?q=is:todo")).toEqual(addressIn("/trash?q=is%3Atodo"))
})

test("a title that merely begins with a slash is a title, not a door", () => {
  expect(addressIn("/etc/passwd")).toBeUndefined()
  expect(addressIn("/notes and things")).toBeUndefined()
})

test("a title spelled with an escape nothing can read is not a door, and does not throw", () => {
  for (const title of ["/%", "/%ZZ.md", "/%2.olai", "[x](/%)"]) {
    expect(addressIn(title)).toBeUndefined()
  }
})

test("ordinary prose is not a pin", () => {
  expect(addressIn("the ones I keep coming back to")).toBeUndefined()
  expect(addressIn("")).toBeUndefined()
})

test("a markdown link is a NAMED pin; a blank label is no name", () => {
  const named = "[What is discarded](/trash?q=is%3Atodo)"
  expect(hrefOf(addressIn(named)!)).toBe("/trash?q=is%3Atodo")
  expect(addressIn("[](/#herbs)")).toEqual(atNode("herbs"))
})

test("prose either side of a link is a sentence, not a pin", () => {
  expect(addressIn("see [the trash](/trash) tomorrow")).toBeUndefined()
})

test("both spellings name the same place — the label is the only difference", () => {
  expect(addressIn("/#herbs")).toEqual(atNode("herbs"))
  expect(addressIn("[the herb bed](/#herbs)")).toEqual(atNode("herbs"))
  expect(addressIn("buy milk")).toBeUndefined()
})

test("the label somebody wrote is a name; a blank one is not", () => {
  expect(labelIn("[What is discarded](/trash?q=is%3Atodo)")).toBe("What is discarded")
  expect(labelIn("[](/#herbs)")).toBeUndefined()
  expect(labelIn("/#herbs")).toBeUndefined()
})


test("a node address is called whatever that node is called right now", () => {
  expect(nameOf(atNode("herbs"), "the herb bed")).toBe("the herb bed")
  expect(nameOf(atNode("herbs"), "the herb spiral")).toBe("the herb spiral")
})

test("an address nobody can name says the address rather than a blank", () => {
  expect(nameOf(atNode("gone"), undefined)).toBe("/#gone")
})



test("a file is called by its own name, not by its path", () => {
  expect(nameOf(atFile("notes/finishes.md"), undefined)).toBe("finishes.md")
  expect(nameOf(atFile("a/b/garden.olai"), undefined)).toBe("garden.olai")
})

test("the pages that are not files are called what a reader calls them", () => {
  expect(nameOf(HOME_ROUTE, undefined)).toBe("Home")
  expect(nameOf({ kind: "trash" }, undefined)).toBe("Trash")
})

const named = (title: string): Names => (id) =>
  id === "herbs" ? { id: "herbs", title, file: "garden.olai" } : undefined

test("a node address asked of the page's names is that node's title", () => {
  expect(shownIn(named("the herb bed"), atNode("herbs"))).toBe("the herb bed")
  expect(shownIn(named("the herb spiral"), atNode("herbs"))).toBe("the herb spiral")
})

test("nothing to say, said the same way three times", () => {
  expect(shownIn(named("the herb bed"), atNode("gone"))).toBeUndefined()
  expect(shownIn(named("the herb bed"), atFile("notes/finishes.md"))).toBeUndefined()
  expect(shownIn(named("the herb bed"), { kind: "trash" })).toBeUndefined()
})

test("a landed row page is named by its file — the request the table answered held no row", () => {
  expect(requestFor(routeOf("/house.olai#install"))).toEqual({
    kind: "at",
    address: addressOf(TEST_CLAIMS, "house.olai", null),
  })
  expect(nameOf(routeOf("/house.olai#install"), undefined)).toBe("house.olai")
})

test("the qualified spelling of a node answers the node's own live name", () => {
  expect(shownIn(named("the herb bed"), atElement(TEST_CLAIMS, "garden.olai", "herbs"))).toBe("the herb bed")
  expect(nameOf(routeOf("/garden.olai#herbs"), "the herb bed")).toBe("the herb bed")
})
