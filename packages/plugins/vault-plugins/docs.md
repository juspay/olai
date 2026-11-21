# vault-plugins: running the plugins your directory defines

`vault-plugins` runs the plugins your directory defines: it reads each folder under `plugins/`, compiles the code, and starts the version a person turned on.[^how]

## What it owns

| Thing | What it is |
| --- | --- |
| the folders | `plugins/<name>/`, holding `README.md`, `server.ts`, `browser.tsx` and any other `.ts` or `.tsx` files |
| the files it claims | `.ts` and `.tsx` files under `plugins/`, shown on the plugin's page rather than under **Reference** |
| the pages | `/plugins/<name>`, the chat about each,[^builder] the sidebar's **Plugins** section, and `/plugins/<name>/app`, drawn by the plugin |
| the palette | **New plugin**, its two steps, and the `+` on the section's heading |
| the tools | `vault-plugins_guide`, `_inspect`, `_write`, `_run` and `_stop` |

The folder's name is the plugin's name.[^readme] A version is a hash of every code file in the folder, and not of the `README.md`.[^edit]

## Where your approval is kept

`on`, `approved` and `checked`, together with the plugin's own settings, are properties on a top-level row of `_olai/Settings.olai` titled with the plugin's name.[^copied] Those three names are reserved, and a plugin cannot use them for its own settings.[^reserved]

## What turns it off

This plugin needs the vault, which opens the directory olai serves, and runs in the `web` and `surface` profiles. Set `on: no` on the `vault-plugins` row in `_olai/Settings.olai`, or use its switch, **Vault plugins** under **Notes** in the plugins panel ([../settings.md](../settings.md)).

With it off, every plugin your directory defines stops.[^off] This plugin takes no settings of its own.

A plugin from your directory runs with the same powers as olai's server, so only a person can turn one on. An agent cannot write the `approved` property on any row through this plugin, even while it is off.

[^how]: This plugin also serves the browser part of each plugin your directory defines. [../dynamic-plugins.md](../dynamic-plugins.md) is how you ask for a plugin, write one and turn one on.

[^readme]: The `README.md` is an ordinary Markdown file. This plugin reads its first heading for the plugin's title, and its first paragraph for the line shown under that title. Its frontmatter carries the tie to the builder chat. So the builder is told to leave the `---` block at the top of the file exactly as it is, and olai refuses a write by an agent that changes or drops that tie.

[^edit]: Editing, adding or removing any code file pauses the plugin, stops it, and leaves its page showing a diff of each changed file against the version that was approved. Editing the `README.md` changes no version, so it never asks anyone to approve the plugin again.

[^builder]: Asking for a new plugin starts a chat about the plugin's own `README.md`, and that chat is the plugin's builder ([chat.md](chat.md)). It is named after the folder, so the builder of `plugins/swatch/README.md` reads `swatch`. The page reads **Being built** until the agent calls `vault-plugins_run` without a fault.

    That page carries **Ask for a change…**, which opens the builder chat in the pane beside it, and **Ask about …** where no chat is about this plugin yet. A `builder` property on a settings row is ordinary text, and olai reads nothing from it.

[^copied]: A plugin from your directory keeps these properties in the settings file, which is where a plugin built into olai keeps its settings too. So a plugin folder copied in from another directory arrives switched off and unapproved, and the switch, a stop and a finished build all survive a restart.

[^reserved]: A plugin whose `Config` declares one of the three reserved names fails to start, and the `plugins.configure` call refuses to write one.

[^off]: With this plugin off, the approval steps and the `vault-plugins_*` tools go away, the plugin pages and the sidebar section go with them, and `.ts` and `.tsx` files under `plugins/` stop being claimed. The plugins compiled into this build of olai keep running. Switching it on reads the folders that are there now and checks them again.

<details>
<summary>What it offers other plugins</summary>

| Key | What it is | Who uses it |
| --- | --- | --- |
| `vault-plugins.approval` | approving one version, or every version after it | [plugin-inspector](plugin-inspector.md) |
| `vault-plugins.new-plugin` | opening the palette at **New plugin** | plugin-inspector |

`vault-plugins.new-plugin` comes from a component of its own, which needs the palette, so a serve with no palette offers `vault-plugins.approval` and not `vault-plugins.new-plugin`. The panel asks for each separately and draws nothing where one is absent.

</details>
