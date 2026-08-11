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
| `done` / `doing` / `todo` | no | The three MARKS: `true` or an ISO date/datetime string. At most ONE of the three — they are three answers to one question. Never stored on a node with children (see below). A node carrying none of them is not a task at all — see [Status](#status). |
| `date` | no | ISO date/datetime. A node with a `date` is a day/scheduled node; the journal, calendar and today views are derived from dates at view time — there is no stored year/month hierarchy. |
| `desc` | no | The note: one string, embedded newlines. Markdown, rendered only at view time; stored verbatim. |
| `doc` | no | Relative path to an attached `.md` document, resolved against the directory of the outline that names it. |
| `after` / `blocks` / `see` | no | Arrays of target ids (any file in the set). Closed set of relations. `blocks` is sugar: `a blocks b` means `b after a`. `after` (with normalized `blocks`) must stay acyclic; `see` is a free cross-reference. |
| `mirror` | mirrors | Makes this record a mirror: it shows the node with that id at a second location. The target may live in any file of the set, and may itself be a mirror — the chain is followed to the regular node at its end. |

There are no include records; the served directory is the only composition mechanism.

## Status

A node is either **marked** or it is not, and one that is not has **no status at all**. There are three marks — `done`, `doing`, `todo` — and a node carries at most one of them. There is no fourth value for "unmarked", and in particular no `open`.

The distinction that whole design turns on is between a **mark** and a **default**. `open` was a default: status derived as done → doing → *otherwise open*, so `open` was simply what a node got for carrying nothing. That made every node a task, and left one value answering two different questions — "a task nobody has started" and "not a task at all". Nothing had ever argued for it; the only outline olai served was its own roadmap, which really is all tasks, so "everything is open" never looked wrong. A corpus of notes is where it shows: every paragraph in it renders as an unfinished to-do, and a search for what is unfinished matches the whole file.

`todo` answers the first of those two questions and answers nothing else, because **someone has to put it there**. That is what makes it a mark rather than the residual coming back: a bullet stays a bullet unless it is marked, and the model forbids a default rather than a third face. Dropping `open` and dropping the *concept* of unstarted work were two changes, and only the first one was the fix — the gap showed the moment someone wanted to say "this is work I have not started" and had nothing to say it with.

What follows, and all of it is computed at view time from the marks on disk:

- **A leaf is what it stores** — `done`, `doing`, `todo`, or nothing.
- **A parent counts only the children that are tasks**: the ones with a status of their own. Every one of them done → **done**; every one of them `todo` → **todo**; anything else → **doing**. Mirrors do not count as children at all, for the reason they never did — a mirror is a second view of a node, not a second obligation.
- **A parent whose task children have all been declared and none started is `todo`**, not `doing` and not nothing. It is a real answer rather than a fallthrough: those children ARE tasks, so their parent is one, and a parent reading `doing` there would be claiming progress nobody has made. The mixed cases are the other way round — some finished and some not started is a thing under way, because work has been done under it.
- **An unmarked child is not an unfinished one**, so it neither holds a parent back nor makes one a task. A `todo` child does both: it is a task, and it is not done.
- **A parent whose counted children include no task has no status either**, exactly like an unmarked leaf. A subtree of bullets adds up to a bullet. It is not open, and it is not done-because-nothing-is-outstanding: there is nothing under it to finish.
- **A node with children still may not store a mark** (the rule below), so a bullet with children becomes a task by having a task under it and in no other way. That is a real limitation — you cannot tick `read this book` while three notes hang off it — and it is the price of the no-stored-derived-state rule rather than a statement about tasks: the moment one of those children were marked, a mark on the parent would be a second copy of a computed value, and a git merge is all it takes to make two copies disagree. Loosening it is a separate decision and it has not been taken.
- **Hiding what is done is where the third mark earns its place.** A done node takes its whole subtree with it, bullets included — a bullet under finished work is a note about it rather than something outstanding, and that case is intended. What was NOT intended is the other one it used to be indistinguishable from: with only two marks, unstarted work could only be an unmarked node, so a parent whose finished children were its only tasks derived `done` and the toggle hid the branch *with the unstarted work inside it*. The view whose whole purpose is showing what is left hid exactly what was left. A `todo` child is an unfinished task, so its parent reads `doing` and stays on screen — the difference between "nothing here is outstanding" and "nobody has called this work" is now in the file, where the toggle can read it.
- **A checkbox is drawn for a mark, not for a node.** Done is a checked box, doing a half-filled one, `todo` an **empty** one — and an unmarked node gets no box at all, only the blank that keeps the titles in a column. Those last two are the pair worth keeping apart: an empty box on every row is the claim that every paragraph is an unfinished to-do, and an empty box on a `todo` is someone saying so about one node. The absence of a box is an answer, not a missing one.

**Blocked** has not shipped (the `edges-ui` item), and this is written here so that it inherits the rule rather than deciding it again: `a after b` means `b` blocks `a` while `b` is a task that is not done — with the three marks there are, while `b` is `doing` **or** `todo`. A target with no status **never blocks**: it is not a task, there is nothing to finish, so there is nothing to wait for. The trap the rule is written against is spelling it `status !== "done"`, which reads every plain bullet as an obstacle that can never be cleared — and note that adding `todo` did not narrow that trap by one case, since the unmarked node is still the one that must not block.

## Documents

A `.md` file under the served directory is a **document**, and documents are part of the loaded set — path and text — for the same reason the nodes are: `doc` points into them, so a reference the validator cannot see is one it cannot check, and a reader that had to fetch a document separately would be reading a different moment of the directory than the outline it came from.

- A document's text is **content, like `desc`**: stored verbatim, interpreted as markdown only at view time. Nothing about it is validated; a `.md` cannot make a set invalid.
- `doc` **attaches** one to a node, relative to the outline that names it — a node names a file beside itself, not beside whoever is reading it. The rule is one function (`docOf`), read by the validator and by the view.
- A document may point at **pictures** beside itself: a relative `![](art/shot.png)` resolves against the document's own directory (a note's resolves against its outline's) and is served from a route restricted to picture extensions. A `..` is clamped at the served directory rather than escaping it, and nothing else is drawn at all — no remote host, no `data:`, no absolute path, no `.svg`, since an SVG is a document that can script. Pictures are not part of the set: nothing loads them, and they exist only as the target of a relative link.

## Validation

One validator checks the loaded set — on load and after every write. Nothing is checked anywhere else.

It runs in two stages, and the staging is part of the contract:

1. **Per line.** Everything a single record answers on its own: JSON, the record shape (required fields present, no unknown field, a mirror carrying nothing but its four), the id's spelling, ISO dates, and the `done`/`doing` exclusion.
2. **Per set.** Everything that needs to know what else exists: uniqueness, references, cycles, documents, derived state.

A file is decoded whole or not at all. The set-wide rules then run over the outlines that did parse, and one that did not costs **that outline and nothing else**: if the survivors are clean, the set loads with the broken file's errors carried inside it, shown in that outline's place while the rest stay live. If anything else is wrong, the set is refused and the parse errors are reported alongside it.

Guesses are still not reported. "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse, so an unresolved `mirror`/`after`/`blocks`/`see` target is withheld while any outline is unreadable — and withholding one is itself a reason to refuse the set rather than serve nodes whose targets cannot be resolved. Nothing else can be invented by an unreadable file: `parent` may not cross files, so an unresolved one is refused whichever file the id was going to be in, and a duplicate or a cycle can only be *hidden* by a missing file. A report containing any per-line error says so, and a second round is expected after fixing the first.

The rules:

- ids: valid shape, unique across the whole set. The duplicate is reported on the *second* record, pointing at the first, which stays the one every reference resolves to.
- References resolve: `parent` (same file, must be a regular node, no cycles), `mirror` targets, `after`/`blocks`/`see` targets (any file). Unknown targets get a did-you-mean suggestion.
- `after` is acyclic (counting normalized `blocks`); mirror placement may not create a containment cycle — a mirror inside the subtree it shows would expand forever.
- Dates (the marks and `date`) are valid ISO; the three marks are mutually exclusive, and a record carrying two is refused whichever two they are. Validated as text, because a writer must reproduce what it read: a date-only `2026-08-10` round-tripped through an instant would come back a datetime.
- `doc` resolves, against the naming outline's own directory, to an `.md` file that is actually served.
- **No stored derived state.** A parent's status is computed from the children that are tasks ([Status](#status)); mirrors do not count as children. So a node with counted children may not store any of the three marks **at all** — not merely when a child is unfinished, and not merely when a child is marked: a stored value that currently agrees with the computed one is still a second copy, and a git merge is all it takes to make the two disagree with nothing to notice. The load error says which of the three things the tree is already saying — a mark that is computed, a mark standing above unfinished children, or a node whose children are all bullets and which therefore derives nothing — and names the children in the way. Those are the unfinished TASKS, `doing` and `todo` alike, never the bullets. Marking such a node through the ops layer is a refused write carrying the same list.

## Errors

Every error names its location: `file:line` of the bad record (one node per line — the line is the whole story). Errors carry a kind — `usage`, `validation`, `not-found`, `derived`, `busy` — surfaced as MCP tool errors and HTTP codes, with structured detail (e.g. the `derived` refusal includes the list of unfinished children as data, not prose).

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
