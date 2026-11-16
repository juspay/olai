# Validation, errors and writing

One validator checks the loaded set, on load and after every write, and nothing is checked anywhere else.

## When the set is checked

The validator runs in two stages.

1. Per line: JSON, the record shape, the id's spelling, ISO dates, the mark exclusion, and the repeat rule with the date it repeats from.
2. Per set: uniqueness, references, cycles, documents, and the property values a key's declaration fences.

A finding costs only the files it is about,[^cost][^two] and a guess is withheld while any file is unreadable.[^withheld] A write that would not decode is refused.[^refused]

## The rules

- Ids have a valid shape and are unique across the whole set.[^ids]
- References resolve, in the same file for a `parent` and anywhere for an edge.[^targets]
- `after` is acyclic, and a mirror may not create a containment cycle.
- The marks and `date` are valid ISO, and the four marks are mutually exclusive.[^marks]
- A `repeat` is a rule the grammar holds, with a `date` under it to repeat from.
- Every property value fits what its key declares.[^declared]

## Error codes

Every error names a `file:line`, and the closed block below holds all nineteen codes.[^codes]

## Writing

The server is the only writer.[^merges] A write re-validates the whole edited set, writes temporary files beside the originals, renames them atomically, and commits.[^bytes] Validation comes first, so a refused write costs nothing on disk.[^races]

## File claims and convention names

Each outline row owns its suffix, its own parser and its canonical writer; the Olai row claims `.olai`.[^claims] Four stems under `_olai/` are conventions: `Trash`, `Inbox`, `Pins` and `Properties`.[^stems]

[^cost]: A file is decoded whole or not at all, and every finding costs the files it is about and nothing else. A file a finding names is published with its content withheld: it keeps its place in the sidebar, its own page shows its rows where its tree would be, and it refuses writes. Every other file in the directory is live, drawn and writable.

[^two]: A finding that names two files takes both, because "which file is broken" has no single answer for a duplicate id or a cross-file placement. The rules run over the whole set always, and only the answer is degraded.

    Withholding a file cannot invent a finding against a healthy neighbour: a `mirror` or a `see` from a live file into a withheld one resolves to the dangling face a reader already sees for an id nothing declares. The next load starts from the whole directory again and reaches the same verdict.

[^withheld]: A guess is withheld. "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse. So an unresolved `mirror`, `after`, `blocks` or `see` target is withheld while any outline is unreadable, and a withheld finding breaks nothing. A report containing any per-line error says so, and a second round is expected after you fix the first.

[^refused]: That absorption is about loading, and a write is refused instead: the write gate refuses any write whose own changed files will not decode. The refusal carries the validator's own rows, which are the code, the `file:line` and the message, so a rule has one wording however it was reached.

[^ids]: A duplicate id is reported on the second record, pointing at the first, which stays the one every reference resolves to. An id outside the mention alphabet is `bad-id`.

[^targets]: A `parent` resolves in the same file, to a regular node, with no cycles. A `mirror` target, and an `after`, `blocks` or `see` target, resolves in any file. An unknown target gets a did-you-mean, and `after` is read with `blocks` normalized into it.

[^marks]: Dates are validated as text, because a writer must reproduce what it read. There is no rule about a mark and the children under it: the write-time gates on `outlines_done` are the ops layer's policy and never a reason a set fails to load ([dates-and-status.md](dates-and-status.md)).

    A merge can write a mark in one branch and a task under it in another, so this format has to read that set, and the next write is what fixes it.

[^declared]: Every property value fits what its key declares, and every declaration in `_olai/Properties.olai` says a type the built-in table knows ([properties.md](properties.md)).

[^codes]: An error's location is the `file:line` of the record it is about, which is the record's first line. A `line` of `0` means the site is the path itself. Each code has an entry below with the message it carries, and what a refusal hands back as data is in a closed block of its own.

[^merges]: Git merges are the only edits that bypass the server, and validation on load catches those. Each node is one line with a stable id, so plain line-based git merges are safe ([git.md](git.md)).

[^bytes]: Validation runs over the set the write would produce, and the rename is all files or none. Writers emit canonical field order, literal `UTF-8` with no escaping beyond JSON's structural escapes, no blank lines, and exactly one trailing newline. Readers tolerate blank lines. The five rules a writer keeps are in the closed block at the foot of this page.

[^races]: A write that keeps losing races is refused after five attempts. When other writers move the directory, the refusal names the files and the revision span observed, so you can tell what is being rewritten. A refusal that instead blames the set of file kinds is a bug in olai's own revalidation; restarting the server clears it.

[^claims]: The directory's `format` setting names the row new outlines use, and that row's first registered suffix is what a mint writes ([settings.md](settings.md)). Existing files are selected by live claims rather than by that setting. An absent configured row refuses a mint, and an unclaimed address is a `notFound` answer rather than a decoding failure.

[^stems]: The four stems are case-insensitive and sit directly under `_olai/`, matched only among files whose claims hold nodes, so they work with any outline row's suffix. What each one holds, how a missing one is minted, and how relative links resolve are in the closed block at the foot of this page.

<details>
<summary>Every error code, and what it says</summary>

| Code | Stage | What it means |
| --- | --- | --- |
| [`not-json`](#not-json) | line | the line is not valid JSON |
| [`not-an-object`](#not-an-object) | line | the line parsed, but not into a JSON object |
| [`bad-record`](#bad-record) | line | a field has the wrong type, is unknown, or is missing |
| [`bad-id`](#bad-id) | line | `id` is outside the mention alphabet |
| [`several-marks`](#several-marks) | line | two marks on one record |
| [`bad-date`](#bad-date) | line | a mark or `date` is not valid ISO |
| [`bad-repeat`](#bad-repeat) | line | the rule is unreadable, or has no `date` under it |
| [`unreadable-file`](#unreadable-file) | line | one file would not open |
| [`duplicate-id`](#duplicate-id) | set | two records claim one `id` |
| [`ambiguous-convention`](#ambiguous-convention) | set | two files name one convention |
| [`unknown-parent`](#unknown-parent) | set | `parent` names an id nothing declares |
| [`foreign-parent`](#foreign-parent) | set | `parent` resolves in another file |
| [`parent-not-a-node`](#parent-not-a-node) | set | `parent` resolves to a mirror |
| [`parent-cycle`](#parent-cycle) | set | `parent` pointers close a loop |
| [`unknown-target`](#unknown-target) | set | an edge or `mirror` names an unknown id |
| [`after-cycle`](#after-cycle) | set | `after` closes a loop |
| [`mirror-cycle`](#mirror-cycle) | set | a mirror is inside the subtree it shows |
| [`bad-prop`](#bad-prop) | set | a value, or a declaration, does not fit |
| [`unreadable-directory`](#unreadable-directory) | set | the directory would not be read |

### `not-json`

The line is not valid JSON, and the message carries the parser's own sentence.

```
this line is not JSON: Unexpected end of JSON input
```

### `not-an-object`

The line parsed into something that is not a record. Saying which beats "expected object" for the paste-a-JSON-array mistake.

```
every line is one node, written as a JSON object; this line is an array
```

### `bad-record`

The object is not a well-formed record: a field has the wrong type, an unknown field is present, or a required one is missing. One finding per field.

```
`title` is required and missing
`titel` is not a field of this format
```

### `bad-id`

```
`the kitchen` is not a usable id: an id is written in the mention alphabet — letters, digits, `_`, `-` and `/` — so it can be named by `@` in a title or a note
```

### `several-marks`

```
a node carries one mark or none — this one has `done` and `todo`; drop whichever is stale
```

### `bad-date`

One code for five fields: the four marks and `date`, plus `created` and `changed`.

```
`date` is `10/08/2026`, which is not an ISO date (`2026-08-10`) or datetime (`2026-08-10T14:30:00Z`)
```

`started` asks for more, because a span is subtracted from it:

```
`started` is `2026-08-10`, which is not an ISO datetime (`2026-08-10T14:30:00Z`) — a span gets subtracted from it, so a day-only value will not do (and `date` is the field that means one)
```

### `bad-repeat`

One code for the two ways one line can be wrong, and the message says which.

```
`repeat` is `every fortnight`, which is not a repeat rule: write `every day`, `every week on <weekday>`, `every month` or `every year`
`repeat` is `every week on monday`, but this node has no `date` to repeat from — a rule says how often, and the date says when the next one is
```

### `unreadable-file`

A file in the directory will not open. It is a hole the rest of the set is drawn around: the sidebar still lists the file, its own page says so, and nobody else's page moves.

```
EACCES: permission denied, open 'house.olai' — this file is in the directory and will not open.
```

A write to a path no active row claims is refused the same way: `` No active row claims house.txt, so it cannot be written. ``

### `duplicate-id`

```
`kitchen` is already the id of another node; ids are unique across every file in the served directory
```

### `ambiguous-convention`

More than one node-holding file names the same directory convention, and neither silently wins.

```
Pins is ambiguous: _olai/Pins.olai, _olai/pins.olai. Keep only one convention file.
```

### `unknown-parent`

```
`parent` is `kitchn`, which no node declares — did you mean `kitchen`?
```

### `foreign-parent`

```
`parent` is `kitchen`, which lives in another file; every `.olai` is an independent tree, so cross-file placement is a `mirror`
```

It names the parent's site as a pointer and not as a second fault: the file that declares the parent is not broken by it.

### `parent-not-a-node`

```
`parent` is `kitchen`, which is a mirror; children hang off the node a mirror points at, never off the mirror
```

### `parent-cycle`

```
`parent` pointers close a loop, so this node is its own ancestor: `a` → `b` → `a`
```

### `unknown-target`

A `mirror`, `after`, `blocks` or `see` target names an unknown id. It is the one code an unreadable file can invent, so it is withheld while any file has not parsed.

```
`after` names `dem`, which no node declares — did you mean `demo`?
```

### `after-cycle`

```
`after` (with `blocks` normalised into it) closes a loop, so nothing in it can start first: `a` → `b` → `a`
```

### `mirror-cycle`

```
this mirror is placed inside the subtree it shows, so expanding it never ends: `a` → `b` → `a`
```

### `bad-prop`

A property does not fit what its key declares, or a declaration says a type this format does not know ([properties.md](properties.md)). The finding names the key, and names the declaration that judged the value as a site that is pointed at rather than broken.

```
`records` is a whole number — got "about 190". Digits alone: no sign, no leading zeros, no separators, and nothing after them.
`type` is `took`, which is not a property type — write `text` (anything), `date` (an ISO day or instant), `int` (a digit run), `path` (no whitespace; optional `base`), `doc` (a served `.md`; optional `base`), `ref` (a child's id; `under` names the parent), `node` (any node id).
```

A `ref` or a `node` value resolves a bare id across files, so that finding is withheld while any file is unreadable. The other five types resolve nothing, so an `int` holding prose is reported whatever else failed to parse.

### `unreadable-directory`

The directory itself would not be read: a permission on a folder, a mount that went away, a disk with no room to answer a stat. It is the one code that means what is on screen is from before.

```
EACCES: permission denied, scandir '/home/alice/notes' — the outline below is the last one that loaded, and it will catch up on its own once the directory can be read again.
```

</details>

<details>
<summary>What a refusal carries</summary>

Errors carry a kind, one of `usage`, `validation`, `not-found` or `busy`, surfaced as MCP tool errors and HTTP codes with structured detail: a `validation` refusal carries the validator's own verdict as data rather than prose. A load does not refuse at all, so the same rows reach a reader on the files they broke, one entry per broken file.

| In the verdict | What it answers |
| --- | --- |
| implicated | which files a finding is about: where it was found, plus every place it names |
| broken | which files a finding breaks: where it was found, plus every related site that did not say otherwise |
| `blamed(report)` | which files a report breaks, as the per-file entries the set carries |
| `admits(broken, files)` | is anything wrong with these files, and what |
| `stopping(set, files, standing)` | the write gate's question: `admits`, asked over a longer list |
| `summaryOf(broken, n)` | a bounded per-file face: the path, one word, and a row count |

A site that names a second file without blaming it says so, and there are two shapes of that. The ground a judgement stands on is one, where a `bad-prop` names the declaration that judged the value. The thing a broken record reached at is the other, where a `foreign-parent` names the file the parent lives in. Everything else shares the fault, so two files claiming one id are two files nobody can draw the second of.

The summary cannot carry a row, so no surface drawing it floods a page with somebody else's errors. A broken outline's own pane draws the rows.

</details>

<details>
<summary>The rules a writer keeps</summary>

- There is one writer, and callers do not assemble bytes. A writer is handed the records of a whole file and hands back the whole file, so every separator has exactly one owner.
- Absent has one spelling. An optional field holding `undefined`, `null`, `[]` or `""` is not written, so `{"after":[]}` cannot reach a file. Two files that mean the same thing must not differ byte for byte, because a conflict over `after: []` against no `after` is a conflict about nothing.
- A required field is written whatever it holds. Dropping one produces a line the reader rejects outright, which is worse than handing an odd value to the validator that is about to see it.
- A record is one line by construction: a note's embedded newlines are escaped by JSON itself, which is why the format is JSON lines rather than indented JSON.
- Sibling order is an insert, not a renumbering. `ord` is a fractional index over base62, so a node placed between two neighbours mints a key that sorts between them and touches neither. Nothing sorts between `x` and `x0`, and the writer renumbers that row rather than guessing.

</details>

<details>
<summary>The four convention stems, and how addresses resolve</summary>

### The four convention stems

`Trash`, `Inbox`, `Pins` and `Properties` are case-insensitive stems directly under `_olai/`, matched only among files whose claims hold nodes, so they work with any outline row's suffix.

| Convention | What it holds |
| --- | --- |
| `Trash` | archived nodes and their return scaffolds ([organising.md](organising.md)) |
| `Inbox` | untargeted captures ([getting-around.md](getting-around.md)) |
| `Pins` | the saved shelf ([documents-and-kinds.md](documents-and-kinds.md)) |
| `Properties` | the property declarations ([properties.md](properties.md)) |

A missing convention is minted with the configured outline row's first suffix, into `_olai/`. An underscore rather than a dot keeps these files inside the served walk. Two files matching one stem are an `ambiguous-convention`. An `Archive.olai` at any other path is a dormant outline for a human to inspect, with no migration.

### Addresses and links

Path schemas validate relative address structure rather than current membership. An outline address keeps the `kind: "document"` discriminator, and `outlineAt` admits it only when the current claim holds nodes. A format's `parse(file, contents, claims)` receives the caller's snapshot and never consults the registry itself. Only `_olai/` participates in Inbox, Pins, Trash and Properties resolution, so move convention files directly into it. Each outline format states its own serialization and merge guarantees; the guarantees above belong to `outline-olai`.

Relative links in titles, notes and document bodies resolve beside the file that contains them. A missing served target is a derived reading and never a validation error, so the file stays readable and writable. Node and document reads name dead links and suggest matching basenames relative to the writer, and a write's answer nudges about dead links it has just introduced. Creating the target clears the reading on the next revision, without rewriting the referring text.

</details>
