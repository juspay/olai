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
 *  which for a sweep means a false alarm a human reads, never a silent pass.
 *
 *  ONE PASS, LEFT TO RIGHT, which is not cosmetic: whichever comment starts
 *  first consumes the other. Two passes have a silent-pass hole whichever order
 *  they run in — blocks first honours a block opener written inside a LINE
 *  comment (a MIME type with a star in it), lines first honours a `//` written
 *  inside a BLOCK comment and eats its closer — and either way the stripper
 *  swallows a stretch of real code and the sweep passes without reading it.
 *  `@olai/tests`' `support/sweep.ts` carries the same stripper, deliberately,
 *  with the argument and both fixtures written out. */
const codeOf = (file: string): string =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "")

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

// The THIRD button vocabulary, swept for the reason the two above are: the way
// OUT of a panel a row opened is worn in three files — the shell the three
// one-value panels share (`Cancel`), and the two that search (`Done`) — and it
// was written out three times before it was a constant. A fourth file retyping
// the string fails here rather than drifting a pixel at a time.
// across.ts's claim — one spelling of the LAW two gestures refuse by. A row
// dragged over another outline's pane and a destination picked out of a search
// of the whole set are told the same thing about the format, and they lead into
// it differently (a pane has a file, a picked row has a title), so the sentence
// itself is the shared part. Its own test file is the other legitimate speller,
// for the reason `status.test.ts` is one above: an assertion that the words
// reach a reader has to utter them.
test("only across.ts spells the same-file law", () => {
  expect(filesSpelling(/Every outline is an independent tree/)).toEqual([
    "across.ts",
    path.join("move", "destination.test.ts"),
  ])
})

test("only pill.ts spells a panel's way out", () => {
  const spelling =
    /cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink/
  expect(filesSpelling(spelling)).toEqual(["pill.ts"])
})

// chat/live.ts's claim — one spelling of the panel's "this is happening now"
// cue. Two places wear it and they are the same fact one level apart: the
// header says a TURN is in flight, a spawn's rail says an AGENT the turn sent
// out is. They were two copies with a comment in one of them asserting they
// matched, which is the arrangement this file exists to replace.
test("only chat/live.ts spells the live dot", () => {
  const spelling = /inline-block size-1\.5 animate-pulse rounded-full bg-doing/
  expect(filesSpelling(spelling)).toEqual(["chat/live.ts"])
})

// chat/lanes.ts's claim — one spelling of a lane's rail, and this one is a
// claim about GEOMETRY rather than about tone. Two things draw the rail and
// the whole point of the second is that it is the same line continued: a row
// a subagent made hangs one off the frame above it, and a spawn nobody has
// reported on yet hangs one off itself, directly above that row. Spelled
// twice they agreed by coincidence, and the first tweak to either would have
// drawn a reader one line as two.
test("only chat/lanes.ts spells the lane rail", () => {
  const spelling = /border-l-2 border-muted\/70 pl-2/
  expect(filesSpelling(spelling)).toEqual(["chat/lanes.ts"])
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

// A PANE'S index, which is the same kind of claim read from the other end. The
// workspace DRAWS it — the page itself, and the three chrome projections of the
// pane list — and what READS it is every place that has to tell two panes of the
// SAME FILE apart, which is a view this app can draw and therefore a place its
// identifiers stop being unique. A `Row.key` is a chain from the roots of ITS
// page (the two row gestures measure through one door, `drag/lines.ts`), and a
// markdown heading's id is minted from the heading (`document/faces.tsx` scrolls
// under its own pane's root). A fifth file spelling it is a new reader, which is
// a new answer to "which page is this in".
test("a pane's index is drawn by the workspace and read where two panes must be told apart", () => {
  expect(filesSpelling(/data-pane/)).toEqual([
    path.join("document", "faces.tsx"),
    path.join("drag", "lines.ts"),
    path.join("pane", "PageView.tsx"),
    path.join("pane", "Panes.tsx"),
  ])
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

// menu/chunk.ts's claim — `DropdownMenu` is not on the first-paint chunk, and
// nothing may put it back. The split is a fact about the module GRAPH and
// nothing in the source looks wrong on the day it is undone: one static
// `import` of `menu/Dropdown.tsx` (or of `./Panel.tsx` / `./Confirm.tsx` behind
// it) from a file the entry reaches, and the bundler inlines all ~80 kB of it
// again while every test still passes and every pixel is where it was. So the
// two edges are swept instead.
//
// First, the subpath itself: exactly the three files that live BEHIND the
// `import()` may name it. The list is the chunk's own contents, and a fourth
// name is either a new file that belongs in there or a first-paint file that
// has just re-imported the menu.
test("only the chunked menu names @kobalte/core's dropdown-menu", () => {
  expect(filesSpelling(/@kobalte\/core\/dropdown-menu/)).toEqual([
    path.join("menu", "Confirm.tsx"),
    path.join("menu", "Dropdown.tsx"),
    path.join("menu", "Panel.tsx"),
  ])
})

// And the other edge, which is the way the first one would be undone without
// naming Kobalte at all: the chunk is THREE files, and a static import of any
// of them from a file the entry reaches drags the whole graph back into
// `main-*.js`. `Panel.tsx` and `Confirm.tsx` already name the dropdown subpath,
// so they sail through the sweep above; only this one sees them. (Grok's review
// of PR #171 found that hole, when the sweep here asked about `Dropdown.tsx`
// alone.)
//
// It resolves the specifier rather than matching it, because the SPELLING
// cannot say which file is meant: this client holds four `Panel.tsx` — the
// menu's, the chat's, the commit's and the preferences' — and three of those
// are imported by first-paint code as `./Panel.tsx` from their own directory.
//
// The expectation is the chunk's own SHAPE, as a table: who may import each
// file of it, and nobody else. `Dropdown.tsx`'s empty list is the claim that
// used to be a sweep of its own — the entry is reached by the `import(...)` in
// `menu/chunk.ts`, which carries no `from` and is the split itself.
const CHUNK = ["Dropdown.tsx", "Panel.tsx", "Confirm.tsx"].map((one) => path.join("menu", one))

/** What a file statically imports, as client-relative paths. A dynamic
 *  `import(...)` is deliberately not one of them: `import` followed by a paren
 *  never matches, which is what makes `menu/chunk.ts` the one legitimate way
 *  in. */
const importsOf = (source: { file: string; code: string }): ReadonlyArray<string> =>
  [...source.code.matchAll(/(?:from|import)\s*["'](\.[^"']*)["']/g)]
    .map(([, spec]) => path.normalize(path.join(path.dirname(source.file), spec!)))

test("nothing outside the menu's chunk imports the menu's chunk", () => {
  const importers = new Map(CHUNK.map((one) => [one, [] as string[]]))
  for (const source of SOURCES) {
    for (const target of importsOf(source)) importers.get(target)?.push(source.file)
  }
  expect([...importers].map(([file, from]) => [file, from.sort()])).toEqual([
    [path.join("menu", "Dropdown.tsx"), []],
    [path.join("menu", "Panel.tsx"), [path.join("menu", "Dropdown.tsx")]],
    [path.join("menu", "Confirm.tsx"), [path.join("menu", "Panel.tsx")]],
  ])
})

// dismiss.ts's claim — the two gestures that shut a panel are spelled in ONE
// file, which since the layer stack is also the claim that every dismissable
// is ON that stack. Before it, four panels had four copies of "a pointer down
// outside it" and they had drifted; now a fifth panel written with a listener
// pair of its own would not merely be a fifth copy, it would be a panel the
// stack cannot see — one that shuts when something over it is dismissed, which
// is the exact bug `features/dismiss_stack.feature` exists about and the one
// thing a scenario about the OTHER panels would never catch.
test("only dismiss.ts reaches for Kobalte's dismissal primitives", () => {
  expect(filesSpelling(/create(?:EscapeKeyDown|InteractOutside)\s*\(/)).toEqual([
    "dismiss.ts",
  ])
})

// ...and the other side of it: WHO JOINS THE STACK WITHOUT `dismissOn`, which
// is the list of panels whose gestures are somebody else's. The `•••` menu's
// are Kobalte's, one level up; the palette and the shortcuts dialog answer
// Escape on the window and a press on their own scrims; the composer's
// completion takes keys in the capture phase ahead of everything. Each has a reason written
// where it joins, and the list is short on purpose — a fifth joiner is either a
// panel that had to hand-roll its dismissal (worth arguing about) or one that
// wanted the stack and skipped the dismissal, which is a panel nothing shuts.
test("the stack is joined directly only where the gestures are not dismissOn's", () => {
  expect(filesSpelling(/topmostWhileOpen/)).toEqual([
    path.join("chat", "CompletionMenu.tsx"),
    "dismiss.ts",
    path.join("menu", "Dropdown.tsx"),
    path.join("palette", "Palette.tsx"),
    path.join("palette", "Shortcuts.tsx"),
    "topmost.ts",
  ])
})
