/**
 * Two readings in, node-level changes out. Values only — there is no git
 * anywhere near this file, which is the whole reason the comparison lives in
 * this package.
 *
 * What is worth holding is the CLASSIFICATION, because everything downstream is
 * a table keyed by it: the panel's words, the commit body's verbs and the
 * subject's "biggest change" all read `sort` and nothing else. A `done` that
 * appeared and a `done` that was taken off are the same FIELD and opposite
 * events, so the field list alone was never enough.
 */

import { describe, expect, test } from "bun:test"

import { biggestOf, changesOf, type Records } from "./changes.ts"
import type { Node } from "./node.ts"

const node = (record: Partial<Node> & { id: string }): Node =>
  ({ ord: "a0", title: record.id, ...record }) as Node

const at = (file: string, ...nodes: ReadonlyArray<Node>): Records =>
  new Map([[file, nodes]])

describe("what changed", () => {
  test("a node nobody had before is created", () => {
    const changes = changesOf(at("a.jsonl"), at("a.jsonl", node({ id: "x" })))
    expect(changes).toEqual([
      { file: "a.jsonl", id: "x", title: "x", fields: [], sort: "created" },
    ])
  })

  test("a mark that appeared and one that was taken off are opposites", () => {
    const open = node({ id: "x", title: "order the cabinets" })
    const done = node({ id: "x", title: "order the cabinets", done: "2026-08-10" })

    expect(changesOf(at("a.jsonl", open), at("a.jsonl", done))[0]).toMatchObject({
      fields: ["done"],
      sort: "done",
    })
    expect(changesOf(at("a.jsonl", done), at("a.jsonl", open))[0]).toMatchObject({
      sort: "undone",
    })
  })

  test("a node that changed file is archived, and reads under the file it is in now", () => {
    const before = at("a.jsonl", node({ id: "x", title: "install them" }))
    const after = at("Archive.jsonl", node({ id: "x", title: "install them" }))

    // ONE change, not a removal and an unrelated arrival: ids are unique
    // across the set, so the comparison is by id across every file it was
    // handed.
    expect(changesOf(before, after)).toEqual([
      {
        file: "Archive.jsonl",
        id: "x",
        title: "install them",
        fields: ["file"],
        sort: "archived",
      },
    ])
  })

  test("a node that is nowhere on the new side is gone", () => {
    const changes = changesOf(at("a.jsonl", node({ id: "x" })), at("a.jsonl"))
    expect(changes[0]).toMatchObject({ sort: "gone" })
  })

  test("an unchanged node is not a change", () => {
    const same = node({ id: "x", title: "x", see: ["y"] })
    expect(changesOf(at("a.jsonl", same), at("a.jsonl", { ...same, see: ["y"] })))
      .toEqual([])
  })

  test("every field that differs is reported, and the sort is the biggest of them", () => {
    const before = node({ id: "x", title: "one", desc: "old" })
    const after = node({ id: "x", parent: "p", ord: "a1", title: "two", desc: "new" })

    const change = changesOf(at("a.jsonl", before), at("a.jsonl", after))[0]
    expect(change?.fields).toEqual(["parent", "ord", "title", "desc"])
    // Moved beats retitled and noted, by the fixed order.
    expect(change?.sort).toBe("moved")
  })

  test("a mirror answers by the id it was named by", () => {
    const before = at("a.jsonl", node({ id: "m", mirror: "x" } as Partial<Node> & { id: string }))
    const after = at(
      "a.jsonl",
      node({ id: "m", ord: "a1", mirror: "x" } as Partial<Node> & { id: string }),
    )
    expect(changesOf(before, after)[0]).toMatchObject({ title: "m", sort: "moved" })
  })
})

describe("the biggest one", () => {
  test("is by the fixed priority, and the first read among equals", () => {
    const changes = changesOf(
      new Map([[
        "a.jsonl",
        [node({ id: "keep" }), node({ id: "mark" })],
      ]]),
      new Map([[
        "a.jsonl",
        [
          node({ id: "keep", desc: "written" }),
          node({ id: "mark", done: "2026-08-10" }),
          node({ id: "fresh" }),
        ],
      ]]),
    )
    // created, then done, then noted — so the created one wins whatever order
    // the files put them in.
    expect(biggestOf(changes)?.id).toBe("fresh")
  })

  test("is null for nothing", () => {
    expect(biggestOf([])).toBe(null)
  })
})
