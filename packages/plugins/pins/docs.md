# Pins

Pins owns the saved shelf, its live reading and its navigation commands. It
contributes the shelf to the sidebar and contextual actions to the navigation
palette. Pin writes use the domain write gate and the focused page's history,
so keyboard Undo also reverses shelf reorders and removals. When the page has
no history, pins retains its activation-owned fallback. Each write captures its
history before sending the request.
Disabling pins withdraws its browser integrations and releases its subscription;
persisted pins remain in the vault.
