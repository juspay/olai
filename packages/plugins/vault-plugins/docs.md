# Vault plugins

Vault plugins discovers plugin definitions stored in the served vault, compiles
their server and browser modules, and mounts versions that have been approved.
It owns the definition source policy, approval procedures and HTTP browser-chunk
route. The generic host supplies the module loader and service registries.

Disabling this plugin withdraws its procedures and chunk routes and stops the
vault-defined plugin activations it owns. Built-in bundle rows continue to work.
Re-enabling it discovers and validates the current definitions again.

See [writing a plugin in the vault](../dynamic-plugins.md) for the definition
format, allowed module imports, approval workflow and examples.
