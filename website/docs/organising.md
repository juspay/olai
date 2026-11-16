# Moving work about

Rows move by hand and in bulk: drag one, pick several, copy a branch, send a row elsewhere, or put it away. Every verb is one write.[^undo]

Chords hold `Cmd` on a Mac and `Ctrl` elsewhere.

## Drag a row

Press a bullet and travel: the row and everything under it come with you, and a line shows where it would land.[^line][^panes] A row dropped on an open conversation is armed there ([node-agents.md](node-agents.md)).[^drop]

## Pick several rows, or copy a branch

`Cmd` + click a title adds it to a pick, `Shift` + click takes everything between, and a drag across the outline's empty space sweeps rows.[^pick] Over a pick the keys mean what they always mean.[^bulk] `Cmd` + `Shift` + `D` copies the row you are in and everything under it.[^copy]

## Move a row somewhere else entirely

1. Press `Cmd` + `Shift` + `M` in the row, or choose **Move to…** from the row's menu, the door a phone has.
2. Type: the box searches every node in the directory, and each row says where that node sits.[^search]
3. Press `Enter`. The row and everything under it go last under the node you chose.[^elsewhere]

Some destinations are refused.[^refused]

## Put a node on a day, and make it come back

Press the date beside a dated row's title and the picker opens under the row.[^datedoor][^datewrite] A dated node can say how often it repeats, and completing it makes the next occurrence.[^repeat]

## Put a row away

The last entry in a row's menu, **Move to Trash**, puts that row and everything under it away.[^question] What goes in leaves every other page, and nothing on disk changes for it.[^trashed] A Trash row's one verb is **Put back**.[^putback] Two doors delete for good.[^delete]

[^undo]: Every verb on this page is a single write, so `Cmd` + `Z` takes it back. The exception is a file deleted from its own page, which no undo reaches.

[^line]: The landing line answers two questions, because the gesture asks two: which gap the row sits in, and how far in it starts. It moves sideways as you do. A branch is never offered a place inside itself.

[^panes]: Dragging between panes has rules of its own. Two panes showing the same file move the row on the same frame: it leaves one pane and arrives in the other at once. Two panes showing different files cannot: the pane fills with the reason before you let go, and nothing moves if you let go anyway. **Move to…** is how a row reaches another outline.

[^drop]: A row dropped on a conversation is armed there across files and panes, and stays where it was. Dropping a transcript row between two outline rows makes a node at the drop line's depth, with the first line as its title and the rest as its note.

[^pick]: Where a pull begins decides what it is. Press on the words and it is the browser's own text selection. Press on the outline's empty space and it sweeps rows: the rail down the left, the strip left of a note, the gaps between rows, and the page below the last one.

    A row's own gutter is not empty space, because the collapse triangle and the `•••` live there. Every way to pick is in the table at the foot of this page.

[^bulk]: A pick and a caret are never both live. The keys over a pick are in the table below. A parent and a child in one pick are one row to a verb: the subtree moves whole.

    A bulk gesture is several writes, one per row: one that is refused stops the run and says why on the bar at the foot of the page, and what already landed stays landed. **Move to Trash** sits on that bar and is the one bulk verb with no key; a pick holding a mirror is not offered it.

[^copy]: The copy lands as the sibling immediately below, and **Duplicate** in the row's menu, and in the palette on a zoomed node, is the same write. What points at the branch from elsewhere still points at the original.

    There is no **Duplicate** on a mirror, whose own verb is **More** › **Remove from here**; ask for the copy on the node itself. `Cmd` + `Z` takes the copy to the Trash, and `Cmd` + `Shift` + `Z` brings it back. What the copy keeps is in the closed block at the foot of this page.

[^search]: The list settles for a fifth of a second before it asks the server, and `Enter` inside that gap writes nothing rather than taking the row the query before last found. A click always takes the row you can see.

[^elsewhere]: The node you chose may be in another outline, and then the row goes there, keeping every id. A mirror still draws it, a `see` still opens it, an `after` still waits on it, and a link in a note still lands on it. `Cmd` + `Z` puts the row back under the parent and beside the neighbour it left. `Tab`, `Shift` + `Tab`, `Alt` + `Shift` + `↑` / `↓` and a drag each move a row one step instead.

[^refused]: A destination can be refused. Somewhere this row already draws, because a branch cannot go under its own child, under itself, or under anything a mirror inside it shows. The Trash, out of which **Put back** is the way. The parent it already has, since a destination puts the row last, which would reorder rather than move. The reason appears as you walk onto a row, before you press `Enter`, and pressing `Enter` there writes nothing.

[^datedoor]: A row with no date has no pill, so its door is **Set date…** in the row's menu, which reads **Change date…** on a row that has one. Typing `!` and a day in words sends the same edit ([editing.md](editing.md)).

[^datewrite]: The picker's controls are in the closed block at the foot of this page. The boxes show the day and time the file holds, never that instant converted into your zone, and pressing over the same values writes nothing.

    A time your zone skips is written as the moment it becomes, and the sentence under the boxes quotes that value before you press. A half-typed time is not read as "no time": the button stays dead and the panel says the time is not finished.

[^repeat]: The pill beside the date opens the picker, reading the rule in the file's own words, such as `↻ every week on monday`. The menu's door is **Set repeat…**, or **Change repeat…** on a row that already repeats, and it is offered only on a dated row. The whole grammar, and what completing a repeating row does, are in the closed block at the foot of this page.

[^question]: A question names how much goes first: *Move “Fit the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar.*

[^trashed]: A row in the Trash is off its day, out of the calendar's dots and off the agenda even if it was overdue. The record keeps its dates and its mark, and `is:trashed` finds it from any search box ([search.md](search.md)). Where they go is `_olai/Trash.olai`, read through the **Trash** door pinned at the foot of the sidebar: readable and not editable, each subtree drawn under the outline it left.

[^putback]: The subtree returns where the recorded chain says it came from, last among its new siblings, children and ids intact. A chain that does not stand, because somebody retitled it or put it away, is a refusal under the row, never a guess. `Cmd` + `Z` after a **Move to Trash** puts the row back, and `Cmd` + `Z` after a **Put back** is the Trash again.

    Above each pile in the Trash sit the titles the Trash wrote down to remember which outline a subtree left and where it hung. Those are signposts, and the rows they name never left.

[^delete]: Two controls delete for good: **Empty trash** beside the heading on the Trash page, and **Delete…** beside **Edit** on a document page's header. Both are in the closed blocks at the foot of this page.

<details>
<summary>Every gesture, and the keys over a pick</summary>

| Gesture | What happens |
| --- | --- |
| Press a bullet without travelling | Opens that node's page, as the bullet always does |
| Drag towards the top or bottom of the window | The page scrolls, faster the nearer the edge |
| Drag into the other pane | That pane decides where the row lands |
| `Escape` while holding a row | Cancels the drag; releasing moves nothing |
| Hold a bullet with a finger, wait for the row to lift | The row follows your thumb |

Let go and that is where the row is. A finger that moves before the row lifts is scrolling the page.

| Gesture | What it picks |
| --- | --- |
| `Cmd` + click a title | Adds that row to the pick, or takes it out |
| `Shift` + click a title | Everything between |
| `Shift` + `↑` / `Shift` + `↓` | Leaves the caret and starts picking |
| `Cmd` + `A` twice | The line, then the row and its siblings; again widens to the page |
| Drag across the outline's empty space | Everything the pull passes over |

| Key over a pick | What it does |
| --- | --- |
| `Tab` / `Shift` + `Tab` | Indents them, or takes them out again |
| `Alt` + `Shift` + `↑` / `↓` | Moves them among their siblings |
| `Cmd` + `Enter` | Marks them done, or takes that back |
| Drag any of their bullets | Moves all of them, subtrees and all |
| `Escape` | Puts the pick away |

</details>

<details>
<summary>What a copy keeps</summary>

| What is copied | How |
| --- | --- |
| Every id in the branch | Minted fresh, so writing to the copy leaves the original alone |
| Marks, dates, repeat rules, notes, properties, documents | Verbatim, with a `done` keeping the instant it was stamped at |
| The title | Verbatim: no `(copy)`, no added tag |
| A reference the branch made to itself | Re-aimed at the copy |
| A reference that left the branch | Keeps its target |
| A mirror inside the branch | Copied as a mirror of the same node |

</details>

<details>
<summary>The date picker, and the repeat rules</summary>

| Control | What it writes |
| --- | --- |
| **Set date** | The day you picked, exactly as it is written: `2026-09-01` |
| The time box | One instant, with your browser's offset at that moment: `2026-09-01T09:30:00-04:00` |
| **No time** | Empties the time box; the button then reads **Clear time**, which keeps the day |
| **Clear date** | No date at all, taking any time with it |
| **Cancel** or `Escape` | Nothing |

The row moves the moment the file says so, onto that day's page and onto the agenda. A dated `todo` or `doing` is owed and counts as overdue; a dated bullet is not, and stays on its day's page and in the calendar's dots ([dates-and-status.md](dates-and-status.md)).

## Make a node come back

The repeat list is the whole grammar: **every day**, **every week on** each of the seven days, **every month** and **every year**. There is no box to type a rule into, no interval, no end date and no count. **Set repeat** writes it, **Escape** and **Cancel** leave without writing, and choosing **Does not repeat** turns the button into **Stop repeating**, which is also the menu's own verb.

Completing the row stamps it done and captures a fresh node immediately below: same title, same note, same rule, on the day the rule names, marked **To do**. Any of `Cmd` + `Enter`, the checkbox and **Done** in the menu does it. The line under the row says which day. The old row keeps its own date and its `done` instant, so the day you finished it still shows it.

| If you | Then |
| --- | --- |
| Tick it by mistake | `Cmd` + `Z` puts the mark back and leaves the new occurrence, which is still owed |
| Complete it again | Nothing is spawned: the rule is on the row below now |
| Call it off with `Alt` + `Enter` | No next one is made, and the rule stays on the row you cancelled |
| Finish one three weeks late | The next is the week after the one you finished, still in the past and still owed |

</details>

<details>
<summary>Empty the Trash</summary>

## Empty the Trash

Beside the heading on the Trash page sits **Empty trash**, one of two things in olai that permanently delete. Everything in `_olai/Trash.olai` goes, the signpost titles included.

> It asks first: *Permanently delete all 12 rows in Trash? olai can't bring them back. Only what git has already saved can be recovered.* **Cancel** writes nothing.

The count is over what the Trash holds, not over what the page is drawing, so filtering the Trash down to one row and pressing it still moves all of them. That number travels with the write: anything put away between your reading the sentence and the write landing turns it into a refusal naming both counts.

What survives is whatever git has already recorded, through the commit door every other write takes ([git.md](git.md)). A directory served with committing off, or one whose Trash has been sitting uncommitted, keeps nothing, and recovering a record is `git log`, `git show` and a paste in a terminal.

The verb is refused while anything outside the Trash still points into it, naming each row and the field it points with: re-point them, retire them, or **Put back** what they name, and press again. An empty Trash is not offered the verb at all, and the page says *Trash is empty*.

</details>

<details>
<summary>Delete a file</summary>

## Delete a file

The **Delete…** control sits beside **Edit** on a document page's header, and beside the *write the first line* an emptied outline offers.

1. Press **Delete…**. The question names the path: *Delete cabinets.md? olai can't bring it back. Only what git has already saved can be recovered.*
2. Press **Delete file**. The file goes from the directory, the sidebar and every open tab. **Cancel** writes nothing.

There is no file-level trash, and `Cmd` + `Z` does not reach a delete: what would take it back is a git command, which olai does not run for you.

| What is refused | Why |
| --- | --- |
| An outline still holding records | It names them; the Trash is how a record leaves an outline |
| A document named by a live title, note, body link or a property declared `doc` | It names the referrers |
| A file olai only shows: `.html`, `.csv`, a picture, a `.pdf` | The control is never offered on one |
| A file olai could not read | Dropping bytes that never made it into the set is a loss, not a delete |

</details>
