import { expect, test } from "bun:test"

import {
  type Address,
  addressOf,
  addressWritten,
  DocumentPath,
  linkedTitle,
  NodeId,
  parseAddress,
  PIN_NAME_UNWRITABLE,
  pinTitle,
  printAddress,
  Slug,
} from "./address.ts"

/** The four arms, spelled out — through the schemas' own constructors, since
 *  the halves of an address are branded and a test that cast around them would
 *  be reading a different type from the one the app holds. */
const document = (path: string): Address => ({
  kind: "document",
  path: DocumentPath.make(path),
})
const node = (id: string): Address => ({ kind: "node", id: NodeId.make(id) })
const row = (path: string, id: string): Address => ({
  kind: "row",
  path: DocumentPath.make(path),
  id: NodeId.make(id),
})
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
  ["Tasks.olai#a1b2c3", row("Tasks.olai", "a1b2c3")],
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
// the fragment itself says: an outline has rows and no headings, a body has
// headings and no rows.
test("an element of an outline is a row, an element of a body is a heading", () => {
  expect(parseAddress("Tasks.olai#a1b2c3")).toEqual(row("Tasks.olai", "a1b2c3"))
  expect(parseAddress("README.md#a1b2c3")).toEqual(heading("README.md", "a1b2c3"))
})

// The document half of a row address is a fact that can go stale — the node
// moves between files and keeps its id — and that is paid the way a renamed
// heading pays it: reading keeps the file the address spelled, because the
// qualified form is what a LANDING needs and the bare form is what a
// permalink needs. The two are deliberately NOT one arm.
test("a doc-qualified node keeps its file, and a bare one prints bare", () => {
  const qualified = parseAddress("Tasks.olai#a1b2c3")
  expect(qualified).toEqual(row("Tasks.olai", "a1b2c3"))
  expect(printAddress(qualified as Address)).toBe("Tasks.olai#a1b2c3")
  expect(printAddress(node("a1b2c3"))).toBe("#a1b2c3")
})

// One constructor, so the arm a pair of halves lands on is decided in one
// place rather than once per caller.
test("the halves name the same places the written forms do", () => {
  expect(addressOf("Tasks.olai", null)).toEqual(document("Tasks.olai"))
  expect(addressOf(null, "a1b2c3")).toEqual(node("a1b2c3"))
  expect(addressOf("README.md", "install")).toEqual(heading("README.md", "install"))
  expect(addressOf("Tasks.olai", "a1b2c3")).toEqual(row("Tasks.olai", "a1b2c3"))
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
      // and it is what keeps `today` from being read as a file. `photo.png`
      // was one of these until the viewers made a picture a kind — which is
      // the refinement doing its job rather than a rule being relaxed, and the
      // test below is where a picture's address is read.
      "notes",
      "photo.tiff",
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

// EVERY KIND THE REGISTRY CLAIMS IS AN ADDRESS, which is what makes an address
// a fact about the path rather than a list kept here: a picture, a `.csv` and
// a `.pdf` got one the day they got a page, and this file changed by nothing.
//
// AN ELEMENT ON ONE IS A HEADING, and that is the one reading worth pinning: a
// file whose content is a body has headings in it, and one whose content is
// records has nodes (`./kinds.ts`'s `holds`). A picture has no headings this
// app can find, so an address into one lands on nothing — exactly as a `.md`
// whose heading was renamed does — where reading it as a NODE address would be
// the grammar claiming a vault's pictures hold records.
test("every kind with a page has an address, and an element on one is a heading", () => {
  expect(parseAddress("photo.png")).toEqual(document("photo.png"))
  expect(parseAddress("art/diagram.svg")).toEqual(document("art/diagram.svg"))
  expect(parseAddress("data/sales.csv")).toEqual(document("data/sales.csv"))
  expect(parseAddress("reports/q3.pdf")).toEqual(document("reports/q3.pdf"))
  expect(parseAddress("reports/q3.pdf#summary"))
    .toEqual(heading("reports/q3.pdf", "summary"))
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

// The printer takes a fast path for a name that is already the characters a
// URL carries verbatim, and the fast path has to BE the walk: a class one
// character too wide is an address printed two ways depending on which branch
// ran. Checked against `encodeURIComponent` itself, over every code point a
// name is likely to hold.
test("the plain-path fast path prints what the walk would have printed", () => {
  const walked = (path: string): string =>
    path.split("/").map(encodeURIComponent).join("/")
  const names = [
    "Tasks.olai",
    "notes/README.md",
    "a file with spaces.olai",
    "a-'file_(2)~!*.md",
    "wing/kitchen.olai",
    "100% done.md",
    "a&b.md",
    "a$b.md",
    "a+b.md",
    "a,b.md",
    "a;b=c.md",
    "a:b@c.md",
    "a?b.md",
    "a#b.md",
    "🌱.md",
  ]
  for (const name of names) {
    const address = addressOf(name, null)
    if (address === null) continue
    expect(printAddress(address)).toBe(walked(name))
  }
})

// ── a pin's title, written and read back ───────────────────────────────

/**
 * The inverse pair, checked as a pair: what {@link pinTitle} writes is what
 * {@link linkedTitle} reads, for every address this app mints and for the
 * awkward ones a directory can hold. A name written one way and read another
 * is a row that silently stops being a door on the shelf.
 */
test("a named pin round-trips through the reader that draws it", () => {
  const names = ["What is late", "Kitchen #home", "an [unclosed bracket", "  padded  "]
  const addresses = [
    "/agenda?q=is%3Atodo",
    "/#a1b2c3",
    "/notes/README.md#install",
    "/d/2026-08-20",
    "/",
  ]
  for (const at of addresses) {
    for (const name of names) {
      const title = pinTitle(at, name)
      expect(title).toBeDefined()
      const read = linkedTitle(title ?? "")
      expect(read?.label).toBe(name.trim())
      expect(read?.at).toBe(at)
      // …and the ADDRESS is what it always was: `addressWritten` is what both
      // faces cut a title with, so a named pin and a bare one answer the same
      // place.
      expect(addressWritten(title ?? "")).toBe(at)
    }
  }
})

test("an address the link's grammar cannot carry is ESCAPED, not refused", () => {
  // A `(` is unspellable inside a link and means `%28` to every reader of an
  // address here — so a file with parentheses in its name is nameable, and the
  // written form still reads back as the same path.
  const title = pinTitle("/notes/plan%20(old).olai", "The old plan")
  expect(title).toBe("[The old plan](/notes/plan%20%28old%29.olai)")
  expect(parseAddress(addressWritten(title ?? "").slice(1)))
    .toEqual(document("notes/plan (old).olai"))
})

test("a blank name is the BARE address — un-naming is typing the name away", () => {
  expect(pinTitle("/agenda?q=is%3Atodo", "")).toBe("/agenda?q=is%3Atodo")
  expect(pinTitle("/agenda?q=is%3Atodo", "   ")).toBe("/agenda?q=is%3Atodo")
  expect(pinTitle("  /#order  ", "")).toBe("/#order")
})

test("a name that cannot be written is REFUSED rather than mangled", () => {
  // The label reader ends at the first `]`, so writing one of these would
  // leave a title that is no longer an address at all — the row would drop off
  // the shelf with nothing said.
  for (const name of ["late] things", "]", "two\nlines", "a\rb"]) {
    expect(pinTitle("/agenda", name)).toBeUndefined()
  }
  expect(PIN_NAME_UNWRITABLE).toContain("]")
})
