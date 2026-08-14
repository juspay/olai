# @olai/web — the SolidJS client, and the build that produces it

An app header (wordmark, connection, the one git pill, agent toggle,
preferences), a directory panel
(month + file tree of every outline and document under the folders they live
in — full column or a ~3rem icon rail on desktop; slide-over drawer with scrim
on a phone), a resizable agent dock (or bottom sheet on a phone; minimized to a
pill / thumb strip carrying the last agent message), and one page open in the
main pane — a whole outline, one node zoomed, a document, or one day — kept
current by the live store underneath. ⌘K opens the command-palette shell
(navigation, panel toggles, `>` to ask the agent). SolidJS over a WebSocket,
styled with Tailwind v4, bundled by `Bun.build`.

`src/build.ts` composes `buildSurfaceClient` and adds only what is olai's: the
Solid JSX transform, the Tailwind stylesheet, the fonts, and the install
surface's icons. Everything else about the dist is the helper's and is not an
option — the content-hashed `/assets/*` names, the `no-store` shell that points
at them, the `.br`/`.zst`/`.gz` siblings the static layer negotiates, and the
chunk a dynamic `import()` asks for. This package wrote two of those by hand
until kolu#2159: a `precompress.ts` that could never emit the `.zst` the server
has preferred all along, and a second `Bun.build` for the markdown chunk because
`splitting` was hardcoded off. Both are deleted rather than moved.

## What the client reads, and how it is put back together

`src/client/outlines.ts` is the whole read side, and it is two subscriptions:
the `outlines` COLLECTION — one entry per outline file, keyed by root-relative
path, served with batched `deltas` so an edit sends that file's entry and not
the corpus — and the `manifest` CELL, which carries what belongs to no one file
(today, the documents with their text).

Everything above it is derived from those: the sidebar's file tree is the
collection's outline keys plus the manifest's document paths, grouped by
directory (`fileTree.ts`, order from `paths.ts` because a key set has arrival
order and a directory has path order), the one derivation the whole app reads
is `derive` over every entry's nodes — the same call the validator makes —
and which files are unreadable is the entries that carry a `broken`.

The manifest is what DECIDES the page, because it is the member that can say
all three of the things a reader can be looking at: no frame yet (waiting),
`null` (nothing has ever validated, so the error report is the page), a value
(here is your directory). An empty collection cannot — a directory with no
outlines in it looks exactly like a first probe that has not finished.

Entries of one revision arrive together, and entries of different revisions
coexist: only the files that moved are upserted, so an unchanged neighbour keeps
an older `rev`. Nothing here reads `rev` to decide anything, which is what makes
that safe — every view is derived from what the entries currently say.

**The write side is not a second model of any of that.** The keyboard's edits
are surface PROCEDURES (`edit/`), the collections stay read-only on the wire,
and what a reader sees of an edit is the file arriving on the same
subscription every other change does. So there is nothing to reconcile, no
optimistic row, and two tabs cannot disagree about what landed.

## Three ways to say what is wrong about the FILES, because there are three situations

They live in `src/client/errors/`, and which one a reader gets is decided by
what is still on screen rather than by how bad the errors are.

- **`Page.tsx`** — nothing has ever loaded, so the report *is* the page: every
  error, grouped by the file that has to be edited, with the ones implicating
  two files kept apart.
- **`Banner.tsx`** — it loaded once and the files have since stopped
  validating. The last good tree stays exactly where it was, under a banner
  saying it is not the files as they are now.
- **`Broken.tsx`** — one file will not parse and the rest are fine. That
  outline's own pane carries its errors, the sidebar marks it, and every other
  outline stays live.

All three render their rows through `errors/Report.tsx`, so a `file:line` looks
the same wherever it is read and none of the three can quietly start
summarising.

The client computes nothing about the format on its own. `@olai/format` derives
status, sibling order, mirror expansion, a node's ancestry and the guard that
stops a mirror inside its own subtree, and hands back rows; `Tree.tsx` turns a
row into markup and nothing else. The gutter is Workflowy-shaped: a hover-reveal
strip (`NodeMenu.tsx` `•••` + the collapse triangle; the triangle is always
visible on a phone and the `•••` is not drawn there at all, where a long press
on the row opens the same menu — see `touch.ts`) left of a filled-circle bullet (`Bullet.tsx`, with a gray halo
when children are hidden), then the MARK COLUMN (`Checkbox.tsx`: CSS squares —
checked for done, half-filled for doing, EMPTY for todo, and no box at all on a
node carrying none of them, because a bullet is not a task; display-only —
the mark is toggled from the row's editor). Titles render inline-only markdown
and `#tags` as subtle pills (`NodeTitle.tsx` / `markdown/title.ts`), and the
editor shows that markdown as the SOURCE it is while a row is being typed.
A node's
free cross-references (`SeeRefs.tsx`) each link to `/n/<id>` with the target's
title, resolved at view time through the same indexes.

The typeface is a pick, like the theme, but the catalog is not this package's:
[`@olai/fonts`](../fonts/README.md) owns the table, the sheet generated from it
and the derivation that produces the faces. What is here is the PICK — the
`data-font` attribute this browser is in (`theme/fontState.ts`), the select
that changes it (`theme/FontSelect.tsx`), and the two places a name is spelled
by hand and held to the catalog by `theme/fonts.test.ts` (the shell's boot
script, and the `@theme` block Tailwind reads `--font-*` out of). The default
is Atkinson Hyperlegible — one voice on the page, the chrome, and the notes.
The Olai row keeps three jobs distinct (Literata / iA Writer Quattro /
iA Writer Mono). Hosted files are woff2 by the time this build sees them
(`OLAI_FONTS_DIR`, converted once in the Nix store), and `build.ts` copies
them to `/fonts/` by name — no CDN, no font binary in the repo, and no
conversion per build. Generics download nothing. Eleven theme tokens
paint every surface (`theme/palettes.ts`); the look follows every palette,
dark and light. The outline sits on `paper`; the header, sidebar and agent
dock sit on `desk`; a card or popover is `panel`; a filled chip is `pill`.

What a node cannot start until is answered in that same mark column (resolved
2026-08-11, human): an `after` target that is a task and not done is in the
way, an unmarked one never is, and a row that is waiting draws an hourglass
where its box would be — toned with the mark it stands in for, since either
`todo` or `doing` can be blocked — with the row dimmed behind it (`blocked.ts`,
applied to the row's line and body rather than to the `<li>`, because opacity
compounds through a subtree). "Has this started" and "can it start" are the
same kind of question about the same node, so they are answered in the same
place. The NAMES live where there is room for them: an `aria-label` on the
glyph, so nothing is hover-only; a tip this app places itself (`Tip.tsx` +
`tip.ts`, which is the clamp, unit-tested, because the platform's own tooltip
ran a long one off the right edge of the window); and the full list on the
node's own page (`Blocked.tsx` through the shared `NodeRefs.tsx`), which is
where the glyph's click goes — the box is display-only wherever it is drawn, so
the click was free to mean the obvious thing.
The view and the validator agree about what a file means because they run the
same code, not because two implementations were written to the same paragraph.
The one thing this package does interpret is MARKDOWN, rendered and sanitised at
view time.

### And a fourth, for when the client itself is what is wrong

The three above are errors as DATA — read off the wire and drawn on purpose —
so none of them can say anything about a bug in this client: a render that has
thrown is not running the code that would draw them, and what a reader got was
a white tab with the truth in a console they had no reason to open. So the
shell is wrapped in kolu's `SurfaceFaultBoundary` (`main.tsx` — composed
standalone, since this root does not ride `SurfaceAppProvider`), and
`errors/Fault.tsx` is the LOOK it draws with: what threw — printed upstream by
the framework's `thrownText`, handed here as text, verbatim — and the two ways
out — a reload for a bundle that is stale, and `/` for a page that is poison,
because a fault is usually deterministic for the route it happened on and
Reload alone would be a loop. A boundary SWALLOWS, so the framework's boundary
also records the fault to the console once: otherwise the truth is in no
console at all, and a browser test meets it as a timeout on a missing element.
There is no way to ASK the app for one —
`features/the_client_breaks.feature` injects a fault from outside the bundle,
and says why at length.

## Markdown, and documents

`src/client/markdown/` is one pipeline for every piece of markdown this app
draws — a node's note, a whole `.md` document, what the agent says in the
chat panel, and a node's title. They are the same language read out of the same
directory (an agent writing a fenced diff into the panel and a person writing
one into a note are doing the same thing), and a second pipeline for any of
them would be a second dialect nobody asked for: footnotes in one place and not
the other, a highlighter kept in step by hand. Parse with GFM, to HTML, anchor the headings,

sanitise, highlight, rewrite, stringify:

- **the heading anchors run BEFORE the sanitiser**, which is the other half of
  the rule below. `rehype-slug` gives every heading an id made from its own
  text and `rehype-autolink-headings` puts a link beside it (`anchors.ts`) — so
  the input is a heading somebody WROTE, and what it produces is checked by the
  allowlist rather than trusted for arriving late.
- **the allowlist is `sanitise.ts`**, its own module, because it is the
  security boundary: one file to review, and a feature that wants something
  from it has to come there to ask. Named additions only, and there is exactly
  one — the class VALUE `olai-md-anchor` on `a`, added to the value-restricted
  entry the default already has for the footnote backref. Nothing else moved:
  `id` on a heading and `href="#…"` were already allowed, which is how
  footnotes have always worked. `sanitise.test.ts` holds the whole schema to
  "one value more than upstream, and nothing else", asserted against the
  default rather than a copy of it.
- **highlighting runs after the sanitiser**, deliberately. The `hljs-` spans
  are ours, produced from the code's own text, so they need no allowlist entry
  — while the `language-…` class that produced them is the reader's, and is on
  the sanitiser's default allowlist. `rehype-highlight` is shipped by this
  server: it is in `bun.lock`, so the Nix build fetches it like everything
  else, and no page asks a CDN for the code that renders someone's private
  outline. (It travels in the markdown chunk below rather than in the entry
  bundle — same origin, same immutable pin, same bytes CI built.) The colours
  are this theme's tokens, so a fence follows the light/dark palette the rest
  of the page does. Which grammars it
  knows is spelled out (`pipeline.ts`), because the option REPLACES the default
  set rather than adding to it: lowlight's common set, plus Nix — this
  repository is built with it and `just serve` with no arguments serves its own
  `docs/`, where a ```nix fence would otherwise be grey text. A language nobody
  registered is not an error; the block is drawn as what it is.
- **`rewrite.ts`** is a walk over the finished tree rather than a plugin, which
  is what lets the pipeline be built once — the highlighter registers three
  dozen languages when it is attached, and a pipeline rebuilt per note would
  pay for that on every row of every frame. It answers the three questions only
  this app can: a relative picture becomes a `/media/…` URL and anything else
  is not drawn at all, a relative link to another `.md` becomes that document's
  `/doc/<path>` — resolved beside the file it was WRITTEN in (`@olai/format`'s
  `documentOf`), which is what makes a link in a note drawn on `/d/<date>` land
  where the writer meant instead of wherever the browser would resolve it, with
  any fragment carried through untouched and every other link left exactly as
  written — and every id (and every link into the same block) is
  re-minted under a prefix derived from the block itself, so the first footnote
  of one note cannot answer for the first footnote of the next — and, now, so
  that two notes both opening `## Shape` cannot answer for each other either.
  On its way through it REPORTS the heading tree (`outline.ts`), because the
  ids a contents has to name do not exist until this pass has run.
  The other end of that link is `router.tsx`'s `followed`, beside `<Link>`
  because this module is the one allowed to change the address: rendered
  markdown reaches the page as HTML through `innerHTML`, so its anchors belong
  to no component and cannot be a `<Link>` — without it, moving between two
  files of one directory would be a full document load. One delegated listener
  on the main pane rather than one per rendered block, and on the pane rather
  than inside `<Markdown>` because the chat panel draws the same markdown
  outside the router. What counts as a click this app may answer is one
  predicate both it and `<Link>` read, so a modified click (a reader asking for
  the browser's behaviour) and a click something deeper already answered mean
  the same thing whichever wrote the markup.

- **titles are inline-only** (`renderTitle` → `renderToTree` + `inline.ts`).
  Same pipeline, then every block is unwrapped to phrasing, then `#tags` are
  styled by walking text nodes (skipping `code` and `a` so constructs stay
  whole; the alphabet is `titleTagRe` from `@olai/format` — `tags.ts`), then
  stringify.
  When the pipeline loses text the source still accounts for — empty, or
  shorter than the source with markdown marks removed — fall back to the
  escaped source. Breadcrumbs and see-refs pass `links: false` so a markdown
  link in a title cannot nest `<a>` inside the surrounding `Link`. Titles keep
  their own cache; they are short and numerous, and would thrash the
  note/document map if they shared it.

### It arrives when it is needed

All of that is ~390 kB raw (~95 kB brotli) of `unified`, remark, rehype and
`highlight.js` grammars, and the first thing this app draws — a tree of rows —
uses none of it. So the pipeline is a CHUNK of its own
(`markdown/pipeline.ts` → `/assets/pipeline-<hash>.js`) and is fetched the first
time something on the page has markdown to interpret. The entry is ~700 kB raw
(~185 kB brotli) with the pipeline out of it, against 1 054 kB with it in.

- **the `import()` is the whole of the request.** `markdown/chunk.ts` names
  `./pipeline.ts` literally; `buildSurfaceClient` splits on a dynamic import and
  hashes chunks the same way it hashes the entry, so the chunk lands in the same
  immutable `/assets/` dir and the entry references it by a URL that resolves
  inside it. Nothing spells that URL: this used to be a `<meta>` on the shell,
  rewritten by a second `Bun.build` of this package's own, because
  `splitting` was hardcoded off upstream — three moving parts to say what one
  `import()` says (kolu#2159 paid it in and they are all deleted).
- **asking is what fetches it.** `markdownReady()` is a signal read: a memo
  that asks is a memo that re-runs when the file lands, and a page that never
  asks never pays. Nothing is primed at boot.
- **titles mostly do not ask at all** (`markdown/plain.ts`). A title with no
  markdown in it — 88 of the 93 in this repository's own roadmap — is words
  and tags, and interpreting it and escaping it are the same operation. So
  those are written out immediately, with no parser and no flash. It is a
  REFUSAL rather than a second dialect: anything that could possibly be
  markdown is handed to the real pipeline, and `plain.test.ts` sweeps a
  generated corpus to prove that everything it does accept renders byte for
  byte the way the pipeline would.
- **what is on the page in the meantime is the file's own text** — the source,
  escaped, `pre-wrap` for a document or a note, the raw title for a title.
  Marks visible for a moment is a thing a reader can read; a blank space is
  not. If the fetch FAILS, `Markdown.tsx` says so above that text and the
  console gets the error: the page stays readable and does not pretend.
  `features/markdown_arrives.feature` holds all of it — including that an
  outline of plain titles never asks at all — by holding the chunk up in the
  network layer.

A document is surveyed and jumped around through those anchors:
`document/Toc.tsx` draws a collapsible contents above the body, derived from
that heading tree at view time and stored nowhere, so it cannot disagree with
the text and needs nothing on the wire (the body already arrives one at a
time — `document/documents.tsx`). It sits IN the page rather than in a floating
rail beside it: the complaint is "I cannot survey this", and a list met on the
way in answers that where furniture beside the text does not — and there is no
column for a rail below 48rem. Documents only. A note gets the ids and the
links; it does not get a contents, because a note is a tree row and not a page.

**A fragment is good for as long as the body is unedited, and no longer.** The
`md-…` namespace is an FNV-1a hash of the WHOLE rendered block — the file path
and the entire source, not the heading — so editing a typo in the last
paragraph remints every heading id in the document at once, and every anchor
URL anyone copied out of it stops resolving. It is not "the heading text
changed"; it is any change at all, to any part of the text. That is the price
of the mint rule (`rewrite.ts`): every id on a page belongs to the block it is
in, and a heading exempted from it is a heading that can collide with the one
in the note above. Surveying and jumping inside an open page are unaffected —
the contents is derived from the same render as the ids it points at, so the
two cannot disagree. A fragment that outlives an edit would need a per-block
name that is not the block's text, which is a different change and not this
one.

How that markdown is SET is the other half. The numbers are **not** in the
stylesheet: `src/client/theme/scale.ts` declares the type scale and the two
spacing scales, `src/build.ts` generates the CSS from it (the same arrangement
the palettes use), and every rule in `styles.css` reads a custom property. That
is what makes the rhythm testable — `packages/tests` walks a rendered document
and a rendered note and asserts every computed size, gap, pad, weight and
border is a value from those sets, so a drive-by `margin: 6px` is red rather
than invisible.

Two densities, because there are two kinds of place. A **document** is a
reading page — the whole main pane, opened to be read — and is set like one. A
**compact** block is markdown inside the app's furniture: a note under a node's
title, the document an open node attaches, an agent's reply in the drawer. Same
proportions one notch tighter, plus a ceiling on the heading sizes, since all
three hang under a title the page owns (`olai-md-compact`, added by the three
components that know which they are).

The rules with a reason behind them: prose wraps anywhere rather than pushing
the page sideways for one pasted URL, while a fence and a table — where a break
invented mid-token would be a lie about a line or a value — scroll within
themselves instead; the gap always goes UNDER a block, so the space between any
two is one value rather than the larger of two that met; a task list drops its
bullet, since the checkbox is the marker; and a fence carries the code's own
font-size, because a `<pre>` at the body's size sets a taller strut than the
lines inside it and drags the first line down.
`packages/tests/fixtures/good/kitchen-sink.md` is the page to open in a light
theme and a dark one after changing any of it; `just serve docs` is the other
one, and the more honest, since those are real documents somebody wrote.

`src/client/document/` is what a document looks like: its own page, the
reference a `doc`-carrying node shows wherever it is drawn, and the context
that lets a row deep in a tree find a document's text without every component
above it declaring a prop for it. The text arrives on the documents collection,
one key at a time (`keys` + `get`, no `deltas` — `snapshot-scale`), so a
document edited on disk redraws by the mechanism that was already there and a
directory of thousands costs a first paint of paths rather than of bodies.

The page is KEYED on its path, and that is load-bearing rather than tidy: the
router's arm is a `<Match>` over an object, which Solid compares as a boolean,
so `/doc/a.md` → `/doc/b.md` would otherwise keep the same page instance and
everything it decided once — which document was just minted, and which file the
open editor's draft and `was` belong to — would be a decision about the file
you stopped reading.

### And a document is WRITTEN here too

The page's **Edit** turns the rendered body into its source
(`document/DocEditor.tsx`): a textarea holding the file verbatim, which is the
same trade every title and note makes — what you type is the source, and the
rendering comes back when you leave. The mode is declared, so leaving it is
too: **Save** commits (⌘Enter on the editor's own element, the row editors'
rule), **Cancel** abandons (Escape), and nothing commits on blur or on a timer
— a whole file written because a click strayed, or half a sentence published
by an idle tick, is a write nobody asked for. The commit is one `doc` intent
through the same `edit.apply` every key sends, carrying `was` — the text this
editor READ — so a file that moved underneath (vim, a `git pull`, the agent)
refuses the save in the ops layer's own words, with the draft kept and the
drift already announced by a line that appeared the moment the served text
stopped matching. **Overwrite what is there** is the explicit second verb
after that refusal: the same write minus the guard. A saved edit records its
inverse on the same ⌘Z stack a keystroke's does.

Creation has two doors, both landing in the new document's editor
(`document/minted.ts` is the one-shot hand-off): the sidebar's **+ New
document** path box (`document/NewDocument.tsx`, the `docNew` intent), and a
BARE calendar day — no node, no note — whose cell mints that day's note
(`calendar/Day.tsx`, the `docDay` intent, the path derived on the server from
the vault's own convention).

## Seven routes, and what each is a property of

`routes.ts` is the whole of the URL contract, and it is a bijection its own
test insists on: a link the app writes has to be a link it can read back.

- `/o/<file>` names a file on disk, so it spells the path.
- `/doc/<file>` names a document, which is also a file and also spells its
  path. A second prefix rather than more work for the first, because an outline
  and a document are two different things a file can be (`fileKind`, in the
  format): the address says which, so a URL means one kind of page before the
  set is in hand, and renaming a `.md` to a `.jsonl` is a different page rather
  than the same address quietly changing what it draws.
- `/n/<id>` names a node, and an id is all it may spell. Ids are unique across
  the loaded set and survive renames and moves across files, so the permalink
  outlives every edit short of a delete — while a URL that also carried the
  outline would be a URL that could disagree with the file it named.
- `/d/<ISO-date>` names a day, which is not a thing on disk at all: it is a
  question asked of every dated node in the set.
- `/today` names no day. It names the day it *is*, which is what a bookmark, a
  home screen and an agent can each keep — so resolving it takes a clock, and a
  clock is exactly what parsing a URL must not have. `routes.ts` stays pure and
  `page.ts` is handed the day.
- `/agenda` names no day either, and unlike `/today` it never will: it is those
  same dates read forward. A horizon in the address — how far ahead it looked —
  would be a link that meant something different tomorrow.
- `/trash` spells nothing for the agenda's reason: which archives exist is the
  set's answer, not the address's. An archive's own `/o/…` address still
  parses like any outline path — what it OPENS is the trash view, because an
  archive is not a place you edit, and that is `page.ts`'s decision rather
  than the parser's.

`page.ts` turns a route into the page it names, in one place, which is what
keeps the sidebar and the main pane agreeing: the entry that lights up is the
outline the OPEN page lives in, and for a zoomed node that is the canonical
node's file — not something the URL says. Each arm carries what its screen
draws, rows included, so the components are handed a page rather than the whole
set to work one out from.

Navigation is real `<a href>`s (`router.tsx`), so ⌘-click and "copy link
address" behave the way they do everywhere else; a plain left click is
intercepted and answered in place. There is no router library: seven addresses
do not need one.

Navigating is also the one thing here that moves the page, so the router is
where that is decided (`scroll.ts`): a page you go TO starts at the top, a page
you go BACK to is where you left it. Both are decisions rather than the
browser's leftovers — a route change redraws the main pane and touches nothing
else, so zooming from the bottom of a long outline used to land the new page
mid-scroll at a line nobody chose. The position is recorded as the reader
scrolls and against the history entry they are on, because `popstate` fires
after the entry has changed: by the time a navigation can be observed, where it
was made from is already gone.

## The month, and a day

`src/client/calendar/` is the month in the sidebar and `src/client/day/` is the
page it opens. There is no journal file: the calendar aggregates the whole
set's dated nodes and a day collects every node on that date, wherever it
was written. Which days have something on them, and what is on one, are
`@olai/format`'s to answer — the same derivations the validator's set is read
with, so a dot and the day it opens cannot disagree. Two fields put a node
there — its `date` and a dated `done` — so a day holds what was scheduled for it
and what was finished on it, and a dated `doing` or `todo` is passed over; a row
says which of the two it is in a word in front of its date badge, which is the
only thing a day draws that a tree row does not.

What is left here is the two things a day view has to decide for itself, and
neither is about the format:

- `calendar/month.ts` — where the days of a month land on a grid, and which
  month is next to it. Integer arithmetic, unit-tested, and pointedly not a
  `Date`: `new Date("2026-08-01")` is midnight UTC, which is the previous day
  for half the world, and a calendar that shifted a column by time zone is the
  bug this avoids by never leaving integers.
- `clock.ts` — what day it is, in the reader's own time zone, re-read at the
  next local midnight AND whenever the page becomes visible again. The second
  is not belt-and-braces: a laptop shut at eleven and opened at nine ran no
  timers while it slept, and a backgrounded tab has its throttled to minutes,
  so the timer alone comes back showing yesterday at exactly the moment
  somebody is looking. It sits at the top rather than under `calendar/`,
  because its readers are the page model (`/today` names no date), the day page
  and the month: today is a fact about the tab, and two of them asking a `Date`
  separately is two answers that can differ by a day at exactly the wrong
  moment — a tab left open overnight on `/today` would otherwise be the one
  stale thing on a page whose whole promise is that it is not.

Four marks, and they are four because a reader has to tell them apart at a
glance in a 16rem column: a day with something on it is a link with a dot, a
day with a NOTE wears a corner fold, today wears a ring, and the day being read
is filled. A day with neither of the first two is inert — pressing it could
only mean "write something here", and this pane writes nothing. Every one of
them is a `data-` fact on the cell (`data-dated`, `data-noted`, `data-today`,
`data-open`) rather than a colour, so the browser tests assert on the mark and
never on the palette. The first two are also SAID, in the cell's `aria-label`
(`2026-08-12, has a note and dated nodes`): the dot and the fold are pseudo-
elements with no text, so a distinction carried only by shape is silence to a
screen reader.

The fold is the second half of DAILY NOTES: a document whose basename is exactly
an ISO date is that day's note (`@olai/format`'s `noteDateOf` — one derivation,
beside the other two, so the mark and the page cannot disagree), and `day/
DayNote.tsx` draws it above the dated nodes on `/d/<date>` and `/today`. A
different SHAPE in a different PLACE from the dot, because a day may carry both
and a dot that changed size or shade would be unreadable without the other one
beside it. The note joins the day rather than replacing it: the groups below are
what they always were, a day whose note is on screen does not claim to be empty,
and nothing here writes — creating a note is `md-editing`, later. Which days
those are is asked of the DOCUMENTS' key set rather than of the derivation,
because it is a question about filenames.

## And the same dates, forward

`src/client/agenda/` is `/agenda`: what is OWED. It is a query like a day and
not a place, its answer is `@olai/format`'s (`agendaOf`, at whatever day it is),
and what it draws is the day page's own row — `day/DayGroups.tsx` and
`day/DayNode.tsx`, one component each, because a node the set has dated is the
same row whichever question collected it. Three sections, and a section with
nothing in it is not drawn at all: **Overdue** (the one answer no day page can
give, since a slipped task is on a day nobody visits), **Today** minus finished
work, and **Upcoming** — the next days that have anything, each heading a link
to that day's own page, where the note and the finished work this page leaves
out are read.

The visible half of `overdue` is a TONE: `DateBadge.tsx` takes the attention
colour wherever the predicate holds, on every row the pill is drawn — a tree
row, a day entry, a zoomed heading — and never on an occurrence, because a dated
bullet is not late work. Which row is late is decided where the NODE is (a badge
is handed a string), and `data-overdue` carries the answer in both directions,
since a pill that must never turn amber is as much of the promise as one that
must. What that predicate needs and the set cannot give is today, so `today.tsx`
is a context beside `derived.tsx` for the reason that one exists: a thousand-row
tree would otherwise thread the clock through three signatures to reach one
leaf. The accessor is what keeps it honest past midnight.

It writes nothing, the way a day page writes nothing: an empty agenda says
"Nothing is due." and offers nothing to press. Rescheduling is a `date`, and the
place to change one is the row where the node actually lives.

### And the directory says so before you open it

`src/client/agenda/owed.ts` is the same answer read from OUTSIDE the page: a
READOUT, built like the two in the header (`readout.ts`, `connection/status.ts`)
— a face, a table of how that face is drawn, and the sentence it says out loud.
Two faces, and they are the two the date badge already has, because it is the
same predicate they report on: work that has SLIPPED puts the entry in the app's
alarm (a filled chip carrying the count, on a washed and weighted row), work
merely on TODAY wears the same chip in the badge's quiet face, and an agenda
with neither is the entry it always was. They differ by more than a colour —
the calendar's rule for marks that share a place — and both are SAID in the
entry's own label, since a colour is silence to a screen reader.

Loud wins the row whole and the chip prints the OVERDUE count alone: two
numerals in a 13px row is a thing a reader has to decode, and the chrome rule
here is one claim per readout. The today count is not lost — it rides the
sentence, it rides `data-today`, and it is shown in full one click away. The
mark is drawn on both faces of the column (`Sidebar.tsx`, and `layout/Rail.tsx`
as a dot, since three rem has no room for a numeral) and inside the phone's
sheet, which is the same component.

**One reading, and it is not the page's.** `agendaOf` is called exactly once in
this client — in `App.tsx`, the composition — and the page that lists it and the
entry that marks it both read that value; `page.ts`'s agenda arm carries only
the day it is answered for. A count derived beside the entry would be a second
walk over one directory, free to say "2 overdue" over a page listing three. It
is read on every page rather than on `/agenda`, which is the honest cost of a
mark the column carries everywhere, and it moves on both of its inputs: the
store's next revision (a task ticked off clears the alarm with no reload) and
the one clock rolling `today` over at the local midnight.

## Fifteen palettes, and the one you picked

`src/client/theme/` is a TABLE and the things generated from it. `palettes.ts`
holds fifteen named palettes — the racket implementation's four and eleven read
off the original WorkFlowy theme stylesheets — each a value for the same eleven
tokens `styles.css` declares. Everything else follows from it: `css.ts`
generates one unlayered `:root[data-theme="…"]` block per row, which `src/build.ts`
appends to the Tailwind output, and `Chips.tsx` draws one chip per row, each
chip wearing the palette it offers. The strip is the Theme row of the
preferences panel (`settings/`, below); it used to be a popover of its own
behind a header pill that named the theme in force, which was a preference with
a door beside the door to the preferences. What that pill promised is kept by
the row's hint, and the panel stays open on a pick so two palettes can be
compared on the page they paint. Adding a theme is adding a row; the row type is
what makes a
forgotten token a type error rather than a `var()` that resolves to nothing in
one theme only.

Eight tokens and not the racket skin's fourteen: the six that did not come have
no home in a client that paints one paper and gets its accent grounds from an
opacity, and a token nothing paints with is a value nobody can check. The
mapping is written down where the table is.

A pick is CLIENT state and never leaves the browser — a preference of this
browser's (`preference.ts`, shared with the agent drawer's open state: storage
can throw, and a preference that cannot be remembered is still a preference for
this tab). It belongs to the browser rather than to the tab, so both preferences
follow the browser's own `storage` event into every OTHER tab that has this app
open: a theme picked in one window lands in the next one without a reload, which
is the same promise `clock.ts` makes about the day. `state.ts` writes
`data-theme` on `<html>`, remembers it, and asks
`chrome.ts` to repaint `<meta name="theme-color">` from the same table that
painted the page — but it is not what puts the theme there on a reload. Four inline lines in `<head>` (`index.html`) do that, before
the first paint, because everything on this page is deferred and a theme
restored by the bundle is a flash of the wrong colours on every load. Those
lines know no theme names, so a stored value no row offers is forgotten by
`followStoredTheme` instead — the first moment anything knows the list.

There is no "system" chip and no `prefers-color-scheme` rule in the sheet. The
OS used to choose the palette, which meant a page that changed under a reader
who had already said what they wanted; a page that has picked nothing reads in
the default, which is `chalk`, which is the one palette that promises WCAG AA.
That promise is arithmetic, so `contrast.ts` is arithmetic and
`contrast.test.ts` holds the palette to it pair by pair — over the pairs this
client actually paints, since rejecting a colour over a combination no
component draws would be rejecting it over a page that does not exist.

## The app header

`src/client/AppHeader.tsx` is a slim bar above every column: the `olai`
wordmark on the left, and on the right the pills that are about the APP
rather than about the page — the connection indicator, the Commit pill (the ONE
git indicator, drawn in every state including `commits off`), the agent toggle
(always on screen; pressed
while the agent panel is open; busy pulse in either state while a turn runs),
and the PREFERENCES trigger (`settings/`, below), which is one door rather than
two: the theme pill used to sit beside it, and a preference with a control of
its own next to the control for the preferences is the redundancy
`one-git-indicator` closed for the two git chips. On a phone the directory
burger joins the left edge next to the wordmark.

**Five things do not fit in a 390pt bar, so the ORDER they give way in is a
decision** rather than whatever the flexbox happens to squeeze — that is written
out in the component's own header and implemented across four files. The last
commit's age goes first (`· 3m ago`, `sm` and up), then the agent's and the
preferences' words (kept `sr-only`, so neither button's accessible name
shrinks), then the Commit pill's label truncates — its `✓` / `⚠` is most of what
it says — and the connection's label is last and in practice never, because it
has a floor. The wordmark and the burger never give way at all; the theme name,
which was the third of those, is not in the bar any longer.
`features/on_a_phone.feature` holds the end of that order shut in every
connection state (`the connection's label is whole`), which is the fence for the
version of this bar that shipped `live` squeezed to `l…`.

Principle: the header carries what is about the app; the sidebar
(`Sidebar.tsx` / `layout/Rail.tsx`) carries what is about the DIRECTORY —
the agenda, the calendar and the file tree, collapsing on desktop to an icon rail. The header
is on every screen App draws, including the error report and the waiting page,
so there is one home for chrome and no corner-pills special case those screens
used to need. The sole exception is the fault card: `main.tsx`'s
`SurfaceFaultBoundary` sits above `App`, so a thrown render never reaches the
header (a broken client has no chrome to trust).

The bar **sticks** (`sticky top-0`, layer `z-[45]`): this app scrolls the
document, so a bar in normal flow took the connection dot, the commit pill and
the agent toggle off the screen the moment anyone read past the fold — and
those are permanent answers about the app, which is the argument for the bar
existing at all. It is also what keeps the seam below it true: the mobile
drawer, its scrim and both faces of the chat panel are `fixed` at
`top: var(--height-header)`, a viewport coordinate that only means "under the
header" while the header is at the top of the viewport. The layer sits above
the panels (30–40) so a page scrolling under the bar cannot paint over it, and
below the full-screen modals (50) — the command palette, the restarted card —
which must cover it. `sticky` and not `fixed`, so the bar keeps its own 3rem in
flow and nothing below has to pad for it; no ancestor may take an `overflow`
other than `visible` or it silently stops sticking. Because the top
`--height-header` of the viewport is no longer free space, `styles.css` gives
the document `scroll-padding-top: var(--height-header)`, which is where a
`#heading` jump (a document's contents, a pasted anchor) now stops.

The chat dock sits **under** the header, not over it (`chat/Panel.tsx`
subtracts `--height-header`): the bar stays reachable while the agent is open.
Layout widths, open/minimized state and the mobile chat snap live in
`layout/prefs.ts` (client-local, never sent).

## The preferences, in one place

`src/client/settings/` is a trigger in that bar and the panel behind it: rows,
each a label, a control, and a line under it read off the CHOICE IN FORCE
(`Row.tsx`). The shape is kolu's settings popover — an anchored popover of
setting rows with reactive per-choice hints — and the hint is the part worth
copying: a row of tidy labels is a quiz, because "Done: Hidden" says what the
control is set to and nothing about what the app will now do, while a sentence
that changes as you press answers "what did I just do" in the same gesture.

**The backing store is deliberately NOT kolu's.** Its rows read and write wire
singletons, because its preferences are the server's; olai's are client-local
(`docs/architecture.md`), so every row here goes through `preference.ts` —
`localStorage`, carried into the browser's other tabs by the `storage` event,
never sent. There is no cell, no procedure and nothing to commit, and the panel
says so on its own footer line, because "where did this go" is exactly what a
person wonders about a setting they just changed.

The read→signal→write→watch circuit over that storage is wired ONCE
(`createPreference`, in `preference.ts`): a stored value is its codec — what
the entry says, defaults included, and what to write back — plus the one
option, `persist: false`, which the drag handles use so a pointermove is not a
storage write. Every stored key runs on it, and a test beside the factory holds
the claim that only `theme/state.ts` still wires the primitives itself: the
theme's first read belongs to the shell's boot script (above), which no module
can be.

**What is on it** is a narrower question than "every client-local value", and
the rule is: the ones that are a CHOICE and have nowhere else to be made.

- **Theme** — the fifteen chips (`theme/Chips.tsx`), moved in from the header
  pill. The row's hint names the theme in force, which is what the pill
  promised.
- **Done** — `Visible` / `Hidden`, and it is THE switch (`settings/done.ts`).
  The floating pill that sat above the outline was a second door for the same
  preference, and it retired into this row the way the theme pill retired into
  the Theme row. "I do not want to look at finished work" is a claim about the
  READER, so it belongs here, applies to every page, and follows across tabs.

The layout values in `layout/prefs.ts` are stored the same way and are
deliberately not here: a sidebar width is set by dragging the sidebar, and a
panel being open is set by the control that opens it. Copying them into a
settings list would be a second control for something that already has one.

The panel is **portalled to the body** and placed against the viewport, because
the bar it hangs off is a `sticky` box with a z-index — a stacking context three
rem tall. Being open, being placed and being dismissed are `popover.ts`, and the
Commit pill two along is the other consumer: `anchor.ts` was already the shared
PURE half, and this is the stateful half catching up. The two had forty lines
each and had drifted — one grew Escape and a returned focus and the other never
had them, and **one of them had its click-away wrong in a way nothing could
see**: a portalled panel is not a descendant of its trigger, so a click-away
that knows only the panel reads a press of the trigger as a press outside, and
the trigger's own click then reopens what the pointerdown just shut. Pressing
the Commit pill a second time did nothing at all. Both roots are consulted now,
and both popovers have a scenario for it.

Dismissal is therefore a pointer outside it, Escape, or the trigger again; the
two a keyboard can reach put focus back on the trigger. A theme pick does NOT
dismiss it: a palette is judged by looking at the page it paints.

**The two gestures themselves are `dismiss.ts`, one spelling for every panel
this client draws itself.** Each had its own copy of "a pointer down outside
it, capture phase" — these two popovers, a row's expanded note
(`note/expand.ts`), and the `•••` menu, which had a fourth — and they agreed
about almost everything and drifted where they did not. `dismiss.ts` holds what
is common (which root counts as inside, and only listening while the panel is
up) and leaves each caller what "shut" MEANS: focus back on the trigger here,
nothing to remember there. It is built on Kobalte's own `createInteractOutside`
/ `createEscapeKeyDown` rather than on a listener pair of ours, so these shut by
the same code the one real primitive (the `•••` menu) shuts by — and a touch,
which every copy here handled by never considering it, defers to the `click`
that follows. Not the same INSTANCE, and the file says so: the menu shuts inside
Kobalte's own `DismissableLayer` and its layer STACK, which these two are not on,
so an Escape with both up shuts both. The note gained Escape by being deduped:
it is the model that note already keeps, where expanding and editing are one
state you leave at once.

**And focus has to get IN, which is the other half of the portal's price.** The
theme popover this replaced was laid out inside its trigger's own box, so the
chips were next in document order and Tab reached them; a panel appended to
`<body>` is the last thing on the page, so a keyboard leaving the trigger walked
the sidebar and the tree first. That is not "keyboard reachable", it is being at
the end of a queue nobody finishes — a regression against the control this panel
absorbed, and the reason `popover.ts` owns focus as well as placement. The rule
is that **a trigger and its panel are one tab cycle**: opening moves the caret
into the panel (its own box, `tabindex="-1"`), and while it is open Tab and
Shift+Tab wrap around trigger → controls → trigger, so nothing underneath is
reachable while a panel is over it. The Commit panel gets the same, being the
same receptacle. `features/preferences.feature` holds both ends of the cycle.
The Tab handler lives beside the panel rather than in `keys.ts` for the reason
the command palette's does: the registry is global chords and the row editor's
bare keys, and a bare Tab that means something only while one surface is up
belongs to that surface.

Where the caret IS has to be visible on a chip, too: a chip paints itself in the
palette it offers, so a focused `pitch` chip is a black pill wearing whatever
outline the browser draws against black. Chips and segments carry an explicit
`focus-visible` ring in the PAGE's accent — the same ring `aria-pressed` uses to
say which one is in force, because the two questions ("where am I" and "which is
picked") deserve the same answer in the same colour.

## The directory column is pinned too

The other half of the chrome is the sidebar, and the argument is the header's
argument: a column in normal flow is as tall as the page, so past the fold the
reader had a bare rule down the left and no way back to the directory but
scrolling up. With the bar sticking, that was the last piece of chrome still
going — visible in #115's own evidence as an empty directory column beside a
scrolled page, flagged there as out of scope and filed as its own bug.

So on desktop both faces of the directory — the open column (`Sidebar.tsx`) and
the icon rail (`layout/Rail.tsx`) — are `sticky` at `top: var(--height-header)`
and exactly `calc(100dvh - var(--height-header))` tall. **The height is what
makes the pin mean anything**: a sticky box taller than the strip it is pinned
in scrolls its own bottom off the screen and pins nothing. Being exactly the
strip is also what gives the column its own scroll region, because the body
below the resize handle was already `min-h-0 flex-1 overflow-y-auto` — so a
directory taller than the screen now scrolls WITHIN the column instead of
lengthening the page. That is the half that makes the pin worth having: one
scroll region per thing that scrolls, and the page's scrollbar goes on being the
page's.

`sticky` and not `fixed`, for the two reasons the bar gives: the column keeps
its own grid track (`--width-sidebar`, so the resize handle goes on meaning what
it says and nothing pads for it), and no box between it and the document may
take an `overflow` other than `visible`. `100dvh` and not the chat dock's
`--visible-h`: that reading is the VISUAL viewport, which is right for a `fixed`
box on a phone with a keyboard up and wrong for a sticky threshold, which is a
layout-viewport coordinate.

Nothing else moves. Folders still start collapsed (#105), ⌘\ still toggles, the
collapse button is the same control in the same corner — the bottom-right of the
column, which is now the bottom-right of the STRIP and therefore on screen at
every scroll position rather than parked at the foot of the document. The phone
is untouched: the directory there is a fixed drawer with a scrim and this is a
`md:` change. `features/the_sidebar_sticks.feature` holds all of it, with the
phone scenario as the fence against the pin leaking below 48rem.

## The connection, said out loud

`src/client/connection/` is the chrome for the one thing the outlines cannot
report on: whether this page is still talking to a server. A page that is live
and a page whose server died look identical when nothing says otherwise — both
keep showing the last thing they were told — so a pill reports it always, in
every shape of the app, and is green only while a server is answering.

WHERE it sits is the layout's, not the indicator's: the app header, beside the
agent toggle and the preferences. It used to have two homes (sidebar footer,
or a corner when there was no sidebar); the header collapsed that. Always fixed
to the corner is what it used to be before even that, and it meant a pill
sitting on top of the last line of whatever scrolled under it. `Connection.tsx`
keeps the one rule that is not about placement — when the reload surface takes
the screen.

`status.ts` is the LOOK and nothing else: a table over the five states saying
what each is called here, which dot it paints, and what it claims in words. That
is where the mistake this folder exists to prevent would be made — a state that
quietly reads as healthy, or a terminal one drawn like a transient one — so it
is unit-tested directly, with no socket and no browser.

WHICH state is true is not decided here and no longer can be. `connectSurface`
hands back a READOUT (kolu#2160) folded from both facts a page's liveness
depends on: the wire's own four states, plus `degraded` — drawn as `partly
live` — for a socket that is open and answering while a subscription riding it
is dead. This file used to do that fold itself out of `client.health()`, which
made it a step every consumer had to remember; the consumer that forgot it drew
a `documents.keys` stream that had died as a directory with no documents in it,
under a green light. The framework's three rules travel with the readout now:
`live` is the conjunction, a first frame that has not arrived never degrades
(a pill that is amber most of the time is a pill nobody reads), and `degraded`
names what stopped — non-empty by type, which is why `lookOf` takes the readout
rather than a state name and a sentence with a hole in it is not spellable.
`needsReload` rides it too, so `Connection.tsx` reads the bit rather than
keeping its own list of terminal states.

One decision here is still olai's beyond the wording: it is folded into the one
pill rather than drawn beside it, for the reason the git readout is quiet when
it is happy — one green claim per page, or neither is scanned.

The degraded half is unit-tested only, and that gap is honest rather than
missed: killing one subscription while leaving its socket up is not something a
browser can be asked to do from a scenario. What the e2e asserts is the healthy
half — `live`, with `data-stopped` absent — which is what would go red if the
fold started reading amber over a page that is fine.

`retired` is the one that takes the screen (`Restarted.tsx`). It means the
server this page came from has been replaced: the tab presented its process id
on the reconnect, the new server did not recognise it and closed the socket at
the handshake, and the wire has stopped dialling for good. Nothing heals that,
so the page offers the only thing that works — a reload, as a button rather
than automatically, because throwing away a page someone is reading without
asking is not a recovery. Both the dot and the screen read the SAME
`connectSurface` status (`wire.ts`), so they cannot disagree about what
happened; the seam's required `retired` handler records the moment rather than
driving a second path to the same fact.

## Git, said out loud too — and in ONE place

Git is the same argument as the folder above, about the other half of the page's
promise: not "is this still reading" but "is what gets written to it being
kept". Both are facts a page can only get wrong SILENTLY, and this one did — a
write came back `committed: false` on a directory its owner knew was a
repository, and the reason lived in the server's log.

There is no `src/client/git/` any more, and its absence is the point.
`git-invisible` put a `● git` readout in the header; `#83`/`#114` put the Commit
pill beside it; and the human's screenshot of `● git` next to `✓ committed · 3m
ago` said what two chips answering one question look like
(`one-git-indicator`). The readout retired INTO the pill — see [the Commit
button](#the-commit-button) — so the states it drew are faces rather than a
second control, and the `git` cell it read is now read there.

Nothing that readout won was given back. A git that FAILED still reads
differently from a directory that is no work tree (`git error` vs `no git
here`), git's own words are still on the tip AND on the `aria-label` so the
reason is never hover-only, the pill is focusable in every face — the inert ones
are `aria-disabled` rather than `disabled`, because a disabled button takes no
focus and a reason a keyboard cannot reach is a reason half the readers do not
get — and none of it blocks a write.

## The agent panel

`src/client/chat/` is a dock on the right (desktop) or a bottom sheet (phone).
Every panel has exactly two states — open, or minimized-with-signal — nothing
closes to nowhere. Minimized desktop is a bottom-right **pill** carrying the
last agent message and pulsing while a turn runs (`Minimized.tsx`); minimized
phone is a **strip** above the thumb (same component). The header keeps the connection
dot and the agent toggle (app chrome); the pill does not carry the connection.

Open on desktop, it drag-resizes and takes its width out of the layout on a
screen wide enough to spare it rather than lying over the outline. On a phone
it is a bottom sheet with half/full snap points over a scrim. Open and
minimized are the same control: a permanent toggle in the app header
(`Toggle`) — always on screen, pressed while open, busy-pulsing in either
state. The panel has no × of its own.

It ALWAYS has a face. Whether an agent is configured is the server's answer,
and when the answer is no the open panel says so (`NoAgent.tsx`, naming
`OLAI_ACP_AGENT`) rather than disappearing — a feature that is silently absent
cannot be told apart from one that is broken, or from one you have not found
yet. The composer and the transcript are what the explanation replaces.

Everything in it is a projection of two surface members — a `transcript`
collection and a `chat` cell — so there is no chat state in the browser the
server does not own.

The transcript is drawn as a `<For>` over row KEYS, with each row reading its
own value (`state.ts`). `<For>` diffs by identity, so what is in that list
decides whether an update patches a row or replaces it — and a row replaced
takes everything it owns with it: an unfolded tool call, a selection, the
scroll position under the reader's eye. Strings cannot be anything but the same
list. What was typed appears because the server put it there,
which is why two tabs cannot disagree and why a send that failed never leaves
a message on screen that was never sent. The transcript's `deltas` verb is what
makes a tab opened halfway through a turn show the whole conversation: its
first frame is the snapshot.

It says what it is SHORT of, too. When a conversation was meant to be handed an
MCP server and was not — a `kolu` on this host's PATH that no padi answered —
`Missing.tsx` draws a strip under the header naming it, with the reason the
probe or the server gave and the file that was probed. Under the header rather
than in the transcript, because it is a standing fact about the session like the
model beside it; quiet rather than alarming (`panel` under the dock's `desk`,
the header's own mono, one `alarm` dot), because nothing is broken — the agent
answers, with fewer tools than it might have had. A healthy conversation draws
nothing here at all, and so does a machine that is simply not running kolu.

Inside the conversation, three components earn their own file:

- **`Refusal.tsx`** is the one the error taxonomy exists for. A `validation`
  refusal carries the validator's own report as DATA, so it renders through the
  same `errors/Report.tsx` rows a broken file does — a refused write and a
  broken file are explained the same way, each line pinned to where it is.
- **`ToolFrame.tsx`** is one line, foldable. A turn can be a dozen of these and
  unfolded they would bury the conversation. The row is UPDATED rather than
  replaced — the transcript keys them by the agent's own call id — so a fold
  you opened stays open while the call is still running. Which lines are
  unfolded lives in `folds.ts`, module-scoped and keyed by the same call id,
  because closing and reopening the drawer rebuilds the panel from nothing and
  a fold held inside the row would come back shut.

  Two things escape the fold, because both are about a call that is HAPPENING
  rather than one that happened: where it is working (the protocol's
  follow-along locations) is on the line itself, and what it is saying (its
  incremental content) is the first thing in the unfolded body, above the
  arguments. A call running for thirty seconds has something to show and its
  arguments are not it.

  A third escapes it for a different reason — what the call CHANGED, which is
  not detail: the arguments are what was asked for, and this is what happened
  to somebody's files. Two components, one per kind of write, and a call is at
  most one of them.
- **`Diff.tsx`** draws a file the agent rewrote directly, the CLI's way: the
  path, the counts, and the change trimmed to a few rows with the rest a click
  away, opening in place. What is trimmed is the DIFF and never the file —
  `diff.ts` collapses unchanged runs into gaps first — so the first rows are
  the change rather than the top of a document. That fold is keyed by the call
  AND the path (`folds.ts`), since one call can rewrite several files and one
  file is rewritten again in a later turn.
- **`diff.ts`** is the line diff itself, computed here because ACP carries two
  texts rather than a patch. Hand-rolled: the packages that do this bring
  character-level algorithms and patch application for the one function a panel
  wants, in a bundle that ships to a browser — the same trade `@olai/git` took
  over `simple-git`. Common ends come off first, the table is bounded (past the
  budget the two sides are reported as unrelated rather than compared cell by
  cell, because a browser must not freeze on a ten-thousand-line rewrite), and
  the colours are spent on the tint and the marker rather than on the words:
  text stays `ink`, which is the pair every palette promises.
- **`OutlineDiff.tsx` / `outline.ts`** are what make "never a text diff of a
  `.jsonl`" true of the FILE rather than of the tool. Olai's own writes cannot
  produce one; an agent's own `Edit` can name any file, and one aimed at an
  outline used to arrive as a diff block and render as lines. So an outline's
  two texts are parsed and compared as RECORDS — `parseOutline` + `changesOf`,
  the same pair the Commit panel's rows come from — and drawn as node rows in
  the same words. A side that will not parse says which side and draws nothing
  else: an agent hand-editing an outline is exactly how a `.jsonl` stops
  parsing, and lines are not a better answer to that than a sentence.
- **`armed.ts` / `ContextChips.tsx` / `Reference.tsx` / `refs.ts` / `../focus.ts`** are
  the two directions between a row and the conversation, and they are four small
  files because they are four separate reasons to change.

  A row's `•••` offers *Ask agent* (`../menu/actions.ts`), which arms the
  composer with the node that row SHOWS and opens the panel. What is armed is an
  ID and only an id (`armed.ts`, a module for the same reason the folds are one:
  the door is in the main pane and the strip is at the bottom of the panel, with
  the whole app between them). The chip reads the title out of the live set, so
  a row armed and then retitled says the new name; the send carries the id, and
  the SERVER resolves it (`@olai/server`'s `context.ts`) — a browser's account
  of an outline is a frame old, and a node that has gone refuses the send rather
  than sending a question with no subject. The chips ride the sent message too,
  which is what makes them readable after a reload and in the other tab, and
  `ContextChips.tsx` is one component for both moments the way `Attachments.tsx` is:
  what differs is only that the pending one can be taken off.

  Pointing back is the same ids read the other way. `Reference.tsx` is a BUTTON
  and not a link — it shows you a row on the page you are on, and only falls
  back to `/n/<id>` when the node is not drawn there — and `focus.ts` is the
  whole of what "shows" means: `focusNode` is the mechanism and takes the
  answer to "and if it is not here?" rather than knowing one (which keeps the
  address the router's and keeps this testable), `useShowNode` is that answer
  and there is one of it, for both the buttons this panel authors and the ids
  inside markup it does not. The row wears `data-focused` and takes the same
  accent the row holding the caret takes, and the page scrolls it into view.
  Nothing is stored, nothing crosses the wire, and no editor is opened: being
  shown a node is not being asked to type in it.

  `refs.ts` is the third shape, and the only one this panel does not author: an
  id the agent wrote in its own prose. No syntax was invented — every olai tool
  spells an id in backticks in its own description, so an agent already emits
  them — and a code span becomes pressable exactly when the loaded set declares
  what it says, which is what makes a false positive unrepresentable. It is
  marked with the id the format RESOLVED rather than the one it says, and that
  distinction is a placement: an agent writes mirror ids (`read_node` answers
  `mirrors` with them), rows carry the node they SHOW, so a span marked with
  the placement's own id would name no row on the page and every press of it
  would leave for a node that is right there. Resolving is what a `see` to the
  same placement already does. The
  marking is a DOM pass over one message rather than a step in the markdown
  pipeline, because that pipeline is pure and cached by source text while this
  answer depends on the SET; the press is one delegated listener on the
  transcript pane, which is what a relative document link on the main pane
  already is, for the same reason: rendered markdown belongs to no component.
- **`Wrote.tsx`** draws the other kind, and never as a diff — an outline is one
  line per node, so a text diff of one is a single enormous line with
  everything on it changing at once. It is the node-level story in the words
  `../changes.ts` holds, which is the same table the Commit panel's rows read:
  the agent marks a node done, this says *marked done*, and the row waiting to
  be committed says *marked done*. One event, one sentence, two places it is
  seen — and one table, because two would be the day one of them started saying
  something else. The node it names is a REFERENCE (`Reference.tsx`): the reply
  has always carried the id, and this is the shape a transcript holds most
  often — every write through the ops layer draws one of these rows.
- **`Composer.tsx`** never disables its box. A message typed while the agent
  is working is sent and queues, so the button says `queue` and cancel appears
  BESIDE it rather than replacing it — sending and stopping are two things a
  person can want at the same moment. Disabling cost the caret as well as the
  thought: coming back to a re-enabled box meant reaching for the mouse.

  It is also where a FILE comes in, three ways for one reason: paste is the
  desktop gesture, drop is the one for a file already on screen, and the picker
  is the only one a phone has. All three end in the same call and take the same
  kinds — the picker's `accept` is spelled from the gate's own list, because a
  dialog that greys out a PDF the drop would have taken is the one half-truth a
  person meets with no refusal to explain it. Attaching does not send: the file
  waits in a strip above the box, where it can be removed or typed at, because
  "what is wrong here" needs the file and the question together. Two of the three listen here; the drop is caught by the
  panel around it (below), because a file dragged at a conversation is aimed at
  the conversation and not at a two-line box at the bottom of it.

  The box empties the moment it sends and PUTS BACK what the server would not
  take. Emptying immediately is not optional — waiting for the round trip would
  send twice for two quick presses of Enter — but a refusal used to leave the
  message and the chips gone with only a red line to say why, and a chip stands
  for round trips somebody already waited through. It is put back only into a
  box that is still empty: an answer that arrives while the next thing is being
  typed loses to what is being typed.
- **`attach.ts`** is that call: read the Blob, base64 it once, and send it as a
  SEQUENCE of bounded `chat.attach` calls, the first creating the file and each
  later one appending to the path it was answered with. Sequential by
  construction — the server appends to one growing file, so two chunks in
  flight would interleave their bytes and corrupt the file silently. The
  size and kind gate runs before a byte is encoded, and it is the same function
  the server refuses with (`@olai/surface`), so a 60 MB drop costs nothing and
  says exactly what the server would have said.
- **`DropTarget.tsx`** wraps the panel's body — transcript and composer — and
  is the whole of the drop gesture: a target you can miss by two pixels is a
  target that eats the file, because a drop that region does not take is one
  the BROWSER takes by navigating away to it. So the region that lights up is
  exactly the region that takes it, and it lights up while the drag is still in
  the air — what it is CARRYING is read off `dataTransfer.types`, because the
  drag data store stays protected until the drop and the files are unreadable
  the whole way across. Enter and leave are counted rather than flagged: they
  fire per element, and a boolean flickers the whole way across a transcript.
  What the count must never do is outlive the drag, so every ending puts it
  back — the drop, the leave (counted out without asking what it carried, since
  a browser may hand an empty store to one), and `dragend`. An affordance left
  lit with nothing over it is a panel that looks broken and cannot be talked
  out of it.
- **`holding.ts`** is what the composer is holding — the files uploaded and
  waiting for a message — lifted above both because the gesture and the chips
  are no longer in the same component. It also makes one gesture ONE ANSWER:
  the drop is sorted by `@olai/surface`'s gate before any of it is sent (the
  same function the chunk loop and the server refuse with, asked one step
  earlier), the uploads answer rather than draw their own refusals, and
  everything the gesture turned down is said together on the panel's one
  refusal line. Said file by file instead, each reason is rubbed out by the
  next upload — which is a file dropped into the panel disappearing with
  nothing on screen about it.
- **`Attachments.tsx`** draws an attachment three ways, and the NAME is the base
  case. A row carries file names; what can be added to one depends on which tab
  is looking, because the bytes are in a tmp directory no browser can reach and
  `/media/*` is guarded to the served directory. The tab that attached it still
  has the Blob (`previews.ts`, a bounded per-tab cache): a picture becomes a
  thumbnail, and anything else becomes its SIZE — a PDF has no thumbnail worth
  drawing here, and an `<img>` pointed at one is a broken-image icon standing
  where a file that uploaded perfectly should be. Every other tab, and this one
  after a reload, draws the name alone.
- **`SlashMenu.tsx`** takes Enter in the CAPTURE phase and stops it
  propagating, because the input owns Enter for sending: without that, a
  completion accepted would be a message sent. It is opened by typing `/` and
  by a button beside the input, which shows the WHOLE list — typing filters,
  and the button is for when you do not know what to type. The button is drawn
  only when the agent offers commands: one that opens nothing would be a button
  that lies.

`src/client/run.ts` is the one place the client runs an Effect, and its
signature is the enforcement: there is no overload without `onFailure`. A caller
that could ignore a procedure's declared failures would be a caller whose
refusals vanish, which is exactly what chat is not allowed to do. It sits at the
client's root rather than inside the panel, because the sentence above is about
this app rather than about chat — the Commit button is its second caller.

## The Commit button

`src/client/commit/` is the second pill of the chrome and the header's ONE
answer about git, and like the connection dot it is NEVER ABSENT. Every state is
drawn: a clean tree that has committed (`✓ committed · 12m ago`), one olai has
never committed in (`no commits yet`), edits waiting (`4 uncommitted`), a busy
repository (`⚠` and the reason), a git that failed (`⚠ git error`, with git's
own words), a directory that is not a work tree, and a server with commits off.
The rule comes straight from what the feature is FOR: if the job is an audit
trail, then "there is no audit trail here" is the most important thing the pill
can say, and a control that disappeared is exactly how a person would never find
that out.

The fault face is the one that came from somewhere else. It is the `● git`
readout of `git-invisible`, which used to be a second chip beside this one
answering the same question — the redundancy `one-git-indicator` closed. So the
pill reads two cells rather than one: `pending` for what is waiting, and `git`
for whether git is in any state to take it. Two READINGS, never two probes — the
server derives both from a single survey in a single statement — and the second
is not optional, because exactly one thing lives in it that no reading of the
directory can produce: a commit git REFUSED. A repository with no `user.email`
answers every probe happily and fails every commit, which is the silence
`git-invisible` was filed for.

The sentence for whichever face is worn rides this app's own tip rather than a
`title` (git's words are a paragraph, and the platform's tooltip ran one off the
right edge of the window) and is the `aria-label` too, so nothing is hover-only.
Healthy stays QUIET: the tick is not green, because the connection dot beside it
is the page's one green claim and a second one lit permanently in the ordinary
case is how a reader learns to stop scanning the place the news appears.

One more face is about THIS PAGE rather than the directory: until the server has
said anything, the pill says so. It used to draw the default value's `commits
off`, which is a setting somebody could go and change — a claim a page has no
business making about a server it has not heard from. "Not told yet" and "turned
off" being two different things is the same distinction the manifest cell draws
with its `null`.

The PANEL is portalled out of the bar and positioned against the viewport
(`anchor.ts`, shared with the preferences), which is not a style choice: a
scrolling column and a three-rem bar both clip in both axes, so a popover laid
out inside the sidebar was cut off at the 16rem column — the message, the writer
and half the button gone. The placement is a pure function of the pill's box and
the window, so "pushed back inside near the right edge" and "flipped downward
when the pill is too high to open upward" are a unit test rather than something
to find by resizing a browser. It re-measures on resize and on scroll (capture
phase — a column scrolls, and `scroll` does not bubble), because a popover that
goes stale where it was is worse than one that never moved. Whether it is open,
and the three ways it shuts, are `popover.ts` — see the preferences above for
what that receptacle is, and for the click-away bug that only showed up once
both of its consumers were written down beside each other.

Commits-off and no-work-tree are SETTINGS rather than faults — dim, inert, no
warning colour. `⚠` is for the two anybody can act on, in the two tones that
tell them apart: amber for a busy repository, which will take a commit once the
rebase is finished, and alarm for a git that failed, which will not. `faceOf`
and `MARK` in `said.ts` are the whole of that decision — a pure function of the
two published values, and a table over the faces, so both are unit-tested with
no socket and no browser — and `data-state` on the pill is what a scenario
asserts on.

It exists because every write olai makes is a write nobody typed: the agent
auto-approves its ops, so git is how you see what the tool did to your files.
Writes land on disk and WAIT; this is what asks for the commit, and the agent's
`commit` tool is the same action through the other door.

The panel never shows a text diff — a `.jsonl` diff is one enormous line per
node — so every outline row is a NODE and what changed about it
(`Outlines.tsx`). The classification is the server's (one `Sort` per change,
from `@olai/format`), and `client/changes.ts` is this client's own table of
words for it: the log says `done:`, the panel says "marked done". It sits a
directory up rather than in `commit/` because the chat transcript draws an olai
write in the same words — one event seen at two moments, and a second table is
the day one of them starts saying something else. What stayed in `said.ts` is
everything about the pill, which nothing else reads. `data-sort` is what a test
asserts on, never the phrase, which the view is entitled to reword.

**It reports on the WHOLE REPOSITORY**, which is `commit-whole-repo` and the
human's own bug: edit a `.md` by hand and the git part of the UI showed nothing
pending. So there is a second kind of row (`Others.tsx`) — one path and one
status chip, for every dirty file that is not an outline olai serves. Path-level
and deliberately nothing more: the only richer thing available for a document is
the text diff this feature has never shown. A scope line under the two lists
says what they are a list of (`whole repository · olai serves docs/`), because
"why is my README in here" is a question the rows cannot answer.

The chips are **git's** words rather than the person's, and one of them reads
oddly on purpose: an unstaged `mv a.md b.md` is `deleted` on one row and
`untracked` on another, because that is what `git status` sees until both halves
are staged — `renamed` appears once they are. Saying "renamed" over git's own
two rows would be the panel guessing at an intention, and what a person is about
to commit is what git thinks is there.

Every row carries a TICK (`Tick.tsx`, `selection.ts`) and all of them start
ticked, so the ordinary sweep is one click. What is stored is the EXCEPTION —
the paths somebody unticked — so a file that arrives while the panel is open
(the server sweeps on a timer of its own) arrives ticked rather than being
quietly left out of a commit the button says is sweeping everything. Unticking
dims the row and recomposes the message and the button label live, through
`@olai/format`'s own `composed`: the same function the server would have used,
so the two faces cannot word one commit differently. The unit is a FILE — an
outline's node changes travel together, because a partial `.jsonl` write is not
a thing that exists — and the key is the repository-relative path, which is the
one name that cannot collide with a served outline's.

The unpushed line (`Unpushed.tsx`) is the other half: `2 commits not on
origin/master`, and one Push button. One verb, no arguments, and a refusal —
authentication, a non-fast-forward — kept verbatim, because resolving it is a
conversation in a terminal and git's words are how it starts. The same count
rides the pill in the header, which is the human's ruling at dispatch: one
indicator, and "recorded here and nowhere else" is a different fact from "not
recorded" rather than a second control.

Nothing here is state this browser keeps. What is waiting arrives on the
`pending` cell, derived from git on the server, so a tab open all day is
looking at the repository as it is rather than at a tally it kept — an outline
edited in vim is in the list, and a commit made in a terminal takes itself out.
The panel carries the LAST COMMIT above it, because "what is waiting" and "was
anything ever recorded" are two questions and only the second one distinguishes
a directory olai has never touched. The one clock is `ago.ts`: the phrase moves
on its own, since the value it is drawn beside can sit unchanged all afternoon.
The two things that ARE local are the selection and the draft message. The draft
follows the composed suggestion until somebody types and is theirs from then on
— `null` is "nobody has typed" — which is the promise the seed-once box made
with no way to keep it: it could not follow a selection, because it had no way
to tell a stale seed from an edit.

## On a phone, and on a home screen

`src/client/public/` is the install surface's files — `icon.svg`, the 192 and
512 PNGs, a maskable 512 and an `apple-touch-icon` — copied verbatim to the
dist *root* by the build, outside `/assets/`: a manifest and an
`apple-touch-icon` are read by an installer rather than by the shell, so their
URLs have to be stable ones and must not change with their bytes. They are the
original olai mark, ported unchanged from the racket implementation. The
manifest that names them is the *server's* (`packages/server/src/manifest.ts`,
served through kolu's manifest layer); `index.html` names the same mark again for what
reads no manifest — the browser tab, and iOS's Add to Home Screen. There is no
service worker and no offline shell: this app is live or nothing, and a cached
shell would show outlines that had stopped being true.

Below **48rem** — the racket original's own breakpoint, and Tailwind's `md` —
two things change. There is no second column to put the directory in, so the
sidebar (agenda, calendar, file tree) goes behind a BURGER in the app header as a
slide-over **drawer with scrim**: shut, the outline has the screen under the
header; open, the drawer covers the left with a dim scrim over the page.
Navigation taps (and the scrim) put it away; folder folds do not. App chrome
stays in the header, so the agent is one tap away. Chat is a bottom sheet
(half/full snap), collapsed to the thumb strip — the mobile-pwa "chat full
sheet" debt is discharged here.

An always-open capped strip of the whole sidebar was the first answer, and it
was worse in both directions: it took a third of the screen from the outline to
show a list nobody had asked for, and the agent ended up inside a strip that
scrolled. Two taps is still the budget for anything in the directory drawer.

And what a finger aims at grows to 44px, the number both mobile platforms
print in their guidelines: sidebar entries — outlines and documents alike —
days of the month, the month's paging chevrons, the Done segments in Prefs, the crumbs,
and the link on a node's `doc` reference. `touch.ts` is that decision —
the target size once, since it is one policy, with each control's *compact*
size spelled where that control is drawn, since that is a design per control.
The same file holds the one place the rule cannot be obeyed in both
directions: the tree's gutter. A hover strip (collapse triangle; `•••` menu on
pointer devices only), a filled bullet, and the mark-column checkbox at every
level of indent leave a 390px screen no room for the title if each took 44px
across, so they take the full 44px in HEIGHT — the axis where a miss lands on
the wrong node — and a narrow permanent width (1.75rem on a phone, 1rem on a
pointer). The note indents (`PAST_*`) are arithmetic over those widths and the
one shared `GUTTER_GAP`, because when any of them moves the note has to stay
under the title.

**The `•••` is the one control that gave way entirely, and a GESTURE is what
replaced it.** It is not drawn below 48rem — a second always-on cell before the
title is what the paragraph above says there is no room for — so what a phone
holds a finger on is the ROW (`longPress.ts`), and the same menu opens off the
row's own left edge with the same catalog. A gesture is the only affordance
that costs no width, which is the whole argument for it; the price is that
nothing on screen advertises it, which is the price Workflowy's own handset
gesture pays too. What the press is careful about is everything else a finger
on a row already means, and each half is written down where it is done: the
page goes on SCROLLING (nothing is prevented on the way down, and a finger that
drifts past the slop or that the browser takes for a scroll drops the timer),
the browser's own long press does not answer over it (`contextmenu` is
prevented for a press this client is holding, which is what takes Android's
text-selection callout with it, and `HELD` — `touch.ts`, beside every other
finger rule a row carries — turns the callout off for iOS, which raises it
without the event), and the tap a lift leaves
behind is dropped (`ghost.ts`). Touch and not pen: a pen hovers, so it has the
`•••` already.

The line is `md` (48rem) rather than `pointer: coarse` so the layout and the
targets are one decision: the sidebar stops being a column at exactly that
width, which is where the racket original put both.

`viewport.ts` is the last piece: an on-screen keyboard covers the bottom of the
viewport without shrinking it, so the page measures `visualViewport` and
publishes `--visible-h` and `--visible-bottom`. The arithmetic is a plain
function of two numbers and unit-tested as one. The agent dock / sheet is sized
by `--visible-h` minus the header strip, which is what keeps its composer on
screen while the keyboard that is being typed into is up. The main column still
clears the home-bar inset (`CLEARANCE`).

## Command palette shell

`src/client/palette/` is the ⌘K shell — navigation (home, today), panel
toggles, a `>` prefix that sends the rest to the agent — plus jump-to-node
search. Op actions belong to the separate `palette` roadmap item.

## Search: one reading, two doors

`src/client/search/` holds the search itself, because the palette is not the
only door to it:

- `nodes.ts` — `createNodeSearch`, a `createResource` over a debounced query
  (`@solid-primitives/scheduled`). The resource drops the answer to a query
  the box has moved past, which is why there is no sequence counter here.
- `Result.tsx` — the row both doors draw: TWO STACKED LINES, title then
  place, each `truncate`d over `min-w-0`. It was one line with the place
  inline, and a mono place refusing to shrink starved the title into
  one-word-per-line rows and pushed the palette into a sideways scroll; a
  popover never scrolls sideways.
- `HeaderSearch.tsx` — the box in the app header, and on a phone a magnifier
  that opens the ⌘K palette instead (the bar has no room, and a phone has no
  chord — so before it, a phone had no door to search at all). Its panel
  portals out of the header and is placed by `anchor.ts`'s `styleOf`.

The matching is entirely the server's — the same `Query.search` reading an
agent's `search_nodes` gets — so there is deliberately no matcher in this
client (`palette/items.ts` says why).

## The keyboard, in one file

`src/client/keys.ts` is every key this app answers, and it is one file because
a chord and an editing key that both claim one combination disagree silently,
in a browser, while somebody is typing. Two layers, and they never overlap:

- **global chords**, with a modifier, listened for on the window (one
  listener, in `palette/Palette.tsx`): **⌘K** palette, **⌘\\** sidebar, **⌘J**
  chat, **⌘Z** / **⌘⇧Z** undo and redo. Each says whether it may fire while
  focus is in a text field, and ⌘Z is the one chord with a shifted twin — so
  the table carries `shift` and the matcher reads it exactly, rather than
  spelling redo as a different letter this app would have invented.
- **the row editor's keys**, which are bare (`Enter`, `Tab`, the arrows) and
  are matched on the editor's own element and nowhere else. A window listener
  claiming those would eat every keystroke in the chat composer and in the
  palette's own input.

A unit test holds the two apart: every chord the global layer claims must be
dead to the row layer, on both platforms.

## Editing a row

`src/client/edit/` is the Workflowy loop, and every write it makes is a surface
procedure — one op, at the same write gate the agent's tools go through
(`packages/server/src/edit.ts` turns the key into the op). What is here is the
loop a person is in, and nothing about outlines:

- **`draft.ts` — the draft cell.** The one piece of state in this client that
  is not the server's, and it is allowed because a draft is not a claim about
  the outlines: it is the text in an editor, like the chat composer's. It is
  committed on **blur**, on **Enter** and on going **idle**; a commit that
  would change nothing sends nothing (so sitting in a row is not a git commit);
  and a commit that is REFUSED keeps the draft, with the reason beside it.
  A NEW row is a draft too — `Enter` opens an editor where the row will go and
  the `add` lands when it has a title, so a blank record is never written and
  a key pressed by accident writes nothing.
- **`editing.tsx` — the caret.** One draft at a time, because there is one
  caret. Structural keys commit the text first and then ask, in that order.
  Which id an edit names is a rule, and the draft carries both halves of it:
  what a node SAYS (title, note, mark) names the node the row SHOWS, so typing
  in a mirror edits what it stands for; where a row SITS names the row's own
  record, so moving a mirror moves the placement and `Enter` on one makes a
  sibling of the mirror. And because nothing is optimistic, a row is redrawn
  somewhere else when the file says so — so the draft names a ROW and where it
  is drawn is looked up rather than remembered. Keeping the reader's place
  across that frame is the module's real work.
- **`RowEditor.tsx` — an `<input>`, not a `contenteditable`.** A title is one
  verbatim line of text; what the page DRAWS is a rendering of it (inline
  markdown and `#tags`), which is the argument for an input rather than against
  it — a contenteditable would be that rendered HTML made editable, with every
  keystroke turned back into the one string the record holds. The trade is
  deliberate and visible: while you type, a title reads as its source, and the
  rendering comes back when you leave. The NOTE takes the same trade in the
  same shape: it edits IN PLACE, styled as the note rather than as a control
  (`ROW_NOTE` in `touch.ts` is the one spelling of what a note looks like, so
  the clamped line, the rendered note and the editor cannot disagree about size
  or tone), and clicking one puts the caret in it — expanding and editing are
  one gesture, because a clamped line is not something anybody can type into.
  Click away — or press Escape, since it shuts by the client's one dismissal
  (`dismiss.ts`, above) — and it folds back, exactly as it did before; the full
  RENDERED note is the node's own page, where a note has always been the body.
- **Two keys write the three marks, and they are one modifier apart.** `Enter`
  is the row's key and what is held says which kind of change it is:
  `Ctrl+Enter` finishes something (and takes that back), `Ctrl+Shift+Enter`
  WALKS the mark on — a bullet, then `todo`, then `doing`, then a bullet again.
  The last stop is an answer rather than a gap (`format.md`: an unmarked node is
  not an unfinished one), so the walk takes a mark OFF as well as putting one
  on. `done` is not a stop on that ring, deliberately: passing through it would
  stamp a completion instant, fire the rollup's nudge and hide the row under
  Prefs' Done setting, all on the way somewhere else. And the walk does not smuggle a
  node back out of `done` — it asks for `todo` outright and meets the ops
  layer's refusal under the row, whose sentence names the key that gets through
  it. Two ops, the second one the person's, exactly as the menu asks two clicks
  and an agent makes two calls. Where the ring goes is resolved on the SERVER,
  over the mark the node actually carries (`server/src/edit.ts`), for the reason
  `Ctrl+Enter` sends "toggle" rather than a direction.
- **Two keys change how many rows there are, and where the caret is decides
  which reading each takes.** `Enter` with text on BOTH sides of the caret
  splits the row there; `Backspace` at offset zero with nothing selected joins
  it onto the row above. Neither is a mode — what decides is where the caret is
  in the sentence a person is already reading, which is how every outliner
  behaves. At the END of a line `Enter` is the key it always was, and at the
  HEAD of one it is too: an empty title is not a node this format can hold, so
  there is no blank row to insert above and nothing is written the write gate
  would refuse. A half that is nothing but WHITESPACE is the same case and is
  answered the same way, in the matcher, rather than as a refusal a person then
  has to read. `Backspace` is claimed at the ONE position where it has nothing
  of its own to delete, and is the field's own everywhere else.
  Both are ONE op — `split` and `merge`, the same two an agent calls — which is
  the difference that matters: a merge joins two titles, joins their notes,
  hands the row above everything that hung under this one and puts the record
  in the archive, and a sequence assembled here could stop halfway through
  that. Both COMMIT FIRST when the row is still a draft, because the row has to
  exist before it can be cut or joined — a split then cuts what the `add` wrote,
  and a merge joins it onto the line above, which is the ordinary "I meant this
  on the previous line" gesture. Both name the ROW's own record, not the node
  the row shows: each changes how many rows the reader's page has, so each is a
  question about where rows SIT, and both are refused at a mirror in the ops
  layer's own words rather than writing in a file nobody is looking at. The
  caret is a fact about the FIELD, so it is read at the one DOM site that has an
  element (`keyHandler` in `RowEditor.tsx`) and travels as a value — which is
  what keeps the matcher and the editor both testable with no browser. Where it
  LANDS afterwards is the draft's (`caret`): the head of the half that came off,
  or the seam two halves were joined at, neither of which is the end of the text
  or where it was in an editor that has gone away.
- **Where the caret is, said twice.** The row holding it is toned and its
  bullet takes the accent (`data-editing` on the row is what a scenario asks).
  A blinking cursor at the end of a title is the whole affordance a walk with
  `↑`/`↓` had, and in a tree of a hundred rows that is a pixel nobody finds.
- **The keys are written down for a person** (`SHORTCUTS` in `keys.ts`, drawn
  by `palette/Shortcuts.tsx`, opened from ⌘K). Beside the matchers rather than
  in a document, so what a key does and what it is said to do are one fact; a
  unit test holds the list to covering every editing action.
- **`order.ts`** flattens the drawn tree so `↑`/`↓` step through what is on
  screen, folds and all.

There is deliberately no delete, no multi-select and no
drag-drop: each is its own roadmap item. Putting a node AWAY is not among them
— that is `Archive` in the `•••` menu below, which is the ops layer's own
put-away rather than an erase.

## Undo, which is a write

`undo.ts` is the stack, `undoing.tsx` holds it, `UndoSaid.tsx` is what it has
to say — the same split as `draft.ts` / `editing.tsx` / `RowEditor.tsx`, and
for the same reason: the rules are a value and four functions over it, so they
are answerable without a browser.

**⌘Z sends the inverse; it does not restore anything.** Every structural write
answers with the edits that would reverse it, derived on the server from the
snapshot that write was judged against (`server/src/edit.ts`'s `inverseOf`) —
where the row sat, which mark it replaced, the id an `add` minted. ⌘Z replays
that through the same `edit.apply` gate, against the set AS IT IS NOW. That is
the whole feature: a restore would take back what the agent, another tab or a
`git pull` did since, and there is no way to spell that as something a person
meant. A replayed inverse either fits or is refused naming what moved.

The rest follows from that:

- **an undo is undoable.** Replaying an inverse answers with ITS inverse, so
  redo is the same machinery rather than a second stack with rules of its own.
  A new op clears the redo side, the standard way.
- **a refused entry is dropped, and the reason is on screen.** It is off the
  stack before the write is sent, so pressing ⌘Z again reaches the edit BEFORE
  the one that will not go. What it says is drawn over the page rather than
  under a row (`UndoSaid.tsx`), because an undo is pressed with no draft open
  and the row it is about may be somewhere else, or gone.
- **the DRAFT is not in it; the op it commits is.** Both chords are dead while
  an editor is open — an `<input>` has the platform's own undo, and abandoning
  what you are typing is Escape's — but a committed title or note is an op like
  any other, and the text it replaced is a perfect inverse. Reading those two
  as one thing is what shipped a ⌘Z that answered "nothing to undo" to somebody
  who had just retyped a title (human, driving it, 2026-08-12). A text inverse
  carries `was` — the text it expects to find — so it may only overwrite what
  this tab wrote, and somebody else's words are refused rather than replaced.
- **it is one page's and one session's**, cleared when another outline opens
  (its entries name rows in that one), bounded at a hundred, and holding only
  what THIS tab wrote.

One thing it does not do, and it is the ops layer showing through rather than a
choice made here: putting a mark back over a node that is now `done` takes TWO
ops — the layer refuses to walk finished work backwards in one — so an entry is
a LIST of edits, replayed in order, which is exactly the two calls an agent
would make.

Undoing a row's creation ARCHIVES it (the only removal the set has), and that
used to be the one entry which said it could not be redone, because no `move`
brought a row back out of an archive. `unarchive` is the verb that does
(`parity-unarchive`), so the un-create's inverse is now an `unarchive` carrying
the exact place the row sat, ⌘⇧Z puts it back, and nothing here has a sentence
for a redo that cannot happen.

That un-create is the ONLY way anything is removed from this face, and it is
not the delete key #109 deferred: no key sends it, it can only take back a row
that was just made, and it refuses once anything has been filed under that row.
Whether a delete key ever arrives — over which rows, with what confirmation —
is still that item's question.

Two more shapes this leaves, named because a reader will look for them:

- **a zoomed page's heading is not editable.** A row's title is, and the
  heading is the same node — but it is the page's SUBJECT rather than a row of
  it, drawn by `NodePage` outside the tree the editor's places are keyed by.
  Editing it wants the caret model to mean something on a page with one
  heading and N rows, which is a decision rather than a line of code.
- **the checkbox is display-only.** `Ctrl+Enter` in a row's editor ticks a node
  off, `Ctrl+Shift+Enter` walks its mark on, and the `•••` menu writes any of
  the three; the box itself stays a
  reading (`Checkbox.tsx` says why). The `•••` is not drawn below `md`, which
  used to mean a phone could open a title by tapping it and could not tick it
  at all; holding a finger on the row opens that menu now, so the marks are a
  thumb's as well.

## The ••• menu

`src/client/menu/` is the row's own menu, and it grew from five ways of LOOKING
at an outline into the place a mouse changes one. That is a consistency fix
rather than editor growth: an agent at the same directory could mark a node
todo, clear a date, retire a placement and archive a subtree, and a person
could do none of them (HACKING.md — "MCP and Web ops must be consistent; never
deviate"). Every verb below rides the same intent seam the keys ride, so what
lands is the request `set_todo` / `set_date` / `remove_mirror` / `archive_node`
would have sent, judged by the same planner and refused in the same words.

| file | what it owns |
|---|---|
| `verbs.ts` | which writes a row offers, and what each one DOES — the exact `Edit` it sends, or that it opens the row's date picker. Pure over a `Row`, so the contextual rules are a unit test |
| `subtree.ts` | what hangs under a row: the count a confirm names, and the text a copy produces. Pure |
| `actions.ts` | the catalog: the view verbs, the writes, the clipboard |
| `NodeMenu.tsx` | the panel, its confirm step, and the line beside the `•••` |
| `door.ts` | how a row's menu is reached: the state behind the `•••`, the long press that is the other door, and the `ref` for the line both are about — handed out together, so a row cannot wire one and forget another |

The write gate itself is `../writes.ts`, one level up: two surfaces send a
pointer's write now (this menu and the date picker), and the four lines that
turn a refusal or a nudge into a sentence may not have two copies.

**The menu itself is `@kobalte/core`'s `DropdownMenu`, not ours.** Being open,
where the panel goes, the pointer outside that shuts it, Escape, and the arrow
keys that walk the list are the
SolidJS ecosystem's accessible primitive doing them (HACKING.md — "make full
use of the ecosystem of libraries in SolidJS instead of hard-rolling"). What
this file had instead was a fourth copy of the same forty lines, with
`role=menu` and the keyboard that role promises deliberately left out *because
the copy did not implement them*; the list is a real menu now, and
`features/menu_panel.feature` holds three halves — the dismissals, which were
true before and untested; the keyboard, which is what adopting the primitive
bought; and where the caret is after each of them, which is the part the
primitive does NOT do here (below). The panel is drawn exactly where the
hand-rolled one was:

- **`placement="bottom-start"`, `gutter={2}`** is what `absolute left-0 top-full
  mt-0.5` was, and the content is NOT portalled — Kobalte's positioner is an
  absolute box in the row's own positioned root, so the panel still scrolls with
  its anchor and the open menu is still inside `group/row`. Floating-ui flips it
  above the row near the bottom of the window, which the hand-rolled one could
  not do.
- **`modal={false}`**: a row menu is not the only thing on the page, and the
  panel this replaces locked no scroll, disabled no outside pointer and trapped
  no focus.
- **the caret is this file's own, both ways, and that is the one place the
  primitive does not carry its weight here.** Kobalte puts the caret in the
  panel when a menu opens and back on the trigger when it shuts; both hooks are
  registered by effects owned by the content COMPONENT, and a menu laid out in
  the row rather than portalled keeps that component alive across every open
  and close (the panel is a `<Show>` inside it), so neither runs again. In it
  is a `queueMicrotask` in the content's ref — load-bearing on the second open
  and every one after, since the first creates the component while already open
  and so focuses itself. Back out is `handBack`, hung off the panel's own
  disposal, which is the one thing that fires on every close; without it Escape
  out of a keyboard-opened menu leaves the caret on `<body>`. A press OUTSIDE is
  left alone — it landed somewhere, and that is where the reader is.
  `features/menu_panel.feature` holds all of it.
- **the `•••` stays lit while its menu is open** — `data-[expanded]` in
  `touch.ts`' `MENU_REVEAL`, which is steadier than the focus-within it used to
  ride on, since a menu's own list takes and drops the caret as a pointer moves
  over it.

**Two doors, because below 48rem there is no `•••` to press.** A phone reaches
the same menu by HOLDING a finger on the row (`longPress.ts`, and the gutter
section above for why a gesture is the only affordance that fits). Three things
follow and they are the whole difference:

- **being open belongs to the ROW** (`menu/door.ts`) rather than to a signal
  inside the panel's component, since both doors write it — and the menu is
  CONTROLLED rather than mounted `defaultOpen`, because a row asked a second
  time already has a primitive with nothing to remount. That module hands out
  everything the row has to wire (the state, the gesture's two handlers, and
  the `ref` for the line both are about), because a row that wired one and
  forgot another is a row a phone cannot reach that looks exactly like a row
  that can.
- **the `•••` is `display: none` below `md`** — `MENU_CELL` in `touch.ts`, its
  own constant rather than a `hidden` bolted onto `HOVER_CELL`, since those are
  the same property and which wins is Tailwind's emission order (the phone
  scenario caught it winning the wrong way). What cannot be hidden is the ROOT,
  which is what it used to be: the panel is inside it, and a `display: none`
  ancestor takes the panel with it. So below `md` the root is out of the
  gutter's flow instead — a zero-width absolute box at the row's left edge,
  which is what keeps `touch.ts`'s arithmetic true.
- **the panel hangs off the row line there**, through `getAnchorRect`: the
  `•••`'s box if it has one, the row's when it has none. A question about the
  drawing rather than about the viewport, so there is no media query in the
  component at all. One placement, two anchors.

The gutter shots on a laptop are byte-identical across the change.

**A tap is not a click, and the menu had a hole under it.** Kobalte selects an
item on the pointer-up and `closeOnSelect` takes the panel down in the same
breath, so the click a touchscreen makes up for the tap is hit-tested against
what is under the point BY THEN — the row the panel was covering. Choosing
`Move to Trash` with a thumb navigated into a mirror three rows down. `ghost.ts`
is the one answer to that: eat the next click, once, briefly, on `window` in the
capture phase, for the two gestures that leave one behind (a tap in the panel,
and the lift at the end of a long press). It is one listener and one instant for
the whole page rather than one per gesture, because "the click about to arrive
was made up for a gesture that is over" is a fact about the DOCUMENT — two
gestures overlapping is still one ghost. It is touch-only: a mouse's click goes
to the ancestor of what was pressed rather than to a fresh hit-test, which is
why a pointer has never seen this.

**And the primitive is mounted the first time a row is asked for its menu, not
before.** A shut `DropdownMenu` is not free: the root builds its disclosure,
list and popper state, and the content's body runs eagerly (only its DOM waits
on the open state), which per row is an `IntersectionObserver`, a deferred
autofocus timer, four locale subscriptions and a few dozen signals. On this
app's own roadmap — 140 rows — that measured 140 `IntersectionObserver`s and 33
MB of heap against the hand-rolled panel's none and 19 MB. So until the first
press the `•••` is a plain `<button>` (`Dots`), the press that arms the row is
the press that opens it (`defaultOpen`), and the row stays armed afterwards;
the measurement is back to 0 observers and 19 MB. The keys that open a menu arm
it too, because that button is what a Tab lands on. What the adoption does cost
unconditionally is **bundle**: `DropdownMenu` is ~85 kB raw / ~24 kB brotli on
the first-paint chunk, which is a code-split (`markdown/chunk.ts`'s shape) this
has not taken.

- **The reads are still first, and a rule separates them.** Above it, verbs
  that change what this tab is looking at (zoom, the four folds, copy link);
  below it, verbs that change the directory. Reaching for `Collapse all` and
  hitting `Archive` is a mistake the ORDER can prevent.
- **One entry OPENS something instead of writing.** `Set date…` on an undated
  row, `Change date…` on a dated one — a date is a value somebody has to
  choose, so the entry opens the row's picker (below) and the write happens a
  gesture later, through the same seam every other verb rides. The ellipsis is
  what says so; `verbs.ts`' `Does` is where the two answers are declared, so a
  verb that opens something is a thing a reader can find rather than an entry
  with a missing edit.
- **Every entry is a verb that would do something.** The mark a node already
  carries is not offered back to it, `Clear mark` appears only on a marked row,
  `Clear date` only on a dated one, `Remove this placement` on any row whose
  RECORD is a placement — asked of the record rather than of what the row drew,
  so the degenerate kinds need no case of their own (a set holding a mirror of
  nothing is one the validator refuses, so that row is not on screen to begin
  with) — and `Move to Trash` only on a node's own row, because on a placement
  the verb IS retiring the placement.
- **What ops refuses is quoted, not summarised.** A `done` node still offers
  `Mark todo`, and choosing it answers with the ops layer's own sentence —
  *nothing should decide on your behalf that finished work is not finished* —
  because the two calls that walk it back are the two an agent makes, and the
  second click is the person's. A nudge from a write that LANDED arrives on the
  same line in the other mood (`data-tone`: `alarm` / `aside`).
- **Move to Trash asks first, and says how much goes.** The human's ruling: a
  subtree may be put away WITH a confirm naming the blast radius — *"Move
  “install the cabinets” and the 3 rows under it to the Trash?"* — and the
  confirm is this panel's own second step rather than a `window.confirm()`,
  which is browser chrome olai does not own and cannot say a sentence in. It
  is a trash and not a shredder (the ids come along, so mirrors and `after`
  edges go on resolving), and the confirm promises the way back it now has:
  the sidebar's Trash, and `Put back` (below). The entry speaks Trash while
  the wire verb, the op and the agent's tool stay `archive` — the file is
  still `Archive.jsonl`, and only the human-facing surface renames.
- **⌘Z takes back a menu write too.** A verb files what would undo it on the
  same stack a keystroke files on (`../writes.ts` → `Undo.record`), so the chord
  does not mean two different things depending on which hand made the edit.
  Which writes HAVE an inverse is the server's answer rather than the menu's —
  and every write here has one now: a mark and a cleared date restore
  themselves, and a `Move to Trash` answers with `unarchive` carrying the
  exact place the row sat (`inverseOf`), so ⌘Z brings it straight back.
- **Copy as text** is the one pure read among them: the subtree as tab-indented
  plain text, titles verbatim, notes one level under their node, nothing
  encoding a mark or a date. A mirror copies what it draws. It follows the
  READING, deliberately — folds are ignored (a triangle is one tab's business,
  so the whole subtree goes) but done-hidden branches are already gone from the
  rows, so they are not copied. Copy what you can see, and everything under it.
  The archive confirm's count is the opposite and asks the SET, because that
  one is about the write rather than about the picture (`subtree.ts` holds both
  answers and says which is which).

Not here: `see` / `after` edge editing and mirror creation (they want a node
search — `parity-see`, `parity-after`, `input-widgets`), move-to, and
duplicate. Unarchive is no longer on this list: it is the Trash's one verb
(below), born in the ops layer and exposed on both faces together.

## The Trash

`src/client/trash/TrashPage.tsx` is `Archive.jsonl` made visible — the
`parity-unarchive` ruling's UI half. The web calls it TRASH because that is
what it is to a person; the file keeps its name, the ops vocabulary keeps
`archive_node` / `unarchive_node`, and only the human-facing surface renames.

- **One page for every archive.** `/trash` (and any archive's own `/o/…`
  address — an archive is not a place you edit, so `page.ts` sends both doors
  to the same view) draws each `Archive.jsonl` under the directory as the tree
  the archive op wrote: scaffold titles, subtrees shaped as they left. The
  sidebar's file tree never lists an archive; the `Trash` entry at the foot of
  the column is its one door, drawn whether or not anything was ever archived,
  because an empty trash is a fact rather than a hidden control.
- **The signposts are drawn, and refuse.** The tree includes the scaffold of
  ancestor titles `archive` minted, and the root row of a pile IS one of them —
  so "put this back" reaches for it first. `Put back` is offered there like
  anywhere else and the OPS LAYER refuses it, naming the live node that already
  carries the title and saying to put back the rows under it instead. The
  button is deliberately NOT hidden: the rule is the op's, both faces meet the
  same sentence, and a client that greyed it out would either teach a rule this
  app does not have or need its own copy of the landing walk to know which rows
  qualify — which is the face-split this whole item exists to close.
- **Read-only, one verb.** No editor mounts here, no `•••`, no checkbox — a
  row is its title and `Put back`, which sends the `unarchive` edit with the
  id alone. Where the subtree returns is the ops layer's own default: the
  recorded chain of ancestor titles, matched back against the live outlines
  beside the archive. A chain that matches nowhere or more than one place is
  a refusal in the ops layer's own words, verbatim under the row
  (`data-tone`, the same two moods every verb line has); `unarchive_node`
  takes `parent` / `file` for an agent that knows better, and an undo sends
  exactly those, because the server read the real place off the snapshot the
  archive was judged against.
- **The empty trash is a page.** The archive tool re-creates `Archive.jsonl`
  on first use, so an absent file and an empty one are the same sight: "The
  Trash is empty."

## The date picker

`src/client/date/` is the other half of `set_date`. MCP could set a node's
`date` or clear it; the web could only clear one, which is the same
consistency deviation the menu's verbs closed one field at a time
(`parity-date`, under `editor-op-parity`). Two doors, one picker:

- **the date pill on a row IS the control.** A dated node already draws its
  date, so pressing it opens the picker — the badge becomes a `<button>` and
  nothing else about it moves (`DateBadge.tsx`: same box, same tone, same
  testid, same `data-` facts, plus `data-picks`). Offered only where the row is
  editable, which is the rule a title's `onEdit` already follows: a day page
  and the agenda are a QUERY over the whole set, drawn read-only, so the pill
  there says something rather than doing something.
- **the `•••` menu's `Set date…` / `Change date…`** is the door for a row with
  no date to press, and the one a keyboard reaches.

What it is:

- **`<input type="date">`, because it cannot mint an instant.** Its value is a
  `YYYY-MM-DD` string or nothing, which is exactly what the format stores —
  dates are TEXT, verbatim, and a date-only value round-tripped through a
  `Date` comes back a datetime (`docs/format.md`). So the day picked is the ten
  characters written, with nothing parsing or formatting on the way, and the
  calendar, the locale and the keyboard entry are the browser's on every
  platform olai is read on. A node scheduled for an INSTANT seeds the day that
  instant falls on (`@olai/format`'s `dayOf`, the same reading the calendar
  takes) and the panel says so verbatim, because picking a day replaces the
  time as well.
- **in place, under the row.** Everything else a row says about a write is
  drawn there — the refusal under a title, the note, the aside about a mirror
  — and a floating panel would be the one editing surface with geometry of its
  own to keep anchored. Escape and Cancel are the ways out; a click OUTSIDE is
  deliberately not one, because the browser's own calendar popup is chrome
  outside the document and a dismissal listening for a pointer elsewhere would
  shut the picker the moment somebody reached into it.
- **clearing is absorbed, in the menu's own words.** Empty the box on a dated
  node and the button reads `Clear date` and sends `Clear date`'s edit — one
  spelling of taking a date off, whichever door a reader came through, and no
  dead button in the one place somebody is most likely to be reaching for
  exactly that. #124's menu verb stays exactly where it was. On an undated node
  the button stays `Set date` and is simply dead: there is nothing to clear,
  and a dead button naming a verb nobody can perform is worse than one naming
  the verb they came for.
- **the pure half is `pick.ts`** — where the box starts, the one `Edit` a pick
  sends, and `pressOf`, which answers what the button SAYS and whether it does
  anything as one value. Those two were two functions until they shipped
  disagreeing (a `Clear date` offered over a node with no date to clear), which
  is the argument for deriving them together. A dead button is the editor's own
  rule one field along (`edit/draft.ts`: a commit that would change nothing
  sends nothing), never a fence on what may be written. `DatePicker.tsx` is the
  panel; the row owns whether it is open (`Tree.tsx`), because two things open
  the one picker.
- **it names the node the row SHOWS**, so a pick at a mirror lands on its
  target — the standing routing rule, one field along from the marks. And it is
  the same intent, at the same gate: what lands is the request an agent's
  `set_date` would have sent, so the agenda and the day pages move the moment
  the file says they should, and ⌘Z takes the pick back off the same stack a
  keystroke files on.

A phone reaches this on a dated row through the pill, which is drawn
everywhere, and on an undated one through the `•••` menu's own verb — which it
now has a door to: no `•••` is drawn below `md`, so a long press on the row
opens the menu (`longPress.ts`). The gap this paragraph used to record, along
with the checkbox's, is closed.


## What belongs to a reading, not to the file

Three switches decide how a tab is reading rather than what the files say: what
is folded, whether done nodes are drawn, and which month the calendar shows.
None of them goes to the server or to disk, and hiding what is done is a row
not drawn rather than anything marked.

What they differ in is HOW LONG THEY LAST, and that is what decides where each
one lives. Folding and done-visibility belong to the browser (`fold/`,
`settings/done.ts`); the calendar's month is the calendar's.

**Folding is this browser's** (`fold/`), and it used to be the page's. The
argument for the page was that somewhere you zoom into is a new thing to read;
the answer (2026-08-13, human) is that a person with a real corpus was
re-collapsing the same big trees on every single visit, which is a bug and not a
doctrine. So a fold is a preference now — `preference.ts`, `olai.folds`, per
device, carried into this browser's other tabs by the `storage` event and
nowhere else at all.

It is kept **by node id**, grouped by the file the node is DEFINED in, and each
half of that is load-bearing. A `Row.key` is a PLACE — the chain of records
above it — so it changes when a node moves, and the walk under a zoomed node
spells the same row differently than the whole outline does; a fold kept under
one would be a fold lost on the round trip. The file is what makes pruning
answerable at all: a file this browser cannot currently see — one that would not
parse, one no longer served — says nothing about its nodes, so its folds are
left alone rather than dropped into an absence.

What that file may NOT be read as is a claim about one id. **Gone means gone
from the set**, and the case that proves it is the ordinary one: `archive` is a
move, not a delete — the record lands in `Archive.jsonl` with its id kept, and
the file it left goes on being served with the rest of its nodes. Pruning each
bucket against its own file alone reads that as a deletion and forgets the fold
at exactly the moment keying by id was supposed to keep it (a place key could
not survive the move at all, which is why it is not the key). So an id its own
file has stopped declaring is looked for in the others and re-filed under
whichever one has it; only an id no live file declares is dropped. The same rule
holds on the write side — an id is taken out of every other bucket as it is
folded — because the set a row reads is the union, so a copy left behind under
the old file would be the answer that wins.

Pruning happens as the entry is rewritten, which is exactly when the derivation
is in hand. A write starts from the stored entry unioned with what this tab
holds, and applies its own change on top: a fold is a SET of independent facts
rather than one value, so two tabs are not making rival picks the way two theme
presses are — last-write-wins over the whole entry would throw one tab's fold
away, and the union is what stops it. A browser that will not give its storage
back reads as nothing there, which leaves the union as what this tab holds —
`preference.ts`'s standing promise.

One consequence is a RULING rather than a fallout: one node, one fold state. A
mirror folds by what it SHOWS, so folding a placement folds the node wherever it
appears — including in the outline the node itself lives in. The per-place
independence that fell out of place keys is gone deliberately, and there is one
fold vocabulary rather than two (`fold/rows.ts` is the whole of it). There is
one CONDUIT too: a row reads `collapsedNodes` and presses `setFolded` itself
(`Tree.tsx`, `menu/actions.ts`, `edit/Editable.tsx`), the way the theme and the
panel widths are read wherever they are wanted — a wrapper on a page object
would be a second way to reach one browser-wide fact, and a holder in front
of it is what invites a copy. The sidebar's folders are the
same memory inverted
(`fold/folders.ts`, `olai.sidebar.folders`): nodes start open so what is stored
is what is shut, folders start collapsed (#105) so what is stored is what is
open.

**Done-visibility is this browser's**, the same standing as a fold
(`settings/done.ts`): Prefs is the one control, there is no per-page override,
and a pick is the reading of every page. Hiding a row writes nothing — the node
stays marked, the file stays put, and this reading simply does not draw it.

The calendar's month is the remaining stamped reading (`stamped.ts`): a value
plus the thing it belongs to, read through a memo that compares them. That is
what makes it start over at the right moment, with no effect watching a route
to clear anything, and so no frame in which the held value and the thing it
belongs to disagree. The stamp is the month it is ANCHORED to, because walking
from one outline to another is no reason to snap the calendar back to today.

## No exports, on purpose

There is no `main` and no `exports` map, because neither product here is an
import. This package produces a **script** —
`bun packages/web/src/build.ts <dist>`, run by `default.nix` and by
`just build-client` — and the **directory** that script writes. The one file
that does cross a package boundary is `src/client/testids.ts`, imported by path
from `packages/tests` so that a renamed `data-testid` is a type error rather
than a thirty-second timeout. An export list would suggest a library this is
not.

## The build spawns Tailwind by path

`@tailwindcss/cli` is invoked through its in-tree path (resolved with
`createRequire`), never `bunx`: bunx resolves by name and falls back to
*fetching* the package when the local copy does not match, and the Nix build
sandbox has no network, so that fallback is a build failure rather than a slow
path. For the same reason `tailwindcss` is declared here directly as well as
the CLI — under the isolated linker (`bunfig.toml`) the CLI's own copy is
nested where `@import "tailwindcss"` cannot see it.

Two other things the build owns and the manifest explains: the Solid JSX
transform runs as a Babel-backed `Bun.build` plugin, because Bun's own
transform emits `React.createElement` and its HTML-import bundler honours no
plugins at all; and the stylesheet is handed back as bytes so
`@kolu/surface-app`'s helper can place it under a content-hashed `/assets/`
name on the same immutable-caching contract as the JS.

`styles.css` holds only the `@theme` tokens — the default palette's values,
since Tailwind can only emit `text-muted` for a `--color-muted` it has seen —
and rules for markup this codebase does not author — the tags of a rendered note or document come from a file on
disk and can carry no classes, and the highlighter's own class names inside a
fence are the same case. Everything else is a utility, inline in the component, so deleting
a component deletes its styling with it. No `@apply`.

## Layering

Depends on `format` (for everything derived) and `surface` (for the wire) —
not on `server`: the two share a contract, not an import. `tests` depends on
this, for the testid names only.
[docs/architecture.md](../../docs/architecture.md) has the reasoning.

## Running

```sh
just build-client            # writes packages/web/dist
just serve docs              # the same build, watched, with a server in front
```

The Nix build runs that same script in its own sandbox (`default.nix`), so
there is one bundler and not two that could drift.
