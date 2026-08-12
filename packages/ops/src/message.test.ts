/**
 * The words a commit gets when nobody wrote any.
 *
 * A table of sentences is worth a test of its own precisely because it is what
 * a person reads years later out of `git log`, and because nothing else in the
 * system will ever notice if it degrades: an ugly subject line commits exactly
 * as well as a good one.
 */

import type { NodeChange } from "@olai/format"
import { describe, expect, test } from "bun:test"

import { composed, signed } from "./message.ts"

const change = (over: Partial<NodeChange>): NodeChange => ({
  file: "roadmap.jsonl",
  id: "x",
  title: "a node",
  fields: [],
  sort: "noted",
  ...over,
})

describe("a composed message", () => {
  test("names the biggest change in the subject and lists the rest", () => {
    const message = composed([
      change({ id: "outlines-collection", title: "Outlines as a collection", sort: "done" }),
      change({ id: "notes", title: "Notes: one state, same line", sort: "noted" }),
      change({ id: "kolu", title: "Kolu integration", sort: "created" }),
    ])

    expect(message.split("\n")[0]).toBe("olai: 3 edits to roadmap — kolu created")
    expect(message).toContain("capture: Kolu integration")
    expect(message).toContain("done: Outlines as a collection")
    expect(message).toContain("note: Notes: one state, same line")
  })

  test("says which outline only when there is one of them", () => {
    expect(composed([change({ sort: "done" })]).split("\n")[0])
      .toBe("olai: 1 edit to roadmap — x done")
    expect(
      composed([change({ sort: "done" }), change({ file: "other.jsonl", id: "y" })])
        .split("\n")[0],
    ).toBe("olai: 2 edits — x done")
  })

  // The correction this feature carried: a date used to print as `move:`,
  // which beside a real reparenting op read as a structural change that never
  // happened.
  test("a date says it is a date, and a move says it is a move", () => {
    expect(composed([change({ sort: "scheduled", title: "pay the bill" })]))
      .toContain("date: pay the bill")
    expect(composed([change({ sort: "moved", title: "pay the bill" })]))
      .toContain("move: pay the bill")
  })

  test("a long list stops listing and says how much it left out", () => {
    const many = Array.from({ length: 25 }, (_, at) => change({ id: `n${at}` }))
    const body = composed(many).split("\n")
    expect(body.filter((line) => line.startsWith("note:"))).toHaveLength(20)
    expect(body).toContain("… and 5 more")
  })
})

describe("a signed message", () => {
  test("carries the prefix and the writer trailer", () => {
    expect(signed("reconcile the roadmap", "chat-agent")).toBe(
      "olai: reconcile the roadmap\n\nX-Olai-Writer: chat-agent\n",
    )
  })

  test("does not prefix what is already prefixed", () => {
    expect(signed("olai: 3 edits to roadmap — x done", "web")).toStartWith(
      "olai: 3 edits to roadmap — x done\n\n",
    )
  })

  test("an empty message is still a message", () => {
    expect(signed("   ", "mcp")).toStartWith("olai: commit\n")
  })
})
