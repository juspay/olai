# Sidebar

`sidebar` is a browser-only row in the default bundle. It contributes the
expanded directory column and collapsed rail to `layout.sidebar`. Disabling it
removes both without replacing the open content pane or its active editor.
An exact `--plugins` list needs `sidebar` to show these navigation controls.

The entry owns `sidebar.entry` and `sidebar.section`. Contributions to these
locations wait while the sidebar or layout is absent and reactivate when their
owner returns. Their plugins' independent work remains mounted.

The column and rail implementations live here. Their notebook readings, file
creation controls, and preferences still consume web implementations during the
remaining content and navigation extraction; this is not yet the final generic
sidebar boundary.
