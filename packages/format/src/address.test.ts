import { expect, test } from "bun:test"

import {
  type Address,
  addressOf,
  DocumentPath,
  NodeId,
  parseAddress,
  printAddress,
  Slug,
} from "./address.ts"

/** The three arms, spelled out — through the schemas' own constructors, since
 *  the halves of an address are branded and a test that cast around them would
 *  be reading a different type from the one the app holds. */
const document = (path: string): Address => ({
  kind: "document",
  path: DocumentPath.make(path),
})
const node = (id: string): Address => ({ kind: "node", id: NodeId.make(id) })
const heading = (path: string, slug: string): Address => ({
  kind: "heading",
  path: DocumentPath.make(path),
  slug: Slug.make(slug),
})

/** Every address, in its CANONICAL written form — the one thing the two
 *  directions have to agree about. A written address the app cannot read back
 *  is a pin that opens the wrong page and a URL that means something else on a
 *  reload, and the round trip is the only thing that catches it. */
const CANONICAL: ReadonlyArray<readonly [string, Address]> = [
  ["Tasks.olai", document("Tasks.olai")],
  ["notes/README.md", document("notes/README.md")],
  ["saved/report.html", document("saved/report.html")],
  ["#a1b2c3", node("a1b2c3")],
  ["#kitchen", node("kitchen")],
  ["notes/README.md#install", heading("notes/README.md", "install")],
  // A `.html` carries whatever ids its author wrote, which are not slugs and
  // are not promised to be free of characters an address gives its own meaning
  // to. The escape is the whole point: it survives both ways.
  ["saved/report.html#Q3%20revenue", heading("saved/report.html", "Q3 revenue")],
  ["a%20file%20with%20spaces.olai", document("a file with spaces.olai")],
  // The separator survives, so a reader still recognises the folder.
  ["wing/kitchen.olai", document("wing/kitchen.olai")],
]

test("every address survives being written and read back", () => {
  for (const [, address] of CANONICAL) {
    expect(parseAddress(printAddress(address))).toEqual(address)
  }
})

test("every canonical spelling reads back as itself", () => {
  for (const [written, address] of CANONICAL) {
    expect(parseAddress(written)).toEqual(address)
    expect(printAddress(address)).toBe(written)
  }
})

// ── the two halves ─────────────────────────────────────────────────────

// What a `#` means is read off the DOCUMENT it follows, because nothing about
// the fragment itself says: an outline has nodes and no headings, a body has
// headings and no nodes.
test("an element of an outline is a node, an element of a body is a heading", () => {
  expect(parseAddress("Tasks.olai#a1b2c3")).toEqual(node("a1b2c3"))
  expect(parseAddress("README.md#a1b2c3")).toEqual(heading("README.md", "a1b2c3"))
})

// The document half of a node address is a fact that can go stale — the node
// moves between files and keeps its id — so the qualified form is READ and the
// bare one is what comes back out.
test("a doc-qualified node normalises to the bare node", () => {
  const address = parseAddress("Tasks.olai#a1b2c3")
  expect(address).toEqual(node("a1b2c3"))
  expect(printAddress(address as Address)).toBe("#a1b2c3")
})

// One constructor, so the arm a pair of halves lands on is decided in one
// place rather than once per caller.
test("the halves name the same places the written forms do", () => {
  expect(addressOf("Tasks.olai", null)).toEqual(document("Tasks.olai"))
  expect(addressOf(null, "a1b2c3")).toEqual(node("a1b2c3"))
  expect(addressOf("README.md", "install")).toEqual(heading("README.md", "install"))
  expect(addressOf("Tasks.olai", "a1b2c3")).toEqual(node("a1b2c3"))
  // An empty element is a document with nothing after the `#`, which names the
  // document — not a failure.
  expect(addressOf("README.md", "")).toEqual(document("README.md"))
})

// ── what is not an address ─────────────────────────────────────────────

test("text that names no place is not an address", () => {
  for (
    const text of [
      // Nothing at all, and a sigil with nothing after it.
      "",
      "#",
      // A suffix no kind of this format claims: `fileKind` is the refinement,
      // and it is what keeps `today` from being read as a file.
      "notes",
      "photo.png",
      "today",
      "notes#install",
      // Outside the served directory, or able to leave the site: `//x.olai` is
      // another host to a browser.
      "/Tasks.olai",
      "../secrets.md",
      "a/../b.md",
      // An escape nothing could have written, in the half that has to be read.
      "%.md",
      "%ZZ/notes.md",
    ]
  ) {
    expect(parseAddress(text)).toBeNull()
  }
})

// An unreadable ELEMENT is not an unreadable address: the document is still
// named, and it draws exactly as it would have drawn with no fragment at all.
test("an element nothing could have written names no element", () => {
  expect(parseAddress("README.md#%ZZ")).toEqual(document("README.md"))
  expect(parseAddress("README.md#")).toEqual(document("README.md"))
})

// Totality is the promise the address bar, a `Pins.olai` title and an href in
// somebody's note are all read on: a throw during render is a blank page.
test("parsing answers for any string at all, and never throws", () => {
  for (const text of ["%", "%2", "#%", "a#b#c", "🌱.md", "?q=is:done", "//"]) {
    expect(() => parseAddress(text)).not.toThrow()
  }
  // A second `#` is part of the element, not a second cut: the printer escapes
  // every `#` inside a name, so the one this grammar wrote is the first one.
  expect(parseAddress("README.md#a%23b")).toEqual(heading("README.md", "a#b"))
  expect(printAddress(node("a#b"))).toBe("#a%23b")
})
