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
import { nodesOf } from "./fixtures.testlib.ts"

/**
 * One file's side of a comparison, out of JSONL text.
 *
 * Through the real parser rather than as record literals with a cast, for the
 * reason the testlib exists: what is under test HERE is which fields differ, so
 * a fixture free to carry a field the schema does not have — or to omit one it
 * requires — would be a test measuring nothing. A fixture that will not parse
 * throws, with the line quoted.
 */
const at = (file: string, ...lines: ReadonlyArray<string>): Records =>
  new Map([[file, nodesOf(lines.join("\n"), file).map((located) => located.node)]])

/** One record, as the line a writer would have produced. */
const node = (record: Readonly<Record<string, unknown>>): string =>
  JSON.stringify({ ord: "a0", title: String(record["id"]), ...record })

describe("what changed", () => {
  test("a node nobody had before is created", () => {
    const changes = changesOf(at("a.olai"), at("a.olai", node({ id: "x" })))
    expect(changes).toEqual([
      { file: "a.olai", id: "x", title: "x", fields: [], sort: "created" },
    ])
  })

  test("a mark that appeared and one that was taken off are opposites", () => {
    const open = node({ id: "x", title: "order the cabinets" })
    const done = node({ id: "x", title: "order the cabinets", props: { status: "done", since: "2026-08-10" } })

    expect(changesOf(at("a.olai", open), at("a.olai", done))[0]).toMatchObject({
      fields: ["status", "since"],
      sort: "done",
    })
    expect(changesOf(at("a.olai", done), at("a.olai", open))[0]).toMatchObject({
      sort: "undone",
    })
  })

  test("a node that changed file is archived, and reads under the file it is in now", () => {
    const before = at("a.olai", node({ id: "x", title: "install them" }))
    const after = at("Archive.olai", node({ id: "x", title: "install them" }))

    // ONE change, not a removal and an unrelated arrival: ids are unique
    // across the set, so the comparison is by id across every file it was
    // handed.
    expect(changesOf(before, after)).toEqual([
      {
        file: "Archive.olai",
        id: "x",
        title: "install them",
        fields: ["file"],
        sort: "archived",
      },
    ])
  })

  test("a node that is nowhere on the new side is gone", () => {
    const changes = changesOf(at("a.olai", node({ id: "x" })), at("a.olai"))
    expect(changes[0]).toMatchObject({ sort: "gone" })
  })

  test("an unchanged node is not a change", () => {
    const same = node({ id: "x", title: "x", props: { see: ["y"] } })
    // Two READINGS of the same bytes: equal lists compare equal, which is the
    // one thing a shallow `===` over an array field would get wrong.
    expect(changesOf(at("a.olai", same), at("a.olai", same))).toEqual([])
  })

  test("every field that differs is reported, and the sort is the biggest of them", () => {
    const before = node({ id: "x", title: "one", desc: "old" })
    const after = node({ id: "x", parent: "p", ord: "a1", title: "two", desc: "new" })

    const change = changesOf(at("a.olai", before), at("a.olai", after))[0]
    expect(change?.fields).toEqual(["parent", "ord", "title", "desc"])
    // Moved beats retitled and noted, by the fixed order.
    expect(change?.sort).toBe("moved")
  })

  // A mirror has no title of its own — it is a second placement of a node that
  // does — so what a change calls it is the id it was named by.
  test("a mirror answers by the id it was named by", () => {
    const mirror = (ord: string) => JSON.stringify({ id: "m", ord, mirror: "x" })
    const before = at("a.olai", mirror("a0"), `{"id":"x","ord":"a1","title":"x"}`)
    const after = at("a.olai", mirror("a2"), `{"id":"x","ord":"a1","title":"x"}`)
    expect(changesOf(before, after)[0]).toMatchObject({ title: "m", sort: "moved" })
  })
})

describe("the biggest one", () => {
  test("is by the fixed priority, and the first read among equals", () => {
    const changes = changesOf(
      at("a.olai", node({ id: "keep" }), node({ id: "mark", ord: "a1" })),
      at(
        "a.olai",
        node({ id: "keep", desc: "written" }),
        node({ id: "mark", ord: "a1", props: { status: "done", since: "2026-08-10" } }),
        node({ id: "fresh", ord: "a2" }),
      ),
    )
    // created, then done, then noted — so the created one wins whatever order
    // the files put them in.
    expect(biggestOf(changes)?.id).toBe("fresh")
  })

  test("is null for nothing", () => {
    expect(biggestOf([])).toBe(null)
  })
})
