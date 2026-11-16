# vault

Opens the directory olai serves, and every row that reads or writes a file stands on it.[^does]

## What turns it off

The row runs in every profile. Its switch, **Vault** under **Notes** on the plugins panel, is session-only, so the panel says **This switch resets when olai restarts** rather than writing the choice down.[^why]

The panel asks before switching it off, saying that turning it off clears the served files and stops plugins that need the vault.[^close]

With it off, olai serves no files, every row that needs them stops, and the tools that reach the directory refuse with the reason.[^transports]

## Settings

| Key | Default | What it does |
| --- | --- | --- |
| `format` | `outline-olai` | The file-kind row used when olai mints a new outline |

Files already on disk are decoded by whichever row claims their kind, whatever `format` says.[^claims]

## What it refuses

| What happens | What you get |
| --- | --- |
| another olai already holds the directory | the row fails and the panel says so; the transports keep running, so you can free the directory and switch it on again |
| the path is not a directory | the same: a failed row, and a serve you can retry from |
| `format` names a row that is not running | the directory stays readable and creating a new outline is refused before anything is written |

## What is missing without git or search

Two optional readings come from other rows.[^optional]

| Row | Without it |
| --- | --- |
| `git` ([git.md](git.md)) | writes land on disk and nobody records them: `nobody is recording writes here, so there is nobody to record a write` |
| `search` ([search.md](search.md)) | every query answers with no hits and the reason, naming the row |

See [../settings.md](../settings.md) for choosing what runs, and [../architecture/plugin-system.md](../architecture/plugin-system.md) for how a row's lifetime works.

[^does]: What the row does with the directory: it claims the directory, watches the files, gates every write and publishes a revision when anything changes.

[^why]: Why the switch is session-only: the settings file lives inside the directory this row opens. The settings row and the row claiming the settings file's suffix are session-only for the same reason ([../settings.md](../settings.md)).

[^close]: Switching the vault off and on: writes olai has already accepted finish before the watcher and the claim are released, and switching it on opens a fresh store over the same directory.

[^claims]: A file no row claims is not served.

[^transports]: The listener, the websocket and `/mcp` stay up with the vault off, so you can switch it back on from the panel.

[^optional]: The two optional readings, git's and search's: the answer when neither row is mounted is the vault's own.
