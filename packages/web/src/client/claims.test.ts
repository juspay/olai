/**
 * Claims this tree's docstrings make about WHERE things are spelled, held as
 * sweeps rather than as sentences.
 *
 * Two files in this client claim a monopoly, and both claims decayed once
 * already — `wire.ts` promised "the only file that knows a websocket exists"
 * while it hand-derived the dial URL a helper already owned, and the readout's
 * states were once folded per consumer. A claim in a docstring is checked at
 * review time by whoever happens to remember it; a claim swept here is checked
 * on every test run, and the failure names the file that broke it.
 *
 * The sweeps grip the CALL and the SPELLING, not the import path: a consumer
 * is free to import `@kolu/surface-app/solid` for its types (`status.ts` is
 * the door to the readout's), and a monopoly on a subpath would outlaw that
 * while missing a re-export. What cannot appear twice is the act — dialling
 * (`connectSurface(...)`), or comparing against a raw state name.
 *
 * Comments are stripped before matching, because these are claims about code:
 * prose is allowed to DISCUSS `connectSurface` or quote "live" while
 * explaining why nothing else may spell it.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

const CLIENT = import.meta.dirname
const SELF = import.meta.filename

/** The file's code, with its comments removed. Line comments are only taken
 *  when `//` opens the line or follows whitespace, so a `https://…` inside a
 *  string survives; the cost is a comment pasted mid-expression surviving too,
 *  which for a sweep means a false alarm a human reads, never a silent pass. */
const codeOf = (file: string): string =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")

/** Every source file under the client — client-relative path and stripped
 *  code, read ONCE for however many sweeps accrue below. This file is
 *  excluded: the sweeps quote the spellings they hunt, and a sweep that
 *  caught its own net would teach the next reader to weaken the pattern
 *  rather than the code. */
const SOURCES: ReadonlyArray<{ file: string; code: string }> = fs
  .readdirSync(CLIENT, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((full) => full !== SELF)
  .map((full) => ({ file: path.relative(CLIENT, full), code: codeOf(full) }))

/** Where each file that matched is, so a failure is a file list rather than
 *  a boolean. */
const filesSpelling = (pattern: RegExp): ReadonlyArray<string> =>
  SOURCES
    .filter((one) => pattern.test(one.code))
    .map((one) => one.file)
    .sort()

// wire.ts's own opening line — "the only file in the client that knows a
// websocket exists" — tested as the CALL: exactly one file dials. Asserting
// equality rather than "nothing else" keeps the sweep honest, because a
// pattern that rotted would report an empty list here instead of passing.
test("only wire.ts dials: connectSurface( is called exactly once in the client", () => {
  expect(filesSpelling(/connectSurface\s*\(/)).toEqual(["wire.ts"])
})

// status.ts's claim — it "says what each of the five looks like, and nothing
// else about them" is only safe if nothing else READS them raw. Everything
// downstream takes the readout whole (a prop, a `data-` attribute) or goes
// through `lookOf`; the day a component branches on `"retired"` itself, the
// sixth state lands everywhere status.ts is not. The test file is the one
// other legitimate speller: its fixtures must utter the states to hold the
// table to them.
test("nothing outside connection/status.ts reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  expect(filesSpelling(states)).toEqual([
    path.join("connection", "status.test.ts"),
    path.join("connection", "status.ts"),
  ])
})

// pill.ts's claim — one spelling of the quiet pill button, worn by import.
// Same construction as the connectSurface sweep: asserting equality keeps it
// honest, because pill.ts itself must keep matching — a respelled QUIET_PILL
// fails here rather than rotting the pattern to an empty pass. The lookalikes
// that deliberately diverge (`pill.ts` says where) do not match, which is the
// point: what cannot reappear is the SHARED spelling, retyped.
test("only pill.ts spells the quiet pill button", () => {
  const spelling = /rounded border border-rule px-2 py-1 text-xs text-muted hover:text-ink/
  expect(filesSpelling(spelling)).toEqual(["pill.ts"])
})

// Its twin, swept the same way and for a sharper reason: the two buttons of a
// confirm are the same question's two answers, so the day one is respelled
// and the other is not, the panel reads as a layout accident. Two surfaces
// ask a confirm now — the `•••` menu's and the ⌘K palette's.
test("only pill.ts spells the alarm pill button", () => {
  const spelling =
    /rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm\/10/
  expect(filesSpelling(spelling)).toEqual(["pill.ts"])
})

// layer.ts's claim — every `z-index` in this client comes from its table. The
// numbers were never wrong before that module existed; they were spread over
// twenty call sites, where two of them meant something entirely different from
// what they looked like (`chat/Sessions.tsx` drew at the palette's own `z-50`
// while sealed inside a panel riding three layers down). What stops that
// coming back is not the table but this: a bare utility anywhere else fails
// here, and picking a NAME is the question a bare number lets a person skip.
// ONE file, its own test included: `layer.test.ts` reads the utilities back
// out of the table rather than quoting any, which is what lets this list be a
// single name.
test("only layer.ts spells a z-index", () => {
  expect(filesSpelling(/(?:^|[\s"'`])z-(?:\[\d+\]|\d+|auto)(?=$|[\s"'`])/m)).toEqual(["layer.ts"])
})

// drag/sweeping.ts's claim — the outline's SCAFFOLDING is the only thing a
// drag-across may begin on, and the mark that says so is written as a literal
// at each site (a JSX spread there would move every `data-` fact a row carries
// onto Solid's runtime spread path, per row, per frame). A literal cannot be
// renamed by the type checker, so it is swept instead: exactly the module that
// reads the attribute and the two components that wear it. A fourth file
// spelling it is a new surface nobody argued for — and a missing one is a rail
// that quietly stopped being pressable, which nothing else would notice.
test("only the outline's scaffolding is marked as a sweep surface", () => {
  expect(filesSpelling(/data-sweep/)).toEqual([
    "Tree.tsx",
    path.join("drag", "sweeping.ts"),
    path.join("edit", "Editable.tsx"),
  ])
})

// The other two attributes a row's LINE and its HANDLE wear, swept for the same
// reason and with the same shape. Each is declared once as a constant and
// written out once as a literal, because a JSX spread would put every attribute
// of those elements — including the row line's `classList` — on Solid's runtime
// spread path, per row, per frame. A literal cannot be renamed by the type
// checker; these are what hold the two spellings together.
test("a row's line is marked in exactly the module that reads it and the tree that draws it", () => {
  expect(filesSpelling(/data-row-key/)).toEqual(["Tree.tsx", path.join("drag", "lines.ts")])
})

// The handle's is two rather than three, and the missing one is the point:
// `menu/door.ts` stands down on this mark and spells it as the CONSTANT, so the
// type checker already holds its end. Only the declaration and the cell that
// wears it are literals, and only they need a sweep.
test("a row's handle is marked in the gesture that owns it and the cell that wears it", () => {
  expect(filesSpelling(/data-handle/)).toEqual([
    path.join("drag", "Handle.tsx"),
    path.join("drag", "dragging.ts"),
  ])
})

// pointer.ts's claim — one file suppresses the text selection under a gesture.
// It is swept because the file's own note LEANS on it: the save-and-put-back
// there is not re-entrant, and what makes that survivable is that the value it
// saves is always `""`, which is only true while nothing else writes the
// property. A second writer turns a stray `user-select: none` until reload into
// a wrong value put back, and this is what says so on the day it appears.
test("only pointer.ts suppresses the page's text selection", () => {
  expect(filesSpelling(/userSelect/)).toEqual(["pointer.ts"])
})

// saying.ts's claim — one receptacle for how long a said-line lingers. SAID_MS
// was pulled out beside the `Said` type because the ••• menu's dwell and the
// Trash's "were equal only by hand-maintenance", and the constant turned out
// to be half the job: both surfaces still spelled the machinery around it and
// had drifted into two shapes for the same three rules. Reaching for the
// constant again is what writing the third copy looks like from here. Two
// names: `edit/undoing.ts` declares the number beside the type it belongs to,
// and `saying.ts` is the only thing that counts it down.
test("only saying.ts counts SAID_MS down", () => {
  expect(filesSpelling(/\bSAID_MS\b/)).toEqual([path.join("edit", "undoing.ts"), "saying.ts"])
})
