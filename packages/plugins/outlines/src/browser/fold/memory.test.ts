import { expect, test } from "bun:test"

import { remembering } from "@olai/web/client/preference.testlib.ts"

import {
  combined,
  type Folds,
  FOLDS_KEY,
  type Homes,
  homesOf,
  memoryOf,
  parseFolds,
  printFolds,
  pruned,
  setFolded,
  withFolds,
} from "./memory.ts"

const foldsOf = (entry: Record<string, ReadonlyArray<string>>) =>
  new Map(Object.entries(entry).map(([file, ids]) => [file, new Set(ids)]))

const answering = (
  folds: Folds,
  live: ReadonlyMap<string, ReadonlySet<string>>,
): Homes => {
  const at = new Map<string, string>()
  for (const [file, ids] of live) for (const id of ids) at.set(id, file)
  return homesOf(memoryOf(folds), {
    homes: [...folds.values()]
      .flatMap((ids) => [...ids])
      .flatMap((id) => {
        const file = at.get(id)
        return file === undefined ? [] : [{ id, file }]
      }),
    loaded: [...folds.keys()].filter((file) => live.has(file)),
  })
}

test("what is stored is collapsed ids, grouped by file", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.olai" },
    { id: "herbs", file: "garden.olai" },
  ], true)
  expect(printFolds(folds)).toBe(
    `{"garden.olai":["herbs"],"house.olai":["kitchen"]}`,
  )
  expect(parseFolds(printFolds(folds))).toEqual(
    foldsOf({ "garden.olai": ["herbs"], "house.olai": ["kitchen"] }),
  )
})

test("a node folded while another file is open is remembered under ITS file", () => {
  const folds = withFolds(new Map(), [{ id: "herbs", file: "garden.olai" }], true)
  expect(folds.get("house.olai")).toBeUndefined()
  expect([...(folds.get("garden.olai") ?? [])]).toEqual(["herbs"])
})

test("unfolding removes the id, and the last one takes the file with it", () => {
  const folded = foldsOf({ "house.olai": ["kitchen", "install"] })
  const one = withFolds(folded, [{ id: "install", file: "house.olai" }], false)
  expect([...(one.get("house.olai") ?? [])]).toEqual(["kitchen"])

  const none = withFolds(one, [{ id: "kitchen", file: "house.olai" }], false)
  expect(none.size).toBe(0)
  expect(printFolds(none)).toBeNull()
})

test("a node nobody has touched is simply absent, and therefore open", () => {
  const folds = withFolds(new Map(), [{ id: "kitchen", file: "house.olai" }], false)
  expect(printFolds(folds)).toBeNull()
})

test("collapse-all is one write, not one per node", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.olai" },
    { id: "install", file: "house.olai" },
    { id: "herbs", file: "garden.olai" },
  ], true)
  expect([...(folds.get("house.olai") ?? [])].sort()).toEqual(["install", "kitchen"])
  expect([...(folds.get("garden.olai") ?? [])]).toEqual(["herbs"])
})

test("a value this app did not write is nothing, and the reader gets the default", () => {
  expect(parseFolds(null).size).toBe(0)
  expect(parseFolds("hello").size).toBe(0)
  expect(parseFolds(`["house.olai"]`).size).toBe(0)
  expect(parseFolds(`{"house.olai":"kitchen"}`).size).toBe(0)
  expect(parseFolds(`{"house.olai":["kitchen",7,null]}`)).toEqual(
    foldsOf({ "house.olai": ["kitchen"] }),
  )
})

test("a node that MOVED to another file keeps its fold, under the new file", () => {
  const live = new Map([
    ["house.olai", new Set(["kitchen", "order"])],
    ["_olai/Trash.olai", new Set(["install"])],
  ])
  const folds = foldsOf({ "house.olai": ["kitchen", "install"] })
  expect(pruned(folds, answering(folds, live))).toEqual(
    foldsOf({ "house.olai": ["kitchen"], "_olai/Trash.olai": ["install"] }),
  )
})

test("the fold of a node that is gone is dropped", () => {
  const live = new Map([
    ["house.olai", new Set(["kitchen"])],
    ["garden.olai", new Set(["herbs"])],
  ])
  const folds = foldsOf({ "house.olai": ["kitchen", "deleted"] })
  expect(pruned(folds, answering(folds, live))).toEqual(
    foldsOf({ "house.olai": ["kitchen"] }),
  )
})

test("a file this browser cannot see keeps its folds", () => {
  const live = new Map([["house.olai", new Set(["kitchen"])]])
  const unseen = foldsOf({ "garden.olai": ["herbs"] })
  expect(pruned(unseen, answering(unseen, live))).toEqual(
    foldsOf({ "garden.olai": ["herbs"] }),
  )
  const nothing = foldsOf({ "house.olai": ["gone"] })
  expect(pruned(nothing, answering(nothing, new Map()))).toEqual(
    foldsOf({ "house.olai": ["gone"] }),
  )
})

test("an id lives in ONE bucket: folding it where it moved to clears the old one", () => {
  const stale = foldsOf({ "house.olai": ["install"] })
  expect(withFolds(stale, [{ id: "install", file: "_olai/Trash.olai" }], true))
    .toEqual(foldsOf({ "_olai/Trash.olai": ["install"] }))
  expect(withFolds(stale, [{ id: "install", file: "_olai/Trash.olai" }], false))
    .toEqual(new Map())
})

test("a write starts from the ENTRY unioned with what this tab holds", () => {
  const stored = foldsOf({ "house.olai": ["kitchen"] })
  const held = foldsOf({ "garden.olai": ["herbs"] })
  expect(combined(stored, held)).toEqual(
    foldsOf({ "house.olai": ["kitchen"], "garden.olai": ["herbs"] }),
  )
  expect(combined(stored, foldsOf({ "house.olai": ["order"] }))).toEqual(
    foldsOf({ "house.olai": ["kitchen", "order"] }),
  )
  expect(combined(parseFolds(null), held)).toEqual(held)
})

test("an unfold still removes, because the change goes on after the union", () => {
  const base = combined(
    foldsOf({ "house.olai": ["kitchen", "order"] }),
    foldsOf({ "house.olai": ["kitchen"] }),
  )
  expect(withFolds(base, [{ id: "kitchen", file: "house.olai" }], false)).toEqual(
    foldsOf({ "house.olai": ["order"] }),
  )
})

test("a write starts from the ENTRY: a sibling tab's fold this tab never saw survives", () => {
  remembering((store) => {
    setFolded([{ id: "herbs", file: "garden.olai" }], true)
    store.set(FOLDS_KEY, `{"house.olai":["kitchen"]}`)
    setFolded([{ id: "install", file: "house.olai" }], true)
    expect(store.get(FOLDS_KEY)).toBe(
      `{"garden.olai":["herbs"],"house.olai":["install","kitchen"]}`,
    )
    setFolded(
      [
        { id: "herbs", file: "garden.olai" },
        { id: "install", file: "house.olai" },
        { id: "kitchen", file: "house.olai" },
      ],
      false,
    )
  })
})

test("an id the question did not name is left exactly where it is", () => {
  const asked = foldsOf({ "house.olai": ["kitchen"] })
  const live = new Map([["house.olai", new Set(["kitchen"])]])
  const since = foldsOf({ "house.olai": ["kitchen", "fresh"] })
  expect(pruned(since, answering(asked, live))).toEqual(since)
})

test("the answer is read against the question, never on its own", () => {
  const asked = foldsOf({
    "house.olai": ["kitchen", "deleted"],
    "garden.olai": ["herbs"],
  })
  expect(
    homesOf(memoryOf(asked), {
      homes: [{ id: "kitchen", file: "_olai/Trash.olai" }],
      loaded: ["house.olai"],
    }),
  ).toEqual(
    new Map([
      ["kitchen", "_olai/Trash.olai"],
      ["deleted", null],
    ]),
  )
})
