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
read the breakpoint, git chooses between a pill and a banner, the sidebar and
file rail open the column, and the palette resets both widths — and each declares the key on a
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
and decide whether to appear on mobile pages without a sidebar.

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

A pane's label is navigation's `Routing.label(route)`, read through the routing
this row holds from `navigation.state` (`src/routing.ts`).
