# @olai/web — the SolidJS client, and the build that produces it

A sidebar with a month and the outlines found, and one page open in the main
pane — a whole outline, one node zoomed, or one day — kept current by the live
store underneath: an edit on disk arrives as the next frame of a subscription,
so the page changes without reloading. SolidJS over a WebSocket, styled with
Tailwind v4, bundled by `Bun.build`.

## What the client reads, and how it is put back together

`src/client/outlines.ts` is the whole read side, and it is two subscriptions:
the `outlines` COLLECTION — one entry per outline file, keyed by root-relative
path, served with batched `deltas` so an edit sends that file's entry and not
the corpus — and the `manifest` CELL, which carries what belongs to no one file
(the revision, and the documents with their text).

Everything above it is derived from those: the sidebar's file list is the
collection's keys in path order (`paths.ts`, because a key set has arrival order
and a directory has path order), the one derivation the whole app reads is
`derive` over every entry's nodes — the same call the validator makes — and
which files are unreadable is the entries that carry a `broken`.

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
row into markup and nothing else — including the status checkbox beside each
bullet (`Checkbox.tsx`: checked / half / empty for done / doing / open, drawn
for every state, read-only until keyboard-editing) and a node's free
cross-references (`SeeRefs.tsx`: each `see` target is a link to `/n/<id>` whose
text is the target's title, resolved at view time through the same indexes).
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
highlighter kept in step by hand. Parse with GFM, to HTML, sanitise,
highlight, rewrite, stringify:

- **highlighting runs after the sanitiser**, deliberately. The `hljs-` spans
  are ours, produced from the code's own text, so they need no allowlist entry
  — while the `language-…` class that produced them is the reader's, and is on
  the sanitiser's default allowlist. `rehype-highlight` is bundled with the
  client (about 180 kB of it): it is in `bun.lock`, so the Nix build fetches it
  like everything else, and no page asks a CDN for the code that renders
  someone's private outline. The colours are this theme's tokens, so a fence
  follows the light/dark palette the rest of the page does.
- **`rewrite.ts`** is a walk over the finished tree rather than a plugin, which
  is what lets the pipeline be built once — the highlighter registers three
  dozen languages when it is attached, and a pipeline rebuilt per note would
  pay for that on every row of every frame. It answers the two questions only
  this app can: a relative picture becomes a `/media/…` URL and anything else
  is not drawn at all, and every id (and every link into the same block) is
  re-minted under a prefix derived from the block itself, so the first footnote
  of one note cannot answer for the first footnote of the next.

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
set's dated nodes and a day collects every node carrying that date, wherever it
was written. Which days have something on them, and what is on one, are
`@olai/format`'s to answer — the same derivations the validator's set is read
with, so a dot and the day it opens cannot disagree.

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
chip wearing the palette it offers. Adding a theme is adding a row; the row
type is what makes a forgotten token a type error rather than a `var()` that
resolves to nothing in one theme only.

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

## The connection, said out loud

`src/client/connection/` is the chrome for the one thing the outlines cannot
report on: whether this page is still talking to a server. A page that is live
and a page whose server died look identical when nothing says otherwise — both
keep showing the last thing they were told — so a dot reports it always, in
every shape of the app, and is green only while a server is answering.

WHERE it sits is the layout's, not the indicator's: the sidebar's footer beside
the agent toggle, and a corner of the viewport only on the screens that have no
sidebar — the error report, the waiting page. Always fixed to the corner is what
it used to be, and it meant a pill sitting on top of the last line of whatever
scrolled under it on every page. `App.tsx` picks between the two homes;
`Connection.tsx` keeps the one rule that is not about placement — when the
reload surface takes the screen.

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

## The agent panel

`src/client/chat/` is a drawer on the right, open or shut. It is a drawer
rather than a column in the layout, and that is a decision about what olai is:
the outline is the page, and the agent is something you open beside it.

Open, it takes its width out of the layout on a screen wide enough to spare it
rather than lying over the outline — a drawer you have to shut to finish reading
a sentence costs more than it is worth. On a narrow one it covers the page,
because there is no width to give it. Shut, the way back in is a button in the
sidebar's footer (`Toggle`), placed by the layout for the same reason the
connection dot is.

It ALWAYS draws. Whether an agent is configured is the server's answer, and when
the answer is no the panel says so (`NoAgent.tsx`, naming `OLAI_ACP_AGENT`)
rather than disappearing — a feature that is silently absent cannot be told
apart from one that is broken, or from one you have not found yet. The composer
and the transcript are what the explanation replaces, since there is nothing to
send and nothing to show.

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

- **`Refusal.tsx`** is the one the error taxonomy exists for. A `derived`
  refusal carries the children that are in the way as DATA, so they are drawn
  as rows a reader can act on — "mark those instead" is a list, not a sentence
  — and a `validation` refusal renders through the same `errors/Report.tsx`
  rows a broken file does, so a refused write and a broken file are explained
  the same way.
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
- **`SlashMenu.tsx`** takes Enter in the CAPTURE phase and stops it
  propagating, because the input owns Enter for sending: without that, a
  completion accepted would be a message sent. It is opened by typing `/` and
  by a button beside the input, which shows the WHOLE list — typing filters,
  and the button is for when you do not know what to type. The button is drawn
  only when the agent offers commands: one that opens nothing would be a button
  that lies.

`run.ts` is the one place the client runs an Effect, and its signature is the
enforcement: there is no overload without `onFailure`. A caller that could
ignore a procedure's declared failures would be a caller whose refusals
vanish, which is exactly what chat is not allowed to do.

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
two things change. There is no second column to put the sidebar in, so it goes
behind a BURGER: one row while it is shut, and the whole sidebar — the month,
both lists, and the app's own chrome — when it is not, capped at 42dvh and
scrolling inside itself so the outline is still on screen under it. Any tap
inside shuts it, because every control in there either goes somewhere or opens
something over it.

An always-open capped header was the first answer, and it was worse in both
directions: it took a third of the screen from the outline to show a list
nobody had asked for, and the one control that HAS to be reachable — the way
into the agent, which lives in that footer — ended up somewhere down inside a
strip that scrolled. Two taps is the budget for anything in the sidebar: one to
open it, one to press what you came for.

And what a finger aims at grows to 44px, the number both mobile platforms
print in their guidelines: sidebar entries — outlines and documents alike —
days of the month, the month's paging chevrons, the done switch, the crumbs,
and the link on a node's `doc` reference. `touch.ts` is that decision —
the target size once, since it is one policy, with each control's *compact*
size spelled where that control is drawn, since that is a design per control.
The same file holds the one place the rule cannot be obeyed in both
directions: the tree's gutter. A 44px-wide toggle *and* a 44px-wide bullet at
every level of indent leave a 390px screen no room for the title they are in
front of, so those two take the full 44px in HEIGHT — the axis where a miss
lands on the wrong node — and the racket original's 1.75rem across. Their two
note indents are arithmetic over that width and live beside it, because when
it moves they all move.

The line is `md` (48rem) rather than `pointer: coarse` so the layout and the
targets are one decision: the sidebar stops being a column at exactly that
width, which is where the racket original put both.

`viewport.ts` is the last piece: an on-screen keyboard covers the bottom of the
viewport without shrinking it, so the page measures `visualViewport` and
publishes `--visible-h` and `--visible-bottom`. The arithmetic is a plain
function of two numbers and unit-tested as one. The corner pills are lifted by
`--visible-bottom` (with the home-bar inset, which is real because the shell
asks for `viewport-fit=cover`), and the agent drawer is sized by `--visible-h`,
which is what keeps its composer on screen while the keyboard that is being
typed into is up. The rest of the panel on a small screen — where it should
open from, what it should cover — is roadmapped separately.


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
