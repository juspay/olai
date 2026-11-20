import { TEST_CLAIMS } from "@olai/format/testlib"
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

const CANONICAL: ReadonlyArray<readonly [string, Address]> = [
  ["Tasks.olai", document("Tasks.olai")],
  ["notes/README.md", document("notes/README.md")],
  ["saved/report.html", document("saved/report.html")],
  ["#a1b2c3", node("a1b2c3")],
  ["#kitchen", node("kitchen")],
  ["Tasks.olai#a1b2c3", row("Tasks.olai", "a1b2c3")],
  ["notes/README.md#install", heading("notes/README.md", "install")],
  ["saved/report.html#Q3%20revenue", heading("saved/report.html", "Q3 revenue")],
  ["a%20file%20with%20spaces.olai", document("a file with spaces.olai")],
  ["wing/kitchen.olai", document("wing/kitchen.olai")],
]

test("every address survives being written and read back", () => {
  for (const [, address] of CANONICAL) {
    expect(parseAddress(TEST_CLAIMS, printAddress(address))).toEqual(address)
  }
})

test("every canonical spelling reads back as itself", () => {
  for (const [written, address] of CANONICAL) {
    expect(parseAddress(TEST_CLAIMS, written)).toEqual(address)
    expect(printAddress(address)).toBe(written)
  }
})

test("an element of an outline is a row, an element of a body is a heading", () => {
  expect(parseAddress(TEST_CLAIMS, "Tasks.olai#a1b2c3")).toEqual(row("Tasks.olai", "a1b2c3"))
  expect(parseAddress(TEST_CLAIMS, "README.md#a1b2c3")).toEqual(heading("README.md", "a1b2c3"))
})

test("a doc-qualified node keeps its file, and a bare one prints bare", () => {
  const qualified = parseAddress(TEST_CLAIMS, "Tasks.olai#a1b2c3")
  expect(qualified).toEqual(row("Tasks.olai", "a1b2c3"))
  expect(printAddress(qualified as Address)).toBe("Tasks.olai#a1b2c3")
  expect(printAddress(node("a1b2c3"))).toBe("#a1b2c3")
})

test("the halves name the same places the written forms do", () => {
  expect(addressOf(TEST_CLAIMS, "Tasks.olai", null)).toEqual(document("Tasks.olai"))
  expect(addressOf(TEST_CLAIMS, null, "a1b2c3")).toEqual(node("a1b2c3"))
  expect(addressOf(TEST_CLAIMS, "README.md", "install")).toEqual(heading("README.md", "install"))
  expect(addressOf(TEST_CLAIMS, "Tasks.olai", "a1b2c3")).toEqual(row("Tasks.olai", "a1b2c3"))
  expect(addressOf(TEST_CLAIMS, "README.md", "")).toEqual(document("README.md"))
})

test("text that names no place is not an address", () => {
  for (
    const text of [
      "",
      "#",
      "notes",
      "photo.tiff",
      "today",
      "notes#install",
      "/Tasks.olai",
      "../secrets.md",
      "a/../b.md",
      "%.md",
      "%ZZ/notes.md",
    ]
  ) {
    expect(parseAddress(TEST_CLAIMS, text)).toBeNull()
  }
})

test("every kind with a page has an address, and an element on one is a heading", () => {
  expect(parseAddress(TEST_CLAIMS, "photo.png")).toEqual(document("photo.png"))
  expect(parseAddress(TEST_CLAIMS, "art/diagram.svg")).toEqual(document("art/diagram.svg"))
  expect(parseAddress(TEST_CLAIMS, "data/sales.csv")).toEqual(document("data/sales.csv"))
  expect(parseAddress(TEST_CLAIMS, "reports/q3.pdf")).toEqual(document("reports/q3.pdf"))
  expect(parseAddress(TEST_CLAIMS, "reports/q3.pdf#summary"))
    .toEqual(heading("reports/q3.pdf", "summary"))
})

test("an element nothing could have written names no element", () => {
  expect(parseAddress(TEST_CLAIMS, "README.md#%ZZ")).toEqual(document("README.md"))
  expect(parseAddress(TEST_CLAIMS, "README.md#")).toEqual(document("README.md"))
})

test("parsing answers for any string at all, and never throws", () => {
  for (const text of ["%", "%2", "#%", "a#b#c", "🌱.md", "?q=is:done", "//"]) {
    expect(() => parseAddress(TEST_CLAIMS, text)).not.toThrow()
  }
  expect(parseAddress(TEST_CLAIMS, "README.md#a%23b")).toEqual(heading("README.md", "a#b"))
  expect(printAddress(node("a#b"))).toBe("#a%23b")
})

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
    const address = addressOf(TEST_CLAIMS, name, null)
    if (address === null) continue
    expect(printAddress(address)).toBe(walked(name))
  }
})

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
      expect(addressWritten(title ?? "")).toBe(at)
    }
  }
})

test("an address the link's grammar cannot carry is ESCAPED, not refused", () => {
  const title = pinTitle("/notes/plan%20(old).olai", "The old plan")
  expect(title).toBe("[The old plan](/notes/plan%20%28old%29.olai)")
  expect(parseAddress(TEST_CLAIMS, addressWritten(title ?? "").slice(1)))
    .toEqual(document("notes/plan (old).olai"))
})

test("a blank name is the BARE address — un-naming is typing the name away", () => {
  expect(pinTitle("/agenda?q=is%3Atodo", "")).toBe("/agenda?q=is%3Atodo")
  expect(pinTitle("/agenda?q=is%3Atodo", "   ")).toBe("/agenda?q=is%3Atodo")
  expect(pinTitle("  /#order  ", "")).toBe("/#order")
})

test("a name that cannot be written is REFUSED rather than mangled", () => {
  for (const name of ["late] things", "]", "two\nlines", "a\rb"]) {
    expect(pinTitle("/agenda", name)).toBeUndefined()
  }
  expect(PIN_NAME_UNWRITABLE).toContain("]")
})
