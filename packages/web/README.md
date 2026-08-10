# @olai/web — the SolidJS client, and the build that produces it

A sidebar of the outlines found and one page open in the main pane — a whole
outline, or one node zoomed — kept current by the live store underneath: an
edit on disk arrives as the next frame of one subscription, so the page changes
without reloading. SolidJS over a WebSocket, styled with Tailwind v4, bundled by
`Bun.build`.

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

## Two routes, and what each is a property of

`routes.ts` is the whole of the URL contract, and it is a bijection its own
test insists on: a link the app writes has to be a link it can read back.

- `/o/<file>` names a file on disk, so it spells the path.
- `/n/<id>` names a node, and an id is all it may spell. Ids are unique across
  the loaded set and survive renames and moves across files, so the permalink
  outlives every edit short of a delete — while a URL that also carried the
  outline would be a URL that could disagree with the file it named.

`page.ts` turns a route into the page it names, in one place, which is what
keeps the sidebar and the main pane agreeing: the entry that lights up is the
outline the OPEN page lives in, and for a zoomed node that is the canonical
node's file — not something the URL says. Each arm carries what its screen
draws, rows included, so the components are handed a page rather than the whole
set to work one out from.

Navigation is real `<a href>`s (`router.tsx`), so ⌘-click and "copy link
address" behave the way they do everywhere else; a plain left click is
intercepted and answered in place. There is no router library: two addresses do
not need one.

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

## The agent panel

`src/client/chat/` is a drawer on the right, open or shut. It is a drawer
rather than a column in the layout, and that is a decision about what olai is:
the outline is the page, and the agent is something you open beside it.

It ALWAYS draws. Whether an agent is configured is the server's answer, and when
the answer is no the panel says so (`NoAgent.tsx`, naming `OLAI_ACP_AGENT`)
rather than disappearing — a feature that is silently absent cannot be told
apart from one that is broken, or from one you have not found yet. The composer
and the transcript are what the explanation replaces, since there is nothing to
send and nothing to show.

Everything in it is a projection of two surface members — a `transcript`
collection and a `chat` cell — so there is no chat state in the browser the
server does not own. What was typed appears because the server put it there,
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
  you opened stays open while the call is still running.
- **`SlashMenu.tsx`** takes Enter in the CAPTURE phase and stops it
  propagating, because the input owns Enter for sending: without that, a
  completion accepted would be a message sent.

`run.ts` is the one place the client runs an Effect, and its signature is the
enforcement: there is no overload without `onFailure`. A caller that could
ignore a procedure's declared failures would be a caller whose refusals
vanish, which is exactly what chat is not allowed to do.

## What belongs to a reading, not to the file

`view.ts` holds the two per-view switches — what is folded, and whether done
nodes are drawn. Neither goes to the server or to disk, and hiding what is done
is a row not drawn rather than anything marked.

A reading is OF A PAGE, and which page is part of the value. That is what makes
navigating start fresh — a page you zoom into is a new thing to read, and
inheriting the last page's folds would fold places this reader has never seen —
with no effect watching the route to clear anything, and no frame in which the
held reading and the open page disagree.

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
