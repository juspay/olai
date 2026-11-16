# Search

olai has one query language. You type it in the header's search box, in the palette or in a picker under a row; an agent calls `search_nodes`.[^scope]

## Words, phrases and joiners

A word matches any part of four fields on a row, one line of an outline; capitals are ignored.[^fields] All your words must be on one row, and olai matches the words you type, not their meaning.[^joiners]

| Written | Selects |
| --- | --- |
| `cabinets` | anywhere in one of the four fields |
| `kitchen remodel` | both words, one row, either order |
| `"kitchen remodel"` | those words together, as typed[^quotes] |
| `kitchen OR bathroom` | either word |
| `-cabinets` | removes rows holding that word[^dash] |

## The operators you use most

| Written | Asks |
| --- | --- |
| `is:todo` | the mark the row carries |
| `has:date` | which fields the row has |
| `date:today` | the day a row appears on |
| `changed:last-week` | the two timestamps olai writes |
| `prop:stage="in review"` | a key and value written on the row |

A colon elsewhere is part of a word: `TODO:` and `http://…` are ordinary text. Every operator's values are listed below. A match in a title ranks above one in an id, a tag or a note.[^rank]

## Where you search

| Where | What it is |
| --- | --- |
| the header's search box | on a desktop: type, arrow up and down, `Enter` opens, `Escape` clears |
| the magnifier | the same place on a phone; opens the palette |
| the palette | what `Cmd` + `K` opens, or `Ctrl` + `K` elsewhere[^palette] |
| a panel under a row | the `((` mirror widget, the box for what a row waits for, the move-to picker[^panels] |
| the chat composer's `@` list | names one row in a message ([chat.md](chat.md)) |
| `search_nodes` | the same answer for an agent, over MCP[^agent] |

The palette and the search box draw at most eight results.[^eight]

## When a query is refused

A refusal names the rule you broke, the values the operator takes, and what you typed, capitals and all.[^refusal] The query selects nothing.

[^scope]: Narrowing the page in front of you, rather than searching the whole directory olai serves, is [filtering.md](filtering.md).

[^fields]: The four fields are a row's title, its id, the tags written in it, and its note. A tag is indexed twice, with and without its sign, so `alice` finds `@alice`, and `@alice` finds only the tag written with that sign.

[^joiners]: A space between two words means "and", and `OR` binds more tightly than the space: `#home kitchen OR bathroom` means `#home` and one of the other two words. A chain `a OR b OR c` is one group, either side may be an operator (`is:todo OR is:doing`), and there are no parentheses. `OR` is the one token whose capitals matter. Lower-case `or` is a word to look for, and `"OR"` finds the word written in capitals.

[^quotes]: A quoted phrase has to appear as written inside one field, so it never crosses the line break in a note. An id and a tag hold no space, so a phrase with one in it is never found in either. A quote opens wherever it sits, and has to be closed. Quotes are also how you write a value with a space in it: `prop:stage="in review"`. `"is:done"` looks for the text `is:done` and never for the operator.

[^dash]: One dash in front of a term takes its rows out. A second dash is an ordinary character, so `--is:done` looks for that text and finds it where somebody typed it. The dash goes outside the quotes; inside them it is a character, which is how you search for `"-force"`. A group is not negated as a group: `-a -b` selects rows with neither of them, and `-a OR -b` does not select rows missing both.

[^rank]: A result names the row, where it sits and the fields the row carries, and a `.md` document is ranked on the same scale as a row. A field that starts with your word beats one that has it buried. A finished row loses ties, since `done` and `cancelled` are not what is on your plate. A mirror, a row standing for another row, is never a result: it is a second view, not a row.

[^palette]: The palette lists olai's own commands first, then the results. A query that starts with `+` is a line you are capturing rather than a lookup, and nothing is asked of the server for it ([getting-around.md](getting-around.md)).

[^panels]: The three panels under a row each draw at most eight results and have no kind selector. The move-to picker draws a refusal beside a destination the row cannot be moved to ([organising.md](organising.md)).

[^agent]: An olai serving without the search plugin switched on answers every one of these places with no results ([plugins/search.md](plugins/search.md)).

[^eight]: The palette and the header's box each draw at most eight results, and say `8 of 90 matches` underneath whenever more matched than fit. There is no results page and no larger limit: narrow the query in the box, or with the selector.

[^refusal]: A refusal quotes what you typed with its capitals: `IS:DONE` works, and a refusal for `is:OPEN` says `is:OPEN`. Every refusal is in a closed block below.

<details>
<summary>Every operator, and the values it takes</summary>

### `is:`

Which mark or state the row has. It takes one of eight values, and nothing else.

| Value | Selects |
| --- | --- |
| `is:done` `is:cancelled` `is:doing` `is:todo` | the mark the row carries |
| `is:marked` | any of the four |
| `is:blocked` | a row waiting for a row that is not finished |
| `is:mirrored` | a row that some mirror draws somewhere else |
| `is:trashed` | what was put in the trash |

- The mark is the one written on the row, never one worked out from its children: a parent whose children are all ticked is not `is:done` unless somebody ticked it ([dates-and-status.md](dates-and-status.md)).
- `is:marked -is:done -is:cancelled` is work that is unfinished, whichever marks the format grows later.
- `is:blocked` is worked out exactly as a page works it out, so it crosses files. A row you are waiting for clears the way when it carries `done`, and a `cancelled` one clears it too.
- `is:mirrored` asks whether the row is drawn elsewhere by a mirror, a row that stands for another row, not whether this row is itself a mirror. A copy filed in a trash counts; a mirror that points at nothing, or that closes a loop, mirrors nothing.
- Trashed rows are left out of every query unless it says `is:trashed`. The two places that already show them, the trash page and a trashed row opened as its own page, filter their own rows without it.

### `has:`

Which fields the row carries. It takes one of `desc`, `date`, `created`, `changed`, `see`, `after` or `repeat`. An empty list of edges counts as no edge.

- `has:date`, `has:created` and `has:changed` are the three day operators asked with no bounds, so a pair of them can never disagree.
- `has:repeat` asks after the rule, not after the day it repeats from. Every repeating row is dated, so `has:date -has:repeat` is everything dated that does not repeat.
- Only the occurrence that is next carries the rule, so `has:repeat` finds the live occurrence of a repeating row and never the finished ones behind it.
- `has:created -has:changed` is a row nothing has been written to since it was captured.

### `date:`

The day a row appears on: the day it is scheduled for, the day it was finished, and the day it was called off. A `doing` or a `todo` with a date in it is on no day here, exactly as on the day page ([dates-and-status.md](dates-and-status.md)). It takes every value in the day values below.

### `created:` and `changed:`

The two timestamps olai writes. `created` goes on when the row is captured; `changed` is written again every time anything is written to the row afterwards ([format.md](format.md)).

- One row answers three different days: scheduled for the 10th, captured on the 1st, last written today.
- `changed:today` is what you touched today, `created:last-week` is what arrived, and `-changed:last-month` is what has gone quiet.
- A row with no timestamp is not found, however wide the span: `created:2000..` does not reach it, and nothing invents a past for it.
- `-has:created` answers with every row that has no timestamp, the way `-has:date` answers with the undated ones.

### `prop:`

The row's own properties, which are the keys and values you write on it, and nothing else ([properties.md](properties.md)). A built-in field is not a property: `prop:done` finds nothing, because a mark is asked about with `is:done`.

| Written | Selects |
| --- | --- |
| `prop:pr` | a row carrying that key at all |
| `prop:agent=claude-opus` | a row carrying it with that value |
| `prop:records=190..200` | a range, on a key declared `int` or `date` |

```
prop:records=190..200               a count in a range
prop:dispatched=2026-08-20..        every lane dispatched since the 20th
prop:dispatched=last-week..today    the day words, unchanged
prop:merge=auto is:todo             a ref matched by its id
```

- A list value matches on any member, and the value of a ref is the variant's id: `prop:merge=auto`, never `prop:merge=automatic`.
- Capitals are ignored in the key, as in every other word, so `prop:PR` asks about a key declared as `pr`.
- An `int` is compared as a number, so `prop:records=9..200` does not answer `1000`. A leading zero is refused in a query as it is in a write.
- A `date` is compared as text at each bound's own width, and takes every value `date:` takes. A single day means that whole day.
- A range on any other key is refused, and the refusal says what the key is. The test is whether the value reads as a range: `prop:worktree=../sibling` and `prop:version=1.0..2.0` are the equalities they look like.

### The day values

`date:`, `created:` and `changed:` share one set of values, so learning one is learning all three.

| Written | Means |
| --- | --- |
| `2026-08-10` `2026-08` `2026` | a day, a month, a year |
| `today` `yesterday` `tomorrow` | the day the query is asked on, and the two beside it |
| `this-week` `last-month` `next-year` | `this-`, `last-` or `next-` over `week`, `month` or `year` |
| `2026-08-01..2026-08-14` `..2026-08-10` `last-week..` | a span including both ends, either end optional |
| `1h` `30m` `2d` `1w` | within the last hour, half hour, two days, week |
| `..1h` | older than an hour |
| `2h..30m` | a window, the older bound first |
| `yesterday..3h` | a day word at one end, a length of time at the other |

- The duration units are four letters: `m` minutes, `h` hours, `d` days, `w` weeks. The count is an ordinary number, so `changed:90m` is an hour and a half.
- A bare duration is the range it opens: `created:1h` is `created:1h..`.
- There are no month or year units. `created:1mo` and `created:1y` are refused, and capitals are ignored in a value, so `created:1M` is one minute.
- `1d` is a rolling day, where `today` means since midnight, and `changed:1w` is the last seven days, where `changed:this-week` starts on Monday.
- A week runs Monday to Sunday, which is how the sidebar's calendar lays its columns out.
- Comparison is over text at each bound's width. A day bound reads the ten characters in front of the `T`; a duration bound reads the time of day too, which is what lets `changed:30m` reach the seconds in a timestamp.
- A bare day sorts before every moment on that day, so `date:1h` selects work finished inside the hour rather than that day's plans.
- A duration subtracts wall-clock time, carrying the timestamp's own offset, so it is out by the difference where a timestamp was written in another time zone.
- Which day it is comes from the server's clock everywhere, so `date:today` is the day it is where the files are, whatever zone you are reading in.
- Nothing re-asks on a timer. A page left untouched for two hours goes on showing the hour it last asked about; a page left open past midnight re-reads its query against the new day the next time the question is asked.

</details>

<details>
<summary>Every refusal, and the one place whose refusals differ</summary>

| Written | Refused because |
| --- | --- |
| `is:open` | a known operator with a value it does not take |
| `date:soon` `date:tomorrowish` | a relative word the vocabulary does not hold |
| `created:1mo` `created:1h30m` `created:1x` | not one duration in the four units |
| `created:999999w` | a count that lands on no day this format can write |
| `date:2026-13` `date:2026-08-32` | a date no calendar could hold |
| `"pick the` `36"` | a quote nothing closes, wherever it sits |
| `kitchen OR` | a joiner missing one of the two things it joins |
| `""` | an empty search text, which every row ever written contains |
| `prop:stage=` | a key with nothing after the `=` |
| `prop:stage=a..b` | a range on a key nothing declares `int` or `date` |
| `date: 2026-08` | no value: a space after the colon splits it into two words |

`date:2026-02-30` is accepted and finds nothing, because telling it apart from `2026-01-30` needs a calendar, and nothing here turns a date into one.

The refusal reaches every place you can search, with one gap. The filter box above a page reads the query in the browser and draws its own refusal instantly. It holds no directory to read a property declaration out of, so a range on an untyped key comes back there with no rows and no sentence.

</details>

<details>
<summary>Every field a result carries, and what an agent asks for</summary>

| Field | Holds |
| --- | --- |
| the address | `#a1b2c3` for a row, `notes/plan.md` for a file |
| `file:line` | where the row is written |
| `path`, `pathIds` | the titles of the rows above it, and their ids in the same order |
| `parent` | the parent row's id, absent at a top-level row |
| the mark, `see`, `after`, `custom` | what the row carries, whole |
| `matched` | which of the four word fields carried the words |
| `matchedProps` | the keys a `prop:` clause selected on, in the row's own spelling |

- `matched` is absent for a query that named no words, and `matchedProps` for one that named no property. Neither names a clause you negated: a row found by `-prop:agent` was not found on `agent`.
- Property values travel whole, never cut at a length and never reduced to their keys, so a board is one query rather than one call per row.

An agent's `search_nodes` adds what only an agent asks for. `limit` is how many results come back. `withDesc: true` brings each row's note with it, and is off by default. A scope is `file` for one outline, or `under` for a row and everything beneath it.

A `kind` narrows what an answer may hold: `node` for rows, `document` for markdown and the files olai only shows, `outline` for outline files, or `file` for both kinds of file. With no kind named, every kind is ranked and capped together.

</details>

<details>
<summary>Inside the search boxes: the selector, the counts, and following the directory</summary>

An open palette or header search follows the directory without another keystroke: results that stop matching stop being drawn, new ones arrive, and the counts move with them.

### All, Rows and Files

The palette and the header box carry a selector under the box: **All**, **Rows** for rows, and **Files** for outlines, markdown documents, saved HTML pages, CSV files, images and PDFs. `Tab` moves through the three while the caret is in either box.

- The pick sets the kind on the request before the answer is capped; it never filters an answer that was already cut short.
- It lasts for this browser session, is shared by both boxes, and survives a reconnect. Loading the page puts it back to **All**.

### How much was left out

When everything found is on screen the boxes say nothing at all, and **Files** with `is:done` says `0 matches`.

`Enter` opens the result the list has selected. A search waits a fifth of a second before it asks, and `Enter` inside that gap does nothing rather than opening what the query before last found; a click is never held back. In chat, a query with a space in it needs you to pick a result with the arrow keys first, or `Enter` sends the message as you typed it.

</details>

<details>
<summary>Documents and the other files</summary>

A search reaches both kinds of thing the directory holds, rows and files, ranked together on one scale, so a document whose title holds your word outranks a row that only mentions it in a note.

| A row is matched on | A document is matched on |
| --- | --- |
| `title`, what it calls itself | `title`: its first non-empty line without the heading marks, or its filename |
| `id`, for when you know which one | `path`, matched whole and by its filename alone, so `cabinets` finds `notes/cabinets.md` |
| the `#topic` and `@person` in its prose | the same, found the same way |
| `desc`, its note | `body`, the prose itself |

- `prop:` selects documents on the frontmatter at the top of the file, which is the same open set of keys a row's properties are ([documents-and-kinds.md](documents-and-kinds.md)).
- The frontmatter is not the document's prose: a word only that block holds is found by `prop:` and not by typing it.
- An operator over a field a document does not have selects no document, so no document is `is:done` or `created:last-week`. A negated clause is satisfied: a document is not finished.
- A `date:` key in frontmatter is a property named `date`, found by `prop:date`.
- A query scoped with `file` or `under` selects no documents at all: both ask where a row sits in a tree.
- A saved web page, a CSV file, an image and a PDF are matched by their name and not by their contents, so each is found by what it is called and by nothing inside it.
- An outline's own name and path match too: `Home` finds `Home.olai`, and `Enter` opens the outline. Operators select no outlines, and files under `_olai/` never appear as outline results.
- A match in the body of a markdown document carries its line. Opening it from the palette or the header sets `?q=<query>#L<line>`, scrolls to the rendered block holding that source line and lights the query's words there; the address can be shared, and Back returns to the page you searched from.
- A blank line or an opening fence marker lands on the block before it, and a line past the end of the file opens at the top without an error.
- Neither search box makes a file: **New document** and **New outline** are in the sidebar ([getting-around.md](getting-around.md)).

</details>
