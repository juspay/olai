/**
 * The landing arithmetic as VALUES — which chain a draw owes an address, and
 * which of its folds stand between that chain and the reader's eye.
 *
 * The page/face half of the act is `../OutlinePage.tsx`, and its rules are
 * argued out in `./landing.ts` itself; what is here is the half any test can
 * hold without a browser: depth-first and mirror-proof, first match,
 * path-only folds, and no element askable of a tree that does not draw it.
 */

import { type Row, shownRecord } from "@olai/format"
import { expect, test } from "bun:test"

import { aim, failedSays, missedSays, shutAlong } from "./landing.ts"

/** The landing's LOCAL half, put back together for the tests that pin it:
 *  `chainTo` is the arithmetic's own business now — nothing calls it but
 *  {@link aim} — so what shines through is the chain arm with the set made
 *  a question that has not been answered. Nothing below spoke of export
 *  shapes; every old `chainTo` assertion is the same page asking the same
 *  thing, one door in. */
const chainTo = (rows: ReadonlyArray<Row>, id: string): ReadonlyArray<Row> | undefined => {
  const answer = aim(rows, id, () => undefined)
  return answer.kind === "chain" ? answer.chain : undefined
}

const line = (id: string, title: string, children: ReadonlyArray<Row> = []): Row => ({
  at: { file: "house.org", line: 1, node: { id, ord: "a0", title } },
  blocked: [],
  children,
  key: id,
  kind: "node",
  shows: { file: "house.org", line: 1, node: { id, ord: "a0", title } },
  under: 0,
})

/** A PLACEMENT of `target`'s, standing where it was written: the place is its
 *  own record — which is what a mirror's `at` holds, and the id the placement
 *  itself answers to — and what it SHOWS is the node's. */
const placementOf = (
  target: string,
  title: string,
  atLine: number,
  children: ReadonlyArray<Row> = [],
): Row => ({
  at: { file: "house.org", line: atLine, node: { id: `m${atLine}`, ord: "a0", title: "" } },
  blocked: [],
  children,
  key: `m${atLine}`,
  kind: "mirror",
  shows: { file: "garden.org", line: 2, node: { id: target, ord: "a0", title } },
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

// ── a placement id: the address may spell the mirror's own record ─────

test("a placement id lands on the mirror's own row", () => {
  const rows = [
    line("beds", "the garden beds"),
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
  ]
  // The id the address spelled IS the placement's record, and the mirror row
  // is the more specific answer than the target's other row, depth-first or
  // not: the id names this place and no other.
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
  // The prove-a-nothing-changed case: the placement's own id and the node's
  // own are two records (ids are unique across the set), so whatever the
  // mirror half added, `beds` answers as it did before any of it existed.
  const rows = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
    line("beds", "the garden beds", [line("sprig", "plant a sprig")]),
  ]
  expect(chainTo(rows, "beds")?.map((row) => row.at.node.id)).toEqual(["garden-row", "m7"])
  expect(chainTo(rows, "sprig")?.map((row) => row.at.node.id)).toEqual(["beds", "sprig"])
})

// ── the answer with the set folded in ─────────────────────────────────

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
  // `m9` is written in a file this page is not: the rows keep no answer for
  // it, the SET resolves it (the chat press's own door), and the target then
  // answers by the same first-match rule a spelled target would have.
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

// ── the reveal: the row is here and the done pick hides it ─────────────

test("the drawn rows saying nothing while the WHOLE page answers is the reveal", () => {
  // `demo` is done: the drawn page drops it, the whole page keeps it. The
  // reveal carries the chain in the reading's own shape, root-down — the
  // ancestor the pick never took rides along, since drawing the row back
  // needs every place on the way spared of the sweep.
  const whole = [
    line("kitchen", "the kitchen", [
      line("demo", "take out the old counters"),
      line("order", "order the new cabinets"),
    ]),
  ]
  const rows = [line("kitchen", "the kitchen", [line("order", "order the new cabinets")])]
  // The set IS asked first, as ever — the drawn rows answered nothing and a
  // placement elsewhere might need resolving; its answer for a plain node id
  // is the id itself, and the whole page is where the chain is then found.
  const answer = aim(rows, "demo", (asked) => asked, whole)
  expect(answer.kind).toBe("reveal")
  if (answer.kind !== "reveal") return
  expect(answer.chain.map((row) => row.key)).toEqual(["kitchen", "demo"])
})

test("a done-hidden MIRROR the address spells is revealed as its own place", () => {
  // The placement half of the reveal: `m7` is a mirror of `beds`, both done
  // on the pick; the id spells the place and the place is the answer.
  const whole = [
    line("garden-row", "about the garden", [placementOf("beds", "the garden beds", 7)]),
  ]
  const answer = aim([], "m7", () => "beds", whole)
  expect(answer.kind).toBe("reveal")
  if (answer.kind !== "reveal") return
  expect(answer.chain.map((row) => row.key)).toEqual(["garden-row", "m7"])
})

test("a done-hidden TARGET of a spelled placement is revealed the way a drawn one would land", () => {
  // `m9` is written nowhere this page draws: the set resolves it to `beds`,
  // and the whole page is where the target's chain is found — the same
  // first-match rule, one prune earlier.
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
  // `glazing` is a real node — in the file NEXT DOOR: no reading of this
  // page draws it, revealed or not. And the reveal is never asked at all
  // where the caller gates it away: the same id under a filter's typed
  // question gets the miss's own words, reveal or no reveal.
  const whole = [line("kitchen", "the kitchen")]
  expect(aim([], "glazing", () => "glazing", whole)).toEqual({ kind: "miss", target: "glazing" })
  expect(aim([], "glazing", () => "glazing")).toEqual({ kind: "miss", target: "glazing" })
})

test("the set's answer changing nothing is the certain miss, carrying WHICH half", () => {
  const rows = [line("kitchen", "the kitchen")]
  // Declared by the set — a node in a file this page is not (a DONE row the
  // pick hides is the reveal's business, one door down): the miss answers
  // WHICH page it is.
  expect(aim(rows, "m9", () => "repair")).toEqual({ kind: "miss", target: "repair" })
  // Declared by nothing.
  expect(aim(rows, "repair", () => null)).toEqual({ kind: "miss", target: null })
})

// ── what the miss SAYS ────────────────────────────────────────────────

test("a certain miss says what was asked — and which half of certain it is", () => {
  expect(missedSays("day29-thirteenth", null)).toBe(
    "day29-thirteenth — nothing by that name is drawn on this page",
  )
  // What the SET declares but this page draws no row of — the id of a DONE
  // row, a filtered branch, another file — is NOT "nothing by that name":
  // a hidden live row must not answer in the dead link's words.
  expect(missedSays("day29-thirteenth", "day29-anchor")).toBe(
    "day29-thirteenth — what it names is not drawn on this page",
  )
})

test("the failed ask says just that — nothing of whether the name names", () => {
  expect(failedSays("day29-thirteenth")).toBe(
    "day29-thirteenth — the set could not be asked what it names",
  )
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
