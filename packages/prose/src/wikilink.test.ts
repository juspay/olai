/** What is between a wikilink's brackets, how one is written, and where one is
 *  open at the caret. */
import { expect, test } from "bun:test"

import { readWikilink, wikilinkOpenAt, wikilinkWritten } from "./wikilink.ts"

const CAP = 48

test("a name is written with its fragments, its bar and its bang", () => {
  expect(wikilinkWritten({ target: "finishes", fragments: [] })).toBe("[[finishes]]")
  expect(wikilinkWritten({ target: "house.olai", fragments: ["kitchen"] })).toBe("[[house.olai#kitchen]]")
  expect(wikilinkWritten({ target: "Note", fragments: [] }, { alias: "the note" })).toBe("[[Note|the note]]")
  expect(wikilinkWritten({ target: "handle.png", fragments: [] }, { embed: true })).toBe("![[handle.png]]")
})

// ── what is between the brackets ───────────────────────────────────────

test("the forms a wikilink is written in", () => {
  const forms: ReadonlyArray<readonly [string, boolean, { target: string; fragments: ReadonlyArray<string>; alias: string | null; shown: string }]> = [
    ["Note", false, { target: "Note", fragments: [], alias: null, shown: "Note" }],
    ["folder/Note", false, { target: "folder/Note", fragments: [], alias: null, shown: "folder/Note" }],
    ["Note|the note", false, { target: "Note", fragments: [], alias: "the note", shown: "the note" }],
    // Inside a table cell the bar is written escaped, and is the alias bar
    // all the same.
    ["Note\\|the note", false, { target: "Note", fragments: [], alias: "the note", shown: "the note" }],
    ["Note#Heading", false, { target: "Note", fragments: ["Heading"], alias: null, shown: "Note > Heading" }],
    ["#Heading", false, { target: "", fragments: ["Heading"], alias: null, shown: "Heading" }],
    ["Note#A#B", false, { target: "Note", fragments: ["A", "B"], alias: null, shown: "Note > A > B" }],
    ["Note#^block", false, { target: "Note", fragments: ["^block"], alias: null, shown: "Note > ^block" }],
    [" spaced name | the words ", false, { target: "spaced name", fragments: [], alias: "the words", shown: "the words" }],
    ["picture.png", true, { target: "picture.png", fragments: [], alias: null, shown: "picture.png" }],
    // An embed's alias is its size.
    ["picture.png|200", true, { target: "picture.png", fragments: [], alias: "200", shown: "200" }],
  ]
  for (const [inner, embed, want] of forms) {
    expect([inner, readWikilink(inner, embed)]).toEqual([inner, { ...want, embed }])
  }
})

test("brackets that name nothing hold no wikilink", () => {
  for (const inner of ["", "   ", "|words", "#", "##"]) {
    expect([inner, readWikilink(inner, false)]).toEqual([inner, null])
  }
})

// ── the three answers the caret rule gives ─────────────────────────────

test("a caret inside an open link is the name typed so far", () => {
  expect(wikilinkOpenAt("see [[fin", CAP)).toEqual({ from: 4, query: "fin" })
  // Nothing typed yet is a name of nothing, which offers everything.
  expect(wikilinkOpenAt("[[", CAP)).toEqual({ from: 0, query: "" })
  // The LAST `[[` is the open one; an earlier closed link is behind it.
  expect(wikilinkOpenAt("[[finishes]] and [[pa", CAP)).toEqual({ from: 17, query: "pa" })
  // A space belongs to a name: a file may be called `paint colours`.
  expect(wikilinkOpenAt("[[paint col", CAP)).toEqual({ from: 0, query: "paint col" })
})

test("a caret outside any open link is not this widget's business", () => {
  expect(wikilinkOpenAt("no brackets here", CAP)).toBeUndefined()
  expect(wikilinkOpenAt("[[finishes]] after", CAP)).toBeUndefined()
  expect(wikilinkOpenAt("[[finishes]]", CAP)).toBeUndefined()
  // A link does not cross a line break.
  expect(wikilinkOpenAt("[[fin\nmore", CAP)).toBeUndefined()
})

test("a caret inside an open link with nothing to offer answers so, and not nothing", () => {
  // Past the bar is the alias somebody is writing, not a name.
  expect(wikilinkOpenAt("[[Note|the ", CAP)).toBeNull()
  // Past a hash is a heading of that note.
  expect(wikilinkOpenAt("[[Note#Head", CAP)).toBeNull()
  // A lone `]` is a bracket this list will not guess around.
  expect(wikilinkOpenAt("[[Note]", CAP)).toBeNull()
  // Past the cap the line is prose with brackets in it.
  expect(wikilinkOpenAt(`[[${"a".repeat(CAP + 1)}`, CAP)).toBeNull()
  expect(wikilinkOpenAt(`[[${"a".repeat(CAP)}`, CAP)).toEqual({ from: 0, query: "a".repeat(CAP) })
})
