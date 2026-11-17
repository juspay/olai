/**
 * WHICH CHAT IS AT A PLACE, as the server reads it.
 *
 * The grammar itself — what `[house](/house.olai)` and `/#kitchen` spell — is
 * `@olai/format`'s and is argued there. What is this module's, and what is
 * asked here, is the ONE FACT A TITLE CANNOT CARRY: whether the place is still
 * there. A file the set no longer holds and a row id nothing answers to stand
 * for nothing, so their chat rows are ordinary chats again.
 */
import { expect, test } from "bun:test"

import { readingOf, setOf } from "@olai/ops/testlib"

import { aboutIn, chatsIn, placeIn } from "./places.ts"

/** One outline with one row in it, and one document beside it. */
const vault = () =>
  readingOf(setOf(
    { "house.olai": '{"id":"kitchen","title":"kitchen remodel","ord":"a0"}\n' },
    ["notes/plan.md"],
  ))

test("a title around a file's address stands for that file, by either spelling", () => {
  const reading = vault()
  expect(placeIn(reading, "[house](/house.olai)")).toEqual({ kind: "file", path: "house.olai" })
  expect(placeIn(reading, "/notes/plan.md")).toEqual({ kind: "file", path: "notes/plan.md" })
})

test("the three ways to write a row are one place", () => {
  const reading = vault()
  // A row is its id and nothing else: the outline it is landed in and whether
  // the reader was zoomed are not part of which row somebody is talking about.
  for (const title of ["/#kitchen", "/zoom/#kitchen", "/house.olai#kitchen", "[kitchen](/#kitchen)"]) {
    expect(placeIn(reading, title)).toEqual({ kind: "row", id: "kitchen" })
  }
})

test("a page that is neither a file nor a row is its own path", () => {
  expect(placeIn(vault(), "[Swatch](/plugins/swatch)")).toEqual({ kind: "page", href: "/plugins/swatch" })
})

test("a place this reading does not hold stands for nothing", () => {
  const reading = vault()
  // A deleted file and a row id nothing answers to: the title still parses,
  // and there is no longer anything at it to be the chat of.
  expect(placeIn(reading, "[house](/gone.olai)")).toBeNull()
  expect(placeIn(reading, "/#nowhere")).toBeNull()
  // ...and prose is prose.
  expect(placeIn(reading, "kitchen remodel")).toBeNull()
})

test("a row's own chat wins the row over a stand-in for it", () => {
  const rows = [
    { id: "chat-a", title: "[kitchen](/#kitchen)" },
    { id: "kitchen", title: "kitchen remodel" },
  ]
  const chats = chatsIn(vault(), rows)
  expect(chats.at({ kind: "row", id: "kitchen" })?.id).toBe("kitchen")
  // The loser is an ordinary chat row again, standing for itself.
  expect(chats.standsIn({ id: "chat-a" })).toBe(false)
  expect(chats.of({ id: "chat-a" })).toEqual({ kind: "row", id: "chat-a" })
})

test("between two stand-ins for one place the first in roster order wins", () => {
  const reading = vault()
  const rows = [
    { id: "chat-a", title: "[house](/house.olai)" },
    { id: "chat-b", title: "/house.olai" },
  ]
  const chats = chatsIn(reading, rows)
  expect(chats.at({ kind: "file", path: "house.olai" })?.id).toBe("chat-a")
  expect(chats.standsIn({ id: "chat-a" })).toBe(true)
  expect(chats.standsIn({ id: "chat-b" })).toBe(false)
  // What the winner's first message says it is about, and the loser's silence.
  expect(aboutIn(reading, rows, rows[0]!)).toBe("/house.olai")
  expect(aboutIn(reading, rows, rows[1]!)).toBeNull()
})
