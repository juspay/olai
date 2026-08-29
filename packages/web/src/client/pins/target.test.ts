/**
 * THE TWO SIDES OF ONE TITLE, held against each other — and the exact shape of
 * the relation between them, which is NOT equality.
 *
 * A pin's title is read twice now, once on each side of the wire, and each side
 * reads the half that is its own (docs/format.md's Pins, the last paragraph):
 * the SERVER reads the node an address names — a statement about the directory,
 * so `@olai/format`'s (`pinTargetIn`) — and the BROWSER reads which page it
 * opens and what a `?q=` on it means, at view time, through the bijection that
 * wrote it (`../address/address.ts`).
 *
 * ## The property that has to hold, and the one that cannot
 *
 * **What must hold is one-directional:** wherever the APP's parser reads a node,
 * the server must have read the same node — otherwise a live pin draws its own
 * address as if its target were gone, which is the shelf quietly losing the
 * feature this design moved it for.
 *
 * **What cannot hold is the converse**, and it is worth writing down rather than
 * discovering: the browser applies precedence the format cannot see. `/d/…`,
 * `/today`, `/agenda` and `/trash` are words THIS APP claimed, read before the
 * address grammar is asked at all — so `/d/2026-08-20.olai#x` is a day page up
 * here and an outline's node down there. The server over-answers by
 * construction, and the narrowing that makes that harmless is `./pins.ts`'s
 * `showing`: an answered name is spent only where this parser agrees the row
 * addresses that node. The last test below is that case end to end.
 *
 * A unit test rather than a scenario — a browser has nothing to add to a
 * disagreement between two pure functions.
 */

import { pinTargetIn } from "@olai/format"
import { expect, test } from "bun:test"

import { addressIn } from "../address/address.ts"
import { pinsOf } from "./pins.ts"

/** What the BROWSER's parser says this title's node is, if it says one — the
 *  reference the answer is judged against. A ROW names a node too (the
 *  qualified spelling of the same id), so it is read the way the bare one is. */
const nodeIn = (title: string): string | undefined => {
  const route = addressIn(title)
  if (route === undefined || route.kind !== "at") return undefined
  const address = route.address
  return address !== null && (address.kind === "node" || address.kind === "row")
    ? address.id
    : undefined
}

const TITLES = [
  // Nodes, in every spelling this app reads.
  "/#herbs",
  "/#a1b2c3",
  "[the herb bed](/#herbs)",
  "[](/#herbs)",
  "/?q=is%3Atodo#herbs",
  "/#the%20bed",
  "  /#herbs  ",
  // …including the QUALIFIED one, which both sides read as the same id — the
  // file half now scores where the page LANDS, and what a pin asks about is
  // still the node.
  "/garden.olai#herbs",
  "[the bed](/garden.olai#herbs)",
  // Addresses that name themselves.
  "/notes/finishes.md",
  "/notes/finishes.md#install",
  "/garden.olai",
  "/agenda",
  "/agenda?q=is%3Atodo",
  "[What is late](/agenda?q=is%3Atodo)",
  "/today",
  "/trash",
  "/d/2026-08-20",
  "/d/2026-08-20#anything",
  "/",
  "/?q=is%3Atodo",
  // …and titles that are not addresses at all.
  "the ones I keep coming back to",
  "/etc/passwd",
  "/#",
  "/#%",
  "/%",
  "/%ZZ.md",
  "",
  "see [the agenda](/agenda) tomorrow",
  "[a b](/#herbs) and more",
  "#herbs",
]

test("where the app's own parser reads a node, the server read the same node", () => {
  for (const title of TITLES) {
    const named = nodeIn(title)
    if (named === undefined) continue
    expect([title, pinTargetIn(title)]).toEqual([title, named])
  }
})

test("…and the corpus above actually exercises that direction", () => {
  const named = TITLES.filter((title) => nodeIn(title) !== undefined)
  expect(named.length).toBeGreaterThan(6)
  expect(named.length).toBeLessThan(TITLES.length)
})

// The converse, as a fact rather than a hope: this app claims `/d/…` before the
// address grammar is asked, and the grammar down there reads the same string as
// an outline with an element on it.
test("the server over-answers where this app claimed a word, and the row ignores it", () => {
  const claimed = "/d/2026-08-20.olai#x"
  expect(pinTargetIn(claimed)).toBe("x")
  expect(nodeIn(claimed)).toBeUndefined()

  // What that costs a reader: nothing. The row is drawn as the page THIS parser
  // read — a day — and the name answered about a node it does not address is
  // not spent.
  const drawn = pinsOf([{ id: "p", title: claimed, shows: { id: "x", name: "the kitchen" } }])
  expect(drawn.map((pin) => [pin.route.kind, pin.name])).toEqual([["day", "2026-08-20.olai"]])
})
