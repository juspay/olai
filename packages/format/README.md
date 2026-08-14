# @olai/format — the format, and the only place it is enforced

The format core ([docs/format.md](../../docs/format.md)): `parseOutline` per
file, `validate` per set, and the derivations — sibling order, tags, mirror
expansion, the rollup a parent displays, what is dated a given day, what is
overdue as of one — that both the validator and the view read from. It is the bottom of the layering: it knows about records, files
and rules, and nothing about disks, servers or browsers.

Nothing outside these two functions may reject an outline. Not the reader, not
the store, not the web layer. A second interpretation of the format would be
free to disagree with the one that decides whether a file is legal at all.

## Staged, and the stage is part of the answer

Validation is two phases, and the seam is load-bearing rather than tidy.

`parseOutline` sees one line at a time and checks everything a single line can
answer alone — shape, id spelling, ISO dates, the two exclusivity rules.
`validate` sees the whole set and owns every rule that needs to know what else
exists: parents, mirror targets, `after` cycles, documents.

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

An unknown reference is nearly always a misspelling, so an error about one ends
with the closest declared id — within a typo's distance (`src/suggest.ts`: a
third of the id's length, never less than two), and nothing further away, since
a guess that is merely NEAREST teaches a reader to distrust the offer. That rule
is exported (`didYouMean`, and `nearestId` for a caller that wants the candidate
rather than the wording) for one reason: the ops layer refuses the same unknown
`mirror` / `after` / `see` target one moment EARLIER, at the plan, and a second
copy of the budget — or of the sentence — would let the write and the load
disagree about what a typo is. `chainOf` (`src/errors.ts`) is the same argument
about a LOOP: the validator names one it found on load, the ops layer names the
one a write is about to close, and the arrow between the ids is written once.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, and its header
states the whole contract: the codec (`parseOutline`, `validate`), what they
produce (`OutlineSet` and the records in it), what a set MEANS (`derive` with
`rowsOf`, `zoom` and `withoutDone`), how a set is WRITTEN BACK
(`serializeOutline` and `ordBetween`), what went wrong (`OutlineError`), what
a write says when it refuses (`OpFailure`), and the two vocabularies that cross
this floor because both the ops layer and the wire spec speak them — what a
pending commit is spoken in, and what a search asks and answers.
Everything else under `src/` is internal — the id regex, the edge-field list,
the path resolver are spellings a rule happens to use, not contract, and a
consumer reaching for one would be re-implementing a rule that lives here.

The derivations are exported for exactly this reason: the browser draws the
tree with the same code the validator judged it with.

`src/filter.ts` is the newest of them and the one whose placement is worth
arguing: it says what a QUERY means — the words, the operators (`is:`, `has:`,
`date:`, `-`), which nodes they select, and `keeping`, the row transform that
narrows a tree to the matches with their ancestors, sibling of `withoutDone`.
It is here rather than beside the search procedure in `@olai/ops` because the
browser's filter runs on every keystroke over rows it already holds and cannot
be a caller of that procedure — so the alternative was a client-side predicate
written to the same paragraph, which is exactly how `is:done` comes to mean one
thing to an agent and another to the box a person types in. One matcher, four
callers; `Query.search` calls it as its gate and keeps the ranking.

`Status` is the three `MARKS` — `done`, `doing`, `todo`, declared once in
`node.ts` because the per-line rule, the ISO check and the index all read that
one list — and it is OPTIONAL wherever it appears: a node nobody marked has no
status, and `derive`'s status index is partial over the set rather than total.
A node missing from it is a bullet, and `todo` is how a node says the other
thing, which someone has to put there (docs/format.md's Status section).

A status is STORED, on whatever record carries it, parent or leaf; the index
resolves exactly one hop, a mirror standing for its target's mark because that
is what it shows. Nothing is computed from a node's children — that was
derivation, deleted 2026-08-11 with the rule that existed to defend it, because
it read containment as decomposition and made a parent a task nobody had called
one. What survives is `progressOf`: how many of a node's child tasks are done,
`3/5`, an annotation carried on `Row` and `Situated` for the view to draw
beside a title. It feeds nothing — not `withoutDone`, which reads the stored
mark, and not blocking.

**Blocked** is the other thing the marks are read for, and it is derived beside
them: `after` (with `blocks` normalised into it in the one place that happens,
so the acyclicity rule and this see one graph) says `a` comes after `b`, and
`b` is in the way while it is a TASK that is not done. A target with no status
never blocks — it is not work, so there is nothing under it to finish — and
spelling the test `status !== "done"` is the trap docs/format.md writes the
rule against. One predicate at both ends of the arrow, racket's own shape: a
done node is waiting on nothing, a bullet is neither blocked nor blocking, and
archived work is out of it in both directions because it is over. What a
blocker IS is `InTheWay`: a node and the mark that makes it unfinished, which
is the same sentence `unfinishedUnder` says about children and about the other
kind of edge. The ordering graph is built in two passes — every node's own
`after` first, then the `blocks` pointing back at it — so the order a reader
with room for ONE blocker sees is a promise rather than an accident of where in
the directory somebody wrote an unrelated edge; and both halves are filed under
the node their target NAMES, mirrors resolved, so the acyclicity rule and this
cannot disagree about whether two records mean one edge. Nothing outside this
package asks for the index: what is in a node's way rides on the `Row` and the
`Situated` it belongs to, the way its mark does.

`zoom` is the same claim
about one node as a page — which record an id resolves to (following a mirror
chain to the regular node at its end, so a node has one page and not one per
placement), the canonical parent chain above it, and the rows beneath it.
Where a node lives and what it is under are facts about the set, so they are
answered here rather than carried in a URL that could disagree with the files.

`dates.ts` is the same claim about a DAY. There is no journal file and no
stored year→month hierarchy: a day is a question asked of every dated node in
every outline, so `datedDays` (which days of a month have something on them)
and `datedOn` (everything on one day, grouped by outline, with each node's
ancestry and mark) are one reading of the set that the calendar and
the day view both read from — a dot that disagreed with the page it opened
would be worse than no dot. Dates stay TEXT here as everywhere else: a day is a
ten-character prefix, a month a seven-character one, and a datetime counts for
its own day.

TWO fields are read, not only `date`: a dated `done`
(`{"done":"2026-08-11T15:40:03-04:00"}`) places a node too, because a journal
without the work that was finished is missing the half of the day that
happened. A dated `doing` or `todo` is read by neither question (2026-08-11,
human): the format allows it, a journal is narrower than the format, and
"picked up on Tuesday" buried the day under everything filed that morning. So a
node with two dates is on two days, two dates on one day are one row, and each row says
which of the node's dates put it there (`Occasion`), because scheduled-on and
finished-on are two different sentences and only the reader can be told which
one they are reading. A `done` holding `true` is on no day: it declines to say
when, and inventing an answer would file every old `true` under today. The
ARCHIVE is not filtered out and that is a decision (2026-08-11): blockedness
exempts archived work at both ends because nothing waits on what is over, and a
journal asks the other question — what happened — so a day keeps the work that
was put away after it was finished.

The same module answers the one question about a day that is not about nodes at
all: which DOCUMENT is that day's note. `noteDateOf` is the whole convention —
a `.md` whose basename is exactly an ISO date is that day's note, wherever in
the tree it sits, and `2026-08-10-recap.md` deliberately is not — with
`dailyNotesOn` (the notes of one day, in path order, both of them when two files
claim one date) and `dailyNoteDays` (the days of a month that have one) reading
it for the day page and the calendar's second mark. It is here rather than
beside whatever draws a calendar for the reason the two questions above are one
module: a mark and the page it opens must be one reading. Those two take the
document PATHS rather than a derived set, which is the shape of the wire — a
browser holds every path and only the bodies of what is on screen. Nothing about
this is a rule the validator enforces: a daily note is a view convention over
filenames, and no record mentions it.

`agenda.ts` reads those same dates FORWARD: what is owed rather than what is
on. It adds no field and no rule — `date` says when, the mark says whether it is
work, and the two together are the whole reading, so `date` with no mark is an
occurrence that can never be late and `date` with `todo` or `doing` is due work.
`isOverdue(node, today)` is that predicate spelled ONCE (`todo ∨ doing`, and
`day(date) < day(today)` by plain string order, because dates are text here too
— both sides through `dayOf`, so it answers about a day whichever shape of ISO
value it is handed), and it is read by the page's first section and by the tone
a date badge takes, the way `blocked` is one predicate read at both ends of its
arrow. `agendaOf` assembles the three sections a reader wants — overdue, today,
the next days that have anything — out of ONE bucketed walk (`datedByDay`), read
back through the same `groupedOn` and `byOutline` a day page is built from, so
the agenda and the day it links to cannot be two readings and nine days cost one
pass rather than nine. `done` is
filtered from all three: this question is what is OWED, and what happened is the
day view's. `owedOf` counts an agenda that has already been read — how many
NODES are in Overdue and in Today, never how many outlines they were grouped
under — and it takes the ANSWER rather than the set for the reason `nothingDue`
does: whatever marks the agenda from outside it (the client's directory entry
does) counts the very rows the page draws, instead of walking the directory a
second time and being free to disagree. Upcoming is deliberately no part of it —
a task due next Tuesday is not news today, and a count that included it could
never fall to nothing. TODAY IS AN ARGUMENT, never a clock: a derivation that read one
would answer differently on the machine it ran on, and what day it is belongs to
the reader (`web/src/client/clock.ts`).

`stamp.ts` is the other direction, and every date value olai WRITES is minted
there: `stampOf` produces a local ISO datetime carrying its offset, which is
what the ops layer marks a node with. It lives beside the rule that ACCEPTS one
so that what olai writes and what olai reads are two functions in one package
rather than a writer above guessing at a shape. (The browser's clock turns an
instant into date text too, for the question "which day is `/today`" — nothing
it mints is stored, and that the two agree about where a local day ends is a
test in `@olai/web` rather than an argument.)

A day's nodes and a zoomed page are built from the same `Situated` — a node,
its mark, its rollup, what is standing in its way and its canonical ancestry —
because that is one concept
with several readers, not a shape two surfaces happened to agree on. A title
torn out of its outline says nothing, wherever it is being drawn.

`documents.ts` is the third such claim, about the `.md` files beside the
outlines. A document's text is content — verbatim on disk, markdown at view
time, nothing about it validated — so what lives here is only what has to be
answered the same way twice: where a node's `doc` lands (`docOf`, resolved
against the outline that named it, which is the rule the validator checks and
the view links with), and what a relative `![](…)` may name (`pictureOf`,
`isPicture`). That last one is asked by two packages that cannot import each
other — the renderer that rewrites a picture into a URL, and the route that
answers it — and two allowlists that drifted apart would mean either a broken
image or a served file nobody meant to serve. `documentOf` is the third thing
markdown can point at, and the third reading of the same arithmetic: where a
relative `[…](…)` to another `.md` lands. A vault linking between its own files
writes those by the dozen, and resolving one beside the file it was WRITTEN in
is what keeps it from being resolved against whatever page it is being drawn on
— which is the same reason `doc` is resolved against the outline that named it.
Whether the directory actually holds the answer is nobody's business here: this
package knows the arithmetic, and the page that opens the address already has a
screen for a document that is not there.

## Two readings of a set, and what they differ by

`src/changes.ts` takes two sets of records and answers with what CHANGED, node
by node — created, archived, marked done, note rewritten. It is here for the
same reason the writer is: it is a statement about records, and it has no idea
where either side came from. That is what lets it serve two callers whose inputs
are nothing alike — what is pending is HEAD against the working tree, a past
change is a commit against its parent — with no git anywhere near this package.

It is never a text diff, and that is the format paying for itself in the other
direction: a `.jsonl` diff is one enormous line per node with everything on it
changing at once, which is exactly the shape that made line-based merges safe
and exactly the shape nobody can read. Matching is by ID ACROSS FILES, so
archiving reads as one change to one node rather than as a removal and an
unrelated arrival.

`src/committing.ts` is the values that answer travels in — what is waiting,
what was last recorded, what git is doing for the directory (`GitState`, with
its before-first-frame `GIT_OFF`), whether the repository can take a commit,
what asking for one answers with. Git plumbing is `@olai/ops`'s, and so is everything that
never crosses the wire: how olai spells a commit message, and the values of the
`--commit` flag. What is here is exactly what `@olai/surface` imports, which is
why it is here at all — this package is the floor both that layer and the wire
spec stand on, as the refusal vocabulary already is. Design:
[docs/brainstorming/git-commits.md](../../docs/brainstorming/git-commits.md).

## What a search asks, and what one hit says

`src/searching.ts` is the same argument applied to the other vocabulary that
crosses this floor: `SearchRequest`, `Found`, `SearchHit`, `SearchAnswer`. The
matcher is `@olai/ops`' (`Query.search`) and stays there; what is here is only
the SHAPE, because that shape travels four ways at once — an agent reads it off
`search_nodes`, the `search.nodes` procedure carries it, the ⌘K palette draws it,
and the header's search box draws it again.

It was spelled twice before — three times counting `Query.search`'s own
parameter — once in each of the two packages that stand on this floor, and
`@olai/surface`'s header claimed the two could not drift. They could: a field
added to the ops-side hit and produced type-checked clean across every package,
reached the agent, and was dropped by the wire schema's encoder on the way to a
browser. One declaration is why that is now unrepresentable rather than merely
detected — see
[docs/brainstorming/surface-mcp-positions.md](../../docs/brainstorming/surface-mcp-positions.md).

Every field of a hit is a statement about records in this package's own terms:
an id, a title, a `file:line`, a mark, the ancestor titles `ancestorsOf` walks,
the edge lists a record carries. The two that are not — `matched`, which field
carried the words, and the `refusals` an unreadable query answers with — are
facts about a QUERY, and they sit on the hit and the answer rather than on
`Found` for exactly that reason. `Refusal` itself is declared next door in
`src/filter.ts`, beside the `parseFilter` that produces it, and is a Schema
rather than an interface because it does not stay there: the filter over the
tree draws its own, and the three doors that ask the server get theirs on the
answer.

**The filter grammar is what the single declaration was for, and it proved it
one day later.** #168 extended search with `file`, `under`, an optional
`matched` and `refusals` — four fields the previous arrangement would have
needed spelled twice and kept in step by hand, in two packages that cannot
import each other. Seated here instead, they are spelled once: removing
`refusals` from this file fails in `@olai/ops` (which produces them),
`@olai/web` (which draws them) and `@olai/server` at the same moment, where
before it would have failed on one side and compiled on the other.

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

It also gives "absent" ONE spelling. An optional field holding nothing —
`undefined`, `null`, `[]` or `""` — is not written, so `{"after":[]}` cannot
reach a file however a writer arrived at it. That is the same bet as the line
format itself: two files that mean the same thing must not differ byte for
byte, or a line-based git merge conflicts over nothing. A *required* field is
written whatever it holds, because dropping one makes a line the reader rejects
outright — worse than handing an odd value to the validator that is about to
see it anyway.

`ordBetween` is a fractional index over base62 in ASCII order, so the plain
string comparison the format promises IS numeric order in this encoding. It
answers `null` for the one pair with no answer — nothing sorts between `x` and
`x0` — rather than inventing a key in the wrong place; the ops layer renumbers
that row instead.

`src/failure.ts` is the other half of the error story: the four KINDS a write
refuses with (`usage`, `not-found`, `validation`, `busy`), as schemas, so a
refusal travels the wire and an MCP tool result as itself. Four classes rather
than one with a `kind` string because they carry different things — only
`validation` has a report to show, only `not-found` names what was missed — and
a single struct would make every field optional and push "which fields are
meaningful" back into prose. There were five: `derived` refused a write that
would have stored a computed status, and went with derivation itself.
