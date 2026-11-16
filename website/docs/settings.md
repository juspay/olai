# Switch olai's plugins on and off

olai is built out of plugins, separate parts you can switch on and off.[^parts]
This page is how you switch one, and where each setting is kept.

## Where a setting is kept

| Where | What it holds | The place itself |
| --- | --- | --- |
| the directory olai serves | which plugins run, and every other policy | `_olai/Settings.olai`, a file kept in git |
| the machine | credentials and what the machine provides | the environment olai starts with, from a wrapper or `environmentFile` |
| this browser | how this tab looks and reads | the Preferences gear, in this browser's local storage |

Everyone using the directory shares the first. The second belongs to the
machine; the third is yours alone.[^prefs]

## Switch a plugin on or off

| How you switch it | How long it lasts |
| --- | --- |
| the switch on the plugin's row in the plugins panel | until you change it again |
| `on: yes` or `on: no` on the plugin's node in the settings file | until you change it again |
| the switch on the directory's row and the settings reader's row | until the server restarts |

The first two are one choice, not two.[^file] Give each plugin its own
top-level node in `_olai/Settings.olai`:

```jsonl
{"id":"spaces","ord":"a0","title":"xyne-spaces","custom":{"on":"yes"}}
{"id":"journal","ord":"a1","title":"journal","custom":{"on":"no"}}
{"id":"chat","ord":"a2","title":"chat","custom":{"idle-ms":"1200000"}}
```

`on: yes` starts a plugin that this build leaves off, and `on: no` stops a
plugin from starting.[^nodes]

## Read the plugins panel

Click the dot in the header, then the **Plugins** row at the foot of the
list.[^panel] Click a plugin's name to open its row.[^row] **New plugin**
sits above every group.[^new]

## Decide when git records your writes

Whether olai commits your writes for you, and whether it pushes, is set on the
directory's `git` node:

```jsonl
{"id":"git","ord":"a0","title":"git","custom":{"commit":"auto","push":"off"}}
```

| Key | Values | Default |
| --- | --- | --- |
| `commit` | `off`, `manual`, `auto` | `manual` |
| `push` | `off`, `auto` | `off` |

You set the two separately.[^git]

## What a plugin being off means

A plugin that is off does nothing, and that is not a fault: the dot in the
header stays green.[^off][^door]

[^parts]: olai's plugins include the outliner, the sidebar, git, the journal,
    search, chat and the integrations beside them. The served directory can
    also define plugins of its own: the closed block at the foot of this page
    says what the panel does with one, and
    [dynamic-plugins.md](dynamic-plugins.md) is the whole subject.

[^prefs]: What this browser holds is yours alone, and no server has an opinion
    on it: the theme, the typeface, the text size, how tightly rows are packed
    and whether finished work is shown.

    Besides those three places, each plugin keeps its own private state in one
    file on this machine, at `$XDG_STATE_HOME/olai/<plugin>/<hash>.json`, where
    `hash` stands for the real path of the directory olai serves. The plugins
    panel names that folder and never opens it. Chat keeps the open agent, the
    model and the doorbells there, so switching chat off and on again brings
    the same state back.

[^file]: Everyone using the directory sees all three switches. The switch in
    the panel writes `on` into the settings file, the same way any other write
    happens, and a restart reads the file again. So neither overrides the
    other: the file is the answer. The exception is the switch that lasts one
    run, which exists so that the panel cannot switch off the plugin that
    reads its settings and leave itself stuck. Those rows
    have a dashed ring and say `This switch resets when olai restarts.`

[^nodes]: A plugin with no `on` property uses the build's default. The chat
    example above shortens the time chat waits before it calls a conversation
    idle, from the default 48 hours (`172800000` ms) to 20 minutes.

[^panel]: On a phone, the **Plugins** row is at the foot of the sidebar drawer
    instead. The panel is a list of groups you can fold, each heading carrying
    a count. **Needs attention** comes first and is open whenever a row needs a
    person; then come the groups this build names, then **Your plugins**, then
    **Server**. Every group other than **Needs attention** starts folded.

[^row]: A row is one line: the plugin's name, a short status when it is stuck,
    and a switch named after it, such as `Enable Git`. Open the row and you
    also see a sentence about its state, anything the plugin itself draws
    there, its settings, what it found in the environment, and `Saved in`, a
    link to its node in the settings file.

    A plugin that the directory defines links to its own page rather than to
    its source code, and you read it and switch it on there.

[^new]: Pressing **New plugin** shuts the panel and opens the palette at the
    commands that ask an agent to write a plugin for you. The whole subject is
    [dynamic-plugins.md](dynamic-plugins.md): what you type, what the agent
    puts in the `plugins/` folder, and what to read before you switch it on.

[^git]: With `commit: auto`, olai commits everything waiting once the
    directory has been quiet for fifteen seconds, including writes made with no
    browser open. With `push: auto`, olai pushes after every commit it makes.
    [git.md](git.md) is what the commit panel does. Switching the git plugin
    off takes away the list of waiting writes, the Commit row and git's tools,
    while `commit: off` keeps that list and records nothing.

[^off]: A plugin that is off adds no tools for agents to call, draws nothing in
    the browser, and has no line in the list the dot opens. It checks for
    nothing on the machine. The property kinds it would have taught the
    directory count as ordinary text
    ([live-properties.md](live-properties.md)), and an outline it would have
    owned is an ordinary outline.

[^door]: A plugin you switched off a minute ago and one the settings file
    disables are in the same state. As a plugin goes, everything it registered
    is undone, so what is left is the plugin's absence rather than a
    switched-off copy of it.

<details>
<summary>What a switch does, and what it cannot do</summary>

- A press changes the running server at once, with no reload and no restart.
  Switch the kolu plugin off and it stops drawing its rows, its line leaves the
  list the dot opens, and the words it taught the directory go back to being
  ordinary text.
- Every browser connected to this server follows the change, which is why
  these switches are not on the Preferences panel beside the theme.
- Switching a plugin off also switches off the plugins that depend on it, and
  the panel names them before the switch moves to **Off**. Switch chat off and
  olai leaves every engine, every doorbell and the mirror `waiting`. An engine
  is the plugin that runs one agent. A doorbell messages a conversation when a
  file changes, and the mirror posts a conversation into a Xyne Spaces channel.
- An agent cannot do any of this. The switch exists in the browser only, so
  nothing reaching the server over `/mcp` can switch a plugin off, and an
  agent's write cannot change `on`.
- There is no command for it and no `--dump-config`: the panel is where you
  read and change what runs.

</details>

<details>
<summary>Every status a row can show, and when the panel will not let you edit</summary>

| Status | What it means |
| --- | --- |
| `Failed` | it was asked for and its start failed; the row quotes what the plugin said |
| `Needs approval` | the directory defines it and nobody has turned it on yet |
| `Starting…`, `Starting in this tab` | still coming up |
| `Can't start` | it is waiting on a service nobody provides, named on the row |
| `Failed in this tab` | the browser half did not load; the detail offers **Try again** or **Reload** |
| `Needs setup` | it is running and wants something from you |

A row that is simply running says nothing extra: the switch has already said
it. The label on a setting comes from the setting's own key, and its
description is the tooltip. A ● marks a value written in the settings file,
with `set in Settings.olai` on its tooltip, and ↺ removes the property.
`Enter`, or a click elsewhere, saves; `Escape` throws away what you typed
without closing the panel.

The **Server** section at the bottom edits Log level and Log format
([running.md](running.md#logging)). Its other lines you can read but not
change: Address, Machine name, Allowed origins, Access token (shown as `Set`
or `Not set`, never the value itself), State folder and Saved in.

### When the panel will not let you edit

| What you see | What to do |
| --- | --- |
| the settings are frozen, with the tooltip `Settings can be edited when the configuration reader is running` | switch the settings reader back on with the switch on its row |
| the settings are frozen, with the tooltip `Repair _olai/Settings.olai before changing settings` | fix the file it names; until you do, no switch can write to it |
| the control itself refuses what you typed | the value failed that setting's own validation, and the file is unchanged |

A value in the file that olai cannot accept falls back to the default and is
warned about once; the control then shows the refused text, the message and
the default now in force beneath it. One broken line in the file sends every
plugin back to its default, and the panel names the broken file.

</details>

<details>
<summary>Settings shown in Preferences, and how soon an edit takes effect</summary>

A plugin can mark one of its settings as a preference, and the Preferences
gear then shows it under a heading named after the plugin: git's `commit` and
`push`, and the mail plugin's `poll`. Those controls still write
`_olai/Settings.olai` for everyone using the directory, and each run of groups
ends with a line saying so.

While that plugin runs, the plugins panel shows a **Set in Preferences** link
where those settings would be. Switch the plugin off, or stop showing the
setting in Preferences, and the controls come back to the plugins panel.

Three plugins pick up a change to the file while they run, keeping what they
were doing: git, kolu and mail. The git plugin reads the new `commit` and
`push` the next time it decides whether to record, so an open commit panel
stays open. Every other plugin restarts when its settings change: the server
starts it again and every open tab follows.

A plugin that needs a program this machine does not have stays unavailable,
with the reason on its row, and nothing else is affected. If two plugins offer
the same service, the second one fails, with both plugin names and the service
named on its row, and the first keeps running.

</details>

<details>
<summary>What each plugin takes with it when you switch it off</summary>

| Plugin off | What goes | What stays |
| --- | --- | --- |
| git | the list of waiting writes, the Commit row, git's tools | every write you made, unrecorded |
| journal | the calendar, `/today`, day pages, Agenda and its badge | the `date` and `repeat` properties in your files |
| search | the index and every ranked answer | the search grammar, the search box and the `search_nodes` tool, each answering with no hits and the reason |
| chat | the conversation | nothing of its own; its engines, doorbells and the mirror are left `waiting` |
| files | its file browser and its controls for making files | the file information other plugins read to open content |

</details>

<details>
<summary>Plugins the directory itself defines</summary>

The directory olai serves can bring its own plugin: one you asked for and an
agent wrote while olai was running. It is a folder under `plugins/`, and
[dynamic-plugins.md](dynamic-plugins.md) is the whole subject. What belongs
here is what the plugins panel does with one.

- It sits under **Your plugins**, below the built-in rows, with the same
  switch, the same states, and the same containment when its code throws an
  error.
- Nothing of it runs until you switch it on with its source code in front of
  you, which happens on the plugin's own page. Its row here links to that
  page.
- Approving it approves one version, identified by a hash of its two code
  files, so editing either file pauses the plugin until you approve it again.
  Only a person approves a plugin: an agent cannot approve the plugin it has
  just written.
- `on` and `approved` are properties on the plugin's node in this same
  settings file, so a switch survives a restart, and a plugin folder you copy
  in arrives switched off.
- A folder named after a built-in plugin does not replace it. olai treats it
  as a fault and says so on the row and on the page.

</details>

<details>
<summary>Every environment variable olai reads</summary>

These variables carry credentials and say what this machine provides.
Settings that belong to the directory, such as the identity headers and the
log level, live in the settings file instead. The plugins panel shows a secret
as `Set` or `Not set` and never shows the value.

| Name | What it supplies |
| --- | --- |
| `OLAI_AGENT_PATH` | where olai looks for agent programs; empty means it looks nowhere |
| `KOLU_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI` | the adapter programs olai runs, normally supplied by the packaging |
| `CODEX_CONFIG` | JSON merged into the Codex session configuration each time olai starts Codex |
| `OLAI_BROWSER_MCP` | the full path of the Playwright MCP program; empty leaves out the browser tools |
| `OLAI_BROWSER_CHROMIUM` | the full path of the Chromium olai runs; empty gives each conversation its own browser |
| `OLAI_BROWSER_CHROMIUM_SANDBOX` | `chromium` (default) or `container`; any other value fails the launch with a message |
| `OLAI_ODU_BIN` | a directory put first on the odu program's `PATH`; empty switches off the version olai pins, leaving the `PATH` to decide |
| `ODU_WEB_ORIGIN` | the address of the odu service to call; default `http://127.0.0.1:18440` |
| `OLAI_HIMALAYA` | the `himalaya` program the mail plugin runs |
| `OLAI_MAIL_OAUTH_CLIENT`, `OLAI_MAIL_OAUTH_SECRET` | the Google OAuth client id and secret for a mailbox |
| `OLAI_MAIL_GOOGLE` | the Google address this server talks to; loopback only, because these requests carry the secret |
| `OLAI_SPACES_URL`, `OLAI_SPACES_TOKEN` | the Xyne Spaces address and its installed-app token |
| `PADI_SOCKET` | the path of the local kolu socket |
| `OLAI_ALLOWED_ORIGINS` | the browser origins to admit, separated by commas |
| `OLAI_HOSTNAME` | the machine name the page shows |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, other provider keys | secrets the agents olai starts inherit |
| `OLAI_TOKEN` | the token the terminal client sends ([connecting-agents.md](connecting-agents.md)) |

A path you set is used as written, never guessed from how it is spelt. Where a
row lists what it found in the environment, a path the packaging supplied
reads `·wrapper` and one you set reads `·env`.

</details>
