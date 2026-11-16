# vault-plugins

Runs the plugins your directory defines: it reads each folder under `plugins/`, compiles both halves, and mounts the version a person turned on.[^how]

## What it owns

| Thing | What it is |
| --- | --- |
| the folders | `plugins/<word>/`, holding `README.md`, `server.ts` and an optional `browser.tsx` |
| the file claim | `.ts` and `.tsx`, under `plugins/` and nowhere else, read on the plugin's page rather than in **Reference** |
| the pages | `/plugins/<word>`, and the sidebar's **Plugins** section beside them |
| the palette | **New plugin**, its two levels, and the `+` on that heading |
| the tools | `vault-plugins_guide`, `_inspect`, `_write`, `_run` and `_stop` |

The folder's name is the plugin's word.[^readme] A version is a content hash of the two code files and not of the `README.md`, so prose edits cost nobody a decision.[^edit]

## Where consent is kept

`on`, `approved`, `builder` and `checked`, with the plugin's own knobs beside them, are properties on a root node titled with the word in `_olai/Settings.olai`, exactly where a built row keeps its settings.[^copied] Those four keys are reserved.[^reserved]

## What turns it off

The row needs the vault and runs in the `web` and `surface` profiles. Set `on: no` on the `vault-plugins` node in `_olai/Settings.olai`, or use its switch, **Vault plugins** under **Notes** on the plugins panel ([../settings.md](../settings.md)).

With it off, every plugin the directory defines stops.[^off] The row accepts no settings of its own.

A plugin runs with this server's own authority, so turning one on is a person's. An agent cannot write the `approved` property on any node, on this row's account, even while the row is off.

[^how]: The row serves the browser half of each plugin as well. [../dynamic-plugins.md](../dynamic-plugins.md) is how you ask for one, write one and turn one on.

[^readme]: The `README.md` is markdown's own file: this row reads its first heading for the title and its first paragraph for the line a person sees under it.

[^edit]: An edit to either half pauses the plugin, unmounts it, and leaves its page showing a diff against the version that was approved.

[^copied]: Because consent is kept in the settings file, a folder copied in from another directory arrives off and unapproved, and the switch, a stop and a finished build all survive a restart.

[^reserved]: A `Config` declaring one of the four reserved keys faults the plugin, and `plugins.configure` refuses to write one.

[^off]: With the row off, the approval procedures and the `vault-plugins_*` tools withdraw, the pages and the sidebar section go, and the scoped claim on `.ts` and `.tsx` goes with them. The rows this build compiled in keep running. Switching it on reads and validates the current folders again.

<details>
<summary>What it offers other plugins</summary>

| Key | What it is | Who names it |
| --- | --- | --- |
| `vault-plugins.approval` | approving one version, or every later one | [plugin-inspector](plugin-inspector.md) |
| `vault-plugins.new-plugin` | opening the palette at **New plugin** | plugin-inspector |

Each is offered by a component of its own, so a serve with no palette offers the second and not the first. The panel holds each separately and draws nothing where one is absent.

</details>
