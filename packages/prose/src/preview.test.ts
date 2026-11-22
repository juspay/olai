/** The shortcut that draws a note's first line before the parser has loaded:
 *  what its raw wikilink scan reads as one link, and that the line it makes is
 *  the line the parse makes, over every real text this repository holds. */
import { describe, expect, test } from "bun:test"

import { fixtureRows, realDocuments } from "./corpus.testlib.ts"
import { previewLine } from "./preview.ts"
import { read } from "./read.ts"
import { wikilinksIn } from "./shown.ts"

describe("the forms a wikilink is written in", () => {
  const forms: ReadonlyArray<readonly [string, { target: string; fragments: ReadonlyArray<string>; shown: string; embed: boolean; alias: string | null; name: string }]> = [
    ["[[Note]]", { target: "Note", fragments: [], shown: "Note", embed: false, alias: null, name: "Note" }],
    ["[[folder/Note]]", { target: "folder/Note", fragments: [], shown: "folder/Note", embed: false, alias: null, name: "folder/Note" }],
    ["[[Note.md]]", { target: "Note.md", fragments: [], shown: "Note.md", embed: false, alias: null, name: "Note.md" }],
    ["[[Note|the note]]", { target: "Note", fragments: [], shown: "the note", embed: false, alias: "the note", name: "Note" }],
    ["[[Note\\|the note]]", { target: "Note", fragments: [], shown: "the note", embed: false, alias: "the note", name: "Note" }],
    ["[[Note#Heading]]", { target: "Note", fragments: ["Heading"], shown: "Note > Heading", embed: false, alias: null, name: "Note#Heading" }],
    ["[[#Heading]]", { target: "", fragments: ["Heading"], shown: "Heading", embed: false, alias: null, name: "#Heading" }],
    ["[[Note#A#B]]", { target: "Note", fragments: ["A", "B"], shown: "Note > A > B", embed: false, alias: null, name: "Note#A#B" }],
    ["[[Note#^block]]", { target: "Note", fragments: ["^block"], shown: "Note > ^block", embed: false, alias: null, name: "Note#^block" }],
    ["![[picture.png]]", { target: "picture.png", fragments: [], shown: "picture.png", embed: true, alias: null, name: "picture.png" }],
    ["![[picture.png|200]]", { target: "picture.png", fragments: [], shown: "200", embed: true, alias: "200", name: "picture.png" }],
    ["![[Note]]", { target: "Note", fragments: [], shown: "Note", embed: true, alias: null, name: "Note" }],
    ["![[Note#Heading]]", { target: "Note", fragments: ["Heading"], shown: "Note > Heading", embed: true, alias: null, name: "Note#Heading" }],
    ["[[report.pdf]]", { target: "report.pdf", fragments: [], shown: "report.pdf", embed: false, alias: null, name: "report.pdf" }],
    ["[[house.olai#kitchen]]", { target: "house.olai", fragments: ["kitchen"], shown: "house.olai > kitchen", embed: false, alias: null, name: "house.olai#kitchen" }],
    ["[[ spaced name | the words ]]", { target: "spaced name", fragments: [], shown: "the words", embed: false, alias: "the words", name: "spaced name" }],
  ]
  for (const [written, want] of forms) {
    test(`${written} reads as one link`, () => {
      const found = wikilinksIn(`before ${written} after`)
      expect(found).toHaveLength(1)
      const [link] = found
      expect({ target: link!.target, fragments: link!.fragments, shown: link!.shown, embed: link!.embed, alias: link!.alias, name: link!.name }).toEqual(want)
      expect(`before ${written} after`.slice(link!.start, link!.end)).toBe(written)
    })
  }

  test("several links on a line are read in order", () => {
    expect(wikilinksIn("[[a]] and ![[b.png]] then [[c|d]]").map(one => one.name)).toEqual(["a", "b.png", "c"])
  })

  test("the innermost opening brackets start the link", () => {
    expect(wikilinksIn("[[[x]]]").map(one => one.name)).toEqual(["x"])
    expect(wikilinksIn("[[a [[b]]").map(one => one.name)).toEqual(["b"])
  })

  test("a link in a list item or a quote is a link", () => {
    expect(wikilinksIn("- see [[finishes]]\n> and [[palette]]").map(one => one.name)).toEqual(["finishes", "palette"])
  })
})

describe("what is not a link", () => {
  const not: ReadonlyArray<readonly [string, string]> = [
    ["a code span", "see `[[finishes]]` here"],
    ["a double code span", "see ``a [[finishes]] b`` here"],
    ["a fenced block", "```\n[[finishes]]\n```"],
    ["a tilde fence", "~~~md\n[[finishes]]\n~~~"],
    ["an indented block", "para\n\n    [[finishes]]"],
    ["after a backslash", "\\[[finishes]]"],
    ["unclosed", "[[finishes"],
    ["closed by one bracket", "[[finishes]"],
    ["empty", "[[]]"],
    ["blank", "[[   ]]"],
    ["only an alias", "[[|words]]"],
    ["only a hash", "[[#]]"],
    ["split across lines", "[[fini\nshes]]"],
    ["a lone bracket inside", "[[fin]shes]]"],
  ]
  for (const [what, text] of not) {
    test(`${what} holds no link`, () => {
      expect(wikilinksIn(text)).toEqual([])
    })
  }

  test("an escaped `!` leaves a plain link, not an embed", () => {
    const [link] = wikilinksIn("\\![[picture.png]]")
    expect(link?.embed).toBe(false)
  })

  test("prose beside code still holds its links", () => {
    expect(wikilinksIn("`[[a]]` and [[b]]\n```\n[[c]]\n```\n[[d]]").map(one => one.name)).toEqual(["b", "d"])
  })
})

describe("arbitrary text", () => {
  const ALPHABET = ["[", "]", "[[", "]]", "|", "#", "!", "\\", "`", "\n", " ", "a", "^", "/"]

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

  test("never throws, and every link it reports is a span of the text", () => {
    const random = seeded(710)
    for (let round = 0; round < 2_000; round++) {
      let text = ""
      const length = Math.floor(random() * 60)
      for (let at = 0; at < length; at++) text += ALPHABET[Math.floor(random() * ALPHABET.length)]
      for (const link of wikilinksIn(text)) {
        const span = text.slice(link.start, link.end)
        expect(span.endsWith("]]")).toBe(true)
        expect(span.startsWith(link.embed ? "![[" : "[[")).toBe(true)
      }
    }
  })

  test("takes linear time on text built to be slow", () => {
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
        for (let round = 0; round < 3; round++) wikilinksIn(text)
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
