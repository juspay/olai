import { expect, test } from "bun:test"

import {
  completed,
  completingIn,
  inserted,
  namedIn,
  tokenOf,
  unnamed,
} from "./completion.ts"

const at = (text: string) => completingIn(text, text.length)

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

test("an `@` that opens a word arms the paths", () => {
  expect(at("@")).toEqual({ kind: "name", from: 0, query: "" })
  expect(at("read @notes/pal")).toEqual({
    kind: "name",
    from: 5,
    query: "notes/pal",
  })
})

test("an `@` inside a word is part of the word", () => {
  expect(at("mail srid@example.com")).toBeNull()
  expect(at("v2@head")).toBeNull()
})

test("a bracket opens a word too, which is what the format says", () => {
  expect(at("(@fin")).toEqual({ kind: "name", from: 1, query: "fin" })
})

test("spaces keep narrowing a name, while a newline or tab ends it", () => {
  expect(at("read @notes and stop")).toEqual({ kind: "name", from: 5, query: "notes and stop" })
  expect(at("read @notes\tnext")).toBeNull()
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
  expect(completingIn("read @fin later", 9)).toEqual({
    kind: "name",
    from: 5,
    query: "fin",
  })
  expect(completingIn("read @fin", 4)).toBeNull()
})

test("a command line's `@` is inside a word, so a command stays a command", () => {
  expect(at("/rev@x")).toEqual({ kind: "command", from: 0, query: "rev@x" })
})

test("a line stops being a command at the space, and an `@` after it is a path", () => {
  expect(at("/review @fin")).toEqual({ kind: "name", from: 8, query: "fin" })
})

test("a dismissal is about a token: the kind and where it starts", () => {
  const first = at("@one")
  const second = at("@one @two")
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(tokenOf(first!)).not.toBe(tokenOf(second!))
})

test("a chosen file keeps its `@` and gains a space", () => {
  expect(inserted("notes/cabinets.md")).toBe("@notes/cabinets.md ")
})

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
  expect(taking("read @fin later", 9, "finishes.md")).toEqual({
    text: "read @finishes.md later",
    caret: 18,
  })
})

test("a caret before a NEWLINE keeps the newline and the space", () => {
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

const TAKEN = new Set(["hinges", "order", "order-2"])

test("a word taken off the list is a node this message names", () => {
  expect(namedIn("look at @hinges before Tuesday", TAKEN)).toEqual(["hinges"])
})

test("...in the order the message names them, which the chips cannot say", () => {
  expect(namedIn("compare @order with @hinges", TAKEN)).toEqual(["order", "hinges"])
  expect(namedIn("@hinges and @hinges again", TAKEN)).toEqual(["hinges"])
})

test("a word nobody took off the list names nothing, whatever it is", () => {
  expect(namedIn("ask @alice about @hinges", TAKEN)).toEqual(["hinges"])
  expect(namedIn("ask @alice about it", TAKEN)).toEqual([])
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

test("a sentence's own punctuation is not part of the name", () => {
  expect(namedIn("look at @hinges, then the doors", TAKEN)).toEqual(["hinges"])
  expect(namedIn("is @hinges? and @order.", TAKEN)).toEqual(["hinges", "order"])
  expect(namedIn("(@hinges)", TAKEN)).toEqual(["hinges"])
})

test("...and what is trimmed is only ever at the END", () => {
  expect(namedIn("read @order-2, please", TAKEN)).toEqual(["order-2"])
  expect(namedIn("read @order.2", TAKEN)).toEqual([])
})

test("the `×` leaves the punctuation, which was the sentence's and not the name's", () => {
  expect(unnamed("look at @hinges, then", "hinges", 21))
    .toEqual({ text: "look at , then", caret: 14 })
})

test("a completion writes no space in front of the sentence's own punctuation", () => {
  expect(taking("look at @hin, then", 12, "hinges")).toEqual({
    text: "look at @hinges, then",
    caret: 16,
  })
})

test("...however many marks the sentence put there", () => {
  expect(taking("(@hin)!", 5, "hinges")).toEqual({ text: "(@hinges)!", caret: 10 })
})

test("two names run together name neither, and that is the edges-only rule", () => {
  expect(namedIn("@hinges,@order", TAKEN)).toEqual([])
  expect(namedIn("@hinges, @order", TAKEN)).toEqual(["hinges", "order"])
})


test("a multi-word title replaces only the query before the caret", () => {
  const text = "discuss @Odu watcher scope, please"
  const caret = text.indexOf(",")
  expect(taking(text, caret, "odu-task")).toEqual({
    text: "discuss @odu-task, please",
    caret: "discuss @odu-task,".length,
  })
})
