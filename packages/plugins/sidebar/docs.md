# Sidebar

`sidebar` is a browser-only row in the default bundle. It contributes the
expanded directory column and collapsed rail to `layout.sidebar`. Disabling it
removes both without replacing the open content pane or its active editor.
An exact `--plugins` list needs `sidebar` to show these navigation controls.

The entry owns `sidebar.entry` and `sidebar.section`. Contributions to these
locations wait while the sidebar or layout is absent and reactivate when their
owner returns. Their plugins' independent work remains mounted.

The column and rail implementations live here, and nothing else does: what this
package reaches for outside itself is a layer token and the slot runtime, both
`@olai/web`'s. The readings, the file creation controls and the preference rows
drawn inside the column belong to the plugins that contribute them.

The container declares `sidebar.regions`, `sidebar.rail` and `sidebar.vault`.
Files, pins, capture and trash occupy these locations independently. Sidebar
itself creates no notebook reading and imports no file tree or content editor.
