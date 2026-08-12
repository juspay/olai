# @olai/web — the SolidJS client, and the build that produces it

An app header (wordmark, connection, git, agent toggle, theme), a directory panel
(month + file tree of every outline and document under the folders they live
in — full column or a ~3rem icon rail on desktop; slide-over drawer with scrim
on a phone), a resizable agent dock (or bottom sheet on a phone; minimized to a
pill / thumb strip carrying the last agent message), and one page open in the
main pane — a whole outline, one node zoomed, a document, or one day — kept
current by the live store underneath. ⌘K opens the command-palette shell
(navigation, panel toggles, `>` to ask the agent). SolidJS over a WebSocket,
styled with Tailwind v4, bundled by `Bun.build`.

The build (`src/build.ts`) also writes `.br` / `.gz` siblings next to the
hashed `/assets/*` files (`src/precompress.ts`). The static layer in
`@kolu/surface-app` negotiates them on `Accept-Encoding` (brotli preferred,
gzip fallback, identity honoured); the shell is never compressed. Matching is
a **bare token set** (no q-value parsing, ported from the `serve-static` it
replaced): `br, gzip` gets brotli, but `br;q=0.8, gzip;q=1.0` falls through to
identity. Real browsers send bare tokens, so the shipped path is unaffected.
Already-compressed media types (e.g. `.png`) stay identity even if a stray
sibling sits on disk.

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
strip (`NodeMenu.tsx` `•••` + the collapse triangle, always visible on a phone —
see `touch.ts`) left of a filled-circle bullet (`Bullet.tsx`, with a gray halo
when children are hidden), then the MARK COLUMN (`Checkbox.tsx`: CSS squares —
checked for done, half-filled for doing, EMPTY for todo, and no box at all on a
node carrying none of them, because a bullet is not a task; read-only until
keyboard-editing). Tags in a title are subtle pills (`NodeTitle.tsx`). A node's
free cross-references (`SeeRefs.tsx`) each link to `/n/<id>` with the target's
title, resolved at view time through the same indexes.

The typeface is Workflowy's own Open Sans: nixpkgs' `open-sans` package, converted
to woff2 at build time (`build.ts` via `OLAI_FONTS_DIR` / `OLAI_WOFF2_COMPRESS`
from the flake shell and `default.nix`) and served from `/fonts/` — no CDN, no
font binary in the repo. The eight theme tokens still paint every surface
(`theme/palettes.ts`); the look follows every palette, dark and light.

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
where the glyph's click goes — the box promises no toggle yet, so the click was
free to mean the obvious thing.
The view and the validator agree about what a file means because they run the
same code, not because two implementations were written to the same paragraph.
The one thing this package does interpret is MARKDOWN, rendered and sanitised at
view time.

### And a fourth, for when the client itself is what is wrong

The three above are errors as DATA — read off the wire and drawn on purpose —
so none of them can say anything about a bug in this client: a render that has
thrown is not running the code that would draw them, and what a reader got was
a white tab with the truth in a console they had no reason to open. So the
shell is wrapped in an `<ErrorBoundary>` (`main.tsx`) and `errors/Fault.tsx` is
what it draws: what threw, verbatim, and the two ways out — a reload for a
bundle that is stale, and `/` for a page that is poison, because a fault is
usually deterministic for the route it happened on and Reload alone would be a
loop. A boundary SWALLOWS, so the fallback also logs the fault once: otherwise
the truth is in no console at all, and a browser test meets it as a timeout on a
missing element. There is no way to ASK the app for one —
`features/the_client_breaks.feature` injects a fault from outside the bundle,
and says why at length.

## Markdown, and documents

`src/client/markdown/` is one pipeline for every piece of markdown this app
draws — a node's note, a whole `.md` document and what the agent says in the
chat panel. They are the same language read out of the same directory (an agent
writing a fenced diff into the panel and a person writing one into a note are
doing the same thing), and a second pipeline for any of them would be a second
dialect nobody asked for: footnotes in one place and not the other, a
highlighter kept in step by hand. Parse with GFM, to HTML, anchor the headings,
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
  the sanitiser's default allowlist. `rehype-highlight` is bundled with the
  client (about 180 kB of it): it is in `bun.lock`, so the Nix build fetches it
  like everything else, and no page asks a CDN for the code that renders
  someone's private outline. The colours are this theme's tokens, so a fence
  follows the light/dark palette the rest of the page does. Which grammars it
  knows is spelled out (`render.ts`), because the option REPLACES the default
  set rather than adding to it: lowlight's common set, plus Nix — this
  repository is built with it and `just serve` with no arguments serves its own
  `docs/`, where a ```nix fence would otherwise be grey text. A language nobody
  registered is not an error; the block is drawn as what it is.
- **`rewrite.ts`** is a walk over the finished tree rather than a plugin, which
  is what lets the pipeline be built once — the highlighter registers three
  dozen languages when it is attached, and a pipeline rebuilt per note would
  pay for that on every row of every frame. It answers the two questions only
  this app can: a relative picture becomes a `/media/…` URL and anything else
  is not drawn at all, and every id (and every link into the same block) is
  re-minted under a prefix derived from the block itself, so the first footnote
  of one note cannot answer for the first footnote of the next — and, now, so
  that two notes both opening `## Shape` cannot answer for each other either.
  On its way through it REPORTS the heading tree (`outline.ts`), because the
  ids a contents has to name do not exist until this pass has run.

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
stylesheet: `src/client/markdown/scale.ts` declares the type scale and the two
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
above it declaring a prop for it. The text itself is not fetched — it arrives
on the manifest, so a document edited on disk redraws by the mechanism that was
already there.

## Five routes, and what each is a property of

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

`page.ts` turns a route into the page it names, in one place, which is what
keeps the sidebar and the main pane agreeing: the entry that lights up is the
outline the OPEN page lives in, and for a zoomed node that is the canonical
node's file — not something the URL says. Each arm carries what its screen
draws, rows included, so the components are handed a page rather than the whole
set to work one out from.

Navigation is real `<a href>`s (`router.tsx`), so ⌘-click and "copy link
address" behave the way they do everywhere else; a plain left click is
intercepted and answered in place. There is no router library: five addresses
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

Three marks, and they are three because a reader has to tell them apart at a
glance in a 16rem column: a day with something on it is a link with a dot,
today wears a ring, and the day being read is filled. An empty day is inert —
pressing it could only mean "write something here", and this pane writes
nothing. Every one of them is a `data-` fact on the cell (`data-dated`,
`data-today`, `data-open`) rather than a colour, so the browser tests assert on
the mark and never on the palette.

## Fifteen palettes, and the one you picked

`src/client/theme/` is a TABLE and the things generated from it. `palettes.ts`
holds fifteen named palettes — the racket implementation's four and eleven read
off the original WorkFlowy theme stylesheets — each a value for the same eight
tokens `styles.css` declares. Everything else follows from it: `css.ts`
generates one unlayered `:root[data-theme="…"]` block per row, which `src/build.ts`
appends to the Tailwind output, and `Picker.tsx` draws one chip per row, each
chip wearing the palette it offers — behind a compact header pill that opens the
strip as a popover (fifteen chips cannot live in the bar itself; behaviour is
unchanged). Adding a theme is adding a row; the row type is what makes a
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
rather than about the page — the connection indicator, the git readout (absent
entirely on a `--no-commit` serve), the agent toggle (always on screen; pressed
while the agent panel is open; busy pulse in either state while a turn runs),
and the theme picker as a compact popover (a pill names the theme in force;
chips open under it). On a phone the directory burger joins the left edge next
to the wordmark.

Principle: the header carries what is about the app; the sidebar
(`Sidebar.tsx` / `layout/Rail.tsx`) carries what is about the DIRECTORY —
calendar + file tree only, collapsing on desktop to an icon rail. The header
is on every screen App draws, including the error report and the waiting page,
so there is one home for chrome and no corner-pills special case those screens
used to need. The sole exception is the fault card: `main.tsx`'s
`<ErrorBoundary>` sits above `App`, so a thrown render never reaches the header
(a broken client has no chrome to trust).

The chat dock sits **under** the header, not over it (`chat/Panel.tsx`
subtracts `--height-header`): the bar stays reachable while the agent is open.
Layout widths, open/minimized state and the mobile chat snap live in
`layout/prefs.ts` (client-local, never sent).

## The connection, said out loud

`src/client/connection/` is the chrome for the one thing the outlines cannot
report on: whether this page is still talking to a server. A page that is live
and a page whose server died look identical when nothing says otherwise — both
keep showing the last thing they were told — so a pill reports it always, in
every shape of the app, and is green only while a server is answering.

WHERE it sits is the layout's, not the indicator's: the app header, beside the
agent toggle and the theme picker. It used to have two homes (sidebar footer,
or a corner when there was no sidebar); the header collapsed that. Always fixed
to the corner is what it used to be before even that, and it meant a pill
sitting on top of the last line of whatever scrolled under it. `Connection.tsx`
keeps the one rule that is not about placement — when the reload surface takes
the screen.

`status.ts` is the whole policy and it is pure: a table over the wire's own four
states (`connecting`, `live`, `reconnecting`, `retired`) saying what each looks
like. That is where the mistake this folder exists to prevent would be made — a
state that quietly reads as healthy, or a terminal one drawn like a transient
one — so it is unit-tested directly, with no socket and no browser.

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

## Git, said out loud too

`src/client/git/` is the same argument as the folder above, about the other half
of the page's promise: not "is this still reading" but "is what gets written to
it being kept". Both are facts a page can only get wrong SILENTLY, and this one
did — a write came back `committed: false` on a directory its owner knew was a
repository, and the reason lived in the server's log. So the readout sits beside
the connection pill, reading the surface's `git` cell.

`state.ts` is the whole policy and it is pure, for the same reason `status.ts`
is: a table over the four states the server publishes, unit-tested with no
socket and no browser. Three of them draw something and one deliberately draws
NOTHING — `off`, the `--no-commit` serve, because that is a setting somebody
chose rather than a condition, and chrome that reports settings is chrome a
reader stops scanning. `repo` is quiet (three letters, a dim dot, and
deliberately not the connection's green — one green claim per page). `none` says
"Not a Git repo" calmly. `error` says "Git error" and carries git's own words,
on the tip AND on the `aria-label`, so the reason is never hover-only; the
readout takes focus so a keyboard can reach it at all.

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

Three components earn their own file:

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
- **`Composer.tsx`** never disables its box. A message typed while the agent
  is working is sent and queues, so the button says `queue` and cancel appears
  BESIDE it rather than replacing it — sending and stopping are two things a
  person can want at the same moment. Disabling cost the caret as well as the
  thought: coming back to a re-enabled box meant reaching for the mouse.

  It is also where a picture comes in, three ways for one reason: paste is the
  desktop gesture, drop is the one for a file already on screen, and the picker
  is the only one a phone has. All three end in the same call, and attaching
  does not send — the picture waits in a strip above the box, where it can be
  removed or typed at, because "what is wrong here" needs the picture and the
  question together.

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
  flight would interleave their bytes and corrupt the picture silently. The
  size and kind gate runs before a byte is encoded, and it is the same function
  the server refuses with (`@olai/surface`), so a 60 MB drop costs nothing and
  says exactly what the server would have said.
- **`Attachments.tsx`** draws a picture on a message two ways, and the chip is
  the base case. A row carries file NAMES; whether there is anything to look at
  depends on which tab is looking, because the bytes are in a tmp directory no
  browser can reach and `/media/*` is guarded to the served directory. The tab
  that pasted it still has the Blob (`previews.ts`, a bounded per-tab cache) and
  draws a thumbnail; every other tab, and this one after a reload, draws the
  name.
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

`src/client/commit/` is the third pill of the chrome, and like the connection
dot it is NEVER ABSENT. Every state is drawn: a clean tree that has committed
(`✓ committed · 12m ago`), one olai has never committed in (`no commits yet`),
edits waiting (`4 uncommitted`), a busy repository (`⚠` and the reason), a
directory that is not a work tree, and a server with commits off. The rule
comes straight from what the feature is FOR: if the job is an audit trail, then
"there is no audit trail here" is the most important thing the pill can say, and
a control that disappeared is exactly how a person would never find that out.

One more face is about THIS PAGE rather than the directory: until the server has
said anything, the pill says so. It used to draw the default value's `commits
off`, which is a setting somebody could go and change — a claim a page has no
business making about a server it has not heard from. "Not told yet" and "turned
off" being two different things is the same distinction the manifest cell draws
with its `null`.

The PANEL is portalled out of the sidebar and positioned against the viewport
(`commit/anchor.ts`), which is not a style choice: the sidebar scrolls, and an
overflow container clips in both axes, so a popover laid out inside it was cut
off at the 16rem column — the message, the writer and half the button gone. The
placement is a pure function of the pill's box and the window, so "pushed back
inside near the right edge" and "flipped downward when the pill is too high to
open upward" are a unit test rather than something to find by resizing a
browser. It re-measures on resize and on scroll (capture phase — the sidebar
scrolls, and `scroll` does not bubble), because a popover that goes stale where
it was is worse than one that never moved.

The last two are SETTINGS rather than faults — dim, inert, no warning colour.
`⚠` is reserved for the busy repository, which is the only one anybody can act
on. `faceOf` in `said.ts` is the whole of that decision, as a pure function of
the pending value, and `data-state` on the pill is what a scenario asserts on.

It exists because every write olai makes is a write nobody typed: the agent
auto-approves its ops, so git is how you see what the tool did to your files.
Writes land on disk and WAIT; this is what asks for the commit, and the agent's
`commit` tool is the same action through the other door.

The panel never shows a text diff — a `.jsonl` diff is one enormous line per
node — so every row is a NODE and what changed about it. The classification is
the server's (one `Sort` per change, from `@olai/format`), and `said.ts` is
this client's own table of words for it: the log says `done:`, the panel says
"marked done". `data-sort` is what a test asserts on, never the phrase, which
the view is entitled to reword.

Nothing here is state this browser keeps. What is waiting arrives on the
`pending` cell, derived from git on the server, so a tab open all day is
looking at the repository as it is rather than at a tally it kept — an outline
edited in vim is in the list, and a commit made in a terminal takes itself out.
The panel carries the LAST COMMIT above it, because "what is waiting" and "was
anything ever recorded" are two questions and only the second one distinguishes
a directory olai has never touched. The one clock is `ago.ts`: the phrase moves
on its own, since the value it is drawn beside can sit unchanged all afternoon.
The one thing that IS local is the draft message: it is seeded from the composed
suggestion when the panel opens and never overwritten under the person typing
it, because a box that re-synced would rewrite what they were writing every time
the server swept.

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
sidebar (calendar + file tree only) goes behind a BURGER in the app header as a
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
days of the month, the month's paging chevrons, the done switch, the crumbs,
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

`src/client/palette/` is the ⌘K shell: navigation (home, today), panel toggles,
and a `>` prefix that sends the rest to the agent. Jump-to-node type-ahead and
op actions belong to the separate `palette` roadmap item. Keyboard map reserved
so keyboard-editing cannot collide later: **⌘K** palette, **⌘\\** sidebar,
**⌘J** chat (`palette/keys.ts`).


## What belongs to a reading, not to the file

`view.ts` holds the two per-view switches — what is folded, and whether done
nodes are drawn — and the calendar holds a third, which month is on screen.
None of them goes to the server or to disk, and hiding what is done is a row
not drawn rather than anything marked.

All three are `createStamped` (`stamped.ts`): a value plus the thing it belongs
to, read through a memo that compares them. That is what makes them start over
at the right moment — a page you zoom into is a new thing to read, and
inheriting the last page's folds would fold places this reader has never seen —
with no effect watching a route to clear anything, and so no frame in which the
held value and the thing it belongs to disagree. What they differ in is the
stamp, and that is the whole of the difference: a reading belongs to the PAGE,
while the month belongs to the month it is ANCHORED to, because walking from
one outline to another is no reason to snap the calendar back to today.

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
