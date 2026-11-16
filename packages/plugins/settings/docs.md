# settings

Reads `_olai/Settings.olai` and hands every row the policy it finds there: which rows run, and the settings each one accepts.[^without]

## Which file it reads

The first file whose name folds to `settings` and whose kind holds nodes, shallowest path first and then in path order. On a directory olai set up, that is `_olai/Settings.olai`.

Each top-level node names a row, or `olai` for the serve itself. An `on` property of `yes` or `no` on that node says whether the row runs.[^props]

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"on":"no"}}
```

A value the row's schema will not take falls back to the schema's default.[^fallback]

## What an edit does

Changing a row's settings restarts that row, unless the row follows its settings live, as `git` does.[^log]

A setting a row marks as a preference is drawn in the **Preferences** panel under that row's name instead of on the plugins panel.[^pref]

## What turns it off

Its switch, **Settings** under **Notes** on the plugins panel, is session-only, as the vault's is.[^why]

With it off, the file is not read.[^offdetail] Switching the vault back on publishes a fresh reading and applies it again.

[^without]: Without this row, nothing you write in the settings file is read. [../settings.md](../settings.md) is how you use it.

[^props]: A row's other settings are properties beside its `on` property, and a child node names a section of the row's schema.

[^fallback]: A value that is absent falls back to the schema's default as well. A file that cannot be read at all leaves every row on its defaults and stays named in the reading.

[^log]: What a restart logs: `plugins: config change restarts row "<id>"` with the keys that moved, never their values, and then the fresh mount. An open tab reconnects and restarts that row's browser half, so what it draws follows the new settings. Rows you did not touch keep running.

[^pref]: A promoted preference's headings and controls are known even while this row is off; only the values are then the schema's defaults.

[^why]: Why this switch is session-only: this row reads a file inside the directory the vault opens. The panel says **This switch resets when olai restarts**.

[^offdetail]: With the row off, settings already applied stand, and every switch on the panel becomes session-only, which the panel says above its groups. You get the same thing when the file will not read. A press that wants to write a durable choice is refused with `Repair <file> before changing which tools run.` until you repair it, and editing a setting is refused with `Settings can be edited when the configuration reader is running`.

<details>
<summary>What it says when a value will not do</summary>

One line per malformed shape, logged once.

| Line | What happened |
| --- | --- |
| `<file>: malformed settings file; every row uses its defaults` | the file itself would not read |
| `<file>: <row>.<key>: "<value>" uses its default — <why>` | one setting is not one the row's schema takes |
| `<file>: <row>.on: "<value>" uses its default — expected yes or no` | the `on` property is neither `yes` nor `no` |
| `<file>: <row>.on is ignored; this reader’s switch is session-only so the file cannot disable its own reader.` | the node is the vault, this row, or the row claiming the settings file's own suffix |

</details>
