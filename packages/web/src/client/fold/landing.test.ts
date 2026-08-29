/**
 * The landing arithmetic as VALUES — which chain a draw owes an address, and
 * which of its folds stand between that chain and the reader's eye.
 *
 * The page/face half of the act is `../OutlinePage.tsx`, and its rules are
 * argued out in `./landing.ts` itself; what is here is the half any test can
 * hold without a browser: depth-first and mirror-proof, first match,
 * path-only folds, and no element askable of a tree that does not draw it.
 */

import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { chainTo, shutAlong } from "./landing.ts"

const line = (id: string, title: string, children: ReadonlyArray<Row> = []): Row => ({
  at: { file: "house.olai", line: 1, node: { id, ord: "a0", title } },
  blocked: [],
  children,
  key: id,
  kind: "node",
  shows: { file: "house.olai", line: 1, node: { id, ord: "a0", title } },
  under: 0,
})

/** A PLACEMENT of `target`'s, standing where it was written: the place is its
 *  own record — which is what a mirror's `at` holds — and what it SHOWS is the
 *  node's, which is the only id a landing should ever see. */
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
  // …and the same answer is the one the DRAW would give: whichever of the two
  // the resolver picks wears the accent here for it, and depth-first is the
  // pick the scroll's document-order query makes too.
  expect(self?.at(-1)?.at.node.id).toBe("beds")
})

test("no row that shows the id is no chain", () => {
  expect(chainTo([line("kitchen", "the kitchen")], "repair")).toBeUndefined()
})

// ── which of those folds the landing owes ──────────────────────────────

test("only the chain's shut ANCESTORS are owed — not its last row, and not folds nowhere on the path", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      line("order", "order the tiles", [line("pick", "pick a shade")]),
    ]),
    line("garden", "the garden"),
  ]
  const chain = chainTo(rows, "pick")
  if (chain === undefined) throw new Error("the chain exists")
  // Nothing folded, nothing owed.
  expect(shutAlong(chain, new Set())).toEqual([])
  // `pick` itself is folded: folding a row hides its children, and the row
  // the landing is named for stays drawn — no expansion owed for it alone.
  expect(shutAlong(chain, new Set(["pick"]))).toEqual([])
  // Both ancestors shut: the write names them in path order.
  expect(shutAlong(chain, new Set(["kitchen", "order"])).map((fold) => fold.id)).toEqual([
    "kitchen",
    "order",
  ])
  // A fold off the path is nobody's business here.
  expect(shutAlong(chain, new Set(["kitchen", "garden"])).map((fold) => fold.id)).toEqual([
    "kitchen",
  ])
})

// A MIRROR inside the chain folds the node it SHOWS (`./rows.ts`'s foldOf):
// the landing owes that one open just as it owes any other shut ancestor's —
// and once, however many placements of it stand along the way, because memory
// is keyed by the node shown and one open is the whole answer.
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
