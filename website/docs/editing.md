# Typing an outline

An outline is a file of rows, one line each. Click a row's title and type. What you type is Markdown source, rendered when you leave the row.[^source]

Shortcuts here use `Cmd` on a Mac and `Ctrl` elsewhere.[^chord]

## Write rows

`Enter` ends a row and starts a new one.[^draft] `Tab` and `Shift` + `Tab` indent and outdent a row.[^keys] `Enter` in the middle of a line splits the row in two,[^split] and `Backspace` at the start joins it onto the row above.[^join]

## Move the caret, collapse a row, zoom in

The arrow keys move the caret from row to row. `Ctrl` + `Space` or `Cmd` + `↑` / `↓` collapses a row, hiding its children, and `Cmd` + `.` zooms in, so only that row and its children are drawn.[^nav]

## Mark a row done, cancelled, to do or doing

A mark on a row is **To do**, **Doing**, **Done** or **Cancelled**.

| Key | What it writes |
| --- | --- |
| `Cmd` + `Enter` | **Done**, or clears it |
| `Alt` + `Enter` | **Cancelled**, or clears it |
| `Cmd` + `Shift` + `Enter` | Steps through **To do**, **Doing**, no mark |

The row's menu has the same marks.[^markmenu] Cancelling a row stops other rows waiting for it.[^cancel] olai refuses some marks.[^refused]

## Insert a date, a tag, a mirror or a link to a file

In a title, four openers bring up a list under the line. `!` offers a day written in words, and `#` or `@` a tag this directory already uses. `((` offers another row to draw here as a mirror, a copy that changes whenever the original does, and `[[` a file to link to by name.[^trigger][^tag][^mirror][^wikilink]

## Undo an edit

`Cmd` + `Z` undoes your last edit in this outline, and `Cmd` + `Shift` + `Z` redoes it.[^undo] No key deletes a row: use **Move to Trash** in the row's menu.[^delete]

[^source]: What you type is the row's Markdown source, so `**bold**` and `#tags` stay as you wrote them while you are in the row. The app lists these same keys under **Keyboard shortcuts** in the palette, the list of commands `Cmd` + `K` opens.

[^chord]: Zooming is the one shortcut that differs: `Cmd` + `.` on a Mac, `Alt` + `.` elsewhere, as the app's own shortcut list shows.

[^keys]: `Alt` + `Shift` + `↑` / `↓` move a row among the rows beside it. `Shift` + `Enter` opens the note, the text under a row's title. Inside a note, `Enter` starts a new line, `Shift` + `Enter` finishes the note, and `Escape` throws away what you typed. `Cmd` + `\` shows or hides the sidebar, the column of files on the left. The table at the foot of this page lists every key.

[^draft]: A row is written to the file as soon as it has a title, so a key you press by accident writes nothing. Several blank rows you have started but not titled can sit on the page at once; click one and the caret is back in it.

    The arrow keys stop on every blank row, while the keys that indent or move a row step past an untitled one to the nearest written row. `Tab` into a collapsed branch expands it.

[^split]: Splitting cuts the line at the caret. The text before it stays on the row you were in; the text after it becomes the next row, with the caret at the start. The row you were in keeps its children, its note, its mark, its date and the rows it is waiting for. The new row has no mark.

[^join]: `Backspace` joins the row onto the row above it: the sibling above, or the parent when it is the first child. The two titles run together with nothing between them, and the caret lands where they join. The closed block at the foot of this page says where everything the joined row carried goes.

[^nav]: `Cmd` + `O` hides rows marked done, the same as the **Finished** box beside the filter box. `←` and `→` at the start or end of a line move to the row before or after. Zooming into a row leaves the caret behind, and clicking a row puts the caret back.

    A row only moves on screen once the file says it moved, and the caret returns to the character you were on, so `Tab` in the middle of a word leaves you in the middle of that word.

[^markmenu]: The row's menu lists the four marks and leaves out the one the row already has. It adds **Clear** when the row has a mark. olai records the moment you mark a row done or cancelled, which is what puts the row on that day's page ([dates-and-status.md](dates-and-status.md)). Marking a mirror marks the original row, so every copy shows the new mark.

[^cancel]: Cancelling a row means the work will not happen: rows waiting for it stop waiting, nobody is owed it, and a parent's count of finished children drops it, so `3/5` becomes `3/4`. Rows under a cancelled row keep their own marks, and a finished mark above it stays.

    Marking a row **To do** or **Doing** under a parent somebody ticked off takes **Done** off that parent and off every parent above it. A line under the row says which marks came off.

[^refused]: Stepping the mark off a row that is done or cancelled asks you to press `Cmd` + `Enter` or `Alt` + `Enter` first, to clear that mark. Marking a row **Doing** while it waits for unfinished rows asks you to finish the rows it names, or to start a row that is ready. `Cmd` + `Enter` on a row with unfinished rows under it asks you to finish those rows, or to cancel them with `Alt` + `Enter`.

[^trigger]: Each of the four opens its own list, and `↑` and `↓` walk it, `Enter` chooses, `Escape` closes it. The day list takes `tomorrow`, `next fri`, `aug 20`, `in 3 weeks` or `2026-09-01`, shows which day each phrase means before you choose, and writes the row's `date`. The tag list puts the tags you use most first.

[^tag]: A tag is written into the line itself and saved with it, with nothing added after it, so `#alice` and `@alice` are two separate tags. `#` and `@` only start a tag at the start of a word, which leaves `srid@srid.ca` an email address. Deleting the `#`, `@` or `((` closes the list, and a list with no matches is not drawn.

[^mirror]: A mirror goes on the line you are on, or on the next one. A line you had only just started becomes the mirror itself; a line with words in it keeps them, and the mirror goes on the row below. To remove a mirror, open that row's menu and choose **More** › **Remove from here**. `Cmd` + `Z` does not undo that; typing `((` again is how you put the mirror back.

[^wikilink]: The `[[` list offers the documents whose name holds what you typed, then every other file with its suffix, each with its path beside it. Choosing one writes the shortest link that opens that file from this row, such as `[[finishes]]` or `[[rooms/Note]]`, closes the brackets and leaves the caret after them. While you are inside `[[`, no other list opens. How the link is drawn is in [wikilinks.md](wikilinks.md).

[^undo]: An undo is a fresh write, checked against the outline as it stands, so one that does not fit is refused in the same words as any other write. It covers your own edits, in this browser session, in this tab; opening another outline starts a new undo history. While you type in a row, `Cmd` + `Z` is the text box's own undo, and the outline's undo starts once the line is saved.

[^delete]: Undoing a row you have just created removes it, and the row goes to the Trash keeping its id ([organising.md](organising.md)).

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
| `Escape` | Drops the blank row |
| `Backspace` | Deletes it and puts the caret at the end of the line above |
| `Tab`, `Shift` + `Tab`, `Alt` + `Shift` + `↑` / `↓` | Move the blank row; nothing is written until it has a title |

| What the joined row was carrying | Where it goes |
| --- | --- |
| Its children | To the row above, in order, at the end |
| Its note | Joined to the other note, one blank line apart |
| Its mark, date, document and the rows it waits for | To the Trash with its record, which **Put back** returns |

A line under the row says what went. Neither key works on a mirror, and the first row of a level has nothing above to join onto. A row you have only just started counts too: what you typed is written first, and then split or joined.

</details>

<details>
<summary>Open the note behind a row, and choose how much of it is drawn</summary>

## Open the note behind a row

A small dim **¶** beside a title means the row has a note behind it, or a `see` link to another row. Click it, or press `Space` while it is focused, and the row opens; click it again, click away, or press `Escape`, and it closes. A row with nothing behind it has no ¶.

How much of a row is drawn to start with is up to you, under **Row density** in the preferences panel's **Outlines** group:

| Choice | What a row shows |
| --- | --- |
| **Compact** | The title and its property chips alone |
| **Cozy** | Those, and the first line of the note, cut off at one line. The default |
| **Open** | Every note you have not collapsed yourself, in full |

The ¶ works at all three settings, and a row you open or close yourself stays as you left it. The choice belongs to this browser and applies to every tab in it. **Size** under **Appearance** changes the size of the whole page: **Medium**, **Large** (the default) or **Larger**.

</details>

<details>
<summary>The row menu, and everything in it</summary>

## The row menu, and everything in it

Hover a row and its `•••` button appears in the gutter, left of the collapse triangle. On a phone, hold a finger on the row and the same menu opens under it. A finger that moves is scrolling the page.

The menu comes in groups. **Zoom in** and **Mark** come first, then **Set date…** (or **Change date…**), **Set repeat…** on a dated row, and **Pin to sidebar**. Below those sit **Move to…** and **Duplicate**, then whatever plugins add, such as **Start an agent**, then **More**, and last, on its own, **Move to Trash**.

Under **More** sit **Copy link**, **Copy as text**, **Expand all**, **Collapse all**, **Add property…**, **Link to…**, **Wait for…**, **Remove from here**, **Clear date** and **Stop repeating**.

The arrow keys move through the menu, `→` or `Enter` opens a submenu, `←` goes back to the entry that opened it, and `Escape` closes the menu and puts the caret back on the `•••`. A link inside a row has its own menu, with **Open in new tab** in it. A row on the agenda or on a day's page has the same menu, without the entries that need the rows around it.

</details>

<details>
<summary>Add a property to a row</summary>

## Add a property to a row

A property is a key and a value on a row. A row's properties are drawn under its title as a run of small chips, one per property, whether the row is open or closed ([properties.md](properties.md)).

1. Click a chip's key to open it for editing, or click anything in a chip that is not a link.
2. Type the value. `Enter` saves it, `Escape` cancels, and clicking away saves what you changed.
3. Click the `+` at the end of the run to add a property, which is the only place you type a key.

A row with no properties has no run of chips, so its menu offers **More** › **Add property…** instead. Clearing a value removes the property. A refused value is explained word for word under the run, saying what the key may hold, and the chip keeps the value the file had.

If somebody else changes that key while your box is open, your save is refused instead of overwriting their value. To rename a key, remove one property and add another.

A value that is exactly the name of something is drawn as a link: a path in the directory olai serves, a row's id, a `http:` or `https:` address, a day, or `owner/repo#123`. Anything else stays plain text. The row's own facts (its mark, date, repeat rule and id) are shown here as labels, and each has its own menu entry instead.

</details>

<details>
<summary>Link a row to another row, or make it wait for one</summary>

## Link a row to another row, or make it wait for one

A row keeps two lists of other rows: `see`, a plain link, and `after`, the rows this one must come after ([format.md](format.md)).

1. Open the row's menu and choose **More** › **Link to…** or **More** › **Wait for…**. On a zoomed row, both are controls under its title.
2. Type in the box, which searches every row in the directory olai serves.
3. Move through the results with the arrow keys and choose one with `Enter`, or leave with `Escape` or **Done**.

Each panel also lists what the row says now, with an `×` beside each entry. An `after` that would make a loop is refused under the panel, naming the loop; a `see` loop is allowed.

A row's own page also draws **blocked by**, which is separate from `after`: that list is worked out from the unfinished rows in the way, so it has no `×`. The list of what points at this row or document is a fold under the note or body, closed until you open it. Adding either kind of link on a mirror writes it on the original row.

</details>

<details>
<summary>Start a new outline, and write a document</summary>

## Start a new outline

1. Click the `+` on the sidebar's **Outlines** heading and choose **New outline**.
2. Type a path, relative to the directory olai serves. `Enter` creates the file and `Escape` closes the box.
3. Write the first line on the page it opens.

The suffix is optional: `Foo` and `Foo.olai` ask for the same file, and `notes/plan` creates `notes/plan.olai`. Only the suffixes olai claims count as a suffix, so `plan v1.2` becomes `plan v1.2.olai`. **New document** is the same box with `.md` instead. The box says **Creating…** while the write is in flight, and you can type the next name without waiting.

| What you type | What you get |
| --- | --- |
| `notes.md` at **New outline** | *`notes.md` is a document, not an outline — type `notes` to make `notes.olai`* |
| `..`, `.`, or a path ending in `/` | A refusal naming what you wrote |
| A path the directory already holds, or one climbing out with `..` | The refusal the write gate itself gives, under the box |

Neither box deletes a file; an outline you created by mistake is deleted from its own page ([organising.md](organising.md)).

## Write a document

A document is a `.md` file. Click **Edit** in a document page's header and the rendered body becomes the file's source in a text box. There is no toolbar: a document is Markdown, and Markdown is typed as text ([documents-and-kinds.md](documents-and-kinds.md)).

| Control | Key | What it does |
| --- | --- | --- |
| **Save** | `Cmd` + `Enter` | Saves the file |
| **Cancel** | `Escape` | Throws the draft away |
| **Overwrite anyway** | — | Saves over a file that changed on disk, without the check |

Nothing saves on a timer, and leaving the page throws the draft away, including leaving for another document. Each pane and each browser tab keeps its own draft. `Cmd` + `Z` undoes a saved edit.

> Edit the same document in vim while the editor is open and olai says so the moment the file on disk changes. A **Save** after that is refused, with your text kept where you typed it, and **Overwrite anyway** appears beside **Cancel**.

Two controls create a document: **New document** under the sidebar's `+`, and **+ day note** on a day's page, which files that day's note in the folder the newest existing daily note sits in. Both open the new document's editor. A `.html`, `.csv`, picture or `.pdf` file has a page and no **Edit** control.

</details>
