# olai

An outliner whose file format is a git-reviewable one, and whose editor is a
browser and an agent rather than a text buffer.

One `.jsonl` file per outline, one JSON object per line, one line per node
([docs/format.md](docs/format.md)). Stable ids and parent pointers mean a
subtree move is a one-field write, so plain line-based git merges are safe and
a diff shows what actually changed.

Status: phase 3 of the [roadmap](docs/roadmap.jsonl) — you can serve a
directory, read your outlines, and watch the page follow the files as you edit
them or pull them. Editing from inside olai arrives in phases 4–6.

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
It binds to loopback by default: the surface is unauthenticated, so anyone who
can reach the port can read every outline under the directory.

It keeps reading. Save a file, `git pull`, drop a new outline into the
directory, and the open page updates in place — no reload, no restart. There is
no polling of the browser and no cache to invalidate: the server watches the
tree, re-reads only what actually changed, revalidates, and pushes the next
snapshot down the subscription the first one arrived on.

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
| [`packages/store`](packages/store) | a directory of files as a validated, revision-tagged snapshot — generic, with no outline types in it |
| [`packages/surface`](packages/surface) | the typed reactive layer both ends speak, declared once |
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
