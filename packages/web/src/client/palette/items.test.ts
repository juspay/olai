import { expect, test } from "bun:test"

import { DocumentPath, NodeId } from "@olai/format"
import type { AppCommand, Hung } from "@olai/plugin-api"
import type { NodeHit } from "@olai/surface"

import { atFile, atNode } from "../routes.ts"
import { atOnce } from "../settled.ts"
import { commandsIn, filterItems, hitItem, modeOf, SHELL_ITEMS } from "./items.ts"

/** A plugin's command, as the slot hands it over. `run` answers "it landed",
 *  which is the one thing none of these tests presses. */
const command = (prefix: string, said = "send to agent"): AppCommand => ({
  prefix,
  said,
  placeholder: `type a message after ${prefix} to send it`,
  run: () => Promise.resolve(null),
})

/** ...and hung, with the plugin's own word beside it — the shape
 *  `../plugins/runtime.ts`'s `hung` reads a list slot back as. */
const hung = (plugin: string, face: AppCommand): Hung<AppCommand> => ({ plugin, face })

/** The one every prefix test is written against: a chat plugin holding `>`. */
const ASK = command(">")

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
  expect(filterItems("agent").map((i) => i.id)).toEqual(["panel-agent"])
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
  }, atOnce)
  expect(item.label).toBe("Cabinets")
  expect(item.place).toBe("notes/cabinets.md")
  expect(item.of).toBe("document")
  // The face title renders like every title: markdown and `#tags` styled and
  // hued (`renderTitle`), and relative pictures resolve against the document's
  // own directory — the same contract a node's title has about its outline.
  expect(item.from).toBe("notes/cabinets.md")
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
  }), atOnce)
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
  }), atOnce)
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
  }), atOnce)
  expect(top.place).toBe("errands.olai")
})

test("a line under a plugin's prefix carries the command that will run it", () => {
  expect(modeOf("> mark kitchen done", [ASK])).toEqual({
    kind: "command",
    command: ASK,
    text: "mark kitchen done",
  })
  expect(modeOf("  >  hello", [ASK])).toEqual({ kind: "command", command: ASK, text: "hello" })
  expect(modeOf(">", [ASK])).toEqual({ kind: "command", command: ASK, text: "" })
})

/** RULE FOUR, as one call: a serve with no plugin in `app.command` — which is
 *  what `--plugins=` produces — offers no such prefix, so the character is
 *  ordinary text and the box goes on filtering the rows with it. */
test("with nothing hung in the slot, a `>` is just text", () => {
  expect(modeOf("> mark kitchen done", [])).toEqual({ kind: "filter" })
  expect(modeOf(">", [])).toEqual({ kind: "filter" })
})

test("a `+` line is a capture", () => {
  expect(modeOf("+ buy milk", [ASK])).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("+buy milk", [ASK])).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("  +  buy milk", [ASK])).toEqual({ kind: "capture", text: "buy milk" })
  expect(modeOf("+", [ASK])).toEqual({ kind: "capture", text: "" })
})

test("anything else filters the list, and a prefix is only ever the first character", () => {
  expect(modeOf("toggle", [ASK])).toEqual({ kind: "filter" })
  expect(modeOf("", [ASK])).toEqual({ kind: "filter" })
  // A `>` or a `+` INSIDE the line is text, not a mode.
  expect(modeOf("not > this", [ASK])).toEqual({ kind: "filter" })
  expect(modeOf("2 + 2", [ASK])).toEqual({ kind: "filter" })
})

test("the box is doing exactly one of the three, whichever prefix opened it", () => {
  // One value rather than one nullable string per prefix, so "commanding AND
  // capturing" is not a state anything downstream has to not be in.
  expect(modeOf("> plus a + in it", [ASK])).toEqual({
    kind: "command",
    command: ASK,
    text: "plus a + in it",
  })
  expect(modeOf("+ and a > in it", [ASK])).toEqual({
    kind: "capture",
    text: "and a > in it",
  })
})

/** CORE'S OWN PREFIX WINS, and the plugin's entry is skipped rather than
 *  quietly shadowed — a `+` that captured on one serve and asked an agent on
 *  another is the silent disagreement the whole check exists to refuse. */
test("a plugin claiming a prefix the palette already answers is refused", () => {
  const taken = command("+", "capture to the agent")
  expect(commandsIn([hung("chat", taken)])).toEqual([])
  // ...and the capture still means capture.
  expect(modeOf("+ buy milk", commandsIn([hung("chat", taken)]))).toEqual({
    kind: "capture",
    text: "buy milk",
  })
})

/** ...and so does the FIRST plugin to claim a free one, which — the list
 *  arriving in the bundle's order — makes the winner `olai.yml`'s decision
 *  rather than the mount race's. */
test("two plugins claiming one prefix: the first keeps it", () => {
  const second = command(">", "send to the other agent")
  expect(commandsIn([hung("chat", ASK), hung("other", second)])).toEqual([ASK])
})

test("every command whose character is free is kept, in the order it arrived", () => {
  const slash = command("/", "run a recipe")
  expect(commandsIn([hung("chat", ASK), hung("just", slash)])).toEqual([ASK, slash])
})

test("the capture row primes the prefix rather than doing anything", () => {
  // It writes nothing and closes nothing: the point of quick capture is that
  // the page under the palette does not move, and this row has no line yet.
  const capture = SHELL_ITEMS.find((item) => item.id === "capture")
  expect(capture?.action).toEqual({ kind: "prefix", prefix: "+ " })
  expect(filterItems("inbox").map((item) => item.id)).toEqual(["capture"])
})
