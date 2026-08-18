/**
 * The editor's tags are the FORMAT's tags — held here, because the whole point
 * of `./tags.ts` is that it re-declares nothing.
 *
 * Every case below is one the format already decides (`@olai/format`'s
 * `titleParts`): the two sigils, the `@`-inside-a-word rule, the alphabet that
 * lets `#work/olai` be one tag. What is being tested is the ARITHMETIC that
 * turns those parts into offsets a CodeMirror decoration can be hung on — the
 * one thing this file adds and the one thing that could be wrong without
 * anybody noticing, since a decoration one character out looks like a styling
 * bug rather than a parsing one.
 *
 * The plugin around it is not unit-testable without a browser (it is a
 * `ViewPlugin` over a live viewport), and it is held in
 * `features/live_preview_editing.feature` instead, where the assertion is that
 * the pill in the editor and the pill on the row say the same word.
 */

import { expect, test } from "bun:test"

import { tagsIn } from "./tags.ts"

/** What the offsets actually point at, which is the whole question. */
const cut = (text: string): ReadonlyArray<string> =>
  tagsIn(text).map((span) => text.slice(span.from, span.to))

test("a tag's offsets are the characters the tag is written with", () => {
  expect(cut("wire the #kitchen and the #hall")).toEqual(["#kitchen", "#hall"])
  expect(tagsIn("wire the #kitchen").map((span) => span.written)).toEqual(["#kitchen"])
})

test("a tag at either end of the line is found, and so is a line that is only a tag", () => {
  expect(cut("#kitchen first")).toEqual(["#kitchen"])
  expect(cut("last is #hall")).toEqual(["#hall"])
  expect(cut("#hall")).toEqual(["#hall"])
})

test("both sigils, as the format spells them", () => {
  expect(cut("ask @alice about #wiring")).toEqual(["@alice", "#wiring"])
  // Two namespaces: `#alice` and `@alice` are different tags, and the sigil is
  // part of what is drawn.
  expect(cut("@alice and #alice")).toEqual(["@alice", "#alice"])
})

test("what the format says is NOT a tag is not decorated either", () => {
  // An address is an address — `@` is claimed only where a word starts.
  expect(cut("mail srid@srid.ca about it")).toEqual([])
  // A bare sigil is text.
  expect(cut("costs # per metre")).toEqual([])
})

test("the alphabet is the format's, so a path-like tag is one tag", () => {
  expect(cut("filed under #work/olai today")).toEqual(["#work/olai"])
  expect(cut("#a-b_c ends at the space")).toEqual(["#a-b_c"])
})

test("offsets are measured through the text BETWEEN tags, not from the last match", () => {
  // The arithmetic this file exists for: parts rejoin to the string they came
  // from, so a long stretch of prose between two tags has to move the offset
  // by its own length.
  const line = "#one" + " ".repeat(40) + "#two"
  expect(cut(line)).toEqual(["#one", "#two"])
  expect(tagsIn(line)[1]?.from).toBe(44)
})

test("a line with no sigil at all is answered without walking it", () => {
  // The format's own cheap negative, which is why this is asked per line per
  // keystroke without measuring anything.
  expect(tagsIn("nothing to see on this line")).toEqual([])
})
