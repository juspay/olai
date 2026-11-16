# Finding your way

The sidebar lists the directory, the shelf above it holds pages you pinned, a
strip of tabs keeps several pages open, and the palette reaches everything else
from the keyboard. Quick capture writes a line without leaving the page you are
reading.

`Cmd` is the modifier on a Mac; press `Ctrl` elsewhere.

## Read the sidebar

| Section | What it lists |
| --- | --- |
| **Outlines** | Node-holding files and their folders |
| **Reference** | Every other served file, grouped by folder and collapsed, with a count of files beside its name |
| **olai** | The outlines olai keeps for itself in `_olai/`, drawn only when there are some |
| **Trash** | Pinned at the foot of the column, under the scrolling list |
| **Inbox** | Beside **Agenda** at the top, drawn once the directory has an inbox |

`Cmd` + `\` shows or hides the whole column. Opening a document opens the
**Reference** section and its folder chain and marks the file's row; returning
to an outline restores the fold you chose. Empty folders are left out, a mixed
folder appears in both trees, and a directory with only outlines has no
**Reference** heading.

The files under **olai** are in the directory either way: search finds them, an
agent lists them, and git records them. What changes is one list of rows. An
outline olai cannot read wears a ⚠ there, as everywhere else.

The **Inbox** badge counts the rows in the inbox marked **To do** or **Doing**,
at any depth. A done or cancelled row leaves the count, an unmarked bullet
never joined it, and the badge hides at zero. Behind that door is an ordinary
outline you can type into.

The `+` on the **Outlines** heading holds **New outline** and **New document**
([editing.md](editing.md)).

## Move between panes

| Key or click | What it does |
| --- | --- |
| `Alt` + click a link | Opens it in the pane to the right |
| `Alt` + `Shift` + click | Opens it in a new pane to the right |
| `Alt` + `←` / `Alt` + `→` | Moves focus to the neighbouring pane, when you are not typing |
| `Cmd` + `Shift` + `W` | Closes the focused pane |
| `Cmd` + click, middle-click, `Shift` + click | The browser's own: a new browser tab or window |

`Alt` + `←` and `Alt` + `→` stay the text field's word jump while the caret is
in a row, so press `Escape` first. An `Alt` + click on a link to a heading
inside a document, or on a line of a document's contents, opens that document
at the heading.

## Pin a page to the sidebar

The shelf sits between the calendar and the file tree, and an empty shelf draws
nothing at all. Any node, any document and any page you have narrowed with a
query can go on it, one click back.

| Door | What it pins |
| --- | --- |
| **Pin to sidebar** in a row's menu | That node's page. The entry reads **Unpin from sidebar** once it is there |
| **Pin this page** in the palette | The focused pane's page, in one press |
| **Pin this page…** in the palette | A narrowed page, after asking what to call it |
| **Unpin this page** in the palette | Takes the focused page off |

A pinned page keeps its query, drawn beside its name, so clicking it lands on
the page with the filter already in the box ([filtering.md](filtering.md)).
That is how a saved search is spelled here.

The naming question is asked in the palette's own box, wearing the name the
page would take otherwise where a placeholder goes:

| Key | What it writes |
| --- | --- |
| `Enter` with nothing | Pins the bare address, whose name is read live |
| `Enter` with words | Pins it named, as one row whose title is a markdown link |
| `Escape` | Nothing at all, since the question comes before the pin |

A name the link cannot hold, such as one containing `]`, is refused in the
palette's own line rather than mangled. While the question is up it replaces
the command list.

## Keep the shelf in order

Hovering a pin shows a `✎` beside its `×`. The `✎` asks the same naming
question, holding the name it has now, and `Enter` with nothing takes the name
off, leaving a bare address drawn by whatever it points at. A rename is an
ordinary title edit, so `Cmd` + `Z` takes it back; it is refused if another
writer has changed that pin's name or destination in the meantime.

Drag a pin to reorder the shelf: press, travel, and a line shows where it will
land. A press that does not travel is the click it always was, and `Escape`
cancels a held drag. The `×` takes a pin off, which puts its row in the Trash
keeping its id, so `Cmd` + `Z` and **Put back** both reach it
([organising.md](organising.md)).

A pinned node says its name now, because no copy of the title is stored beside
the pin. The shelf is a `Pins.olai` in the served directory; olai mints
`_olai/Pins.olai` the first time you pin something and never moves a shelf you
already have. Open it like any outline and edit it
([documents-and-kinds.md](documents-and-kinds.md)).

## Pin a layout

With several panes open, the palette also offers **Pin this layout…**, with the
pane names underneath, and **Unpin this layout** when those pages are already
pinned. It always asks for a name: `Enter` with nothing says *A layout needs a
name* and keeps the question open, and `Escape` writes nothing.

| Click on a layout pin | What opens |
| --- | --- |
| A plain click | The layout, in a new tab in front |
| `Alt` + click | Its pages to the right of the pane you are in |
| `Alt` + `Shift` + click | Its pages as new panes |
| `Cmd` + click or middle-click | Its address in a new browser tab |

A layout pin wears a split mark, and its tooltip lists its pages. Only the
pages are saved, so it reopens with equal widths and the first pane focused.

## Keep several pages open

On a desktop a strip of tabs sits above the page. Each tab holds one page or a
whole split of panes, and the tab in front is the one the address bar, the
sidebar, Back and every pane gesture act on. The sidebar, the agent panel and
the palette are shared by every tab, and a tab you leave keeps its page, its
filter and where it was scrolled.

| What you want | How |
| --- | --- |
| A new tab | `Cmd` + `Shift` + `O`, the `+` at the end of the strip, or **Open in new tab** from a link's menu |
| The next or previous tab | `Cmd` + `Shift` + `.` and `Cmd` + `Shift` + `,`, or click one |
| Close the tab in front | `Cmd` + `Shift` + `X`, the `×` on it, or a middle-click |
| A copy of a tab, or only this one | Right-click a tab for **Duplicate tab** and **Close other tabs** |
| Reorder them | Drag a tab along the strip |

A tab opened from a link opens behind the one in front, and closing the last
tab leaves one on the front page. Back and Forward move within the tab in
front, and a closed tab's pages leave them.

The open tabs are remembered in this browser, so a reload brings them back,
though each tab's Back starts fresh. A phone has no strip: **Open in new tab**
shows the page straight away, and the tabs from your desk are kept for when you
return ([plugins/tabs.md](plugins/tabs.md)).

## Use the palette

`Cmd` + `K` opens it. It goes places, asks the agent and writes two kinds of
thing ([search.md](search.md)). An untouched palette has nothing chosen, so
`Cmd` + `K` and `Enter` does nothing: the first character you type is the
choice, and `↓` is the other way in. **Keyboard shortcuts** lists every key the
app answers.

On a zoomed node's page, the palette lists what that node can take: `Mark: To
do`, `Mark: Doing`, `Mark: Done`, `Mark: Cancelled`, `Mark: Clear`, `Clear
date`, `Duplicate` and `Move to Trash`. Each row names the node it is about on
its second line, and on any other page there are none of them. The four verbs
that ask something first stay where the asking happens: **Set date…**, **Set
repeat…**, **Link to…** and **Wait for…** all hang a panel off a row
([editing.md](editing.md), [organising.md](organising.md)).

The palette asks **Move to Trash**'s question in its own box, with the same
sentence and count the row's menu asks. The question takes the caret while it
is up, so `Enter` answers it, `Tab` cycles its two ways out, and `Escape` or
**Cancel** backs out.

Some rows open a level, marked `›`: choosing one replaces the list with that
row's choices and puts its name before the box as a crumb. `Backspace` on an
empty box goes back a level, a press on the crumb goes back to before it, and
`Escape` closes the palette, which opens at the top next time.

A second `Enter` while a write is still out is ignored rather than sent. A
refusal, or a nudge from a write that landed, is drawn in the palette and the
palette stays up; a write with nothing to add closes it. Either way `Cmd` + `Z`
takes the edit back.

## Capture a line without leaving the page

1. Press `Cmd` + `K`.
2. Type `+` and then the line.
3. Press `Enter`.

Nothing moves: the page you were reading, your scroll and the address stay
where they were, the line becomes a node, and the box empties for the next one.
The palette says afterwards which line landed, and `Cmd` + `Z` takes a capture
back. The **Capture to the Inbox** row in the palette is the same gesture: it
types the `+` and leaves the caret after it.

The line lands at the top level of the directory's inbox — the `Inbox.olai`
the directory already keeps, wherever that is, and a new `_olai/Inbox.olai`
when it has none. Minting the file is part of the same operation as the line,
so a capture that is refused leaves no file behind. The **Inbox** door in the
sidebar opens whichever file that is.

## Capture from a terminal

`olai surface capture` sends a line from outside the browser — a shell, a
Raycast script pointed at Mail.app, a cron job that noticed something
([connecting-agents.md](connecting-agents.md)). It writes to the same inbox,
and the **Inbox** door lights up for it.

| What differs from a palette capture | Why it matters |
| --- | --- |
| It carries a `date` | The row is on that day's page, and counts as work owed from the next morning |
| It can carry a note under the line | The palette's single field has nowhere to put one |
| It records `captured-by` | The login a reverse proxy supplied, and nothing at all on a direct loopback call |

Either door makes a row marked **To do**. `Cmd` + `Z` does not reach a capture
sent from away: an undo stack is this tab's account of what it did, and nothing
was pressed here.
