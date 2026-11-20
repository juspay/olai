import type { Placed, Placement, Subtree } from "@olai/format"
import { NO_SEARCH } from "@olai/ops"
import {
  escapedIn,
  gaveOf,
  paragraphsIn,
  readsOf,
  uncalled,
} from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import { tools } from "./tools.ts"

const answers = () => gaveOf(NO_SEARCH, tools, "outlines")

test("every read this row declares is called here", () => {
  expect(uncalled(tools, "outlines")).toEqual([])
})

test("every answer decodes through the shape its own entry declares", () => {
  const of = answers()
  for (const tool of readsOf(tools)) {
    if (tool.kind !== "read") continue
    const decode = Schema.decodeUnknownSync(
      tool.answers as Schema.Codec<unknown, unknown, never, never>,
      { errors: "all", onExcessProperty: "error" },
    )
    for (const answer of of(tool.name)) {
      expect({ [tool.name]: decode(answer) }).toEqual({ [tool.name]: answer })
    }
  }
})

test("the fixture reaches every optional field, so the check is not vacuous", () => {
  const of = answers()

  const outlines = of("index")[0]?.["outlines"] as ReadonlyArray<
    Record<string, unknown>
  >
  expect(outlines[0]).toEqual({
    file: "house.olai",
    nodes: 4,
    roots: ["House #home @sam"],
  })
  expect(outlines[1]).toEqual({
    file: "torn.olai",
    unreadable: [expect.any(String)],
  })

  const [house, paint, gone] = of("read")
  expect(house).toMatchObject({
    doing: true,
    date: "2026-08-14",
    desc: "the note",
    tags: ["#home", "@sam"],
    progress: { done: 1, total: 2 },
    see: ["paint"],
    after: ["paint"],
    placed: [{ id: "in-house", shows: { id: "paint" } }],
  })
  expect(house).not.toHaveProperty("parent")
  expect(paint).toMatchObject({
    done: "2026-08-09T10:15:00-04:00",
    parent: "house",
  })
  expect((paint?.["mirrors"] as ReadonlyArray<Placement>).map((one) => one.parent))
    .toEqual(["house", undefined])
  expect(gone).toEqual({ missing: "shed" })

  const [cut, whole, outline, outlineCut, absent, lean, shaped, shapedOutline] = of("subtree")
  expect((cut?.["children"] as ReadonlyArray<Subtree>)[1])
    .toMatchObject({ id: "sand", truncated: true })
  expect(whole).not.toHaveProperty("truncated")
  expect(absent).toEqual({ missing: "shed" })
  expect(whole).toMatchObject({ desc: "the note" })
  expect(lean).not.toHaveProperty("desc")
  expect((lean?.["children"] as ReadonlyArray<Subtree>).map((child) => child.id))
    .toEqual(["paint", "sand"])
  expect(outline?.["file"]).toBe("house.olai")
  expect((outline?.["roots"] as ReadonlyArray<Subtree>).map((root) => root.id))
    .toEqual(["house"])
  expect((outlineCut?.["roots"] as ReadonlyArray<Subtree>)[0]?.children[1])
    .toMatchObject({ id: "sand", truncated: true })

  const placedIds = (row: Record<string, unknown> | undefined): ReadonlyArray<string> =>
    ((row?.["placed"] ?? []) as ReadonlyArray<Placed>).map((entry) => entry.id)
  expect(placedIds(whole)).toEqual(["in-house"])
  expect(placedIds(lean)).toEqual(["in-house"])
  expect(placedIds(shaped)).toEqual(["in-house"])
  expect(placedIds((outline?.["roots"] as ReadonlyArray<Record<string, unknown>>)[0]))
    .toEqual(["in-house"])
  expect(placedIds((shapedOutline?.["roots"] as ReadonlyArray<Record<string, unknown>>)[0]))
    .toEqual(["in-house"])
  expect(placedIds(outline)).toEqual(["loose"])
  expect(placedIds(shapedOutline)).toEqual(["loose"])

  const placed = house?.["placed"] as ReadonlyArray<Placed>
  expect(placed[0]?.shows).toMatchObject({ id: "paint", status: "done", path: ["House #home @sam"] })
})

test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "index")).toBeGreaterThan(0)
})
