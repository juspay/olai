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
| `done` / `doing` | no | `true` or an ISO date/datetime string. At most one of the two. Never stored on a node with children (see below). |
| `date` | no | ISO date/datetime. A node with a `date` is a day/scheduled node; the journal, calendar and today views are derived from dates at view time — there is no stored year/month hierarchy. |
| `desc` | no | The note: one string, embedded newlines. Markdown, rendered only at view time; stored verbatim. |
| `doc` | no | Relative path to an attached `.md` document, resolved against the directory of the outline that names it. |
| `after` / `blocks` / `see` | no | Arrays of target ids (any file in the set). Closed set of relations. `blocks` is sugar: `a blocks b` means `b after a`. `after` (with normalized `blocks`) must stay acyclic; `see` is a free cross-reference. |
| `mirror` | mirrors | Makes this record a mirror: it shows the node with that id at a second location. The target may live in any file of the set, and may itself be a mirror — the chain is followed to the regular node at its end. |

There are no include records; the served directory is the only composition mechanism.

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
- Dates (`done`, `doing`, `date`) are valid ISO; `done` and `doing` are mutually exclusive. Validated as text, because a writer must reproduce what it read: a date-only `2026-08-10` round-tripped through an instant would come back a datetime.
- `doc` resolves, against the naming outline's own directory, to an `.md` file that is actually served.
- **No stored derived state.** A parent's status is computed from its children — all done → done; anything under way, or some-but-not-all finished → doing; otherwise open; mirrors do not count as children. So a node with counted children may not store `done` or `doing` **at all**, not merely when a child is unfinished: a stored value that currently agrees with the computed one is still a second copy, and a git merge is all it takes to make the two disagree with nothing to notice. The load error names the children; marking such a node through the ops layer is a refused write that lists the unfinished ones.

## Errors

Every error names its location: `file:line` of the bad record (one node per line — the line is the whole story). Errors carry a kind — `usage`, `validation`, `not-found`, `derived`, `busy` — surfaced as MCP tool errors and HTTP codes, with structured detail (e.g. the `derived` refusal includes the list of unfinished children as data, not prose).

## Writing

The server is the only writer; git merges are the only edits that bypass it, and validation on load catches those. A write goes: same-directory temp file(s) → re-validate the whole edited set → atomic rename (all files or none) → commit.

Writers emit canonical field order, literal UTF-8 (no `\uXXXX` escaping beyond JSON's structural escapes), no blank lines, exactly one trailing newline. Readers tolerate blank lines.

Because each node is one line with a stable id, plain line-based git merges are safe; a merge driver keyed by node id can be added later if concurrent-edit conflicts become painful.

## Relation to the Racket reference (PR #54 on `master-racket`)

PR #54 is the working reference implementation of this format — read it, don't extend it. Three of its features are deliberately **not** part of the new format: `include` records (glob or literal), the stored year→month journal scaffolding with day-titled nodes (replaced by the `date` field), and `.scrbl` docs.
