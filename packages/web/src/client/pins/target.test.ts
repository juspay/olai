/**
 * THE TWO SIDES OF ONE TITLE, held against each other.
 *
 * A pin's title is read twice now, once on each side of the wire, and each side
 * reads the half that is its own (docs/format.md's Pins, the last paragraph):
 * the SERVER reads the node an address names — a statement about the directory,
 * so `@olai/format`'s (`pinTargetIn`) — and the BROWSER reads which page it
 * opens and what a `?q=` on it means, at view time, through the bijection that
 * wrote it (`../address/address.ts`).
 *
 * The two must agree about exactly one thing: WHICH titles name a node, and
 * which node. Where they disagree, a shelf row is drawn by the app's parser and
 * named by an answer about some other id — or drawn as a dead address while the
 * set holds the node perfectly well.
 *
 * So it is pinned here, in the one package that can import both, the way every
 * other two-sided reading in this design is pinned: against the reference the
 * app itself uses. A unit test rather than a scenario — a browser has nothing
 * to add to a disagreement between two pure functions.
 */

import { pinTargetIn } from "@olai/format"
import { expect, test } from "bun:test"

import { addressIn } from "../address/address.ts"

/** What the BROWSER's parser says this title's node is, if it says one — the
 *  reference the answer is judged against. */
const nodeIn = (title: string): string | undefined => {
  const route = addressIn(title)
  if (route === undefined || route.kind !== "at") return undefined
  const address = route.address
  return address !== null && address.kind === "node" ? address.id : undefined
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
  // Addresses that name themselves.
  "/notes/finishes.md",
  "/notes/finishes.md#install",
  "/garden.olai",
  "/garden.olai#herbs",
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

test("the id the server resolves against is the id the app's own parser reads", () => {
  for (const title of TITLES) {
    expect([title, pinTargetIn(title)]).toEqual([title, nodeIn(title)])
  }
})

test("…and the corpus above actually exercises both answers", () => {
  const named = TITLES.filter((title) => pinTargetIn(title) !== undefined)
  expect(named.length).toBeGreaterThan(4)
  expect(named.length).toBeLessThan(TITLES.length)
})
