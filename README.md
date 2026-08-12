# olai

An outliner whose file format is a git-reviewable one, and whose editor is a
browser and an agent rather than a text buffer.

One `.jsonl` file per outline, one JSON object per line, one line per node
([docs/format.md](docs/format.md)). Stable ids and parent pointers mean a
subtree move is a one-field write, so plain line-based git merges are safe and
a diff shows what actually changed.

Status: you can serve a directory, read your outlines, watch the page follow the
files as you edit them or pull them, TYPE into them, and ask an agent to change
them — the keyboard and the chat panel write through the same ops layer
([roadmap](docs/roadmap.jsonl)).

## Run it

```sh
nix run github:juspay/olai -- web path/to/outlines
```

or, in a clone:

```sh
just serve docs     # serves this repo's own roadmap, and opens on 127.0.0.1:7714
```

`olai web <dir> [--port] [--host]` reads the directory recursively, picking up
every `.jsonl` outline and every `.md` document, and serves them to a browser.
It does not descend into dot-directories or `node_modules` — a directory of
outlines is usually a git repository, and nothing anyone wrote is inside
`.git`. It binds to loopback by default: the surface is unauthenticated, so
anyone who can reach the port can read every outline under the directory — and,
since the keyboard editor arrived, change one. Put
it behind a reverse proxy or `tailscale serve` and the browser's origin will
not be the `Host` it forwards, so name the origins you are serving from in
`OLAI_ALLOWED_ORIGINS` (comma-separated); the websocket refuses the rest.

It says what it is doing on stdout, one line per event, quietly: the address it
bound, the agent it started, and anything that went wrong. `--log-level debug`
turns on the rest, including everything the agent itself writes.

To keep it running as a user service (systemd on Linux, launchd on macOS), add
the flake input and enable the home-manager module. Create `dataDir` first —
`olai web` refuses a path that does not exist.

```nix
# flake.nix
inputs.olai.url = "github:juspay/olai";
```

```nix
# home.nix (a home-manager module)
{ config, inputs, ... }: {
  imports = [ inputs.olai.homeManagerModules.default ];
  services.olai = {
    enable = true;
    dataDir = "${config.home.homeDirectory}/outlines";
    # host = "127.0.0.1";  # default
    # port = 7714;         # default
  };
}
```

The module fills `package` from the flake for the host platform. The packaged
binary already bakes the browser bundle (`OLAI_DIST_DIR`), so the service
needs no ambient environment.

A bullet is a bullet. Mark one `done`, `doing` or `todo` and a checkbox
appears in front of it — checked, half-filled, or empty; leave it unmarked and
it is text, with no box and nothing claiming it is a to-do nobody has got to
yet. Those last two are different things on purpose: an empty box says someone
decided this is work that has not started, and no box says nobody has called
it work at all. A mark goes on whatever carries it, children or not — you can
tick `read this book` with three notes hanging off it — and nothing is ever
computed from what is underneath: a node is a task because someone said so.
What the children add up to is shown beside the title as `3/5` and read as
what it is, an annotation ([docs/format.md](docs/format.md#status)).

Hiding what is done hides the nodes marked done, each with its subtree, and
nothing else. A branch nobody marked stays on screen however finished the
things under it are — the notes hanging off it are what you were looking for.

Every node is also a page of its own at `/n/<id>` — the node as the heading,
its note, its children as the tree — with breadcrumbs up its ancestry. Ids are
stable and unique across the whole directory, so that address survives renames
and moves, even to another file, and a mirror of a node resolves to the same
one page as the node itself.

Anything with a date is also in the journal, and the journal is a query
rather than a place: a month in the sidebar marks the days the *whole
directory* has something on, whichever outline it was written in, and clicking
one opens `/d/<date>` — every node on that day, grouped by its outline and
shown with the ancestry that says what it is about. `/today` is the same page
for whatever day it is now. Nothing is stored to make this work: there is no
journal file, no year→month scaffolding and no filename that means anything, so
a date on a node in any outline is all there is to it.

Two things put a node on a day, and they are the two a day is about: what it is
scheduled for, and when it was finished. A `date` is the first; ticking
something off records the instant you did it, which is the second — so the work
you finished today is on today, beside the thing you had scheduled for it, and
the day says which of the two each row is. A node scheduled one day and
finished another is on both, once each; a task ticked with nothing but a `true`
says it is done and declines to say when, which puts it on no day at all.

Nothing else is a day. A task can carry a date on `doing` or `todo` — the
format allows it — and the calendar reads neither: the day you picked something
up, or wrote it down, is a fact about the task rather than about the day, and a
journal that collected them buries what actually happened under the morning's
filing. And work you have archived keeps the day it was finished on: putting it
away is what you do *after* it happens, not a reason for the day to forget it.

Some notes are not a line. Every `.md` under the directory is a **document**:
it has a page of its own at `/doc/<path>`, it sits in the sidebar's file tree
under the folders it lives in (beside any outlines in the same folder) whether
or not any outline names it, and a node whose `doc` field attaches one shows
it — the whole document when you are zoomed on that node, one line of it
anywhere else. Documents are markdown, rendered at view time like a note's
text, with fenced code highlighted by a highlighter this server ships rather
than a CDN, footnotes, and pictures that are files beside the document. Nothing
else is drawn: a picture is served from one route restricted to picture
extensions, and a remote image, a `data:` URL or a path climbing out of the
served directory is refused rather than fetched.

A document long enough to be worth opening can be surveyed and jumped around.
Every heading carries an address and a link to it, and a **contents** sits above
the document — collapsible, derived from the heading tree at view time, nothing
stored. A note gets the addresses but no contents: a note is a tree row, not a
page.

It keeps reading. Save a file, `git pull`, drop a new outline into the
directory, and the open page updates in place — no reload, no restart. There is
no polling of the browser and no cache to invalidate: the server watches the
tree, re-reads only what actually changed, revalidates, and pushes the next
snapshot down the subscription the first one arrived on.

Which raises the question the page had better be able to answer: is it still
reading? A pill in the app header says so, always, and it is green only while a
server is actually answering. Restart the server under an open tab and the page
does not pretend — it says the server it came from is gone and offers the one
thing that recovers it, a reload.

What it looks like while you read it is yours. Fifteen named palettes sit behind
a pill in the app header — chalk, leaf, manuscript, pitch, a phosphor terminal,
a bar of chocolate — and each chip is painted in the palette it offers, so
picking one is a matter of looking rather than of reading fifteen names. The
page repaints at once, this browser remembers it, and none of it goes anywhere:
nothing about a theme is sent to the server, so two machines reading the same
directory are entitled to look nothing alike. There is no "system" setting on
purpose. Your operating system's idea of dark used to decide, which meant the
page could change under you after you had already said what you wanted; a page
nobody has picked for reads in chalk, which is the one palette that promises AA
contrast on everything it paints.

It reads on a phone, and it installs as one. Add it to a home screen or a dock
and it opens in its own window under the olai mark; the directory (calendar and
file tree) is a slide-over drawer behind a burger on a narrow screen, chat is a
bottom sheet (or a strip above the thumb when minimized), app chrome stays in
the header, and everything a thumb aims at is sized for one. On a laptop the
directory collapses to an icon rail and both panels drag-resize; ⌘K opens a
command palette for navigation and panel toggles. There is no offline mode, on
purpose — a cached copy of an outline is a copy that has stopped being true, and
this page's whole promise is that it has not.

When something stops validating, what you see depends on what can still be
shown. A file whose lines will not parse costs that one outline: it is marked
in the sidebar, its errors are shown where its tree would have been, and the
rest stay live. A problem no single file owns — a reference to an id nothing
declares, a duplicate, a cycle — keeps the last good version on screen under a
banner, and the page catches up by itself when you fix it. Either way every
error names `file:line`, and the ones implicating two files are kept apart,
because "which file is broken" has no single answer for those. Error quality is
the product here, not a consolation prize: the format exists so that a bad edit
is a caught edit.

## Type it yourself

Click a title and the caret is in it. From there it is the outliner's loop, on
the keys you already know: **Enter** for the next line, **Tab** and
**Shift+Tab** for the shape, **Alt+Shift+↑/↓** to move a row among its
siblings, **Ctrl+Enter** to tick it off, **Shift+Enter** for the note under it,
**↑/↓** to walk the rows, **Escape** to drop what you were typing. Nothing has
a mode: the title span becomes an input in the same place, and the styled
`#tags` come back when you leave it.

What happens underneath is the thing worth knowing. A key is not a change to
the page — every one of them is one op through the same gate the agent writes
through, so a row moves when the file says it moved, each edit is a git commit
you can read, and two tabs on the same outline cannot disagree. What you type
buffers locally until you stop (blur, Enter, or a pause), so typing is never a
round trip; that buffer is an editor and not a claim about the file, and if a
write comes back refused — a title cannot be empty — the reason appears under
the row and the text stays exactly where you left it.

A new row is that same idea: **Enter** opens a line where the row will go, and
the node is written the moment it has a title. So an outline never fills up
with blank bullets, and a key pressed by accident writes nothing at all.

There is no delete key, on purpose. It arrives with undo — until an edit can be
taken back inside the app, git is the whole of the recovery net, and removing a
subtree is the one edit nobody can re-type from memory.

## Ask it to change something

Open the panel in the corner and tell the agent what you want. Ask it to check
something off and the checkbox in front of you moves — not because the panel
echoed anything, but because the write went to disk, through the same validator
a load runs, and came back on the same subscription every other change does.
Each one is a git commit, with a subject you can read (`done: order the new
cabinets`).

Which raises the second question the page had better answer, beside "is it
still reading": is any of this being kept? A git failure never fails a write —
the bytes are on disk and you have already seen them — but it is never silent
either. A second pill in the header says what git is doing with this directory,
and it is quiet when the answer is "committing every write". A directory that is
not a repository says so calmly; a git that tried and could not says `Git error`
and hands you its own words. Nothing is shown at all when you served the
directory with `--no-commit`, because that is a choice you made rather than
something that went wrong. And a write that did not reach the history comes back
saying why, where the agent and the panel both read it.

The agent cannot free-write a file. It has no filesystem access at all: the
only things it can name are NODES, through a closed list of tools — search,
read a subtree, create an outline, add, mark, retitle, note, schedule, move,
archive. Adding takes a whole subtree, nested, so capturing an outline is one
call rather than one per bullet — and one call is one validation and one
commit, which is what makes a half-captured outline impossible rather than
unlikely. A new outline is born the same way, holding whatever it was created
with: the file and its contents land together or not at all, so nothing is left
behind by a capture that was refused. Creating one is the one place a path is
named, and it is a relative `.jsonl` under the served directory, refused if it
already exists and written only as whole records. So the edits it can express are the edits the
format can be, and a malformed outline is not something it can produce. Whether
that is a restriction or the point depends on how you feel about a coding agent
with `sed` and your notes.

When it asks for something the outline will not do, you get the reason rather
than an apology: a refused write comes back with the validator's own rows,
each pinned to the line it is about. And when a write lands but is worth a
second look — a branch ticked done over tasks nobody finished, or the last
open task under a parent going done — the answer says so. Advice about
something that happened, never a refusal.

You can paste a picture into the box — a screenshot, a photo of a whiteboard —
and ask about it. Drag one onto the panel, or pick one from a phone's roll,
which is the same thing without a Ctrl+V. The bytes go into a temporary
directory belonging to that conversation, never under the directory being
served, and what the agent is handed is the PATH: it reads the file itself, so
no image rides the prompt into the stored session, and nothing pasted here can
end up committed with your outlines. The pictures go away when you start a new
conversation or stop the server. The transcript names each one; the tab you
pasted from also shows it.

The conversation is Claude Code's own session for that directory: close olai,
reopen it, and you are back in it — and `claude --resume` in a terminal reaches
the same conversations.

If this machine is running [kolu](https://kolu.dev) — terminals for coding
agents — the panel's agent gets kolu's terminals too, and there is nothing to
set up: every new conversation looks for the padi daemon this host answers on,
and hands the session `kolu mcp` when one is there. So you can ask about what
your coding agents are doing in the same place you ask about your outlines. It
is looked for rather than assumed: olai starts the `kolu` it found and asks it
to read something only a running daemon can answer, because a `kolu` on a PATH
is not always the one this host is running, and a wrong build will start
perfectly well and know nothing.

The agent is the pinned Claude Code adapter, and it comes with olai: `nix run`,
the packaged binary and `just serve` all default to it, so there is nothing to
install and nothing to configure. `OLAI_ACP_AGENT` points at a different ACP
agent, and setting it to the empty string turns chat off — the panel then says
there is no agent and which variable would give it one, rather than quietly not
being there. The outlines are served the same either way.

## Or ask from a terminal

The panel's agent is not the only one that can reach those tools. Any MCP
client — a coding agent in a terminal, working in the same directory — gets the
same closed list by launching olai:

```sh
claude mcp add olai -- olai mcp ~/outlines
```

`olai mcp <dir>` speaks MCP over its own stdin and stdout, so there is nothing
to bind, nothing to configure and nothing to authenticate: the client proved
who it is by being the process that started it. It needs no `olai web`
running — a terminal in a notes directory is the ordinary case — and it does
not mind one that is. Leave a tab open on that directory and it follows the
terminal's edits the same way it follows yours, because both went to disk
through the same gate, and the tab is watching the disk.

It is the same bargain as the panel: the tools name nodes (and, for a brand-new
outline, a relative `.jsonl` path), never free-form bytes, so a coding agent
that would happily `sed` your notes cannot, and every write is a git commit you
can read. `--no-commit` turns that off for a directory whose history is
somebody else's job.

There is still no write CLI, and there never will be — no shell command adds a
node or marks one. `olai web` and `olai mcp` are the two ways of putting a write
surface in front of a directory: a page, or a pipe. The page has two writers on
it now, a keyboard and an agent, and they are the same ops layer seen twice.

## Develop

```sh
just            # the recipe list
just check      # the gate, and the CI pipeline — one graph, run the same way
                # on a laptop and on a lane (see the justfile's header)
just serve      # the edit loop: build the client, serve docs/ from source
just e2e        # the browser tests, against the nix-built binary
```

Everything runs inside the flake dev shell; the recipes re-enter it for you.

## Layout

| package | what it is |
|---|---|
| [`packages/format`](packages/format) | the format, and the only place it is enforced: parse per line, validate the set |
| [`packages/store`](packages/store) | a directory of files as a validated, revision-tagged snapshot, and the one write gate — generic, with no outline types in it |
| [`packages/log`](packages/log) | how olai says what it is doing: one format, two streams, and the levels `--log-level` turns on |
| [`packages/ops`](packages/ops) | the only writer: the semantic edits, and the MCP server both agents reach them through |
| [`packages/surface`](packages/surface) | the typed reactive layer both ends speak, declared once |
| [`packages/chat`](packages/chat) | one conversation with one ACP agent: the subprocess, the session, and the transcript a panel draws |
| [`packages/server`](packages/server) | the composition root and the binary |
| [`packages/web`](packages/web) | the SolidJS client (SolidJS + Tailwind v4), and the build that produces it |
| [`packages/tests`](packages/tests) | Cucumber features driven through Playwright |

Dependencies point strictly downward and are declared in each package's
manifest, so a layering violation is an install error rather than a review
comment. [docs/architecture.md](docs/architecture.md) has the reasoning.

## Docs

- [docs/format.md](docs/format.md) — the file format and its rules
- [docs/architecture.md](docs/architecture.md) — how the pieces fit
- [docs/roadmap.jsonl](docs/roadmap.jsonl) — the plan, in the format itself
- [docs/brainstorming/](docs/brainstorming) — the decisions, and why the
  alternatives lost
