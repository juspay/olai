/** The grammar of a chat's own address, and the name it is labelled by. */
import { describe, expect, test } from "bun:test"
import type { AgentItem } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"

import { labelOfChat, nameOfItem } from "./called.ts"
import { chatPage, chatSpelling, CHAT_PATH, itemAt } from "./route.ts"

const href = (item: AgentItem) => chatPage.href(item)

describe("what a chat address names", () => {
  const cases: ReadonlyArray<readonly [string, string, AgentItem | null]> = [
    ["a note", "/chat/notes/plan.md", { kind: "note", path: "notes/plan.md" }],
    ["a note at the root", "/chat/finishes.md", { kind: "note", path: "finishes.md" }],
    ["a node", "/chat/order", { kind: "node", id: "order" }],
    ["a node whose id has the marks ids are written with", "/chat/c-plan_2", { kind: "node", id: "c-plan_2" }],
    // A NON-NOTE PATH IS NOT THIS PAGE: nothing but a node and a note has a
    // chat, so the address falls through to whatever else claims it.
    ["a file olai only shows", "/chat/data/costs.csv", null],
    ["a picture", "/chat/photos/kitchen.png", null],
    ["an outline", "/chat/house.olai", null],
    ["a half of a plugin", "/chat/plugins/timer/src/server.ts", null],
    ["no item at all", "/chat/", null],
    ["a path that walks out of the directory", "/chat/../secrets.md", null],
    ["an escape nothing can read", "/chat/notes/%ZZ.md", null],
    ["another page entirely", "/notes/plan.md", null],
  ]
  for (const [said, at, item] of cases) {
    test(said, () => expect(itemAt(TEST_CLAIMS, at)).toEqual(item))
  }

  // BEFORE THE CLAIM TABLE ARRIVES a path is admitted, so a reloaded tab draws
  // its own address rather than losing it; a node is a node without the table,
  // because nothing but its shape says so.
  test("with no claim table yet a path is a note and a node is still a node", () => {
    expect(itemAt(undefined, "/chat/notes/plan.md")).toEqual({ kind: "note", path: "notes/plan.md" })
    expect(itemAt(undefined, "/chat/data/costs.csv")).toEqual({ kind: "note", path: "data/costs.csv" })
    expect(itemAt(undefined, "/chat/order")).toEqual({ kind: "node", id: "order" })
    expect(itemAt(undefined, "/chat/")).toBeNull()
  })
})

describe("what a chat address is written as", () => {
  const items: ReadonlyArray<AgentItem> = [
    { kind: "note", path: "notes/plan.md" },
    { kind: "note", path: "notes/a plan & more.md" },
    { kind: "note", path: "finishes.md" },
    { kind: "node", id: "order" },
  ]
  for (const item of items) {
    test(`${JSON.stringify(item)} survives the round trip`, () => {
      expect(itemAt(undefined, href(item))).toEqual(item)
    })
  }

  test("a path keeps its folders and escapes the rest", () => {
    expect(href({ kind: "note", path: "notes/plan.md" })).toBe("/chat/notes/plan.md")
    expect(href({ kind: "note", path: "notes/a plan.md" })).toBe("/chat/notes/a%20plan.md")
    expect(href({ kind: "node", id: "order" })).toBe("/chat/order")
    expect(chatSpelling({ kind: "note", path: "notes/plan.md" })).toBe("notes/plan.md")
  })

  test("the prefix is the page's own, and `/chat` itself is not it", () => {
    expect(CHAT_PATH).toBe("/chat/")
    expect(itemAt(TEST_CLAIMS, "/chat")).toBeNull()
  })
})

describe("what a chat page is called", () => {
  const titled = (id: string) => id === "install" ? "install the cabinets" : null

  test("a note is its file's name, a node its row's live title", () => {
    expect(nameOfItem({ kind: "note", path: "notes/plan.md" }, TEST_CLAIMS, titled)).toBe("plan")
    expect(nameOfItem({ kind: "node", id: "install" }, TEST_CLAIMS, titled)).toBe("install the cabinets")
  })

  test("a node nothing has named yet is its id, as its own page is", () => {
    expect(nameOfItem({ kind: "node", id: "order" }, TEST_CLAIMS, titled)).toBe("order")
  })

  test("with no claim table the file keeps the suffix rather than being guessed at", () => {
    expect(nameOfItem({ kind: "note", path: "notes/plan.md" }, undefined, titled)).toBe("plan.md")
  })

  // THE COLUMN SAYS IT IS THE CHAT, because a note and its chat beside each
  // other are otherwise two tabs with one word on them.
  test("the label is the name and the word chat", () => {
    expect(labelOfChat({ kind: "note", path: "notes/plan.md" }, TEST_CLAIMS, titled)).toBe("plan · chat")
    expect(labelOfChat({ kind: "node", id: "install" }, TEST_CLAIMS, titled)).toBe("install the cabinets · chat")
  })
})
