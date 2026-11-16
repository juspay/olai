# Typed properties

A key with no declaration is text. A directory may declare that one key's values have a shape: the write gate then refuses a value that does not fit.[^meaning]

## Declaring a key

Declarations live in the `Properties` convention directly under `_olai/`, default `_olai/Properties.olai`.[^convention] One node per key: the title is the key, the type is written in that node's own properties, and an enum's variants are its children.

```jsonl
{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}
{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}
{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}
{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}
{"id":"prop-records","ord":"a2","title":"records","custom":{"type":"int"}}
{"id":"prop-pr-url","ord":"a4","title":"pr-url","custom":{"type":"text"}}
{"id":"prop-agent","ord":"a3","title":"agent","custom":{"type":"ref","under":"agents-roster"}}
```

Properties are one namespace across the whole directory, and a key is folded for case.[^case] A declaration takes `type`, and a `ref` or a path type may take `under` or `base`.[^words]

## The property types

Seven types this format owns, and an eighth arm for the types a plugin contributes.[^clause]

| Type | A value is |
| --- | --- |
| [`text`](#text) | `text` (anything) |
| [`date`](#date) | `date` (an ISO day or instant) |
| [`int`](#int) | `int` (a digit run) |
| [`path`](#path) | `path` (no whitespace; optional `base`) |
| [`doc`](#doc) | `doc` (a served `.md`; optional `base`) |
| [`ref`](#ref) | `ref` (a child's id; `under` names the parent) |
| [`node`](#node) | `node` (any node id) |
| [a contributed type](#a-type-a-plugin-contributes) | whatever the plugin says it is |

## What a declared value names

One declaration answers both questions, so the write gate's "is this allowed" and the chip's "what does it name" cannot disagree.[^names] An undeclared key is guessed at instead.[^guess]

## What a write is refused for

A live write is refused with the allowed values named and the closest one offered:[^refused]

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

## What typing does not do

No required keys, no schema per kind of node, and no defaults. A node may carry any subset of keys. This is one rule about values.

[^meaning]: Typing constrains the value and grants no meaning. A key with no declaration is text, and that is nearly every key. A `date`-typed property still does not put its node on a day page, because a property is not a mark. What a property is, and how one is written, is [format.md](format.md).

[^convention]: The `Properties` convention takes any node-holding suffix. Editing the vocabulary is editing an outline: adding a variant is adding a child row, the file opens in olai like any other, and nothing restarts. Only the top level of that file declares a key, and what hangs under a declaration is that declaration's own business.

[^case]: A key is folded for case, to the fence, to `prop:` in a query ([search.md](search.md)) and to the shadowed-key refusal. So `pr` and `PR` are one key, declaring both is declaring one key twice, and `merge` on a lane and `merge` anywhere else are one key.

[^words]: `type`, `under` and `base` are typed by a built-in table in code, applied to the records of `_olai/Properties.olai` and nowhere else. A directory may not declare a key called `type`, `under` or `base`. The three words, and what each takes, are in the first closed block at the foot of this page.

[^clause]: The second column is the clause a refusal names the type with. Each type has an entry in the closed block at the foot of this page, the eighth arm included: `terminal` and `run` are not among the seven, and this format may not learn either word.

[^names]: What a declared value names is what its chip opens, one answer per type, in the closed block below. Three of those answer where the gate would refuse, and that is deliberate.

    A `date` written `2026-08-25 10:06` is refused as a spelling and still names the day it plainly names, and a `ref` holding an id from the wrong roster still names that node. `doc` is held to the gate exactly, because it is the one type that promised its value names something served.

[^guess]: An undeclared key is guessed at, in this order: a whole `http` or `https` URL, a date, an exact node id, a path this directory serves beside the writing file, and GitHub's `owner/repo#123`. Anything else is text. The whole value has to be the name of the thing, so a value with a URL inside it is not a URL and a value that reads like a title is not a node.

[^refused]: A refusal names the key, the values that are allowed and the closest one to what you wrote. Two further refusals, a declaration whose existing values do not fit and a write that would strand a value somebody else wrote, are in the closed block at the foot of this page.

<details>
<summary><code>type</code>, <code>under</code> and <code>base</code></summary>

### `type`, `under` and `base`

A declaration is a node carrying properties, and these three words are typed by a built-in table in code, applied to the records of `_olai/Properties.olai` and nowhere else. A directory may not declare a key called `type`, `under` or `base`; outside that file, a property called `type` is somebody's own vocabulary and none of this format's business.

| Word | What it takes |
| --- | --- |
| `type` | one of the types below, or a word a plugin contributed |
| `under` | the id of a node in the set, where a `ref`'s variants live |
| `base` | `root` or `file`, where a `doc` or `path` value resolves from |

`under` names a node and never a mirror: a placement has no children of its own, so a declaration pointed at one is refused where it is written.

</details>

<details>
<summary>Every type, and what a value may be</summary>

### `text`

Anything. It is the default, and a declared `text` is the durable blessing for a key whose values are deliberately prose. A declared `text` value is read exactly as an undeclared key is, which is what keeps the URL in a `pr-url` a door.

### `date`

An ISO day (`2026-08-25`) or an instant written as a mark records one (`2026-08-25T10:06:00-04:00`), and nothing else. The two widths each have one spelling, so a day stays a bare day.

Within a width the obvious spellings fold into one: surrounding space, a single-digit month or day, a space where ISO writes `T`, missing seconds and a fraction after them. A datetime with no zone is stamped with the offset of the clock the write is made on, and `Z` is held as the numeric `+00:00` that a mark's own stamp writes. Prose stapled to a date is not a spelling and is refused:

```
`dispatched` is a date — got "2026-08-25 10:06 (sweep queue #5)". Write
`2026-08-25T10:06:00-04:00` or `2026-08-25`; the story goes in the note.
```

On disk the canonical form is the only legal one, so a hand-written `2026-08-25 10:06` makes the file broken, naming the key.

### `int`

A digit run: no sign, no leading zeros, no separators, and nothing after them. A typed key gains spans in search, so `prop:records=190..200` selects on it ([search.md](search.md)).

### `path`

One run of characters with no whitespace in it. It may point anywhere and promises nothing but the shape. Where a relative value resolves from is the key's own to say, with [`base`](#base).

### `doc`

A path naming a served markdown document. It resolves beside the writing file by default, or from the directory's root with `base: root`, and the write gate holds the value to that resolution. A `doc` naming a served `.olai` is refused: this type promises a document, and an outline is not one.

```
`brief` names a document — `briefs/plan.md` resolves to `roadmap/briefs/plan.md`,
and no such `.md` file is served
```

### `ref`

The id of one of a parent's children. `under` names the parent; absent, the variants are the declaration's own children. The value is an id, so a variant renames freely: the file holds `auto` and the chip draws the child's title, `automatic`.

There is no separate sum type, because an enum is a `ref`: adding a variant is adding a child row rather than editing a pipe-separated string. A roster that lives elsewhere (`{"type":"ref","under":"agents-roster"}`) is the same mechanism pointed at a different place, and it stays data.

### `node`

The id of any node in the set. A mirror is not one: a placement is a second view of something, so a property pointing at one points at a view rather than at the thing.

### A type a plugin contributes

`terminal` and `run` are not among the seven, and this format may not learn either word. A plugin declares its own type, and a directory declares a key with it like anything else:

```jsonl
{"id":"prop-terminal","ord":"a6","title":"terminal","custom":{"type":"kolu-terminal"}}
{"id":"prop-run","ord":"a7","title":"run","custom":{"type":"odu-run"}}
```

The declaration is the licence. A key declared `kolu-terminal` gets the Dock row and the live pane ([plugins/kolu.md](plugins/kolu.md)); a key declared `odu-run` is a run id olai asks the odu service about ([plugins/odu.md](plugins/odu.md)). Both are live properties ([live-properties.md](live-properties.md)). Chat contributes three: `chat-agent-session`, which seats a conversation on a node, `chat-agent-slept`, the instant olai last tidied that node agent's memory, and `chat-agent-sleep`, your `on` or `off` answer to whether olai may tidy that chat on its own clock ([chat.md](chat.md)).

An enabled plugin declares its own key for you, so a row carrying `kolu-terminal 303dc985` works without olai writing anything into your directory. The claimed key is always the type's own word, which carries the plugin's name, so a column you call `terminal` is never taken over by turning a plugin on. A row of yours always wins: declare the type on a short key to move it there, and declare the key `text` to take the face away.

A value under a type whose plugin this serve is not running reads exactly as an undeclared key does, so a URL written under a retired type is still a link. Neither face is licensed by a key's name, and there is no fallback to it: a shape cannot tell a document from a checkout, which is why declaring `path` buys neither face.

### `base`

A `doc` or a `path` declaration may say `base`, and it is `root` or `file`:

```jsonl
{"id":"prop-brief","ord":"a5","title":"brief","custom":{"type":"doc","base":"root"}}
```

| `base` | A relative value resolves |
| --- | --- |
| `file` | beside the file the value was written in, as a note's relative link does. The default |
| `root` | from the served directory's root, wherever the value was written |

`base` on any other type is refused where it is written, as `bad-prop`: a type that names no path has nothing to resolve, a contributed one included.

</details>

<details>
<summary>What each type's chip opens</summary>

| Type | The chip opens |
| --- | --- |
| `doc` | the `.md` the value resolves to, over the list the write gate is held to |
| `path` | whatever this directory serves at the path it resolves to, an outline included |
| `ref`, `node` | the record the id names, drawn with that record's title |
| `date` | its day |
| `int` | nothing |
| a contributed type | nothing of olai's own; the plugin's face draws it |
| `text` | whatever an undeclared key resolves to, as a guessed key does |

The vocabulary itself stays on the server. What a browser is handed is the answers, one per value a page draws that names something, never the declarations that produced them.

</details>

<details>
<summary>A declaration that does not fit, and a write that would strand a value</summary>

### A declaration with values that do not fit

A declaration is refused while any existing governed value does not fit, naming the offenders by file, node and value. The same fence meets `outlines_prop` of `type` on a declaration, and a rename of a declaration onto another key. It meets a seed of `_olai/Properties.olai`, an `outlines_move` or `trash_restore` that lands a root there, an `outlines_duplicate` of a declaration, and an `outlines_split` or `outlines_merge` of a Properties root.

One `outlines_apply` that rewrites every bad value in a file is the atomic repair: a single write leaves the others and the gate refuses the file, while the batch is one validated write.

### A write that would strand a value

A write may also not strand a value it does not touch. Moving a `ref` variant out of the root its declaration names, trashing it, or merging it away leaves every value that says its id naming nothing, in whatever third file holds them. That write is refused, naming the file it would have broken:

```
`move: Claude` would leave `lanes.olai` invalid, so nothing was written
```

The gate asks that question of the tree a write would leave against the tree that was standing, so any write that takes a file off the screen is turned back, whichever door it came through. A file that was already broken stops nothing, since it is off the screen and refusing its own writes already.

Every door that writes a property is covered, because the check sits at the plan and validate seam: `outlines_prop`, `outlines_add`'s `props` including children, `outlines_apply`, `outlines_update` and `capture_add`. An `outlines_duplicate` of an ordinary subtree needs no value refusal of its own, since a copy is isomorphic to a subtree the validator approved. A hand edit that lands a bad value makes the file broken, naming the key, as `bad-prop` ([validation.md](validation.md)).

A `ref` or a `node` value is a reference, and the removals read it. `trash_empty` and `outlines_unmirror` refuse to delete a record a live one still names through a declared key, naming the record and the key. Delete a roster node while other records still name it and the validator says so, with a did-you-mean, exactly as it treats an `after` target that went away.

</details>
