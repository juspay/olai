# Vault

The `vault` plugin owns the served directory: its exclusive lock, store watcher,
write gate and revision publisher. It offers `Vault`, `Directory` and `Ops`.
Core supplies `VaultSettings` after reading the bundle’s declared vocabulary.

The row lives in `packages/bundle/olai.yml`, with `config: { format: olai }`.
Every default server profile selects it. An explicit `--plugins` list selects
only the plugins named: include `vault` to serve files. `--plugins=` opens no listener.
An exact `--plugins=ws,web-app,mcp,ui-renderer,layout` set keeps the control plane available without
a directory; reads and writes report that absence.

The plugins panel explains that switching this row off clears served files and
stops dependent plugins. Accepted writes finish before the watcher and lock are
released. Turning it on opens a fresh store and gate over the same directory.
A lock conflict, invalid format or non-directory path fails this row while the
transports remain available for diagnosis and retry.

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
through `VaultBoot`; it builds the complete declared vocabulary and live optional
ledger/search views, then offers the settings that let the directory open.
Changing property-kind contributions revalidates the current store. Unrelated
plugin changes and snapshot publication do not create extra revisions.

Disabling the vault closes all components and drains dependent cleanup before
releasing the directory. A missing HTTP transport leaves that component waiting
while headless file access remains available; the row report includes the missing
component dependency.
