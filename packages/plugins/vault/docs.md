# Vault

The `vault` plugin owns the served directory: its exclusive lock, store watcher,
write gate and revision publisher. It offers `Vault`, `Directory` and `Ops`.
Core supplies `VaultSettings` after reading the bundle’s declared vocabulary.

The row lives in `packages/bundle/olai.yml`. Its `Config` schema declares the
`format` field, its `olai` default and its description; YAML carries no config.
Every default server profile selects it. An explicit `--plugins` list selects
only the plugins named: include `vault` to serve files. `--plugins=` opens no listener.
An exact `--plugins=ws,web-app,mcp,ui-renderer,navigation,layout,outlines,markdown,files,sidebar,preferences,theme,plugin-inspector` set keeps the control plane available without
a directory; reads and writes report that absence.

The plugins panel explains that switching this row off clears served files and
stops dependent plugins. Accepted writes finish before the watcher and lock are
released. Turning it on opens a fresh store and gate over the same directory.
A lock conflict, invalid format or non-directory path fails this row while the
transports remain available for diagnosis and retry.

Where a write is RECORDED and what a query is ANSWERED BY are two optional
views of this row, and the rows that provide them REGISTER them: `vault-views`
is a door this row stands behind, git tells it about its `Ledger` and search
about its `Search`. Neither can be a `needs` here — git needs the vault, so
requiring its ledger would be an activation cycle — and neither can be a
component of this row either, because a component waiting for a provider that
will never arrive makes the whole row read `waiting`, and a row that reads
`waiting` is one the roster reports as not running. Both providers already wait
for `Vault`, so registering costs them nothing, and a provider that unloads
takes its view with it. A second row registering either view is a defect rather
than a silent replacement: a store reads one ledger, and the second would leave
every write landing in whichever mounted last. With neither mounted the answers
are `NO_LEDGER` and `NO_SEARCH`, which refuse in this row's own words, and a
headless serve reports the vault waiting on `transport-surface` alone.

The table a provider registers INTO belongs to the vault activation that stood
behind the key — `vault-setup` mints one inside its own `apply`. It was a pair
of module variables, which is private to this package and owned by nobody: one
process opening two hosts had one pair between them, so the second serve's git
row answered the first serve's writes.

Only the `olai` format is supported. A future Org codec belongs in this plugin’s
format catalogue and schema; a different storage implementation can stand behind
`Directory`. This plugin does not implement Org or migrate files.

See [running olai](../running.md) for profiles and configuration, and
[the plugin system](../internal/plugin-system.md) for lifecycle ordering.

The browser entry supplies `vault.files`: one activation-owned directory/head
reading and static membership accessors. Content providers consume this file
access directly. The files plugin owns browsing UI and may leave without
withdrawing an already open outline or Markdown document. Navigation owns the
address resolver over the vault's membership, independently of that UI.

The server module has independently injected `setup`, `main`, `file-access`,
`revalidation`, and `http` components. They share the vault row's authority and
lifetime. Setup receives only the operator's root and machine-local path policy
through `VaultBoot`; it builds the complete declared vocabulary over the registered
ledger and search views, then offers the settings that let the directory open.
Changing property-kind contributions revalidates the current store. Unrelated
plugin changes and snapshot publication do not create extra revisions.

Disabling the vault closes all components and drains dependent cleanup before
releasing the directory. A missing HTTP transport leaves that component waiting
while headless file access remains available; the row report includes the missing
component dependency.

The file-access error subscription drains with its Surface registration. Its
adapter treats Effect's queue-end sentinel during cancellation as normal
subscription teardown, while retaining genuine publisher failures. Repeated
withdrawal therefore keeps the management runtime alive and reactivation
creates a fresh subscription.
