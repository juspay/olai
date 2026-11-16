# Test page fixture

A test fixture, not a feature anyone turns on. It proves that a plugin page needs no document format, no file reading and no outlines code.[^what]

`/fixture/<word>` draws one lower-case word, `alpha`, `beta` or `gamma`. Anything else under `/fixture/` is claimed and refused. The page shows its word and links to the other two with real anchors, so navigation answers a plain click, `Alt` + click and `Alt` + `Shift` + click on them as it does any link. Its breadcrumb, and so its tab title and pane label, is `Fixture <word>`.

The page is narrowable: its own filter box writes what you type into the address as `?q=`, and the page draws the filter it is handed back.[^drives]

The row is **Test page**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^what]: What the fixture registers: one self-drawn route and one palette row, **Go to fixture alpha**, that opens it.

[^drives]: What drives the fixture: `self_drawn_pages.feature`. [navigation](navigation.md) owns the page kind it uses.
