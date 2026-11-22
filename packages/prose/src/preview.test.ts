/** The shortcut that draws a note's first line before the parser has loaded:
 *  what one line's wikilinks show, and that the line it makes is the line the
 *  parse makes, over every real text this repository holds. */
import { describe, expect, test } from "bun:test"

import { fixtureRows, realDocuments } from "./corpus.testlib.ts"
import { previewLine } from "./preview.ts"
import { read } from "./read.ts"
import { wikilinksShown } from "./shown.ts"

describe("what a line's wikilinks show", () => {
  // The forms themselves are `./wikilink.test.ts`'s, which holds the one
  // reader of what is between the brackets. What is tested here is the other
  // half: where a line's brackets are, and what stands in their place.
  const shows: ReadonlyArray<readonly [string, string]> = [
    ["[[Note]]", "Note"],
    ["[[Note|the note]]", "the note"],
    ["[[Note\\|the note]]", "the note"],
    ["[[Note#Heading]]", "Note > Heading"],
    ["[[#Heading]]", "Heading"],
    ["![[picture.png]]", "picture.png"],
    ["![[picture.png|200]]", "200"],
    ["[[ spaced name | the words ]]", "the words"],
  ]
  for (const [written, shown] of shows) {
    test(`${written} shows its words`, () => {
      expect(wikilinksShown(`before ${written} after`)).toBe(`before ${shown} after`)
    })
  }

  test("several links on a line are all replaced, in order", () => {
    expect(wikilinksShown("[[a]] and ![[b.png]] then [[c|d]]")).toBe("a and b.png then d")
  })

  test("the innermost opening brackets start the link", () => {
    expect(wikilinksShown("[[[x]]]")).toBe("[x]")
    expect(wikilinksShown("[[a [[b]]")).toBe("[[a b")
  })
})

describe("what is not a link stays as it is written", () => {
  const not: ReadonlyArray<readonly [string, string]> = [
    ["a code span", "see `[[finishes]]` here"],
    ["a double code span", "see ``a [[finishes]] b`` here"],
    ["after a backslash", "\\[[finishes]]"],
    ["unclosed", "[[finishes"],
    ["closed by one bracket", "[[finishes]"],
    ["empty", "[[]]"],
    ["blank", "[[   ]]"],
    ["only an alias", "[[|words]]"],
    ["only a hash", "[[#]]"],
    ["a lone bracket inside", "[[fin]shes]]"],
  ]
  for (const [what, line] of not) {
    test(`${what} is left alone`, () => {
      expect(wikilinksShown(line)).toBe(line)
    })
  }

  test("an escaped `!` leaves a plain link, not an embed", () => {
    expect(wikilinksShown("\\![[picture.png]]")).toBe("\\!picture.png")
  })

  test("prose beside a code span still shows its links", () => {
    expect(wikilinksShown("`[[a]]` and [[b]]")).toBe("`[[a]]` and b")
  })
})

describe("arbitrary lines", () => {
  const ALPHABET = ["[", "]", "[[", "]]", "|", "#", "!", "\\", "`", " ", "a", "^", "/"]

  /** A repeatable stream of numbers — the same shapes every run, so a failure
   *  here is a failure anybody can read back. */
  const seeded = (seed: number): (() => number) => {
    let at = seed >>> 0
    return () => {
      at = (at + 0x6D2B79F5) | 0
      let mixed = Math.imul(at ^ (at >>> 15), 1 | at)
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
  }

  test("never throws, and leaves a line with no closed brackets as it is", () => {
    const random = seeded(710)
    for (let round = 0; round < 2_000; round++) {
      let line = ""
      const length = Math.floor(random() * 60)
      for (let at = 0; at < length; at++) line += ALPHABET[Math.floor(random() * ALPHABET.length)]
      const shown = wikilinksShown(line)
      if (!line.includes("]]")) expect(shown).toBe(line)
    }
  })

  test("takes linear time on a line built to be slow", () => {
    const shapes = [
      (n: number) => "[[".repeat(n),
      (n: number) => "[[a".repeat(n),
      (n: number) => "[[a|".repeat(n) + "]]",
      (n: number) => "\\".repeat(n) + "[[a]]",
      (n: number) => "[[a#".repeat(n) + "]]",
      (n: number) => "`[[".repeat(n),
      (n: number) => "![[a]]".repeat(n),
    ]
    for (const shape of shapes) {
      const time = (n: number): number => {
        const text = shape(n)
        const started = performance.now()
        for (let round = 0; round < 3; round++) wikilinksShown(text)
        return performance.now() - started
      }
      time(5_000)
      const small = Math.max(time(20_000), 1)
      const large = time(160_000)
      // Eight times the text: linear work is about eight times the time, and
      // quadratic work would be sixty-four.
      expect(large / small).toBeLessThan(30)
    }
  })
})

// ── the shortcut, held to the parse ────────────────────────────────────

/**
 * THE RULE THIS FILE EXISTS FOR: a shortcut lives here only beside a test that
 * holds it equal to the parse over the fixture directories. The line a note
 * shows under a row is `read`'s first line, written without the parser.
 */
test("the first line of every fixture note and docs page is the line the parse draws", () => {
  const texts = [
    ...fixtureRows().filter((row) => row.field === "desc"),
    ...realDocuments(),
  ]
  expect(texts.length).toBeGreaterThan(50)
  for (const one of texts) {
    expect([one.from, previewLine(one.text)]).toEqual([one.from, read(one.text).firstLine])
  }
})
