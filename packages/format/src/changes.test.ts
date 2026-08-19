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
    const done = node({ id: "x", title: "order the cabinets", done: "2026-08-10" })

    expect(changesOf(at("a.olai", open), at("a.olai", done))[0]).toMatchObject({
      fields: ["done"],
      sort: "done",
    })
    expect(changesOf(at("a.olai", done), at("a.olai", open))[0]).toMatchObject({
      sort: "undone",
    })
  })

  test("a node that changed file is archived, and reads under the file it is in now", () => {
    const before = at("a.olai", node({ id: "x", title: "install them" }))
    const after = at("_olai/Trash.olai", node({ id: "x", title: "install them" }))

    // ONE change, not a removal and an unrelated arrival: ids are unique
    // across the set, so the comparison is by id across every file it was
    // handed.
    expect(changesOf(before, after)).toEqual([
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
    const changes = changesOf(at("a.olai", node({ id: "x" })), at("a.olai"))
    expect(changes[0]).toMatchObject({ sort: "gone" })
  })

  test("an unchanged node is not a change", () => {
    const same = node({ id: "x", title: "x", see: ["y"] })
    // Two READINGS of the same bytes: equal lists compare equal, which is the
    // one thing a shallow `===` over an array field would get wrong.
    expect(changesOf(at("a.olai", same), at("a.olai", same))).toEqual([])
  })

  /**
   * The MAP, compared by what it holds — the first field of this format whose
   * value is neither text nor a list, and the one the comparison got wrong.
   *
   * Two readings are two parses, so a `custom` map is two objects whatever it
   * says. Under `===` every node carrying a property therefore reported as
   * edited on every write, which is not a small lie: it is the pending panel
   * naming a change nobody made, the commit subject counting it, and — since
   * the stamps are excluded precisely so a re-stamp is invisible — the one
   * exception this format makes being defeated by the one field it was made
   * for. Found by Grok in review of #179.
   */
  test("two readings of the same properties are not a change", () => {
    const same = node({ id: "x", title: "x", custom: { pr: "https://x/1", tags: ["a", "b"] } })
    expect(changesOf(at("a.olai", same), at("a.olai", same))).toEqual([])
  })

  test("a property that changed, appeared or went is reported once", () => {
    const none = node({ id: "x", title: "x" })
    const one = node({ id: "x", title: "x", custom: { pr: "https://x/1" } })
    const other = node({ id: "x", title: "x", custom: { pr: "https://x/2" } })
    const two = node({ id: "x", title: "x", custom: { pr: "https://x/1", agent: "opus" } })

    for (const [before, after] of [[none, one], [one, other], [one, two], [one, none]]) {
      expect(changesOf(at("a.olai", before as string), at("a.olai", after as string))[0])
        .toMatchObject({ fields: ["custom"], sort: "edited" })
    }
  })

  /**
   * The stamps, from the other side: they are left out of the field list, so a
   * write whose only mark on the record is `changed` says nothing at all — with
   * or without properties beside it.
   *
   * The second half is the one that was broken. `changed` was already excluded;
   * `custom` compared by identity put the change back in under another name.
   */
  test("a re-stamp is not a change, whatever else the node carries", () => {
    const bare = { id: "x", title: "x" }
    const props = { ...bare, custom: { pr: "https://x/1" } }
    for (const record of [bare, props]) {
      expect(changesOf(
        at("a.olai", node({ ...record, changed: "2026-08-15T09:00:00-04:00" })),
        at("a.olai", node({ ...record, changed: "2026-08-15T21:00:00-04:00" })),
      )).toEqual([])
    }
  })

  test("a field that changed is not joined by a phantom `custom`", () => {
    // The tooltip in the commit panel lists these names. A node that carries a
    // property and had its title changed changed its title.
    const before = node({ id: "x", title: "one", custom: { pr: "https://x/1" } })
    const after = node({ id: "x", title: "two", custom: { pr: "https://x/1" } })
    expect(changesOf(at("a.olai", before), at("a.olai", after))[0]?.fields).toEqual(["title"])
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
        node({ id: "mark", ord: "a1", done: "2026-08-10" }),
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
