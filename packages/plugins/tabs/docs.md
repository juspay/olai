# Tabs

`tabs` keeps several pages open in the main column. On a desktop it draws the
strip above the panes, labelled **Open tabs**. Each tab holds a workspace: one
page, or a whole split of panes, with its own filter, its own pane focus and
its own Back and Forward.

The header, the sidebar, the agent panel, the palette, the appearance and the
fold state of outline branches are shared by every tab. A door in the sidebar
changes the tab in front rather than opening another.

## What a tab says

Each tab shows a glyph for the kind of page it holds, a title, and a close
button whose tip is `Close tab` and whose name is `Close <title>`. The close
button is drawn on the tab in front, under the pointer, and on any screen with
no pointer to reveal it with.

| Glyph | The page it holds |
| --- | --- |
| `⌂` | the front page |
| `¶` | a file |
| `•` | a row |
| `⌫` | the Trash |
| `◷` | a plugin's page over a row's reading |
| `◇` | a page a plugin draws itself |
| `◫` | a split of panes |

A tab holding a file is named the way the sidebar names it: a document without
its suffix, `garden` rather than `garden.olai`, and any other file with it,
`q3.pdf`. When two open tabs would say the same word for different files, both
show their whole path until one of them closes.

A split tab joins its panes' names with ` + `. Any other page shows the title
its page reported, or the page's own label until it reports one. Every tab in
the strip is the same width, so nothing moves while a page arrives.

A tab says the address it holds twice: in the tip, which a pointer gets on
hover and a keyboard on focus, and at the end of the tab's accessible name. The
strip truncates a long title at 14rem, and draws no address of its own. The
browser's address bar shows the address of the tab in front and nothing about
the rest.

A tab can wear one dot, and what it means is [chat.md](chat.md)'s to say: a dot
in the alert colour for a conversation that needs you, a muted one for a turn
nobody has read. A tab caught by both wears the question. It is a dot and
nothing more — no tab comes forward because of one.

## Work the strip

- Click a tab to bring it to the front.
- Middle-click a tab, or click its ×, to close it. Closing the tab in front
  brings the one to its right forward, or the one to its left when it was the
  rightmost. Closing the last tab leaves one tab on the front page.
- Drag a tab to reorder the strip; a bar shows where it will land.
- Right-click a tab for **Duplicate tab** (a copy right after it, brought to
  the front), **Close other tabs**, **Copy address** and **Close**.
- Click **+**, named **New tab**, for a new tab on the front page.
- With the strip focused, `←` and `→` move between tabs.

The **Copy address** entry puts the tab's whole link on the clipboard. Where
the browser refuses to write to it, olai shows the address in a prompt headed
`Couldn't copy the address. Copy it from here:` for you to copy by hand.

## Open a page in a new tab

Right-click any link olai can open, a door in the sidebar or a link in a
document, for **Open** and **Open in new tab**. A new tab opens right after
the tab in front and stays behind it. A link to a heading in its own document,
and a line of a document's contents, open that document at that heading;
**Open** also puts the heading in the address.

Links inside an outline row, its bullet included, carry this menu; the rest of
the row keeps its row menu. A link to a fragment of the page you are on gets no
menu, and an external link keeps the browser's. `Shift` and a right-click
always show the browser's menu, and `Cmd` with a click or a middle-click still
open a browser tab, as they do everywhere else.

Clicking a pinned layout on the shelf opens it in a new tab in front
([pins.md](pins.md)); `Alt` and `Alt` + `Shift` still open its pages beside the
ones you have. Without this row it opens in place.

## Keys

| Keys | What it does |
| --- | --- |
| `Cmd` + `Shift` + `.` | Show the next tab |
| `Cmd` + `Shift` + `,` | Show the previous tab |
| `Cmd` + `Shift` + `O` | Open a new tab on the front page |
| `Cmd` + `Shift` + `X` | Close the tab in front |

`Cmd` is the modifier on a Mac and `Ctrl` elsewhere. The browser keeps `Cmd` +
`T`, `Cmd` + `W`, `Cmd` + `1` to `Cmd` + `9`, `Cmd` + `Shift` + `[` and `Cmd` +
`Shift` + `]` for its own tabs, so those are left alone. These four work while
you are typing, are listed in the keyboard shortcuts sheet under `Added by
plugins`, and do nothing below the desktop breakpoint.

## Back and Forward

Back and Forward move within the tab in front. Bringing a tab to the front is
not a history step, and closing a tab drops its history. Returning to a tab
returns to where its page was scrolled.

History is kept per document: after a reload every tab's history starts empty,
and Back at the start of a tab's history stays on that tab. All of this holds
only while the strip is drawn. On a phone, or with the layout row off, Back and
Forward are the window's own.

## What a tab keeps

A tab mounts its pages the first time it is shown, and those same page
elements, subscriptions, composer drafts, open tool details, filters and scroll
positions stay with it until it closes. Switching tabs hides the old pages and
shows the new ones; closing a tab disposes them.

A hidden page handles no keyboard gestures and draws no menus, but its page
report still updates its tab's title, and a hidden conversation can still
notify you when it needs an answer. A restored tab you have never looked at
keeps its address and title alone, and opens nothing until you click it.

## What is stored

The set of tabs, their order, their addresses and titles, and which tab is in
front are kept per browser under the `olai.tabs` preference. The set is written
when a tab opens, closes, moves, or changes places with the one in front, and
not on every change to the page in front. Another window does not pick those
changes up live: the window that writes last wins.

Opening olai at an address shows that address in the tab that was in front, so
a link you open, or a reload, always shows what you asked for. A stored tab
keeps an address rather than a parsed page, so a plugin switched on or off
since it was stored is honoured when the tab comes back.

## On a phone

Below the desktop breakpoint there is no strip. The tab in front becomes the
window's only page and the others are disposed, though the stored set is kept,
so visiting on a phone does not erase the tabs of a desk. **Open in new tab**
shows the page at once, since there is no strip to find it in, and Back returns
to the page before it. The keys do nothing.

## When rows are switched off

| Row off | What changes |
| --- | --- |
| `tabs` | the strip goes and the page in front stays; Back and Forward walk the window's whole history again. Switching it back on restores the stored set |
| `layout` | no strip is drawn. The set is kept, the keys do nothing, and Back and Forward are the window's |
| `chat` | tabs wear no dot. Both marks are chat's facts |
| `pins` | nothing here changes; pinned layouts are the pins row's |

## For plugin authors

`tabs.state` carries the tabs, the id in front, and `open(workspace, {
behind })`, `show`, `step`, `close`, `closeOthers`, `duplicate` and `reorder`.
Name it on a component of your own, so your row still works without this one.

`dot({ ids, paint, label, rank })` registers a reading of which tabs wear a
mark, how it is painted and what it is called; `dotted()` collapses every
registered reading into one mark per tab, the highest `rank` winning. `drawn()`
says whether a strip is drawing the tabs on a desktop.

The row needs only `navigation.state`. It names a history lane for the tab in
front ([navigation.md](navigation.md)) while the strip reports that it draws,
and gives the window its history back when it stops. A tab's name is read from
navigation too, so tabs asks no page plugin what to call it.
