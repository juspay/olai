# Test layout fixture

A test fixture, not a second layout you can choose. It shows that a plugin can draw the whole screen itself.[^how]

`alternate_layout.feature` runs it with the ordinary layout switched off. The ordinary outline editor, unchanged, still writes a renamed row to the file, Markdown still draws inside the same fixture, and moving between an outline and a document never reloads the app.

The plugin is listed as **Test layout**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^how]: How the fixture draws the whole screen: it fills `root`, the one place the renderer keeps for the frame around the app, and declares `navigation.content`. It draws the area the navigation service fills with the current page. It carries two buttons that open `house.olai` and `finishes.md` through the same history service the ordinary layout uses. It imports no layout, outline or Markdown code.
