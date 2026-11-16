# settings: reading the settings file

The `settings` plugin reads the file `_olai/Settings.olai` and tells every plugin what that file says: which plugins run, and the settings each one is given.[^without]

## Which file it reads

olai uses the first file whose name reads as `settings`, whatever its case, and whose kind can hold rows. Files nearest the top of the directory are tried first, then the others in path order. In a directory olai set up, that file is `_olai/Settings.olai`.

Each top-level row of that outline names a plugin, or says `olai` for the serve itself. A property named `on`, set to `yes` or `no`, on that row says whether the plugin runs. A property is a key and a value on a row.[^props]

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"on":"no"}}
```

A value a plugin does not accept is ignored, and that setting keeps its default.[^fallback]

## What an edit does

Changing a plugin's settings restarts that plugin, unless it follows its settings as they change, which `git` does.[^log]

A setting the plugin marks as a preference is drawn in the **Preferences** panel under that plugin's name, instead of in the plugins panel.[^pref]

## What turns it off

Its switch, **Settings** under **Notes** in the plugins panel, lasts only until olai restarts, as the switch for the vault does. The vault is the plugin that opens the directory olai serves.[^why]

With it off, the file is not read.[^offdetail] Switching the vault back on makes olai read the file afresh and apply it again.

[^without]: Without this plugin, nothing you write in the settings file is read. [../settings.md](../settings.md) is how you use the file.

[^props]: A plugin's other settings are properties beside its `on` property on the same row. A row written underneath that row names one section of that plugin's settings.

[^fallback]: A setting that is not written in the file at all keeps its default too. A file that cannot be read leaves every plugin on its defaults, and the file is still named in what olai reports.

[^log]: What a restart writes to the log: `plugins: config change restarts row "<id>"`, with the names of the settings that changed but never their values, and then the lines for starting the plugin again. An open tab reconnects and restarts that plugin's browser part, so what you see follows the new settings. Plugins you did not touch keep running.

[^pref]: The headings and controls of a promoted preference are known even while the settings plugin is off. Only the values are then the plugin's own defaults.

[^why]: Why this switch lasts only for the session: this plugin reads a file inside the directory the vault opens. The panel says **This switch resets when olai restarts**.

[^offdetail]: With the plugin off, settings olai has already applied stay in force, and every switch in the panel lasts only until olai restarts, which the panel says above its groups. You get the same when the file will not read. Pressing a switch that would write a lasting choice is refused with `Repair <file> before changing which tools run.` until you repair the file, and editing a setting is refused with `Settings can be edited when the configuration reader is running`.

<details>
<summary>What it says when a value will not do</summary>

One line for each thing it could not read, logged once.

| Line | What happened |
| --- | --- |
| `<file>: malformed settings file; every row uses its defaults` | the file itself would not read |
| `<file>: <row>.<key>: "<value>" uses its default — <why>` | one setting is not one that plugin accepts |
| `<file>: <row>.on: "<value>" uses its default — expected yes or no` | the `on` property is neither `yes` nor `no` |
| `<file>: <row>.on is ignored; this reader’s switch is session-only so the file cannot disable its own reader.` | the row names the vault, this plugin, or the plugin that reads the settings file's own kind |

</details>
