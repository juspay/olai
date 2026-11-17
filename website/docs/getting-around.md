# The sidebar, tabs and the palette

The sidebar lists the files olai serves and your pinned pages, tabs keep several pages open, and the palette runs commands.

`Cmd` is the modifier on a Mac; press `Ctrl` elsewhere.

## Read the sidebar

| Section | What it lists |
| --- | --- |
| **Outlines** | Outline files, which hold rows, and their folders[^plus] |
| **Reference** | Every other file olai serves, grouped by folder and collapsed[^reference] |
| **olai** | The outlines olai keeps for itself, in the `_olai/` folder[^olai] |
| **Trash** | Rows you have put away, pinned at the foot of the column |
| **Inbox** | Beside **Agenda** at the top, once the directory has an inbox[^inbox] |

`Cmd` + `\` shows or hides the column.

## Move between panes

A pane is one page beside another in the same window. `Alt` + click a link opens it in the pane to the right; `Cmd` + `Shift` + `W` closes one.[^panes]

## Pin a page or a layout

Pinned pages sit in a list between the calendar and the file tree. You can pin a row's page, a document, or a page narrowed with a filter query ([filtering.md](filtering.md)).[^pins][^shelf] The palette can also pin a layout of panes.[^layout]

## Keep several pages open

On a desktop a strip of tabs sits above the page, and `Cmd` + `Shift` + `O` opens a new one.[^tabs] Each tab holds one page or a split of panes, and remembers its filter and scroll position.[^tabstate][^tabsback]

## Use the palette, and capture a line

`Cmd` + `K` opens the palette, a search box with commands under it. It opens pages, searches the directory, runs commands on the row you are zoomed into, and reaches your agent conversations ([search.md](search.md)).[^palette] Type `+` and a line, press `Enter`, and the line goes to the directory's inbox; you stay on the page.[^capture][^inboxfile] `olai surface capture` sends a line from a terminal.[^terminal]

[^plus]: The `+` on the **Outlines** heading holds **New outline** and **New document** ([editing.md](editing.md)).

[^reference]: The **Reference** section counts the files beside each folder's name. Opening a document opens that section and the folders leading to the file, and marks the file's row; going back to an outline restores the folds you chose. Empty folders are left out, a folder holding both kinds of file appears in both trees, and a directory with only outlines has no **Reference** heading.

[^olai]: The **olai** section is drawn only when the `_olai/` folder has files in it. Those files are part of the directory either way: search finds them, an agent lists them, and git records them. What changes is only whether this list of rows is drawn. An outline olai cannot read shows a ⚠ here, as it does everywhere else.

[^inbox]: The inbox is an ordinary outline that captured lines land in, and you can type into it. The **Inbox** badge counts the rows in it marked **To do** or **Doing**, at any depth. A row marked done or cancelled leaves the count, a row with no mark was never in it, and the badge is hidden when the count is zero.

[^panes]: `Alt` + `←` and `Alt` + `→` move the focus only when you are not typing: while the caret is in a row they stay the text box's own word jump, so press `Escape` first. `Alt` + click on a link to a heading inside a document, or on a line of a document's contents, opens that document at the heading. `Cmd` + click, middle-click and `Shift` + click stay the browser's own, and open a new browser tab or window.

[^pins]: In a row's menu, **Pin to sidebar** pins that row's page, and the entry reads **Unpin from sidebar** once it is pinned. In the palette, **Pin this page** pins the focused pane's page in one press, **Pin this page…** asks what to call a narrowed page first, and **Unpin this page** takes the focused page off the list. With nothing pinned, the list is not drawn at all.

[^shelf]: Clicking a pinned narrowed page opens it with that filter in the box, which is how you save a search here; the query is drawn beside the pin's name. A pinned row shows its title as it reads now; no copy of the title is stored with the pin.

    The list of pins is a `Pins.olai` in the directory olai serves. olai creates `_olai/Pins.olai` the first time you pin something, and never moves a `Pins.olai` you already have. You can edit it like any outline ([documents-and-kinds.md](documents-and-kinds.md)). Reordering and renaming a pin are in the closed block below.

[^layout]: A layout pin is offered as **Pin this layout…**, with the names of the panes underneath, and as **Unpin this layout** when those pages are already pinned. It always asks for a name: `Enter` with nothing typed says *A layout needs a name* and keeps the question open, and `Escape` writes nothing.

    A layout pin shows a split mark, and its tooltip lists its pages. Only the pages are saved, so it reopens with the panes equally wide and the first one focused.

[^tabs]: The other ways to open a tab are the `+` at the end of the strip and **Open in new tab** from a link's menu. `Cmd` + `Shift` + `.` and `Cmd` + `Shift` + `,` move to the next and previous tab, and `Cmd` + `Shift` + `X` closes the tab in front, as do its `×` and a middle-click. Right-click a tab for **Duplicate tab** and **Close other tabs**, and drag a tab along the strip to reorder it.

[^tabstate]: The tab in front is the one the address bar, the sidebar, Back and every pane gesture act on, while the sidebar and the palette are shared by every tab. A tab opened from a link opens behind the one in front, and closing the last tab leaves one tab on the front page. Back and Forward move within the tab in front, and closing a tab takes its pages out of them.

[^tabsback]: The open tabs are remembered in this browser, so a reload brings them back, though each tab's Back history starts fresh. A phone has no strip of tabs: **Open in new tab** shows the page straight away, and the tabs from your desk are kept for when you come back to it ([plugins/tabs.md](plugins/tabs.md)).

[^palette]: A palette you have just opened has nothing chosen, so `Cmd` + `K` and then `Enter` does nothing: the first character you type is what chooses, and `↓` is the other way in. **Keyboard shortcuts** in the palette lists every key the app answers. What the palette offers on a zoomed row, and how its levels and refusals work, are in the closed block at the foot of this page.

[^capture]: A capture moves you nowhere: the page you were reading, your scroll position and the address stay as they were, the line becomes a row, and the box empties for the next line. The palette says afterwards which line landed, and `Cmd` + `Z` takes a capture back. The **Capture to the Inbox** row in the palette does the same thing: it types the `+` and leaves the caret after it.

[^inboxfile]: The line lands at the top level of the `Inbox.olai` the directory already has, wherever that file sits, or in a new `_olai/Inbox.olai` if there is none. Creating that file is part of the same operation as writing the line, so a capture that is refused leaves no file behind. The **Inbox** entry in the sidebar opens whichever file that is.

[^terminal]: `olai surface capture` sends a line from outside the browser: from a shell, from a Raycast script pointed at Mail.app, or from a cron job that noticed something ([connecting-agents.md](connecting-agents.md)). It writes to the same inbox, and the **Inbox** entry in the sidebar lights up for it. What it can carry that a palette capture cannot is in the closed block at the foot of this page.

<details>
<summary>Keep the list of pins in order, and what the naming question takes</summary>

## Keep the list of pins in order

The naming question is asked in the palette's own box, with the name the page would take otherwise shown as a placeholder:

| Key | What it writes |
| --- | --- |
| `Enter` with nothing typed | Pins the bare address, whose name is read live from the page |
| `Enter` with words | Pins it under that name, as one row whose title is a Markdown link |
| `Escape` | Nothing at all, since the question comes before the pin |

A name the link cannot hold, such as one containing `]`, is refused in the palette's own line rather than mangled. While the question is up it replaces the list of commands.

Hovering a pin shows a `✎` beside its `×`. The `✎` asks the same naming question, holding the name the pin has now, and `Enter` with nothing typed takes the name off, leaving a bare address drawn by whatever it points at. A rename is an ordinary title edit, so `Cmd` + `Z` takes it back; it is refused if another writer has changed that pin's name or destination in the meantime.

Drag a pin to reorder the list: press, move, and a line shows where it will land. A press that does not move is the click it always was, and `Escape` cancels a drag you are holding. The `×` takes a pin off, which puts its row in the Trash keeping its id, so `Cmd` + `Z` and **Put back** both reach it ([organising.md](organising.md)).

## Pin a layout

| Click on a layout pin | What opens |
| --- | --- |
| A plain click | The layout, in a new tab in front |
| `Alt` + click | Its pages to the right of the pane you are in |
| `Alt` + `Shift` + click | Its pages as new panes |
| `Cmd` + click or middle-click | Its address in a new browser tab |

</details>

<details>
<summary>Every key for panes and tabs</summary>

| Key or click | What it does |
| --- | --- |
| `Alt` + click a link | Opens it in the pane to the right |
| `Alt` + `Shift` + click | Opens it in a new pane to the right |
| `Alt` + `←` / `Alt` + `→` | Moves focus to the neighbouring pane, when you are not typing |
| `Cmd` + `Shift` + `W` | Closes the focused pane |
| `Cmd` + click, middle-click, `Shift` + click | The browser's own: a new browser tab or window |

| What you want | How |
| --- | --- |
| A new tab | `Cmd` + `Shift` + `O`, the `+` at the end of the strip, or **Open in new tab** from a link's menu |
| The next or previous tab | `Cmd` + `Shift` + `.` and `Cmd` + `Shift` + `,`, or click one |
| Close the tab in front | `Cmd` + `Shift` + `X`, the `×` on it, or a middle-click |
| A copy of a tab, or only this one | Right-click a tab for **Duplicate tab** and **Close other tabs** |
| Reorder them | Drag a tab along the strip |

</details>

<details>
<summary>What the palette offers on a row, and how its levels work</summary>

## Use the palette

On a zoomed row's page, the palette lists what that row can take: `Mark: To do`, `Mark: Doing`, `Mark: Done`, `Mark: Cancelled`, `Mark: Clear`, `Clear date`, `Duplicate` and `Move to Trash`. Each one names the row it is about on its second line, and on any other page none of them are listed. The four commands that ask you something first stay where the asking happens: **Set date…**, **Set repeat…**, **Link to…** and **Wait for…** all open a panel under a row ([editing.md](editing.md), [organising.md](organising.md)).

The palette asks **Move to Trash**'s question in its own box, with the same sentence and count the row's menu uses. The question takes the caret while it is up, so `Enter` answers it, `Tab` moves between its two ways out, and `Escape` or **Cancel** backs out.

Some rows open a level of their own, marked `›`: choosing one replaces the list with that row's choices and puts its name in front of the box as a crumb. `Backspace` in an empty box goes back a level, clicking the crumb goes back to the list before it, and `Escape` closes the palette, which opens at the top level next time.

A second `Enter` while a write is still in flight is ignored rather than sent. A refusal, or a note from a write that landed, is drawn in the palette and the palette stays open; a write with nothing to add closes it. Either way `Cmd` + `Z` takes the edit back.

</details>

<details>
<summary>Capture from a terminal</summary>

## Capture from a terminal

| What differs from a palette capture | Why it matters |
| --- | --- |
| It can carry a `date` | The row is on that day's page, and counts as work owed from the next morning |
| It can carry a note under the line | The palette's single field has nowhere to put one |
| It records `captured-by` | The login a reverse proxy supplied, and nothing at all on a direct loopback call |

Either way the new row is marked **To do**. `Cmd` + `Z` does not reach a capture sent from somewhere else: an undo history is this tab's account of what it did, and nothing was pressed here.

</details>
