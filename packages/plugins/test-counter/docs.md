# Test counter fixture

A test fixture, not a feature. It shows that olai runs a plugin that uses no directory of files at all.[^halves]

Neither half of it imports the vault, a directory, an outline, Markdown, navigation or the application layout. The same two calls answer a browser and a headless agent alike. The count starts at zero every time the server half starts, and taking the browser half away cancels the requests it had in flight.

The plugin is listed as **Test counter**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^halves]: The fixture's two halves: the server half keeps one number in memory behind two calls, `counter.read` and `counter.increment`; the browser half draws that number and an **Increment counter** button, in a frame of its own.
