# Property types

A property is a key and a value on a row. A value can be any text, unless your directory declares a shape for that key's values.[^meaning]

## Declaring a key

Declarations live in `_olai/Properties.olai`.[^convention] Write one row per key: the row's title is the key, and the type is a property on that row. A key with a fixed list of choices has one row per choice underneath it.

```jsonl
{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}
{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}
{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}
{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}
{"id":"prop-records","ord":"a2","title":"records","custom":{"type":"int"}}
{"id":"prop-pr-url","ord":"a4","title":"pr-url","custom":{"type":"text"}}
{"id":"prop-agent","ord":"a3","title":"agent","custom":{"type":"ref","under":"agents-roster"}}
```

Property keys are one set of names across the whole directory, and case makes no difference.[^case] Inside this file olai reads three keys of its own: `type`, `under` and `base`.[^words]

## The types you can declare

This format has seven types, and a plugin can add more.[^clause]

| Type | What a value may be |
| --- | --- |
| [`text`](#text) | anything |
| [`date`](#date) | an ISO day, or a day and a time |
| [`int`](#int) | a whole number |
| [`path`](#path) | a path, with no spaces in it |
| [`doc`](#doc) | a `.md` file this directory serves |
| [`ref`](#ref) | the id of a named row's child |
| [`node`](#node) | the id of any row |
| [a type a plugin adds](#a-type-a-plugin-contributes) | whatever that plugin says it is |

## What a declared value names

A declaration answers two questions at once: what olai accepts when you write a value, and what its chip opens when you click it.[^names] A chip is the label olai draws for one property under a row's title. For a key nothing declares, olai guesses what the value names.[^guess]

## What a refusal says

A refusal names the key, the allowed values, and the closest one to what you wrote:[^refused]

```
outlines_prop {"id":"lane","key":"merge","value":"AUTO: grok review folded + CI green"}
→ `merge` is `auto` | `human` — got "AUTO: grok review folded + CI green"

outlines_prop {"id":"lane","key":"agent","value":"clade"}
→ `agent` names a node under `agents-roster` — those are `claude`, `grok`, `pi` —
  got "clade" — did you mean `claude`?

outlines_add {file: "_olai/Properties.olai", title: "took", props: {type: "took"}}
→ `type` is `took`, which is not a property type — write `text` (anything),
  `date` (an ISO day or instant), `int` (a digit run), `path` (no whitespace;
  optional `base`), `doc` (a served `.md`; optional `base`), `ref` (a child's
  id; `under` names the parent), `node` (any node id), `terminal` (a padi
  terminal id, or a prefix of one), `odu-run` (an odu run id,
  `<base36>-<base36>`).

outlines_add {file: "_olai/Properties.olai", title: "brainstorm", props: {type: "doc"}}
→ `brainstorm` cannot be declared `doc` while 3 existing values do not fit:
  `lanes.olai` `first` (`a`) holds "not a path"; … The same fence `outlines_prop`
  already is — fix those values first (one `apply` can write them all), then
  declare.
```

## What declaring a type does not do

No key is required, no kind of row has a schema, and nothing has a default. A row may carry any keys you like: a declaration only limits values.

[^meaning]: A type limits what a value may be and gives the key no meaning. A key with no declaration holds text, and that is nearly every key. A key declared `date` still does not put its row on that day's page, because a property is not a mark. What a property is, and how you write one, is in [format.md](format.md).

[^convention]: Declarations live in the file named `Properties` directly inside `_olai/`, which may have any suffix that holds rows; olai makes `_olai/Properties.olai`. Editing your vocabulary is editing an outline: adding a choice is adding a row underneath the key, the file opens in olai like any other file, and nothing has to restart. Only rows at the top level of that file declare a key, and what you hang under a declaration is yours.

[^case]: Upper and lower case make no difference to a key, when a value is checked, when `prop:` matches it in a search ([search.md](search.md)), and when a key is refused for shadowing a field. So `pr` and `PR` are one key, declaring both declares one key twice, and a `merge` key on one row and a `merge` key anywhere else are the same key.

[^words]: olai gives `type`, `under` and `base` their meanings in code, and only in the rows of `_olai/Properties.olai`. You may not declare a key called `type`, `under` or `base`. The three words, and what each one takes, are in the first closed block at the foot of this page.

[^clause]: Each type has its own entry in the second closed block at the foot of this page, including the types a plugin adds. A terminal and a CI run are not among the seven types, and this format never learns about either: a plugin adds a type for them instead.

[^names]: What each type's chip opens is in the third closed block below, one answer per type. For three of the types, the chip answers even where a write of that value would be refused, and that is deliberate.

    A `date` written `2026-08-25 10:06` is refused as a spelling, and still names the day it plainly names; a `ref` holding an id from the wrong parent still names that row. `doc` is the exception, held to exactly what the write allows, because it is the one type that promised its value names a file this directory serves.

[^guess]: For a key nothing declares, olai tries these readings in order: a whole `http` or `https` URL, a date, the exact id of a row, a path this directory serves beside the file being written, and GitHub's `owner/repo#123`. Anything else is text. The whole value has to be the name of the thing, so a value with a URL inside it is not a URL, and a value that reads like a title is not a row.

[^refused]: Two further refusals are in the last closed block at the foot of this page: declaring a type while existing values do not fit it, and a write that would leave a value somewhere else pointing at nothing.

<details>
<summary><code>type</code>, <code>under</code> and <code>base</code></summary>

### `type`, `under` and `base`

A declaration is a row carrying properties, and olai gives these three keys their meanings in code, in the rows of `_olai/Properties.olai` and nowhere else. You may not declare a key called `type`, `under` or `base`. Outside that file, a property called `type` is your own vocabulary and none of this format's business.

| Key | What it takes |
| --- | --- |
| `type` | one of the types below, or a type a plugin added |
| `under` | the id of the row whose children are a `ref`'s choices |
| `base` | `root` or `file`: where a `doc` or `path` value is resolved from |

`under` must name a regular row and never a mirror. A mirror has no children of its own, so a declaration pointing at one is refused where it is written.

</details>

<details>
<summary>Every type, and what a value may be</summary>

### `text`

Anything. It is what a key holds when nothing declares it, and declaring `text` is how you say for good that this key's values are meant to be prose. A value declared `text` is read exactly as an undeclared value is, which is what keeps the URL in a `pr-url` a link.

### `date`

An ISO day (`2026-08-25`), or a day and a time written the way a mark records one (`2026-08-25T10:06:00-04:00`), and nothing else. Each of those two has exactly one spelling, so a day stays a bare day.

In both, the obvious spellings are folded into one: surrounding spaces, a single-digit month or day, a space where ISO writes `T`, missing seconds, and a fraction of a second after them. A time with no zone on it is stamped with the offset of the clock the write is made on, and `Z` is stored as `+00:00`, which is what a mark's own stamp writes. Words stapled to a date are not a spelling, and are refused:

```
`dispatched` is a date — got "2026-08-25 10:06 (sweep queue #5)". Write
`2026-08-25T10:06:00-04:00` or `2026-08-25`; the story goes in the note.
```

On disk only the canonical form is legal, so a hand-written `2026-08-25 10:06` makes the file broken, and the error names the key.

### `int`

A run of digits: no sign, no leading zeros, no separators, and nothing after the digits. A key declared `int` can be searched by range, so `prop:records=190..200` selects on it ([search.md](search.md)).

### `path`

One run of characters with no whitespace in it. It may point anywhere, and it promises nothing beyond that shape. Where a relative value is resolved from is the key's own business, set with [`base`](#base).

### `doc`

A path naming a markdown document this directory serves. It is resolved beside the file the value is written in by default, or from the root of the served directory with `base: root`, and a write is refused unless the value resolves to a served file. A `doc` naming a served `.olai` file is refused: this type promises a document, and an outline is not one.

```
`brief` names a document — `briefs/plan.md` resolves to `roadmap/briefs/plan.md`,
and no such `.md` file is served
```

### `ref`

The id of one of a named row's children, which is how you write a key with a fixed list of choices. `under` names the row holding the choices; without `under`, the choices are the children of the declaration itself. The value is an id, so you can rename a choice freely: the file holds `auto`, and the chip draws that child's title, `automatic`.

There is no separate type for a list of choices, because `ref` is one: adding a choice is adding a row, rather than editing a string of words separated by pipes. A list that lives elsewhere (`{"type":"ref","under":"agents-roster"}`) is the same mechanism pointed at another row, and it stays ordinary data.

### `node`

The id of any row in the directory. A mirror is not one: a mirror is a second view of a row, so a property pointing at it would point at the view rather than at the row.

### A type a plugin contributes

A terminal and a CI run are not among the seven types, and this format never learns about either. A plugin declares a type of its own, and you declare a key with it like any other type:

```jsonl
{"id":"prop-terminal","ord":"a6","title":"terminal","custom":{"type":"kolu-terminal"}}
{"id":"prop-run","ord":"a7","title":"run","custom":{"type":"odu-run"}}
```

The declaration is what turns the behaviour on. A key declared `kolu-terminal` gets kolu's Dock row and its live pane ([plugins/kolu.md](plugins/kolu.md)); a key declared `odu-run` holds a run id that olai asks the odu service about ([plugins/odu.md](plugins/odu.md)). Both of these are live properties, which show what is happening right now ([live-properties.md](live-properties.md)).

Chat contributes four types. `chat-agent-session` puts a conversation on a row or a document, and `chat-opens` says where a document's chat opens. `chat-agent-slept` is the moment olai last tidied that agent's memory, and `chat-agent-sleep` is your `on` or `off` answer to whether olai may tidy it on a schedule ([chat.md](chat.md)).

A plugin you switch on declares its own key for you, so a row carrying `kolu-terminal 303dc985` works without olai writing anything into your directory. The key a plugin claims is always the type's own word, which carries the plugin's name in it, so a key you call `terminal` is never taken over by switching a plugin on.

Your own declaration always wins. Declare the type on a shorter key to move the behaviour there, and declare the key `text` to take the behaviour away. A value under a type whose plugin this server is not running is read exactly as an undeclared key is, so a URL written under a type nothing provides is still a link.

Neither behaviour comes from a key's name, and there is no falling back to the name: the shape of a value cannot tell a document from any other path, which is why declaring `path` buys neither of them.

### `base`

A `doc` or a `path` declaration may also say `base`, which is `root` or `file`:

```jsonl
{"id":"prop-brief","ord":"a5","title":"brief","custom":{"type":"doc","base":"root"}}
```

| `base` | A relative value is resolved |
| --- | --- |
| `file` | beside the file the value was written in, as a relative link in a note is. This is the default |
| `root` | from the root of the served directory, wherever the value was written |

`base` on any other type is refused where it is written, as `bad-prop`: a type that names no path has nothing to resolve, including a type a plugin added.

</details>

<details>
<summary>What each type's chip opens</summary>

| Type | The chip opens |
| --- | --- |
| `doc` | the `.md` file the value resolves to, which a write is held to |
| `path` | whatever this directory serves at that path, an outline included |
| `ref`, `node` | the row the id names, drawn with that row's title |
| `date` | that day's page |
| `int` | nothing |
| a type a plugin added | nothing of olai's own; the plugin draws it |
| `text` | whatever an undeclared value resolves to, as a guessed key does |

Your declarations stay on the server. What a browser is sent is the answers, one for each value on the page that names something, never the declarations that produced them.

</details>

<details>
<summary>A declaration that does not fit, and a write that would strand a value</summary>

### A declaration with values that do not fit

A declaration is refused while any existing value under that key does not fit it, and the refusal names each offending value by file, row and value. The same check meets an `outlines_prop` that writes `type` on a declaration, and a rename of a declaration onto another key.

It also meets the creation of `_olai/Properties.olai`, an `outlines_move` or `trash_restore` that lands a top-level row in that file, an `outlines_duplicate` of a declaration, and an `outlines_split` or `outlines_merge` of a top-level row there.

One `outlines_apply` that rewrites every bad value in a file repairs it in one go: writing one value at a time leaves the others, and the file stays refused, while the batch is a single checked write.

### A write that would leave a value pointing at nothing

A write may also not strand a value it does not touch. Moving a `ref` choice out of the row its declaration names, trashing it, or merging it away would leave every value naming its id pointing at nothing, in whatever other file holds those values. Such a write is refused, and names the file it would have broken:

```
`move: Claude` would leave `lanes.olai` invalid, so nothing was written
```

olai asks that question of the directory the write would produce, against the directory as it stands, so any write that would take a file off the screen is turned back, whatever tool made it. A file that was already broken stops nothing, since it is off the screen and refusing its own writes already.

Every tool that writes a property is covered, because the check sits where a write is planned and checked: `outlines_prop`, the `props` of `outlines_add` including those on children, `outlines_apply`, `outlines_update` and `capture_add`. An `outlines_duplicate` of an ordinary set of rows needs no check of its own, since a copy of rows olai already approved is just as valid. A value written by hand that does not fit makes the file broken, naming the key, as `bad-prop` ([validation.md](validation.md)).

A `ref` or a `node` value points at a row, and deleting is checked against those pointers. `trash_empty` and `outlines_unmirror` refuse to delete a row that a live row still names through a declared key, naming both the row and the key. Delete a row from a list of choices while other rows still name it and the validator says so, with a did-you-mean, exactly as it treats an `after` target that went away.

</details>
