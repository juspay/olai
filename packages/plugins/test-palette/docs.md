# Test palette fixture

A test fixture, not a feature anyone turns on. It shows that the steps of the command palette work through the extension locations and services any plugin can use.[^doors]

The fixture adds one palette command that opens a group with sections, and four further steps under it. A step is one list the palette shows you before it opens the next one.

- a group inside the group, **Citrus**;
- a group whose entries are worked out from the text you type, **Word lookup**;
- a group whose entries arrive a moment late, **Late rows**;
- a step that asks you to type a value, **Write a note**, with three tone options and a check on what you type.

What submitting the note does depends on its first word:

| The note starts with | What submitting it does |
| --- | --- |
| `keep` | leaves the palette open |
| `say` | answers with a line of text |
| `fail` | fails |
| `hold` | waits until the test page releases it |

A test scenario drives the fixture through `window.olaiTestPalette`.[^hand]

The plugin is listed as **Test palette**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^doors]: How the fixture reaches the palette: it contributes one command, **Test levels**, at the public `paletteAdapters` location, and opens the palette at a given step through the `navigation.palette` service it declares. It imports no outline, chat or search code.

[^hand]: What `window.olaiTestPalette` gives a test: it opens the palette at a given step, removes and restores the fixture's palette entries while the plugin stays on, and reads what was submitted. A submit that is waiting waits on the test page rather than on this plugin, so a scenario can release one after the fixture has gone and check that nothing changes. `palette_levels.feature` drives the real palette with it, on a desktop and on a phone.
