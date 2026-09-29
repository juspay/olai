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

Moving a row to Trash asks first: `Move “x” to Trash? You can put it back from
Trash in the sidebar.` Each row on the Trash page has `Put back`. Emptying asks
`Permanently delete all N rows in Trash? olai can't bring them back. Only what
git has already saved can be recovered.` (or `the one row` / `it` for one). An
empty Trash page says `Trash is empty` and `Deleted outlines and rows appear
here.`

The Trash page declares vault file access and names the configured outline row
when its claim is absent. Trash files match the convention stem directly under
`_olai/`; multiple matches produce an ambiguous-convention finding.
