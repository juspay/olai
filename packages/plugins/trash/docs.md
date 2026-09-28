# Trash

Trash owns its navigation entry, archive presentation and restore interactions.
The entry is a `sidebar.entry` placed `foot`: one quiet `Trash` row pinned under
the sidebar's scrolling list (above the drawer's foot on a phone), with a trash
icon at the bottom of the collapsed rail. It is registered and withdrawn by the
trash row's own `sidebar` component, so it no longer depends on the files row
being mounted.
Its server provider remains independent of browser presentation. Removing the
browser integration hides the entry without deleting archives or reversing
accepted restore operations.

The Trash page declares vault file access and names the configured outline row
when its claim is absent. Trash files match the convention stem directly under
`_olai/`; multiple matches produce an ambiguous-convention finding.
