import { describe, expect, test } from "bun:test"

import { bylineOf } from "./byline.ts"

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
    expect(bylineOf(WOKE).body.startsWith("`54fe62f9`")).toBe(true)
  })

  test("a body whose second line is already prose splits the same way", () => {
    expect(bylineOf("olai · kolu · wake\nthe terminal went quiet")).toEqual({
      byline: "olai · kolu · wake",
      body: "the terminal went quiet",
    })
  })

  test("a one-line body is the message, with no name invented for it", () => {
    expect(bylineOf("the terminal went quiet")).toEqual({
      byline: "",
      body: "the terminal went quiet",
    })
  })

  test("a label with nothing under it stays the message", () => {
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
    for (const text of ["", "\n", "one", "one\ntwo", WOKE]) {
      const said = bylineOf(text)
      expect(said.body === "" || text.includes(said.body)).toBe(true)
    }
  })
})
