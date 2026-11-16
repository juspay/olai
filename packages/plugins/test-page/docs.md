# Test page fixture

A test fixture, not a feature anyone turns on. It shows that a plugin can draw its own page with no file format and no outline code.[^what]

`/fixture/<word>` draws one lower-case word: `alpha`, `beta` or `gamma`. olai claims every other address under `/fixture/` and refuses it.

The page shows its word and links to the other two with ordinary links, so a plain click, `Alt` + click and `Alt` + `Shift` + click all open them the way they open any link in olai. The page's breadcrumb, and with it the tab title and the pane's label, is `Fixture <word>`.

The page can be narrowed: its filter box writes what you type into the page's address as `?q=`, and the page draws the filter it is handed back.[^drives]

The plugin is listed as **Test page**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^what]: What the fixture registers: one page it draws itself, and one palette command, **Go to fixture alpha**, that opens it. It reads no files at all.

[^drives]: The scenario that drives the fixture is `self_drawn_pages.feature`. [navigation](navigation.md) owns the kind of page it uses.
