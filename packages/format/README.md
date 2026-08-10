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

A file is decoded whole or not at all. The set-wide rules then run over the
files that DID parse, and what happens to the one that did not is the error
scope (resolved 2026-08-09, and the reason `validate` is handed each file's
`Result` rather than only the successes):

- if the survivors are clean, the set is accepted with that file's errors
  embedded in it (`OutlineSet.broken`). The browser renders them in that one
  outline's place and everything else stays live;
- if anything else is wrong, the set is rejected and the report carries the
  parse errors alongside whatever else was found.

Guesses are still not reported. "`kitchen` is not a known id" is a guess when
the line declaring `kitchen` is the one that failed to parse — so `unknown-target`
is withheld while any file is unreadable, and withholding one is itself a reason
to reject the set rather than publish nodes whose targets are unresolvable.
Nothing else can be *invented* by a missing file: `parent` may not cross files,
so an unresolved one is refused whichever file it was going to be in, and a
duplicate or a cycle can only be hidden by a missing file, never conjured. A
report containing a per-line error says out loud (`reportStage`) that a second
round is expected.

Within a phase, every rule runs and every error is collected. Stopping at the
first would turn "fix this file" into a loop of load-fix-load, which is the
workflow the format exists to remove.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, and its header
states the whole contract: the codec (`parseOutline`, `validate`), what they
produce (`OutlineSet` and the records in it), what a set MEANS (`derive` with
`rowsOf`, `zoom` and `withoutDone`), how a set is WRITTEN BACK
(`serializeOutline` and `ordBetween`), what went wrong (`OutlineError`) and what
a write says when it refuses (`OpFailure`).
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
report it. `ops`, `surface`, `server` and `web` all depend on it.
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

## Writing is here too, and for the same reason reading is

`src/write.ts` is the only thing in olai that turns records back into bytes,
and `src/ord.ts` is the only thing that decides where a node sits among its
siblings. Both are statements about the format rather than about whoever is
writing, so they live beside the rules that judge them.

The writer takes the records of a WHOLE FILE and gives back the whole file, so
every separator has exactly one owner: the newline between two records, the one
at the end, the absence of a blank line. That shape is the point. A caller that
built its own bytes once produced two records glued onto one line — a file no
reader could parse, out of a write every layer above believed had succeeded —
and `write.test.ts` asserts the invariant directly, by parsing back what the
writer produced for every shape of record the format has.

`ordBetween` is a fractional index over base62 in ASCII order, so the plain
string comparison the format promises IS numeric order in this encoding. It
answers `null` for the one pair with no answer — nothing sorts between `x` and
`x0` — rather than inventing a key in the wrong place; the ops layer renumbers
that row instead.

`src/failure.ts` is the other half of the error story: the five KINDS a write
refuses with (`usage`, `not-found`, `validation`, `derived`, `busy`), as
schemas, so a refusal travels the wire and an MCP tool result as itself. Five
classes rather than one with a `kind` string because they carry different
things — only `derived` has children to list, only `validation` has a report to
show — and a single struct would make every field optional and push "which
fields are meaningful" back into prose.
