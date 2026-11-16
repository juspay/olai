# How olai checks your files, and how it writes them

olai checks every file it has loaded, when it starts and after every write, and nowhere else.

## When the check runs

The check runs in two passes, always in this order.[^stages]

1. Over each line on its own: is it JSON, are its fields known, are its dates ISO?
2. Over all the files together: are ids unique, does every reference find its row, do values fit their declarations?

A problem holds back only the files it is about.[^cost][^two] While any file cannot be read, olai holds back errors about references it cannot follow.[^withheld] A write whose files would not parse is refused.[^refused]

## What olai checks for

- Every id is spelled legally, and only one row uses it.[^ids]
- Every reference finds its row; a `parent` must be in the same file.[^targets]
- `after` does not loop, and a mirror does not sit inside the rows it shows.
- Marks and `date` hold valid ISO dates, and a row carries at most one mark.[^marks]
- A `repeat` is a rule olai can read, with a `date` to repeat from.
- Every property value fits what its key declares.[^declared]

## Error codes

Every error names the file and line it is about.[^codes]

## How a write happens

Only the server writes your files.[^merges] A write checks the files it changes, writes new files beside the old ones, renames them into place at once, and commits.[^bytes] The check comes first, so a refused write leaves the disk untouched.[^races]

## Which plugin owns a file, and the four special names

Each outline plugin claims a suffix and reads and writes those files; the Olai plugin claims `.olai`.[^claims] Four names inside `_olai/` are special: `Trash`, `Inbox`, `Pins` and `Properties`.[^stems]

[^stages]: The first pass asks only what one line can answer by itself. That is the JSON, the fields, how the id is spelled, that dates are ISO, that the row carries at most one mark, and that a `repeat` rule has a `date` under it. The second pass asks everything that needs to know what else exists: that ids are unique, that references resolve, that nothing loops, and that property values fit their declarations.

[^cost]: A file is read whole or not at all, and a problem takes out the files it is about and no others. A file named in an error is still published, with its contents held back: it keeps its place in the sidebar, its own page lists the errors where its rows would be, and it refuses writes. Every other file in the directory is loaded, drawn and writable as usual.

[^two]: An error naming two files takes out both, because "which file is broken" has no single answer for a duplicate id or for a mirror across files. The rules always run over every file, and only the answer is poorer.

    Holding a file back cannot invent an error against a healthy neighbour: a `mirror` or a `see` from a working file into a held-back one is drawn exactly as a reference to an id nothing declares. The next load starts from the whole directory again and reaches the same verdict.

[^withheld]: Saying "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse. So an unresolved `mirror`, `after`, `blocks` or `see` target is not reported while any outline cannot be read, and holding that back breaks nothing. A report holding any per-line error says so, and you should expect a second round of errors after you fix the first.

[^refused]: Holding errors back is about loading. A write is refused instead: olai refuses any write whose own changed files would not parse. The refusal carries the same rows the check produces, which are the code, the file and line, and the message, so a rule is worded one way however you reached it.

[^ids]: A duplicate id is reported on the second row, pointing at the first, which stays the row every reference resolves to. An id holding a character outside the mention alphabet is `bad-id`.

[^targets]: A `parent` must name a regular row in the same file, with no loops. A `mirror` target, and an `after`, `blocks` or `see` target, may be in any file. An unknown target gets a did-you-mean, and `after` is read with every `blocks` folded into it.

[^marks]: Dates are checked as text, because a writer has to write back exactly what it read. There is no rule about a mark and the rows under it: the checks `outlines_done` makes when you write are that tool's own policy, and never a reason a directory fails to load ([dates-and-status.md](dates-and-status.md)).

    A git merge can write a mark in one branch and a task under it in another, so this format has to be able to read that directory, and the next write is what fixes it.

[^declared]: Every property value fits what its key declares, and every declaration in `_olai/Properties.olai` names a type olai knows ([properties.md](properties.md)).

[^codes]: An error is located at the file and the line of the row it is about, which is that row's first line. A line of `0` means the error is about the path itself. Each code has an entry below with the message it carries, and what a refused write hands back is in a closed block of its own.

[^merges]: A git merge is the only thing that edits your files without going through the server, and the check on load catches what a merge got wrong. Each row is one line with an id that does not change, so ordinary line-by-line git merges are safe ([git.md](git.md)).

[^bytes]: The check runs over the files the write would produce, and the rename puts either all of them in place or none. A writer writes fields in their canonical order, literal `UTF-8` with no escaping beyond what JSON itself needs, no blank lines, and exactly one newline at the end. A reader accepts blank lines. The five rules a writer keeps are in a closed block at the foot of this page.

[^races]: A write that keeps losing races against other writers is refused after five attempts. When other writers are moving the directory, the refusal names the files and the span of revisions it saw, so you can tell what is being rewritten. A refusal that instead blames the set of file kinds is a bug in olai's own re-checking; restarting the server clears it.

[^claims]: The directory's `format` setting names the plugin that new outlines use, and that plugin's first registered suffix is what a new file gets ([settings.md](settings.md)). Existing files are matched by the suffixes plugins claim now, not by that setting. When the named plugin is not running, olai refuses to make a new outline, and an address with a suffix nothing claims is answered `notFound` rather than as a file it failed to read.

[^stems]: The four names are matched whatever their capitals, sit directly inside `_olai/`, and are matched only among files whose plugin holds rows, so they work with any outline plugin's suffix. What each one holds, how a missing one is created, and how relative links are resolved are in the last closed block at the foot of this page.

<details>
<summary>Every error code, and what it says</summary>

| Code | Pass | What it means |
| --- | --- | --- |
| [`not-json`](#not-json) | line | the line is not valid JSON |
| [`not-an-object`](#not-an-object) | line | the line parsed, but not into a JSON object |
| [`bad-record`](#bad-record) | line | a field has the wrong type, is unknown, or is missing |
| [`bad-id`](#bad-id) | line | `id` holds a character an id may not hold |
| [`several-marks`](#several-marks) | line | two marks on one row |
| [`bad-date`](#bad-date) | line | a mark or `date` is not valid ISO |
| [`bad-repeat`](#bad-repeat) | line | the rule cannot be read, or has no `date` to repeat from |
| [`unreadable-file`](#unreadable-file) | line | one file would not open |
| [`duplicate-id`](#duplicate-id) | set | two rows claim one `id` |
| [`ambiguous-convention`](#ambiguous-convention) | set | two files have one of the four special names |
| [`unknown-parent`](#unknown-parent) | set | `parent` names an id nothing declares |
| [`foreign-parent`](#foreign-parent) | set | `parent` names a row in another file |
| [`parent-not-a-node`](#parent-not-a-node) | set | `parent` names a mirror |
| [`parent-cycle`](#parent-cycle) | set | `parent` pointers close a loop |
| [`unknown-target`](#unknown-target) | set | a `mirror` or an id list names an unknown id |
| [`after-cycle`](#after-cycle) | set | `after` closes a loop |
| [`mirror-cycle`](#mirror-cycle) | set | a mirror sits inside the rows it shows |
| [`bad-prop`](#bad-prop) | set | a value, or a declaration, does not fit |
| [`unreadable-directory`](#unreadable-directory) | set | the directory would not be read |

### `not-json`

The line is not valid JSON, and the message carries the parser's own sentence.

```
this line is not JSON: Unexpected end of JSON input
```

### `not-an-object`

The line parsed into a value that is not a row. Saying which kind of value it was beats "expected object" when somebody has pasted a JSON array.

```
every line is one node, written as a JSON object; this line is an array
```

### `bad-record`

The object is not a well-formed row: a field has the wrong type, an unknown field is there, or a required one is missing. One error per field.

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

`started` asks for more, because olai subtracts one instant from another to measure a stretch of work:

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

A file in the directory will not open. olai draws the rest of the directory around the hole: the sidebar still lists the file, its own page says what happened, and nobody else's page moves.

```
EACCES: permission denied, open 'house.olai' — this file is in the directory and will not open.
```

A write to a path no running plugin claims is refused the same way: `` No active row claims house.txt, so it cannot be written. ``

### `duplicate-id`

```
`kitchen` is already the id of another node; ids are unique across every file in the served directory
```

### `ambiguous-convention`

More than one file holding rows has the same one of the four special names, and olai will not pick one of them silently.

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

The error names the file the parent lives in as a pointer, not as a second fault: that file is not broken by this.

### `parent-not-a-node`

```
`parent` is `kitchen`, which is a mirror; children hang off the node a mirror points at, never off the mirror
```

### `parent-cycle`

```
`parent` pointers close a loop, so this node is its own ancestor: `a` → `b` → `a`
```

### `unknown-target`

A `mirror`, `after`, `blocks` or `see` target names an id nothing declares. It is the one code an unreadable file can invent, so it is not reported while any file has failed to parse.

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

A property value does not fit what its key declares, or a declaration names a type this format does not know ([properties.md](properties.md)). The error names the key, and names the declaration that judged the value as a place to look, not as something broken.

```
`records` is a whole number — got "about 190". Digits alone: no sign, no leading zeros, no separators, and nothing after them.
`type` is `took`, which is not a property type — write `text` (anything), `date` (an ISO day or instant), `int` (a digit run), `path` (no whitespace; optional `base`), `doc` (a served `.md`; optional `base`), `ref` (a child's id; `under` names the parent), `node` (any node id).
```

A `ref` or a `node` value looks up a bare id across files, so that error is held back while any file cannot be read. The other five types look nothing up, so an `int` holding prose is reported whatever else failed to parse.

### `unreadable-directory`

The directory itself would not be read: a permission on a folder, a mount that went away, a disk with no room to answer. It is the one code that means you are looking at the directory as it last loaded, rather than as it is now.

```
EACCES: permission denied, scandir '/home/alice/notes' — the outline below is the last one that loaded, and it will catch up on its own once the directory can be read again.
```

</details>

<details>
<summary>What a refused write hands back</summary>

Every error carries a kind, one of `usage`, `validation`, `not-found` or `busy`, which reaches an agent as an MCP tool error and a browser as an HTTP code with detail attached. A `validation` refusal carries the check's own verdict as data rather than as prose. A load never refuses: the same rows reach a reader, attached to the files they broke, one entry per broken file.

| In the verdict | What it answers |
| --- | --- |
| implicated | which files an error is about: where it was found, plus every file it names |
| broken | which files an error breaks: where it was found, plus every related place that did not say otherwise |
| `blamed(report)` | which files a whole report breaks, as the per-file entries the directory carries |
| `admits(broken, files)` | is anything wrong with these files, and what |
| `stopping(set, files, standing)` | the question a write asks: `admits`, over a longer list of files |
| `summaryOf(broken, n)` | a short per-file answer: the path, one word, and how many errors |

A place that names a second file without blaming it says so, and there are two ways that happens. One is the ground a judgement stands on, where a `bad-prop` names the declaration that judged the value. The other is what a broken row reached for, where a `foreign-parent` names the file the parent lives in. In every other case both files share the fault, so two files claiming one id are two files nobody can draw the second of.

The short answer cannot carry an error row, so no screen that draws it fills a page with somebody else's errors. The rows are drawn in the broken outline's own pane.

</details>

<details>
<summary>The rules a writer keeps</summary>

- There is one writer, and callers never assemble bytes themselves. A writer is handed the rows of a whole file and hands back the whole file, so every separator has exactly one owner.
- Being absent has one spelling. An optional field holding `undefined`, `null`, `[]` or `""` is not written, so `{"after":[]}` can never reach a file. Two files that mean the same thing must not differ byte for byte, because a conflict between `after: []` and no `after` at all is a conflict about nothing.
- A required field is written whatever it holds. Dropping one would produce a line the reader rejects outright, which is worse than handing an odd value to the check that is about to look at it.
- A row is one line by construction: the newlines inside a note are escaped by JSON itself, which is why this format is one JSON object per line rather than indented JSON.
- Putting a row between two others is an insert, not a renumbering. `ord` is a fractional index over base62, so a row placed between two neighbours gets a key that sorts between them and touches neither. Nothing sorts between `x` and `x0`, and the writer renumbers that one row rather than guessing.

</details>

<details>
<summary>The four special names, and how addresses resolve</summary>

### The four special names

`Trash`, `Inbox`, `Pins` and `Properties` are matched whatever their capitals, directly inside `_olai/`, and only among files whose plugin holds rows, so they work with any outline plugin's suffix.

| Name | What it holds |
| --- | --- |
| `Trash` | rows you have put away, and what they need to go back ([organising.md](organising.md)) |
| `Inbox` | captures with nowhere else to go ([getting-around.md](getting-around.md)) |
| `Pins` | the shelf of pins ([documents-and-kinds.md](documents-and-kinds.md)) |
| `Properties` | the property declarations ([properties.md](properties.md)) |

A missing one is created inside `_olai/`, with the first suffix of the configured outline plugin. The folder is called `_olai` with an underscore rather than a dot so that it stays inside the directory olai walks. Two files matching one name are an `ambiguous-convention`. An `Archive.olai` at any other path is just an outline nobody reads, there for you to look through.

### Addresses and links

An address is checked for its shape, not for whether the file it names exists right now. An address of an outline is still an address of a file, and olai treats it as an outline only while the plugin claiming that suffix holds rows. A format's reader is handed the list of claims the caller was looking at, and never reads the registry itself.

Only `_olai/` takes part in finding the Inbox, Pins, Trash and Properties files, so move those files directly into it. Each outline format states how it writes files and how it merges; what this page says is the Olai format's own answer.

Relative links in titles, notes and document bodies are resolved beside the file they are written in. A link to a file that is not served is a reading, not an error, so the file stays readable and writable.

Reading a row or a document names its dead links and suggests files with matching names, relative to the file being written, and the answer to a write points out dead links the write has just introduced. Creating the missing file clears the reading at the next revision, without rewriting the link.

</details>
