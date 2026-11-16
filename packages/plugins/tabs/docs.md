# Tabs

`tabs` keeps several pages open in the main column, in a strip above the panes labelled **Open tabs**. Each tab holds a workspace of its own.[^workspace]

## What a tab says

Each tab shows a glyph for its kind of page,[^glyphs] a title and a close button.[^close] A file's tab is named the way the sidebar names it.[^names] The address it holds is in its tip.[^address] A tab can wear one dot, which is [chat.md](chat.md)'s to explain.[^dot]

## Work the strip

- Click a tab to bring it forward; middle-click it, or click its ×, to close it.[^closing]
- Drag a tab to reorder the strip.[^drag]
- Right-click a tab for **Duplicate tab**, **Close other tabs**, **Copy address** and **Close**.[^copy]
- Click **+**, named **New tab**, for a new tab on the front page.
- With the strip focused, `←` and `→` move between tabs.

## Open a page in a new tab

Right-click a link, or a door in the sidebar, for **Open** and **Open in new tab**.[^newtab] Only some things carry that menu.[^menu] Clicking a pinned layout opens it in a new tab in front ([pins.md](pins.md)).[^pins]

## Keys

| Keys | What it does |
| --- | --- |
| `Cmd` + `Shift` + `.` | Show the next tab |
| `Cmd` + `Shift` + `,` | Show the previous tab |
| `Cmd` + `Shift` + `O` | Open a new tab on the front page |
| `Cmd` + `Shift` + `X` | Close the tab in front |

`Cmd` is the modifier on a Mac and `Ctrl` elsewhere. The browser keeps its own tab keys.[^browserkeys]

## What a tab keeps

A tab mounts its pages when first shown and keeps them until it closes.[^mount] Back and Forward move within the tab in front.[^history] The set of tabs is stored per browser.[^stored] A phone has no strip.[^phone]

[^workspace]: A workspace is one page, or a whole split of panes, with its own filter, its own pane focus and its own Back and Forward. The header, the sidebar, the agent panel, the palette, the appearance and the fold state of outline branches are shared by every tab. A door in the sidebar changes the tab in front rather than opening another. On a desktop the strip is drawn above the panes.

[^glyphs]: Each glyph says what kind of page the tab holds: the front page, a file, a row, the Trash, a plugin's page over a row's reading, a page a plugin draws itself, or a split of panes. The seven are drawn in the closed block at the foot of this page.

[^close]: The close button's tip is `Close tab` and its name is `Close <title>`. It is drawn on the tab in front, under the pointer, and on any screen with no pointer to reveal it with.

[^names]: A document is named without its suffix, `garden` rather than `garden.olai`, and any other file with it, `q3.pdf`. When two open tabs would say the same word for different files, both show their whole path until one of them closes.

    A split tab joins its panes' names with ` + `. Any other page shows the title its page reported, or the page's own label until it reports one. Every tab in the strip is the same width, so nothing moves while a page arrives.

[^address]: The address is in the tip, which a pointer gets on hover and a keyboard on focus, and at the end of the tab's accessible name. The strip truncates a long title at 14rem, and draws no address of its own. The browser's address bar shows the address of the tab in front and nothing about the rest.

[^dot]: A dot in the alert colour marks a conversation that needs you, and a muted one a turn nobody has read. A tab caught by both wears the question. It is a dot and nothing more: no tab comes forward because of one.

[^closing]: Closing the tab in front brings the one to its right forward, or the one to its left when it was the rightmost. Closing the last tab leaves one tab on the front page.

[^drag]: While you drag, a bar shows where the tab will land.

[^copy]: The **Duplicate tab** entry puts a copy right after the tab and brings it to the front. **Copy address** puts the tab's whole link on the clipboard. Where the browser refuses to write to it, olai shows the address in a prompt headed `Couldn't copy the address. Copy it from here:` for you to copy by hand.

[^newtab]: A new tab opens right after the tab in front and stays behind it. A link to a heading in its own document, and a line of a document's contents, open that document at that heading; **Open** also puts the heading in the address.

[^menu]: Links inside an outline row, its bullet included, carry this menu; the rest of the row keeps its row menu. A link to a fragment of the page you are on gets no menu, and an external link keeps the browser's. `Shift` and a right-click always show the browser's menu, and `Cmd` with a click or a middle-click still open a browser tab, as they do everywhere else.

[^pins]: `Alt` and `Alt` + `Shift` still open a pinned layout's pages beside the ones you have. Without this row a pinned layout opens in place.

[^browserkeys]: The browser keeps `Cmd` + `T`, `Cmd` + `W`, `Cmd` + `1` to `Cmd` + `9`, `Cmd` + `Shift` + `[` and `Cmd` + `Shift` + `]` for its own tabs, so those are left alone. These four work while you are typing, are listed in the keyboard shortcuts sheet under `Added by plugins`, and do nothing below the desktop breakpoint.

[^mount]: The same page elements, subscriptions, composer drafts, open tool details, filters and scroll positions stay with a tab until it closes. Switching tabs hides the old pages and shows the new ones; closing a tab disposes them.

    A hidden page handles no keyboard gestures and draws no menus, but its page report still updates its tab's title, and a hidden conversation can still notify you when it needs an answer. A restored tab you have never looked at keeps its address and title alone, and opens nothing until you click it.

[^history]: Bringing a tab to the front is not a history step, and closing a tab drops its history. Returning to a tab returns to where its page was scrolled.

    History is kept per document: after a reload every tab's history starts empty, and Back at the start of a tab's history stays on that tab. All of this holds only while the strip is drawn. On a phone, or with the layout row off, Back and Forward are the window's own.

[^stored]: The tabs, their order, their addresses and titles, and which is in front are kept under the `olai.tabs` preference. It is written when a tab opens, closes, moves or swaps place with the one in front, not on every change to the page in front. Another window does not pick those changes up live: the last writer wins.

    Opening olai at an address shows it in the tab that was in front, so a link or a reload shows what you asked. A stored tab keeps an address, not a parsed page, so a plugin switched on or off is honoured.

[^phone]: Below the desktop breakpoint the tab in front becomes the window's only page and the others are disposed, though the stored set is kept, so visiting on a phone does not erase the tabs of a desk. **Open in new tab** shows the page at once, since there is no strip to find it in, and Back returns to the page before it. The keys do nothing.

<details>
<summary>Every glyph, and the page it holds</summary>

| Glyph | The page it holds |
| --- | --- |
| `⌂` | the front page |
| `¶` | a file |
| `•` | a row |
| `⌫` | the Trash |
| `◷` | a plugin's page over a row's reading |
| `◇` | a page a plugin draws itself |
| `◫` | a split of panes |

</details>

<details>
<summary>When rows are switched off</summary>

| Row off | What changes |
| --- | --- |
| `tabs` | the strip goes and the page in front stays; Back and Forward walk the window's whole history again. Switching it back on restores the stored set |
| `layout` | no strip is drawn. The set is kept, the keys do nothing, and Back and Forward are the window's |
| `chat` | tabs wear no dot. Both marks are chat's facts |
| `pins` | nothing here changes; pinned layouts are the pins row's |

</details>

<details>
<summary>For plugin authors</summary>

`tabs.state` carries the tabs, the id in front, and `open(workspace, { behind })`, `show`, `step`, `close`, `closeOthers`, `duplicate` and `reorder`. Name it on a component of your own, so your row still works without this one.

`dot({ ids, paint, label, rank })` registers a reading of which tabs wear a mark, how it is painted and what it is called; `dotted()` collapses every registered reading into one mark per tab, the highest `rank` winning. `drawn()` says whether a strip is drawing the tabs on a desktop.

The row needs only `navigation.state`. It names a history lane for the tab in front ([navigation.md](navigation.md)) while the strip reports that it draws, and gives the window its history back when it stops. A tab's name is read from navigation too, so tabs asks no page plugin what to call it.

</details>
