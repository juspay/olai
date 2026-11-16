# Test palette fixture

A test fixture, not a feature anyone turns on. It proves that the palette's
levels work through the doors any plugin has: it contributes one row, **Test
levels**, through the public `paletteAdapters` location, and opens the palette
at a path through the declared `navigation.palette` service. It imports no
outline, chat or search code.

The row opens a group with sections, and four levels under it:

- a nested group, **Citrus**;
- a group whose rows are a function of the text you type, **Word lookup**;
- a group whose rows arrive a moment late, **Late rows**;
- a value level, **Write a note**, with three tone options and a validator.

The note's submit answers by the note's first word:

| The note starts with | The submit |
| --- | --- |
| `keep` | leaves the palette open |
| `say` | answers with a line |
| `fail` | fails |
| `hold` | waits on a gate the page keeps |

A scenario's hand is `window.olaiTestPalette`: it opens the palette at a path,
withdraws and restores the fixture's adapter while the row stays on, and reads
what was submitted. Because a held submit waits on the page rather than on this
plugin, a scenario can answer one after the fixture has gone and check that
nothing changes. `palette_levels.feature` drives the real palette with it, on
desktop and on a phone.

The row is **Test palette**, under **Test fixtures** in the **Plugins** panel.
It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes
on only for the `test-minimal` profile and the scenarios that name it.
