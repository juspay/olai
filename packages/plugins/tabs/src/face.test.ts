import { expect, test } from "bun:test"

import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

import type { Tab } from "./contract.ts"
import { facesOf } from "./face.ts"

const routes = routingIn()
const tab = (id: string, href: string, title = href): Tab => ({ id, href, title })
const titles = (tabs: ReadonlyArray<Tab>) => [...facesOf(routes, tabs).values()].map((face) => face.title)

test("a document tab says the files sidebar's name for it, and a file that is not a document keeps its suffix", () => {
  expect(titles([
    tab("a", "/garden.olai", "garden.olai"),
    tab("b", "/notes/plan.md", "notes/plan.md"),
    tab("c", "/art/report.pdf", "art/report.pdf"),
  ])).toEqual(["garden", "plan", "report.pdf"])
})

test("a page that is not a whole document wears the title its page reported", () => {
  expect(titles([tab("a", "/#install", "install the cabinets"), tab("b", "/", "Home")]))
    .toEqual(["install the cabinets", "Home"])
})

test("two documents sharing a name are both spelled out, and nothing else is", () => {
  expect(titles([
    tab("a", "/notes.md"),
    tab("b", "/notes.olai"),
    tab("c", "/garden.olai"),
    tab("d", "/a/x.olai"),
    tab("e", "/b/x.olai"),
  ])).toEqual(["notes.md", "notes.olai", "garden", "a/x.olai", "b/x.olai"])
})

test("two tabs on the same page are one name, not a clash", () => {
  expect(titles([tab("a", "/garden.olai"), tab("b", "/garden.olai")])).toEqual(["garden", "garden"])
})

test("the tooltip is the address, readable", () => {
  expect(facesOf(routes, [tab("a", "/my%20notes.md")]).get("a")?.tip).toBe("/my notes.md")
})
