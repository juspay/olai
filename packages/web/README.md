# @olai/web — browser boot and shared rendering utilities

This package builds the browser assets and starts the selected plugin graph.
It does not own Olai's frame, navigation, editors, directory, preferences, or
plugin inspector. Those implementations, their state, and their child locations
belong to the plugins documented in [the plugin catalogue](../../docs/index.md).
The browser host creates no fallback application when an owner is absent.

`src/client/main.tsx` supplies the mount element and starts browser composition.
`src/client/wire.ts` connects the permanent management surface, learns the
selected rows, and acquires their browser contracts before activating consumers.
`src/host/` is what an activation costs and what a failed one is owed:
the runtime that holds each row's registrations, the loader, the shared module
identities a chunk reuses, and the boot status the recovery overlay reads. A
plugin's client and subscriptions follow its own activation. Removing a provider
revokes its client; unrelated providers retain their clients and component
scopes. The bundle owns the product catalogue; the host does not enumerate
feature members or import plugin implementations or contracts. What the host
reads off the catalogue is only what a row is — the entry hands the rows down
through `useBrowserRows` and the build's own order down with the mount
(`attachRenderer(root, bundleRank)`), and the one other reader takes a row's own
switch hint for the management adapter — so the runtime that mounts them names
no plugin and imports no list.

The runtime is `src/host/` rather than `src/client/plugins/` because
`./client/*` is the door a plugin opens, and five of them were importing the
module that assembles the whole application to read a slot other plugins had
filled. What a plugin reads now is `Faces`, named in its own `needs`; the
ORDER those reads come back in is the one thing this host adds to them, and it
moved with them, onto `BrowserMount.rank` where the renderer's own facade
spends it. Nothing under `src/host/` is reachable from outside this package.

## Startup and recovery

The management connection must work before feature code does: it is how the
browser learns which rows to load and how it explains a failed row. Module
acquisition failures are contained per row so an optional failure cannot prevent
an independent renderer from starting. Bootstrap and renderer failures also have
a host-owned diagnostic, because a diagnostic that needs the failed renderer
cannot explain its absence.

A failed entry import can be retried without replacing successful shared
modules. A cached failed dependency may require a page reload; the recovery UI
says so explicitly after an unsuccessful retry. It never cache-busts shared
Solid or Effect instances independently. Browser reports distinguish a selected
row from one whose browser activation actually succeeded.

## Shared utilities

The remaining `./client/*` exports are reusable rendering, connection, and
interaction utilities: what the wire is doing and how the app says so
(`connection/`, `readout.ts`, `Reload.tsx`), the chord registry
(`keys.ts`), the preference circuit every stored pick rides (`preference.ts`),
the address spellings and served-file paths (`paths.ts`, `ids.ts`), the pointer
and touch behaviours a face composes from (`press.ts`, `longPress.ts`,
`popover.ts`, `overlay.ts`, `layer.ts`), the small shared pieces
(`Pill.tsx`, `Tip.tsx`, `ProgressBadge.tsx`, `Empty.tsx`), and the clock, the
notifier and the settle helpers beside them. They must not reach upward into a
plugin. A utility that needs application behavior accepts that behavior from its
caller — `writes.ts` is the worked example: it turns a write's two answers into
one sentence over a writer HANDED IN, because where a verb's write goes belongs
to the app's own `Edits` table and not to this package. A module that owns a
feature belongs with the feature, which is why no directory here is named after
one. Dedicated static libraries own shared UI
primitives, Markdown rendering, and edit-history presentation.

Test IDs follow the component that renders them. This package exports only its
boot and shared-utility IDs; the bundle assembles the suite's catalogue from the
owners. Static contract and test-only imports are distinct from implementation
imports, and the bundle's boundary checks enforce the production direction.

## Building and checking

`bun packages/web/src/build.ts <dist>` uses the Surface client build helper with
Solid's JSX transform, Tailwind, and bundle assets. The helper owns content-hashed
asset URLs, the uncached entry document, code splitting, and precompressed
siblings. Feature CSS and assets are selected through the bundle, not initialized
by the browser entry point.

Use `just ci` for the integrated checks. Browser acceptance covers independent
content selections, alternate layout and non-notebook fixtures, plugin
withdrawal/restoration, and failed module recovery; see
[the plugin system](../../docs/architecture/plugin-system.md) and [the browser suite](../tests/README.md).
