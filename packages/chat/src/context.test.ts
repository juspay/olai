/**
 * What a node in context LOOKS LIKE to the agent.
 *
 * One line per node, under what was typed — the sibling of the attachment
 * line, tested the same way and for the same reason: it is the whole of what
 * the agent is told, and the e2e suite's scripted agent reads it back with a
 * regular expression. So the shape is a contract between three files
 * (`./chat.ts` writes it, `packages/tests/agent/fake-acp-agent.ts` parses it,
 * `packages/web/src/client/chat/refs.ts` makes the same spelling pressable),
 * and a change to it that nothing noticed would be a change no agent could
 * follow.
 */

import type { NodeContext } from "@olai/surface"
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

  // A node in an archive can be NAMED — the composer's `@` list completes one
  // for a query that says `is:archived`, and a Trash row's `•••` arms one like
  // any other. What it must not do is arrive reading like live work: no tool
  // refuses a write into an archive, so the line says which it is.
  test("a node that was put away says so, after where it sits", () => {
    expect(lineFor({ ...ORDER, file: "Archive.olai", line: 1 }))
      .toBe(
        "Node in context: `order` — order the new cabinets (Archive.olai:1; under kitchen remodel; archived)",
      )
  })

  test("...and every other node says nothing at all about it", () => {
    // The question is asked of the FILE, so there is no second field to
    // disagree with it: a node in `house.olai` cannot be marked away.
    expect(lineFor(ORDER)).not.toContain("archived")
    expect(lineFor({ ...ORDER, file: "notes/Archive.olai" })).toContain("; archived")
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
    // The rule an attachment already sets: a screenshot pasted with nothing
    // typed is a message, so a node armed with nothing typed is one too.
    expect(promptWith("", [ORDER])).toBe(lineFor(ORDER))
  })
})
