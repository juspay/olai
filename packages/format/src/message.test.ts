/**
 * The words a commit gets when nobody wrote any.
 *
 * A table of sentences is worth a test of its own precisely because it is what
 * a person reads years later out of `git log`, and because nothing else in the
 * system will ever notice if it degrades: an ugly subject line commits exactly
 * as well as a good one.
 */

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
    const message = composed([
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
    expect(composed([change({ sort: "done" })]).split("\n")[0])
      .toBe("olai: 1 edit to roadmap — a node done")
    expect(
      composed([change({ sort: "done" }), change({ file: "other.olai", id: "y" })])
        .split("\n")[0],
    ).toBe("olai: 2 edits — a node done")
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

/**
 * The OTHER files in the repository, which is what `commit-whole-repo` added.
 *
 * A commit that swept up a hand-edited `README.md` used to be impossible; a
 * commit that swept one up and said nothing about it in the log would be worse
 * than that. The subject counts them and the body names them.
 */
describe("a message that also carries other files", () => {
  const other = (path: string, how: Other["how"] = "modified"): Other => ({ path, how })

  test("the subject counts them beside the biggest node change", () => {
    const message = composed(
      [change({ title: "Outlines as a collection", sort: "done" })],
      [other("README.md"), other("notes/todo.md", "untracked")],
    )
    expect(message.split("\n")[0]).toBe(
      "olai: 1 edit to roadmap — Outlines as a collection done · 2 other files",
    )
    // And they are NAMED, with what happened to each: a path-level row is all
    // this feature ever shows of a file it cannot parse, so the log gets
    // exactly what the panel got.
    expect(message).toContain("modified: README.md")
    expect(message).toContain("untracked: notes/todo.md")
  })

  test("one other file is singular", () => {
    expect(composed([change({ sort: "done" })], [other("README.md")]).split("\n")[0])
      .toEndWith("· 1 other file")
  })

  /** Files ALONE — a person edited two documents by hand and asked for a
   *  commit. There is no node change to name, and `olai: nothing` (which is
   *  what this used to say) would be a lie about a commit that recorded two
   *  files. */
  test("files with no node changes still name themselves", () => {
    const message = composed([], [other("README.md"), other("docs/design.md")])
    expect(message.split("\n")[0]).toBe("olai: 2 files — README.md and 1 more")
    expect(message).toContain("modified: README.md")
    expect(message).toContain("modified: docs/design.md")

    expect(composed([], [other("README.md")]).split("\n")[0])
      .toBe("olai: 1 file — README.md")
  })

  /** The two lists have their own budgets: a hundred node changes must not be
   *  able to push every filename out of the body. */
  test("each list stops on its own", () => {
    const many = Array.from({ length: 25 }, (_, at) => change({ id: `n${at}` }))
    const files = Array.from({ length: 25 }, (_, at) => other(`f${at}.md`))
    const body = composed(many, files).split("\n")
    expect(body.filter((line) => line.startsWith("note:"))).toHaveLength(20)
    expect(body.filter((line) => line.startsWith("modified:"))).toHaveLength(20)
    expect(body.filter((line) => line === "… and 5 more")).toHaveLength(2)
  })

  test("nothing at all is still nothing", () => {
    expect(composed([], [])).toBe("olai: nothing")
  })
})

/**
 * The subject names a node the way a person reads it, not the way the file
 * stores it.
 *
 * The design's own example — `olai: 11 edits to roadmap — outlines-collection
 * done` — named the ID, and read perfectly well, because every id in that
 * roadmap is a slug somebody chose. `add_node` MINTS one when the caller does
 * not supply it, which is the ordinary case for an agent capturing nodes, and
 * the same subject then reads `olai: 2 edits to house — 1vax4izq created`. That
 * is a line in a permanent log that nobody can read and nobody can correct
 * afterwards, which is exactly what the `capture:`/`done:` convention is for.
 */
test("the subject names the node's title, so a minted id never reaches the log", () => {
  const message = composed([
    change({ id: "1vax4izq", title: "measure the alcove", sort: "created" }),
  ])
  const subject = message.split("\n")[0] ?? ""
  expect(subject).toBe("olai: 1 edit to roadmap — measure the alcove created")
  expect(subject).not.toContain("1vax4izq")
})
