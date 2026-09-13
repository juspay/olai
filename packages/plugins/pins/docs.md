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

Pins have a page or layout target. The palette offers the focused page command and, in a split, a layout command that always asks for a name. A saved layout compares only ordered pages, ignoring width and focus; renaming it refuses an empty name. Layout shelf links have a split mark and replace the workspace through `navigation.state.open`, with Back restoring the previous workspace. Page links retain pane navigation.

Navigation supplies `routes.layoutIn` and `routes.layoutHref`; pins never parses the workspace prefix. Pane labels use navigation's lifetime-bound `info(index)` reports when available. The pin status line remains owned by the pins activation for shelf removal and reorder refusals. Pinning is available through the palette and row menu.
