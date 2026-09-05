# Plugin inspector

The plugin inspector provides the switches and reports in the plugins panel.
It is a browser-only bundle row. Disabling it removes its header and drawer
controls; the host keeps managing plugins and its non-UI operations remain
available.

Its provider owns panel visibility and the source versions the reader has
acknowledged. A separate integration consumes `browser-management` and
`ui-renderer.slots`, contributing through `layout.tools`. Removing the shell
withdraws the rendered integration without resetting the provider's reading
history. Removing the inspector closes its state; re-enabling creates a fresh
activation.

The host adapter provides roster readings, reports, switching, retry and source
approval without handing over a notebook client or importing this plugin. Cell
subscriptions are acquired under the consuming component's Solid owner. The
inspector reads build-supplied switch hints through that capability rather than
importing the bundle that loads it.

Phase 18 is not complete: source-approval policy still belongs to the existing
server runtime pending `vault-plugins`, and shared controls still come from web.
The inspector's extraction does not establish the final generic host boundary.
