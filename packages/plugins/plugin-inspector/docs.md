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

The host adapter provides roster readings, reports, switching and retry
without handing over a notebook client or importing this plugin. Cell
subscriptions are acquired under the consuming component's Solid owner. The
inspector reads build-supplied switch hints through that capability rather than
importing the bundle that loads it.

Source approval belongs to `vault-plugins`. The inspector calls its optional,
scoped browser client with the source version the reader acknowledged. If that
browser provider is absent, approval reports a refusal and releases the pending
control; the inspector remains usable. A returning provider supplies a fresh
client for the next request. No host approval binding or hard dependency keeps
the definition provider alive.
