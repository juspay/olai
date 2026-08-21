import { expect, test } from "bun:test"

import { DocumentPath, NodeId } from "@olai/format"
import type { NodeHit } from "@olai/surface"

import { atFile, atNode } from "../routes.ts"
import { filterItems, hitItem, modeOf, SHELL_ITEMS } from "./items.ts"

/** A hit on a record, with the address every hit carries. */
const node = (fields: Omit<NodeHit, "at">): NodeHit => ({
  at: { kind: "node", id: NodeId.make(fields.id) },
  ...fields,
})

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

/** A hit on a DOCUMENT is the same row with a different half of it filled in:
 *  its own face's title, the path it is at, and the glyph the sidebar draws
 *  that kind of file with. There is no place line invented for it — a document
 *  hangs under nothing, so the path IS where it is. */
test("a document hit becomes a row that opens the document", () => {
  const item = hitItem({
    at: { kind: "document", path: DocumentPath.make("notes/cabinets.md") },
    title: "Cabinets",
    matched: "body",
  })
  expect(item.label).toBe("Cabinets")
  expect(item.place).toBe("notes/cabinets.md")
  expect(item.of).toBe("document")
  expect(item.from).toBeUndefined()
  expect(item.action).toEqual({
    kind: "route",
    route: atFile("notes/cabinets.md"),
  })
})

test("a search hit becomes a row that jumps to the node", () => {
  const item = hitItem(node({
    id: "hinges",
    title: "pick the hinges",
    file: "house.olai",
    line: 6,
    path: ["kitchen remodel #home", "install the cabinets"],
    matched: "title",
  }))
  expect(item.label).toBe("pick the hinges")
  expect(item.from).toBe("house.olai")
  // The place is a LINE OF ITS OWN, never an inline hint: an ancestor title
  // is somebody's prose, and beside the title it starved it to one word per
  // line and scrolled the palette sideways.
  expect(item.hint).toBeUndefined()
  expect(item.action).toEqual({ kind: "route", route: atNode("hinges") })
})

test("the place reads NEAREST ancestor first, so a truncation keeps what situates the node", () => {
  // `path` is outermost-first; a line ellipsized from the end would lose the
  // immediate parent — the one crumb that answers "which `pick the hinges`?".
  const item = hitItem(node({
    id: "hinges",
    title: "pick the hinges",
    file: "house.olai",
    line: 6,
    path: ["kitchen remodel #home", "install the cabinets"],
    matched: "title",
  }))
  expect(item.place).toBe("install the cabinets · kitchen remodel #home")
})

test("a node at the top level is placed by its file", () => {
  const top = hitItem(node({
    id: "buy",
    title: "Buy groceries",
    file: "errands.olai",
    line: 1,
    path: [],
    matched: "title",
  }))
  expect(top.place).toBe("errands.olai")
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
