/**
 * Claims this plugin's browser half makes about WHERE things are spelled, held
 * as sweeps over its own directory rather than as sentences.
 *
 * `@olai/web`'s `src/client/claims.test.ts` is the parent of this file and
 * still the larger half of it. Its opening argument holds here word for word —
 * a claim in a docstring is checked at review time by whoever happens to
 * remember it, a claim swept is checked on every run and the failure names the
 * file that broke it — and so does the rest of its method: the sweeps grip the
 * CALL and the SPELLING rather than the import path, comments are stripped
 * before matching because these are claims about code, and every list is an
 * EQUALITY, so a pattern that rotted reports an empty list instead of passing.
 *
 * ## Why a second file exists at all
 *
 * A sweep can only see the directory it walks, and the panel left the one the
 * parent walks. When the tab's chat and agents moved out of
 * `packages/web/src/client/{chat,agents}/` into this package, six recorded
 * lists went red at once — five in that file and one in `errors/banner.test.ts`
 * — not because a rule had been broken but because the FILES each rule was
 * recorded against were a package away, and a list of names that no longer
 * resolve is a claim that has quietly stopped asking anything. The repair is
 * the same one the testids took and the CI chip's bench took before them: a
 * claim goes where its subject is.
 *
 * ## Which claims are here, and why
 *
 * TWO CAME WHOLE, because every name on their lists was a chat file and there
 * was nothing left of them on the other side — what a tool call's status may be
 * spelled as, and the two callers that put the open preview away. They are
 * below with their arguments intact, because the argument is the part that
 * would not survive a rewrite: each one records a judgement about a bug that
 * actually happened.
 *
 * FOUR ARE ALSO STILL THERE, on lists that still name core files, and they are
 * repeated here rather than moved because their subject is not the panel — it
 * is a rule every face in this app keeps whichever package draws it. The
 * readout's states, the bundler's literal, the dismissal stack and the error
 * report's rows are all core's machinery reached through `@olai/web/client/*`,
 * and this tree reaches all four. A rule about a shared thing has to be swept
 * on both sides of a package wall or it is only swept where nothing was going
 * to break it — and the half that goes green on its own is the dangerous half,
 * because a list that shrank looks exactly like a list that was obeyed.
 *
 * The criterion is what the rule is ABOUT rather than where it was written.
 * `chrome.ts`'s monopoly on `document.title` is the shape that does NOT come
 * here: it is one module's composition of one tab's name, and its readers and
 * its writer are the same package's. What comes here is the rule whose failure
 * mode this tree can produce on its own — a face branching on `"degraded"`, a
 * computed `import()` specifier, a panel that joins the stack and shuts
 * nothing, a fourth surface enumerating somebody else's broken files.
 *
 * ## The stripper is copied, deliberately
 *
 * `@olai/tests`' `support/sweep.ts` carries the same one-pass stripper with its
 * argument and both fixtures written out, and its own header says why neither
 * this file nor the parent is a caller: those sweeps ask about what the
 * REPOSITORY owns, these ask about one directory, and the dependency between
 * the packages runs the other way. The parent copies it for that reason and so
 * does this, which makes three — the price of a shared corpus being the wrong
 * corpus.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

const BROWSER = import.meta.dirname
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
 *  swallows a stretch of real code and the sweep passes without reading it. */
const codeOf = (file: string): string =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "")

/** Every source file under this plugin's browser half — directory-relative path
 *  and stripped code, read ONCE for however many sweeps accrue below. The
 *  `.browsertest.ts` files are in it: they are source of this tree that a face
 *  is written against, and one of them is a recorded exception twice over. This
 *  file is excluded, for the parent's reason: the sweeps quote the spellings
 *  they hunt, and a sweep that caught its own net would teach the next reader to
 *  weaken the pattern rather than the code. */
const SOURCES: ReadonlyArray<{ file: string; code: string }> = fs
  .readdirSync(BROWSER, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((full) => full !== SELF)
  .map((full) => ({ file: path.relative(BROWSER, full), code: codeOf(full) }))

/** Where each file that matched is, so a failure is a file list rather than
 *  a boolean. */
const filesSpelling = (pattern: RegExp): ReadonlyArray<string> =>
  SOURCES
    .filter((one) => pattern.test(one.code))
    .map((one) => one.file)
    .sort()

// ─── Claims that came here whole, because their subject did ──────────────────

// What a tool call's status LOOKS like is the frame's; what it MEANS is
// `@olai/surface`'s (`isRunningStatus`), because the SERVER asks it too.
// `?? "pending"` used to be written twice in the client for one convention the
// writer already applied; the union made the field required on a tool row and
// the default left. What remains is the LOOK, and the fixtures that mint a tool
// row — they must name a status now, which is the type doing its job rather
// than a third opinion about the wire. A production file other than the frame
// uttering a status is a face deciding for itself what ACP meant.
//
// ONE ENTRY USED TO BE A DIFFERENT VOCABULARY sharing a word, and its departure
// is worth a line rather than a silent deletion. odu names a CI node that has
// not begun `pending` too, so the CI chip's own bench spelled it as the fixture
// of the thing under test, and it was listed because what this sweep claims is
// about PRODUCTION faces and ACP's closed set — a bench naming its own
// subject's vocabulary is what a bench does. That bench is `olai-plugin-odu`'s
// now and no sweep of one tree can read another's.
//
// The judgements it recorded did NOT leave with it, and both were about
// PRODUCTION faces: the CI words say "the run is up" where the connection
// readout owns the one-word spelling, and the CI chip's attribute is
// `data-state` where `SaidLine.tsx` owns `data-tone`. Those are held where they
// are now spelled — in that package, against that package's faces.
//
// IT IS HERE FOR EXACTLY THAT REASON, one turn of the same crank. Every name on
// this list was a `chat/` file, so when the panel left `@olai/web`'s client the
// claim had no subject left on that side: the sweep there would have held the
// empty list — "nobody in core utters an ACP status", true and about nothing —
// while the nine faces and fixtures it was written against went unswept. The
// list is the one that stood there, minus the directory that is now the root of
// this sweep.
test("a tool call's status is spelled where it is meant and where it is drawn", () => {
  const statuses = /["'`](pending|in_progress)["'`]/
  expect(filesSpelling(statuses)).toEqual([
    path.join("chat", "ToolFrame.tsx"),
    path.join("chat", "background.test.ts"),
    path.join("chat", "door.test.ts"),
    path.join("chat", "elapsed.test.ts"),
    path.join("chat", "lanes.test.ts"),
    path.join("chat", "order.test.ts"),
    path.join("chat", "rail.test.ts"),
    path.join("chat", "rows.testlib.ts"),
    path.join("chat", "spawn.test.ts"),
  ])
})

// previewing.ts's claim — that the open shelf is put away when the conversation
// changes. It is a LIFETIME rather than a rule, so what pins it is the CALL: the
// module documented the clearing and nothing did it, and the reason that
// survived a read is that the failure hides — a shelf whose key names a row this
// conversation does not have simply draws nothing. What it cannot hide is a
// COLLISION, the day a server restarts without a page reload and a fresh
// transcript re-mints keys from the same counter: a shelf nobody pressed, open
// on somebody else's third tool call.
//
// TWO CALLERS, and NEITHER of them is a reader putting the shelf away: the
// shelf's own × was retired (the human, 2026-08-28) and closing is the door's
// job now, so what is left is the question banner — which shuts this to reveal
// the form it points at — and the cell that is the only thing which knows a
// conversation changed. The count is the same and the list is the same; what
// changed is that a control which meant "I am done with this AGENT" is gone
// from it, which is the thing this test would otherwise let back in.
//
// AND IT CAME HERE UNCHANGED. Three names, all of them the panel's, over a
// function the panel declares: `previewing.ts` is in this tree and so is every
// caller it could ever have, so there was never a half of this claim for core
// to keep. Only the directory the paths are relative to has moved.
test("the open preview is put away for a reason of the panel's, never as a dismissal", () => {
  expect(filesSpelling(/closePreview\s*\(\s*\)/)).toEqual([
    path.join("chat", "Preview.tsx"),
    path.join("chat", "previewing.test.ts"),
    path.join("chat", "state.ts"),
  ])
})

// ─── Claims core still keeps, swept again on this side of the wall ───────────

// `connection/status.ts`'s claim, which is core's module and this tree's
// obligation: it "says what each of the five looks like, and nothing else about
// them" is only safe if nothing else READS them raw. The panel is downstream of
// that readout like every other face — it takes it whole (a prop, a `data-`
// attribute) or goes through `lookOf` — and the day a component here branches on
// `"retired"` itself, the sixth state lands in a package core's sweep cannot
// see. That is the whole reason this one is repeated rather than left behind: a
// monopoly held only over the modules that happen to share a directory with the
// definition is not a monopoly.
//
// ONE LEGITIMATE SPELLER, and it is a fixture rather than a face:
// `chat/declared.browsertest.ts` mocks the wire, and a module that asks nothing
// into a dead socket has to be handed a live one to be asked at all. It does not
// branch on a state in the app; it stands in for the table that does. Core's own
// list carries the other four spellers — the readout, its look table, and the
// two benches over which states may carry a question and send `app.get` — and
// its doc block records that this entry went with the panel.
test("nothing in the panel reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  // EMPTY, and that is the claim rather than a gap: nothing the panel draws
  // branches on a raw readout state. The one fixture that used to be recorded
  // here is `@olai/web`'s `declared.browsertest.ts`, which stayed with the batch
  // door it drives — the outline page reads that door too.
  expect(filesSpelling(states)).toEqual([])
})

// The BUNDLER's law, which is core's build script and everybody's rule. A
// dynamic `import()` hands the bundler its specifier as a LITERAL in the caller,
// because the bundler READS a literal to cut the chunk — a variable or a
// computed name compiles and passes every test while the split quietly goes:
// the graph folded back into `main-*.js` behind a specifier the bundler
// inlined, or a runtime string nothing can resolve. Nothing in the source looks
// wrong on the day it is undone, which is why it is swept rather than reviewed.
//
// THIS TREE IS INSIDE THAT BUNDLE — the registry mounts this plugin's browser
// half through a generated `import()`, which is a chunk boundary rather than an
// exemption — so the law reaches every file below it, and core's sweep stops at
// its own directory. Repeated here for that reason, and not weakened by a line:
// the same whole-shape grip (one quoted string, closed, then the paren), because
// checking only the first character lets `import("./x" + suffix)` in through a
// literal's clothing, and the bundler cannot cut on that either.
//
// The SPELLERS are named as well, so the sweep cannot pass vacuously the day
// this half stops splitting anything at all. One name: the browsertest that
// replaces the wire module before the subject which imports it is loaded, and
// whose `import()` is therefore its own subject rather than a chunk.
test("every dynamic import() this tree spells takes a literal the bundler can read", () => {
  // The opener, then the one shape the bundler can read: a complete quoted
  // specifier — escapes allowed, the other quote allowed inside — followed by
  // the closing paren. Anything beyond it (an operator, another argument) is a
  // computed name in a literal's clothing.
  const ARG_GEN = /^(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')\s*\)/
  const offenders = SOURCES.filter((one) =>
    [...one.code.matchAll(/\bimport\s*\(\s*/g)].some(
      (hit) => !ARG_GEN.test(one.code.slice(hit.index + hit[0].length)),
    ),
  ).map((one) => one.file)
  expect(offenders).toEqual([])
  // EMPTY for the reason above, and the OFFENDER check beside it is the half
  // that matters: a computed specifier in this tree cuts the bundle just as
  // surely as one in core's, and this is where that is asked of the panel.
  expect(filesSpelling(/\bimport\s*\(/)).toEqual([])
})

// `dismiss.ts`'s stack, from the side that joins it without its gestures. The
// two gestures that shut a panel are spelled in ONE file over in core, which
// since the layer stack is also the claim that every dismissable is ON that
// stack; the short list beside it is the panels whose gestures are somebody
// else's, each with a reason written where it joins. A joiner with no such
// reason is either a panel that had to hand-roll its dismissal (worth arguing
// about) or one that wanted the stack and skipped the dismissal, which is a
// panel nothing shuts.
//
// A PANEL IS A PANEL WHICHEVER PACKAGE DRAWS IT, which is why this is the third
// rule repeated rather than moved. `topmostWhileOpen` is imported from
// `@olai/web/client/topmost.ts`; the stack it joins is the tab's one stack, and
// a face here that took a ticket and shut by nothing would be exactly the bug
// `features/dismiss_stack.feature` exists about — invisible to core's sweep, and
// the one thing a scenario about the other panels would never catch.
//
// ONE JOINER, and its reason is written at the join: the composer's completion
// list binds the document in the CAPTURE phase and takes the key outright, which
// is the stack's rule inverted when something is over it, so it holds a ticket
// to say what "first" means among the layers actually on screen. Its own
// existence is its open state — the composer mounts it only while there is a
// list — which is why the ticket is `() => true`.
test("the stack is joined directly only where the gestures are not dismissOn's", () => {
  expect(filesSpelling(/topmostWhileOpen/)).toEqual([
    path.join("chat", "CompletionMenu.tsx"),
  ])
})

// `errors/banner.test.ts`'s sweep, from the fourth side of it. `Report.tsx`
// draws the rows of a broken outline and `Rows` is how one file's are drawn,
// and the surfaces entitled to reach them are the ones whose whole promise is
// that nothing is summarised away. A caller that is NOT one of those is how the
// flood of 2026-08-25 came back — a banner at the top of every page inlining
// another file's 135 rows, with the reader's own page pushed off the bottom of
// the screen.
//
// THE ROWS ARE EXPORTED, which is why this is the fourth rule repeated rather
// than a core matter: `@olai/web/client/errors/Report.tsx` is reachable from
// every package that draws in this app, and a face over here that enumerated
// somebody else's broken files would flood a panel exactly as a banner floods a
// page — while the walk of `src/client/` that holds the other three callers
// cannot see one line of this tree.
//
// ONE CALLER, and it is entitled for a reason that is not the other two's: a
// refused WRITE shows the person whose write was refused the rows the gate
// judged. That is the reader's own action being answered, not a banner over
// anybody's page, and it is bounded by what they asked for.
//
// The pattern is the IMPORT rather than a spelling, because the mistake has no
// other fingerprint — the rows are still on the verdict, still reachable, and
// still right to draw here. It cannot be anchored to the start of a line the
// way core's is: a specifier that crosses the package wall is long enough to be
// wrapped, so what is gripped is `from "…Report.tsx"` wherever it sits.
test("only a refused write draws the error report's rows in this tree", () => {
  expect(filesSpelling(/from\s*"[^"]*Report\.tsx"/)).toEqual([
    path.join("chat", "Refusal.tsx"),
  ])
})

/**
 * ONE SPELLING OF A LIVE CUE, and `./chat/live.ts`'s own header promises this
 * sweep by name.
 *
 * The header says it in as many words: *a constant, a reason, and a sweep in
 * `claims.test.ts` so the third site that needs a live cue imports this rather
 * than retyping it. Without that sweep the two copies agreed only by
 * coincidence, with a comment in one of them asserting they did.* The sweep was
 * never written — the sentence pointed at a file in `@olai/web` that had no such
 * case in it, which is a claim that reads as kept and is not — and the panel's
 * move is where it is owed, because this is now the tree the four callers are
 * in.
 *
 * WHAT IS GRIPPED IS THE CLASSES rather than the import, and that is the whole
 * point: an import is what a correct file does, so a claim over imports would
 * have been green over the copy it exists to catch. A file that TYPED the
 * classes out is what goes wrong, and the recorded answer is the one module
 * that may.
 */
test("the live cue's classes are typed in exactly one file", () => {
  expect(filesSpelling(/animate-pulse[^"]*rounded-full[^"]*bg-doing/)).toEqual([
    path.join("chat", "live.ts"),
  ])
})
