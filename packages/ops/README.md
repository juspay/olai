# @olai/ops — the only writer

Semantic edits over a served directory: add, mark done or doing, retitle, note,
schedule, move, archive. Everything that changes an outline goes through here,
and everything an agent may READ of one comes out of here too.

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
- **a refusal can teach.** Marking a node whose status is computed from its
  children is refused with the unfinished children AS DATA, so the agent can do
  them one at a time and the chat panel can draw them as rows.

## The files

| file | what it owns |
|---|---|
| `request.ts` | the eight things a writer may ask for, as schemas — one declaration serving the planner's switch, the tool schemas and the decoder |
| `plan.ts` | the whole decision, PURE: a snapshot and a request into the files that write would produce |
| `ops.ts` | the loop — read, plan, commit, re-plan on a stale base — and nothing else |
| `git.ts` | the auto-commit, as the store's post-publish hook |
| `query.ts` | reading the set as NODES: search, one node, a subtree, the outlines |
| `tools.ts` | the closed list of what an agent may do, and what it may not |
| `mcp.ts` | those tools spoken as MCP, with no transport in it |
| `codec.ts` | the seam where the generic store meets the outline format |

`plan.ts` being pure is the design rather than a preference: everything hard
about an op is decided there, over a value, so it is testable without a disk
and re-decidable against a newer snapshot. The two impure things an op needs —
a fresh id and today's date — arrive as arguments.

**The package exports four things, and the rest of that table is inside.**
`codec`, `make`, `Query`, `Mcp` — one socket per concept, not the wires behind
it. The planner, the tool table and the git hook are what those are made of; a
consumer wants the writer, not the plan, and its own tests reach it directly.

## Archiving, in racket's terms

`archive` moves a node's whole subtree into `Archive.jsonl` beside the outline
it left, re-creating the chain of ancestor TITLES it hung off, so the tree
still reads years later. The reference implementation's semantics are kept
because they are what the archive is for:

- the scaffold is one record per ancestor carrying its title and nothing else —
  no dates, no marks, no notes. A chain the archive already has is merged into,
  matched by exact title at that level, and new arrivals append at the end;
- **nothing is stamped.** Archiving is not finishing: a done node keeps its
  date, an open node stays open. What changes is where the node lives;
- **ids move with the nodes**, so a `mirror`, `after`, `blocks` or `see` target
  goes on resolving — the served directory is one set and the archive is in it.
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
| add | `capture: TITLE` |
| done / undo | `done: TITLE` / `undone: TITLE` |
| doing / undo | `doing: TITLE` / `not-doing: TITLE` |
| date | `move: TITLE -> 2026-08-10` (or `-> (cleared)`) |
| archive | `archive: TITLE` |
| move | `move: TITLE` |
| title | `rename: TITLE` |
| desc | `note: TITLE` |

The last three are this format's own: the reference had no structural move and
no separate note edit. `move:` keeps its meaning for a date, which is what it
named there.

It cannot fail a write. The bytes are on disk and the browser has already seen
them by the time git runs; a refusal is logged and reported as
`committed: false`, and only the files this op wrote are ever named — a served
directory is a working tree with other work in it.

## The tool surface, and what is missing from it

`TOOLS` is a closed list, and the absences are the design: **no file read, no
file write, no directory listing, no shell, no grep.** The agent cannot name a
byte, only a node. Reads answer with `file:line`, the node's DERIVED status —
which for a parent is not in the file and can never be written there — and its
ancestor titles, which is what makes a bare title mean something.

`mcp.ts` has no transport in it: it is one `handle` over JSON-RPC messages, and
that is what makes it serve every client at once. The olai server mounts it as
an HTTP route for the agent it spawns, pumps it over stdin and stdout for the
agent in somebody's terminal (`olai mcp`), and a test calls it directly. Three
methods and one notification is the whole of MCP's tool half, which is why the
official SDK would be a dependency for dispatch we would still have to route.

A refused write comes back as a successful JSON-RPC result carrying
`isError: true` — a protocol error is for a call the server could not process,
and a refusal is an answer that has to reach the model, with its structured
detail in `structuredContent`.

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
