import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import type { NodeChange } from "./changes.ts"
import type { Other } from "./committing.ts"
import { composed } from "./message.ts"

const change = (over: Partial<NodeChange>): NodeChange => ({
  file: "roadmap.olai",
  id: "x",
  title: "a node",
  fields: [],
  sort: "noted",
  ...over,
})

describe("a composed message", () => {
  test("names the biggest change in the subject and lists the rest", () => {
    const message = composed(TEST_CLAIMS, [
      change({ id: "outlines-collection", title: "Outlines as a collection", sort: "done" }),
      change({ id: "notes", title: "Notes: one state, same line", sort: "noted" }),
      change({ id: "kolu", title: "Kolu integration", sort: "created" }),
    ])

    expect(message.split("\n")[0]).toBe("olai: 3 edits to roadmap — Kolu integration created")
    expect(message).toContain("capture: Kolu integration")
    expect(message).toContain("done: Outlines as a collection")
    expect(message).toContain("note: Notes: one state, same line")
  })

  test("says which outline only when there is one of them", () => {
    expect(composed(TEST_CLAIMS, [change({ sort: "done" })]).split("\n")[0])
      .toBe("olai: 1 edit to roadmap — a node done")
    expect(
      composed(TEST_CLAIMS, [change({ sort: "done" }), change({ file: "other.olai", id: "y" })])
        .split("\n")[0],
    ).toBe("olai: 2 edits — a node done")
  })

  test("a date says it is a date, and a move says it is a move", () => {
    expect(composed(TEST_CLAIMS, [change({ sort: "scheduled", title: "pay the bill" })]))
      .toContain("date: pay the bill")
    expect(composed(TEST_CLAIMS, [change({ sort: "moved", title: "pay the bill" })]))
      .toContain("move: pay the bill")
  })

  test("a long list stops listing and says how much it left out", () => {
    const many = Array.from({ length: 25 }, (_, at) => change({ id: `n${at}` }))
    const body = composed(TEST_CLAIMS, many).split("\n")
    expect(body.filter((line) => line.startsWith("note:"))).toHaveLength(20)
    expect(body).toContain("… and 5 more")
  })
})

describe("a message that also carries other files", () => {
  const other = (
    path: string,
    how: Other["how"] = "modified",
    from: string | null = null,
  ): Other => ({ path, how, from })

  test("the subject counts them beside the biggest node change", () => {
    const message = composed(TEST_CLAIMS,
      [change({ title: "Outlines as a collection", sort: "done" })],
      [other("README.md"), other("notes/todo.md", "untracked")],
    )
    expect(message.split("\n")[0]).toBe(
      "olai: 1 edit to roadmap — Outlines as a collection done · 2 other files",
    )
    expect(message).toContain("modified: README.md")
    expect(message).toContain("untracked: notes/todo.md")
  })

  test("a renamed file names the side it came from", () => {
    const message = composed(TEST_CLAIMS, [], [other("Kept.olai", "renamed", "Reading.md")])
    expect(message).toContain("renamed: Reading.md → Kept.olai")
    expect(message).not.toContain("deleted: Reading.md")
    expect(message.split("\n")[0]).toBe("olai: 1 file — Kept.olai")
  })

  test("one other file is singular", () => {
    expect(composed(TEST_CLAIMS, [change({ sort: "done" })], [other("README.md")]).split("\n")[0])
      .toEndWith("· 1 other file")
  })

  test("files with no node changes still name themselves", () => {
    const message = composed(TEST_CLAIMS, [], [other("README.md"), other("docs/design.md")])
    expect(message.split("\n")[0]).toBe("olai: 2 files — README.md and 1 more")
    expect(message).toContain("modified: README.md")
    expect(message).toContain("modified: docs/design.md")

    expect(composed(TEST_CLAIMS, [], [other("README.md")]).split("\n")[0])
      .toBe("olai: 1 file — README.md")
  })

  test("each list stops on its own", () => {
    const many = Array.from({ length: 25 }, (_, at) => change({ id: `n${at}` }))
    const files = Array.from({ length: 25 }, (_, at) => other(`f${at}.md`))
    const body = composed(TEST_CLAIMS, many, files).split("\n")
    expect(body.filter((line) => line.startsWith("note:"))).toHaveLength(20)
    expect(body.filter((line) => line.startsWith("modified:"))).toHaveLength(20)
    expect(body.filter((line) => line === "… and 5 more")).toHaveLength(2)
  })

  test("nothing at all is still nothing", () => {
    expect(composed(TEST_CLAIMS, [], [])).toBe("olai: nothing")
  })
})

test("the subject names the node's title, so a minted id never reaches the log", () => {
  const message = composed(TEST_CLAIMS, [
    change({ id: "1vax4izq", title: "measure the alcove", sort: "created" }),
  ])
  const subject = message.split("\n")[0] ?? ""
  expect(subject).toBe("olai: 1 edit to roadmap — measure the alcove created")
  expect(subject).not.toContain("1vax4izq")
})
