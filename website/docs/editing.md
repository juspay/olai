# Typing an outline

Click a title and the caret lands where you clicked. You type the source, and the rendering comes back when you leave.[^source]

Every chord holds `Cmd` on a Mac and `Ctrl` elsewhere.[^chord]

## Write rows

`Enter` finishes a row, `Tab` and `Shift` + `Tab` indent and outdent, `Alt` + `Shift` + `↑` / `↓` move it among its siblings.[^keys] A row is written the moment it has a title, so a key pressed by accident writes nothing.[^draft] `Enter` mid-line splits a row,[^split] and `Backspace` at the start joins it onto the one above.[^join]

## Move the caret, fold and zoom

The arrows walk from row to row. `Ctrl` + `Space` or `Cmd` + `↑` / `↓` folds a row, `Cmd` + `.` zooms into it, `Cmd` + `O` hides finished items and `Cmd` + `\` hides the sidebar.[^nav]

## Mark a row

| Key | What it writes |
| --- | --- |
| `Cmd` + `Enter` | **Done**, or takes that back |
| `Alt` + `Enter` | **Cancelled**, or takes that back |
| `Cmd` + `Shift` + `Enter` | Walks the mark on: **To do**, **Doing**, none |

The same marks are under **Mark** in the row's menu.[^markmenu] Cancelling a row settles the work waiting on it.[^cancel] Some marks are refused.[^refused]

## Type a date, a tag or a mirror

While the caret is in a title, `!` offers a day in words, `#` or `@` a tag this directory already uses, and `((` a node to place here as a mirror.[^trigger] Walk the short list under the line with `↑` and `↓`, take one with `Enter`, and put it away with `Escape`.[^tag][^mirror]

## Take an edit back

`Cmd` + `Z` takes back your last edit on this outline, and `Cmd` + `Shift` + `Z` puts it back.[^undo] There is no delete key.[^delete]

[^source]: What you type is the source: `**bold**` and `#tags` stay as they are written, and the rendering comes back when you leave the row. The same keys are in the app, under **Keyboard shortcuts** in the palette.

[^chord]: Zooming is the exception the app's own shortcut list shows: `Cmd` + `.` on a Mac, `Alt` + `.` elsewhere.

[^keys]: The rest of the writing keys are in the table at the foot of this page. `Shift` + `Enter` writes the note under a row, `Enter` at the start of a row inserts a blank row above, and `Escape` discards what you were typing. Inside a note, `Enter` is a new line, `Shift` + `Enter` finishes the note, and `Escape` discards what you typed.

[^draft]: Several blank drafts can stand on the page at once; click a parked one and the caret is back in it. The arrows stop on every blank, while the shape keys step past a parked one to the nearest written row. `Tab` into a folded branch opens the branch.

[^split]: Splitting cuts the line at the caret. What is before the caret stays where you were, and what is after it becomes the next row, with the caret at its head. Everything that described the row you were in stays with it: its children, its note, its mark, its date and what it waits on. The row that comes off is a bullet with no mark.

[^join]: Joining takes the row above: its sibling, or its parent when it is the first of its siblings. The two titles run together with nothing between them, and the caret lands on the seam. What the absorbed row carried is in the closed block at the foot of this page.

[^nav]: Moving about leaves your place where you can find it. `←` and `→` at either end of a line go to the row before or after. A zoom leaves the caret behind, and clicking a row opens it again. `Cmd` + `O` does what the **Finished** box beside the filter does.

    A row moves when the file says it moved, and the caret goes back to the character you were at, so `Tab` in the middle of a word leaves you in the middle of that word.

[^markmenu]: The row's menu keeps **Clear** beside the four marks when the row carries one, and the mark a row already has is not offered. A `done` and a `cancelled` each carry the instant they were written at, which is what puts the row on that day's page ([dates-and-status.md](dates-and-status.md)). Pressing any of the three keys at a mirror marks the node it stands for, so every placement of it follows.

[^cancel]: Cancelling settles work: anything waiting on the row stops waiting, the row stops being owed, and a rollup counts it out, so `3/5` becomes `3/4`. It does not cascade, since rows under a cancelled one keep their own marks, and the finished mark above it stays. Marking a row **To do** or **Doing** under a branch somebody ticked off re-opens that branch and every mark in the chain, and the line under the row names what it re-opened.

[^refused]: Walking the mark off something done or cancelled asks you to press `Cmd` + `Enter` or `Alt` + `Enter` first, to take that mark off, and then walk on. Starting a row that comes after unfinished work asks you to finish what the sentence names, or start something ready. `Cmd` + `Enter` on a branch holding unfinished work asks you to finish those rows, or call them off with `Alt` + `Enter`.

[^trigger]: Each trigger has its own list. The days read `tomorrow`, `next fri`, `aug 20`, `in 3 weeks` or `2026-09-01`, the list says which day every phrase means before you take it, and taking one writes the node's `date`. Tags come most-used first. `((` offers a node to search for, placed here as a mirror.

[^tag]: A tag is written into the line and commits with it, with nothing added after it, so `#alice` and `@alice` stay two tags. `#` and `@` need a word boundary in front of them, which leaves `srid@srid.ca` an address. Backspacing over a trigger closes the list, and a trigger that matches nothing shows nothing.

[^mirror]: A mirror takes the line or the next one: a line you had only just opened becomes the mirror itself, and a line with words in it keeps them and puts the mirror on the next row. A mirror is retired from its own row, through **More** › **Remove from here** in that row's menu. `Cmd` + `Z` cannot take that back; `((` is how it comes back.

[^undo]: An undo is a fresh write, judged against the outline as it is now, so one that does not fit says so in the words the write gate uses rather than guessing. It is your own edits, this session, in this tab; opening another outline starts again. While you are still typing, `Cmd` + `Z` is the text box's own, and the outline's undo begins once the line is committed.

[^delete]: What an undo reaches on a row you have just made is the un-create, and the row goes to the Trash keeping its id ([organising.md](organising.md)).

<details>
<summary>Every key, and what a split or a join does with the row</summary>

| Key | What it does |
| --- | --- |
| `Enter` | Finish the row and start the next |
| `Enter` at the start | Insert a blank row above |
| `Enter` mid-line | Split the row in two |
| `Backspace` at the start | Join this row onto the one above |
| `Tab` | Indent under the row above |
| `Shift` + `Tab` | Outdent |
| `Alt` + `Shift` + `↑` | Move the row up among its siblings (`Cmd` + `Shift` + `↑` on a Mac too) |
| `Alt` + `Shift` + `↓` | Move it down (`Cmd` + `Shift` + `↓` on a Mac too) |
| `Shift` + `Enter` | Write the note under the row |
| `Escape` | Discard what you were typing |
| `↑` / `↓` | Go to the row above or below |
| `←` / `→` at either end of a line | Go to the row before or after |
| `Ctrl` + `Space` | Collapse this row, or expand it |
| `Cmd` + `↑` / `Cmd` + `↓` | Collapse it, or expand it |
| `Cmd` + `.` (`Alt` + `.`) | Zoom into this row |
| `Cmd` + `,` (`Alt` + `,`) | Zoom out, to the parent's page or one zoom up |
| `Cmd` + `O` | Show or hide finished items on this page |
| `Cmd` + `\` | Show or hide the sidebar |

| On a blank row | What happens |
| --- | --- |
| `Escape` | Drops the draft |
| `Backspace` | Deletes it and puts the caret at the end of the line above |
| `Tab`, `Shift` + `Tab`, `Alt` + `Shift` + `↑` / `↓` | Re-seat the draft; nothing is written until the row has a title |

| What was on the row that is absorbed | Where it goes |
| --- | --- |
| Its children | Adopted by the row above, in order, at the end |
| Its note | Joined to the other note, one blank line apart |
| Its mark, date, document and what it waits on | To the Trash with its record, which **Put back** returns |

A line under the row names what went. Neither key works at a mirror, and the first row of a level has nothing above to join onto; both say so under the row. A line you have only just started counts: what you typed is written first, and then cut or joined.

</details>

<details>
<summary>Open what a row keeps behind the ¶, and how much of it is drawn</summary>

## Open what a row keeps behind the ¶

A small dim **¶** beside a title says there is a note or a `see` reference behind it. Press it, or press `Space` with it focused, and the row opens; press it again, click away, or press `Escape`, and it folds back. A row with nothing behind it wears no ¶.

How much of a row is drawn to start with is yours, under **Row density** in the preferences panel's **Outlines** group:

| Choice | What a row shows |
| --- | --- |
| **Compact** | The title and its property chips alone |
| **Cozy** | Those, and the first line of the note, clamped. The default |
| **Open** | Every note you have not folded yourself, in full |

It is a default, not a lock: the ¶ works at all three, and a row you fold or open yourself stays as you left it. The choice belongs to this browser and reaches every tab of it. **Size** under **Appearance** moves the whole page: **Medium**, **Large** (the default) or **Larger**.

</details>

<details>
<summary>Reach the verbs a key has no chord for</summary>

## Reach the verbs a key has no chord for

On a pointer device, hover a row and its `•••` appears in the gutter left of the collapse triangle. On a phone, hold a finger on the row and the same menu opens under it. A finger that moves is scrolling the page.

The menu is short and in groups. **Zoom in** and **Mark** come first, then **Set date…** (or **Change date…**), **Set repeat…** on a dated row and **Pin to sidebar**. Below those sit **Move to…** and **Duplicate**, then what plugins add, such as **Start an agent**, then **More**, and last, alone, **Move to Trash**.

Under **More** sit **Copy link**, **Copy as text**, **Expand all**, **Collapse all**, **Add property…**, **Link to…**, **Wait for…**, **Remove from here**, **Clear date** and **Stop repeating**.

The arrows walk the menu, `→` or `Enter` opens a submenu, `←` goes back to the entry that opened it, and `Escape` closes the menu and puts the caret back on the `•••`. A link inside a row keeps its own **Open in new tab** menu. A row on the agenda or a day's page has the same menu, minus the verbs that need a tree around the row.

</details>

<details>
<summary>Add a property to a row</summary>

## Add a property to a row

A node's properties are drawn under its title as a run of small chips, one per fact, whether the row is open or not ([properties.md](properties.md)).

1. Press a chip's key to open it for editing, or press anything in a chip that is not a link.
2. Type the value. `Enter` commits, `Escape` cancels, and leaving the box commits what changed.
3. Press the `+` at the end of the run to add one, which is the only place a key is typed.

A node carrying no properties has no run, so its menu offers **More** › **Add property…** instead. Clearing a value removes the property. A refusal is drawn verbatim under the run, naming what the key may hold, and the chip keeps what the file had.

A write is judged against the value you were shown, so another hand moving the key while your box sat open turns yours into that refusal rather than an overwrite. Renaming a key is removing one property and adding another.

A value that is exactly the name of something is a door: a path in the directory, a node's id, a `http:` or `https:` address, a day, or `owner/repo#123`. Anything else stays text. The node's own facts (its mark, date, repeat rule and id) are labels here, each with a verb of its own.

</details>

<details>
<summary>Say what a row points at</summary>

## Say what a row points at

A node carries two lists of other nodes: `see`, which is a link, and `after`, which is what it must come after ([format.md](format.md)).

1. Open the row's menu and choose **More** › **Link to…** or **More** › **Wait for…**. A zoomed node has both as controls under its own lines.
2. Type in the box, which searches every node in the directory.
3. Walk the hits with the arrows and take one with `Enter`, or leave with `Escape` or **Done**.

Each panel also holds what the node says now, with an `×` on each entry. An `after` that would close a loop is refused under the panel, naming the loop; a `see` loop is allowed.

A node's page draws **blocked by** apart from `after`: that list is derived from the unfinished work in the way, so it carries no `×`. The reverse list, what points at this node or document, is the fold under the note or body, collapsed until you open it. Choosing either edge at a mirror writes the node it stands for.

</details>

<details>
<summary>Start a new outline, and write a document</summary>

## Start a new outline

1. Press the `+` on the sidebar's **Outlines** heading and choose **New outline**.
2. Type a path, relative to the served directory. `Enter` creates the file and `Escape` puts the box away.
3. Write the first line on the page it lands on.

The suffix is optional: `Foo` and `Foo.olai` are the same ask, and `notes/plan` mints `notes/plan.olai`. Only the suffixes olai claims count as one, so `plan v1.2` becomes `plan v1.2.olai`. **New document** is the same door with `.md` in it. The box shows **Creating…** while the write is out, and you can type the next name without waiting.

| What you type | What you get |
| --- | --- |
| `notes.md` at **New outline** | *`notes.md` is a document, not an outline — type `notes` to make `notes.olai`* |
| `..`, `.`, or a path ending in `/` | A refusal naming what you wrote |
| A path the directory already holds, or one climbing out with `..` | The write gate's own sentence under the box |

No door here takes a file back; an outline minted by mistake is deleted from its own page ([organising.md](organising.md)).

## Write a document

Press **Edit** on a document page's header and the rendered body becomes the file's source in a textarea. There is no toolbar: a document is markdown, and markdown is text ([documents-and-kinds.md](documents-and-kinds.md)).

| Control | Key | What it does |
| --- | --- | --- |
| **Save** | `Cmd` + `Enter` | Commits the file |
| **Cancel** | `Escape` | Abandons the draft |
| **Overwrite anyway** | — | Saves over a file that moved, without the guard |

Nothing commits on a timer, and leaving the page abandons the draft, including leaving for another document. Each pane and browser tab keeps its own draft. `Cmd` + `Z` takes a saved edit back.

> Edit the same document in vim while the editor is open and olai says so the moment the disk moves. A **Save** after that is refused, with your text kept where you typed it, and **Overwrite anyway** appears beside **Cancel**.

Two doors mint a document: **New document** under the sidebar's `+`, and **+ day note** on a day's page, which files that day's note where the newest existing daily note's own path says they go. Either door lands in the new document's editor. A `.html`, `.csv`, picture or `.pdf` has a page and no **Edit** control.

</details>
