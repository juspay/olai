# Vault plugins

Vault plugins is the row behind a plugin the vault itself defines. It claims
`.ts` and `.tsx` **scoped to `plugins/`**, reads each folder under it as one
plugin — `README.md`, `server.ts` and an optional `browser.tsx` — compiles the
halves, and mounts the ones a person has approved and switched on. It owns the
approval and mint procedures, the plugin pages' wire, the agent's five authoring
tools, and the HTTP route the browser chunk is served from. The generic host
supplies the module loader and the service registries.

The folder's name is the plugin's word. The README is markdown's file, not this
row's: this row says only where it sits and reads its first heading and first
paragraph for the title and the sentence a person is shown.

Consent is not in the folder. `on`, `approved` (a version hash or `always`),
`builder`, `checked` (the version the building conversation last finished at)
and the plugin's own schema leaves live on a root node titled with the word in
`_olai/Settings.olai`, exactly where a built row keeps its settings — so a
folder copied in from another vault arrives off and unapproved, and the switch,
a `stop` and a finished build all survive a restart. Those four keys are
reserved: a `Config` declaring one faults the plugin, and `plugins.configure`
refuses to write one.

A version is a content hash of the two halves and not of the README, so prose
edits cost nobody a decision; an edit to either half puts the plugin back to
pending, unmounts it, and leaves its page showing a diff against the approved
version.

The browser half hangs its faces in five other plugins' houses — the sidebar's
**Plugins** section (drawn whenever that component is up, with a `+` and, on a
vault with nothing in it, one row inviting a first plugin), the `/plugins/<word>`
page, the palette's **New plugin** levels, chat's agent panel and the alerts
channel — one component per house, so each waits and withdraws alone. It offers
two verbs back across the wall, both consumed by the plugins panel:
`vault-plugins.approval` (saying yes to a version) and
`vault-plugins.new-plugin` (opening the palette at **New plugin**). The panel
holds each on a component of its own and draws nothing where one is absent.

Disabling this plugin withdraws its procedures, pages, file claim and chunk
routes and stops the vault-defined activations it owns. Built-in bundle rows
continue to work. Re-enabling it reads the folders again and revalidates them.

See [plugins the vault defines](../dynamic-plugins.md) for the folder shape,
where consent lives, allowed module imports, the approval workflow and the two
worked examples.
