# Vault

The `vault` plugin owns the served directory: its exclusive lock, store watcher,
write gate and revision publisher. It offers `Vault`, `Directory` and `Ops`.
Its setup activation supplies `VaultSettings` and owns the scoped `vault.file-kinds` registry.

The row lives in `packages/bundle/olai.yml`. Its `Config` schema declares the
`format` field, its `outline-olai` default and its description; YAML carries no config.
Every server profile selects the vault. Its panel switch is session-only: turning it off keeps the transport control plane available while withdrawing the directory and the services that depend on it. Enabling it reopens the store and republishes the settings file. Rows that do not own the settings reading use durable `on` properties in `_olai/Settings.olai`. The settings row and the row claiming that file’s suffix share the session-only exception.

The plugins panel explains that switching this row off clears served files and
stops dependent plugins. Accepted writes finish before the watcher and lock are
released. Turning it on opens a fresh store and gate over the same directory.
A lock conflict or non-directory path fails this row while the
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

The `outline-olai` row provides the current outline format. Further formats register their own claims and pure codecs with `vault.file-kinds`; the vault has no format catalogue and performs no migration.

See [running olai](../running.md) for profiles and configuration, and
[the plugin system](../architecture/plugin-system.md) for lifecycle ordering.

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

File claims are atomic and owned by the registering fiber. The registry stamps
the row id; a second claim by that row or overlapping suffixes refuse without
installing anything. Withdrawal releases only that registration and triggers a
reprobe. Each published Reading carries the Claims snapshot that validated it.
The codec reads the current table per call and unclaimed files are not cached
as served files.

`format` is the row id used when minting outlines, default `outline-olai`. An absent
configured row leaves the vault readable and refuses the mint before writing.
`vault.files` carries live claims, the configured `outlineRow`, kind lookup,
fresh unkept-text body reads and outline diffs through the vault's own wire.
Media admission and HTML sealing use the current claims per request.

Non-Markdown pages subscribe to the vault's `bodyPage` stream through
`vault.files.bodyPage` for their head, revision and referrers. Markdown owns its
separate `.md` page stream, so disabling it leaves the other body pages usable.
`vault.files.body` is a browser-only fresh read for unkept text that is not
fetched; saved HTML stays on the sealed media route and is not an agent tool.
