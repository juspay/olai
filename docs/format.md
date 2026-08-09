# The outline format

One `.jsonl` file per outline. One JSON object per line; one line per node. Every `.jsonl` file under the served directory is an independent tree: no cross-file parents. Cross-file relations are mirrors and edges, by bare id.

```jsonl
{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}
```

## Fields

In canonical order (writes always re-serialize the whole record in this order; absent fields are omitted, never `null` or `[]`):

| field | meaning |
|---|---|
| `id` | Stable identity: a chosen slug (`[A-Za-z0-9_-]+`) or a minted short string. Unique across the whole loaded set; survives renames and moves. |
| `parent` | Parent id, same file. Absent at top level. |
| `ord` | Sibling order: a fractional-index string over base62 (`0-9A-Za-z`). Plain string comparison is the sort; never a float. |
| `title` | Verbatim text. Inline `#tags` live here and are extracted at view time. |
| `done` / `doing` | `true` or an ISO date/datetime string. At most one of the two. Never stored when derivable (see below). |
| `date` | ISO date/datetime. A node with a `date` is a day/scheduled node; the journal, calendar and today views are derived from dates at view time — there is no stored year/month hierarchy. |
| `desc` | The note: one string, embedded newlines. Markdown, rendered only at view time; stored verbatim. |
| `doc` | Relative path to an attached `.md` document. |
| `after` / `blocks` / `see` | Arrays of target ids (any file in the set). Closed set of relations. `blocks` is sugar: `a blocks b` means `b after a`. `after` (with normalized `blocks`) must stay acyclic; `see` is a free cross-reference. |
| `mirror` | Makes this record a mirror node: `{"id","parent","ord","mirror":"<target id>"}` shows an existing node at a second location. No other fields allowed. |

There are no include records; the served directory is the only composition mechanism.

## Validation

One validator checks the loaded set — on load and after every write. Nothing is checked anywhere else. Rules:

- ids: valid shape, unique across the whole set.
- References resolve: `parent` (same file, must be a regular node, no cycles), `mirror` targets, `after`/`blocks`/`see` targets (any file). Unknown targets get a did-you-mean suggestion.
- `after` is acyclic (counting normalized `blocks`); mirror placement may not create a containment cycle.
- Dates (`done`, `doing`, `date`) are valid ISO; `done` and `doing` are mutually exclusive.
- `doc` is a relative path to an existing `.md` file.
- No stored derived state: a parent's status is computed from its children (all done → done; any activity → doing; else open; mirrors don't count). Storing `done` on a node with unfinished children is a load error, and marking a node whose status is derived is a refused write that lists the unfinished children.

## Errors

Every error names its location: `file:line` of the bad record (one node per line — the line is the whole story). Errors carry a kind — `usage`, `validation`, `not-found`, `derived`, `busy` — surfaced as MCP tool errors and HTTP codes, with structured detail (e.g. the `derived` refusal includes the list of unfinished children as data, not prose).

## Writing

The server is the only writer; git merges are the only edits that bypass it, and validation on load catches those. A write goes: same-directory temp file(s) → re-validate the whole edited set → atomic rename (all files or none) → commit.

Writers emit canonical field order, literal UTF-8 (no `\uXXXX` escaping beyond JSON's structural escapes), no blank lines, exactly one trailing newline. Readers tolerate blank lines.

Because each node is one line with a stable id, plain line-based git merges are safe; a merge driver keyed by node id can be added later if concurrent-edit conflicts become painful.

## Relation to the Racket reference (PR #54 on `master-racket`)

PR #54 is the working reference implementation of this format — read it, don't extend it. Three of its features are deliberately **not** part of the new format: `include` records (glob or literal), the stored year→month journal scaffolding with day-titled nodes (replaced by the `date` field), and `.scrbl` docs.
