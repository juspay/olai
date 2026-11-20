import type { NodeContext } from "olai-plugin-chat/wire"
import { describe, expect, test } from "bun:test"

import { lineFor, promptWith } from "./context.ts"

const ORDER: NodeContext = {
  id: "order",
  title: "order the new cabinets",
  file: "house.olai",
  line: 3,
  path: ["kitchen remodel"],
}

const TOP: NodeContext = {
  id: "kitchen",
  title: "kitchen remodel",
  file: "house.olai",
  line: 1,
  path: [],
}

describe("the line a node arrives on", () => {
  test("the id is in backticks, which is how every olai tool spells one", () => {
    expect(lineFor(ORDER)).toBe(
      "Node in context: `order` — order the new cabinets (house.olai:3; under kitchen remodel)",
    )
  })

  test("a node at the top of its outline is under nothing, and says so by not saying it", () => {
    expect(lineFor(TOP)).toBe(
      "Node in context: `kitchen` — kitchen remodel (house.olai:1)",
    )
  })

  test("a deep node names the whole chain, outermost first", () => {
    expect(lineFor({ ...ORDER, path: ["house", "kitchen remodel"] })).toContain(
      "under house › kitchen remodel",
    )
  })

  test("a node that was put away says so, after where it sits", () => {
    expect(lineFor({ ...ORDER, file: "_olai/Trash.olai", trashed: true, line: 1 }))
      .toBe(
        "Node in context: `order` — order the new cabinets (_olai/Trash.olai:1; under kitchen remodel; trashed)",
      )
  })

  test("...and every other node says nothing at all about it", () => {
    expect(lineFor(ORDER)).not.toContain("trashed")
    expect(lineFor({ ...ORDER, file: "_olai/Trash.olai", trashed: true })).toContain("; trashed")
  })
})

describe("what the agent is prompted with", () => {
  test("nothing armed changes nothing at all", () => {
    expect(promptWith("mark it done", [])).toBe("mark it done")
  })

  test("the message first, then what it is about", () => {
    expect(promptWith("why is this blocked?", [ORDER])).toBe(
      `why is this blocked?\n\n${lineFor(ORDER)}`,
    )
  })

  test("two nodes are two lines, in the order they were armed", () => {
    expect(promptWith("compare these", [TOP, ORDER])).toBe(
      `compare these\n\n${lineFor(TOP)}\n${lineFor(ORDER)}`,
    )
  })

  test("a node with no words is the lines alone — 'look at this' is a message", () => {
    expect(promptWith("", [ORDER])).toBe(lineFor(ORDER))
  })
})
