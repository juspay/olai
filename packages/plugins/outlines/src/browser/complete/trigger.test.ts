import { expect, test } from "bun:test"

import { sameTrigger, triggerIn, written } from "./trigger.ts"

const at = (text: string) => triggerIn(text, text.length)

test("a bare `!` at the start of a line arms the day widget", () => {
  expect(at("!")).toEqual({ kind: "date", from: 0, query: "" })
})

test("what follows it is the query, spaces and all", () => {
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
  expect(at("issue#42")).toBeNull()
  expect(at("srid@srid")).toBeNull()
})

test("an opening bracket opens a word", () => {
  expect(at("(@al")).toEqual({ kind: "tag", sigil: "@", from: 1, query: "al" })
})

test("two brackets arm the node search", () => {
  expect(at("see ((herb")).toEqual({ kind: "mirror", from: 4, query: "herb" })
})

test("one bracket is a bracket", () => {
  expect(at("see (herb")).toBeNull()
})

test("a closing bracket ends it", () => {
  expect(at("((herb)")).toBeNull()
})

test("the opener nearest the caret is the one the caret is inside", () => {
  expect(at("#home ((herb")).toEqual({ kind: "mirror", from: 6, query: "herb" })
  expect(at("((herb #ho")).toEqual({ kind: "tag", sigil: "#", from: 7, query: "ho" })
  expect(at("!tomorrow #ho")).toEqual({ kind: "tag", sigil: "#", from: 10, query: "ho" })
})

test("only what is BEFORE the caret counts", () => {
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

test("a tag replaces its own span and leaves the caret after it", () => {
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

test("the caret moving inside one tag is the same offer", () => {
  const text = "a #herb"
  expect(sameTrigger(triggerIn(text, 7), triggerIn(text, 7))).toBe(true)
})

test("a character typed into the query is a new offer", () => {
  expect(sameTrigger(at("a #her"), at("a #herb"))).toBe(false)
})

test("the same query under a different sigil is a new offer", () => {
  expect(sameTrigger(at("a #ho"), at("a @ho"))).toBe(false)
})

test("the same query at a different place in the line is a new offer", () => {
  expect(sameTrigger(at("#ho"), at("x #ho"))).toBe(false)
})

test("the same query under a different widget is a new offer", () => {
  expect(sameTrigger(at("!fri"), at("#fri"))).toBe(false)
})

test("nothing armed is the same as nothing armed", () => {
  expect(sameTrigger(null, null)).toBe(true)
  expect(sameTrigger(null, at("#ho"))).toBe(false)
  expect(sameTrigger(at("#ho"), null)).toBe(false)
})
