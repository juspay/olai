# @olai/format — the format, and the only place it is enforced

The format core ([docs/format.md](../../docs/format.md)): `parseOutline` per
file, `validate` per set, and the derivations — status, sibling order, tags,
mirror expansion — that both the validator and the view read from. It is the
bottom of the layering: it knows about records, files and rules, and nothing
about disks, servers or browsers.

Nothing outside these two functions may reject an outline. Not the reader, not
the store, not the web layer. A second interpretation of the format would be
free to disagree with the one that decides whether a file is legal at all.

## Staged, and the stage is part of the answer

Validation is two phases, and the seam is load-bearing rather than tidy.

`parseOutline` sees one line at a time and checks everything a single line can
answer alone — shape, id spelling, ISO dates, the two exclusivity rules.
`validate` sees the whole set and owns every rule that needs to know what else
exists: parents, mirror targets, `after` cycles, derived state.

A file is decoded whole or not at all, and the set-wide rules do not run until
every file parses. "`kitchen` is not a known id" is a guess when the line
declaring `kitchen` is the one that failed to parse, so a report containing a
per-line error says out loud that the set-wide questions have not been asked
yet (`reportStage`). Syntax first, then meaning; the alternative is a screen of
cascading errors with one real cause.

Within a phase, every rule runs and every error is collected. Stopping at the
first would turn "fix this file" into a loop of load-fix-load, which is the
workflow the format exists to remove.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, and its header
states the whole contract: the codec (`parseOutline`, `validate`), what they
produce (`OutlineSet` and the records in it), what a set MEANS (`derive` with
`rowsOf`, `zoom` and `withoutDone`) and what went wrong (`OutlineError`).
Everything else under `src/` is internal — the id regex, the edge-field list,
the path resolver are spellings a rule happens to use, not contract, and a
consumer reaching for one would be re-implementing a rule that lives here.

The derivations are exported for exactly this reason: the browser draws the
tree with the same code the validator judged it with. `zoom` is the same claim
about one node as a page — which record an id resolves to (following a mirror
chain to the regular node at its end, so a node has one page and not one per
placement), the canonical parent chain above it, and the rows beneath it.
Where a node lives and what it is under are facts about the set, so they are
answered here rather than carried in a URL that could disagree with the files.

## Layering

Depends on nothing in this workspace, and must not — a workspace sibling in its
`dependencies` would be a layering violation, and `bun install` is what would
report it. `surface`, `server` and `web` all depend on it.
[docs/architecture.md](../../docs/architecture.md) has the reasoning.

## Running

```sh
just test                    # the whole workspace's unit tests
```

Or, inside the dev shell, this package alone — it carries the bulk of the
suite, one `.test.ts` beside each module:

```sh
bun test packages/format
```
