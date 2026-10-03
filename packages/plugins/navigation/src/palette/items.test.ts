/**
 * WHAT THE PALETTE PUTS IN FRONT OF A PERSON — the rows, the modes and which
 * prefix wins — beside the module that decides it.
 *
 * It was `@olai/web`'s `client/palette/items.test.ts`, in a directory that held
 * this bench and no palette: the box became this row's and its test did not
 * follow, so the boot package went on spelling `olai-plugin-navigation` three
 * times. `@olai/bundle`'s `fence.test.ts` reads that as a general package naming
 * a plugin, which is the one thing it holds an equality against.
 */

import { expect, test } from "bun:test"

import { DocumentPath, type NodeHit, NodeId } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import { atOnce } from "@olai/web/client/settled.ts"

import { atFile, atNode } from "../routes.ts"
import type { AppChord } from "../slots.ts"
import { boxOf, chordsIn, prefixesIn, type PalettePrefix, filterItems, hitItem, modeOf, SHELL_ITEMS } from "./items.ts"

/** A face hung, with the plugin's own word beside it — the shape
 *  `@olai/web`'s `client/plugins/runtime.ts` `hung` reads a list slot back as. */
const hung = <T,>(plugin: string, face: T): Hung<T> => ({ plugin, face })

/** The one every prefix test is written against: an adapter holding `+`. */
const PREFIX: PalettePrefix = { value: "+", label: "append", empty: "type text", testid: "append", after: "+ ", run: async () => ({ tone: "aside", text: "appended" }) }

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
  expect(filterItems("toggle sidebar").map((i) => i.id)).toEqual(["panel-sidebar"])
  expect(filterItems("reset sidebar").map((i) => i.id)).toEqual(["reset-widths"])
})

// ⌘J and its row left with the chat dock: nothing in the palette opens an
// agent panel any more, and nothing still answers to its old words.
test("no row toggles an agent panel", () => {
  expect(SHELL_ITEMS.some((i) => i.id === "panel-agent")).toBe(false)
  expect(filterItems("toggle agent panel")).toEqual([])
  expect(SHELL_ITEMS.find((i) => i.id === "reset-widths")?.label).toBe("Reset sidebar width")
})

/** A document row names its own file and opens it. */
test("a document hit becomes a row that opens the document", () => {
  const item = hitItem({
    at: { kind: "document", path: DocumentPath.make("notes/cabinets.md") },
    title: "Cabinets",
    matched: "body",
  }, atOnce)
  expect(item.label).toBe("Cabinets")
  expect(item.place).toEqual({ file: "notes/cabinets.md" })
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

test("the place separates the file and nearest ancestor from the middle", () => {
  // Keep the root-first path while protecting the nearest ancestor.
  const item = hitItem(node({
    id: "hinges",
    title: "pick the hinges",
    file: "house.olai",
    line: 6,
    path: ["kitchen remodel #home", "install the cabinets"],
    matched: "title",
  }), atOnce)
  expect(item.place).toEqual({ file: "house.olai", middle: "kitchen remodel #home", nearest: "install the cabinets" })
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
  expect(top.place).toEqual({ file: "errands.olai" })
})

/** A second adapter's prefix, for the tests about more than one. */
const TILDE: PalettePrefix = { ...PREFIX, value: "~", label: "note", testid: "note", after: "~ " }

/** A serve with no palette adapter offering a prefix — which is what a policy
 *  with all rows off produces — has none, so the character is ordinary text and
 *  the box goes on filtering the rows with it. */
test("with no adapter offering it, a prefix character is just text", () => {
  expect(modeOf("+ buy milk")).toEqual({ kind: "filter" })
  expect(modeOf("+", [])).toEqual({ kind: "filter" })
})

test("a `+` line is a capture", () => {
  expect(modeOf("+ buy milk", [PREFIX])).toEqual({ kind: "prefix", prefix: PREFIX, text: "buy milk" })
  expect(modeOf("+buy milk", [PREFIX])).toEqual({ kind: "prefix", prefix: PREFIX, text: "buy milk" })
  expect(modeOf("  +  buy milk", [PREFIX])).toEqual({ kind: "prefix", prefix: PREFIX, text: "buy milk" })
  expect(modeOf("+", [PREFIX])).toEqual({ kind: "prefix", prefix: PREFIX, text: "" })
})

test("anything else filters the list, and a prefix is only ever the first character", () => {
  expect(modeOf("toggle", [PREFIX, TILDE])).toEqual({ kind: "filter" })
  expect(modeOf("", [PREFIX, TILDE])).toEqual({ kind: "filter" })
  // A `~` or a `+` INSIDE the line is text, not a mode.
  expect(modeOf("not ~ this", [PREFIX, TILDE])).toEqual({ kind: "filter" })
  expect(modeOf("2 + 2", [PREFIX, TILDE])).toEqual({ kind: "filter" })
})

test("the box is doing exactly one thing, whichever prefix opened it", () => {
  // One value rather than one nullable string per prefix, so "noting AND
  // capturing" is not a state anything downstream has to not be in.
  expect(modeOf("~ plus a + in it", [PREFIX, TILDE])).toEqual({
    kind: "prefix", prefix: TILDE,
    text: "plus a + in it",
  })
  expect(modeOf("+ and a ~ in it", [PREFIX, TILDE])).toEqual({
    kind: "prefix", prefix: PREFIX,
    text: "and a ~ in it",
  })
})

/** THE FIRST ADAPTER TO CLAIM A CHARACTER KEEPS IT, and the second is skipped
 *  out loud rather than quietly shadowing it — a `+` that captured on one serve
 *  and did something else on another is the silent disagreement the check
 *  exists to refuse. The list arrives in the bundle's order, so the winner is
 *  `olai.yml`'s decision rather than the mount race's. */
test("two adapters claiming one prefix: the first keeps it", () => {
  const warned = console.warn
  const warnings: Array<string> = []
  console.warn = (line: string) => { warnings.push(line) }
  try {
    const taken: PalettePrefix = { ...PREFIX, label: "capture elsewhere", testid: "elsewhere" }
    const kept = prefixesIn([{ owner: "capture", value: PREFIX }, { owner: "other", value: taken }])
    expect(kept).toEqual([PREFIX])
    // ...and the capture still means capture.
    expect(modeOf("+ buy milk", kept)).toEqual({ kind: "prefix", prefix: PREFIX, text: "buy milk" })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("other")
    expect(warnings[0]).toContain("capture")
  } finally {
    console.warn = warned
  }
})

test("every prefix whose character is free is kept, in the order it arrived", () => {
  expect(prefixesIn([{ owner: "capture", value: PREFIX }, { owner: "notes", value: TILDE }])).toEqual([PREFIX, TILDE])
})

test("navigation does not promise a feature-owned prefix without its provider", () => {
  expect(SHELL_ITEMS.some(item => item.id === "capture")).toBe(false)
  expect(filterItems("inbox")).toEqual([])
  expect(modeOf("+ buy milk", [])).toEqual({ kind: "filter" })
})

test("an arbitrary prefix survives parsing and disappears with its contribution", () => {
  expect(modeOf(" ~ text", [TILDE])).toEqual({ kind: "prefix", prefix: TILDE, text: "text" })
  expect(modeOf(" ~ text", [])).toEqual({ kind: "filter" })
})

test("a pending question owns Enter even when the box contains a contributed prefix", () => {
  const question = { kind: "line" as const, label: "Rename", question: "Name?", placeholder: "Name", initial: "", resolve: () => { throw new Error("parsing must not execute an action") } }
  expect(boxOf("+ text", question, [PREFIX])).toEqual({ kind: "answering", question })
})

const chord = (key: string, shift: boolean, said: string): AppChord => ({ key, shift, said, whileEditing: true, press: () => {} })

test("a plugin's chord over one the app already answers is refused, and the first plugin keeps a free one", () => {
  const warned = console.warn
  const said: Array<string> = []
  console.warn = (line: string) => { said.push(line) }
  try {
    const closePane = chord("w", true, "close the tab")
    const next = chord(".", true, "next tab")
    const again = chord(".", true, "another next")
    const bare = chord("w", false, "bare w")
    const kept = chordsIn(
      [hung("tabs", closePane), hung("tabs", next), hung("other", again), hung("other", bare)],
      [{ key: "w", shift: true, action: "closePane" }],
    )
    expect(kept).toEqual([next, bare])
    expect(said).toHaveLength(2)
    expect(said[0]).toContain("closePane")
    expect(said[0]).toContain("tabs")
    expect(said[1]).toContain("the plugin \"tabs\"")
  } finally {
    console.warn = warned
  }
})
