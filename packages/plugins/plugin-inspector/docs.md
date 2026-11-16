# Plugin inspector

The plugin inspector draws the **Plugins** panel: every plugin this serve has, one line each, with a switch, a word about anything wrong, and its settings.

## Opening the panel

The door is the health dot in the header: its popover carries a **Plugins** row at the foot.[^door] The panel's header links `Settings.olai`.[^header] Above every group stands **New plugin**, which asks an agent for one of your own ([../dynamic-plugins.md](../dynamic-plugins.md)).[^new]

## One line per plugin

A line is the plugin's name, a few words when something is wrong, and a switch called `Enable <name>` — `Enable Claude Code`.[^quiet] A chevron before the name opens the row's detail,[^chevron] and a word can stand beside it.[^words]

Rows are grouped, each heading counting what is in it — `5 on · 2 off`.[^groups]

| Group | What is in it |
| --- | --- |
| **Needs attention** | everything failed, waiting, blocked or asking for you |
| **Agents**, **Notes**, **Connections**, **Interface**, **Test fixtures** | the plugins the build ships |
| **Your plugins** | the plugins this directory defines[^yours] |

## Switching one off

A switch writes to `_olai/Settings.olai` and waits for the serve to settle. Where other plugins stop with this one, a question names them.[^question] A switch that cannot be written wears a dashed ring.[^dashed]

## A plugin's settings

Each setting is a control in the row's detail, labelled by its key (`Watch held for`), with the schema's description as its tip.[^controls] Press `Enter`, or move out of the box, to save.[^save] The rest of the detail is below.[^detail]

A setting a plugin marks as a preference is drawn in the preferences panel instead ([preferences.md](preferences.md)).[^promoted]

## When the inspector is off

The **Plugins** door, the panel and its switches go.[^serve]

[^door]: On a desktop, picking the **Plugins** row shuts the popover and opens the panel under the dot, and `Escape` hands the caret back to the dot. On a phone the same row is in the drawer.

[^header]: The panel's header reads **Plugins**, and its link to `Settings.olai` is labelled **Open in Settings.olai**.

[^new]: The **New plugin** entry is the one thing in the panel that is not about what this serve already runs. It shuts the panel and opens the palette at the two levels that ask an agent for a plugin of your own. It is drawn while `vault-plugins` offers the verb and there is a palette to open, and absent otherwise.

[^quiet]: A plugin that is on and well, or off because you left it off, says nothing beyond its switch.

[^chevron]: A row with nothing to reveal has no chevron, and keeps its space so the names line up.

[^words]: The words are `Failed`, `Can't start`, `Starting…`, `Needs approval`, `Failed in this tab`, `Starting in this tab` and `Needs setup`. Each is drawn on the line, with the sentence it stands for in the row's detail. They, and what each detail says, are in the closed block at the foot of this page.

[^groups]: A heading reads `5 on` where none is off. Groups other than **Needs attention** start shut, and a group you open stays open while the panel redraws. Pressing a switch opens the group the row is in, so a row that leaves **Needs attention** after a fix stays in view. Quiet groups sort after the rest, and a group whose rows are all off by the build's own default is not listed until one of them is switched on.

    The **Needs attention** group comes first, open, with every row's detail open. The build's plugins are grouped by the section each is given.

[^yours]: A plugin this directory defines carries a link to its own page at `/plugins/<word>`, which is where its files, its diff and **Turn on** are. What its detail holds here, and how approving it works, are in the closed block at the foot of this page.

[^question]: The question reads `Turning it off also stops Claude Code, Codex.`, with **Keep on** and **Turn off**. Pressing another row dismisses it.

[^dashed]: A switch that cannot be written says `Resets when olai restarts` to a pointer, and carries `This switch resets when olai restarts.` in its detail. Where `Settings.olai` cannot be read at all, every switch is that kind and the panel says so above the groups: `Settings.olai can't be read, so switches here reset when olai restarts.` Settings that are broken are named, and must be repaired before another lasting press can write.

[^controls]: A key is labelled in sentence case. Four choices or fewer are buttons, more are a select, yes-or-no is a switch, and text and numbers are a compact box carrying their bounds, unit and expected shape. A box's return key says **Done**, a number box asks for the numeric keyboard, and the boxes turn autocorrect, autocapitalization and spell-checking off.

    A row that is off keeps its settings editable, and a setting with no control of its own reads `This setting can't be changed here.`

[^save]: `Escape` puts the accepted value back and leaves the panel open. A value the file sets wears a ● with the tip `set in Settings.olai`, and a ↺ beside it, labelled **Use default**, which deletes the property. A default wears no mark.

    Text the schema refuses is drawn in an alarmed box, with the complaint and `· using <value>` under it, and the reset can take that property out. A value olai refuses never reaches the file; its reason is drawn under the control.

    With no reader, a broken file or a reconnect, the controls freeze with the serve's refusal in their tips. Your draft and caret stay.

[^detail]: A row's detail also holds the plugin's own face, the environment it reads, its **Short name** and **Saved in**, each described in the closed block at the foot of this page. Another plugin can send you straight to one row: [kolu.md](kolu.md)'s watch wrench does. That row's group and detail open and the caret lands in its first control.

[^promoted]: The preference is drawn under a heading named after the plugin, and the row shows **Set in Preferences** where the controls were. That link shuts this panel and opens that one.

    While the plugin is off, or the preferences plugin is, the controls are drawn here as usual, so the setting is always reachable from one panel or the other. Where every one of a row's settings is a promoted preference, arriving from elsewhere lands you in the preferences panel instead.

[^serve]: The serve goes on running, starting and stopping plugins exactly as it does, and `_olai/Settings.olai` still says what runs.

<details>
<summary>The words on a line, and what the detail says</summary>

| Words on the line | What the detail says |
| --- | --- |
| `Failed` | `Failed to start. It said: “…”. Switch it off and on to try again.`, or `It gave no message.` where there was none |
| `Can't start` | `Can't start: another plugin it needs isn't running (…).` |
| `Starting…` | `Starting…` |
| `Needs approval` | the plugin's source, for you to read and approve |
| `Failed in this tab` | `In this tab: failed to start.` and the message, with **Try again** |
| `Starting in this tab` | `In this tab: still starting (needs …).`, or `Not started in this tab yet.` |
| `Needs setup` | the plugin's own sentence and its own button: mail asking you to connect an account, an agent whose command line tool is not installed |

Where a browser half cannot be restarted on the spot, the detail reads `Reload the page to fix this. Save any unfinished edits first.` and offers **Reload** instead of **Try again**.

</details>

<details>
<summary>What else a row's detail holds</summary>

| Part | What it is |
| --- | --- |
| the plugin's own face | what that plugin asks of you, in its own words and with its own buttons |
| the environment it reads | each reading labelled by its description, showing its value or **Not set**, and naming its variable. A secret shows only **Set** or **Not set** |
| **Short name** | the name you type in the settings file, drawn where the line reads by a different one |
| **Saved in** | a link to this plugin's node in `Settings.olai` |

</details>

<details>
<summary>Approving a plugin this directory defines</summary>

The detail here holds the source and the same two verbs for somebody working down a whole serve's rows: **Approve this version** and **Approve always**, marked ` (not approved)` until you say otherwise.

If the folder is edited while you are reading it, both verbs disarm and the block says `This changed while you were reading it. Above is what it says now.` **I have read it** arms them again on what is now on screen. Both doors send back the version they drew, so neither can approve source that moved.

> Approving a plugin belongs to the `vault-plugins` plugin ([vault-plugins.md](vault-plugins.md)). With its browser half absent, an approval is refused and nothing is approved; the rest of this panel keeps working.

</details>

<details>
<summary>The Server section</summary>

Last in the panel, starting shut, with the machine's name in its heading.

| Field | What it says |
| --- | --- |
| **Address** | the host and port this serve answers on |
| **Machine name** | the name of the machine it runs on |
| **Log format**, **Log level** | the serve's own settings, with the same controls as a plugin's |
| **Allowed origins** | the origins a browser may call from, or **None** |
| **Access token** | **Set** or **Not set**. The token itself is never drawn |
| **State folder** | `$XDG_STATE_HOME/olai` |
| **Saved in** | a link to the serve's node in `Settings.olai` |

</details>
