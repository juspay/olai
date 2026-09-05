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
