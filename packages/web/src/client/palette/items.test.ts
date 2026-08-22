import { expect, test } from "bun:test"

import { addressOf } from "@olai/format"

import { atFile, everywhereFor, type Route } from "../routes.ts"
import { filterItems, modeOf, searchItem, SHELL_ITEMS } from "./items.ts"

/** Where the reader is standing, for the two answers {@link searchItem} has.
 *  An outline takes a `?q=`; a document is prose and takes none
 *  (`../routes.ts`'s `narrowable`). */
const OUTLINE: Route = atFile("house.olai")
const DOCUMENT: Route = { kind: "at", address: addressOf("notes/finishes.md", null)! }

test("empty query returns every shell item", () => {
  expect(filterItems("").length).toBe(SHELL_ITEMS.length)
  expect(SHELL_ITEMS.some((i) => i.id === "reset-widths")).toBe(true)
})

test("filter matches label and search haystack", () => {
  expect(filterItems("today").map((i) => i.id)).toEqual(["nav-today"])
  expect(filterItems("overdue").map((i) => i.id)).toEqual(["nav-agenda"])
  expect(filterItems("toggle sidebar").map((i) => i.id)).toEqual(["panel-sidebar"])
  expect(filterItems("agent").map((i) => i.id)).toEqual(["panel-chat"])
})

/** The node hits are gone from this palette and this is what replaced them: a
 *  row that hands the query to the ONE search box rather than previewing eight
 *  of what is behind it (docs/brainstorming/one-search-box.md). */
test("a typed query offers to search the page in front of the reader", () => {
  const row = searchItem("hinges", OUTLINE)
  expect(row?.label).toBe("Search this page for “hinges”")
  expect(row?.action).toEqual({ kind: "search", query: "hinges", here: "page" })
})

test("…and on a page with no box of its own, to search everywhere", () => {
  // A document is prose, so it carries no `?q=` and draws no bar. A door that
  // did nothing there would be a door that works on some pages.
  const row = searchItem("hinges", DOCUMENT)
  expect(row?.label).toBe("Search everywhere for “hinges”")
  expect(row?.action).toEqual({ kind: "search", query: "hinges", here: "everywhere" })
  // …and where that goes is the ordinary `?q=` on the everywhere page, so the
  // words are the address and are never retyped.
  expect(everywhereFor("hinges")).toEqual({ kind: "search", filter: "hinges" })
})

test("nothing typed is no row at all", () => {
  expect(searchItem("", OUTLINE)).toBeNull()
  expect(searchItem("   ", OUTLINE)).toBeNull()
})

test("the row is offered even when the query matched a command", () => {
  // A reader who typed `today` may have meant the command or may have meant
  // the word; a door that appeared only when nothing else matched would be a
  // door you cannot learn.
  expect(filterItems("today").length).toBe(1)
  expect(searchItem("today", OUTLINE)).not.toBeNull()
})

test("a `>` line is a message to the agent", () => {
  expect(modeOf("> mark kitchen done")).toEqual({
    kind: "ask",
    text: "mark kitchen done",
  })
  expect(modeOf("  >  hello")).toEqual({ kind: "ask", text: "hello" })
  expect(modeOf(">")).toEqual({ kind: "ask", text: "" })
})

test("a `+` line is a capture", () => {
  expect(modeOf("+ buy milk")).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("+buy milk")).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("  +  buy milk")).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("+")).toEqual({ kind: "capture", text: "" })
})

test("anything else filters the list, and a prefix is only ever the first character", () => {
  expect(modeOf("toggle")).toEqual({ kind: "filter" })
  expect(modeOf("")).toEqual({ kind: "filter" })
  // A `>` or a `+` INSIDE the line is text, not a mode.
  expect(modeOf("not > this")).toEqual({ kind: "filter" })
  expect(modeOf("2 + 2")).toEqual({ kind: "filter" })
})

test("the box is doing exactly one of the three, and `>` is read first", () => {
  // One value rather than one nullable string per prefix, so "asking AND
  // capturing" is not a state anything downstream has to not be in.
  expect(modeOf("> plus a + in it")).toEqual({
    kind: "ask",
    text: "plus a + in it",
  })
  expect(modeOf("+ and a > in it")).toEqual({
    kind: "capture",
    text: "and a > in it",
  })
})

test("the capture row primes the prefix rather than doing anything", () => {
  // It writes nothing and closes nothing: the point of quick capture is that
  // the page under the palette does not move, and this row has no line yet.
  const capture = SHELL_ITEMS.find((item) => item.id === "capture")
  expect(capture?.action).toEqual({ kind: "prefix", prefix: "+ " })
  expect(filterItems("inbox").map((item) => item.id)).toEqual(["capture"])
})
