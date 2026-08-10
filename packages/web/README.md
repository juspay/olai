# @olai/web — the SolidJS client, and the build that produces it

A sidebar with a month and the outlines found, and one page open in the main
pane — a whole outline, one node zoomed, or one day — kept current by the live
store underneath: an edit on disk arrives as the next frame of one
subscription, so the page changes without reloading. SolidJS over a WebSocket,
styled with Tailwind v4, bundled by `Bun.build`.

## Three ways to say what is wrong, because there are three situations

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
row into markup and nothing else. The view and the validator agree about what a
file means because they run the same code, not because two implementations were
written to the same paragraph. The one thing this package does interpret is
MARKDOWN, rendered and sanitised at view time.

## Markdown, and documents

`src/client/markdown/` is one pipeline for every piece of markdown this app
draws — a node's note and a whole `.md` document are the same language read out
of the same directory, and a document that supported a fence a note did not
would be a second dialect nobody asked for. Parse with GFM, to HTML, sanitise,
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
in the set, so a document edited on disk redraws through the same subscription
an outline does.

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
  next local midnight. It sits at the top rather than under `calendar/`,
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

## The connection, said out loud

`src/client/connection/` is the chrome for the one thing the outlines cannot
report on: whether this page is still talking to a server. A page that is live
and a page whose server died look identical when nothing says otherwise — both
keep showing the last thing they were told — so a dot in the corner reports it
always, in every shape of the app, and is green only while a server is
answering.

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

## On a phone, and on a home screen

`src/client/public/` is the install surface's files — `icon.svg`, the 192 and
512 PNGs, a maskable 512 and an `apple-touch-icon` — copied verbatim to the
dist *root* by the build, outside `/assets/`: a manifest and an
`apple-touch-icon` are read by an installer rather than by the shell, so their
URLs have to be stable ones and must not change with their bytes. They are the
original olai mark, ported unchanged from the racket implementation. The
manifest that names them is the *server's* (`packages/server/src/listener.ts`,
through kolu's manifest layer); `index.html` names the same mark again for what
reads no manifest — the browser tab, and iOS's Add to Home Screen. There is no
service worker and no offline shell: this app is live or nothing, and a cached
shell would show outlines that had stopped being true.

Below **48rem** — the racket original's own breakpoint, and Tailwind's `md` —
two things change. There is no second column to put the sidebar in, so it
becomes a header above the outline: capped at 42dvh and scrolling inside
itself, so the outline it is a header *for* is still on screen under it. No
drawer, no overlay, no toggle — those need a state, a backdrop, a focus trap
and a way to close, all of it to hide something that fits.

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
function of two numbers and unit-tested as one; the connection dot is lifted by
`--visible-bottom` today (with the home-bar inset, which is real because the
shell asks for `viewport-fit=cover`), and the chat sheet will size itself by
`--visible-h` when it lands.

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

`styles.css` holds only the `@theme` tokens and rules for markup this codebase
does not author — the tags of a rendered note or document come from a file on
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
