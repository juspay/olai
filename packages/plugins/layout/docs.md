# Layout

`layout` draws the frame: the header across the top, the sidebar's column on
the left, the pages in the middle, the panel on the right, and the bar of
thumbs along the foot of a phone. It owns the geometry and reserves the seats;
what sits in each seat belongs to another plugin.

## The header

| On a desktop, left to right | Owner |
| --- | --- |
| the wordmark, which says `olai` and this deployment's own name once the server has given it | layout |
| the `lead` seat, which holds the search box | [search.md](search.md) |
| the health dot | layout |
| the `header` tools, which is the Preferences gear | [preferences.md](preferences.md) |
| who is looking | [identity.md](identity.md) |

A phone keeps the search box and who is looking, and puts a burger before the
wordmark, named **Show sidebar** or **Hide sidebar**. It draws no health dot:
the connection and git's news appear as banners under the bar, and only when
there is news.

## The health dot

One dot, always drawn, whose colour is the worst tone among the connection and
every readout a plugin has registered: green, amber or red. Its name is
`Status: all good`, or `Status: ` and each piece of news joined by ` · `, in
each readout's own words, alarms first. Clicking it opens a popover of rows.

| The connection says | Meaning |
| --- | --- |
| `Connected` | the page is reading |
| `Connecting…` | the first connection is still being made |
| `Reconnecting…` | the wire dropped and is being retried |
| `Partly connected` | the wire is up and some plugin rows' subscriptions have stopped. The row names them |
| `The server restarted` | `Reload the page to keep working.` |

A plugin's readout is a row of the same popover: git's Commit row,
[kolu.md](kolu.md), [odu.md](odu.md), [mail.md](mail.md),
[xyne-spaces.md](xyne-spaces.md). Rows stand worst first (alarms, then
notices, then healthy, then quiet), with the connection first within a tone and
mount order after it. The order is live, so a row whose tone changes moves, and
a `Tab` walks the rows in the order you see them.

The last line is quiet and casts no vote: `Running for 2h`, with `Running since
<instant>` on its tip and in its spoken name. Under it is the popover's foot,
where the **Plugins** door stands ([plugin-inspector.md](plugin-inspector.md)).
Choosing it shuts the popover and opens the panel anchored to the dot;
`Escape` shuts the panel and hands the caret back to the dot.

A plugin switched off takes its row and its vote away in the same step, and an
open popover redraws without it. So a dot that is not green always has a row of
exactly its colour under it.

## The columns

The body is a grid of up to three columns under the header. The sidebar's is on
the left, the main column holds the strip seat and the panes, and the panel's,
labelled **Panel**, is on the right.

| Handle | Puts back |
| --- | --- |
| **Resize sidebar** | the sidebar's width |
| **Resize agent panel** | the panel's width |
| **Resize panes** | the boundary between two split panes |

Both stored widths are fitted to the viewport as you resize the window, so the
page keeps its minimum space. `Reset sidebar width` in the palette puts the
sidebar back to its default, for a keyboard that cannot drag a handle.

The panel column is drawn while a plugin is in the seat, you have it open, and
the viewport is a desktop. It is sticky under the header and exactly one
viewport tall, so a conversation scrolls inside it while the page scrolls under
it. On a phone, or with the seat empty, there is no third column whatever the
stored width says.

The strip seat sits above the panes, sticks directly below the header while a
lone page scrolls, and is drawn on a desktop only. The tab strip fills it
([tabs.md](tabs.md)).

A pane's header shows the page's name — a document's stem, such as `garden`, or
the page's label where it has no such name. Its close button is named `Close
garden` and a collapsed pane's rail is named `Expand garden`.

## The thumb bar

On a phone, while any plugin has contributed a thumb, a bar named **Quick
access** is pinned to the foot of the viewport. A thumb is an icon over a word,
a finger's height, lit in the accent while it is the page you are on, with room
for one badge at the icon's shoulder.

| Thumb | Contributed by |
| --- | --- |
| Today, Agenda | [journal.md](journal.md) |
| Chats | [chat.md](chat.md) |
| Capture | [capture.md](capture.md) |

Every page leaves room under its last row and its pinned composer for the bar,
so nothing sits under it. A desktop draws no bar whatever was contributed: the
sidebar and the palette are those doors there.

## When a page breaks

The frame is drawn inside a fault boundary. A page that throws while rendering
shows **Something went wrong on this page**, with `Your files are safe. Reload
to try again.`, a **Reload** button and a **Go home** link. The technical text
sits verbatim inside a closed **Details** disclosure, for a bug report.

## What other plugins contribute

| Location | Takes |
| --- | --- |
| `layout.sidebar` | one occupant: the column and its rail ([sidebar.md](sidebar.md)) |
| `layout.strip` | one occupant: the strip above the panes, on a desktop |
| `app.panel` | one occupant: the panel column's contents |
| `layout.tools` | a control, with its own desktop and mobile order. Its `desktop` seat is `header` (the bar) or `health` (the popover's foot) |
| `layout.thumbs` | a thumb: `{ order, body }`, drawn left to right by `order` |
| `layout.overlays` | something drawn over the page, such as the palette |
| `layout.content-status` | a page-level message, and whether its content is ready |
| `app.header` | a seat in the bar (`place: "lead"`) or a readout row of the health popover (`place: "cluster"`), which may declare a `status` of `tone`, `label` and `detail` |
| `app.banner` | a banner under the header |
| `app.viewer` | one occupant: who is looking |
| `app.mount` | a provider wrapped around the frame |

A tool may ask for the mobile header where a page has no sidebar. On a phone
with a drawer, the Preferences and Plugins doors are rows at the foot of the
drawer instead; on a phone page with no drawer, such as the error page, the
gear stays in the bar.

`layout.shell` carries what the frame knows: the breakpoint, whether each panel
is open and how wide, which snap the mobile sheet is on, and the panel's drag
handle. Name it on a component of your own. With no shell mounted its readings
answer a phone-width viewport, a shut panel and an open sidebar, and its
presses do nothing. `layout.deployment` carries this deployment's name and when
it started.

## When it is switched off

Both `ui-renderer` and `layout` have to be on for a page to be drawn at all
([ui-renderer.md](ui-renderer.md)). Switching `layout` off removes the frame
and disposes its subtree, and leaves its seats' occupants waiting. Restore it
from `Settings.olai` or by restarting with the selection you want, since the
**Plugins** panel is itself drawn in this frame ([settings.md](settings.md)).

A fresh activation re-reads the stored widths and preferences, changes another
tab made meanwhile included, and asks the server again for the deployment's
name rather than inheriting the last answer.

## What a tab keeps across a switch

The frame draws one host per live page and one subtree per pane, so switching
tabs changes visibility rather than remounting. Splitting, reordering, closing
a neighbour, collapsing a pane to a rail and crossing the desktop breakpoint
all leave the surviving pages standing.

A lone page scrolls the window and split columns scroll independently. A column
hidden behind another tab restores what you were reading rather than a pixel
offset: the frame remembers the element at the top of the column and puts it
back, absorbing a pinned head that changed size meanwhile. Collapsing the
desktop sidebar hides its body and keeps the calendar's month and its
subscriptions alive.
