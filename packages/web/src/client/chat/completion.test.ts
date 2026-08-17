/**
 * What the message box has armed — every rule in `./completion.ts`, with no
 * browser.
 *
 * The whole point of the trigger being a function of (text, caret) is that
 * these are answerable here: "an `@` inside an address arms nothing" is a
 * sentence about two strings, and asserting it through a popup would be
 * asserting it about a popup.
 */

import { expect, test } from "bun:test"

import { completingIn, inserted, tokenOf } from "./completion.ts"

/** The caret at the end of what has been typed — the ordinary case, and the
 *  one every test below is about unless it says otherwise. */
const at = (text: string) => completingIn(text, text.length)

// ── the command list ───────────────────────────────────────────────────

test("a `/` that starts the line arms the commands", () => {
  expect(at("/")).toEqual({ kind: "command", from: 0, query: "" })
  expect(at("/rev")).toEqual({ kind: "command", from: 0, query: "rev" })
})

test("a slash anywhere else is a slash", () => {
  expect(at("read src/main.ts")).toBeNull()
  expect(at("and/or")).toBeNull()
})

test("a command ends at its first space — what follows is its argument", () => {
  expect(at("/review the outline")).toBeNull()
})

// ── the file list ──────────────────────────────────────────────────────

test("an `@` that opens a word arms the paths", () => {
  expect(at("@")).toEqual({ kind: "path", from: 0, query: "" })
  expect(at("read @notes/pal")).toEqual({
    kind: "path",
    from: 5,
    query: "notes/pal",
  })
})

test("an `@` inside a word is part of the word", () => {
  // The one collision worth naming: an address is not a completion, and the
  // rule is the format's own (`tagOpensAt`), which is why it is not respelled.
  expect(at("mail srid@example.com")).toBeNull()
  expect(at("v2@head")).toBeNull()
})

test("a bracket opens a word too, which is what the format says", () => {
  expect(at("(@fin")).toEqual({ kind: "path", from: 1, query: "fin" })
})

test("whitespace ends it, so prose never runs away into a path", () => {
  expect(at("read @notes and stop")).toBeNull()
  expect(at("read @notes\nnext line")).toBeNull()
})

test("the `@` nearest the caret is the one being typed", () => {
  expect(at("@one and @two")).toEqual({ kind: "path", from: 9, query: "two" })
})

test("past the cap it is not a path any more", () => {
  expect(at(`@${"a".repeat(120)}`)).not.toBeNull()
  expect(at(`@${"a".repeat(121)}`)).toBeNull()
})

test("what is armed is read at the CARET, not at the end of the line", () => {
  // Somebody who clicked back into a sentence is completing the word they are
  // in, and the words after it are not part of the query.
  expect(completingIn("read @fin later", 9)).toEqual({
    kind: "path",
    from: 5,
    query: "fin",
  })
  // ...and a caret before the `@` is not inside it at all.
  expect(completingIn("read @fin", 4)).toBeNull()
})

// ── the two cannot both be armed ───────────────────────────────────────

test("a command line's `@` is inside a word, so a command stays a command", () => {
  expect(at("/rev@x")).toEqual({ kind: "command", from: 0, query: "rev@x" })
})

test("a line stops being a command at the space, and an `@` after it is a path", () => {
  expect(at("/review @fin")).toEqual({ kind: "path", from: 8, query: "fin" })
})

// ── dismissal, and what taking a row writes ────────────────────────────

test("a dismissal is about a token: the kind and where it starts", () => {
  // Two `@`s on one line are two offers, and Escape over the first must not
  // shut the second.
  const first = at("@one")
  const second = at("@one @two")
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(tokenOf(first!)).not.toBe(tokenOf(second!))
})

test("a chosen file keeps its `@` and gains a space", () => {
  expect(inserted("notes/cabinets.md")).toBe("@notes/cabinets.md ")
})
