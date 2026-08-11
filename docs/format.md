# The outline format

One `.jsonl` file per outline. One JSON object per line; one line per node. Every `.jsonl` file under the served directory is an independent tree: no cross-file parents. Cross-file relations are mirrors and edges, by bare id.

```jsonl
{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}
```

## Two record shapes

A line is a **regular node** or a **mirror**, and which one it is decided by whether it carries `mirror`. They are two shapes, not one shape with optional fields: a mirror is a second *placement* of a node that already exists, so any field describing the node itself has an authoritative copy at the target, and a second copy here could only ever disagree with it.

A mirror is exactly `{"id", "parent"?, "ord", "mirror"}`. Any other field on it is an error.

## Fields

In canonical order (writes always re-serialize the whole record in this order; absent fields are omitted, never `null` or `[]`). **Required** means the record is rejected without it.

| field | required | meaning |
|---|---|---|
| `id` | both shapes | Stable identity: a chosen slug (`[A-Za-z0-9_-]+`) or a minted short string. Unique across the whole loaded set; survives renames and moves. |
| `parent` | no | Parent id, same file. Absent at top level. |
| `ord` | both shapes | Sibling order: a fractional-index string over base62 (`0-9A-Za-z`). Plain string comparison is the sort; never a float. |
| `title` | regular nodes | Verbatim text. Inline `#tags` live here and are extracted at view time. |
| `done` / `doing` / `todo` | no | The three MARKS: `true` or an ISO date/datetime string. At most ONE of the three — they are three answers to one question. Storable on ANY node, children or not. A node carrying none of them is not a task at all — see [Status](#status). |
| `date` | no | ISO date/datetime. A node with a `date` is a day/scheduled node; the journal, calendar and today views are derived from dates at view time — there is no stored year/month hierarchy. |
| `desc` | no | The note: one string, embedded newlines. Markdown, rendered only at view time; stored verbatim. |
| `doc` | no | Relative path to an attached `.md` document, resolved against the directory of the outline that names it. |
| `after` / `blocks` / `see` | no | Arrays of target ids (any file in the set). Closed set of relations. `blocks` is sugar: `a blocks b` means `b after a`. `after` (with normalized `blocks`) must stay acyclic, and is what a node being **blocked** is derived from ([Status](#status)); `see` is a free cross-reference. |
| `mirror` | mirrors | Makes this record a mirror: it shows the node with that id at a second location. The target may live in any file of the set, and may itself be a mirror — the chain is followed to the regular node at its end. |

There are no include records; the served directory is the only composition mechanism.

## Status

A node is either **marked** or it is not, and one that is not has **no status at all**. There are three marks — `done`, `doing`, `todo` — and a node carries at most one of them. There is no fourth value for "unmarked", and in particular no `open`.

The distinction that whole design turns on is between a **mark** and a **default**. `open` was a default: status derived as done → doing → *otherwise open*, so `open` was simply what a node got for carrying nothing. That made every node a task, and left one value answering two different questions — "a task nobody has started" and "not a task at all". Nothing had ever argued for it; the only outline olai served was its own roadmap, which really is all tasks, so "everything is open" never looked wrong. A corpus of notes is where it shows: every paragraph in it renders as an unfinished to-do, and a search for what is unfinished matches the whole file.

`todo` answers the first of those two questions and answers nothing else, because **someone has to put it there**. That is what makes it a mark rather than the residual coming back: a bullet stays a bullet unless it is marked, and the model forbids a default rather than a third face. Dropping `open` and dropping the *concept* of unstarted work were two changes, and only the first one was the fix — the gap showed the moment someone wanted to say "this is work I have not started" and had nothing to say it with.

**A node's status is the mark it stores, and nothing else.** Leaf or parent, it says what it says; a node with children is marked exactly like one without. `read this book` can be ticked with three notes hanging off it.

That is a change (resolved 2026-08-11), and the thing it deleted was **derivation**: a parent used to take its status from the children that were tasks — all done → done, all `todo` → todo, anything else → doing — and was forbidden from storing one of its own. It went for the reason `open` went. Derivation reads outline containment (notes under an item) as task decomposition (subtasks), and it makes every parent-of-tasks a task **by structure**, which is exactly the default this model exists to refuse: *a node is a task because someone said so, never because of where it sits*. The two failures it produced were one bug: a parent whose finished children were its only tasks derived `done`, so the done toggle hid the branch with unmarked findings inside it — and the obvious escape, marking the branch, was the one thing the rule forbade.

What follows from the marks on disk:

- **An unmarked node is not an unfinished one.** It is a bullet: nothing to finish, nothing outstanding, and nothing that makes anything else a task.
- **A mark on a parent is a claim about the branch**, not a summary of it. `done` on a node whose children are half open is a person saying "this is finished, and what is left under it is not happening" — which is a thing people mean. Nothing recomputes it behind them.
- **Rollup survives as DISPLAY.** A node with task children may show how far they have got — `3/5`, beside the title, never in the checkbox. It is an annotation: it decides nothing, hides nothing, blocks nothing, and a node with no tasks under it shows none rather than `0/0`. Mirrors are not counted, for the reason they never were — a mirror is a second view of a node, not a second obligation.
- **Hiding what is done means what it says.** A row whose node STORES `done` is not drawn, and its subtree goes with it. The sweep is honouring a claim somebody made rather than inferring one: a parent nobody marked is never hidden, however finished the things under it are, so the findings under it stay on screen. That is the whole of `hide-done-scope`.
- **A checkbox is drawn for a mark, not for a node.** Done is a checked box, doing a half-filled one, `todo` an **empty** one — and an unmarked node gets no box at all, only the blank that keeps the titles in a column. Those last two are the pair worth keeping apart: an empty box on every row is the claim that every paragraph is an unfinished to-do, and an empty box on a `todo` is someone saying so about one node. The absence of a box is an answer, not a missing one.

**Nudges are policy, and they are the writer's, not the format's.** When a mark lands the ops layer may say what the rollup noticed — a branch ticked over tasks that are still open, or the last open task under a parent going done, which is the moment to consider ticking the parent. It travels on the answer to a write that HAPPENED, in a field of its own, so nobody has to read it out of the agent's prose. Nothing here is ever a load invariant: a set that arrives from a git merge has nobody to nudge, and a file that will not load is a worse answer to "these two disagree" than a file that loads and says so.

**Merge safety is better for it.** Marks merge line-wise, and there is no longer a cross-line invariant a clean textual merge can break. The one that existed did break: mark a leaf in one branch, add a task child under it in another, and git merges both edits cleanly into a set nothing will load.

**Blocked** is the same kind of answer, computed from the edges and the marks together and stored nowhere: `a after b` means `b` blocks `a` while `b` is a task that is not done — with the three marks there are, while `b` is `doing` **or** `todo`, read off `b`'s own record. A target with no status **never blocks**: it is not a task, there is nothing to finish, so there is nothing to wait for — and to block on a branch, mark the branch. The trap the rule is written against is spelling it `status !== "done"`, which reads every plain bullet as an obstacle that can never be cleared.

That is ONE predicate and it is read at BOTH ends of the arrow, which is the racket reference's own shape: "a node this can be said about" and "a node that still stands in the way" are the same question asked from either side, and two spellings of it would be two chances to disagree about what unfinished work is. So a `done` node is waiting on nothing whatever it is after — it has happened, and the order it happened in is no longer a question — and an unmarked node is neither blocked nor blocking, because a bullet is not work. **Archived** work is exempt at both ends for the same reason from the other side: a subtree put away in an `Archive.jsonl` is over, so nothing waits on it (a live node that did would wait forever) and nothing tells it that it cannot start.

The exemptions stop at the validator: `after` must stay **acyclic** whatever the marks say and wherever the nodes live, because a loop is a claim about the file rather than about what is on anyone's plate. Both rules read one graph — `blocks` normalised into `after`, with each edge filed under the node its target NAMES, so an edge written at a mirror and an edge written at the node it stands for are one edge. A deadlock that closes through a placement is a deadlock.

Being blocked is a SECOND fact about a node, never a replacement for the first: a blocked task keeps the mark it carries and the date it is due on. A view is free to draw the two together — olai answers both in one column, since "has this started" and "can it start" are the same kind of question about the same node — but nothing may make a node's mark depend on what it is waiting for.

## Documents

A `.md` file under the served directory is a **document**, and documents are part of the loaded set — path and text — for the same reason the nodes are: `doc` points into them, so a reference the validator cannot see is one it cannot check, and a reader that had to fetch a document separately would be reading a different moment of the directory than the outline it came from.

- A document's text is **content, like `desc`**: stored verbatim, interpreted as markdown only at view time. Nothing about it is validated; a `.md` cannot make a set invalid.
- `doc` **attaches** one to a node, relative to the outline that names it — a node names a file beside itself, not beside whoever is reading it. The rule is one function (`docOf`), read by the validator and by the view.
- A document may point at **pictures** beside itself: a relative `![](art/shot.png)` resolves against the document's own directory (a note's resolves against its outline's) and is served from a route restricted to picture extensions. A `..` is clamped at the served directory rather than escaping it, and nothing else is drawn at all — no remote host, no `data:`, no absolute path, no `.svg`, since an SVG is a document that can script. Pictures are not part of the set: nothing loads them, and they exist only as the target of a relative link.

## Validation

One validator checks the loaded set — on load and after every write. Nothing is checked anywhere else.

It runs in two stages, and the staging is part of the contract:

1. **Per line.** Everything a single record answers on its own: JSON, the record shape (required fields present, no unknown field, a mirror carrying nothing but its four), the id's spelling, ISO dates, and the `done`/`doing` exclusion.
2. **Per set.** Everything that needs to know what else exists: uniqueness, references, cycles, documents.

A file is decoded whole or not at all. The set-wide rules then run over the outlines that did parse, and one that did not costs **that outline and nothing else**: if the survivors are clean, the set loads with the broken file's errors carried inside it, shown in that outline's place while the rest stay live. If anything else is wrong, the set is refused and the parse errors are reported alongside it.

Guesses are still not reported. "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse, so an unresolved `mirror`/`after`/`blocks`/`see` target is withheld while any outline is unreadable — and withholding one is itself a reason to refuse the set rather than serve nodes whose targets cannot be resolved. Nothing else can be invented by an unreadable file: `parent` may not cross files, so an unresolved one is refused whichever file the id was going to be in, and a duplicate or a cycle can only be *hidden* by a missing file. A report containing any per-line error says so, and a second round is expected after fixing the first.

The rules:

- ids: valid shape, unique across the whole set. The duplicate is reported on the *second* record, pointing at the first, which stays the one every reference resolves to.
- References resolve: `parent` (same file, must be a regular node, no cycles), `mirror` targets, `after`/`blocks`/`see` targets (any file). Unknown targets get a did-you-mean suggestion.
- `after` is acyclic (counting normalized `blocks`); mirror placement may not create a containment cycle — a mirror inside the subtree it shows would expand forever.
- Dates (the marks and `date`) are valid ISO; the three marks are mutually exclusive, and a record carrying two is refused whichever two they are. Validated as text, because a writer must reproduce what it read: a date-only `2026-08-10` round-tripped through an instant would come back a datetime.
- `doc` resolves, against the naming outline's own directory, to an `.md` file that is actually served.

There is deliberately **no rule about a mark and the children under it**. There was one — no stored derived state, which refused any mark on a node with children — and it existed only to keep a computed status and a written one from contradicting each other. Nothing computes one now, so it has nothing to defend: it dissolved with derivation rather than needing an exception ([Status](#status)). What replaced it is a write-time nudge, which is the ops layer's policy and never a reason a set fails to load.

## Errors

Every error names its location: `file:line` of the bad record (one node per line — the line is the whole story). Errors carry a kind — `usage`, `validation`, `not-found`, `busy` — surfaced as MCP tool errors and HTTP codes, with structured detail (e.g. a `validation` refusal carries the validator's own rows as data, not prose). There were five: `derived` refused a write that would have stored a computed status, and went when derivation did.

## Writing

The server is the only writer; git merges are the only edits that bypass it, and validation on load catches those. A write goes: re-validate the whole edited set → same-directory temp file(s) → atomic rename (all files or none) → commit. Validation comes FIRST, over the set the write would produce, so a refused write costs nothing on disk: the bytes are under names nothing reads, or they were never written at all.

Writers emit canonical field order, literal UTF-8 (no `\uXXXX` escaping beyond JSON's structural escapes), no blank lines, exactly one trailing newline. Readers tolerate blank lines.

**There is one writer, and callers do not assemble bytes.** A writer is handed the records of a whole file and hands back the whole file, so every separator — the newline between two records, the one at the end, the absence of a blank line — has exactly one owner. That is not tidiness: a caller that built its own bytes once produced two records glued onto one line, out of a write that every layer above believed had succeeded, and the file that came out was one no reader could parse. The shape is what makes it unrepresentable, and there is a test that says so.

**Absent has one spelling, and the writer is what enforces it.** An optional field holding nothing — `undefined`, `null`, `[]` or `""` — is not written, so `{"after":[]}` cannot reach a file however a writer arrived at it. Two files that mean the same thing must not differ byte for byte: the format's whole bet is that a line-based git merge is safe, and a conflict over `after: []` against no `after` is a conflict about nothing. A REQUIRED field is written whatever it holds, and the asymmetry is deliberate — dropping one produces a line the reader rejects outright, which is worse than handing an odd value to the validator that is about to see it anyway.

**A record is one line by construction**, not by care: a `desc`'s embedded newlines are escaped by JSON itself, which is the whole reason the format is JSONL rather than indented JSON.

**Sibling order is an insert, not a renumbering.** `ord` is a fractional index over base62, so a node placed between two neighbours mints a key that sorts between them and touches neither — a one-line diff, which is what keeps line-based git merges worth having. The one case with no answer is arithmetic rather than a gap: nothing sorts between `x` and `x0`, because every string above `x` begins with `x` and the least of those IS `x0`. The writer renumbers that row rather than guessing.

Because each node is one line with a stable id, plain line-based git merges are safe; a merge driver keyed by node id can be added later if concurrent-edit conflicts become painful.

## Relation to the Racket reference (PR #54 on `master-racket`)

PR #54 is the working reference implementation of this format — read it, don't extend it. Three of its features are deliberately **not** part of the new format: `include` records (glob or literal), the stored year→month journal scaffolding with day-titled nodes (replaced by the `date` field), and `.scrbl` docs.
