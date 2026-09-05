# Layout

`layout` is a browser-only row selected by the default web bundle. It consumes
`ui-renderer.slots` and contributes the application at `root`. Without the
renderer it waits; disabling layout removes that contribution and disposes
its Solid subtree. Its selection has no server capability dependencies.

An exact `--plugins` list must include both `ui-renderer` and `layout` to draw
the current application. Headless profiles select neither. If either is
disabled through the panel, use the authorized non-UI plugin-management
interface or restart with the desired selection to restore the UI.

This row currently mounts the existing application composition. Navigation,
outline and document state, and the remaining feature observers have **not**
yet been extracted into their Phase 18 owners. It is an intermediate state,
not the completed replaceable shell boundary.

The root entry's integration owns visual-viewport and breakpoint listeners,
layout preference subscriptions, and the Solid effect publishing panel/sidebar
CSS widths. Removing the entry detaches those listeners and restores the prior
inline CSS declarations. A fresh activation re-reads preferences from storage,
including changes made by another tab while layout was absent. These observers
are no longer started by the permanent browser entry point.
