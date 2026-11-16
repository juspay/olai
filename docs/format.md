# The outline format

One outline is one `.olai` file: one JSON object per line, one line per node. This page is the record itself — the two shapes a line may take, the fields each one carries, and the open map of properties beside them.

Every `.olai` file under the served directory is an independent tree, so a `parent` names a node in the same file. Cross-file relations are mirrors and edges, written as a bare id.

```jsonl
{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}
```

Ids are unique across the whole served directory, so a subtree moves between outlines whole and keeps its ids. `outlines_move` takes a `parent` or a `file` in another outline, and `outlines_trash` puts a subtree on its way to `_olai/Trash.olai`.

Every mirror, edge, `node`-typed property and pin aimed at what moved goes on resolving, and so does the day a dated node sits on. The exception is a `ref`-typed property, which asserts ancestry as well as existence: moving a variant out of its declared root is refused `bad-prop`, with nothing written ([properties.md](properties.md)).

## Files from an older directory

olai reads the suffixes its file kinds claim, and a `.jsonl` is not one of them: it sits in a served directory as an unclaimed file, like a `.txt`. Rename them once, from the directory:

```sh
git ls-files '*.jsonl' | while read -r f; do git mv "$f" "${f%.jsonl}.olai"; done
```

(`mv` instead of `git mv` outside a repository.)

A top-level `doc` field is not part of a record: it is a `bad-record` like any unknown key. Attach material with a markdown link in the note instead. To keep the field's values as ordinary custom properties, run from the directory:

```bash
git ls-files -z '*.olai' | while IFS= read -r -d '' file; do
  grep -q '"doc"[[:space:]]*:' "$file" || continue
  jq -c 'if .doc then .custom = ((.custom // {}) + {doc: .doc}) | del(.doc) else . end' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done
```

An undeclared custom `doc` property is an ordinary property: the value reading draws a door when it resolves to a served path. The `doc` property type declared in `_olai/Properties.olai` is a fence on the value ([properties.md](properties.md)).

## Two record shapes

A line is a regular node or a mirror, and carrying `mirror` is what decides which. They are two shapes rather than one shape with optional fields: a mirror is a second placement of a node that already exists, so every field describing the node itself has its authoritative copy at the target.

There are no include records; the served directory is the only composition mechanism.

### A regular node

The node itself. It must carry `id`, `ord` and `title`, and it may carry any of the other fields below except `mirror`.

### A mirror

A second placement of a node that exists elsewhere. It is exactly `{"id", "parent"?, "ord", "mirror"}`; any other field on it is a `bad-record`. A mirror stores no mark, no properties and no prose of its own, and children hang off the node it points at rather than off it.

## Fields

Writes re-serialize the whole record in the order below. An absent field is omitted, never written as `null` or `[]`. Required means the record is refused without it.

| Field | Required | What it holds |
| --- | --- | --- |
| [`id`](#id) | both shapes | Stable identity, unique across the loaded set |
| [`parent`](#parent) | no | The id of a node in the same file |
| [`ord`](#ord) | both shapes | Sibling order |
| [`title`](#title) | regular nodes | The row's text |
| [`mirror`](#mirror) | mirrors | The id this record places a second time |
| [`done`, `cancelled`, `doing`, `todo`](#done-cancelled-doing-todo) | no | The four marks, at most one of them |
| [`started`](#started) | no | When the current round of work started |
| [`worked`](#worked) | no | Work already banked, in whole seconds |
| [`date`](#date) | no | What the node is scheduled for |
| [`repeat`](#repeat) | no | How the node comes back |
| [`desc`](#desc) | no | The note |
| [`after`, `blocks`, `see`](#after-blocks-see) | no | Arrays of target ids |
| [`created`, `changed`](#created-changed) | no | The two stamps |
| [`custom`](#custom) | no | The open map of properties |

### `id`

A chosen slug or a minted short string, written in the mention alphabet: letters, digits, `_`, `-` and `/`. Every id a title or a note can name as `@<id>` is therefore legal, and a `/` inside an id is its own letter, exactly as it is inside a tag name. An id is unique across the whole loaded set and survives renames and moves. An id outside the alphabet is refused `bad-id`.

### `parent`

The id of a node in the same file; absent at top level. A `parent` that resolves in another file is `foreign-parent`, since cross-file placement is a `mirror`, and one that resolves to a mirror is `parent-not-a-node`.

### `ord`

Sibling order, as a fractional-index string over base62 (`0-9A-Za-z`). Plain string comparison is the sort; it is never read as a float.

### `title`

Verbatim text. Inline tags live here and are extracted when the row is drawn: `#topic` and `@person` are two sigils over one alphabet (`[A-Za-z0-9_/-]`), so `#work/olai` is one tag, and two namespaces, so `#alice` and `@alice` are different tags. `@` is claimed only where a word starts, so `srid@srid.ca` is an address; `#` is claimed anywhere. A title renders as inline-only markdown (bold, links, code, and no block elements) through the sanitised pipeline a note uses.

### `done`, `cancelled`, `doing`, `todo`

The four marks. Each holds `true` or an ISO date or datetime saying when that state was reached, and a record carries at most one of them. Any node may carry a mark, children or not, and a node carrying none is not a task at all. `done` and `cancelled` settle, and both are written with the instant they were made at, which is what puts the node on that day. See [dates-and-status.md](dates-and-status.md).

### `started`

An ISO datetime: when the current round of work started. `outlines_doing` stamps it on every start, so a re-opened node measures the fresh round. A settle keeps it when the round it closed was live, and drops it when none was.

Where a `doing` comes off without a settle, by `outlines_todo` or by undoing the start, the round banks there and the stamp goes with the `doing`. A day-only value is refused `bad-date`, because a span is subtracted from it. It puts the node on no day.

### `worked`

A non-negative whole number of seconds: the work already banked. A round closes where its `doing` comes off, and each settle or peel adds the round it closed. A settle with no live round banks nothing, so no round is counted twice.

No verb writes this field, and `outlines_prop` turns the key away toward the verbs that do. Absent means nothing is banked. `outlines_read` answers `took`, which is `worked` plus the live round while a node is doing, and is absent when there is no span to tell.

### `date`

An ISO date or datetime: what the node is scheduled for. A node carrying one is on that day ([dates-and-status.md](dates-and-status.md)).

### `repeat`

How the node comes back, in the format's own small grammar: `every day`, `every week on monday`, `every month` or `every year`. It needs a `date` beside it, which is what it repeats from. Text the grammar cannot read, and a rule with no `date` under it, are both `bad-repeat`. Only the occurrence that is next carries the rule ([dates-and-status.md](dates-and-status.md)).

### `desc`

The note: one string with embedded newlines, stored verbatim. It is markdown, interpreted when it is drawn.

### `after`, `blocks`, `see`

Arrays of target ids, which may live in any file of the set, and the closed set of relations. `blocks` is sugar: `a blocks b` means `b after a`. `after`, with `blocks` normalized into it, must stay acyclic, and is what being blocked is derived from ([dates-and-status.md](dates-and-status.md)). `see` is a free cross-reference, and what it lands on reads it back ([documents-and-kinds.md](documents-and-kinds.md)).

Each is a set: a target named twice is named once. A `.olai` is plain text, so a hand or a merge may write the repeat, and `outlines_see`, `outlines_after` and `outlines_add` take a re-add as a no-op. Every reading of the relation collapses it. The exemption is the reads that hand back the record: `outlines_read` and `search_nodes` answer these arrays exactly as the line on disk holds them.

### `created`, `changed`

ISO datetimes the ops layer stamps: `created` when a node is captured, `changed` on every write to it afterwards. No verb writes either, and `outlines_prop` refuses both by name. Both are absent on a node olai never wrote, and nothing invents a past it did not see. A `created` with no `changed` beside it means nothing has been written to that node since it was made. No commit names `changed` as a change, since every write stamps it.

### `custom`

The one open field: a map of named facts olai gives no meaning to, with one named exception, `agent`. See [Properties](#properties) below.

### `mirror`

The id this record places a second time. The target may live in any file of the set, and may itself be a mirror: the chain is followed to the regular node at its end. A mirror inside the subtree it shows is `mirror-cycle`.

## Properties

The top level of a record is closed: a key this format has no meaning for is a `bad-record` naming it, so a typo'd `titel` is caught rather than kept. `custom` is the one exception, and it is an exception in one direction only — the field is declared, what goes inside it is not.

```jsonl
{"id":"lane","ord":"a1","title":"the chat header goes stale","doing":true,"custom":{"agent":"claude-opus","pr":"https://github.com/juspay/olai/pull/176"}}
```

Any key may sit in there, holding text or a list of text. Nothing gives a key a meaning: a URL is a string that looks like a URL. What a directory may do is declare that one key's values have a shape ([properties.md](properties.md)), which fences a value and still gives the key no meaning.

Nothing in olai reads a key inside `custom`. The journal reads `date`, the checkbox reads the marks, and the blocking graph reads `after`. A custom key is read by the person who wrote it, by `prop:` in a query ([search.md](search.md)), and by the run of chips drawn under a node's title ([editing.md](editing.md)).

That run asks one question of a value: does this string name a file, a node, a day or a URL olai can open, so that the chip can be a link. Every read that situates a node hands the map back as it stands, a search hit as much as `outlines_read`.

### `chat-agent-session`

The one exception, and it is a plugin's declared type rather than a key olai reads. A node carrying a property of that type is a node agent. The node's title is the agent's name, its note is the charter, and its subtree is the memory, and the roster behind the agent panel is the query `prop:chat-agent-session` ([node-agents.md](node-agents.md)). The chat plugin contributes it, so a serve without chat does not read it ([live-properties.md](live-properties.md)).

One key carries both halves (which engine the agent runs on, and which conversation it is talking through), split on the first colon:

```
chat-agent-session: claude          a node agent nobody has started a session for
chat-agent-session: claude:0f3c…    ...and one that is talking through that conversation
```

The engine is required and the session is optional, so the value's presence is what makes the node a node agent and its second half is the pointer. Only the first colon splits: an engine id is one of olai's own slugs and holds none, while a session id is somebody else's opaque string and may hold several. A directory may keep the type on a column of its own name ([plugins/chat.md](plugins/chat.md)).

### Writing a property

`outlines_prop` takes `{id, key, value}`, and `null` or `""` removes the key. A write may also carry `was`, the value it expects to replace, with `null` for *the key should not exist yet*. Given, the write is conditional on the key still saying exactly that, and is refused with what it says now. That is what the chips send, since the box opens on the value as read. Left off, the write is unconditional.

A key that folds to one of this format's own field names, or to the word `status`, is turned away toward the verb that writes that fact. The two namespaces are two places, so `{"done":true,"custom":{"done":"yesterday"}}` is a legal record and an unreadable one.

Three verbs write a property and they reach one planner: `outlines_prop`, `outlines_add`'s `props` on a node being captured, and `outlines_update`'s `props` merged key by key onto a node that exists. The shadowed-key refusal is the same sentence whichever one met it.

### What a file holds

Keys are written alphabetically, and a key holding nothing is not written at all — the two rules the fields above follow, one level in. A map with no keys left is no `custom` field rather than `{}`. A read answers the same map a write would produce, so a key holding nothing is absent from a search hit and from `outlines_read` exactly as it is absent from the line on disk.
