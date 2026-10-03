# Palette levels fixture

A maintained acceptance fixture, shipped disabled and selected only explicitly
by tests. It contributes one palette row, **Test levels**, through the public
`paletteAdapters` location, and opens the palette at a path through the declared
`navigation.palette` service — the same two doors any plugin uses. It imports
no outline, chat or search implementation.

The row opens a group with sections, a nested group (**Citrus**), a group whose
rows are a function of the typed text (**Word lookup**), and a value level
(**Write a note**) with three tone options, a validator, and a submit whose
answer is chosen by the note's first word (`keep`, `say`, `fail`, `hold`).

The scenario's hand is `window.olaiTestPalette`: open at a path, withdraw and
restore the fixture's adapter while the row stays on, and read what was
submitted. A held submit waits on a gate the page keeps, so a scenario can
answer it after the fixture has gone and check that nothing changes.

`palette_levels.feature` ([navigation.md](navigation.md#palette-levels)) drives the real palette
with it on desktop and phone. This is not a feature anyone turns on.
