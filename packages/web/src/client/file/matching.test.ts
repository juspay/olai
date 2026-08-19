/**
 * Which files a query means — `./matching.ts`'s whole rule, over a directory
 * spelled out here rather than served.
 *
 * The order is the assertion, not just the membership: what makes a shortlist
 * usable is that the file somebody is typing towards is the one Enter would
 * take, and that is a property of the buckets rather than of the filter. Both
 * doors over this rule inherit that — the composer's `@` list and the
 * palette's document rows, while the palette matched paths for itself.
 */

import { expect, test } from "bun:test"

import { dirOf, folded, type Folded, matchFiles, nameOf } from "./matching.ts"

/** The cap the composer passes when the node half of the list has nothing to
 *  offer — the whole of it (`./naming.ts` divides it). */
const LIMIT = 8

/** The match, read as PATHS — which is what these tests are about and not what
 *  the matcher answers with: it hands back the entries it was given, so a
 *  caller keeps whatever it folded alongside the path (`./matching.ts`). What
 *  a document row keeps that way is asserted next door
 *  (`../palette/documents.test.ts`); here the path is the whole claim. */
const matched = (
  files: ReadonlyArray<Folded>,
  query: string,
  limit: number,
): ReadonlyArray<string> => matchFiles(files, query, limit).map((file) => file.path)

const DIRECTORY = folded([
  "Daily/2026-08.olai",
  "finishes.md",
  "garden.olai",
  "house.olai",
  "notes/cabinets.md",
  "notes/palette.md",
])

test("an empty query is the whole directory — a bare `@` shows what is there", () => {
  expect(matched(DIRECTORY, "", LIMIT)).toEqual([
    "Daily/2026-08.olai",
    "finishes.md",
    "garden.olai",
    "house.olai",
    "notes/cabinets.md",
    "notes/palette.md",
  ])
})

test("a query is matched against the file's own NAME first", () => {
  // `pal` is nowhere near the start of `notes/palette.md` as a path, and it is
  // exactly how somebody asks for that file.
  expect(matched(DIRECTORY, "pal", LIMIT)).toEqual(["notes/palette.md"])
})

test("...and against the PATH, so a folder is a way in", () => {
  expect(matched(DIRECTORY, "notes/", LIMIT)).toEqual([
    "notes/cabinets.md",
    "notes/palette.md",
  ])
})

test("a name that starts with the query beats one that merely holds it", () => {
  const files = folded(["archive/old-cabinets.md", "cabinets.md"])
  expect(matched(files, "cab", LIMIT)).toEqual([
    "cabinets.md",
    "archive/old-cabinets.md",
  ])
})

test("case is not something anybody should have to get right", () => {
  expect(matched(DIRECTORY, "DAILY/", LIMIT)).toEqual(["Daily/2026-08.olai"])
  expect(matched(folded(["Notes/Palette.md"]), "palette", LIMIT)).toEqual([
    "Notes/Palette.md",
  ])
})

test("a query nothing holds answers with nothing, which is what draws no box", () => {
  expect(matched(DIRECTORY, "alice", LIMIT)).toEqual([])
})

test("the list is a shortlist — eight rows, whatever the vault is", () => {
  const many = folded(
    Array.from({ length: 40 }, (_, at) => `notes/note-${at}.md`),
  )
  expect(matched(many, "note", LIMIT).length).toBe(8)
  expect(matched(many, "", LIMIT).length).toBe(8)
})

test("what a row reads: the name, and where it sits", () => {
  expect(nameOf("notes/cabinets.md")).toBe("cabinets.md")
  expect(dirOf("notes/cabinets.md")).toBe("notes")
  // A file at the root has no folder to name, and says so with nothing rather
  // than with a `/` nobody typed.
  expect(nameOf("house.olai")).toBe("house.olai")
  expect(dirOf("house.olai")).toBe("")
})
