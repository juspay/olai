# Settings

The settings row needs the vault and offers its current configuration reading.
It selects `_olai/Settings.olai` by case-folded basename, shallowest path first,
then path order. Each top-level node names a bundle row; child nodes name
sections of that row's schema. An absent or malformed value uses the schema's
default. A malformed file defaults every row and remains named in the reading.

The row publishes data only. The composition root owns loader patches and
settling. Stopping the reader withdraws its service; patches already applied
stand. Reopening the vault publishes a fresh reading and reapplies its policy.

The service contract is `ConfigurationSource`; roster values travel as
`configurationValues`, with `setBy` naming the vault or the default. Those
generic names keep the implementation independent of the row that offers it.

The panel switch writes `on` through the ordinary write door, then waits for this
reader and the root’s patches to settle. It creates the file and namespace when
needed, preserving other properties. The vault switch remains session-only;
without this reader, switches say session-only too. A broken file is named and
must be repaired before a durable press can write. If this row disables itself,
edit its `on` in the file to restore durable switching.
