/**
 * Where a machine's sentence ends its own name and starts saying something,
 * over values.
 *
 * The claim under test is the one the face rests on: the attribution a reader
 * sees on a plugin's row is the plugin's FIRST LINE, not a caption this client
 * composed — so the split has to be right about a body nobody here wrote. Every
 * way of getting it wrong is a person reading a label as prose, a paragraph as
 * a label, or a name on a row that nobody put there.
 *
 * Nothing about how it is DRAWN is asserted here: the styling is the panel's
 * and a test that pinned class names would be a test that fails on a palette.
 */

import { describe, expect, test } from "bun:test"

import { bylineOf } from "./byline.ts"

/** A body shaped the way kolu's are — the attribution line, a blank line, then
 *  the account. Spelled once because it is the ordinary case, not a fixture
 *  for one assertion. */
const WOKE = [
  "olai · kolu · wake on terminal activity · 2026-08-31 14:32 UTC",
  "",
  "`54fe62f9` went waiting after 31m working.",
  "Its step is still doing — a report or a block.",
].join("\n")

describe("the byline a machine's sentence opens with", () => {
  test("the first line is the label and the rest is the message", () => {
    expect(bylineOf(WOKE)).toEqual({
      byline: "olai · kolu · wake on terminal activity · 2026-08-31 14:32 UTC",
      body: "`54fe62f9` went waiting after 31m working.\n"
        + "Its step is still doing — a report or a block.",
    })
  })

  test("the blank line under it is the separator, not the first word", () => {
    // The gap kolu leaves belongs to neither half: a body drawn with it still
    // in would open on an empty line under the label.
    expect(bylineOf(WOKE).body.startsWith("`54fe62f9`")).toBe(true)
  })

  test("a body whose second line is already prose splits the same way", () => {
    // One rule, not two: the blank line is a convention of the plugins we have,
    // and a body without one still has a first line that names who is speaking.
    expect(bylineOf("olai · kolu · wake\nthe terminal went quiet")).toEqual({
      byline: "olai · kolu · wake",
      body: "the terminal went quiet",
    })
  })

  test("a one-line body is the message, with no name invented for it", () => {
    // The whole point of reading the name off the sentence: where the sentence
    // does not carry one, the panel does not either.
    expect(bylineOf("the terminal went quiet")).toEqual({
      byline: "",
      body: "the terminal went quiet",
    })
  })

  test("a label with nothing under it stays the message", () => {
    // Otherwise the entire row is chrome: a caption over an empty paragraph.
    expect(bylineOf("olai · kolu · wake\n\n  \n")).toEqual({
      byline: "",
      body: "olai · kolu · wake\n\n  \n",
    })
  })

  test("a body that opens on a blank line has no label to take", () => {
    expect(bylineOf("\nolai · kolu · wake\nthe terminal went quiet").byline)
      .toBe("")
  })

  test("the words are always answered with, whatever the shape", () => {
    // Total on purpose: every arm carries a `body`, so the face can draw the
    // sentence without first asking whether the split worked.
    for (const text of ["", "\n", "one", "one\ntwo", WOKE]) {
      const said = bylineOf(text)
      expect(said.body === "" || text.includes(said.body)).toBe(true)
    }
  })
})
