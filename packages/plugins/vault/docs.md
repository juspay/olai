# vault: opening the directory olai serves

The `vault` plugin opens the directory olai serves. Every other plugin that reads or writes a file needs it.[^does]

## What turns it off

This plugin runs in every profile. Its switch, **Vault** under **Notes** in the plugins panel, lasts only until olai restarts, and the panel says **This switch resets when olai restarts**.[^why]

The panel asks before switching it off.[^close]

With it off, olai serves no files, every plugin that needs them stops, and the tools that reach into the directory refuse and say why.[^transports]

## Settings

| Key | Default | What it does |
| --- | --- | --- |
| `format` | `outline-olai` | The plugin whose file kind olai uses when it creates a new outline |

A file already on disk is read by whichever plugin claims its kind, whatever `format` says.[^claims]

## What it refuses

| What happens | What you get |
| --- | --- |
| another olai already has this directory open | this plugin fails and the panel says so; the connections keep running, so you can free the directory and switch it on again |
| the path is not a directory | the same: a failed plugin, and a serve you can try again from |
| `format` names a plugin that is not running | the directory stays readable, and creating a new outline is refused before anything is written |

## What is missing without git or search

Two of the vault's answers come from other plugins: what records your writes, and what a search finds.[^optional]

| Plugin | Without it |
| --- | --- |
| `git` ([git.md](git.md)) | writes land on disk and nobody records them: `nobody is recording writes here, so there is nobody to record a write` |
| `search` ([search.md](search.md)) | every query answers with no hits and the reason, naming the plugin |

See [../settings.md](../settings.md) for choosing what runs, and [../architecture/plugin-system.md](../architecture/plugin-system.md) for how a plugin starts and stops.

[^does]: What this plugin does with the directory: it claims the directory so that no second olai opens it, watches the files for changes, checks every write before it happens, and publishes a new revision whenever anything changes.

[^why]: Why the switch lasts only for the session: the settings file lives inside the directory this plugin opens. The settings plugin, and the plugin that reads the settings file's kind, last only for the session for the same reason ([../settings.md](../settings.md)).

[^close]: Switching the vault off and on again: the question the panel asks says that switching it off clears the files olai is serving and stops the plugins that need them. Writes olai has already accepted finish before it stops watching the files and lets go of the directory, and switching it on opens the same directory afresh.

[^claims]: A file no plugin claims is not served at all.

[^transports]: The listener, the websocket and `/mcp` stay up with the vault off, so you can switch it back on from the panel.

[^optional]: When neither `git` nor `search` is running, the vault answers both of these itself.
