# Search

One query language, several doors: the header's search box, the palette, the pickers under a row, and an agent's `search_nodes`.[^scope]

## Words, phrases and joiners

A word is a case-folded substring, looked for in four fields of a node.[^fields] Every word must be in the same node, and olai finds the words you type, never what they mean.[^joiners]

| Written | Selects |
| --- | --- |
| `cabinets` | the word anywhere in one of the four fields |
| `kitchen remodel` | both words, in one node, in either order |
| `"kitchen remodel"` | that line, as one substring[^quotes] |
| `kitchen OR bathroom` | either side |
| `-cabinets` | takes those rows back out[^dash] |

## The operators you reach for

| Written | Asks |
| --- | --- |
| `is:todo` | what the node is |
| `has:date` | which fields the record carries |
| `date:today` | the day the journal reads it on |
| `changed:last-week` | the two stamps olai writes |
| `prop:stage="in review"` | the node's own properties |

A colon after anything else is a colon in a word: `TODO:` and `http://…` are ordinary text. Every value is in the block below.

## What a hit carries

Title hits outrank id, tag and note.[^rank] A hit names the address, the ancestors and the record's own fields; documents rank on the same scale.

## Where you search

| Door | What it is |
| --- | --- |
| the header's search box | desktop and up: type, arrow up and down, `Enter` to open, `Escape` to clear |
| the magnifier | the same place on a phone, opening the palette |
| the palette | `Cmd` + `K`, which is `Ctrl` elsewhere[^palette] |
| a panel under a row | the `((` widget, the edge panel's box, and the move-to picker[^panels] |
| the chat composer's `@` list | names one node to put in a message ([chat.md](chat.md)) |
| `search_nodes` | the same answer for an agent, over MCP[^agent] |

Both listing boxes draw at most eight hits.[^eight]

## What a query is refused for

A refusal names the rule you broke, says which values the operator takes, and quotes what you typed, case and all.[^refusal] The query selects nothing.

[^scope]: Narrowing the page in front of you, rather than searching the directory, is [filtering.md](filtering.md).

[^fields]: The four fields are a node's title, its id, the tags written in it, and its note. A tag is indexed twice, bare and as written, so `alice` finds `@alice` and `@alice` finds only the one with that sigil.

[^joiners]: The space between two tokens is "and", and `OR` binds tighter than it: `#home kitchen OR bathroom` is `#home` and one of the other two. A chain `a OR b OR c` is one group, either side may be an operator (`is:todo OR is:doing`), and there are no parentheses. `OR` is the one token that is not case-folded. Lower-case `or` is a word to find, and `"OR"` finds the word in capitals.

[^quotes]: A quoted phrase is a substring of the field's own text, so it does not cross the line break a note keeps. An id and a tag hold no space, so a phrase with one is never found in either. A quote opens a region wherever it sits, and that region has to be closed. Quoting is also how a value with a space is written: `prop:stage="in review"`. `"is:done"` selects the text `is:done`, never the operator.

[^dash]: One leading dash negates. A second is a character, so `--is:done` looks for that text and finds it where somebody typed it. The dash goes outside the quotes; inside them it is a character, which is how `"-force"` is searched for. A group is not negated as a group: `-a -b` is neither of them, and `-a OR -b` is not both of them.

[^rank]: A field that starts with the word beats one that buries it, and a settled node loses ties, since `done` and `cancelled` are not what is on your plate. Mirrors are never hits: a placement is a second view of a node, not a node. The closed blocks below hold every field a hit carries and what a document is matched on.

[^palette]: The palette lists the shell's commands first, then the hits. A query carrying a `+` prefix is a line being captured rather than a lookup, and nothing is asked of the server for it ([getting-around.md](getting-around.md)).

[^panels]: The three panels under a row cap at eight hits and carry no kind selector. The move-to picker draws a refusal beside a destination the row cannot go to ([organising.md](organising.md)).

[^agent]: A serve that does not run the search plugin answers every door here with no hits ([plugins/search.md](plugins/search.md)).

[^eight]: Both listing boxes draw at most eight hits, and say `8 of 90 matches` under them whenever more matched than fit. There is no results page and no larger limit: narrow it with the box or the selector.

[^refusal]: A refusal quotes what you typed, case and all: `IS:DONE` works, and a refusal for `is:OPEN` says `is:OPEN`. Every refusal is in a closed block below.

<details>
<summary>Every operator, and the values it takes</summary>

### `is:`

What the node is. It takes one of eight values, and nothing else.

| Value | Selects |
| --- | --- |
| `is:done` `is:cancelled` `is:doing` `is:todo` | the mark the node stores |
| `is:marked` | any of the four |
| `is:blocked` | a node waiting on something unsettled |
| `is:mirrored` | a node some placement draws somewhere else |
| `is:trashed` | what was put away |

- The mark is the stored one, never a derived one: a parent whose children are all ticked is not `is:done` unless somebody ticked it ([dates-and-status.md](dates-and-status.md)).
- `is:marked -is:done -is:cancelled` is work that is unsettled, whichever marks the format grows.
- `is:blocked` reads the derivation the page draws, so it crosses files. A `done` target clears the way, and so does a `cancelled` one.
- `is:mirrored` asks whether the node is drawn elsewhere, not whether this record is a placement. A copy filed in a trash counts; a placement that dangles or closes a loop mirrors nothing.
- Archived nodes are out of every reading unless the query says `is:trashed`. The two doors that already show them, the trash and a zoom onto an archived node, filter their own rows without it.

### `has:`

Which fields the record carries. It takes one of `desc`, `date`, `created`, `changed`, `see`, `after` or `repeat`. An empty edge list is no edge.

- `has:date`, `has:created` and `has:changed` are the three day operators asked with no bounds, so a pair of them cannot disagree.
- `has:repeat` asks after the rule, not the day it repeats from. Every repeating node is dated, so `has:date -has:repeat` is everything dated once.
- Only the occurrence that is next carries the rule, so `has:repeat` is the live head of a recurrence and never the finished records behind it.
- `has:created -has:changed` is a node nothing has been written to since it was captured.

### `date:`

The day the journal reads a node on: what it is scheduled for, when it was finished, and when it was called off. A dated `doing` or `todo` is on no day here, exactly as on the day page ([dates-and-status.md](dates-and-status.md)). It takes every value in the day values below.

### `created:` and `changed:`

The two stamps olai writes. `created` goes on when the node is captured; `changed` is re-put every time anything is written to it afterwards ([format.md](format.md)).

- One node answers three different days: scheduled for the 10th, captured on the 1st, last written today.
- `changed:today` is what you touched today, `created:last-week` is what arrived, and `-changed:last-month` is what has gone quiet.
- A node with no stamp is not found, however wide the span: `created:2000..` does not reach it, and nothing invents a past for it.
- `-has:created` answers with every unstamped node, the way `-has:date` answers with the undated.

### `prop:`

The node's own properties — the custom map, and nothing else ([properties.md](properties.md)). A field is not a property: `prop:done` finds nothing, because a mark is asked about with `is:done`.

| Written | Selects |
| --- | --- |
| `prop:pr` | a node carrying that key at all |
| `prop:agent=claude-opus` | a node carrying it with that value |
| `prop:records=190..200` | a span, on a key declared `int` or `date` |

```
prop:records=190..200               a count in a range
prop:dispatched=2026-08-20..        every lane dispatched since the 20th
prop:dispatched=last-week..today    the day words, unchanged
prop:merge=auto is:todo             equality on a ref, exactly as before
```

- A list value matches on any member, and a ref's value is the variant's id: `prop:merge=auto`, never `prop:merge=automatic`.
- The key is folded like every other token, so `prop:PR` asks about a key declared as `pr`.
- An `int` compares as a number, so `prop:records=9..200` does not answer `1000`. A leading zero is refused at the query as it is at the write.
- A `date` compares as text at each bound's own width, and takes every value `date:` takes. A bare day is that day's span.
- A range on any other key is refused, naming what the key is. The rule is "reads as a range": `prop:worktree=../sibling` and `prop:version=1.0..2.0` are the equalities they look like.

### The day values

`date:`, `created:` and `changed:` share one value grammar, so learning one is learning all three.

| Written | Means |
| --- | --- |
| `2026-08-10` `2026-08` `2026` | a day, a month, a year |
| `today` `yesterday` `tomorrow` | the day the query is asked on, and the two beside it |
| `this-week` `last-month` `next-year` | `this-`, `last-` or `next-` over `week`, `month` or `year` |
| `2026-08-01..2026-08-14` `..2026-08-10` `last-week..` | an inclusive span, either end optional |
| `1h` `30m` `2d` `1w` | within the last hour, half hour, two days, week |
| `..1h` | older than an hour |
| `2h..30m` | a window, the older bound first |
| `yesterday..3h` | a day word at one end, a clock face at the other |

- The duration units are four letters: `m` minutes, `h` hours, `d` days, `w` weeks. The count is an ordinary number, so `changed:90m` is an hour and a half.
- A bare duration is the range it opens: `created:1h` is `created:1h..`.
- There are no month or year units. `created:1mo` and `created:1y` are refused, and values are folded, so `created:1M` is one minute.
- `1d` is a rolling day where `today` is since midnight, and `changed:1w` is the last seven days where `changed:this-week` starts on Monday.
- A week runs Monday to Sunday, the count the sidebar's calendar lays its columns out by.
- Comparison is over text at each bound's width. A day bound reads the ten characters in front of the `T`; a duration bound reads the clock face too, which is what lets `changed:30m` reach a stamp's seconds.
- A bare day sorts before every moment on that day, so `date:1h` selects work finished inside the hour rather than the day's plans.
- A duration subtracts wall-clock time, carrying the stamp's own offset, so it is off by the difference where a stamp was written under another one.
- What day it is comes from the server's clock at every door, so `date:today` is the day it is where the files are, whatever zone you are reading in.
- Nothing re-asks on a timer. A page left untouched for two hours goes on showing the hour it last asked about; a page left open past midnight re-reads its query against the new day when the question is asked again.

</details>

<details>
<summary>Every refusal, and the one door whose refusals differ</summary>

| Written | Refused because |
| --- | --- |
| `is:open` | a known operator with a value it does not take |
| `date:soon` `date:tomorrowish` | a relative word the vocabulary does not hold |
| `created:1mo` `created:1h30m` `created:1x` | not one duration in the four units |
| `created:999999w` | a count that lands on no day this format can spell |
| `date:2026-13` `date:2026-08-32` | a date no calendar could hold |
| `"pick the` `36"` | a quote nothing closes, wherever it sits |
| `kitchen OR` | a joiner missing one of the two things it joins |
| `""` | an empty needle, which is inside every node ever written |
| `prop:stage=` | a key holding nothing |
| `prop:stage=a..b` | a range on a key nothing declares `int` or `date` |
| `date: 2026-08` | no value: a space after the colon splits it into two words |

`date:2026-02-30` is accepted and finds nothing, because telling it from `2026-01-30` needs a calendar and nothing here parses a date into one.

The refusal reaches every door, with one gap. The filter box parses in the browser and draws its own refusal instantly, but it holds no directory to read a declaration out of, so an untyped range comes back there with no rows and no sentence.

</details>

<details>
<summary>Every field a hit carries, and what an agent asks for</summary>

| Field | Holds |
| --- | --- |
| the address | `#a1b2c3` for a record, `notes/plan.md` for a file |
| `file:line` | where the record is written |
| `path`, `pathIds` | the ancestor titles, and their ids in the same order |
| `parent` | the parent node's id, absent at a root |
| the mark, `see`, `after`, `custom` | what the record carries, whole |
| `matched` | which of the four word fields carried the words |
| `matchedProps` | the keys a `prop:` clause selected on, in the node's own spelling |

- `matched` is absent for a query that named no words, and `matchedProps` for one that named no property. Neither names a negated clause: a node found by `-prop:agent` was not found on `agent`.
- Property values travel whole, never cut at a length and never reduced to their keys, so a board is one query rather than one call per row.

An agent's `search_nodes` adds what only an agent asks for. `limit` is the size of the answer. `withDesc: true` brings each node's note with it, and is off by default. A scope is `file` for one outline, or `under` for a node and everything beneath it.

A `kind` narrows what an answer may hold: `node` for records, `document` for markdown and the files olai only shows, `outline` for outline files, or `file` for both kinds of file. With no kind named, every arm is ranked and capped together.

</details>

<details>
<summary>Inside each door: the selector, the counts, and following the directory</summary>

An open palette or header search follows the directory without another keystroke: matches that leave stop being drawn, new ones arrive, and the counts move with them.

### All, Rows and Files

The palette and the header box carry a selector under the box: **All**, **Rows** for records, and **Files** for outlines, markdown documents, saved HTML, CSV files, images and PDFs. `Tab` cycles the segments while the caret is in either box.

- The pick sets the request's kind before the answer is capped; it never filters an answer that was already cut short.
- It lasts for this browser session, is shared by both boxes, and survives a reconnect. A page load puts it back to **All**.

### How much was left out

When everything found is on screen the boxes say nothing at all, and **Files** with `is:done` says `0 matches`.

`Enter` takes a row of the list in front of you. A search settles for a fifth of a second before it asks, and `Enter` inside that gap does nothing rather than opening what the query before last found; a click is never held back. In chat, a query containing spaces needs an arrow selection first, or `Enter` sends the message as you typed it.

</details>

<details>
<summary>Documents and the other files</summary>

A search reaches both kinds of thing the directory holds, ranked together on one scale, so a document whose title holds your word outranks a node that only mentions it in a note.

| A record is matched on | A document is matched on |
| --- | --- |
| `title`, what it calls itself | `title`: its first non-empty line without the heading marks, or its filename |
| `id`, for when you know which one | `path`, folded whole and by its name alone, so `cabinets` finds `notes/cabinets.md` |
| the `#topic` and `@person` in its prose | the same, read by the same walk |
| `desc`, its note | `body`, the prose itself |

- `prop:` selects documents out of the frontmatter at the top of the file, the same open namespace a node's properties are ([documents-and-kinds.md](documents-and-kinds.md)).
- The frontmatter is not the document's prose: a word only that block holds is found by `prop:` and not by typing it.
- An operator over a field a document does not have selects no document, so no document is `is:done` or `created:last-week`. A negated clause is satisfied: a document is not finished.
- A frontmatter `date:` is a property named `date`, found by `prop:date`.
- A scoped `file` or `under` query selects no documents at all: both ask where a record sits in a tree.
- A saved page, a CSV file, an image and a PDF are kept by name and not by their bytes, so each is found by what it is called and by nothing inside it.
- An outline's own name and path match too: `Home` finds `Home.olai`, and `Enter` opens the outline. Operators select no outlines, and files under `_olai/` never appear as outline hits.
- A body hit on a markdown document carries its line. Opening it from the palette or the header sets `?q=<query>#L<line>`, scrolls to the rendered block holding that source line and lights the query's words there; the address is shareable, and Back returns to the page you searched from.
- A blank line or an opening fence marker lands on the block before it, and a line past the end of the file opens at the top without an error.
- Neither listing box makes a file: **New document** and **New outline** are in the sidebar ([getting-around.md](getting-around.md)).

</details>
