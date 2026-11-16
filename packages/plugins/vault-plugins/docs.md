# vault-plugins

Runs plugins your directory defines: it finds the definitions, compiles both halves, serves the browser half, and mounts the version a person approved. [../dynamic-plugins.md](../dynamic-plugins.md) is how you write and approve one.

## What turns it off

The row needs the vault and runs in the `web` and `surface` profiles. Set `on: no` on the `vault-plugins` node in `_olai/Settings.olai`, or use its switch, **Vault plugins** under **Notes** on the plugins panel ([../settings.md](../settings.md)).

With it off, every plugin the directory defines stops, the approval procedures and the `vault-plugins_*` tools withdraw, and a browser half stops being served. The rows this build compiled in keep running. Switching it on reads and validates the current definitions again.

The row accepts no settings of its own.

A definition runs with this server's own authority, so approving one is a person's. An agent cannot write the `approved` property on any node, on this row's account, even while the row is off.
