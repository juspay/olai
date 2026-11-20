import { expect, test } from "bun:test"

import type { NodeHit } from "@olai/format"

import { nodeMatches } from "./nodes.ts"

const hit = (one: {
  id: string
  title: string
  file?: string
  path?: ReadonlyArray<string>
  matched?: NodeHit["matched"]
}): NodeHit => ({
  at: { kind: "node", id: one.id as never },
  id: one.id,
  title: one.title,
  file: one.file ?? "house.olai",
  line: 1,
  path: one.path ?? [],
  pathIds: [],
  see: undefined,
  after: undefined,
  ...(one.matched === undefined ? {} : { matched: one.matched }),
}) as NodeHit

test("a row reads the title, and says where it sits", () => {
  expect(
    nodeMatches([
      hit({
        id: "hinges",
        title: "pick the hinges",
        path: ["kitchen remodel", "install the cabinets"],
        matched: "title",
      }),
    ]),
  ).toEqual([{
    id: "hinges",
    label: "pick the hinges",
    from: "house.olai",
    place: { file: "house.olai", crumbs: [{ title: "kitchen remodel" }, { title: "install the cabinets" }] },
    note: false,
  }])
})

test("a node at the top of a file is placed by the file, which is all it has", () => {
  expect(nodeMatches([hit({ id: "kitchen", title: "kitchen remodel" })])[0]?.place)
    .toEqual({ file: "house.olai", crumbs: [] })
})

test("two nodes of one title are told apart by where they are", () => {
  expect(
    nodeMatches([
      hit({ id: "chase-beds", title: "chase the supplier", file: "garden.olai", path: ["garden"] }),
      hit({
        id: "chase-order",
        title: "chase the supplier",
        path: ["kitchen remodel", "install the cabinets"],
      }),
    ]).map((node) => node.place),
  ).toEqual([
    { file: "garden.olai", crumbs: [{ title: "garden" }] },
    { file: "house.olai", crumbs: [{ title: "kitchen remodel" }, { title: "install the cabinets" }] },
  ])
})

test("a row says it is here for a note, and only then", () => {
  expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges", matched: "desc" })])[0]?.note)
    .toBe(true)
  for (const field of ["title", "id", "tag"] as const) {
    expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges", matched: field })])[0]?.note)
      .toBe(false)
  }
  expect(nodeMatches([hit({ id: "hinges", title: "pick the hinges" })])[0]?.note).toBe(false)
})

test("a node with nothing written in it is labelled by its id", () => {
  expect(nodeMatches([hit({ id: "blank", title: "   " })])[0]?.label).toBe("blank")
})

test("no answer is no rows, which is what draws no block", () => {
  expect(nodeMatches([])).toEqual([])
})
