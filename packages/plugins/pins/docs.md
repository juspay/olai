# Pins

Pins owns the saved shelf, its live reading and its navigation commands. It
contributes the shelf to the sidebar and contextual actions to the navigation
palette. Pin writes use the domain write gate and the focused page's history,
so keyboard Undo also reverses shelf reorders and removals. When the page has
no history, pins retains its activation-owned fallback. Each write captures its
history before sending the request.
`pins.state` carries the shelf as the server last answered it — an accessor,
because the answer is a fresh array each time the shelf changes. The outline
names it on a component of its own to draw the pin glyph on a row, so an outline
with no pins row mounted is a whole outline with no glyph.

Disabling pins withdraws its browser integrations and releases its subscription;
persisted pins remain in the vault.

Pins uses the convention stem directly under `_olai/`, among node-holding
claims. Its sidebar component declares vault file access to name the configured
outline row when it is off. The Pins file remains an ordinary address and
reports its unclaimed suffix; there is no separate Pins route.

Pins have a page or layout target. The palette offers the focused page command and, in a split, a layout command that always asks `Name this layout`. Pinning a page asks `Name this pin, or leave it blank`, and renaming one asks `Rename this pin, or leave it blank`. A saved layout compares only ordered pages, ignoring width and focus; renaming it refuses an empty name with `A layout needs a name`. On the shelf, each pin's hover controls are `Rename` and `Unpin` (accessible names `Rename <name>` and `Unpin <name>`). Layout shelf links have a split mark and request a new front tab through navigation’s shared intent path, falling back to replacing the workspace when tabs is absent. Page links retain pane navigation.

Navigation supplies `WorkspaceRouting` on `routes`, including `layoutIn` and `layoutHref`; pins never parses the workspace prefix. The shared title resolver tries workspaces first, without changing page routing. Layout titles on the ordinary Pins outline use the same split-marked face; named links open the workspace in place and bare titles remain editable. Browser new-tab clicks are preserved. Pane labels use navigation's lifetime-bound `info(index)` reports when available. The pin status line remains owned by the pins activation for shelf removal and reorder refusals. Pinning is available through the palette and row menu.

Shelf and outline layout faces render ordinary anchors. Navigation reads their layout href and applies the same click/Alt/Alt+Shift intent as every link; tabs supplies Open in new tab through its shared link menu. Pins no longer acquires a tabs service or owns a layout-click policy. The activation-owned status line lives in `status.ts`; pin mutations live beside the held edit capability in `writes.ts` and receive an address rather than deciding route spelling. On the first published vault snapshot, a scoped pins migration freezes legacy titles, records its work through `LocalState`, and rewrites old node pins and layout segments to `/zoom/#id` through the vault edit gate. Optimistic title checks preserve concurrent edits. A persisted completion marker means later `/#id` titles reveal rows like every other link.
