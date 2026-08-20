import { expect, test } from "bun:test"

import { drawnWhen } from "./hiddenOutlines.ts"

// The whole rule, with the preference passed in rather than read out of a
// browser — which is what `drawnWhen` is for (`./hiddenOutlines.ts`).
const FILES = [
  "house.olai",
  "notes/palette.md",
  "notes/_olai/Pins.olai",
  "_olai/Pins.olai",
  "_olai/Inbox.olai",
]
const NOTHING_BROKEN = new Map<string, unknown>()

test("hiding takes out the files olai named for itself, and only those", () => {
  expect(drawnWhen(FILES, NOTHING_BROKEN, true)).toEqual([
    "house.olai",
    "notes/palette.md",
    // A `_olai` somebody made inside their OWN folder is their directory: the
    // mint is at the root and so is the rule (`@olai/format`'s `inOlaiDir`).
    "notes/_olai/Pins.olai",
  ])
})

// Not a filter that happens to keep everything: the SAME array comes back, so
// a caller comparing by reference sees that nothing was decided — the shape
// `./done.ts`'s `visible` keeps for its own preference.
test("showing them is the list it was given, identity and all", () => {
  expect(drawnWhen(FILES, NOTHING_BROKEN, false)).toBe(FILES)
})

// THE EXCEPTION, and the reason this rule takes a broken map at all: the ⚠ on
// a row is the only place this app reports an outline that would not parse
// without somebody opening the page to find out, so hiding one would swallow
// the report (HACKING.md — never silently ignore errors).
test("a file that could not be read keeps its row, hidden or not", () => {
  const broken = new Map<string, unknown>([["_olai/Pins.olai", {}]])
  expect(drawnWhen(FILES, broken, true)).toEqual([
    "house.olai",
    "notes/palette.md",
    "notes/_olai/Pins.olai",
    "_olai/Pins.olai",
  ])
  // …and it goes again the moment the file parses.
  expect(drawnWhen(FILES, NOTHING_BROKEN, true)).not.toContain("_olai/Pins.olai")
})
