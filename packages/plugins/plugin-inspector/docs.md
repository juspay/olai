# Plugin inspector

The plugin inspector provides enable switches, configuration controls and reports in the plugins panel.
It is a browser-only bundle row. Disabling it removes its header and drawer
controls; the host keeps managing plugins and its non-UI operations remain
available.

The panel is grouped, not a flat walk. Bundle rows pick a `section` in
`olai.yml`; quiet sections start collapsed when every member is running and
silent. A press on the heading opens one, and that walk lives on inspector
state — the same place the door's open bit lives — so a roster redraw or the
rebuild a switch causes cannot slam it shut. Failed, pending and waiting rows sit in **Needs you** first. Plugins
the vault defines are **Defined here** — they have no YAML section because they
are not in the YAML; pending ones are Needs you until approved. Ordinary
running rows show a name, effective-value summary, labelled enable switch and disclosure; carrying and a row's `switchHint` are a
confirm on Off, not a caption on On.

Its provider owns panel visibility and the source versions the reader has
acknowledged. A separate integration consumes `browser-management` and
`ui-renderer.slots`, contributing through `layout.tools`. Removing the shell
withdraws the rendered integration without resetting the provider's reading
history. Removing the inspector closes its state; re-enabling creates a fresh
activation.

The host adapter provides roster readings, reports, switching, configuration writes and retry
without handing over a notebook client or importing this plugin. Cell
subscriptions are acquired under the consuming component's Solid owner. The
inspector reads build-supplied section, quiet, opt-in and switch-hint
facts through that capability rather than importing the bundle that loads it.

Source approval belongs to `vault-plugins`. The inspector calls its optional,
scoped browser client with the source version the reader acknowledged. If that
browser provider is absent, approval reports a refusal and releases the pending
control; the inspector remains usable. A returning provider supplies a fresh
client for the next request. No host approval binding or hard dependency keeps
the definition provider alive.

The server derives each control and any invalid-file problem from the leaf’s
`Config` schema. The panel receives metadata, not schemas. Its summary lists
`Label: Value` in schema order, four fields then `+N`, with `— using defaults`
only when every field defaults and `· N invalid` when needed. Choice and boolean
values are capitalised; text and numbers stay verbatim. Authored fields are
named in the summary’s hover.

The enable switch is labelled `Enable <row>`. Expanded controls show their
schema descriptions and either `default` or `set in Settings.olai` with
**Use default**. Four or fewer choices use segmented buttons, more use a
select; booleans use switches and numbers/text use inputs. Enter or blur saves;
Escape restores the current reading. Drafts belong to mounted controls and
survive unrelated roster updates. The tab cycle reaches disclosures and skips
hidden controls. A bad hand-written leaf shows its raw text and the schema’s
message beneath the effective default.

`plugins.configure` is a browser procedure. It validates the leaf before an
ordinary file write, creates a missing namespace or section child, and waits
for the revision and follower. **Use default** deletes the property. An invalid
value is refused before the file changes. No reader or a broken file freezes controls with
the server’s refusal sentence; a knob never falls back to session state.

Environment readings are read-only, including wrapper provenance and secret
set/unset. **Open settings node ↗** is last when the node exists. An optional
Links integration supplies that link and withdraws it when navigation stops.
Inspector state survives the renderer’s replacement. **This serve** uses the
same controls for the process’s `olai` node, followed by read-only facts. The
foot names the policy file and private LocalState memory without opening memory.

The inspector offers a scoped `configuration` service with an `open(name)`
verb. It opens the row’s group and disclosure and moves focus into the controls.
Kolu consumes this through an optional component for its watch wrench; losing
that provider removes the wrench without stopping the feed. No live inspector
state crosses the package boundary through an import.

A switch writes `on` through the directory’s ordinary write door and waits for
reconciliation. The vault provider and configuration reader stay session-only,
said on their rows, so either can be restored from the panel. When the reader
is absent, that shared limitation is said once at the foot. Broken configuration
is named and must be repaired before another durable press can write.

The follower ignores file `on` values on the vault and configuration reader
owners, warning once per row and file. Their session switches remain usable
without editing policy on disk, including after the reader reconnects.
