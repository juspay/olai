# Test layout fixture

A test fixture, not a second shell to choose. It proves that a plugin can own the whole screen.[^how]

`alternate_layout.feature` runs it with the ordinary layout switched off: the unchanged outline editor still writes a renamed row to the file, Markdown still draws under the same fixture, and moving between the two never reloads the app.

The row is **Test layout**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^how]: How the fixture owns the screen: it takes `root`, declares `navigation.content`, draws the navigation service's page outlet, and carries two buttons that open `house.olai` and `finishes.md` through the same history service the ordinary layout uses. It imports no layout, outline or Markdown code.
