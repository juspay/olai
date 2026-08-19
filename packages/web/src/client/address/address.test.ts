/**
 * WHAT COUNTS AS AN ADDRESS, and what the page it names is CALLED.
 *
 * The interesting half is the refusals. This reading runs over every title the
 * app draws now, and the file it was written for — `Pins.olai` — is an
 * ordinary outline, so a person and an agent may write a heading, a note or a
 * nested checklist into it, and none of those names a place. What decides is
 * the BIJECTION (`../routes.ts`), which is why a title that merely begins with
 * a slash reads as text.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { hrefOf } from "../routes.ts"
import { addressIn, bareAddressIn, labelIn, nameOf } from "./address.ts"

// ── what is an address ─────────────────────────────────────────────────

test("an address this app would mint is a pin, whatever page it names", () => {
  for (const address of [
    "/n/herbs",
    "/doc/notes/finishes.md",
    "/o/garden.olai",
    "/d/2026-08-18",
    "/today",
    "/agenda",
    "/trash",
    "/",
  ]) {
    expect(hrefOf(addressIn(address)!)).toBe(address)
  }
})

test("the query rides along, and is read back as the filter it is", () => {
  const route = addressIn("/agenda?q=is%3Atodo")
  expect(route).toEqual({ kind: "agenda", filter: "is:todo" })
})

test("a query somebody wrote by hand is the same pin as the one a browser mints", () => {
  // `?q=is:todo` and `?q=is%3Atodo` are one filter spelled two ways, and a
  // shelf that told them apart would refuse a pin for its punctuation.
  expect(addressIn("/agenda?q=is:todo")).toEqual(addressIn("/agenda?q=is%3Atodo"))
})

test("a title that merely begins with a slash is a title, not a door", () => {
  // `routeOf` answers the front page for anything it does not recognise, which
  // is the right kindness in the address bar and would make every such row a
  // pin to `/` here.
  expect(addressIn("/etc/passwd")).toBeUndefined()
  expect(addressIn("/notes and things")).toBeUndefined()
})

test("a title spelled with an escape nothing can read is not a door, and does not throw", () => {
  // `decodeURIComponent("%")` throws, and this parse runs during render on a
  // file the format invites a hand and an agent to edit — so a `URIError` here
  // was the whole sidebar going down, not one row being skipped (review,
  // 2026-08-18). It reads as what it is: not an address, so not a pin.
  for (const title of ["/n/%", "/doc/%ZZ", "/o/%2", "[x](/n/%)"]) {
    expect(addressIn(title)).toBeUndefined()
  }
})

test("ordinary prose is not a pin", () => {
  expect(addressIn("the ones I keep coming back to")).toBeUndefined()
  expect(addressIn("")).toBeUndefined()
})

test("a markdown link is a NAMED pin; a blank label is no name", () => {
  const named = "[What is late](/agenda?q=is%3Atodo)"
  expect(hrefOf(addressIn(named)!)).toBe("/agenda?q=is%3Atodo")
  expect(addressIn("[](/n/herbs)")).toEqual({ kind: "node", id: "herbs" })
})

test("prose either side of a link is a sentence, not a pin", () => {
  // A row of `Pins.olai` may be a note about the shelf. Reading one as a door
  // would put a sentence in the sidebar.
  expect(addressIn("see [the agenda](/agenda) tomorrow")).toBeUndefined()
})

// ── and what the outline draws a face for ──────────────────────────────

test("a BARE address is a face; a markdown link is left to the markdown", () => {
  // A link already draws as a link with the label its author wrote — taking it
  // over would swap a clickable link for a mark. The bare form has no such
  // rendering, and the raw text is the plumbing this exists to stop showing.
  expect(bareAddressIn("/n/herbs")).toEqual({ kind: "node", id: "herbs" })
  expect(bareAddressIn("[the herb bed](/n/herbs)")).toBeUndefined()
  expect(bareAddressIn("buy milk")).toBeUndefined()
  // …while the SHELF reads both, because it is drawing doors rather than
  // titles.
  expect(addressIn("[the herb bed](/n/herbs)")).toEqual({ kind: "node", id: "herbs" })
})

test("the label somebody wrote is a name; a blank one is not", () => {
  expect(labelIn("[What is late](/agenda?q=is%3Atodo)")).toBe("What is late")
  expect(labelIn("[](/n/herbs)")).toBeUndefined()
  expect(labelIn("/n/herbs")).toBeUndefined()
})

// ── what a place is called ─────────────────────────────────────────────

const named = (title: string) =>
  derive(setOf({ "garden.olai": `{"id":"herbs","ord":"a0","title":"${title}"}` }).nodes)

test("a node address is called whatever that node is called right now", () => {
  expect(nameOf({ kind: "node", id: "herbs" }, named("the herb bed"))).toBe("the herb bed")
  // The same address, after somebody renamed the node somewhere else entirely.
  expect(nameOf({ kind: "node", id: "herbs" }, named("the herb spiral")))
    .toBe("the herb spiral")
})

test("an address at an id nothing declares says the address rather than a blank", () => {
  expect(nameOf({ kind: "node", id: "gone" }, named("the herb bed"))).toBe("/n/gone")
  expect(nameOf({ kind: "node", id: "herbs" }, undefined)).toBe("/n/herbs")
})

test("a mirror's id resolves to the node it stands for", () => {
  const set = derive(
    setOf({
      "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
      "house.olai": `{"id":"here","ord":"a0","mirror":"herbs"}`,
    }).nodes,
  )
  expect(nameOf({ kind: "node", id: "here" }, set)).toBe("the herb bed")
})

test("a file is called by its own name, not by its path", () => {
  const set = named("the herb bed")
  expect(nameOf({ kind: "document", file: "notes/finishes.md" }, set)).toBe("finishes.md")
  expect(nameOf({ kind: "outline", file: "a/b/garden.olai" }, set)).toBe("garden.olai")
})

test("the pages that are not files are called what a reader calls them", () => {
  const set = named("the herb bed")
  expect(nameOf({ kind: "outline", file: null }, set)).toBe("Home")
  expect(nameOf({ kind: "day", date: "2026-08-18" }, set)).toBe("2026-08-18")
  expect(nameOf({ kind: "today" }, set)).toBe("Today")
  expect(nameOf({ kind: "agenda" }, set)).toBe("Agenda")
  expect(nameOf({ kind: "trash" }, set)).toBe("Trash")
})
