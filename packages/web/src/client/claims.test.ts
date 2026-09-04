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
 *
 * A SWEEP SEES ONE DIRECTORY, which is the limit worth stating at the top now
 * that a face this app draws can live in another package. When the tab's chat
 * and agents became `olai-plugin-chat`'s browser half, two claims whose every
 * name was a `chat/` file moved out whole and three more lost a row apiece —
 * and losing a row is the dangerous one, because the equality goes green while
 * the rule stops being asked of the files it was written against. So each of
 * those three says at its own list which name went with the panel, and
 * `packages/plugins/chat/src/browser/claims.test.ts` is the sibling sweep that
 * asks them again over that tree. A rule about something shared — this client's
 * readout, this client's bundle, this client's dismissal stack — has to be
 * swept on both sides of a package wall or it is only swept where nothing was
 * going to break it.
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
//
// THE CALL HAS CHANGED TWICE and the claim has not, which is why the pattern
// moved with it rather than the test being dropped. It hunted `connectSurface(`
// while the client dialled one surface; when the plugins grew surfaces of their
// own it hunted the socket constructor and the watchdog's mint, because the
// turnkey seam derived its reserved probes from the FIRST SIBLING and core
// cannot be one, so the wire was assembled here by hand. juspay/kolu#2222 gave
// that seam a ROOT SLOT and the assembly is gone — one call again, and this is
// once more a count of the seam rather than of the socket underneath it.
//
// The other half of that claim — that NO file in olai spells the four
// primitives the assembly used to chain, nor the two fusion helpers
// `@olai/plugin-api` used to export — is repo-wide and lives where those helpers
// did: `@olai/plugin-api`'s `mechanics.test.ts`, which carries the falsifier the
// upstream ask travelled with. A client-only sweep could not have made it.
test("only wire.ts dials: the seam is called exactly once in the client", () => {
  expect(filesSpelling(/connectSurfaces\s*\(/)).toEqual(["wire.ts"])
})

// names.ts's claim — the table is derived ONCE, beside the reading
// (`createReading` in reading.tsx). App.tsx used to build one over the
// focused pane for the palette, and NamesProvider one per pane: a
// navigation copied twice. The call is the act; names.browsertest.ts is the
// suite that counts the copy's own runs, so it is allowed to name the
// function. Equality rather than "nothing else", so a second production site
// is a name on this list.
test("createNames is called only beside the reading", () => {
  expect(filesSpelling(/createNames\s*\(/)).toEqual([
    "names.browsertest.ts",
    "reading.tsx",
  ])
})

// status.ts's claim — it "says what each of the five looks like, and nothing
// else about them" is only safe if nothing else READS them raw. Everything
// downstream takes the readout whole (a prop, a `data-` attribute) or goes
// through `lookOf`; the day a component branches on `"retired"` itself, the
// sixth state lands everywhere status.ts is not. The test files are the
// legitimate spellers: their fixtures must utter the states to hold the tables
// to them — `status.test.ts` over the look table, `reaching.test.ts` over
// WHICH states cannot carry a question, and `named.test.ts` over whether those
// same states may send `app.get`. None of them branches on a state in the
// app; they assert about, or stand in for, the tables that do.
//
// A FOURTH IS `declared.browsertest.ts`, which hands its subject a live socket
// because a module that asks nothing into a dead one cannot be asked at all. It
// sits HERE and not with the panel, and the pair is worth reading together: the
// batch door it drives is `./declared.ts`, which the panel's transcript reads
// and the outline page reads too — one question about what the SET declares,
// asked once per message and remembered — so it stayed when the panel left, and
// its fixture stayed beside it.
//
// THE CLAIM DID NOT SHRINK TO THIS DIRECTORY, which would be a monopoly held
// only over whoever shares a folder with the definition. The panel is
// downstream of this readout like every other face, and the same sweep runs over
// its tree in `packages/plugins/chat/src/browser/claims.test.ts`.
test("nothing outside connection/status.ts reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  expect(filesSpelling(states)).toEqual([
    path.join("connection", "reaching.test.ts"),
    path.join("connection", "status.test.ts"),
    path.join("connection", "status.ts"),
    "declared.browsertest.ts",
    "named.test.ts",
  ])
})

// The LAW two gestures refuse by — one spelling, and it is not in this package
// any more. A row dragged over another outline's pane and a destination picked
// out of a search of the whole set are told the same thing about the format,
// and they lead into it differently (a pane has a file, a picked row has a
// title), so the sentence itself is the shared part. It moved to
// `@olai/format`'s `moving.ts` when the second of those two readings did
// (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10): one of its readers is on
// the other side of the wire now, and a browser-side copy would be the second
// spelling this claim exists to forbid.
test("no file here spells the same-file law — it is the format's", () => {
  expect(filesSpelling(/Every outline is an independent tree/)).toEqual([])
})

// layer.ts's claim — every `z-index` in this client comes from its table. The
// numbers were never wrong before that module existed; they were spread over
// twenty call sites, where two of them meant something entirely different from
// what they looked like (the chat's session list drew at the palette's own `z-50`
// while sealed inside a panel riding three layers down). What stops that
// coming back is not the table but this: a bare utility anywhere else fails
// here, and picking a NAME is the question a bare number lets a person skip.
// ONE file, its own test included: `layer.test.ts` reads the utilities back
// out of the table rather than quoting any, which is what lets this list be a
// single name.
// SaidLine.tsx's claim about `ALARM_BAND` — "spelled here it changes once".
// The BAND, not the alarm token: this client paints alarm on a dozen shapes
// (a badge, a bubble, a banner, a dashed chat entry) and each of those is its
// own thing. What may not recur is the shortlist panels' alarmed band — the
// rule at 40% with the same hue at 5% behind it — which three panels drew by
// hand until they were one call, and which a fourth panel would copy from
// whichever of them it was written beside. The pattern grips the pair rather
// than either half, because either half alone is a shape somebody else is
// entitled to.
test("only SaidLine.tsx spells the alarmed band the shortlist panels wear", () => {
  expect(filesSpelling(/border-alarm\/40[^"'`]*bg-alarm\/5/)).toEqual([
    "SaidLine.tsx",
  ])
})

// SaidLine.tsx's other claim, and the one packages/web/README.md was already
// making without anything checking it: the two MOODS are read in one place.
// What is swept is `data-tone` taken from a VALUE — `data-tone={…}` rather
// than `data-tone="alarm"` — because that spelling is the fingerprint of a
// surface deciding for itself what a mood looks like and how it is announced,
// which is the four-line copy the component exists to end. A literal one is a
// different thing and is left alone: `Refused.tsx` and `document/BodyRefused.ts`
// are single-mood boxes over a plain string, and their own headers argue why a
// component carrying a mood nothing emits would be an abstraction one caller
// wide. Two hold-outs were found by hand when this test was written (the row
// editor's line and the selection bar's) — which is the argument for the test.
test("only SaidLine.tsx reads a said-line's mood", () => {
  expect(filesSpelling(/data-tone=\{/)).toEqual(["SaidLine.tsx"])
})

// chrome.ts's claim, and the one that makes its title composer honest: what a
// tab is CALLED is written in one place, so a mark applied to it cannot be
// clobbered by a second writer and a second writer cannot lose the mark. It is
// a sweep rather than a comment because the failure is silent — a title set
// somewhere else looks right until the mark clears and puts back a name from
// before it.
test("only theme/chrome.ts writes the tab's title", () => {
  expect(filesSpelling(/document\.title\s*=/)).toEqual([path.join("theme", "chrome.ts")])
})

test("only layer.ts spells a z-index", () => {
  expect(filesSpelling(/(?:^|[\s"'`])z-(?:\[\d+\]|\d+|auto)(?=$|[\s"'`])/m)).toEqual(["layer.ts"])
})

// overlay.ts's claim — hanging overlays mount on the socket. A z-index only
// compares inside its own stacking context, and a sticky heading is one at
// LAYER.row: an overlay left in the outline is a preceding sibling of the
// next heading and is cut in two (`menu-under-headers`, `menu-said-overlay`).
// The socket is one function, and every overlay that hangs over the outline
// names it. Equality rather than "at least these", so a fourth rider is a
// name on this list and a rider that quietly goes back in the tree drops off
// it and fails here. overlay.ts itself does not match: it is the definition,
// and the pattern is the CALL.
// Live or nothing: an offline shell would show outlines that had stopped
// being true. The install surface's e2e used to ask `navigator.serviceWorker`
// after the bundle had run; that claim now lives here, on the files that
// would actually register one, not on the shell HTML.
// running.ts used to re-default a tool row's status (`entry.status ??
// "pending"`) because the wire type could not say the field was required on
// a call and absent on every other kind. The union carries that; a second
// spelling of the default coming back is a consumer re-establishing a fact
// the type already has.
test("statusOf is gone: the type carries a tool row's status", () => {
  expect(filesSpelling(/\bstatusOf\b/)).toEqual([])
})

// Live or nothing: an offline shell would show outlines that had stopped being
// true. The origin has a worker again — the framework's fetch-less NOTIFICATION
// worker, which is the only way an installed PWA can raise a notification at
// all (`notify.ts`) — and it caches nothing, so the doctrine is
// untouched. What this sweep now holds is that the REGISTRATION is one call in
// one file: a second one would be a second policy about what this origin's one
// worker is, and the register-or-retire invariant is the framework's to own.
test("only the entry point registers a service worker", () => {
  expect(filesSpelling(/[Ss]erviceWorker/)).toEqual(["main.tsx"])
})

test("overlays that hang over the outline mount on overlayRoot", () => {
  expect(filesSpelling(/overlayRoot\s*\(/)).toEqual([
    path.join("complete", "Completions.tsx"),
    path.join("menu", "Dropdown.tsx"),
    path.join("menu", "MenuSaid.tsx"),
  ])
})

// layer.ts's other claim, from the far end of the same table: ONE thing in
// this client is above every layer in it, and it is above them because the
// browser puts it there rather than because it out-numbered anybody. The
// offline overlay opens as a modal `<dialog>` — the top layer, and the rest of
// the document inert — which is the only way to promise that nothing
// underneath is interactive: a panel portalled to the body after it, at the
// same `LAYER.over`, would paint straight over a z-index that tried. A second
// file reaching for the top layer is a second thing claiming to cover the app,
// and it must argue with this list first.
test("only the offline overlay takes the top layer", () => {
  expect(filesSpelling(/showModal\s*\(/)).toEqual([
    path.join("connection", "Offline.tsx"),
  ])
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
// page (the two row gestures measure through one door, `drag/lines.ts`), and the
// two element landings scroll under their own pane's root (`document/faces.tsx`
// for the heading, `OutlinePage.tsx` for the row). A sixth file spelling it is
// a new reader, which is a new answer to "which page is this in".
test("a pane's index is drawn by the workspace and read where two panes must be told apart", () => {
  expect(filesSpelling(/data-pane/)).toEqual([
    "OutlinePage.tsx",
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

// TWO CLAIMS STOOD HERE and are `olai-plugin-chat`'s now, which is worth the
// paragraph rather than a silent deletion: what a tool call's status may be
// spelled as (the frame owns the LOOK, `@olai/surface` owns the MEANING, and
// the fixtures that mint a tool row must name one), and the two callers allowed
// to put the open agent preview away (a lifetime rather than a rule, pinned as
// the CALL because the failure it guards against hides until two transcripts
// mint the same key). Every name on both lists was a `chat/` file, so when the
// panel left this client neither claim had a subject on this side — the sweeps
// would have held empty lists, true and about nothing, while the twelve faces
// and fixtures they were written against went unswept. Both moved with their
// arguments intact to `packages/plugins/chat/src/browser/claims.test.ts`, which
// is the same sweep rooted at the directory those files are in now.
//
// The three claims that did NOT move are the ones whose subject is core's and
// whose obligation is everybody's — the readout's raw states above, the
// bundler's literal and the dismissal stack below. Each says at its own list
// that the panel's row went with the panel, and each is swept a second time
// over there.

// clock.ts's claim — "the one clock in the client", which for a while was a
// claim about the DAY and silently untrue about the wall clock. The readouts
// here that are a reading of it — the commit pill's "12m ago", the chat
// panel's "47s", the header's "up 2h" — go stale where they stand, and each
// would otherwise arrive with its own `setInterval`, signal and `onCleanup`.
// What they have in common was never the number but the LIFETIME, and a
// disposal written out per feature is one a feature will eventually forget:
// the timer that outlives the component it drew for is invisible until a
// panel that has been opened and closed forty times is ticking forty times.
// So the repeating timer is `createTicking`, once, and a further readout has
// to reach for it. `clock.ts` itself is the definition, and the pattern is
// the CALL — which is why its own name is the only one here.
test("only clock.ts starts a repeating timer", () => {
  expect(filesSpelling(/setInterval\s*\(/)).toEqual(["clock.ts"])
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
// constant again is what writing the third copy looks like from here. ONE name
// now: the number was declared in `edit/undoing.ts` while the type it belongs
// to lived there, and both moved out to the module that counts it down.
test("only saying.ts counts SAID_MS down", () => {
  expect(filesSpelling(/\bSAID_MS\b/)).toEqual(["saying.ts"])
})

// routes.ts's monopoly, and finding 4's (a) from the debate on some of these
// sweeps (https://github.com/juspay/oss.olai/blob/main/projects/olai/lowy-electricity/debate-2026-08-19.md): ONE door decides "is
// this string one of our addresses". `routeNamed` is the only reading of the
// format's grammar in this client, and a `parseAddress(` anywhere else is a
// second answer free to disagree with the first — a pin and a written link
// that open two pages for one address, which is the exact shape
// `address/address.ts` exists to refuse (it delegates: its `routeIn` call is
// the door's, and `address.test.ts` holds the two to one answer). A codec
// may SPLIT a URL without recognising anything — `workspace.ts` reads the
// format's `splitAddress` for its `/s/` rows and hands every page segment
// back to `routeOf` — so the grip is the grammar's own entry point, where a
// recognizer must start.
test("address recognition has one door: parseAddress( is called only in routes.ts", () => {
  expect(filesSpelling(/parseAddress\s*\(/)).toEqual(["routes.ts"])
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

// And the edge those two cannot see: HOW the door itself is spelled, which is
// finding 4's (b). A `createArrival` call site hands the bundler its
// `import()` with a LITERAL specifier in the caller, because the bundler
// READS a literal to cut the chunk — a variable or a computed name compiles
// and passes every test here while the split quietly goes: the graph back
// into `main-*.js` behind a specifier the bundler folded in, or a runtime
// string nothing can resolve. Both `chunk.ts` headers say this in comments
// next to their own import, and arriving.ts says it in the `@param fetch` —
// three comments saying one rule, which is the reason the rule lives here.
//
// The grip is EVERY dynamic `import(` in the client, since a future chunk is
// the same law, and the law is the argument's WHOLE SHAPE: one quoted string,
// closed, then the paren. Checking only the first character lets a computed
// name in through a literal's clothing — `import("./x" + suffix)` opens with
// a quote (grok's review of this pin found that) — and the bundler cannot cut
// on it either. A variable and a template are the same refusal: computed is
// computed. And the SPELLERS are named, so the sweep cannot pass vacuously the
// day both chunks fold back into the entry: the two fetch doors, one test
// baking its own subject in (`inlinePicker.test.ts`, which has to stub
// `dismiss.ts` before the subject that imports it is loaded), and
// `layout/Rail.tsx`'s erased TYPE import — the stripper lifts comments, not
// types, and TypeScript already forces THAT specifier to be a literal.
//
// A SECOND SUCH TEST IS `declared.browsertest.ts`, which mocks the wire module
// before the subject that imports it is loaded — and the LAW is not this
// directory's alone. The bundle is this package's build script and
// a plugin's browser half is INSIDE it, mounted through the registry's
// generated `import()`, which is a chunk boundary rather than an exemption: a
// computed specifier over there cuts nothing just as surely, and this sweep
// reads only this directory. So the same whole-shape grip is swept a second
// time over the panel's own tree, in
// `packages/plugins/chat/src/browser/claims.test.ts`.
/**
 * THE ONE FILE THAT COMPUTES A SPECIFIER, and it is the rule's own limit rather
 * than a hole in it.
 *
 * The law above is *a computed specifier cuts no chunk*, and everything it
 * protects rests on there BEING a chunk to cut: a module in this tree, in this
 * bundle, that the bundler would otherwise fold back into the entry. A plugin
 * the VAULT defines has none. Its source did not exist when this bundle was
 * built — an agent wrote it into a directory this serve is about, and the serve
 * compiled it — so what `wire.ts` names is a URL the ROSTER carries, answered by
 * `/_olai/plugins/<name>-<version>.js`, and there is nothing for the build to
 * have split.
 *
 * So the two failures the law exists to prevent are both unreachable here: the
 * graph cannot fold back into `main-*.js`, because it is not in the graph, and
 * the specifier cannot fail to resolve at runtime, because it is a URL the
 * server just told this tab it is serving.
 *
 * ONE FILE, NAMED, for the reason the `filesSpelling` list below is named: an
 * exemption that was a pattern rather than a name would quietly cover the next
 * computed `import()` somebody writes for an ordinary chunk, which is exactly
 * the mistake this test was written after.
 */
const COMPUTED_BY_DESIGN: ReadonlyArray<string> = ["wire.ts"]

test("every dynamic import() the client spells takes a literal the bundler can read", () => {
  // The opener, then the one shape the bundler can read: a complete quoted
  // specifier — escapes allowed, the other quote allowed inside — followed by
  // the closing paren. Anything beyond it (an operator, another argument) is
  // a computed name in a literal's clothing.
  const ARG_GEN = /^(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')\s*\)/
  const offenders = SOURCES.filter((one) =>
    !COMPUTED_BY_DESIGN.includes(one.file) &&
    [...one.code.matchAll(/\bimport\s*\(\s*/g)].some(
      (hit) => !ARG_GEN.test(one.code.slice(hit.index + hit[0].length)),
    ),
  ).map((one) => one.file)
  expect(offenders).toEqual([])
  expect(filesSpelling(/\bimport\s*\(/)).toEqual([
    // `mock.module` first, `await import` after — a static import would be
    // hoisted above the mock, which is that file's own header argument.
    "declared.browsertest.ts",
    "inlinePicker.test.ts",
    path.join("layout", "Rail.tsx"),
    path.join("markdown", "chunk.ts"),
    path.join("menu", "chunk.ts"),
    // ...and the one that computes one, which is {@link COMPUTED_BY_DESIGN}'s
    // whole argument: a plugin the vault defines is fetched from the serve that
    // compiled it, at a URL the roster carries.
    "wire.ts",
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
// Escape on the window and a press on their own scrims. Each has a reason
// written where it joins, and the list is short on purpose — a fourth joiner
// here is either a panel that had to hand-roll its dismissal (worth arguing
// about) or one that wanted the stack and skipped the dismissal, which is a
// panel nothing shuts.
//
// A FIFTH USED TO BE ON IT and is a package away: the chat composer's
// completion list, which takes keys in the capture phase ahead of everything
// and holds a ticket so that "first" means first among the layers on screen.
// The panel's own file went with the panel, and the RULE did not: `topmost.ts`
// is still this client's, the stack is still the tab's one stack, and a face in
// a plugin that took a ticket and shut by nothing would be exactly the bug
// `features/dismiss_stack.feature` exists about — with the difference that this
// sweep can no longer see it. So the joiners on the far side are swept over
// there, in `packages/plugins/chat/src/browser/claims.test.ts`.
test("the stack is joined directly only where the gestures are not dismissOn's", () => {
  expect(filesSpelling(/topmostWhileOpen/)).toEqual([
    "dismiss.ts",
    path.join("menu", "Dropdown.tsx"),
    path.join("palette", "Palette.tsx"),
    path.join("palette", "Shortcuts.tsx"),
    "topmost.ts",
  ])
})
