# The outline file format

An outline is one `.olai` file. Each line of it is one JSON object, and each object is one row of the outline.

```jsonl
{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}
```

Every `.olai` file in the directory olai serves is its own separate tree, so the `parent` field names a row in the same file.[^set] To link rows in different files you name the other row's id, in a mirror or in `after`, `blocks` or `see`.[^move]

## The two kinds of line

A line is either a regular row or a mirror, which shows a row that lives somewhere else.[^shapes] A mirror holds at most four keys: `id`, `parent`, `ord` and `mirror`.[^mirror]

## The fields a row can hold

olai writes each line's fields in the order of this table.[^omit]

| Field | Required | What it holds |
| --- | --- | --- |
| [`id`](#id) | both kinds | The row's id; it never changes |
| [`parent`](#parent) | no | The id of the row above this one |
| [`ord`](#ord) | both kinds | Its order among its siblings |
| [`title`](#title) | regular rows | The text of the row |
| [`mirror`](#mirror) | mirrors | The id of the row it shows |
| [`done`, `cancelled`, `doing`, `todo`](#done-cancelled-doing-todo) | no | The row's mark, at most one |
| [`started`](#started) | no | When the current stretch of work started |
| [`worked`](#worked) | no | Work recorded, in whole seconds |
| [`date`](#date) | no | The day it is scheduled for |
| [`repeat`](#repeat) | no | How often it comes back |
| [`desc`](#desc) | no | The note under the row |
| [`after`, `blocks`, `see`](#after-blocks-see) | no | Lists of ids of other rows |
| [`created`, `changed`](#created-changed) | no | When it was made, and last written |
| [`custom`](#custom) | no | Your own properties, any key |

## Your own keys, in `custom`

The top level of a line holds only the fields above. `custom` is the exception: you may put any key in there, holding text or a list of text.[^closed] Nothing in olai reads these keys.[^reads] A directory can declare a shape for one key's values ([properties.md](properties.md)), which limits the value and still gives the key no meaning.

```jsonl
{"id":"lane","ord":"a1","title":"the chat header goes stale","doing":true,"custom":{"agent":"claude-opus","pr":"https://github.com/juspay/olai/pull/176"}}
```

[^set]: An id is unique across every file in the directory olai serves, so you can move a row and everything under it into another outline and all of those ids stay the same. `outlines_move` takes a `parent`, or a `file` naming another outline, and `outlines_trash` moves a row and everything under it to `_olai/Trash.olai`.

[^move]: After a move, everything that pointed at the moved rows still finds them: mirrors, the three id lists, properties declared `node`, and pins. A dated row stays on the same day. One kind of property is stricter: a property declared `ref` requires its value to be a child of a named row, so moving such a row out of that parent is refused with `bad-prop` and nothing is written ([properties.md](properties.md)).

[^shapes]: A mirror is a second placement of a row that already exists, so every field describing the row itself is stored once, on the row itself. That is why there are two kinds of line rather than one kind with optional fields.

    A regular row must carry `id`, `ord` and `title`, and may carry any other field except `mirror`. There is no way to include one file in another: putting files in the same directory is the only way to bring outlines together.

[^mirror]: A mirror carries `id`, `ord` and `mirror`, plus `parent` unless it sits at the top level of its file. Any other field on it is refused with `bad-record`. It stores no mark, no properties and no note of its own, and the rows underneath belong to the row it points at, not to the mirror.

[^omit]: Fields are written in the table's order on every write. A field with no value is left out of the line, never written as `null` or `[]`. Required means olai refuses a line that does not carry it. Each field has its own entry in the first closed block at the foot of this page.

[^closed]: A key at the top level that this format does not know is refused with `bad-record`, naming the key, so a mistyped `titel` is caught instead of stored. Only the `custom` field itself is part of the format; what you put inside it is up to you. A key inside it means nothing to olai, so a value that looks like a URL is just a string that looks like a URL.

[^reads]: Nothing in olai reads a key inside `custom`. The journal reads `date`, the checkbox reads the marks, and the blocking graph reads `after`. A key inside `custom` is read by the person who wrote it, by `prop:` in a search query ([search.md](search.md)), and by the chips drawn in a row under a row's title ([editing.md](editing.md)).

<details>
<summary>Every field, and what it holds</summary>

### `id`

A slug you choose, or a short string olai makes up. It may hold letters, digits, `_`, `-` and `/`, which are the same characters a tag or an `@` mention may hold, so every id can be written as `@<id>` in a title or a note. A `/` inside an id is an ordinary character, exactly as it is inside a tag name.

An id is unique across every file olai has loaded, and it stays the same when the row is renamed or moved. An id holding any other character is refused with `bad-id`.

### `parent`

The id of a row in the same file. A row at the top level of its file has no `parent`. A `parent` naming a row in another file is refused with `foreign-parent`, because you place a row in another file with a `mirror`. A `parent` naming a mirror is refused with `parent-not-a-node`.

### `ord`

Where the row sorts among its siblings, written as a fractional index: a string of the characters `0-9A-Za-z`. Rows are sorted by comparing these strings as text; the string is never read as a number.

### `title`

The text of the row, stored exactly as it was typed. Tags are written inside it and are picked out when the row is drawn. `#topic` and `@person` are two markers over one set of characters (`[A-Za-z0-9_/-]`), so `#work/olai` is one tag. They are two separate sets of tags, so `#alice` and `@alice` are different tags. An `@` only starts a mention where a word starts, so `srid@srid.ca` stays an email address, while a `#` starts a tag anywhere.

A title is drawn as inline markdown only: bold, links and code work, and block elements such as headings and lists do not. It goes through the same sanitiser a note goes through.

### `done`, `cancelled`, `doing`, `todo`

The four marks. Each one holds `true`, or an ISO date or datetime saying when the row reached that state, and a row carries at most one of them. Any row may carry a mark, whether or not it has rows under it, and a row with no mark is not a task at all.

Marking a row `done` or `cancelled` finishes it, and olai writes the moment you did it, which is what puts the row on that day. See [dates-and-status.md](dates-and-status.md).

### `started`

An ISO datetime: when the current stretch of work started. `outlines_doing` writes it every time you start, so a row you start again measures the new stretch from then. Finishing the row keeps the stamp when a stretch was running, and removes it when none was.

When the `doing` mark comes off without the row being finished, through `outlines_todo` or by undoing the start, the stretch is added to `worked` and the stamp is removed along with the `doing`. A value holding a day and no time is refused with `bad-date`, because olai subtracts one instant from another to measure the stretch. This field puts the row on no day.

### `worked`

A whole number of seconds, never negative: the work already recorded on this row. A stretch of work ends when the `doing` mark comes off, and finishing the row or taking the mark off adds the stretch that just ended. Finishing a row with no stretch running adds nothing, so no stretch is counted twice.

No tool writes this field directly, and `outlines_prop` refuses the key and names the tools that do write it. No `worked` field means no work is recorded. `outlines_read` answers with `took`, which is `worked` plus the stretch running now while the row is `doing`; it is left out when there is no time to report.

### `date`

An ISO date or datetime: the day the row is scheduled for. A row carrying one appears on that day's page ([dates-and-status.md](dates-and-status.md)).

### `repeat`

How often the row comes back, written in this format's own short grammar: `every day`, `every week on monday`, `every month` or `every year`. It needs a `date` on the same row, which is the date it repeats from. Text the grammar cannot read is refused with `bad-repeat`, and so is a rule on a row with no `date`. Only the next occurrence carries the rule ([dates-and-status.md](dates-and-status.md)).

### `desc`

The note under the row: one string, which may contain newlines, stored exactly as it was typed. It is markdown, and is interpreted when it is drawn.

### `after`, `blocks`, `see`

Three lists of ids. A target may live in any file of the directory, and these three are the only relations this format has. `blocks` is shorthand: `a blocks b` means the same as `b after a`. `after`, with every `blocks` folded into it, must not form a loop, and it is what olai works out blocking from ([dates-and-status.md](dates-and-status.md)). `see` is a free cross-reference, and whatever it points at lists it back ([documents-and-kinds.md](documents-and-kinds.md)).

Each list holds a target once: a target named twice counts as named once. A `.olai` file is plain text, so a person or a git merge can write the same target twice, and `outlines_see`, `outlines_after` and `outlines_add` do nothing when you add a target that is already there.

Every reading of these lists collapses a repeated target. The exception is the two reads that hand back the stored line: `outlines_read` and `search_nodes` answer with these lists exactly as the file holds them.

### `created`, `changed`

Two ISO datetimes olai writes itself: `created` when the row is first made, and `changed` on every write to it after that. No tool writes either one, and `outlines_prop` refuses both by name. Both are absent on a row olai never wrote, and olai never invents a history it did not see.

A `created` with no `changed` beside it means nothing has been written to that row since it was made. The commit panel never lists `changed` as a change, because every write updates it.

### `custom`

The one open field: a map of your own keys and values, which olai gives no meaning to. The one exception is a property declared with the type `chat-agent-session`, described below.

### `mirror`

The id of the row this line shows a second time. The target may live in any file of the directory, and may itself be a mirror: olai follows the chain to the regular row at the end of it. A mirror placed inside the rows it shows is refused with `mirror-cycle`.

</details>

<details>
<summary>Writing a property, what the chips read, and what a file holds</summary>

The chips drawn under a row's title ask one question of a value: does this string name a file, a row, a day or a URL that olai can open? If it does, the chip becomes a link. Every read that returns a row returns the whole `custom` map as it stands, a search hit as much as `outlines_read`.

### Writing a property

`outlines_prop` takes `{id, key, value}`, and a `value` of `null` or `""` removes the key. A write may also carry `was`, the value it expects to find there, with `null` meaning the key should not exist yet.

With `was`, the write happens only if the key still holds exactly that value, and is otherwise refused with what the key says now. That is what the chips send, because the editing box opened on the value as it was read. Without `was`, the write happens whatever the key holds.

A key that matches, ignoring case, one of this format's own field names or the word `status` is refused, and the refusal names the tool that writes that fact instead. A field and a key inside `custom` are two separate places, so `{"done":true,"custom":{"done":"yesterday"}}` is a legal line and a confusing one.

Three tools write a property, and all three go through the same code: `outlines_prop`, the `props` argument of `outlines_add` when a row is created, and the `props` argument of `outlines_update`, which merges key by key onto a row that exists. The refusal for a key that shadows a field is the same sentence in all three.

### What a file holds

Inside `custom`, keys are written in alphabetical order, and a key with no value is not written at all. Those are the same two rules the fields above follow, one level in. A map with no keys left is written as no `custom` field at all, rather than as `{}`.

A read answers with the same map a write would produce, so a key with no value is missing from a search hit and from `outlines_read` just as it is missing from the line on disk.

</details>

<details>
<summary>The <code>chat-agent-session</code> and <code>chat-opens</code> keys</summary>

### `chat-agent-session`

This is the one exception, and it is a type the chat plugin declares rather than a key olai itself reads. A row carrying a property of that type is a node agent: an agent that lives on a row. A Markdown document carrying the same key in its front matter is a document with a chat of its own.

The row's title is the agent's name, the note under it is the agent's instructions, and the rows beneath it are its memory. A document is itself the memory of its chat. The list of chats in the sidebar is every row and document carrying this key ([node-agents.md](node-agents.md)). The chat plugin contributes the type, so a serve running without chat does not read it ([live-properties.md](live-properties.md)).

One key holds two things, which engine the agent runs on and which conversation it is talking through, split at the first colon:

```
chat-agent-session: claude          a node agent nobody has started a session for
chat-agent-session: claude:0f3c…    ...and one that is talking through that conversation
```

The engine is required and the session is optional, so a row is a node agent as soon as the value is there, and the second half says which conversation it is using. Only the first colon splits the value: an engine id is one of olai's own short names and holds no colon, while a session id comes from the engine and may hold several. A directory can put this type on a key of its own name ([plugins/chat.md](plugins/chat.md)).

An agent writing through olai cannot set this key, take it off, or change it, on a row or in a document's front matter. The write is refused with *it is what ties a conversation to a node or a note, and that is a person's own gesture*.

### `chat-opens`

The second key a document's front matter keeps, beside the tie: where that document's chat opens when you press it in **Chats** or the palette.

| Value | What it means |
| --- | --- |
| `alone` | the chat's own page, by itself |
| `beside` | the document on the left and the chat on the right |
| the key absent | the same as `alone` |

The **Opens** switch on the chat's page writes it, and olai takes it off again when the chat is closed. Anything other than `beside` reads as `alone`. A row has no such key, so a row's chat always opens alone. A directory can put this type on a key of its own name too.

An agent writing through olai cannot set this key, take it off, or change it either. That write is refused with *it is whether a note's chat opens beside the page, and that is the person's choice on the note*.

</details>

<details>
<summary>Files from an older directory</summary>

olai reads the suffixes its file kinds claim, and a `.jsonl` is not one of them: it sits in a served directory as an unclaimed file, like a `.txt`. Rename them once, from the directory:

```sh
git ls-files '*.jsonl' | while read -r f; do git mv "$f" "${f%.jsonl}.olai"; done
```

(Use `mv` instead of `git mv` outside a repository.)

A `doc` field at the top level of a line is not part of a record: it is refused with `bad-record`, like any other unknown key. Attach material with a markdown link in the note instead. To keep what those fields held as ordinary properties inside `custom`, run this from the directory:

```bash
git ls-files -z '*.olai' | while IFS= read -r -d '' file; do
  grep -q '"doc"[[:space:]]*:' "$file" || continue
  jq -c 'if .doc then .custom = ((.custom // {}) + {doc: .doc}) | del(.doc) else . end' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done
```

A `doc` key inside `custom` that nothing declares is an ordinary property: when its value names a file this directory serves, its chip becomes a link to that file. Declaring a `doc` property type in `_olai/Properties.olai` is a rule about what the value may be ([properties.md](properties.md)).

</details>
