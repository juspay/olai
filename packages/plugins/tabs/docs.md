# Tabs

The `tabs` plugin keeps several pages open at once, in a strip labelled **Open tabs** in the header, over the pages.[^workspace]

## What a tab shows

A tab shows a symbol for its kind of page,[^glyphs] the title and a close button.[^close] A file's tab shows the name the sidebar, the left column of files, gives that file.[^names] Point at a tab to see its address.[^address] A tab can carry one dot, put there by the chat plugin ([chat.md](chat.md)).[^dot]

## Work the strip

- Click a tab to bring its page to the front; middle-click it, or click its ×, to close it.[^closing]
- Drag a tab to move it along the strip.[^drag]
- Right-click a tab for **Duplicate tab**, **Close other tabs**, **Copy address** and **Close**.[^copy]
- Click **+**, named **New tab**, for a tab on the front page.
- With the strip focused, `←` and `→` move between tabs.

## Open a page in a new tab

Right-click a link olai can open and choose **Open** or **Open in new tab**.[^newtab][^menu] Clicking a pinned set of pages opens it in a new tab in front ([pins.md](pins.md)).[^pins]

## Keys

| Keys | What it does |
| --- | --- |
| `Cmd` + `Shift` + `.` | Show the next tab |
| `Cmd` + `Shift` + `,` | Show the previous tab |
| `Cmd` + `Shift` + `O` | Open a new tab on the front page |
| `Cmd` + `Shift` + `X` | Close the tab in front |

`Cmd` is the key on a Mac and `Ctrl` elsewhere. The browser keeps its own tab shortcuts.[^browserkeys]

## What a tab keeps

A tab loads its pages when you first look at it and keeps them until you close it.[^mount] Back and Forward move through the history of the tab in front.[^history] Each browser remembers its own tabs.[^stored][^opening] A phone shows no strip.[^phone]

[^workspace]: What one tab holds: a single page, or a whole set of panes side by side, with its own focused pane, its own Back and Forward history, and its own filter on what an outline shows. Every tab shares the header, the sidebar, the command palette, the appearance settings and which branches of an outline are folded open.

    Clicking an entry in the sidebar changes the page in the tab you are looking at rather than opening another tab. The tab in front meets its page below it ([layout.md](layout.md)).

[^glyphs]: The symbol on a tab says what kind of page the tab holds. The kinds are the front page, a file, a row (one line of an outline), the Trash, a plugin's page shown over a row's text, a page a plugin draws itself, and a set of split panes. All seven symbols are listed in the closed block at the foot of this page.

[^close]: The close button's tip reads `Close tab`, and a screen reader reads it as `Close <title>`. It is drawn on the tab in front, on whichever tab the pointer is over, and on every tab on a screen that has no pointer to reveal it with.

[^names]: A document, which is a Markdown file, is named without its suffix: `garden` rather than `garden.olai`. Any other file keeps its suffix, such as `q3.pdf`. When two open tabs would show the same word for different files, both show their whole path until one of them closes.

    A tab holding split panes joins its panes' names with ` + `. Any other page shows the title the page reported, or the page's own label until it reports one. Every tab in the strip is the same width, so nothing moves when a page finishes loading.

[^address]: The tab's address is in its tip, which a pointer gets by hovering and a keyboard by focusing the tab, and at the end of the name a screen reader reads out. The strip cuts a title off at 14rem and shows no address of its own. The browser's address bar shows the address of the tab in front and says nothing about the other tabs.

[^dot]: A dot in the alert colour marks a conversation that needs an answer from you, and a muted dot marks a reply nobody has read yet. A tab that is both shows the alert-coloured dot. The dot only marks the tab: no tab is brought to the front because of one.

[^closing]: Closing the tab in front brings the tab to its right forward, or the tab to its left when it was the rightmost one. Closing the last tab leaves one tab open on the front page.

[^drag]: While you drag a tab, a bar shows where it will land.

[^copy]: The right-click menu: **Duplicate tab** puts a copy right after the tab and brings it to the front. **Copy address** puts the tab's whole link on the clipboard. Where the browser refuses to write to the clipboard, olai shows the address in a prompt headed `Couldn't copy the address. Copy it from here:` for you to copy by hand.

[^newtab]: A new tab opens right after the tab in front, and the tab in front stays in front. A link to a heading in its own document, and a line in a document's list of contents, open that document at that heading. **Open** also puts the heading in the address.

[^menu]: Not every link carries this menu. A link in the sidebar, a link inside a document and a link inside an outline row, including the row's bullet, carry it; the rest of the row keeps the row's own menu. A link to a place on the page you are already on gets no menu, and a link to another website keeps the browser's menu.

    `Shift` with a right-click always shows the browser's menu, and `Cmd` with a click, or a middle-click, still opens a browser tab.

[^pins]: A pinned set of pages is listed under **Pinned** in the sidebar, and clicking it there is what opens it. Holding `Alt`, or `Alt` + `Shift`, still opens its pages beside the pages you already have. With the tabs plugin switched off, a pinned set opens in the page you are looking at.

[^browserkeys]: These stay with the browser's own tabs, and olai leaves them alone: `Cmd` + `T`, `Cmd` + `W`, and `Cmd` + `1` to `Cmd` + `9`. So do `Cmd` + `Shift` + `[` and `Cmd` + `Shift` + `]`. olai's four keys work while you are typing, are listed in the keyboard shortcuts sheet under `Added by plugins`, and do nothing on a screen narrower than a desktop.

[^mount]: A tab keeps the same page elements, subscriptions, half-written messages, open tool details, filters and scroll positions until you close it. Switching tabs hides the pages of the old tab and shows those of the new one; closing a tab throws its pages away.

    A hidden page answers no keyboard shortcuts and draws no menus, but it still updates its tab's title, and a hidden conversation can still notify you when it needs an answer. A tab that olai restored and you have not looked at yet holds only its address and title, and loads nothing until you click it.

[^history]: Bringing a tab to the front is not a history step, and closing a tab throws its history away. Returning to a tab returns to where you had scrolled its page.

    History is kept per browser document: after a reload every tab starts with an empty history, and pressing Back at the start of a tab's history keeps you on that tab. All of this holds only while the strip is drawn. On a phone, or with the layout plugin switched off, Back and Forward are the browser window's own.

[^stored]: The tabs, their order, their addresses and titles, and which one is in front, are kept in the `olai.tabs` preference. olai writes it when a tab opens, closes, moves or changes place with the tab in front. It is not written on every change inside the page in front. Another open window does not pick those changes up as they happen: the last window to write wins.

[^opening]: Opening olai at an address shows that address in the tab that was in front, so a link or a reload shows what you asked for. A stored tab keeps an address rather than a loaded page, so a plugin you switched on or off in the meantime is taken into account when the tab comes back.

[^phone]: On a screen narrower than a desktop, the tab in front becomes the window's only page and the other tabs are thrown away. The stored set is kept, so visiting on a phone does not erase the tabs on your desk. **Open in new tab** shows the page straight away, since there is no strip to find it in, and Back returns to the page before it. The four keys do nothing.

<details>
<summary>Every symbol, and the page it stands for</summary>

| Symbol | The page it holds |
| --- | --- |
| `⌂` | the front page |
| `¶` | a file |
| `•` | a row |
| `⌫` | the Trash |
| `◷` | a plugin's page shown over a row's text |
| `◇` | a page a plugin draws itself |
| `◫` | a set of split panes |

</details>

<details>
<summary>When another plugin is switched off</summary>

| Plugin off | What changes |
| --- | --- |
| `tabs` | the strip goes and the page in front stays; Back and Forward walk the browser window's whole history again. Switching it back on restores the stored set of tabs |
| `layout` | no strip is drawn. The set of tabs is kept, the keys do nothing, and Back and Forward are the browser window's |
| `chat` | tabs show no dots. Both dots belong to the chat plugin |
| `pins` | nothing here changes; pinned sets of pages belong to the pins plugin |

</details>

<details>
<summary>For plugin authors</summary>

`tabs.state` carries the tabs, the id of the tab in front, and `open(workspace, { behind })`, where a workspace is what one tab holds, along with `show`, `step`, `close`, `closeOthers`, `duplicate` and `reorder`. Name it on a component of your own, so your plugin still works when tabs is switched off.

`dot({ ids, paint, label, rank })` registers which tabs show a dot, how it is painted and what it is called; `dotted()` combines every registered answer into one dot per tab, the highest `rank` winning. `drawn()` says whether a strip is drawing the tabs on a desktop.

The tabs plugin needs only `navigation.state`. It names a history lane for the tab in front ([navigation.md](navigation.md)) while the strip reports that it is drawn, and gives the window its history back when it stops. A tab's name is read from navigation too, so tabs asks no page plugin what to call it.

</details>
