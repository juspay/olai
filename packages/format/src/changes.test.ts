import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { biggestOf, changesOf, type Records } from "./changes.ts"
import { nodesOf } from "./fixtures.testlib.ts"

const at = (file: string, ...lines: ReadonlyArray<string>): Records =>
  new Map([[file, nodesOf(lines.join("\n"), file).map((located) => located.node)]])

const node = (record: Readonly<Record<string, unknown>>): string =>
  JSON.stringify({ ord: "a0", title: String(record["id"]), ...record })

describe("what changed", () => {
  test("a node nobody had before is created", () => {
    const changes = changesOf(TEST_CLAIMS, at("a.olai"), at("a.olai", node({ id: "x" })))
    expect(changes).toEqual([
      { file: "a.olai", id: "x", title: "x", fields: [], sort: "created" },
    ])
  })

  test("a mark that appeared and one that was taken off are opposites", () => {
    const open = node({ id: "x", title: "order the cabinets" })
    const done = node({ id: "x", title: "order the cabinets", done: "2026-08-10" })

    expect(changesOf(TEST_CLAIMS, at("a.olai", open), at("a.olai", done))[0]).toMatchObject({
      fields: ["done"],
      sort: "done",
    })
    expect(changesOf(TEST_CLAIMS, at("a.olai", done), at("a.olai", open))[0]).toMatchObject({
      sort: "undone",
    })
  })

  test("a node that changed file is archived, and reads under the file it is in now", () => {
    const before = at("a.olai", node({ id: "x", title: "install them" }))
    const after = at("_olai/Trash.olai", node({ id: "x", title: "install them" }))

    expect(changesOf(TEST_CLAIMS, before, after)).toEqual([
      {
        file: "_olai/Trash.olai",
        id: "x",
        title: "install them",
        fields: ["file"],
        sort: "trashed",
      },
    ])
  })

  test("a node that is nowhere on the new side is gone", () => {
    const changes = changesOf(TEST_CLAIMS, at("a.olai", node({ id: "x" })), at("a.olai"))
    expect(changes[0]).toMatchObject({ sort: "gone" })
  })

  test("an unchanged node is not a change", () => {
    const same = node({ id: "x", title: "x", see: ["y"] })
    expect(changesOf(TEST_CLAIMS, at("a.olai", same), at("a.olai", same))).toEqual([])
  })

  test("two readings of the same properties are not a change", () => {
    const same = node({ id: "x", title: "x", custom: { pr: "https://x/1", tags: ["a", "b"] } })
    expect(changesOf(TEST_CLAIMS, at("a.olai", same), at("a.olai", same))).toEqual([])
  })

  test("a property that changed, appeared or went is reported once", () => {
    const none = node({ id: "x", title: "x" })
    const one = node({ id: "x", title: "x", custom: { pr: "https://x/1" } })
    const other = node({ id: "x", title: "x", custom: { pr: "https://x/2" } })
    const two = node({ id: "x", title: "x", custom: { pr: "https://x/1", agent: "opus" } })

    for (const [before, after] of [[none, one], [one, other], [one, two], [one, none]]) {
      expect(changesOf(TEST_CLAIMS, at("a.olai", before as string), at("a.olai", after as string))[0])
        .toMatchObject({ fields: ["custom"], sort: "edited" })
    }
  })

  test("a re-stamp is not a change, whatever else the node carries", () => {
    const bare = { id: "x", title: "x" }
    const props = { ...bare, custom: { pr: "https://x/1" } }
    for (const record of [bare, props]) {
      expect(changesOf(TEST_CLAIMS,
        at("a.olai", node({ ...record, changed: "2026-08-15T09:00:00-04:00" })),
        at("a.olai", node({ ...record, changed: "2026-08-15T21:00:00-04:00" })),
      )).toEqual([])
    }
  })

  test("a field that changed is not joined by a phantom `custom`", () => {
    const before = node({ id: "x", title: "one", custom: { pr: "https://x/1" } })
    const after = node({ id: "x", title: "two", custom: { pr: "https://x/1" } })
    expect(changesOf(TEST_CLAIMS, at("a.olai", before), at("a.olai", after))[0]?.fields).toEqual(["title"])
  })

  test("every field that differs is reported, and the sort is the biggest of them", () => {
    const before = node({ id: "x", title: "one", desc: "old" })
    const after = node({ id: "x", parent: "p", ord: "a1", title: "two", desc: "new" })

    const change = changesOf(TEST_CLAIMS, at("a.olai", before), at("a.olai", after))[0]
    expect(change?.fields).toEqual(["parent", "ord", "title", "desc"])
    expect(change?.sort).toBe("moved")
  })

  test("a mirror answers by the id it was named by", () => {
    const mirror = (ord: string) => JSON.stringify({ id: "m", ord, mirror: "x" })
    const before = at("a.olai", mirror("a0"), `{"id":"x","ord":"a1","title":"x"}`)
    const after = at("a.olai", mirror("a2"), `{"id":"x","ord":"a1","title":"x"}`)
    expect(changesOf(TEST_CLAIMS, before, after)[0]).toMatchObject({ title: "m", sort: "moved" })
  })
})

describe("the biggest one", () => {
  test("is by the fixed priority, and the first read among equals", () => {
    const changes = changesOf(TEST_CLAIMS,
      at("a.olai", node({ id: "keep" }), node({ id: "mark", ord: "a1" })),
      at(
        "a.olai",
        node({ id: "keep", desc: "written" }),
        node({ id: "mark", ord: "a1", done: "2026-08-10" }),
        node({ id: "fresh", ord: "a2" }),
      ),
    )
    expect(biggestOf(changes)?.id).toBe("fresh")
  })

  test("is null for nothing", () => {
    expect(biggestOf([])).toBe(null)
  })
})
