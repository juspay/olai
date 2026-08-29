/**
 * The landing arithmetic as VALUES — which chain a draw owes an address, and
 * which of its folds stand between that chain and the reader's eye.
 *
 * The page/face half of the act is `./OutlinePage.tsx`, and its rules are
 * ruled by `fold/landing.ts` itself; what is here is the half any test can
 * hold without a browser: depth-first and mirror-proof, first match,
 * path-only folds, and no element askable of a tree that does not draw it.
 */

import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { chainTo, shutAlong } from "./landing.ts"

const line = (
  id: string,
  title: string,
  children: ReadonlyArray<Row> = [],
  links: ReadonlyArray<string> = [],
): Row => ({
  at: { file: "house.olai", line: 1, node: { id, ord: "a0", title } },
  links,
  children,
})

test("the chain runs root-down to the row that shows the id", () => {
  const rows = [
    line("kitchen", "the kitchen", [
      line("order", "order the tiles", [line("pick", "pick a shade")]),
      line("repair", "repair the ceiling"),
    ]),
  ]
  const chain = chainTo(rows, "repair")
  expect(chain?.map((row) => row.at.node.id)).toEqual(["kitchen", "repair"])
})

test("the first match answers for a node the page shows twice", () => {
  const rows = [
    line("kitchen", "the kitchen", [line("beds", "the garden beds", [], []), line("first-mirror", "the beds again", [], ["beds"])]),
    line("second-mirror", "the beds once more", [], ["beds"]),
  ]
  const chain = chainTo(rows, "beds")
  expect(chain?.at(-1)?.at.node.id).toBe("beds")
  expect(chain?.map((row) => row.at.node.id)).toEqual(["kitchen", "beds"])
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
