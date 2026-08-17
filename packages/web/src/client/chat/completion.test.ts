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

import {
  completed,
  completingIn,
  inserted,
  namedIn,
  tokenOf,
  unnamed,
} from "./completion.ts"

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
  expect(at("@")).toEqual({ kind: "name", from: 0, query: "" })
  expect(at("read @notes/pal")).toEqual({
    kind: "name",
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
  expect(at("(@fin")).toEqual({ kind: "name", from: 1, query: "fin" })
})

test("whitespace ends it, so prose never runs away into a path", () => {
  expect(at("read @notes and stop")).toBeNull()
  expect(at("read @notes\nnext line")).toBeNull()
})

test("the `@` nearest the caret is the one being typed", () => {
  expect(at("@one and @two")).toEqual({ kind: "name", from: 9, query: "two" })
})

test("past the cap it is not a path any more", () => {
  expect(at(`@${"a".repeat(120)}`)).not.toBeNull()
  expect(at(`@${"a".repeat(121)}`)).toBeNull()
})

test("what is armed is read at the CARET, not at the end of the line", () => {
  // Somebody who clicked back into a sentence is completing the word they are
  // in, and the words after it are not part of the query.
  expect(completingIn("read @fin later", 9)).toEqual({
    kind: "name",
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
  expect(at("/review @fin")).toEqual({ kind: "name", from: 8, query: "fin" })
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

/** Taking a row, over the whole line: what the message reads afterwards and
 *  where the caret is. `at(...)` is the trigger the caret is inside, which is
 *  what the composer hands this. */
const taking = (text: string, caret: number, path: string) => {
  const armed = completingIn(text, caret)
  expect(armed).not.toBeNull()
  return completed(text, armed!, path, caret)
}

test("taking a row at the end of the message writes the path and a space", () => {
  expect(taking("read @fin", 9, "finishes.md")).toEqual({
    text: "read @finishes.md ",
    caret: 18,
  })
})

test("...and MID-SENTENCE writes one space, not two", () => {
  // The space that separates the path from the next word is already there, and
  // a completion that added a second one would be editing somebody's spacing.
  expect(taking("read @fin later", 9, "finishes.md")).toEqual({
    text: "read @finishes.md later",
    caret: 18,
  })
})

test("a caret before a NEWLINE keeps the newline and the space", () => {
  // Swallowing it would join two lines a person wrote apart; a trailing space
  // at the end of a line is nothing anybody sees.
  expect(taking("read @fin\nthen this", 9, "finishes.md")).toEqual({
    text: "read @finishes.md \nthen this",
    caret: 18,
  })
})

test("only ONE space is given up, however many are there", () => {
  expect(taking("read @fin  later", 9, "finishes.md")).toEqual({
    text: "read @finishes.md  later",
    caret: 18,
  })
})

test("the whole span goes, `@` and all, wherever it starts", () => {
  expect(taking("@fin", 4, "notes/cabinets.md")).toEqual({
    text: "@notes/cabinets.md ",
    caret: 19,
  })
})

// ── what the message still names ───────────────────────────────────────
//
// The other direction: the panel reading back the words it wrote itself, which
// is what keeps a chip from outliving the word that put it there. It can only
// ever recognise ids ALREADY TAKEN off the list — a set in, so a word somebody
// typed can never become a claim about their message.

const TAKEN = new Set(["hinges", "order", "order-2"])

test("a word taken off the list is a node this message names", () => {
  expect(namedIn("look at @hinges before Tuesday", TAKEN)).toEqual(["hinges"])
})

test("...in the order the message names them, which the chips cannot say", () => {
  expect(namedIn("compare @order with @hinges", TAKEN)).toEqual(["order", "hinges"])
  // Named twice, meant once.
  expect(namedIn("@hinges and @hinges again", TAKEN)).toEqual(["hinges"])
})

test("a word nobody took off the list names nothing, whatever it is", () => {
  // The whole of the promise that this is not a parser of prose: a set can
  // declare a node with the id `alice` and `@alice` is still a person, because
  // nobody took that row. Only what this box wrote is read back.
  expect(namedIn("ask @alice about @hinges", TAKEN)).toEqual(["hinges"])
  expect(namedIn("ask @alice about it", TAKEN)).toEqual([])
  // ...and nothing at all is read back before a row has ever been taken, which
  // is every message anybody has typed until they use the list.
  expect(namedIn("ask @alice about @hinges", new Set())).toEqual([])
})

test("an `@` inside a word is part of the word here too", () => {
  expect(namedIn("mail srid@hinges.com about it", TAKEN)).toEqual([])
})

test("a word that merely starts with a taken id is not that id", () => {
  expect(namedIn("look at @hinges-later", TAKEN)).toEqual([])
})

test("the `×` takes the word out, and the space the completion wrote with it", () => {
  expect(unnamed("look at @hinges before Tuesday", "hinges", 30)).toEqual({
    text: "look at before Tuesday",
    caret: 22,
  })
})

test("...every one of them, since a message that says it twice means it once", () => {
  expect(unnamed("@order and @order", "order", 17)).toEqual({ text: "and ", caret: 4 })
})

test("...and only the whole word, never the start of another id", () => {
  expect(unnamed("@order-2 stays", "order", 14))
    .toEqual({ text: "@order-2 stays", caret: 14 })
})

test("a caret before what came out does not move", () => {
  expect(unnamed("here @hinges there", "hinges", 4))
    .toEqual({ text: "here there", caret: 4 })
})
