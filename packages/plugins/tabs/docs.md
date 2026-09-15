# Tabs

`tabs` is a browser-only row that keeps several pages open in the main column.
On a desktop it draws a strip of tabs above the panes. Each tab holds a
**workspace**: one page, or a whole split of panes. The header, the sidebar, the
chat panel, the palette and the appearance stay shared, and so does the fold
state of outline branches. A door in the sidebar changes the tab in front. The
in-page filter and pane focus are part of the workspace, so each tab keeps its
own.

## The strip

The tab in front is drawn on paper, and the others are muted. Each tab shows a
glyph for the kind of page it holds, its title, and a close button that appears
on hover and on the tab in front. A tab in the background has no page mounted,
so its title is the one it had when it was last in front: the page's own title
where the page reported one, otherwise the page's label. A split tab's title is
its panes' labels joined with " + ". A tab brought back to the front keeps that
title until its page reports a real name, and every tab in the strip is the same
width, so nothing moves while a page arrives. The address of the tab in front is shown at
the right of the strip; the browser's address bar shows the same address and
nothing about the other tabs.

- Press a tab to bring it to the front.
- Middle-click a tab, or press its ×, to close it. Closing the tab in front
  brings the tab to its right forward, or the one to its left when it was the
  rightmost. Closing the last tab leaves one tab on the front page.
- Drag a tab to reorder the strip; a bar shows where it will land.
- Right-click a tab for **Duplicate tab** (a copy right after it, brought to the
  front), **Close other tabs** and **Close**.
- Press **+** for a new tab on the front page.

## Opening a page in a new tab

Right-click any link this app can open — a door in the sidebar, a link in a
document — for **Open** and **Open in new tab**. A new tab opens right after the
tab in front and stays behind it. Links inside an outline row are left to the
row, which owns its own menu, and external links keep the browser's menu.
Shift+right-click always shows the browser's menu. ⌘-click and middle-click on a
link still open a browser tab, as they do everywhere else.

With the `pins` row, pressing a pinned layout on the shelf opens it in a new tab
in front. Without the tabs row it opens in place.

## Keys

| Keys | What it does |
| --- | --- |
| ⌘⇧. / Ctrl+⇧. | Show the next tab |
| ⌘⇧, / Ctrl+⇧, | Show the previous tab |
| ⌘⇧O / Ctrl+⇧O | Open a new tab on the front page |
| ⌘⇧X / Ctrl+⇧X | Close the tab in front |

The browser keeps ⌘T, ⌘W, ⌘1 to ⌘9 and ⌘⇧[ ⌘⇧] for its own tabs, so they are
not used here. The chords work while typing, and are listed in the shortcuts
sheet under "Added by plugins". They do nothing below the desktop breakpoint.
With the strip focused, ← and → move between tabs.

## Back and Forward

Back and Forward move within the tab in front. Bringing a tab to the front is
not a history step, and closing a tab drops its history. Returning to a tab
returns to where its page was scrolled. History is kept per document: after a
reload every tab's history starts empty, and Back at the start of a tab's
history stays on that tab. All of this holds only while the strip is drawn: on a
phone, or with the layout row off, Back and Forward are the window's own.

## What is kept

The set of tabs, their order, their addresses and titles, and which tab is in
front are kept per browser under the `olai.tabs` preference. The tab in front is
kept as its id alone, since opening olai always shows the address being opened
in it, so the set is written when a tab opens, closes, moves, or changes places
with the one in front, and not on every change to the page in front. Opening olai at an address shows that address in the tab that was
in front, so a link you open or a reload always shows what you asked for.
Another browser window does not pick up changes live: the window that writes
last wins.

A stored tab keeps its address, not a parsed page, so a plugin that was switched
on or off since the tab was opened is honoured when the tab comes back.

## Phones

Below the desktop breakpoint there is no strip, and the existing pane strip is
unchanged. The set is still kept and still written, so visiting on a phone does
not erase the tabs of a desk. Open in new tab shows the page at once, since
there is no strip to find it in, and Back returns to the page before it, in the
window's own history. The chords do nothing.

## When rows are switched off

- **tabs** off: the strip goes, the page in front stays, and Back and Forward
  walk the window's whole history again. Switching it back on restores the
  stored set.
- **chat** off: tabs have no needs-you dot.
- **pins** off: nothing changes here; pinned layouts are the pins row's.
- **layout** off: no strip is drawn. The set is kept, the chords do nothing, and
  Back and Forward walk the window's history.

## For plugin authors

The row offers `tabs.state` (`olai-plugin-tabs`'s `tabsState`, typed by
`olai-plugin-tabs/contract`): the tabs, the id in front, and `open(workspace,
{ behind })`, `show`, `step`, `close`, `closeOthers`, `duplicate` and
`reorder`. `drawn` says whether a strip is drawing the tabs on a desktop; the
strip registers that with `draw(desktop)`. `dot({ ids, paint })` registers a
reading of which tabs wear a dot, which the `attention` component uses. Name
`tabs.state` on a component of your own, so your row still works without tabs.

The row itself needs only `navigation.state`. It names a history lane for the
tab in front (see [navigation](navigation.md)) while the strip reports that it
draws on a desktop, and gives the window its history back when it stops drawing
and when the row is released. Without a lane, a tab brought forward is an
ordinary navigation (`Router.open`). The strip is the `strip` component, contributed to
layout's `layout.strip` seat and waiting for `layout.shell`; the link menu is
the `links` component, contributed to `layout.overlays`; the needs-you dot is
the `attention` component, waiting for `chat.state`.
