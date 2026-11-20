import { type Row, shownRecord } from "@olai/format"
import { expect, test } from "bun:test"

import { aim, failedSays, missedSays, shutAlong } from "./landing.ts"

const chainTo = (rows: ReadonlyArray<Row>, id: string): ReadonlyArray<Row> | undefined => {
  const answer = aim(rows, id, () => undefined)
  return answer.kind === "chain" ? answer.chain : undefined
}

const line = (id: string, title: string, children: ReadonlyArray<Row> = []): Row => ({
  at: { file: "house.olai", line: 1, node: { id, ord: "a0", title } },
  blocked: [],
  children,
  key: id,
  kind: "node",
  shows: { file: "house.olai", line: 1, node: { id, ord: "a0", title } },
  under: 0,
})

const placementOf = (
  target: string,
  title: string,
  atLine: number,
  children: ReadonlyArray<Row> = [],
): Row => ({
  at: { file: "house.olai", line: atLine, node: { id: `m${atLine}`, ord: "a0", title: "" } },
  blocked: [],
  children,
  key: `m${atLine}`,
  kind: "mirror",
  shows: { file: "garden.olai", line: 2, node: { id: target, ord: "a0", title } },
  under: 0,
})

test("the chain runs root-down to the row that shows the id", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      line("order", "order the tiles", [line("pick", "pick a shade")]),
      line("repair", "repair the ceiling"),
    ]),
  ]
  expect(chainTo(rows, "repair")?.map((row) => row.at.node.id)).toEqual([
    "kitchen",
    "repair",
  ])
})

test("the first match answers for a node the page shows twice — and a placement counts", () => {
  const rows = [
    line("beds", "the garden beds"),
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
  ]
  const self = chainTo(rows, "beds")
  expect(self?.map((row) => row.at.node.id)).toEqual(["beds"])
  expect(self?.at(-1)?.at.node.id).toBe("beds")
})

test("no row that shows the id is no chain", () => {
  expect(chainTo([line("kitchen", "the kitchen")], "repair")).toBeUndefined()
})

test("a placement id lands on the mirror's own row", () => {
  const rows = [
    line("beds", "the garden beds"),
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
  ]
  const chain = chainTo(rows, "m7")
  expect(chain?.map((row) => row.at.node.id)).toEqual(["garden-row", "m7"])
  if (chain === undefined) throw new Error("the chain exists")
  expect(shownRecord(chain[chain.length - 1]!).node.id).toBe("beds")
})

test("a placement id answers wherever its mirror row stands", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      placementOf("beds", "the garden beds", 3, [line("sprig", "plant a sprig")]),
    ]),
  ]
  expect(chainTo(rows, "m3")?.map((row) => row.at.node.id)).toEqual(["kitchen", "m3"])
})

test("a record id answers byte-identically with placements standing beside it", () => {
  const rows = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
    line("beds", "the garden beds", [line("sprig", "plant a sprig")]),
  ]
  expect(chainTo(rows, "beds")?.map((row) => row.at.node.id)).toEqual(["garden-row", "m7"])
  expect(chainTo(rows, "sprig")?.map((row) => row.at.node.id)).toEqual(["beds", "sprig"])
})

test("the page answering the id asks nothing of the set", () => {
  const rows = [line("beds", "the garden beds")]
  const answer = aim(rows, "beds", () => {
    throw new Error("a placement the page draws is no wire's business")
  })
  expect(answer.kind).toBe("chain")
  if (answer.kind !== "chain") return
  expect(answer.chain.map((row) => row.at.node.id)).toEqual(["beds"])
})

test("a placement the page does not draw lands on its target, depth-first as ever", () => {
  const rows = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
    line("beds", "the garden beds"),
  ]
  const answer = aim(rows, "m9", () => "beds")
  expect(answer.kind).toBe("chain")
  if (answer.kind !== "chain") return
  expect(answer.chain.map((row) => row.at.node.id)).toEqual(["garden-row", "m7"])
})

test("no answer from the set is no answer yet — nothing concluded", () => {
  expect(aim([line("kitchen", "the kitchen")], "repair", () => undefined)).toEqual({ kind: "ask" })
})

test("the drawn rows saying nothing while the WHOLE page answers is the reveal", () => {
  const whole = [
    line("kitchen", "the kitchen", [
      line("demo", "take out the old counters"),
      line("order", "order the new cabinets"),
    ]),
  ]
  const rows = [line("kitchen", "the kitchen", [line("order", "order the new cabinets")])]
  const answer = aim(rows, "demo", (asked) => asked, whole)
  expect(answer.kind).toBe("reveal")
  if (answer.kind !== "reveal") return
  expect(answer.chain.map((row) => row.key)).toEqual(["kitchen", "demo"])
})

test("a done-hidden MIRROR the address spells is revealed as its own place", () => {
  const whole = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
  ]
  const answer = aim([], "m7", () => "beds", whole)
  expect(answer.kind).toBe("reveal")
  if (answer.kind !== "reveal") return
  expect(answer.chain.map((row) => row.key)).toEqual(["garden-row", "m7"])
})

test("a done-hidden TARGET of a spelled placement is revealed the way a drawn one would land", () => {
  const whole = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
    line("beds", "the garden beds"),
  ]
  const answer = aim([], "m9", () => "beds", whole)
  expect(answer.kind).toBe("reveal")
  if (answer.kind !== "reveal") return
  expect(answer.chain.map((row) => row.key)).toEqual(["garden-row", "m7"])
})

test("the reveal is never a guess: the whole page answering nothing is still the certain miss", () => {
  const whole = [line("kitchen", "the kitchen")]
  expect(aim([], "glazing", () => "glazing", whole)).toEqual({ kind: "miss", target: "glazing" })
  expect(aim([], "glazing", () => "glazing")).toEqual({ kind: "miss", target: "glazing" })
})

test("the set's answer changing nothing is the certain miss, carrying WHICH half", () => {
  const rows = [line("kitchen", "the kitchen")]
  expect(aim(rows, "m9", () => "repair")).toEqual({ kind: "miss", target: "repair" })
  expect(aim(rows, "repair", () => null)).toEqual({ kind: "miss", target: null })
})

test("a certain miss says what was asked — and which half of certain it is", () => {
  expect(missedSays("day29-thirteenth", null)).toBe(
    "day29-thirteenth — not found",
  )
  expect(missedSays("day29-thirteenth", "day29-anchor")).toBe(
    "day29-thirteenth — not shown on this page",
  )
})

test("the failed ask says just that — nothing of whether the name names", () => {
  expect(failedSays("day29-thirteenth")).toBe(
    "day29-thirteenth — couldn’t look this up. Try again.",
  )
})

test("only the chain's shut ANCESTORS are owed — not its last row, and not folds nowhere on the path", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      line("order", "order the tiles", [line("pick", "pick a shade")]),
    ]),
    line("garden", "the garden"),
  ]
  const chain = chainTo(rows, "pick")
  if (chain === undefined) throw new Error("the chain exists")
  expect(shutAlong(chain, new Set())).toEqual([])
  expect(shutAlong(chain, new Set(["pick"]))).toEqual([])
  expect(shutAlong(chain, new Set(["kitchen", "order"])).map((fold) => fold.id)).toEqual([
    "kitchen",
    "order",
  ])
  expect(shutAlong(chain, new Set(["kitchen", "garden"])).map((fold) => fold.id)).toEqual([
    "kitchen",
  ])
})

test("a placement on the path owes the shown node's own fold, written once", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      placementOf("beds", "the garden beds", 3, [
        placementOf("beds", "the garden beds", 4, [line("sprig", "plant a sprig")]),
      ]),
    ]),
  ]
  const chain = chainTo(rows, "sprig")
  if (chain === undefined) throw new Error("the chain exists")
  expect(shutAlong(chain, new Set(["beds"])).map((fold) => fold.id)).toEqual(["beds"])
})
