# vault-plugins: running the plugins your directory defines

`vault-plugins` runs the plugins your directory defines: it reads each folder under `plugins/`, compiles the code, and starts the version a person turned on.[^how]

## What it owns

| Thing | What it is |
| --- | --- |
| the folders | `plugins/<name>/`, holding `README.md`, `server.ts` and, if the plugin draws anything, `browser.tsx` |
| the files it claims | `.ts` and `.tsx` files, under `plugins/` and nowhere else, shown on the plugin's own page rather than under **Reference** |
| the pages | `/plugins/<name>`, the chat about each,[^builder] and the **Plugins** section of the sidebar |
| the palette | the **New plugin** command, the two steps it asks you for, and the `+` on that heading |
| the tools | `vault-plugins_guide`, `_inspect`, `_write`, `_run` and `_stop` |

The folder's name is the plugin's name.[^readme] A version is a hash of the two code files, and not of the `README.md`.[^edit]

## Where your approval is kept

`on`, `approved` and `checked`, together with the plugin's own settings, are properties on a top-level row of `_olai/Settings.olai` titled with the plugin's name.[^copied] Those three names are reserved, and a plugin cannot use them for its own settings.[^reserved]

## What turns it off

This plugin needs the vault, which opens the directory olai serves, and runs in the `web` and `surface` profiles. Set `on: no` on the `vault-plugins` row in `_olai/Settings.olai`, or use its switch, **Vault plugins** under **Notes** in the plugins panel ([../settings.md](../settings.md)).

With it off, every plugin your directory defines stops.[^off] This plugin takes no settings of its own.

A plugin from your directory runs with the same powers as olai's server, so only a person can turn one on. An agent cannot write the `approved` property on any row through this plugin, even while it is off.

[^how]: This plugin also serves the browser part of each plugin your directory defines. [../dynamic-plugins.md](../dynamic-plugins.md) is how you ask for a plugin, write one and turn one on.

[^readme]: The `README.md` is an ordinary Markdown file. This plugin reads its first heading for the plugin's title, and its first paragraph for the line shown under that title.

[^edit]: Editing either code file pauses the plugin, stops it, and leaves its page showing a diff against the version that was approved. Editing the `README.md` changes no version, so it never asks anyone to approve the plugin again.

[^builder]: Asking for a new plugin starts a chat titled `[Hex Swatch](/plugins/hex-swatch)`, and any chat at a plugin's address is that plugin's builder ([../node-agents.md](../node-agents.md)). The page reads **Being built** until the agent calls `vault-plugins_run` without a fault.

    That page carries **Ask for a change…** on a desktop, the chat itself in the seat at its foot on a phone, and the **Ask about …** box where no chat is about it. A `builder` property on a settings row is ordinary text, and olai reads nothing from it.

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
