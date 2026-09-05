# Layout

`layout` is a browser-only row selected by the default web bundle. It consumes
`ui-renderer.slots` and contributes the application at `root`. Without the
renderer it waits; disabling layout removes that contribution and disposes
its Solid subtree. Its selection has no server capability dependencies.

An exact `--plugins` list must include both `ui-renderer` and `layout` to draw
the current application; include `sidebar` for its directory column and rail. Headless profiles select neither. If either is
disabled through the panel, use the authorized non-UI plugin-management
interface or restart with the desired selection to restore the UI.

The frame and header implementations live in this plugin; `web/App.tsx` and
`web/AppHeader.tsx` are removed. The frame still composes navigation, outline
and document providers through implementation imports from web. Those providers
and the remaining shell components must move to independent capabilities and
owned locations before this is the completed replaceable shell boundary.

The root entry's integration owns visual-viewport and breakpoint listeners,
layout preference subscriptions, and the Solid effect publishing panel/sidebar
CSS widths. Removing the entry detaches those listeners and restores the prior
inline CSS declarations. A fresh activation re-reads preferences from storage,
including changes made by another tab while layout was absent. These observers
are no longer started by the permanent browser entry point.

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
