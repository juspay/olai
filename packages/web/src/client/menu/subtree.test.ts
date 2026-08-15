/**
 * What the menu says about a subtree — the count it puts in a confirm, and the
 * text it puts on the clipboard.
 *
 * Over REAL rows: the fixture goes through `@olai/format`'s own assembly and
 * walk, because both answers turn on how a mirror is expanded and a hand-built
 * row would be this file's opinion of that rather than the format's.
 */

import { derive, rowsOf, type Row, withoutDone } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { flatten } from "../edit/order.ts"
import { asText, under } from "./subtree.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","props":{"status":"done","since":"2026-08-03"}}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the **walnut** cabinets","props":{"date":"2026-08-10"},"desc":"Two ways to go:\\n\\n- walnut, six weeks\\n- birch, in stock"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  `{"id":"lost","ord":"a1","mirror":"nothing-declares-this"}`,
].join("\n")

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
].join("\n")

const derived = derive(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }).nodes)
const rows = rowsOf(derived, "house.olai")

/** One row of the fixture, by id. `flatten` with nothing folded is "every row
 *  there is" — the client's own walk (`edit/order.ts`), rather than a second
 *  one written here to disagree with it about what pre-order means. */
const row = (id: string, of: ReadonlyArray<Row> = rows): Row => {
  const found = flatten(of, new Set()).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

// ── how much goes with it ──────────────────────────────────────────────

test("the count is the records the archive would move", () => {
  // demo, order, install, handles, and the PLACEMENT of the herb bed — five.
  // The herb bed's own child hangs under that placement on screen and is not
  // among them: it lives in another file, and `archive` moves what a `parent`
  // chain reaches.
  expect(under(derived, "kitchen")).toBe(5)
})

test("a leaf takes nothing with it", () => {
  expect(under(derived, "handles")).toBe(0)
})

test("hiding what is done does not shrink what an archive would take", () => {
  // The reason the count is asked of the SET and not of the rows. With done
  // hidden, `withoutDone` has already dropped `demo` and everything under it
  // from the tree — so a count taken from the drawn children would have
  // promised four and moved five.
  const showing = withoutDone(rows)
  expect(flatten(showing, new Set()).some((one) => one.at.node.id === "demo")).toBe(false)
  expect(under(derived, "kitchen")).toBe(5)
})

// ── what it reads as ───────────────────────────────────────────────────

test("a subtree is tabs, titles verbatim, and the note one level deeper", () => {
  expect(asText(row("kitchen"))).toBe(
    [
      "kitchen remodel",
      "\ttake out the old counters",
      // The title as the record HOLDS it: the page renders `**walnut**` bold,
      // and a copy that pasted the rendering would throw away what was typed.
      "\torder the **walnut** cabinets",
      "\t\tTwo ways to go:",
      // A blank line inside a note stays blank rather than becoming a line of
      // trailing tabs.
      "",
      "\t\t- walnut, six weeks",
      "\t\t- birch, in stock",
      "\tinstall them",
      "\t\tchoose the handles",
      // The mirror is copied as what it DRAWS — its target's title and its
      // target's children — because that is what the reader is looking at.
      "\tthe herb bed",
      "\t\tsow the basil",
    ].join("\n"),
  )
})

test("nothing about a mark or a date is encoded", () => {
  const text = asText(row("kitchen"))
  expect(text).not.toContain("2026-08-03")
  expect(text).not.toContain("2026-08-10")
  expect(text).not.toContain("done")
})

test("one node with no note is one line", () => {
  expect(asText(row("handles"))).toBe("choose the handles")
})

test("a placement that draws no node copies nothing", () => {
  // Its row says, in words, that the node it names is missing — and those
  // words are the tree's, not a line of somebody's outline.
  expect(asText(row("lost"))).toBe("")
})
