# olai

An outliner whose file format is a git-reviewable one, and whose editor is a
browser and an agent rather than a text buffer.

One `.jsonl` file per outline, one JSON object per line, one line per node
([docs/format.md](docs/format.md)). Stable ids and parent pointers mean a
subtree move is a one-field write, so plain line-based git merges are safe and
a diff shows what actually changed.

Status: phase 2 of the [roadmap](docs/roadmap.jsonl) — you can serve a
directory and read your outlines. Editing arrives in phases 4–6.

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

Every node is also a page of its own at `/n/<id>` — the node as the heading,
its note, its children as the tree — with breadcrumbs up its ancestry. Ids are
stable and unique across the whole directory, so that address survives renames
and moves, even to another file, and a mirror of a node resolves to the same
one page as the node itself.

If the set does not validate, the page is the list of errors instead — every
one naming `file:line`, grouped by the file that has to be edited, with the
ones that implicate two files in their own section. Error quality is the
product here, not a consolation prize: the format exists so that a bad edit is
a caught edit.

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
