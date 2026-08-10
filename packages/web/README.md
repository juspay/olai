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
written to the same paragraph. The one thing this package does interpret is a
note, which is markdown, rendered and sanitised at view time.

## Four routes, and what each is a property of

`routes.ts` is the whole of the URL contract, and it is a bijection its own
test insists on: a link the app writes has to be a link it can read back.

- `/o/<file>` names a file on disk, so it spells the path.
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
intercepted and answered in place. There is no router library: four addresses
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
does not author — a rendered note's tags come from a file on disk and can carry
no classes. Everything else is a utility, inline in the component, so deleting
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
