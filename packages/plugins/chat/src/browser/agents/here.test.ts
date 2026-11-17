/** Which chat a page is about, and what the sidebar's lit row and a tab's dot
 *  follow from it. */
import { describe, expect, test } from "bun:test"
import type { AgentItem } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

import { isCurrent, itemHere, noteHere, routeOfItem } from "./here.ts"

const routes = routingIn()
const at = (href: string) => routes.routeOf(href)

describe("which chat a page is about", () => {
  const cases: ReadonlyArray<readonly [string, string, AgentItem | null]> = [
    ["a note", "/notes/plan.md", { kind: "note", path: "notes/plan.md" }],
    ["a heading inside a note is the note", "/notes/plan.md#budget", { kind: "note", path: "notes/plan.md" }],
    ["a node's own page", "/zoom/#order", { kind: "node", id: "order" }],
    ["the same node, revealed", "/#order", { kind: "node", id: "order" }],
    ["a row landing is the outline, and an outline has no chat", "/house.olai#order", null],
    ["a whole outline", "/house.olai", null],
    ["the front page", "/", null],
    ["a file olai only shows", "/data/costs.csv", null],
    ["a picture", "/photos/kitchen.png", null],
    ["the Trash", "/trash", null],
  ]
  for (const [said, href, item] of cases) {
    test(said, () => expect(itemHere(TEST_CLAIMS, at(href))).toEqual(item))
  }

  test("the faces that only take notes read the same answer", () => {
    expect(noteHere(TEST_CLAIMS, at("/notes/plan.md"))).toBe("notes/plan.md")
    expect(noteHere(TEST_CLAIMS, at("/zoom/#order"))).toBeNull()
    expect(noteHere(TEST_CLAIMS, at("/house.olai"))).toBeNull()
  })

  // A PAGE READ BEFORE THE DIRECTORY HAS SAID WHAT IT SERVES is no item: the
  // claim table is what says a file is a note, and a node is a node without
  // it.
  test("with no claim table yet, a file is nothing and a node is still a node", () => {
    expect(itemHere(undefined, at("/notes/plan.md"))).toBeNull()
    expect(itemHere(undefined, at("/zoom/#order"))).toEqual({ kind: "node", id: "order" })
  })
})

describe("where a chat opens", () => {
  test("a note's chat opens its note, a node's its own page", () => {
    expect(routes.href(routeOfItem({ kind: "note", path: "notes/plan.md" }))).toBe("/notes/plan.md")
    expect(routes.href(routeOfItem({ kind: "node", id: "order" }))).toBe("/zoom/#order")
  })
})

describe("the dot on a tab and the lit Chats row", () => {
  const note = { id: "/notes/plan.md", file: "notes/plan.md" }
  const node = { id: "install", file: "house.olai" }

  test("a note's chat is current on its note, a heading in it included", () => {
    expect(isCurrent(TEST_CLAIMS, at("/notes/plan.md"), note, false)).toBe(true)
    expect(isCurrent(TEST_CLAIMS, at("/notes/plan.md#budget"), note, false)).toBe(true)
  })

  test("...and nowhere else", () => {
    expect(isCurrent(TEST_CLAIMS, at("/house.olai"), note, true)).toBe(false)
    expect(isCurrent(TEST_CLAIMS, at("/finishes.md"), note, false)).toBe(false)
    expect(isCurrent(TEST_CLAIMS, at("/"), note, false)).toBe(false)
  })

  test("a node's chat is current on its own page, or on its outline with the fold open", () => {
    expect(isCurrent(TEST_CLAIMS, at("/zoom/#install"), node, false)).toBe(true)
    expect(isCurrent(TEST_CLAIMS, at("/house.olai"), node, true)).toBe(true)
    expect(isCurrent(TEST_CLAIMS, at("/house.olai"), node, false)).toBe(false)
    expect(isCurrent(TEST_CLAIMS, at("/notes/plan.md"), node, true)).toBe(false)
  })
})
