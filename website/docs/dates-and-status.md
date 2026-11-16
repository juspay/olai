# Marks, days and repeating

A row is marked or it is not. This page is the four marks a record may carry, what every reading derives from them, which fields put a node on a day, and the grammar that brings a node back.

## The four marks

A node carries at most one mark, and a record carrying two is refused `several-marks`. There is no value for unmarked and in particular no `open`: a node carrying no mark has no status at all, and is not a task. A mark is storable on any node, leaf or parent.

| Mark | Its box | Settles | Written by |
| --- | --- | --- | --- |
| [`done`](#done) | checked, the row struck through | yes | `outlines_done` |
| [`cancelled`](#cancelled) | crossed, the row struck through | yes | `outlines_cancelled` |
| [`doing`](#doing) | half-filled | no | `outlines_doing` |
| [`todo`](#todo) | empty | no | `outlines_todo` |

A mark that settles ends the wait: nobody is owed anything by a node carrying one. That is the question every derived reading asks, rather than asking which mark — what a day still owes, what a date badge burns for, what an `after` arrow blocks, what a branch holds up.

### `done`

Work that happened. olai stamps the instant it was made at, local and with its offset, so the node lands on that day. A `done` on a parent is a claim about the whole branch, and hiding finished work honours it by taking the subtree with the row.

### `cancelled`

Work that will not happen. It stamps the instant the same way, shows on that day's journal page struck through and labelled `cancelled`, and `date:` selects it the way it selects `done`'s instant ([search.md](search.md)). It settles, so a parent's `outlines_done` is not refused over a cancelled child, anything `after` a cancelled target unblocks, a cancelled node stops being overdue, and it leaves what its day owes.

Cancelling a parent is not a cascade. The rows under it keep their own marks, stay on the page, stay owed and go on blocking, and `outlines_cancelled` is therefore not gated on the branch at all. The answer names what it left standing.

### `doing`

Work in hand, written `true`. `outlines_doing` stamps `started` one field over, and the banked rounds are `worked`'s ([format.md](format.md)). A dated `doing` places the node on no day.

### `todo`

Work nobody has started, written `true`. Someone has to put it there: a bullet stays a bullet unless it is marked. A dated `todo` places the node on no day.

## What the marks decide

A node's status is the mark it stores and nothing else. A node with children is marked exactly like one without: `read this book` can be ticked with three notes hanging off it. Nothing recomputes a parent's mark from what hangs below it.

| Reading | What it asks |
| --- | --- |
| [Blocked](#blocked) | is a target still work nobody has settled |
| [The rollup](#the-rollup) | how far the task children have got |
| [Hiding finished work](#hiding-finished-work) | does this node store `done` |
| [What a mirror shows](#what-a-mirror-shows) | everything, of the node it points at |
| [Overdue](#overdue) | is this dated node `todo` or `doing`, and is the day past |

An unmarked node is not an unfinished one. It is a bullet: nothing to finish, nothing outstanding, and nothing that makes anything else a task. A checkbox is drawn for a mark and not for a node, so an unmarked row gets no box at all, only the blank that keeps the titles in a column. The absence of a box is an answer.

### Blocked

Computed from the edges and the marks together, and stored nowhere. `a after b` means `b` blocks `a` while `b` is `doing` or `todo`, read off `b`'s own record. A target with no mark never blocks, because a bullet is not work; to block on a branch, mark the branch. A settled target never blocks either. Work in an `_olai/Trash.olai` is exempt at both ends: nothing waits on it, and nothing tells it that it cannot start.

Both ends read one graph, with `blocks` normalized into `after` and each edge filed under the node its target names, so an edge written at a mirror and an edge written at the node it stands for are one edge. An edge named twice is one edge, so what a node waits on is a set of nodes, each named once, in the order the set first names it.

Being blocked is a second fact about a node, never a replacement for the first: a blocked task keeps its mark and its date. A page dims a blocked row and names what it is waiting on, `outlines_read` answers `blockedBy` with every blocker situated by title, `file:line`, ancestors and mark, and `search_nodes` selects on it with `is:blocked` ([search.md](search.md)). The field is absent when nothing is in the way.

### The rollup

A node with task children may show how far they have got, as `3/5` beside the title and never in the checkbox. It decides nothing, hides nothing and blocks nothing, and a node with no tasks under it shows none rather than `0/0`. Mirrors are not counted. A cancelled child leaves the denominator, so a parent whose every task child was cancelled shows no rollup at all.

### Hiding finished work

A row whose node stores `done` is not drawn, and its subtree goes with it. A parent nobody marked is never hidden, however finished the things under it are, so unmarked findings under it stay on screen.

### What a mirror shows

A mirror stores no mark of its own and may not carry one. Its row draws its target's mark, its target's rollup and its target's blockedness, and is hidden with finished work exactly when its target's own row is. A `see` is not a placement and inherits none of it: a node carrying `see` has its own mark or none.

### Overdue

A `date` says when, and the mark says whether it is work. A node carrying a `date` and no mark is an occurrence: a birthday, a delivery, a note pinned to a day. A node carrying a `date` with `todo` or `doing` is due work.

Only the second can be late: a node is overdue when it carries `todo` or `doing` and its day is before today. Either settling mark extinguishes it. The agenda is that collection, dated `todo` and `doing` only; an occurrence stays on its day page and in the calendar dots.

## The two write gates

A `done` may not come to stand over unfinished work. That is a node storing `done` with a `todo` or a `doing` anywhere in the branch below it, which hides work from the view whose job is showing what is left. Open work here means that pair and nothing else.

### `outlines_done` over an unfinished branch

Refused, naming what is in the way by title, id and the mark each carries. A bullet never stands in the way, and neither does a cancelled row. The way past the gate is to settle what is not happening, which `outlines_cancelled` is how to say.

### Open work arriving under a `done` ancestor

The ancestor's mark comes off, and the answer says so. A capture carrying a `todo`, an `outlines_todo` or `outlines_doing`, and a move that lands a task under it are all somebody saying the branch is not finished. So are a merge handing its rows to a finished sibling and a subtree coming back out of the trash.

Every `done` in the chain comes off, each stamped like any other write, and the commit subject names them. An `outlines_done` or an `outlines_cancelled` is not one of them: the node it lands on settles, so no work arrived.

Marks the write did not make are never touched. A `done` outside the arriving node's own parent chain stays as it was, and so does a `doing` or a `todo` anywhere.

### What both gates exempt

Trashed work is exempt at both doors, since a subtree in an `_olai/Trash.olai` is over. It ends in both directions: work coming back out re-opens what it comes back under and every stale `done` inside what is coming back, so `untrash` asks the question twice.

A placement is not containment at either door. A mirror of an open task under a branch neither stops that branch being marked done nor takes a mark off anything, and `outlines_mirror` is not gated at all.

### `outlines_doing` while something is in the way

Refused, naming the blockers by title and id with the mark each carries. Starting is an instruction about what to pick up next, and `a after b` is the set's own statement that `b` comes first. `outlines_done` is not gated on the order: finishing out of order is sometimes what happened. `outlines_todo` is not gated at all, and neither is `outlines_cancelled`.

When a mark lands, the ops layer may say what the rollup noticed, such as the last open task under a parent going done, and name every mark the second gate took off. It travels in a field of its own on the answer to a write that happened. None of it is a load invariant: a set that arrives from a git merge loads, draws, and is fixed by the first write anybody makes to it ([validation.md](validation.md)).

## Days

The journal, the calendar and the today view are derived from dates when a page is drawn, over the whole served directory. There is no journal file, no stored year to month hierarchy, and no outline whose filename means anything: a day is a question asked of every node in every outline.

Three fields put a node on a day, and all three place identically.

| Field | What it says |
| --- | --- |
| `date` | what the node is scheduled for |
| a dated `done` | work someone finished at that instant |
| a dated `cancelled` | work someone called off at that instant |

A dated `doing` or `todo` places nothing, and neither does `started` or `created`. The values stay legal and stay on disk; a node's own row still shows the mark it carries.

- A node with two dates is on two days, once each. Scheduled for the 10th and finished on the 11th is a true statement about both days.
- Two dates on one day are one row. The row names which of its dates it is there for (`date`, `done` or `cancelled`, printed in front of the time), and `date` wins that naming.
- A settling mark holding `true` is on no day. It says the state was reached and declines to say when, which is legal.
- The day is the first ten characters, here as everywhere. An offset is part of the day it names, since a stamp is written in the zone of the person who made it.
- Work that was put away is on no day. A node in an `_olai/Trash.olai` lights no day in the calendar, is on no day's page and is owed on no agenda, whichever date it carries. `trash_restore` brings it back to a day as well as to an outline, and `is:trashed` reaches it ([search.md](search.md)).

### What a mark records

olai stamps the two settling marks, each with the instant it was made, local and with its offset. `doing` and `todo` are written `true`. Only the record being marked is rewritten, so `true` and day-only values elsewhere keep the spelling they were read with, and every view accepts all three shapes.

### A day's own document

A `.md` whose basename is exactly an ISO date, such as `2026-08-12.md` wherever in the tree it sits, is that day's note, and the day page draws it above the query's answer. `2026-08-10-recap.md` is a document about a day and deliberately not one, and two files claiming one date are both shown, in path order. Nothing validates the convention and no field records it.

The day page's **+ day note** mints into that day's note, where the newest existing daily note says the directory keeps them. Clicking a calendar day never writes.

## Repeating

A dated node may say how it comes back, and completing it makes the next occurrence.

```jsonl
{"id":"bins","ord":"a0","title":"put the bins out","todo":true,"date":"2026-08-17","repeat":"every week on monday"}
```

The grammar is closed: four shapes and no fifth.

| Rule | The next occurrence |
| --- | --- |
| `every day` | the day after |
| `every week on <weekday>` | the next `monday` … `sunday`, strictly after |
| `every month` | the same day of the next month, clamped to one that exists |
| `every year` | twelve months on, clamped the same way |

The 31st of January repeats on the 28th of February, and the 29th of February on the 28th. Intervals (`every 2 weeks`), end dates, counts, several weekdays and days of the month are all absent.

Reading is forgiving about spelling and strict about grammar: case is folded, runs of whitespace collapse, `mon` is `monday`, and `every monday` is `every week on monday`. A write stores the canonical spelling, whichever was typed; what is already on disk is left as it was found until somebody writes that field.

A rule needs a `date`, which is what it repeats from. A rule the grammar cannot read, and a rule with no `date` under it, are both `bad-repeat`, per line. `outlines_repeat` with a rule the grammar does not have, and `outlines_date` clearing the day out from under one, are refused by the write gate in the validator's own words.

### What completing one does

The rule rides the occurrence that is next, so exactly one occurrence of a recurrence is pending. Completing one stamps it and captures the next as a fresh node, placed immediately after the one that was finished, among the same siblings. Eleven finished occurrences are eleven records on eleven days.

| The new node carries | It does not carry |
| --- | --- |
| the title, the note and the rule | the edges |
| the date the rule names, counted from the completed node's own date | the children |
| the mark `todo` | the properties |

The rhythm is the file's and never the clock's: the next occurrence is one period after the node's own date, whatever day it is when somebody ticks it off. A chore finished three weeks late spawns the occurrence that was genuinely next, which may itself be overdue. Clear a backlog by completing those occurrences or by clearing them.

Un-doing a completion does not un-spawn, and re-doing makes no second occurrence: the rule travelled, so the node that was completed has none left to spawn from. What is left is a recurrence with one live head and a node beside it that does not repeat. Stop either with `outlines_repeat` and `null` on whichever one was meant.

The next occurrence is a dated node like any other, so the agenda, the calendar and the day pages read it as they read the one before it. The rule itself is drawn as a badge beside the date, on the row and on the node's own page. No occurrence is expanded and no future dates are materialised: a set with a hundred repeating chores holds a hundred records.
