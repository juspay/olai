# olai

An outliner whose file format is a git-reviewable one, and whose editor is a
browser and an agent rather than a text buffer.

One `.jsonl` file per outline, one JSON object per line, one line per node
([docs/format.md](docs/format.md)). Stable ids and parent pointers mean a
subtree move is a one-field write, so plain line-based git merges are safe and
a diff shows what actually changed.

Status: you can serve a directory, read your outlines, watch the page follow the
files as you edit them or pull them, and ASK AN AGENT to change them — the chat
panel writes through the same ops layer the keyboard editor will
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
anyone who can reach the port can read every outline under the directory. Put
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

Every node is also a page of its own at `/n/<id>` — the node as the heading,
its note, its children as the tree — with breadcrumbs up its ancestry. Ids are
stable and unique across the whole directory, so that address survives renames
and moves, even to another file, and a mirror of a node resolves to the same
one page as the node itself.

Anything with a `date` is also in the journal, and the journal is a query
rather than a place: a month in the sidebar marks the days the *whole
directory* has something on, whichever outline it was written in, and clicking
one opens `/d/<date>` — every node dated that day, grouped by its outline and
shown with the ancestry that says what it is about. `/today` is the same page
for whatever day it is now. Nothing is stored to make this work: there is no
journal file, no year→month scaffolding and no filename that means anything, so
a `date` on a node in any outline is all there is to it.

Some notes are not a line. Every `.md` under the directory is a **document**:
it has a page of its own at `/doc/<path>`, it is listed in the sidebar whether
or not any outline names it, and a node whose `doc` field attaches one shows
it — the whole document when you are zoomed on that node, one line of it
anywhere else. Documents are markdown, rendered at view time like a note's
text, with fenced code highlighted by a highlighter this server ships rather
than a CDN, footnotes, and pictures that are files beside the document. Nothing
else is drawn: a picture is served from one route restricted to picture
extensions, and a remote image, a `data:` URL or a path climbing out of the
served directory is refused rather than fetched.

It keeps reading. Save a file, `git pull`, drop a new outline into the
directory, and the open page updates in place — no reload, no restart. There is
no polling of the browser and no cache to invalidate: the server watches the
tree, re-reads only what actually changed, revalidates, and pushes the next
snapshot down the subscription the first one arrived on.

Which raises the question the page had better be able to answer: is it still
reading? A dot in the corner says so, always, and it is green only while a
server is actually answering. Restart the server under an open tab and the page
does not pretend — it says the server it came from is gone and offers the one
thing that recovers it, a reload.

What it looks like while you read it is yours. Fifteen named palettes sit at
the bottom of the sidebar — chalk, leaf, manuscript, pitch, a phosphor
terminal, a bar of chocolate — and each chip is painted in the palette it
offers, so picking one is a matter of looking rather than of reading fifteen
names. The page repaints at once, this browser remembers it, and none of it
goes anywhere: nothing about a theme is sent to the server, so two machines
reading the same directory are entitled to look nothing alike. There is no
"system" setting on purpose. Your operating system's idea of dark used to
decide, which meant the page could change under you after you had already said
what you wanted; a page nobody has picked for reads in chalk, which is the one
palette that promises AA contrast on everything it paints.

It reads on a phone, and it installs as one. Add it to a home screen or a dock
and it opens in its own window under the olai mark; the sidebar becomes a
capped header above the outline on a narrow screen, and everything a thumb aims
at is sized for one. There is no offline mode, on purpose — a cached copy of an
outline is a copy that has stopped being true, and this page's whole promise is
that it has not.

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

## Ask it to change something

Open the panel in the corner and tell the agent what you want. Ask it to check
something off and the checkbox in front of you moves — not because the panel
echoed anything, but because the write went to disk, through the same validator
a load runs, and came back on the same subscription every other change does.

The agent cannot free-write a file. It has no filesystem access at all: the
only things it can name are NODES, through a closed list of tools — search,
read a subtree, create an outline, add, mark, retitle, note, schedule, move,
archive. Creating an outline is the one place a path is named, and it is a
relative `.jsonl` under the served directory, refused if it already exists and
written only as whole records. So the edits it can express are the edits the
format can be, and a malformed outline is not something it can produce. Whether
that is a restriction or the point depends on how you feel about a coding agent
with `sed` and your notes.

When it asks for something the outline will not do, you get the reason rather
than an apology. Marking a node whose status is computed from its children is
refused, and the refusal lists the children that are unfinished, as rows, which
are what to mark instead.

The conversation is Claude Code's own session for that directory: close olai,
reopen it, and you are back in it — and `claude --resume` in a terminal reaches
the same conversations.

## And commit it when you mean to

Those writes land on disk and WAIT. Git is how you see what the tool did to
your files — an audit trail, not sync and not undo — so a pill in the corner
says where that stands, and opening it shows what is waiting the way olai would
say it rather than as a diff:

```
┌─ Changes ─────────────────────────────────┐
│ olai: outlines-collection done            │
│   · chat agent · 12m ago · 1a2b3c4        │
│                                           │
│ roadmap.jsonl                             │
│   ✓  Outlines as a collection    done     │
│   ✎  Notes: one state, same line  note    │
│   +  Kolu integration: auto-…    created  │
│                                           │
│ chat agent 3 · you 1                      │
│                      [ Commit 3 changes ] │
└───────────────────────────────────────────┘
```

The pill is always there, because *there is no audit trail here* is the most
important thing it can say and a control that vanished is how you would never
find that out. It reads `✓ committed · 12m ago` when everything is recorded,
`no commits yet` when olai has never committed in this directory — a different
fact, and not one an empty list can express — `4 uncommitted` when something is
waiting, and `no git here` / `commits off` when there is nothing to record at
all. Those last two are settings rather than problems, so they are dim and
inert; the warning is saved for a repository that is mid-rebase.

Nothing is stored to make any of it work: it is `git status`, `git show HEAD:`
and one `git log` against what is on disk, so an outline you edited in vim is
in the list too, and committing in a terminal takes it out.
The agent has the same button as a tool of its own, which is the better one to
use — it knows where a train of thought ended, so its message can say
`olai: reconcile the roadmap with the #70–#81 merges` instead of describing
edits. Every message starts with `olai`, so `git log --grep '^olai'` is the
audit view and `--invert-grep` gives you back your own history, and each
commit carries an `X-Olai-Writer` trailer saying which of you wrote it.

If the repository is mid-merge, mid-rebase or on a detached HEAD, the button
says so and does nothing — an agent that committed into a conflict could
swallow the resolution.

`--commit=auto` is the old behaviour, one commit per write, for a server with
no browser in front of it; `--commit=off` (or `--no-commit`) is for a
directory whose history is somebody else's job. Not a git work tree: no pill,
no panel, and nothing is ever `git init`ed on your behalf.

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
that would happily `sed` your notes cannot. It gets the `commit` tool too, so
an agent working in your notes directory records what it did when it is done —
and `--commit=off` turns that off for a directory whose history is somebody
else's job.

There is still no write CLI, and there never will be — nothing you can type
adds a node or marks one. `olai web` and `olai mcp` are the two ways of putting
a write surface in front of a directory: a page, or a pipe.

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
