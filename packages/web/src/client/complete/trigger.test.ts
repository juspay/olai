/**
 * Which widget a line has armed — every rule in `./trigger.ts`, with no
 * browser.
 *
 * The whole point of the trigger being a function of (text, caret) is that
 * these are answerable here: "typing `!` mid-word does nothing" is a sentence
 * about two strings, and asserting it through a browser would be asserting it
 * about a popup instead.
 */

import { expect, test } from "bun:test"

import { triggerIn, written } from "./trigger.ts"

/** The caret at the end of what has been typed — the ordinary case, and the
 *  one every scenario below is about unless it says otherwise. */
const at = (text: string) => triggerIn(text, text.length)

// ── the day widget ─────────────────────────────────────────────────────

test("a bare `!` at the start of a line arms the day widget", () => {
  expect(at("!")).toEqual({ kind: "date", from: 0, query: "" })
})

test("what follows it is the query, spaces and all", () => {
  // `next fri` and `aug 20` are two words: a widget that stopped at the space
  // could read neither.
  expect(at("call mum !next fri")).toEqual({
    kind: "date",
    from: 9,
    query: "next fri",
  })
})

test("an exclamation mark inside a word is punctuation", () => {
  expect(at("done!")).toBeNull()
  expect(at("wow!!")).toBeNull()
})

test("a `!` followed by a space is somebody's punctuation, not a query", () => {
  expect(at("yes ! really")).toBeNull()
})

test("past the cap it is prose with an exclamation mark in it", () => {
  expect(at(`!${"a".repeat(24)}`)).not.toBeNull()
  expect(at(`!${"a".repeat(25)}`)).toBeNull()
})

// ── the tag widget ─────────────────────────────────────────────────────

test("both sigils arm the tag widget, and each says which it is", () => {
  expect(at("sow the basil #ho")).toEqual({
    kind: "tag",
    sigil: "#",
    from: 14,
    query: "ho",
  })
  expect(at("ask @al")).toEqual({ kind: "tag", sigil: "@", from: 4, query: "al" })
})

test("a bare sigil offers the whole list", () => {
  expect(at("#")).toEqual({ kind: "tag", sigil: "#", from: 0, query: "" })
})

test("a space ends a tag outright — the tag alphabet has none", () => {
  expect(at("#home now")).toBeNull()
})

test("a sigil inside a word offers nothing", () => {
  // What the FORMAT reads as a tag here is a wider question (`#` mid-word is
  // still a tag); what this rules out is a popup offering to rewrite the middle
  // of a word somebody is typing.
  expect(at("issue#42")).toBeNull()
  expect(at("srid@srid")).toBeNull()
})

test("an opening bracket opens a word", () => {
  expect(at("(@al")).toEqual({ kind: "tag", sigil: "@", from: 1, query: "al" })
})

// ── the mirror widget ──────────────────────────────────────────────────

test("two brackets arm the node search", () => {
  expect(at("see ((herb")).toEqual({ kind: "mirror", from: 4, query: "herb" })
})

test("one bracket is a bracket", () => {
  expect(at("see (herb")).toBeNull()
})

test("a closing bracket ends it", () => {
  expect(at("((herb)")).toBeNull()
})

// ── which one wins ─────────────────────────────────────────────────────

test("the opener nearest the caret is the one the caret is inside", () => {
  expect(at("#home ((herb")).toEqual({ kind: "mirror", from: 6, query: "herb" })
  expect(at("((herb #ho")).toEqual({ kind: "tag", sigil: "#", from: 7, query: "ho" })
  expect(at("!tomorrow #ho")).toEqual({ kind: "tag", sigil: "#", from: 10, query: "ho" })
})

test("only what is BEFORE the caret counts", () => {
  // The caret sits after `#ho`; the `((herb` was typed earlier in the line and
  // the person is not in it.
  expect(triggerIn("a #ho and ((herb", 5)).toEqual({
    kind: "tag",
    sigil: "#",
    from: 2,
    query: "ho",
  })
})

test("nothing armed is null, not an empty answer", () => {
  expect(at("")).toBeNull()
  expect(at("order the new cabinets")).toBeNull()
})

// ── writing the choice back ────────────────────────────────────────────

test("a tag replaces its own span and leaves the caret after it", () => {
  // No trailing space: a title is verbatim, so the next character is the
  // person's to type.
  const text = "sow the basil #ho"
  const found = at(text)!
  expect(written(text, found, "#home", text.length)).toEqual({
    text: "sow the basil #home",
    caret: 19,
  })
})

test("a tag chosen mid-line keeps what follows the caret", () => {
  const text = "sow #ba in the bed"
  const found = triggerIn(text, 7)!
  expect(written(text, found, "#basil", 7)).toEqual({
    text: "sow #basil in the bed",
    caret: 10,
  })
})

test("a day takes its whole span out, and the line does not end in a space", () => {
  // `!next fri` is not something anybody wants left in a title, and neither is
  // the space that was in front of it.
  const text = "call mum !next fri"
  const found = at(text)!
  expect(written(text, found, "", text.length)).toEqual({
    text: "call mum",
    caret: 8,
  })
})

test("a removal mid-line closes the seam to one space", () => {
  const text = "call ((herb mum"
  const found = triggerIn(text, 11)!
  expect(written(text, found, "", 11)).toEqual({ text: "call mum", caret: 4 })
})

test("a removal that leaves nothing leaves nothing", () => {
  const text = "((herb"
  expect(written(text, at(text)!, "", text.length)).toEqual({ text: "", caret: 0 })
})
