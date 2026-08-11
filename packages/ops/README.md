# @olai/ops — the only writer

Semantic edits over a served directory: create an outline, add, mark done,
doing or todo, retitle, note, schedule, move, archive, set see references.
Everything that changes an outline goes through here, and everything an agent
may READ of one comes out of here too.

It sits between `@olai/format` (what a record is, and what is legal) and
`@olai/store` (how bytes become durable). Neither of those knows what an EDIT
is; this package is where "mark `order` done" lives, and it is what the web UI's
procedures and the agent's MCP tools both call.

## Why the edits are semantic

Every request here names a NODE and a change to it — never a byte range, never
a whole file. Three things follow, and each of them is a property nothing else
in the system had to arrange:

- **a retry is free.** The store's write gate is optimistic: a `baseRev` the
  store has moved past comes back as `StaleWrite`, and this package re-derives
  the same edit against the newer snapshot. "Mark `order` done" means the same
  thing whatever else changed, so a `git pull`, another tab and the agent can
  all be writing at once and none of them loses an update. Only two edits that
  genuinely collide survive the retry, and then the op's own refusal speaks.
- **a broken file is unrepresentable.** A plan is whole RECORDS, re-emitted
  through the format's own writer, so canonical field order and the one
  trailing newline are not something a caller can get wrong. The glued-line
  incident of 2026-08-09 — two records on one line, out of a byte-level edit —
  is not a thing these ops can express.
- **a refusal can teach.** What a write is refused with travels as DATA — the
  validator's own rows, pinned to `file:line` — so the agent fixes the line
  rather than parsing a sentence, and the chat panel draws the same rows.
- **a write that LANDED can carry advice.** Marking a branch done over tasks
  nobody finished is allowed, and so is finishing the last open task under a
  parent; both come back with a `nudge` saying what the rollup noticed. Policy,
  in the answer, never an invariant — the format has nothing to say about a
  mark and the children under it (docs/format.md's Status).

## The files

| file | what it owns |
|---|---|
| `request.ts` | the things a writer may ask for, as schemas — one declaration serving the planner's switch, the tool schemas and the decoder |
| `plan.ts` | the whole decision, PURE: a snapshot and a request into the files that write would produce |
| `ops.ts` | the loop — read, plan, commit, re-plan on a stale base — and nothing else |
| `git.ts` | the auto-commit, as the store's post-publish hook |
| `query.ts` | reading the set as NODES: search, one node, a subtree, the outlines |
| `tools.ts` | the closed list of what an agent may do, and what it may not |
| `codec.ts` | the seam where the generic store meets the outline format |

`plan.ts` being pure is the design rather than a preference: everything hard
about an op is decided there, over a value, so it is testable without a disk
and re-decidable against a newer snapshot. The two impure things an op needs —
a fresh id and what time it is — arrive as arguments.

**`done` is stamped with the instant it was made**: `set_done` stores
`2026-08-11T15:40:03-04:00`, local and carrying its offset (`@olai/format`'s
`stampOf`), never a bare `true` and never a day with no time in it. Finishing
happens at a moment, the day view reads the day off the front of the value
anyway, so the time costs a reader nothing and orders a day's finished work.

**`doing` and `todo` store `true`** (resolved 2026-08-11, the human's call).
The symmetry argument — three answers to one question, written by one op — loses
to what a date on a mark now means: it puts the node on that day's journal page
(docs/format.md's Days). A stamped `todo` would file every capture onto the day
it was written down, and `/today` would stop being a record of what happened.
Starting and filing are not events a day is about; `set_date` is how a node is
scheduled for one.

Only the record being marked is rewritten; a `true` or a day-only value on any
other node comes back exactly as it was read, which is what the format means by
validating dates as text.

**The package exports four things, and the rest of that table is inside.**
`codec`, `make`, `Query`, `TOOLS` — one socket per concept, not the wires behind
it. The planner and the git hook are what those are made of; a consumer wants
the writer, not the plan, and its own tests reach it directly.

The TABLE is exported and used to be private, and the reason it changed is that
this package used to own an MCP server too. What a consumer wanted then was the
server, and the list was what the server was made of. `@kolu/surface-mcp` is the
server now — so the list is what a consumer wants, and the projection onto MCP
lives in `@olai/server`, which keeps the MCP SDK out of this layer entirely.

## Archiving, in racket's terms

`archive` moves a node's whole subtree into `Archive.jsonl` beside the outline
it left, re-creating the chain of ancestor TITLES it hung off, so the tree
still reads years later. The reference implementation's semantics are kept
because they are what the archive is for:

- the scaffold is one record per ancestor carrying its title and nothing else —
  no dates, no marks, no notes. A chain the archive already has is merged into,
  matched by exact title at that level, and new arrivals append at the end;
- **nothing is stamped.** Archiving is not finishing: a done node keeps its
  date, and an unmarked one is archived unmarked rather than being called
  finished on its way out. What changes is where the node lives;
- **ids move with the nodes**, so a `mirror`, `after`, `blocks` or `see` target
  goes on resolving — the served directory is one set and the archive is in it.
  What changes is that those edges stop holding anything up: archived work is
  over, so it blocks nothing and nothing blocks it (docs/format.md), and the
  file name that decides which nodes are in the archive is the format's own
  `ARCHIVE` rather than a second copy of it here.
  That is exactly why the scaffold nodes get MINTED ids rather than copies of
  the live ancestors': an id is unique across the set, and a copy would collide
  with the node it was copied from;
- both files are validated as one set before either is written, and both land
  in one commit.

## The git commit

Each write commits the files it produced, gated on the served directory
actually being a git work tree, with `olai web --no-commit` as the opt-out. The
message convention is the reference implementation's, because a log a person
already knows how to read is worth more than a better one they do not:

| op | subject |
|---|---|
| create (with seed) | `capture: TITLE` — the first node is a capture |
| create (empty) | `create: path.jsonl` |
| add | `capture: TITLE` |
| done / undo | `done: TITLE` / `undone: TITLE` |
| doing / undo | `doing: TITLE` / `not-doing: TITLE` |
| todo / undo | `todo: TITLE` / `not-todo: TITLE` |
| date | `move: TITLE -> 2026-08-10` (or `-> (cleared)`) |
| archive | `archive: TITLE` |
| move | `move: TITLE` |
| title | `rename: TITLE` |
| desc | `note: TITLE` |
| see | `see: TITLE` |

`create` is how a brand-new outline file is born: `add` only writes into a file
the set already holds. The path is a relative `.jsonl` under the served
directory, judged segment by segment the way `/media/*` judges a picture name
(no absolute path, no `..`), and an existing file is refused rather than
overwritten. A seeded create mints the first node the same way a capture does;
an empty one leaves a zero-byte outline for later `add_node`s.

The last field edits (including `see`) are this format's own: the reference had
no structural move, no separate note edit, and no agent-writable `see`. `move:`
keeps its meaning for a date, which is what it named there.

It cannot fail a write. The bytes are on disk and the browser has already seen
them by the time git runs; a refusal is logged and reported as
`committed: false`, and only the files this op wrote are ever named — a served
directory is a working tree with other work in it. What git actually said rides
that line as a field (`said=…`) rather than inside the sentence, so the message
stays greppable and the reason stays readable — `src/git.test.ts` holds both,
against a real directory with no repository in it.

## The tool surface, and what is missing from it

`TOOLS` is a closed list, and the absences are the design: **no file read, no
file write, no directory listing, no shell, no grep.** The agent cannot name a
byte, only a node. Reads answer with `file:line`, the node's mark (absent when
it carries none, because that is not a task), the ROLLUP of the tasks under it
— which is not in the file and is an annotation, never a second answer to what
the node is — its ancestor titles, which is what makes a bare title mean
something, and its `see` targets (when it has any), so a free cross-reference
is traversable without a second read. `set_see` is the write half: add and/or remove target ids on an
existing node; an unknown add is refused with the ids the set does hold.

How those tools reach an agent is NOT this package's any more. `@olai/server`
projects the table onto `@kolu/surface-mcp` bespoke tools, so the browser and
an agent read one surface rather than two projections of the same ops layer.
What stayed here is what an op MEANS, which is the half that was always ours.

A refused write still comes back as an `isError` result carrying its structured
detail — a protocol error is for a call the server could not process, and a
refusal is an answer that has to reach the model as data it can act on. That
contract is why the migration waited on juspay/kolu#2155: it is carried now by
that package's `ToolFailure`.

## Layering

Depends on `@olai/format` and `@olai/store`. `@olai/surface` is deliberately
absent: an op does not know it is being called over a wire.
[docs/architecture.md](../../docs/architecture.md) has the reasoning.

## Running

```sh
just test                                        # the whole workspace
bun test packages/ops                            # this package, in the dev shell
```

`src/plan.test.ts` is values in and values out — no disk, no store, no
protocol. `src/ops.test.ts` is the other half: a real temp directory, a real
store, a real git repository and the MCP surface in front of them, asserting
the things that are only true end to end.
