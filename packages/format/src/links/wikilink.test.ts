/** Wikilinks: what the preview line's scan reads as one, and which file a
 *  name finds. */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"

import { read } from "@olai/prose/read.ts"
import { type Address, printAddress } from "../address.ts"
import { wikilinksIn } from "../documents.ts"
import { seeded } from "../fixtures.testlib.ts"
import { namesIn } from "./names.ts"
import { wikilinkAddress, wikilinkFor, wikilinkOffers, wikilinkPath } from "./wikilink.ts"
import { fileKind } from "../kinds.ts"
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"

const printed = (address: Address | null): string | null => address === null ? null : printAddress(address)

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

describe("which file a name finds", () => {
  const SERVED = new Set([
    "finishes.md",
    "kitchen-sink.md",
    "notes/palette.md",
    "notes/Note.md",
    "archive/Note.md",
    "a/b/Deep.md",
    "sub/thing.md",
    "notes/sub/thing.md",
    "notes/sub/other.md",
    "house.olai",
    "art/handle.png",
    "report.pdf",
    "spaced name.md",
    "Mixed.md",
    "mixed.md",
    "Cafe\u0301.md",
    "x/y/Plan.md",
    "z/Plan.md",
    "q/Same.md",
    "p/Same.md",
  ])
  const names = namesIn(TEST_CLAIMS, SERVED)
  const path = (from: string, target: string): string | null => wikilinkPath(names, TEST_CLAIMS, from, target)
  /** The name as the reader reads it out of the written wikilink. */
  const address = (from: string, name: string): string | null => {
    const [link] = read(`[[${name}]]`).wikilinks
    return link === undefined ? null : printed(wikilinkAddress(names, TEST_CLAIMS, from, link))
  }

  test("a bare name finds the one document by that name, in any folder", () => {
    expect(path("journal/day.md", "finishes")).toBe("finishes.md")
    expect(path("house.olai", "palette")).toBe("notes/palette.md")
  })

  test("the suffix is allowed", () => {
    expect(path("journal/day.md", "finishes.md")).toBe("finishes.md")
  })

  test("a name with a space finds its document", () => {
    expect(path("x.md", "spaced name")).toBe("spaced name.md")
  })

  test("a name with no suffix finds documents only, never an outline", () => {
    expect(path("x.md", "house")).toBeNull()
    expect(path("x.md", "house.olai")).toBe("house.olai")
  })

  test("a name with a suffix finds any file olai serves", () => {
    expect(path("x.md", "handle.png")).toBe("art/handle.png")
    expect(path("x.md", "report.pdf")).toBe("report.pdf")
    expect(path("x.md", "handle")).toBeNull()
  })

  test("a path is first read from the top of the directory", () => {
    expect(path("notes/x.md", "sub/thing")).toBe("sub/thing.md")
    expect(path("x.md", "notes/palette")).toBe("notes/palette.md")
  })

  test("then beside the file that wrote it", () => {
    expect(path("notes/x.md", "sub/other")).toBe("notes/sub/other.md")
  })

  test("then as the end of any file's path", () => {
    expect(path("x.md", "b/Deep")).toBe("a/b/Deep.md")
  })

  test("`./` and `../` are read beside the writing file", () => {
    expect(path("notes/x.md", "./palette")).toBe("notes/palette.md")
    expect(path("notes/sub/x.md", "../palette")).toBe("notes/palette.md")
    expect(path("notes/x.md", "../finishes")).toBe("finishes.md")
  })

  test("a `..` that climbs out of the directory finds nothing", () => {
    expect(path("notes/x.md", "../../finishes")).toBeNull()
    expect(path("x.md", "../finishes")).toBeNull()
  })

  test("of two notes with one name, the one in the writer's folder wins", () => {
    expect(path("notes/x.md", "Note")).toBe("notes/Note.md")
    expect(path("archive/x.md", "Note")).toBe("archive/Note.md")
  })

  test("failing that, the one with the fewest folders above it", () => {
    expect(path("root.md", "Plan")).toBe("z/Plan.md")
  })

  test("failing that, the first in path order", () => {
    expect(path("root.md", "Same")).toBe("p/Same.md")
    expect(path("root.md", "Note")).toBe("archive/Note.md")
  })

  test("capitals do not matter", () => {
    expect(path("x.md", "FINISHES")).toBe("finishes.md")
    expect(path("x.md", "Notes/Palette")).toBe("notes/palette.md")
  })

  test("a file whose capitals match exactly wins", () => {
    expect(path("x.md", "Mixed")).toBe("Mixed.md")
    expect(path("x.md", "mixed")).toBe("mixed.md")
    expect(path("x.md", "MIXED")).toBe("Mixed.md")
  })

  test("an accented name is found however its letters are stored", () => {
    expect(path("x.md", "Caf\u00e9")).toBe("Cafe\u0301.md")
    expect(path("x.md", "Cafe\u0301")).toBe("Cafe\u0301.md")
    expect(path("x.md", "café")).toBe("Cafe\u0301.md")
  })

  test("a name that matches nothing finds nothing", () => {
    expect(path("x.md", "nowhere")).toBeNull()
    expect(path("x.md", "//host/x")).toBeNull()
    expect(path("x.md", "javascript:alert(1)")).toBeNull()
    expect(path("x.md", "/finishes")).toBeNull()
  })

  test("a heading lands on its slug, matched the way olai names headings", () => {
    expect(address("x.md", "kitchen-sink#Tables")).toBe("kitchen-sink.md#tables")
    expect(address("x.md", "kitchen-sink#Big Tables!")).toBe("kitchen-sink.md#big-tables")
    expect(address("x.md", "kitchen-sink#A#Tables")).toBe("kitchen-sink.md#tables")
  })

  test("a block reference opens the note", () => {
    expect(address("x.md", "kitchen-sink#^abc123")).toBe("kitchen-sink.md")
  })

  test("a heading of the same document", () => {
    expect(address("kitchen-sink.md", "#Tables")).toBe("kitchen-sink.md#tables")
    expect(address("", "#Tables")).toBeNull()
  })

  test("an outline's row is named by its id", () => {
    expect(address("x.md", "house.olai#kitchen")).toBe("house.olai#kitchen")
    expect(address("x.md", "house.olai")).toBe("house.olai")
  })

  test("an unresolved name has no address", () => {
    expect(address("x.md", "nowhere#Tables")).toBeNull()
  })

  test("the index is remembered against the membership it was built from", () => {
    expect(namesIn(TEST_CLAIMS, SERVED)).toBe(names)
    expect(namesIn(TEST_CLAIMS, new Set(SERVED))).not.toBe(names)
  })
})

describe("what the row editor offers and writes", () => {
  const ROOT = join(import.meta.dir, "../../../tests/fixtures/wikilinks")
  const filesUnder = (directory: string): ReadonlyArray<string> =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]
    )
  const SERVED = new Set(filesUnder(ROOT).map((file) => relative(ROOT, file)))
  const names = namesIn(TEST_CLAIMS, SERVED)
  // Every file that could write a wikilink, and two that the directory does
  // not hold, to stand for a row in another folder.
  const WRITERS = [...SERVED, "deep/down/new.olai", "rooms/new.olai"]

  test("the fixture directory holds namesakes, an outline and files that are not documents", () => {
    expect(SERVED.has("rooms/Note.md") && SERVED.has("garden/Note.md") && SERVED.has("house.olai")).toBe(true)
  })

  test("for every file, from every writer, the text a choice writes finds that very file", () => {
    let asked = 0
    for (const path of SERVED) {
      for (const from of WRITERS) {
        const written = wikilinkFor(names, TEST_CLAIMS, from, path)
        expect([path, from, wikilinkPath(names, TEST_CLAIMS, from, written)]).toEqual([path, from, path])
        asked++
      }
    }
    expect(asked).toBeGreaterThan(100)
  })

  test("the bare name when it is enough, the path from the top when it is not", () => {
    expect(wikilinkFor(names, TEST_CLAIMS, "house.olai", "finishes.md")).toBe("finishes")
    expect(wikilinkFor(names, TEST_CLAIMS, "house.olai", "garden/Note.md")).toBe("Note")
    expect(wikilinkFor(names, TEST_CLAIMS, "house.olai", "rooms/Note.md")).toBe("rooms/Note")
    expect(wikilinkFor(names, TEST_CLAIMS, "rooms/plan.md", "rooms/Note.md")).toBe("Note")
    expect(wikilinkFor(names, TEST_CLAIMS, "every-form.md", "house.olai")).toBe("house.olai")
    expect(wikilinkFor(names, TEST_CLAIMS, "every-form.md", "art/handle.png")).toBe("handle.png")
  })

  test("documents are offered first, then every other file with its suffix", () => {
    const offered = wikilinkOffers(names, TEST_CLAIMS, "", 100)
    const firstOther = offered.findIndex((one) => fileKind(TEST_CLAIMS, one.path) !== "markdown")
    expect(firstOther).toBeGreaterThan(0)
    expect(offered.slice(firstOther).every((one) => fileKind(TEST_CLAIMS, one.path) !== "markdown")).toBe(true)
    expect(offered.find((one) => one.path === "house.olai")?.name).toBe("house.olai")
    expect(offered.find((one) => one.path === "finishes.md")?.name).toBe("finishes")
  })

  test("a name holding what was typed is offered, capitals aside, as many as asked", () => {
    expect(wikilinkOffers(names, TEST_CLAIMS, "FIN", 8).map((one) => one.path)).toEqual(["finishes.md"])
    expect(wikilinkOffers(names, TEST_CLAIMS, "note", 8).map((one) => one.path)).toEqual(["garden/Note.md", "rooms/Note.md"])
    expect(wikilinkOffers(names, TEST_CLAIMS, "rooms/n", 8).map((one) => one.path)).toEqual(["rooms/Note.md"])
    expect(wikilinkOffers(names, TEST_CLAIMS, "hou", 8).map((one) => one.path)).toEqual(["Greenhouse.md", "house.olai"])
    expect(wikilinkOffers(names, TEST_CLAIMS, "zzz", 8)).toEqual([])
    expect(wikilinkOffers(names, TEST_CLAIMS, "", 3)).toHaveLength(3)
  })
})
