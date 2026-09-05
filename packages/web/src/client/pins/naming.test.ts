/**
 * WHICH GESTURE ASKS FOR A NAME, and what an answer writes.
 *
 * Both are pure over the two facts a door already holds — the route and the
 * shelf the server answered — which is the point of them being here rather than
 * in a key handler: "Enter with nothing is the bare pin" is a rule about a
 * write, and a rule about a write is testable without a browser.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { askingFor, namedEdit, namingFor } from "./naming.ts"
import type { Pin } from "./pins.ts"
import { atNode } from "../routes.ts"

const TRASH = { kind: "trash" } as const
const NARROWED = { kind: "trash", filter: "is:todo" } as const

/** A row of the shelf as `./pins.ts` parses one — spelled here rather than
 *  parsed, because what a rename writes is about the fields it carries. */
const pinned = (over: Partial<Pin> = {}): Pin => ({
  id: "p1",
  title: "/trash?q=is%3Atodo",
  route: NARROWED,
  name: "Trash",
  at: "/trash?q=is%3Atodo",
  bare: "Trash",
  written: false,
  ...over,
})

const wrote = (naming: Parameters<typeof namedEdit>[0], name: string) => {
  const outcome = namedEdit(naming, name)
  if (Result.isFailure(outcome)) {
    throw new Error(`expected a write, and it was refused: ${outcome.failure}`)
  }
  return outcome.success
}

// ── which press asks ───────────────────────────────────────────────────

test("a NARROWED page is asked about — nothing in the set can name a query", () => {
  expect(namingFor(NARROWED, undefined, "Trash"))
    .toEqual({ kind: "pin", at: "/trash?q=is%3Atodo", bare: "Trash" })
})

test("a page with no query pins in one press, exactly as it always did", () => {
  // Its name is derived and live — the node's own title, the file's own
  // filename, the word Trash — so there is nothing to ask.
  expect(namingFor(TRASH, undefined, "Trash")).toBeNull()
  expect(namingFor(atNode("herbs"), undefined, "the herb bed")).toBeNull()
})

test("a page already on the shelf is never asked: that press is an UNPIN", () => {
  // The door resolves that once and hands it over — the same answer its label
  // is drawn from (`./pins.ts`'s `pinnedAt`, which compares through the
  // bijection, so a shelf spelling the query by hand is the same door).
  expect(namingFor(NARROWED, pinned(), "Trash")).toBeNull()
})

// ── what the box says ──────────────────────────────────────────────────

test("the box opens EMPTY over a derived name, and holds a written one", () => {
  // A derived name typed into the box would be a copy one Enter away from
  // being stored — which is the one thing the shelf's storage design refuses.
  expect(askingFor({ kind: "pin", at: "/trash?q=x", bare: "Trash" }))
    .toMatchObject({ kind: "line", initial: "", placeholder: "Trash", label: "Pin" })
  expect(askingFor({ kind: "rename", pin: pinned() }))
    .toMatchObject({ initial: "", placeholder: "Trash", label: "Rename" })
  expect(askingFor({ kind: "rename", pin: pinned({ name: "What is late", written: true }) }))
    .toMatchObject({ initial: "What is late", placeholder: "Trash" })
  // …and what it WRITES rides on the question, so the palette answers a line
  // without knowing it is about a pin.
  expect(askingFor({ kind: "rename", pin: pinned() }).resolve("What is late"))
    .toEqual(Result.succeed({
      verb: "title",
      id: "p1",
      title: "[What is late](/trash?q=is%3Atodo)",
      was: "/trash?q=is%3Atodo",
    }))
})

// ── what an answer writes ──────────────────────────────────────────────

test("a name typed at pin time rides on the ONE op the gesture already sent", () => {
  expect(wrote({ kind: "pin", at: "/trash?q=is%3Atodo", bare: "Trash" }, "What is late"))
    .toEqual({ verb: "pin", at: "/trash?q=is%3Atodo", name: "What is late" })
})

test("Enter with nothing is the BARE pin — the write this app always made", () => {
  for (const nothing of ["", "   "]) {
    expect(wrote({ kind: "pin", at: "/trash?q=is%3Atodo", bare: "Trash" }, nothing))
      .toEqual({ verb: "pin", at: "/trash?q=is%3Atodo" })
  }
})

test("a rename is `set_title` on the pin's own row, keeping the address", () => {
  // The address as the FILE holds it, not the one this app would mint: the
  // gesture was about the name.
  expect(wrote({ kind: "rename", pin: pinned({ at: "/trash?q=is:todo", title: "/trash?q=is:todo" }) }, "What is late"))
    .toEqual({ verb: "title", id: "p1", title: "[What is late](/trash?q=is:todo)", was: "/trash?q=is:todo" })
})

test("typing the name away puts the BARE address back — one box does all three", () => {
  expect(wrote({ kind: "rename", pin: pinned({ name: "What is late", title: "[What is late](/trash?q=is%3Atodo)", written: true }) }, ""))
    .toEqual({ verb: "title", id: "p1", title: "/trash?q=is%3Atodo", was: "[What is late](/trash?q=is%3Atodo)" })
})

test("a name the link cannot hold is refused HERE, where the title is spelled", () => {
  const outcome = namedEdit({ kind: "rename", pin: pinned() }, "late] things")
  expect(Result.isFailure(outcome)).toBe(true)
  // The server's own sentence, from the function that spells both titles — so
  // the two faces cannot refuse in two different words.
  if (Result.isFailure(outcome)) expect(outcome.failure).toContain("]")
})
