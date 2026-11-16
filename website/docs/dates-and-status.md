# Marks, days and repeating

A row is one line of an outline. It can carry a mark such as `done`, a date that puts it on a day, and a rule that repeats it.

## The four marks

A row carries one mark at most.[^scope]

| Mark | Its checkbox | Counts as finished | Written by |
| --- | --- | --- | --- |
| `done` | ticked, title struck through | yes | `outlines_done` |
| `cancelled` | crossed, title struck through | yes | `outlines_cancelled` |
| `doing` | half-filled | no | `outlines_doing` |
| `todo` | empty | no | `outlines_todo` |

A row carrying `done` or `cancelled` is finished: nobody owes anything on it.[^settles] A row with no mark is not a task.[^bullet]

## What the marks decide

A row's state is the mark written on it, and nothing else.[^stored] Everything else olai shows is worked out from the marks.

## The two rules on writing a mark

A row marked `done` may not have unfinished work under it.[^open] `outlines_done` on such a row is refused,[^refused] and open work landing under a `done` row takes that mark off.[^reopen] `outlines_doing` is refused while another row must come first.[^doing]

## Days

olai reads your rows' dates when it draws the journal: the calendar, day pages and today's page.[^derived] Three fields put a row on a day, in the same way.[^placing]

| Field | What it says |
| --- | --- |
| `date` | the day the row is scheduled for |
| `done` with a time | the moment the work was finished |
| `cancelled` with a time | the moment the work was called off |

A `.md` file named after a date is that day's note.[^note]

## Repeating

A dated row can say how often it comes back, and finishing it creates the next one.[^completing] There are four rules and no others.[^closed]

| Rule | The next one falls on |
| --- | --- |
| `every day` | the day after |
| `every week on <weekday>` | the next `monday` … `sunday` after it |
| `every month` | the same day next month, moved back to one that exists[^clamp] |
| `every year` | twelve months on, moved back the same way |

```jsonl
{"id":"bins","ord":"a0","title":"put the bins out","todo":true,"date":"2026-08-17","repeat":"every week on monday"}
```

[^scope]: A mark can go on any row, whether or not rows hang under it. A row carrying two marks is refused as `several-marks`. There is no value meaning unmarked, and in particular no `open` mark.

[^settles]: `done` and `cancelled` both mean the work is settled: nobody owes anything on that row. That is the question olai asks everywhere, rather than asking which of the two marks it is. It decides what a day still owes, whether a date is drawn as late, whether an `after` arrow still blocks, and whether the rows under a parent hold it up.

[^bullet]: A row carrying no mark has no state at all and is not a task: there is nothing to finish on it, nothing is outstanding, and it makes nothing else a task. The checkbox is drawn for a mark, so an unmarked row gets no checkbox, only the blank space that keeps the titles lined up. Having no checkbox is itself the answer.

[^stored]: A row with children is marked exactly like one without: `read this book` can be ticked with three notes hanging off it. olai never works a parent's mark out from what hangs below it. A row with no mark is not an unfinished one.

[^open]: Unfinished work under a finished row means a row carrying `done` with a `todo` or a `doing` somewhere in the branch below it, which is every row that hangs underneath, however deep. It hides work from the views whose job is to show what is left, and that one pairing is all the rule is about.

[^refused]: `outlines_done` over a branch that still holds unfinished work is refused, and the answer names what is in the way by title, by id and by the mark each one carries. A row with no mark never stands in the way, and neither does a cancelled one. To get past, settle what is not going to happen, which is what `outlines_cancelled` says.

[^reopen]: When open work lands under a row carrying `done`, olai takes that mark off, and says so in the answer. Every `done` in the chain of ancestors comes off, each recorded like any other write, and the commit subject names them. What counts as open work landing there, and what the two rules exempt, are in the third closed block below.

[^doing]: `outlines_doing` is refused while another row has to come first, and the answer names each blocking row by title and id with the mark it carries. Marking a row `doing` says what you are picking up next, and `a after b` is the outline's own statement that `b` comes first.

[^derived]: The journal is olai's calendar, its day pages and its agenda. olai reads dates across the whole directory it serves. There is no journal file, no stored year-and-month folders, and no outline whose filename means anything: a day is a question asked of every row in every outline.

[^placing]: A `doing` or a `todo` with a date in it puts the row on no day, and neither does `started` or `created`. Those values stay legal and stay on disk, and the row itself still shows the mark it carries. The rest of what a day holds is in the fourth closed block below.

[^note]: A `.md` file whose name is exactly an ISO date, such as `2026-08-12.md`, is that day's note wherever in the directory it sits, and the day page draws it above the rows found for that day. `2026-08-10-recap.md` is a document about a day and deliberately not that day's note. Two files claiming one date are both shown, in path order. Nothing checks this convention and no field records it.

[^completing]: The rule sits on the occurrence that is next, so exactly one occurrence of a repeating row is pending at a time. Finishing it stamps that row and creates the next one immediately after it, among the same siblings. Eleven finished occurrences are eleven rows on eleven days. What the new row carries is in the last closed block below.

[^closed]: There is no interval such as `every 2 weeks`, no end date, no count, no list of several weekdays and no day of the month. A rule needs a `date` on the same row, which is the day it repeats from.

[^clamp]: The 31st of January repeats on the 28th of February, and the 29th of February on the 28th.

<details>
<summary>The four marks, one by one</summary>

### `done`

Work that happened. olai stamps the instant you marked it, in local time and with its offset, so the row lands on that day. A `done` on a parent is a claim about the whole branch, and hiding finished work honours it by hiding the rows underneath along with the row itself.

### `cancelled`

Work that will not happen. It stamps the instant the same way, shows on that day's journal page struck through and labelled `cancelled`, and the `date:` search operator selects it the way it selects a `done` instant ([search.md](search.md)). It counts as finished: a parent's `outlines_done` is not refused over a cancelled child, anything waiting `after` a cancelled row is free to start, and a cancelled row stops being overdue. The day it sat on stops owing it.

Cancelling a parent does not cancel the rows under it. They keep their own marks, stay on the page, stay owed and go on blocking, so `outlines_cancelled` is never refused because of the branch below. The answer names what it left standing.

### `doing`

Work you have in hand, written as `true`. `outlines_doing` also writes a `started` stamp in the field beside it, and the time already banked on the row is in `worked` ([format.md](format.md)). A `doing` row with a date on it is put on no day.

### `todo`

Work nobody has started, written as `true`. Somebody has to put it there: a row with no mark stays unmarked until somebody marks it. A `todo` row with a date on it is put on no day.

</details>

<details>
<summary>What each reading asks, and where it is drawn</summary>

| What olai works out | The question it asks |
| --- | --- |
| whether a row is blocked | is a row this one waits for still unfinished |
| the `3/5` count on a parent | how many of the task children are finished |
| hiding finished work | does this row carry `done` |
| what a mirror shows | everything the row it stands for shows |
| whether a row is overdue | is this dated task past its day |

### Blocked

Worked out from the `after` edges and the marks together, and stored nowhere. `a after b` means `b` blocks `a` while `b` carries `doing` or `todo`, read from `b`'s own row. A row with no mark never blocks, because it is not work; to block on a branch, mark the branch. A finished row never blocks either. Work in an `_olai/Trash.olai` file is exempt at both ends: nothing waits for it, and nothing tells it that it cannot start.

Both ends read one graph. A `blocks` edge is turned into an `after` edge, and each edge is filed under the row its target names. So an edge written on a mirror and an edge written on the row that mirror stands for are one edge. An edge written twice is one edge, so what a row waits for is a set of rows, each named once, in the order the set first names it.

Being blocked is a second fact about a row and never a replacement for the first: a blocked task keeps its mark and its date. A page dims a blocked row and names what it is waiting for, `outlines_read` answers with `blockedBy`, giving each blocking row's title, `file:line`, ancestors and mark, and `search_nodes` selects on it with `is:blocked` ([search.md](search.md)). The field is absent when nothing is in the way.

### The `3/5` count

A row with task children can show how far they have got, drawn as `3/5` beside the title and never inside the checkbox. It decides nothing, hides nothing and blocks nothing, and a row with no tasks under it shows no count rather than `0/0`. Mirrors are not counted. A cancelled child drops out of the second number, so a parent whose task children were all cancelled shows no count at all.

### Hiding finished work

A row carrying `done` is not drawn, and the rows under it go with it. A parent nobody marked is never hidden, however finished the rows under it are, so unmarked findings under it stay on screen.

### What a mirror shows

A mirror is a row that stands for another row elsewhere. It stores no mark of its own and may not carry one. Its row draws the mark, the `3/5` count and the blockedness of the row it stands for, and it is hidden with finished work exactly when that row is. A `see` property is not a mirror and inherits none of this: a row carrying `see` has its own mark or none.

### Overdue

A `date` says when, and the mark says whether it is work. A row carrying a date and no mark is not work: it is an event on that day, such as a birthday, a delivery, or a note pinned to a day. A row carrying a date with `todo` or `doing` is work that is due.

Only the second can be late: a row is overdue when it carries `todo` or `doing` and its day is before today. Either finishing mark ends that. The agenda, olai's page of work that is due, holds that collection: dated `todo` and `doing` rows only. A dated row with no mark stays on its day page and in the calendar dots.

</details>

<details>
<summary>The two rules in full: what counts as open work landing, and what is exempt</summary>

### Open work landing under a row marked `done`

A capture carrying a `todo`, a call to `outlines_todo` or `outlines_doing`, and a move that lands a task there are all somebody saying the branch is not finished. So are a merge handing its rows to a finished sibling, and a row with everything under it coming back out of the trash.

An `outlines_done` or an `outlines_cancelled` is not one of them: the row it lands on is finished, so no open work arrived.

Marks the write did not make are never touched. A `done` outside the arriving row's own chain of ancestors stays as it was, and so does a `doing` or a `todo` anywhere.

### What both rules exempt

Trashed work is exempt from both, since a row in an `_olai/Trash.olai` file, with everything under it, is over. It ends in both directions: work coming back out re-opens what it comes back under and every stale `done` inside what is coming back, so `untrash` asks the question twice.

Putting a mirror somewhere is not the same as putting the row there, under either rule. A mirror of an open task under a branch neither stops that branch being marked done nor takes a mark off anything, and `outlines_mirror` is not checked at all.

### What is not checked, and what the answer carries

`outlines_done` does not check the order: finishing out of order is sometimes what happened. `outlines_todo` is not checked at all, and neither is `outlines_cancelled`.

When a mark lands, the answer may say what the `3/5` count noticed, such as the last open task under a parent going done, and name every mark the second rule took off. It travels in a field of its own on the answer to a write that happened.

None of it is checked when a file is loaded: an outline that arrives from a git merge loads, draws, and is repaired by the first write anybody makes to it ([validation.md](validation.md)).

</details>

<details>
<summary>What a day holds, what a mark records, and the day's note</summary>

- A row with two dates is on two days, once each. Scheduled for the 10th and finished on the 11th is a true statement about both days.
- Two dates falling on one day are still one row. The row names which of its dates put it there (`date`, `done` or `cancelled`, printed in front of the time), and `date` wins that naming.
- A finishing mark written as plain `true` is on no day. It says the work was finished and declines to say when, which is allowed.
- The day is the first ten characters of the stamp, here as everywhere. The offset is part of the day it names, since a stamp is written in the time zone of the person who made it.
- Work that was put in the trash is on no day. A row in an `_olai/Trash.olai` file lights no day in the calendar, is on no day's page and is owed on no agenda, whatever date it carries. `trash_restore` brings it back to a day as well as to an outline, and `is:trashed` reaches it ([search.md](search.md)).

### What a mark records

olai stamps the two finishing marks, each with the instant it was made, in local time and with its offset. `doing` and `todo` are written as `true`. Only the row being marked is rewritten, so `true` and day-only values on other rows keep the spelling they were read with, and every view accepts all three spellings.

### A day's own document

The day page's **+ day note** button creates that day's note, in the folder where the newest existing daily note sits. Clicking a day in the calendar never writes anything.

</details>

<details>
<summary>Spelling a rule, and what completing one does</summary>

olai is forgiving about how you spell a rule and strict about its grammar: capitals are ignored, runs of whitespace collapse to one space, `mon` means `monday`, and `every monday` means `every week on monday`. A write stores the canonical spelling whichever one you typed; what is already on disk is left as it was found until somebody writes that field.

A rule the grammar cannot read, and a rule on a row with no `date`, are both reported as `bad-repeat`, one per line. `outlines_repeat` with a rule the grammar does not have, and `outlines_date` clearing the day out from under a rule, are refused when you write them, in the validator's own words.

| The new row carries | It does not carry |
| --- | --- |
| the title, the note and the rule | the edges |
| the date the rule names, counted from the date of the row you completed | the children |
| the mark `todo` | the properties |

The next occurrence is one period after the row's own date, never counted from the day somebody ticks it off. A chore finished three weeks late creates the occurrence that genuinely came next, which may itself be overdue. Clear a backlog by completing those occurrences or by clearing them.

Un-ticking a completion does not remove the occurrence it created, and ticking it again makes no second one: the rule moved to the new row, so the row you completed has none left to repeat from. You are left with one live occurrence and a row beside it that does not repeat. Stop either one with `outlines_repeat` and `null` on whichever one was meant.

The next occurrence is a dated row like any other, so the agenda, the calendar and the day pages read it as they read the one before it. The rule itself is drawn as a badge beside the date, on the row and on the row's own page. No occurrence is worked out in advance and no future dates are written: an outline with a hundred repeating chores holds a hundred rows.

</details>
