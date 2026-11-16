# The Plugins panel

The plugin inspector draws the **Plugins** panel: every plugin this olai server runs, one line each, with a switch, a note of anything wrong, and its settings.

A plugin is one part of olai you can switch on and off.

## Opening the panel

Click the health dot in the header, which says how olai is doing, and its list has a **Plugins** entry at the foot.[^door] The panel's header links `Settings.olai`, the file that records which plugins run.[^header] **New plugin**, above every group, asks an agent to write one for you ([../dynamic-plugins.md](../dynamic-plugins.md)).[^new]

## One line per plugin

A line is the plugin's name, a few words when something is wrong, and a switch named `Enable <name>`: `Enable Claude Code`.[^quiet] Click the arrow before a name to open that plugin's details.[^chevron][^words]

Lines are grouped, each heading counting what is in it: `5 on · 2 off`.[^groups][^grouporder]

| Group | What is in it |
| --- | --- |
| **Needs attention** | every plugin that failed, is waiting, is blocked or needs something from you |
| **Agents**, **Notes**, **Connections**, **Interface**, **Test fixtures** | the plugins that come with olai |
| **Your plugins** | the plugins written in the directory olai serves[^yours] |

## Switching one off

A switch writes to `_olai/Settings.olai`.[^settle] If other plugins stop with this one, a question names them.[^question] A switch olai cannot save wears a dashed outline.[^dashed]

## A plugin's settings

Each setting is a control in the plugin's details,[^detail] labelled with its key (`Watch held for`), and its description is the tip.[^controls] Press `Enter`, or move the keyboard focus out of the box, to save.[^save][^refused]

A setting the plugin marks as a preference is drawn in the Preferences panel instead ([preferences.md](preferences.md)).[^promoted]

## When the inspector is off

The **Plugins** entry, the panel and its switches go.[^serve]

[^door]: On a desktop, choosing the **Plugins** entry closes the health dot's list and opens the panel under the dot, and `Escape` puts the keyboard focus back on the dot. On a phone the same entry is in the sidebar drawer.

[^header]: The panel's header reads **Plugins**, and its link to the settings file is labelled **Open in Settings.olai**.

[^new]: The **New plugin** entry is the one thing in the panel that is not about what this server already runs. It closes the panel and opens the command palette at the two steps that ask an agent for a plugin of your own. It is drawn while the `vault-plugins` plugin offers that command and there is a palette to open, and is absent otherwise.

[^quiet]: A plugin that is on and working, or off because you left it off, shows nothing beyond its switch.

[^chevron]: A plugin with nothing to show has no arrow, and keeps the space so that the names line up.

[^words]: The words that can stand beside a name are `Failed`, `Can't start`, `Starting…`, `Needs approval`, `Failed in this tab`, `Starting in this tab` and `Needs setup`. Each one appears on the line, and the plugin's details spell out the whole sentence behind it. Both are in the closed block at the foot of this page.

[^groups]: A heading reads `5 on` where none is off. Every group except **Needs attention** starts closed, and a group you open stays open while the panel redraws. Pressing a switch opens the group that line is in, so a plugin that leaves **Needs attention** after a fix stays in view.

[^grouporder]: The **Needs attention** group comes first, open, with every line's details open. Groups with nothing to report are listed after the rest, and a group whose plugins are all off by olai's own default is not listed until one of them is switched on. The plugins that come with olai are grouped by the section each one is given.

[^yours]: A plugin written in the directory olai serves carries a link to its own page at `/plugins/<name>`, which is where its files, the changes to them and **Turn on** are. What its details hold here, and how approving it works, are in the closed block at the foot of this page.

[^settle]: Pressing a switch writes the change to `_olai/Settings.olai`, and the line waits while the server starts or stops the plugin to match.

[^question]: The question reads `Turning it off also stops Claude Code, Codex.`, with **Keep on** and **Turn off**. Clicking another line dismisses it.

[^dashed]: A switch olai cannot save says `Resets when olai restarts` to a pointer, and carries `This switch resets when olai restarts.` in its details. Where `Settings.olai` cannot be read at all, every switch is that kind and the panel says so above the groups: `Settings.olai can't be read, so switches here reset when olai restarts.` Settings that are broken are named, and have to be repaired before another press can be saved.

[^controls]: A setting's key is labelled in sentence case. Four choices or fewer are buttons, more are a drop-down list, yes or no is a switch, and text and numbers are a small box carrying their limits, their unit and the shape expected. A box's return key says **Done**, a number box asks for the numeric keyboard, and the boxes turn autocorrect, autocapitalization and spell-checking off.

    A plugin that is off keeps its settings editable, and a setting with no control of its own reads `This setting can't be changed here.`

[^save]: `Escape` puts the saved value back and leaves the panel open. A value the file sets wears a ● with the tip `set in Settings.olai`, and a ↺ beside it, labelled **Use default**, which deletes that setting from the file. A value olai is using as a default wears no mark.

[^refused]: Text the setting does not accept is drawn in an alarmed box, with the complaint and `· using <value>` under it, and **Use default** can take that setting out of the file. A value olai refuses never reaches the file, and the reason is drawn under the control.

    While olai cannot read the file, or is reconnecting, the controls freeze and their tips carry the server's reason. Your half-typed value and the keyboard focus stay where they are.

[^detail]: A plugin's details also hold the plugin's own controls, the environment variables it reads, its **Short name** and **Saved in**, each described in the closed block at the foot of this page. Another plugin can send you straight to one line: the watch wrench in [kolu.md](kolu.md) does. That plugin's group and details open, and the keyboard focus lands in its first control.

[^promoted]: The preference is drawn under a heading named after the plugin, and the line here shows **Set in Preferences** where its controls were. That link closes this panel and opens the preferences one.

    While the plugin is off, or the preferences plugin is off, the controls are drawn here as usual, so the setting is always reachable from one panel or the other. Where every one of a plugin's settings is a preference like this, arriving from elsewhere lands you in the preferences panel instead.

[^serve]: The server goes on running, starting and stopping plugins exactly as it does, and `_olai/Settings.olai` still says what runs.

<details>
<summary>The words on a line, and what the details say</summary>

| Words on the line | What the details say |
| --- | --- |
| `Failed` | `Failed to start. It said: “…”. Switch it off and on to try again.`, or `It gave no message.` where there was none |
| `Can't start` | `Can't start: another plugin it needs isn't running (…).` |
| `Starting…` | `Starting…` |
| `Needs approval` | the plugin's source code, for you to read and approve |
| `Failed in this tab` | `In this tab: failed to start.` and the message, with **Try again** |
| `Starting in this tab` | `In this tab: still starting (needs …).`, or `Not started in this tab yet.` |
| `Needs setup` | the plugin's own sentence and its own button: mail asking you to connect an account, or an agent whose command line tool is not installed |

Where a plugin's browser part cannot be restarted on the spot, the details read `Reload the page to fix this. Save any unfinished edits first.` and offer **Reload** instead of **Try again**.

</details>

<details>
<summary>What else a plugin's details hold</summary>

| Part | What it is |
| --- | --- |
| the plugin's own controls | what that plugin asks of you, in its own words and with its own buttons |
| the environment variables it reads | each one labelled by its description, showing its value or **Not set**, and naming the variable. A secret shows only **Set** or **Not set** |
| **Short name** | the name you type in the settings file, drawn where the line shows a different one |
| **Saved in** | a link to this plugin's entry in `Settings.olai` |

</details>

<details>
<summary>Approving a plugin written in the directory olai serves</summary>

The details here hold the plugin's source code, and two buttons for working down a whole server's plugins: **Approve this version** and **Approve always**. The plugin is marked ` (not approved)` until you press one of them.

If the plugin's folder is edited while you are reading it, both buttons stop working and the block says `This changed while you were reading it. Above is what it says now.` **I have read it** makes them work again on what is now on screen. Both buttons send back the version they showed you, so neither can approve source code that changed meanwhile.

> Approving a plugin belongs to the `vault-plugins` plugin ([vault-plugins.md](vault-plugins.md)). With its browser part absent, an approval is refused and nothing is approved; the rest of this panel keeps working.

</details>

<details>
<summary>The Server section</summary>

Last in the panel, starting closed, with the machine's name in its heading.

| Field | What it says |
| --- | --- |
| **Address** | the host and port this server answers on |
| **Machine name** | the name of the machine it runs on |
| **Log format**, **Log level** | the server's own settings, with the same controls as a plugin's |
| **Allowed origins** | the websites a browser may call this server from, or **None** |
| **Access token** | **Set** or **Not set**. The token itself is never drawn |
| **State folder** | `$XDG_STATE_HOME/olai` |
| **Saved in** | a link to the server's entry in `Settings.olai` |

</details>
