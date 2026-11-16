# Moving rows about, and the Trash

A row is one line of an outline. You can drag one, pick several, copy a branch, move a row to another file, or put it in the Trash.[^undo]

Shortcuts here use `Cmd` on a Mac and `Ctrl` elsewhere.

## Drag a row

Press a row's bullet, the dot in front of its title, and drag. The row and everything under it come with you, and a line shows where it will land.[^line][^panes] Drop a row on an open conversation with an agent and it is attached to the message you are writing there.[^drop]

## Pick several rows, or copy a branch

`Cmd` + click a title adds that row to a pick, a group the keys act on together, and `Shift` + click takes every row between.[^pick][^bulk] `Cmd` + `Shift` + `D` copies the row you are in and everything under it.[^copy]

## Move a row to another file

1. Press `Cmd` + `Shift` + `M` in the row, or choose **Move to…** from the row's menu, the way on a phone.
2. Type. The box searches every row in the directory olai serves.[^search]
3. Press `Enter`. The row and everything under it go last under the row you chose.[^elsewhere]

Some destinations are refused.[^refused]

## Put a row on a day, and make it repeat

Click the date beside a dated row's title and the date picker opens under the row.[^datedoor][^datewrite] A dated row can say how often it repeats, and marking it done makes the next row.[^repeat]

## Put a row in the Trash

The last entry in a row's menu, **Move to Trash**, moves that row and everything under it to the Trash.[^question] The row leaves every other page.[^trashed] A row in the Trash has one control, **Put back**.[^putback] Two controls delete for good.[^delete]

[^undo]: Every action on this page is a single write, so `Cmd` + `Z` undoes it. The one exception is deleting a file from its own page, which no undo reaches.

[^line]: The line shows two things, because a drag decides two: which gap the row will sit in, and how far indented it will be. It moves sideways as you do. A branch is never offered a place inside itself.

[^panes]: Dragging between two panes has rules of its own. Two panes showing the same file move the row in the same frame: it leaves one pane and arrives in the other at once. Two panes showing different files cannot move a row between them: the pane fills with the reason before you let go, and nothing moves if you let go anyway. **Move to…** is how a row reaches another outline.

[^drop]: A row dropped on a conversation stays where it is, and is added to the message you are writing as a chip ([node-agents.md](node-agents.md)). This works across files and panes.

    Dropping a row of an agent's transcript between two outline rows makes a new row at the depth of the line you dropped on, with the transcript row's first line as its title and the rest as its note.

[^pick]: Dragging across the outline's empty space picks every row you pass. Start the drag on the words instead and it is the browser's own text selection. The outline's empty space is the rail down the left, the strip left of a note, the gaps between rows, and the page below the last row.

    A row's own gutter is not empty space, because the collapse triangle and the `•••` button sit there. Every way to pick rows is in the table at the foot of this page.

[^bulk]: You never have a pick and a caret at once, so the keys over a pick do their usual work on every picked row. A parent and a child in one pick count as one row: the branch moves together.

    A key over a pick is one write per row; a refused write stops the run and says why on the bar at the foot of the page, and the rows that already moved stay moved. **Move to Trash** sits on that bar and is the one bulk action with no key; a pick holding a mirror is not offered it.

[^copy]: The copy lands as the next row below, at the same depth. **Duplicate** in the row's menu, and in the palette on a zoomed row, makes the same copy. Anything that pointed at the original branch still points at the original.

    A mirror has no **Duplicate**; its own menu entry is **More** › **Remove from here**. Ask for the copy on the original row instead. `Cmd` + `Z` moves the copy to the Trash, and `Cmd` + `Shift` + `Z` brings it back. What a copy keeps is in the closed block at the foot of this page.

[^search]: Each result in the move-to box says where that row sits. The list waits a fifth of a second before it asks the server, and `Enter` inside that gap writes nothing rather than taking the row the previous query found. A click always takes the row you can see.

[^elsewhere]: The row you choose may be in another outline, and then the row moves there, keeping every id. A mirror still draws it, a `see` still opens it, an `after` still waits for it, and a link in a note still lands on it. `Cmd` + `Z` puts the row back under the parent and beside the neighbour it left. `Tab`, `Shift` + `Tab`, `Alt` + `Shift` + `↑` / `↓` and a drag each move a row one step instead.

[^refused]: Four destinations are refused. A place this row already draws, because a branch cannot go under its own child, under itself, or under anything a mirror inside it shows. The Trash, which rows leave by **Put back**. The parent it already has, since a move puts the row last, which would reorder it rather than move it. The reason appears as you walk onto a row, before you press `Enter`, and pressing `Enter` there writes nothing.

[^datedoor]: A row with no date has no date pill, so its menu entry is **Set date…** instead, which reads **Change date…** on a row that has one. Typing `!` and a day in words makes the same edit ([editing.md](editing.md)).

[^datewrite]: The picker's controls are in the closed block at the foot of this page. The boxes show the day and time the file holds, not that instant converted into your time zone, and pressing **Set date** over the same values writes nothing.

    A time your zone skips, at a daylight-saving change, is written as the moment it becomes, and the sentence under the boxes quotes that value before you press. A half-typed time is not read as "no time": the button stays dead and the panel says the time is not finished.

[^repeat]: The pill beside the date opens the repeat picker and reads the rule in the file's own words, such as `↻ every week on monday`. The menu entry is **Set repeat…**, or **Change repeat…** on a row that already repeats, and it is offered only on a row with a date. The whole grammar, and what completing a repeating row does, are in the closed block at the foot of this page.

[^question]: A question says how much is going: *Move “Fit the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar.*

[^trashed]: Putting a row in the Trash deletes no file on disk: the rows move into `_olai/Trash.olai`, which the **Trash** entry at the foot of the sidebar opens. You can read that file but not edit it, and each branch is drawn under the outline it came from.

    A row in the Trash is off its day, out of the calendar's dots and off the agenda, even if it was overdue. It keeps its dates and its mark, and `is:trashed` finds it from any search box ([search.md](search.md)).

[^putback]: The branch goes back where the Trash recorded it came from, last among its new siblings, with its children and ids intact. If that place has gone, because somebody retitled or trashed it, you get a refusal under the row rather than a guess. `Cmd` + `Z` after a **Move to Trash** puts the row back, and `Cmd` + `Z` after a **Put back** returns it to the Trash.

    Above each group in the Trash sit titles the Trash wrote down to remember which outline the branch left and where it hung. Those titles are labels; the rows they name never left.

[^delete]: Two controls delete for good: **Empty trash** beside the heading on the Trash page, and **Delete…** beside **Edit** on a document page's header. Both are described in the closed blocks at the foot of this page.

<details>
<summary>Every gesture, and the keys over a pick</summary>

| Gesture | What happens |
| --- | --- |
| Press a bullet without dragging | Opens that row's page, as the bullet always does |
| Drag towards the top or bottom of the window | The page scrolls, faster the nearer the edge |
| Drag into the other pane | That pane decides where the row lands |
| `Escape` while holding a row | Cancels the drag; letting go moves nothing |
| Hold a bullet with a finger, wait for the row to lift | The row follows your thumb |

Let go and that is where the row is. A finger that moves before the row lifts is scrolling the page.

| Gesture | What it picks |
| --- | --- |
| `Cmd` + click a title | Adds that row to the pick, or takes it out |
| `Shift` + click a title | Everything between |
| `Shift` + `↑` / `Shift` + `↓` | Leaves the caret and starts picking |
| `Cmd` + `A` twice | The line, then the row and its siblings; again widens to the page |
| Drag across the outline's empty space | Everything the drag passes over |

| Key over a pick | What it does |
| --- | --- |
| `Tab` / `Shift` + `Tab` | Indents them, or takes them out again |
| `Alt` + `Shift` + `↑` / `↓` | Moves them among their siblings |
| `Cmd` + `Enter` | Marks them done, or takes that mark off |
| Drag any of their bullets | Moves all of them, with everything under them |
| `Escape` | Puts the pick away |

</details>

<details>
<summary>What a copy keeps</summary>

| What is copied | How |
| --- | --- |
| Every id in the branch | Made fresh, so writing to the copy leaves the original alone |
| Marks, dates, repeat rules, notes, properties, documents | Exactly, with a `done` keeping the instant it was stamped at |
| The title | Exactly: no `(copy)`, no added tag |
| A link the branch made to itself | Re-aimed at the copy |
| A link that pointed out of the branch | Keeps its target |
| A mirror inside the branch | Copied as a mirror of the same row |

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

The row moves the moment the file says so, onto that day's page and onto the agenda. A dated row marked **To do** or **Doing** is owed and can be overdue; a dated row with no mark is not, and stays on its day's page and in the calendar's dots ([dates-and-status.md](dates-and-status.md)).

## Make a row come back

The repeat list is the whole grammar: **every day**, **every week on** each of the seven days, **every month** and **every year**. There is no box to type a rule into, no interval, no end date and no count. **Set repeat** writes the rule, **Escape** and **Cancel** leave without writing, and choosing **Does not repeat** turns the button into **Stop repeating**, which is also the menu's own entry.

Marking the row done stamps it and makes a fresh row immediately below it: same title, same note, same rule, on the day the rule names, marked **To do**. `Cmd` + `Enter`, the checkbox and **Done** in the menu all do it. The line under the row says which day. The old row keeps its own date and the instant it was marked done, so the day you finished it still shows it.

| If you | Then |
| --- | --- |
| Tick it by mistake | `Cmd` + `Z` takes the mark off and leaves the new row, which is still owed |
| Mark it done again | Nothing new is made: the rule is on the row below now |
| Cancel it with `Alt` + `Enter` | No next row is made, and the rule stays on the row you cancelled |
| Finish one three weeks late | The next row is the week after the one you finished, still in the past and still owed |

</details>

<details>
<summary>Empty the Trash</summary>

## Empty the Trash

Beside the heading on the Trash page sits **Empty trash**, one of the two controls in olai that delete permanently. Everything in `_olai/Trash.olai` goes, the titles that record where each branch came from included.

> It asks first: *Permanently delete all 12 rows in Trash? olai can't bring them back. Only what git has already saved can be recovered.* **Cancel** writes nothing.

The count is of what the Trash holds, not of what the page is drawing, so filtering the Trash down to one row and pressing the button still deletes all of them. That number travels with the write: anything put away between your reading the sentence and the write landing turns it into a refusal naming both counts.

What survives is whatever git has already recorded, through the same commit every other write goes through ([git.md](git.md)). A directory served with committing off, or one whose Trash has been sitting uncommitted, keeps nothing, and recovering a row then means `git log`, `git show` and a paste in a terminal.

The button is refused while anything outside the Trash still points into it, and it names each row and the field it points with: re-point them, remove those links, or **Put back** what they name, and press again. An empty Trash is not offered the button at all, and the page says *Trash is empty*.

</details>

<details>
<summary>Delete a file</summary>

## Delete a file

The **Delete…** control sits beside **Edit** on a document page's header, and beside the *write the first line* an emptied outline offers.

1. Press **Delete…**. The question names the path: *Delete cabinets.md? olai can't bring it back. Only what git has already saved can be recovered.*
2. Press **Delete file**. The file goes from the directory, the sidebar and every open tab. **Cancel** writes nothing.

There is no trash for whole files, and `Cmd` + `Z` does not reach a delete: taking it back means a git command, which olai does not run for you.

| What is refused | Why |
| --- | --- |
| An outline that still holds rows | It names them; the Trash is how a row leaves an outline |
| A document named by a live title, note, body link or a property declared `doc` | It names what points at it |
| A file olai only shows: `.html`, `.csv`, a picture, a `.pdf` | The control is never offered on one |
| A file olai could not read | Dropping bytes olai never read is a loss, not a delete |

</details>
