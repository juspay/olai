# @olai/ops — the only writer

Semantic edits over a served directory: create an outline, add a node or a
whole subtree, mark done, doing or todo, retitle, note, schedule, move,
archive, set see references, place and retire mirrors, wire the `after` edges a
node waits on.
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
| `pending.ts` | what is waiting to be committed, derived from git, the one verb that commits it, and what git is doing for the directory at all — one survey, both answers |
| `message.ts` | what a commit nobody wrote a message for says |
| `git.ts` | the plumbing, behind one socket: `open(root)` answers with a repository — its state, what is dirty, what HEAD had, what olai last committed, and `commit` — or with `NoRepo` for a directory that is not a work tree, or `Unusable` for a git that could not be asked |
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

`pending.ts` derives and stores nothing, which is the same design in the other
direction: what is waiting is a question git already answers, and a tally of our
own would be a second answer that goes wrong the moment somebody edits a file in
vim. The comparison it runs is not here either — it is pure, and it lives beside
the format.

**The package exports four things, and the rest of that table is inside.**
`codec`, `make`, `Query`, `TOOLS` — one socket per concept, not the wires behind
it. The planner and the git hook are what those are made of; a consumer wants
the writer, not the plan, and its own tests reach it directly. The one type that
travels with them is `GitState`, because a consumer PUBLISHES that value; the
two subprocesses that produce it stay in here.

The TABLE is exported and used to be private, and the reason it changed is that
this package used to own an MCP server too. What a consumer wanted then was the
server, and the list was what the server was made of. `@kolu/surface-mcp` is the
server now — so the list is what a consumer wants, and the projection onto MCP
lives in `@olai/server`, which keeps the MCP SDK out of this layer entirely.

## A subtree in one call

`add` takes an optional `children`, and each child takes the same fields the
node itself does — `title`, and optional `desc` / `date` / `mark` / `id` — with
`children` of its own. So capturing an outline is ONE call: one plan, one
validation of the whole set, one atomic rename, one commit.

It is a fix for two things that were the same thing. An agent capturing a house
outline issued one `add_node` per node — thirteen calls, each paying the full
write gate and a round trip — and a failure partway through that sequence left
a half-captured subtree behind, with nothing to say which half. A tree that is
planned at once cannot half-land: the gate already writes all files or none.

**`create`'s `seed` is that same capture**, `children` and all, so a brand-new
outline arrives holding everything it was born with. That is the same argument
one level up: `create` then `add` was two plans, and a second one that refused
left an EMPTY outline on disk nobody had asked for. Now the file and its
contents are one plan — a seed refused anywhere in its tree leaves no file at
all, which `src/ops.test.ts` asserts against a real directory. The two tools
therefore take one shape (`ROOT` in `src/request.ts`): a seed that could say
less than a capture would be a reason to make the second call this exists to
delete.

- **The mark rides along.** A captured node may be born `done`, `doing` or
  `todo`, written exactly as `set_done` / `set_doing` / `set_todo` write it —
  one `marker` function, read by both — so a `done` records the instant and
  lands on today's page, and the other two store `true` and place the node on
  no day. One field rather than three flags, because the format allows at most
  one mark and a shape that can spell two is a shape a caller can get wrong.
- **Placement is the root's.** `before` / `after` place the node being added
  among its new siblings; the children are being born, so there is nobody to
  place them among and they land in the order they were written. File order is
  the outline's reading order: a parent, then its subtree, then the next
  sibling.
- **A collision refuses everything.** A chosen `id` that the set already holds,
  or that another node in the same call also chose, refuses the whole capture —
  which is also what a cycle attempt looks like when every node is being born
  at once, since a child naming an ancestor's chosen id is naming a taken one.
  Nothing lands, because "nothing landed" is the only answer that makes the
  call atomic.
- **The answer names what it made.** `captured` carries every node's id and
  title, parent before child. A minted id is unguessable, and an agent that
  just wrote thirteen nodes should not have to search for them to mark one. It
  has ONE shape: a plain capture is a list of one, a seeded `create` is too,
  and it is absent only from the ops that create nothing — which is how the
  format spells an empty list everywhere else. Only the commit subject asks
  whether anything came along, since `(+0)` would count nothing.
- **It nests three levels deep, and that cap is the JSON Schema's.** Neither
  the format nor planning a tree wants a depth limit; what has one is the
  schema an MCP host reads, and the planner enforces THAT rather than one of
  its own. A recursive Effect schema compiles to a `$ref` into a
  `$defs` pool, and the adapter that projects these schemas inlines every local
  ref and strips the pool, because `$ref` is rejected across the host matrix it
  is byte-compatible with — so a ref it cannot inline finitely would survive as
  a pointer into nothing and take the whole tool down. The nesting is therefore
  unrolled, and three levels is what the capture this was filed for needs while
  each further level is another whole copy of the child schema in every
  `tools/list`. The floor of the unrolled schema still declares `children`, on
  purpose: an Effect struct silently DROPS a key it does not declare, so a
  schema that simply stopped would swallow the deepest level of a capture and
  report success. It is refused by name instead, pointing at the id in
  `captured` a second call should hang the rest off.

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
| create (seed with children) | `capture: TITLE (+N)` |
| create (empty) | `create: path.jsonl` |
| add | `capture: TITLE` |
| add (with children) | `capture: TITLE (+N)` — N is what came with it |
| done / undo | `done: TITLE` / `undone: TITLE` |
| doing / undo | `doing: TITLE` / `not-doing: TITLE` |
| todo / undo | `todo: TITLE` / `not-todo: TITLE` |
| date | `date: TITLE -> 2026-08-10` (or `-> (cleared)`) |
| archive | `archive: TITLE` |
| move | `move: TITLE` |
| title | `rename: TITLE` |
| desc | `note: TITLE` |
| see | `see: TITLE` |
| after | `after: TITLE` |
| mirror | `mirror: TITLE` — the TARGET's title, not the placement's id |
| unmirror | `unmirror: TITLE` |

`create` is how a brand-new outline file is born: `add` only writes into a file
the set already holds. The path is a relative `.jsonl` under the served
directory, judged segment by segment the way `/media/*` judges a picture name
(no absolute path, no `..`), and an existing file is refused rather than
overwritten. A seeded create mints its nodes the way a capture does, and that is
now one walk rather than a promise: `seed` IS a capture — the same fields, the
same `children`, the same depth — through the same `emit` `add` uses, so a new
outline holding a dozen nodes is one call and a refused seed leaves no file. An
empty one leaves a zero-byte outline for later `add_node`s.

The last field edits (including `see`), the two mirror ops and `after` are this
format's own: the reference had no structural move, no separate note edit, and
no agent-writable `see`. `date` is the one word that CHANGED — it printed as
`move:` there, where a date was what `move` named, and beside this format's real
reparenting op that read as a structural change that never happened.

## Placements, and the edges

A mirror is the second half of the format the ops layer could not write, and the
gap was not academic: the ledger this repository keeps its own roadmap in has a
Now section made of mirror records, and every entry in it was a HAND EDIT of the
file — the practice `docs/RCA/2026-08-11-roadmap-stamp-reverts.md` is about. So:

- **`add_mirror` places one.** The record is `{id, parent?, ord, mirror}` and can
  be nothing else, because it is built here from a request that has no field for
  a title or a mark — "a mirror carries nothing but its four" is unrepresentable
  rather than checked. It lands like an `add`: under a `parent`, or at the top
  level of a `file`, with `before` / `after` among the siblings there and an
  `ord` minted between them. Two refusals are its own — a target nothing
  declares, and a placement INSIDE the subtree it shows, which is the one mirror
  rule that cannot be checked one record at a time (expanding it would never
  end). That walk is the validator's own graph (`@olai/format`'s `drawnFrom`),
  downward: a node leads to its children, a mirror to its target, so a loop that
  closes through another placement is found, and the refusal names it — with the
  same arrow the validator writes a cycle with, because that is one function too
  (`chainOf`). All three loop refusals this layer has — a move under its own
  descendant, a placement inside what it shows, an `after` edge closing a cycle
  — are one walk (`pathTo`) over three graphs, and each of them names the loop
  rather than merely reporting one.
- **`remove_mirror` retires one, and that is a PLACEMENT rather than a node.**
  `id` is the mirror's own — the line goes, and the target keeps its title, its
  mark, its children and every other placement of it. It is deliberately not
  `archive_node` (which MOVES a subtree, ids and all, into `Archive.jsonl`) and
  deliberately not a delete of content: no op in this layer destroys any, and
  this one does not become the first by accident. So it refuses on the id of a
  regular node, and says which op puts a node away — and it refuses while
  anything still NAMES the placement (a mirror chained onto it, an edge written
  at it), listing what to re-point and at which node. That last refusal was the
  validator's until the 2026-08-11 review: safe, since nothing landed, but what
  came back was a row about the file the write would have produced, saying an id
  the caller had just asked to delete is unknown — occasionally with a
  did-you-mean pointing at its NEIGHBOUR. A refusal that teaches the wrong
  lesson is worse than one that teaches none. It is still not re-validation:
  what a record points at is `@olai/format`'s `targetsOf`, the same function the
  validator's unknown-target rule reads forwards, so a relation added to the
  format later cannot slip past the scan.
- **`set_after` is `set_see`'s shape over the other kind of edge** — one
  function plans both — and the difference is the rule. `after` is the ORDERING
  graph, so an add that closes a loop is refused with the loop named, read over
  `derive`'s graph with `blocks` normalised in and both ends resolved to nodes:
  the same graph the validator's acyclicity check walks, so a deadlock closing
  through a mirror is one loop here and there rather than two answers. `blocks`
  is not writable, for the reason it is sugar — `a blocks b` IS `b after a`, and
  a writer that could spell both would put one relation on disk two ways.

Both new fields are READ back too. A hit and a node's own read carry `after`
beside `see`, because a target is removed BY ID and a caller that cannot see the
list can only guess at it; and `read_node` answers a placement from **both
ends**:

- `mirrors` — every placement OF this node, chain followed. The discovery path
  the surface would otherwise not have: mirrors are left out of search and out
  of every child list on purpose (a mirror is a second location of a node, and a
  search returning one would be the same node twice), so the only id
  `remove_mirror` could ever be handed would be one the same session had just
  minted. A mirror is not a node, so you ask the node where it is placed. This
  is the retire path from the finished ITEM's side;
- `placed` — the placements UNDER this node, in sibling order, each carrying the
  node it shows. The list's side of the same fact, and the one the ledger is
  actually read with: **"what is on Now?"** was a question this layer could not
  answer at all (2026-08-11 review), so an orchestrator opening a fresh session
  — having placed nothing yet, with no item to ask — was back to reading the
  file by hand, which is the practice these ops exist to end. `children` is not
  the place for it: that list is what HANGS OFF a node, and it is deliberately
  free of mirrors, while this is what a node POINTS at. Two questions, two
  answers.

None of that is worth anything if nothing says so where an agent will read it,
which is why the read tools' descriptions name these fields and
`packages/server/src/mcp/tools.test.ts` fails if they stop.

Git can never fail a write. The bytes are on disk and the browser has already
seen them by the time git runs, so a refusal is a `Failed` carrying git's own
words and a warning in the log — with those words as a FIELD (`said=…`) rather
than inside the sentence, so the message stays greppable and the reason stays
readable. Only the files this layer wrote are ever named, on both `add` and
`commit`: a served directory is a working tree with other work in it.
`src/git.test.ts` holds that shape, along with the repository states that are
only testable by putting a repository in them.

**And it says WHY, because `committed: false` on its own is four different
pieces of news.** That was `git-invisible`: a person writing to a directory they
knew was a repository got the boolean and nothing else, while the cause went
only to a log they were not reading. So this layer answers with two values a
caller can render, and neither of them is a boolean:

- **`Applied.why`** — one sentence on the reply of any write that was not
  committed, absent when it was. Additive, so nothing that read the reply had to
  change. The agent reads it in its tool result; the panel draws it beside the
  call. Under the DEFAULT mode that sentence says the write is *waiting*, which
  is the feature working and must not read as a fault — `manual` is not an error
  state, and a reader told otherwise would go looking for a broken repository
  that is not broken.
- **`Ops.git`** — what git is doing for this directory: `off` (`--commit=off`),
  `repo`, `none`, or `error` with git's own words. A PROJECTION of the same
  survey `Ops.pending` runs (`gitOf`), never a probe of its own: two probes
  would be two answers to one question. The server recomputes both together and
  publishes them onto the `git` and `pending` cells, where the browser reads
  them into a SINGLE control (`one-git-indicator` retired the second chip that
  used to draw this one on its own) and an agent in a terminal reads the same
  cell as a resource.

Two classifications make that honest, and both are git's own answers rather than
guesses. A directory git will not answer about is `Unusable` — and so `error` —
unless git said its own "not a git repository", because collapsing a broken git
into "you have no repository" is precisely what this package used to do; git runs
under `LC_ALL=C` so that one sentence is stable. And a commit that REFUSED is the
one thing `pending.ts` remembers rather than derives, because it is the one
failure a probe cannot see: `rev-parse` answers perfectly happily in a repository
with no `user.email`, so a state read from the directory alone would look healthy
while every commit failed. It is cleared by the next commit that works.

## The tool surface, and what is missing from it

`TOOLS` is a closed list, and the absences are the design: **no file read, no
file write, no directory listing, no shell, no grep.** The agent cannot name a
byte, only a node. Reads answer with `file:line`, the node's mark (absent when
it carries none, because that is not a task), the ROLLUP of the tasks under it
— which is not in the file and is an annotation, never a second answer to what
the node is — its ancestor titles, which is what makes a bare title mean
something, its `see` and `after` targets (when it has any), so a
cross-reference and a dependency are both traversable without a second read, and
— on a node read — the placements at both ends of it, `mirrors` and `placed`.
`set_see` and `set_after` are the write halves: add and/or remove target ids on
an existing node, and an unknown add is refused with the closest id that does
exist — the validator's own did-you-mean, one moment earlier, through the very
same function (`@olai/format`'s `didYouMean`), so a write and a load cannot
disagree about what a typo is or say so in two voices. That refusal used to list
every id in the set, which is the right answer for the OUTLINES of a directory
and the wrong one for the nodes in it: `search_nodes` is the tool for "I do not
know what it is called". It is ONE refusal for an id nothing declares, whatever
the id was doing — the node an op is about gets the same help as a target it was
asked to point at. Tool descriptions teach the gestures the surface is shaped around —
`add_node`'s, that nodes you already know go in ONE call; `add_mirror`'s, that a
curated list is placements rather than copies; `set_after`'s, that a dependency
is written from the node that waits.

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

`src/plan.test.ts` and `src/message.test.ts` are values in and values out — no
disk, no store, no protocol. `src/ops.test.ts` and `src/pending.test.ts` are
the other half: a real temp directory, a real store, a real git repository and
the MCP surface in front of them, asserting the things that are only true end to
end — that a write WAITS, that what is waiting comes from git rather than from a
tally, and that a busy repository refuses.
