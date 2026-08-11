# @olai/ops — the only writer

Semantic edits over a served directory: create an outline, add, mark done or
doing, retitle, note, schedule, move, archive, set see references. Everything
that changes an outline goes through here, and everything an agent may READ of
one comes out of here too.

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
| `request.ts` | the things a writer may ask for, as schemas — one declaration serving the planner's switch, the tool schemas and the decoder |
| `plan.ts` | the whole decision, PURE: a snapshot and a request into the files that write would produce |
| `ops.ts` | the loop — read, plan, commit, re-plan on a stale base — and nothing else |
| `pending.ts` | what is waiting to be committed, derived from git, and the one verb that commits it |
| `message.ts` | what a commit nobody wrote a message for says |
| `git.ts` | the plumbing, behind one socket: `open(root)` answers with a repository — its state, what is dirty, what HEAD had, what olai last committed, and `commit` — or `null` for a directory that is not a work tree |
| `query.ts` | reading the set as NODES: search, one node, a subtree, the outlines |
| `tools.ts` | the closed list of what an agent may do, and what it may not |
| `mcp.ts` | those tools spoken as MCP, with no transport in it |
| `codec.ts` | the seam where the generic store meets the outline format |

`plan.ts` being pure is the design rather than a preference: everything hard
about an op is decided there, over a value, so it is testable without a disk
and re-decidable against a newer snapshot. The two impure things an op needs —
a fresh id and today's date — arrive as arguments.

`pending.ts` derives and stores nothing, which is the same design in the other
direction: what is waiting is a question git already answers, and a tally of our
own would be a second answer that goes wrong the moment somebody edits a file in
vim. The comparison it runs is not here either — it is pure, and it lives beside
the format.

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

A commit is something somebody ASKS for. Writes land on disk and wait; the two
doors are a Commit button in the browser and the `commit` tool an agent calls
when it knows its work is finished, and both are callers of one `Ops.commit`.
`--commit=auto` is the old behaviour — one commit per write — for a headless
server with no browser to press anything, and `--commit=off` (`--no-commit`) is
for a directory whose history is somebody else's job.

What is waiting is DERIVED (`pending.ts`): `git status --porcelain` names the
dirty outlines, `git show HEAD:<file>` is the committed side, the store's own
last-good parse is the working side, and `@olai/format`'s `changesOf` compares
them into node-level changes. Beside it rides the LAST COMMIT olai made —
`git log -1` through the audit filter, so a person's own commits are not
reported — because what is waiting says nothing about whether anything was ever
recorded, and `null` there means "never" rather than "nothing right now".

A clean directory costs one `rev-parse` and three concurrent asks (state, what
is dirty, what was last recorded), with no parsing at all. The repository handle
is kept once it is one — a directory does not stop being a work tree — while a
negative answer is re-asked, so a `git init` under a running server is picked up
on the next sweep. Only `.jsonl` outlines are ever named on
`add` or `commit`: they are the only files this package writes, and a served
directory is a working tree with other work in it.

Committing checks that the repository is FREE first — no merge, rebase or
cherry-pick in flight, and not a detached HEAD. Nothing used to, which is how an
agent marking a node done mid-conflict could swallow a resolution, and that hole
is what decided manual over automatic.

Messages are prefixed `olai`, so `git log --grep '^olai'` is the audit view and
`--invert-grep` gives back a person's own history, and every commit carries an
`X-Olai-Writer: chat-agent | mcp | web` trailer — git records only the
repository's own user, which every commit in it already has. A composed message
names the biggest change by a fixed order and lists the rest.

The per-op summary — which is what `auto` commits with, and what a tool result
reports — keeps the reference implementation's convention, because a log a
person already knows how to read is worth more than a better one they do not:

| op | summary |
|---|---|
| create (with seed) | `capture: TITLE` — the first node is a capture |
| create (empty) | `create: path.jsonl` |
| add | `capture: TITLE` |
| done / undo | `done: TITLE` / `undone: TITLE` |
| doing / undo | `doing: TITLE` / `not-doing: TITLE` |
| date | `date: TITLE -> 2026-08-10` (or `-> (cleared)`) |
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
no structural move, no separate note edit, and no agent-writable `see`. `date`
is the one word that CHANGED — it printed as `move:` there, where a date was
what `move` named, and beside this format's real reparenting op that read as a
structural change that never happened.

Git can never fail a write. The bytes are on disk and the browser has already
seen them by the time git runs, so a refusal is a `Failed` carrying git's own
words and a warning in the log — with those words as a FIELD (`said=…`) rather
than inside the sentence, so the message stays greppable and the reason stays
readable. `src/git.test.ts` holds that shape, along with the repository states
that are only testable by putting a repository in them.

## The tool surface, and what is missing from it

`TOOLS` is a closed list, and the absences are the design: **no file read, no
file write, no directory listing, no shell, no grep.** The agent cannot name a
byte, only a node. Reads answer with `file:line`, the node's DERIVED status —
which for a parent is not in the file and can never be written there — its
ancestor titles, which is what makes a bare title mean something, and its `see`
targets (when it has any), so a free cross-reference is traversable without a
second read. `set_see` is the write half: add and/or remove target ids on an
existing node; an unknown add is refused with the ids the set does hold.

`mcp.ts` has no transport in it: it is one `handle` over JSON-RPC messages, and
that is what makes it serve every client at once. The olai server mounts it as
an HTTP route for the agent it spawns, pumps it over stdin and stdout for the
agent in somebody's terminal (`olai mcp`), and a test calls it directly. Three
methods and one notification is the whole of MCP's tool half, which is why the
official SDK would be a dependency for dispatch we would still have to route.

One frame is exported beside the server, and it is the only one a transport
ever builds: `parseError`, for bytes that never became a message. Detecting
that is genuinely the transport's — an HTTP body and a line fail in different
places — but what it IS is this dispatch's, so the two cannot drift into
answering the same non-message differently.

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

`src/plan.test.ts` and `src/message.test.ts` are values in and values out — no
disk, no store, no protocol. `src/ops.test.ts` and `src/pending.test.ts` are
the other half: a real temp directory, a real store, a real git repository and
the MCP surface in front of them, asserting the things that are only true end to
end — that a write WAITS, that what is waiting comes from git rather than from a
tally, and that a busy repository refuses.
