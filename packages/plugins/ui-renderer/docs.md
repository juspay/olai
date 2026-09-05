# UI renderer

`ui-renderer` is a browser-only row selected by the default web bundle. The
host supplies a mount element through `BrowserMount`; this plugin owns the
Solid root, its disposal and the location registry. It provides
`ui-renderer.slots`. Its static `/contract` export carries the typed root
location and service contract without importing presentation code.

Only `root` is permanent, and it permits one contribution. Register a face
with `contribute(location, face, { children, activate })`. Child declarations
belong to that particular entry, not merely to a plugin or a parent name.
Their names are reserved while waiting, but they become available only when
the owning entry activates successfully.

Put location-dependent subscriptions, listeners and other resources in the
scoped `activate` effect. Cordis starts that integration when its location
arrives, revokes child locations and drains dependent cleanup when it leaves,
and starts a fresh scope when an owner returns. Independent plugin work stays
outside this effect. Unrelated active contributions preserve their identity.
Failures and hanging initialization are contained by the same lifecycle bridge
as ordinary service consumers. Renderer withdrawal closes the entire registry.

Duplicate declarations, ownership cycles and incompatible cardinality fail
with the responsible owners named, including registrations still waiting.
`inspect()` distinguishes active, waiting and failed integrations; reserving a
child name alone never reports a dependent integration active.

The server does not import this plugin's browser module. Its loader fiber
records selection, and its roster says `browserOnly: true`. The plugin panel
shows browser activation separately from host selection. Headless profiles
do not select this row.

The earlier `Slots`/`Faces` API is a typed adapter over this same registry.
`openApp` owns no slot tables. Legacy plugin, kind, list and single-slot key
rules are retained; reservations, activation scopes and diagnostics are shared
with native contributions. The renderer publishes these compatibility services
as `ui-renderer.legacy-slots` and `ui-renderer.faces`. `Slots` and `Faces` imports
remain the supported way to name them.

The host defers compatibility notifications across roster composition and joins
location activations before publishing the result. This prevents a provider
wrapper from disappearing while dependent faces are still drawn. Location
failures and missing owners appear in the inspector. Retry restarts only failed
integrations; successful entries and independent plugin providers survive.

If the socket has not delivered its first roster after the startup deadline,
the browser asks the web-app provider for `/olai/browser-boot`. This uncached
answer names only the host-selected browser-only rows, allowing the shell to
show connecting state. Once the live roster has answered, a delayed bootstrap
response cannot replace it. The browser never infers selection from defaults.

A failed browser module is reported on its own row; independent loaded rows
still mount. The inspector offers **Retry browser activation** without reloading
surviving plugins. If startup cannot render an application, the host displays a
small error view with **Retry browser startup**, including when the renderer
itself cannot load or the bootstrap request fails. Retry uses the latest host
selection and does not infer a default shell.

The browser build embeds entry URLs derived from Bun's output metadata in the
uncached shell. These URLs describe available code, not selected plugins. Retry
uses a fresh query on a failed entry to bypass the browser's cached import
failure; relative dependencies retain their original URLs and shared runtime
identity. Successfully loaded modules, including recovered ones, are retained
across later roster changes.
