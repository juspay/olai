# Test counter fixture

A test fixture, not a feature. It proves that olai's host runs a plugin with no directory at all.[^halves]

Neither half imports a vault, a directory, an outline, Markdown, navigation or the application layout. The same two procedures answer a browser and a headless agent. The count starts at zero whenever the server activates, and taking the browser half away cancels the requests it had in flight.

The row is **Test counter**, under **Test fixtures** in the **Plugins** panel. It is off by default (`disabled: true` in `packages/bundle/olai.yml`) and comes on only for the `test-minimal` profile and the scenarios that name it.

[^halves]: The fixture's two halves: its server keeps one number in memory behind two procedures, `counter.read` and `counter.increment`; its browser half draws that number and an **Increment counter** button in a shell of its own.
