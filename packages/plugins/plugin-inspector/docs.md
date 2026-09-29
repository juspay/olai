# Plugin inspector

The plugin inspector provides enable switches, configuration controls and reports in the plugins panel.
It is a browser-only bundle row. Disabling it removes its doors (the **Plugins**
row at the foot of the desktop health popover and the phone drawer's row); the
host keeps managing plugins and its non-UI operations remain available. On a
desktop the door stands beside the health dot: picking its row shuts the
popover and opens the panel, which hangs from the dot and hands the caret back
to it on Escape.

## One line per plugin

The panel is one column. Each plugin is one line: the label `olai.yml` gives it
(`Claude Code`, `Kolu`), a few words of state only when something is wrong
(`Failed`, `Can't start`, `Starting…`, `Needs approval`, `Needs setup`,
`Failed in this tab`, `Starting in this tab`), and its switch, labelled
`Enable <label>` with the name the row shows (`Enable Claude Code`). A plugin
that is on and fine, or off because somebody left it off, says nothing beyond
its switch. The row's condition is read once, as one tagged value
(`rowCondition` in `rows.ts`); the few words, the detail's sentence and their
colour (alarm for a fault, in-progress for a wait) are tables over that tag,
so nothing classifies a row by its words.

Everything else is the row's detail, behind a chevron before the label: the full
sentence about what is wrong, the face its own plugin hangs, **Try again** or
**Reload** for a browser half that failed, a vault definition's source, its
settings, the environment it reads, `Short name` (the settings namespace, where
the label differs), `Saved in` (a link to its node) and, for a session-only
switch, `This switch resets when olai restarts.` (the switch itself wears a
dashed ring and the hover title `Resets when olai restarts`). A row with nothing to reveal
has no chevron; its label keeps the chevron's space so the names line up.

## Groups

Bundle rows pick a `section` and a `label` in `olai.yml`: the sections are
**Agents**, **Notes**, **Connections** and **Interface**. Plugins the vault
defines sit in **Your plugins**; they have no YAML section because they are not
in the YAML. Every group starts shut, its heading counting the rows
(`5 on · 2 off`). Quiet groups sort after the others.

Failed, pending and waiting rows, rows whose browser half failed or waits, and
rows whose own plugin says it needs a person are listed first under **Needs
attention**. That group starts open, tinted, with each row's detail open,
because the detail is what to do. A group whose rows are all off by the build's
default and none running (the test fixtures) is not listed; it appears as soon
as one of its rows is switched on.

A press on a heading or a chevron opens it, and that state lives on inspector
state, the same place the door's open bit lives, so a roster redraw or the
rebuild a switch causes cannot shut it. Pressing a switch opens the group its
row sits in, so a row that leaves Needs attention after a fix stays in view.

Carrying and a row's `switchHint` are a confirm on Off, not a caption on On. The
question opens under the row and names the plugins that stop with it by their
labels, with **Keep on** and **Turn off**. A press on another row dismisses it.

## Row faces

A row's own plugin may hang a face in `plugins.row`, which this panel owns and
draws. The face is drawn in the row's detail, below the row's own sentence and
above its settings, and it owns both halves of that drawing, its words and its
verbs; the mail row uses it to offer connecting an account. The same face
answers `needs()`: a row whose plugin says so is filed under **Needs attention**
with the failed and waiting ones and reads `Needs setup`, so a plugin that is
running, faultless and still waiting on a person is not left among the healthy
rows. A row whose plugin hung no face is drawn without one. The table is held by
the integration that draws the panel, so a face lives exactly as long as the
surface it is drawn on.

Enabled engines whose adapter or CLI is missing also use this face. Their
toggles stay on, but their rows move to **Needs attention** with the same reason
as the disabled chat-picker entry and a live installation link. Chat owns the
probe and offers its live reading through a declared browser service; each
engine's component owns its own row contribution. Installing the CLI and
switching that engine off and on refreshes just its reading. With chat disabled
the component pends and draws no stale diagnosis.

## Ownership

Its provider owns panel visibility, which groups and rows are open, and the
source versions the reader has acknowledged. A separate integration consumes
`browser-management` and `ui-renderer.slots`, contributing through
`layout.tools` with `desktop: "health"` and the door's `open` reading, so a
rebuilt shell reopens the health popover and the panel with it. Removing the
shell withdraws the rendered integration without resetting the provider's
reading history. Removing the inspector closes its state; re-enabling creates a
fresh activation.

TWO MORE COMPONENTS, each an independent fiber under this row:

- **`preferences`** contributes the promoted rows to `preferences.sections`. It
  names no plugin: it reads the roster (`browser-management`) for the plugins
  that are running and marked something as a preference, and registers one
  section per plugin — under a scope of its own, so a plugin switched off in
  another tab withdraws its heading with no reload, and switching it back on
  registers it again. The Solid subscription to the roster is acquired under
  this component's own owner and released with it, and the rows are the same
  `Control.tsx` the panel's own rows wear.
- **`preferences-door`** holds the optional `preferences.open` service for as
  long as that panel is up. When it is absent the component is `waiting`,
  nothing is held, and `tools` draws the promoted controls itself.

Neither puts a live value across a package boundary through an import: the
roster arrives through `browser-management`, and the panel's door arrives
through the `preferencesPanel` tag and this package's own `heldService` holder.
Disabling the inspector withdraws both without resetting the settings reader or
the inspector's state.

The host adapter provides roster readings, reports, switching, configuration
writes and retry without handing over a notebook client or importing this
plugin. Cell subscriptions are acquired under the consuming component's Solid
owner. The inspector reads build-supplied label, section, quiet, opt-in and
switch-hint facts through that capability rather than importing the bundle that
loads it.

Source approval belongs to `vault-plugins`. The inspector calls its optional,
scoped browser client with the source version the reader acknowledged. If that
browser provider is absent, approval reports a refusal and releases the pending
control; the inspector remains usable. A returning provider supplies a fresh
client for the next request. No host approval binding or hard dependency keeps
the definition provider alive.

## Layout

On a desktop the panel is a centred box, at most 30rem wide; on a phone it is a
sheet from the bottom of the screen with 44px rows. The header names the panel
and links to `_olai/Settings.olai`.

## Settings

Every schema leaf is a control in its row's detail, labelled by its key in
sentence case (`Watch held for`); the schema description is its tooltip. Four
or fewer choices use segmented buttons, longer choices a select; booleans use
switches and text/numbers use compact inputs. Numeric bounds, units and format
hints stay available. Off rows keep their settings editable.

**A PROMOTED LEAF IS NOT DRAWN HERE.** A config schema leaf a plugin marks as a
preference (`preference` on the schema annotation, read by
`@olai/plugin-api/configuration`) is drawn in the preferences panel instead,
under a heading named after the plugin, and this row shows one **Set in
Preferences** link where those controls were — the link shuts this panel and
opens that one through `preferences.open`. Nothing is imported to know this: the
flag travels on the roster's `configurationValues`, and the link appears only
while the plugin runs and the panel that draws the row is up. While the plugin
is OFF, or the preferences row is disabled, the controls are drawn here exactly
as they were, so the setting stays editable from whichever panel can move it.
The inspector's own `configuration.open(name)` still lands on the link, which is
the row's first control when every leaf is promoted.

A file-authored value has a ● with the tooltip `set in Settings.olai` and a ↺
reset beside it. Default values have no marker. Invalid file text appears in an
alarmed input with the schema message and effective default beneath it; its
reset can remove the malformed property. Enter or blur saves; Escape restores
the accepted reading without closing the panel. Drafts survive unrelated roster
updates.

`plugins.configure` is a browser procedure. It validates the leaf before an
ordinary file write, creates a missing namespace or section child, and waits
for the revision and follower. **Use default** deletes the property. An invalid
value is refused before the file changes. No reader or a broken file freezes controls with
the server’s refusal in their tooltips; a knob never falls back to session state.

Operator environment readings are read-only: each is labelled by its
description, shows its value or **Not set**, and names its variable. Secrets
show only **Set** or **Not set**. Wrapper-supplied build defaults are hidden.
When the node exists, `Saved in` links to it. An optional Links integration
supplies that link and withdraws it when navigation stops. Inspector state
survives the renderer’s replacement.

## Server

The **Server** section closes the panel and starts shut; its heading shows the
machine name. It lists Address (host and port), Machine name, the process's
`olai` settings (Log format and Log level, with the same controls as a plugin's),
Allowed origins, Access token (**Set** or **Not set**; the value is never
published) and State folder.

## Opening a row from elsewhere

The inspector offers a scoped `configuration` service with an `open(name)`
verb. It opens the row's group and detail and moves focus into its first
control. Kolu consumes this through an optional component for its watch wrench;
losing that provider removes the wrench without stopping the feed. No live
inspector state crosses the package boundary through an import.

## Switching

A switch writes `on` through the directory’s ordinary write door and waits for
reconciliation. The vault provider and configuration reader stay session-only,
marked by a dashed ring with the tooltip `Resets when olai restarts` and the
note in their detail, so either can be restored from the panel. When the reader
is absent, every switch is session-only and the panel says so above the groups.
Broken configuration is named and must be repaired before another durable
press can write.

The follower ignores file `on` values on the vault and configuration reader
owners, warning once per row and file. Their session switches remain usable
without editing policy on disk, including after the reader reconnects.
