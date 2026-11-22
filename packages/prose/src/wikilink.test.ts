/** How a wikilink is written, and where one is open at the caret. */
import { expect, test } from "bun:test"

import { wikilinkOpenAt, wikilinkWritten } from "./wikilink.ts"

const CAP = 48

test("a name is written with its fragments, its bar and its bang", () => {
  expect(wikilinkWritten({ target: "finishes", fragments: [] })).toBe("[[finishes]]")
  expect(wikilinkWritten({ target: "house.olai", fragments: ["kitchen"] })).toBe("[[house.olai#kitchen]]")
  expect(wikilinkWritten({ target: "Note", fragments: [] }, { alias: "the note" })).toBe("[[Note|the note]]")
  expect(wikilinkWritten({ target: "handle.png", fragments: [] }, { embed: true })).toBe("![[handle.png]]")
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
