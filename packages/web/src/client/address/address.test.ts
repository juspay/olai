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

import { expect, test } from "bun:test"

import type { Names } from "../names.ts"
import { atFile, atNode, HOME_ROUTE, hrefOf, routeIn } from "../routes.ts"
import { ROUTES } from "../routes.testlib.ts"
import { addressIn, labelIn, nameOf, shownIn } from "./address.ts"

// ── what is an address ─────────────────────────────────────────────────

test("an address this app would mint is a pin, whatever page it names", () => {
  for (const address of [
    "/#herbs",
    "/notes/finishes.md",
    "/garden.olai",
    "/d/2026-08-18",
    "/today",
    "/agenda",
    "/trash",
    "/",
  ]) {
    expect(hrefOf(addressIn(address)!)).toBe(address)
  }
})

// Finding 4's (a), held where it can fail: the delegation IS the reading.
// `addressIn` adds NOTHING of its own to "is this string one of our
// addresses, and which page" — it only decides whether a TITLE is carrying
// an address at all (the first character, the prose rules, the markdown
// bracket); the ADDRESS half of every answer is the door's. So it is asked
// of the SHARED vocabulary — `../routes.testlib.ts`'s table, the same one
// the bijection is held to: a new computed page is this test's the day it is
// the bijection's, and a new file kind the day the registry claims it —
// instead of being asked of a hand list that could rot beside it. A
// recognizer grown back inside a title reader diverges from the markdown
// LINK readers (`../router.tsx`) the day a page moves, and this test names
// the exact spelling where.
test("a title carrying an address gets the link's own answer — one grammar, one door", () => {
  const addresses = ROUTES.map(hrefOf)
  // Every one of these is a link the app mints, so the door recognizes each —
  // the `?? undefined` never fires; it lines the door's `null` up with a
  // title's `undefined`, so the two lists compare like to like.
  const doors = addresses.map((address) => {
    expect(routeIn(address)).not.toBeNull()
    return routeIn(address) ?? undefined
  })
  expect(addresses.map((address) => addressIn(address))).toEqual(doors)
  expect(addresses.map((address) => addressIn(`[named it](${address})`))).toEqual(doors)
  for (const address of ["/etc/passwd", "/notes and things", "/%"]) {
    expect(routeIn(address)).toBeNull()
    expect(addressIn(address)).toBeUndefined()
    expect(addressIn(`[named it](${address})`)).toBeUndefined()
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
  for (const title of ["/%", "/%ZZ.md", "/%2.olai", "[x](/%)"]) {
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
  expect(addressIn("[](/#herbs)")).toEqual(atNode("herbs"))
})

test("prose either side of a link is a sentence, not a pin", () => {
  // A row of `Pins.olai` may be a note about the shelf. Reading one as a door
  // would put a sentence in the sidebar.
  expect(addressIn("see [the agenda](/agenda) tomorrow")).toBeUndefined()
})

// ── and what the outline draws a face for ──────────────────────────────

test("both spellings name the same place — the label is the only difference", () => {
  // One rule for both, because the difference between them is a NAME rather
  // than a destination (human, 2026-08-19).
  expect(addressIn("/#herbs")).toEqual(atNode("herbs"))
  expect(addressIn("[the herb bed](/#herbs)")).toEqual(atNode("herbs"))
  expect(addressIn("buy milk")).toBeUndefined()
})

test("the label somebody wrote is a name; a blank one is not", () => {
  expect(labelIn("[What is late](/agenda?q=is%3Atodo)")).toBe("What is late")
  expect(labelIn("[](/#herbs)")).toBeUndefined()
  expect(labelIn("/#herbs")).toBeUndefined()
})


// ── what a place is called ─────────────────────────────────────────────
//
// The switch is PURE: exactly one address is not called what it says it is —
// a node, which is called whatever that node is called right now — so that
// one fact is handed in. Who asks it is the caller's, and the two callers ask
// it on opposite sides of the wire (the shelf's is the server's answer, an
// outline row's is `shownIn` below).

test("a node address is called whatever that node is called right now", () => {
  expect(nameOf(atNode("herbs"), "the herb bed")).toBe("the herb bed")
  // The same address, after somebody renamed the node somewhere else entirely.
  expect(nameOf(atNode("herbs"), "the herb spiral")).toBe("the herb spiral")
})

test("an address nobody can name says the address rather than a blank", () => {
  expect(nameOf(atNode("gone"), undefined)).toBe("/#gone")
})

test("a file is called by its own name, not by its path", () => {
  expect(nameOf(atFile("notes/finishes.md"), undefined)).toBe("finishes.md")
  expect(nameOf(atFile("a/b/garden.olai"), undefined)).toBe("garden.olai")
})

test("the pages that are not files are called what a reader calls them", () => {
  expect(nameOf(HOME_ROUTE, undefined)).toBe("Home")
  expect(nameOf({ kind: "day", date: "2026-08-18" }, undefined)).toBe("2026-08-18")
  expect(nameOf({ kind: "today" }, undefined)).toBe("Today")
  expect(nameOf({ kind: "agenda" }, undefined)).toBe("Agenda")
  expect(nameOf({ kind: "trash" }, undefined)).toBe("Trash")
})

// ── the lookup, over the names the page was sent with ──────────────────
//
// What an id NAMES is the server's answer now (`@olai/format`'s `page.ts`
// resolves every id a page points at, through the same `nodeNamed` this used
// to call locally). What is left here is the reading of that table against an
// address — which arm of the route asks a question about the set at all.

const named = (title: string): Names => (id) =>
  id === "herbs" ? { id: "herbs", title, file: "garden.olai" } : undefined

test("a node address asked of the page's names is that node's title", () => {
  expect(shownIn(named("the herb bed"), atNode("herbs"))).toBe("the herb bed")
  expect(shownIn(named("the herb spiral"), atNode("herbs"))).toBe("the herb spiral")
})

test("nothing to say, said the same way three times", () => {
  // An id the table does not hold — nothing declares it, or the page does not
  // point at it — and two addresses that are not a node's at all.
  expect(shownIn(named("the herb bed"), atNode("gone"))).toBeUndefined()
  expect(shownIn(named("the herb bed"), atFile("notes/finishes.md"))).toBeUndefined()
  expect(shownIn(named("the herb bed"), { kind: "agenda" })).toBeUndefined()
})
