# Layout

`layout` is a browser-only row selected by the default web bundle. It consumes
`ui-renderer.slots` and contributes the application at `root`. Without the
renderer it waits; disabling layout removes that contribution and disposes
its Solid subtree. Its selection has no server capability dependencies.

Both `ui-renderer` and `layout` must be enabled to draw
the current application; include `sidebar` for its directory column and rail. Headless profiles select neither. If either is
disabled through the panel, use the authorized non-UI plugin-management
interface or restart with the desired selection to restore the UI.

The frame and header implementations live in this plugin; `web/App.tsx` and
`web/AppHeader.tsx` are removed. The two providers the frame composes are
navigation's — `RouterProvider` in `Frame.tsx` and `PaneProvider` in
`pane/Panes.tsx`, both imported from `olai-plugin-navigation` — and it composes
no outline or document provider of its own. What it takes from `@olai/web` is
leaf rendering and connection utilities, never a feature implementation.

The root entry's integration owns visual-viewport and breakpoint listeners,
layout preference subscriptions, and the Solid effect publishing panel/sidebar
CSS widths. Removing the entry detaches those listeners and restores the prior
inline CSS declarations. A fresh activation re-reads preferences from storage,
including changes made by another tab while layout was absent. These observers
are no longer started by the permanent browser entry point.

Those readings are what `layout.shell` carries: the breakpoint, whether each
panel is open and how wide, which snap the mobile sheet is on, and the panel's
own drag handle. Consumers use the parts they need — outlines and documents
read the breakpoint, git chooses between its health-popover row and a banner, the sidebar and
file rail open the column, and the palette's `Reset sidebar width` puts the
widths back to their defaults — and each declares the key on a
COMPONENT of its own rather than on its row, because content runs under another
layout entirely (`olai-plugin-test-layout`). With no shell mounted those
readings answer what they always answered — a phone-width viewport, a shut
panel, an open sidebar — and the presses do nothing.

`layout.deployment` carries what this deployment calls itself and when it
started, which is one answer to one `app.get` asked and re-asked by the
`deployment` component. Chat's notification title names it.

Viewport width is a reactive input to column fitting. Resizing an open desktop
layout recomputes both columns while preserving stored preferred widths, so the
main content keeps its minimum available space when the window narrows.

The root declares `layout.sidebar`. The frame reads that seat through the
renderer contract and imports no sidebar implementation. The sidebar row owns
its two extension locations; chat's panel entry owns delivery marks and engine
installation entries. Remaining outline and navigation compatibility locations
still belong to the frame until those providers are extracted.

`layout.tools` accepts controls with explicit desktop and mobile ordering. The
preferences row contributes there, so the frame and header no longer import its
implementation. Tools may opt into the mobile header when there is no sidebar.

Both preferences and the inspector now contribute through `layout.tools`;
layout imports neither implementation. Entries supply their header/drawer order
and decide whether to appear on mobile pages without a sidebar. An entry's
`desktop` asks for a seat in the same words the entry's body is drawn with
(`ToolWhere`): the bar (`header`, the default — preferences, the gear alone)
or the foot of the health popover (`health` — the inspector's plugins door).
A `health` door stands beside the dot, not inside the popover: only its row is
portalled into the popover's foot while the popover is drawn
(`contracts/BarDoor.tsx`'s `HealthSeat`). Picking that row shuts the popover
and opens the door's panel, anchored to the dot, so the panel never needs the
popover; Escape shuts the panel and hands the caret back to the dot. A door
whose open state outlives the shell (the plugins panel's, held in the
inspector's activation) is drawn again by that standing door when the shell
under it is rebuilt.

A phone draws the Preferences and Plugins doors as rows at the foot of the
sidebar drawer. On a phone page with no drawer (the error page, the waiting
page) the Preferences gear stays in the bar.

## The health dot

The desktop header is the wordmark, the `lead` seat (search), one health dot,
the `header` tools (the Preferences gear) and the `app.viewer` seat (the
signed-in face). Layout owns the location and the drawing of the dot
(`Health.tsx`); every readout still belongs to the plugin that registers it:

- The connection's row is layout's own: `Connected`, `Connecting…`,
  `Reconnecting…`, `Partly connected` or `The server restarted`.
- `app.header` `cluster` seats are drawn as rows of the dot's popover beside
  the connection's row — git's Commit row, kolu, odu, mail, spaces — WORST
  FIRST: `alarm` rows, then `notice`, then `healthy`, then `quiet` (a seat with
  no `status` stands with the quiet), and within one tone the connection first,
  then mount order (`health.ts`'s `worstFirst`). The order is live — a row
  whose tone changes moves, in the DOM, so a Tab walks the rows in the order
  they are seen. Layout orders from each registration's own `status`; no
  plugin chooses its place and Layout names none. The uptime line is last,
  quiet, and casts no vote: `Running for 2h`, with `Running since <instant>` on
  its tip. The `health` tools are the popover's foot (the `Plugins` row).
- A seat may declare `status: () => BarStatus` — `tone` (`healthy`, `quiet`,
  `notice`, `alarm`), `label` (the row's own words) and `detail`. It is a
  reactive accessor over state the contributor's activation owns (git reads
  its two cells in a root its activation disposes after the registration is
  withdrawn; kolu, odu, mail and spaces read the root they already had). The
  types are a static contract (`olai-plugin-layout/slots`); no live value
  crosses by import.
- Severity is stated ONCE. Each readout's state table carries one `tone`, and
  its row and its `status` read the same value. The row paints its dot from
  `TONE` (`@olai/web/client/readout.ts`, re-exported from
  `olai-plugin-layout/slots`) — the one table from tone to dot and text
  colour, which the health dot paints from too; `quiet` paints no dot but
  keeps its box so the words stay aligned. A row's dot carries its tone as
  `data-health`. So a dot that is not green always has a row of exactly its
  colour in the popover.
- The dot wears the worst tone among the connection and every standing
  status (`health.ts`; `quiet` never colours it): green, amber or red. The
  connection is `notice` while it reconnects or is partly connected, `alarm`
  once the server has been replaced, and `quiet` while it first connects. Its
  accessible name is `Status: all good`, or `Status: ` and each piece of news
  joined by ` · `, alarms first, in the readout's own label; the tip adds each
  readout's sentence. `data-health` and `data-connection` carry
  the state for tests.
- Withdrawal is the registration's: a plugin switched off takes its row and
  its vote in the same step, an open popover redraws without it, and a plugin
  switched back on registers afresh.
- The popover is `createPopover` (anchor, dismissal, one tab cycle, focus
  back to the dot on Escape). A row's own panel (the Commit panel, kolu's
  feed) opens above it and is the topmost layer.

A phone has no dot: search and who is looking stay in the bar, and the
connection and git news appear as banners under it only when there is news.

## When the page breaks

The shell is drawn inside a fault boundary. A thrown render shows
`Something went wrong on this page` and `Your files are safe. Reload to try
again.`, with `Reload` and `Go home`. The technical text sits inside a closed
`Details` disclosure, verbatim, for a bug report (`Fault.tsx`).

Pane geometry, resizing and responsive preferences live in the layout package.
The frame consumes navigation state and renders registered overlays and content
status presentations. It creates no outline history, drag registry, document
state or directory subscription. Alternate layouts can use navigation's public
page outlet with the same content registrations.

Deployment name and uptime readings are fresh for each layout activation.
Withdrawal cancels publication from an outstanding name request; a returning
layout asks again instead of inheriting the previous activation's signals.

`layout.strip` is the seat above the panes in the main column, and it is single
occupancy: one row may fill it (the `tabs` row does). The frame draws it only on
a desktop, inside an element with `data-testid="main-strip"`, and it sticks
directly below the app header while a lone page scrolls. Main-column sticky
headings, tooltip floors and heading jumps clear both bands; the static
`--height-chrome` token sums the header and the currently occupied strip.
Each split pane scrollport overrides that token to `0px`: its sticky section
and node headings pin to the pane top without knowing the workspace shape.
Menus portal to the document overlay socket and retain the root viewport
reserve. The layout wrapper owns the opaque strip ground. While the seat is
filled on a desktop the root entry publishes `--height-strip` on `:root` as
`var(--height-tabs)` (2.625rem, from the appearance tokens), and `0px`
otherwise; the pane sheet subtracts it (`PANES_SPLIT`, `PANES_LONE` in
`./sheet`), so a split still fills the viewport under the bar. The shell's grid
keeps the header-only heights, because the sidebar column beside the main one
is not under the strip. Removing the entry restores the prior inline value, as
it does for the widths.

A pane's header shows the page's name: navigation's `Routing.name(route)` (a
document's stem, such as `garden`), or `Routing.label(route)` where the page
has no such name (`Home`, `Trash`, a node's id, a path). Both are read through
the routing this row holds from `navigation.state` (`src/routing.ts`). The
pane's close button is named `Close <name>`, and a collapsed pane's rail is
named `Expand <name>`.

## Retained pages and sidebar

The frame renders one host per live navigation lane and one subtree per stable
pane object. A tab switch changes visibility. Splitting, reordering, closing a
neighbour, collapsing to a rail and crossing the desktop breakpoint preserve
the surviving page elements. A lone lane scrolls the window; split columns
scroll independently. Navigation owns window scroll restoration.

After its first ready state the content-status gate keeps those hosts mounted
through a temporary reading state. Collapsing the desktop sidebar hides its
body, preserving the calendar month and its subscriptions. The phone footer
resolves its contributed JSX once per owner, so there is one closet controls
tree. Layout geometry belongs to the layout activation and leaves with it.
