# settings

Reads `_olai/Settings.olai` and hands every row the policy it finds there: which rows run, and the settings each one accepts. Without it, nothing you write in that file is read. [../settings.md](../settings.md) is how you use it.

## Which file it reads

The first file whose name folds to `settings` and whose kind holds nodes, shallowest path first and then in path order. On a directory olai set up, that is `_olai/Settings.olai`.

Each top-level node names a row, or `olai` for the serve itself. An `on` property of `yes` or `no` on that node says whether the row runs; the row's other settings are properties beside it, and a child node names a section of the row's schema.

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"on":"no"}}
```

A value that is absent, or that the row's schema will not take, falls back to the schema's default. A file that cannot be read at all leaves every row on its defaults and stays named in the reading.

## What it says when a value will not do

One line per malformed shape, logged once.

| Line | What happened |
| --- | --- |
| `<file>: malformed settings file; every row uses its defaults` | the file itself would not read |
| `<file>: <row>.<key>: "<value>" uses its default — <why>` | one setting is not one the row's schema takes |
| `<file>: <row>.on: "<value>" uses its default — expected yes or no` | the `on` property is neither `yes` nor `no` |
| `<file>: <row>.on is ignored; this reader’s switch is session-only so the file cannot disable its own reader.` | the node is the vault, this row, or the row claiming the settings file's own suffix |

## What an edit does

Changing a row's settings restarts that row, unless the row follows its settings live, as `git` does. olai logs `plugins: config change restarts row "<id>"` with the keys that moved, never their values, and then the fresh mount. An open tab reconnects and restarts that row's browser half, so what it draws follows the new settings. Rows you did not touch keep running.

A setting a row marks as a preference is drawn in the **Preferences** panel under that row's name instead of on the plugins panel. Those headings and controls are known even while this row is off; only the values are then the schema's defaults.

## What turns it off

Its switch, **Settings** under **Notes** on the plugins panel, is session-only, as the vault's is: this row reads a file inside the directory the vault opens. The panel says **This switch resets when olai restarts**.

With it off, the file is not read. Settings already applied stand, and every switch on the panel becomes session-only, which the panel says above its groups. You get the same thing when the file will not read, and a press that wants to write a durable choice is refused with `Repair <file> before changing which tools run.` until you repair it. Editing a setting is refused with `Settings can be edited when the configuration reader is running`.

Switching the vault back on publishes a fresh reading and applies it again.
