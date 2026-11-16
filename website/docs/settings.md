# Choose what runs

olai is a bundle of plugins: the outliner, the sidebar, git, the journal,
search, chat and the appliances beside them. This page is how you switch one
on or off, where each setting lives, and what a plugin being off actually
means.

## The three doors

| Door | What it holds | Where it lives |
| --- | --- | --- |
| the directory | every policy knob, including which plugins run | `_olai/Settings.olai`, in git |
| the environment | credentials and machine resources | the process environment, a wrapper, or `environmentFile` |
| this browser | how this tab reads | the Preferences gear, in local storage |

The first is shared by everyone using the directory. The second is the
machine's. The third is yours alone, and no server has an opinion on it: theme,
typeface, size, row density and whether finished work shows.

Beside them, each plugin has one machine-local record for its own private
state, at `$XDG_STATE_HOME/olai/<plugin>/<hash>.json`, where `hash` names the
served directory's real path. The plugins panel names that folder and never
opens it. Chat keeps the open agent, model and doorbells there, so switching
chat off and on returns the same snapshot.

## Switch a plugin on or off

| Way | Lasts | Who sees it |
| --- | --- | --- |
| the switch on a row of the plugins panel | until you change it: the switch writes the file | everyone on this directory |
| `on: yes` or `on: no` on the plugin's node in `_olai/Settings.olai` | until you change it | everyone on this directory |
| the session-only switch, which the vault and settings-reader rows carry | this serve | everyone on this directory |

The first two are one choice, not two: the panel's switch writes `on` to the
file through the ordinary write door, and a restart reads the file again. So
nothing wins over anything; the file is the answer. A session-only switch is
the exception, and it exists so the panel cannot lock its own settings reader
out. Those rows wear a dashed ring and say `This switch resets when olai
restarts.`

Use one top-level node per plugin:

```jsonl
{"id":"spaces","ord":"a0","title":"xyne-spaces","custom":{"on":"yes"}}
{"id":"journal","ord":"a1","title":"journal","custom":{"on":"no"}}
{"id":"chat","ord":"a2","title":"chat","custom":{"idle-ms":"1200000"}}
```

`on: yes` enables a plugin this build ships off; `on: no` disables one. An
absent choice uses the build's default. The chat example shortens the default
48-hour idle window, `172800000` ms, to 20 minutes.

Some facts about a switch:

- A press moves the running server. Turn kolu off and its rows stop being
  drawn, its row leaves the health popover and the words it taught the
  directory go back to being ordinary text. No reload, no restart.
- Every browser on this server follows the flip, which is why these rows are
  not on the preferences panel with the theme.
- Turning a plugin off takes its dependants with it, and the panel names them
  before **Off** moves. Switching chat off leaves every engine, every doorbell
  and the mirror `waiting`.
- An agent cannot touch it. The verb is on the browser's face only, so nothing
  reachable over `/mcp` can switch a plugin off, and an agent write cannot
  change `on`.
- There is no command-line verb for it, and no `--dump-config`: the panel is
  the table.

## Read the plugins panel

Open it from the **Plugins** row at the foot of the health-dot popover, or at
the foot of the phone's sidebar drawer. It is a list of collapsible groups,
each heading with a count: **Needs attention** first, open whenever a row needs
a person, then the sections the build names, then **Your plugins**, then
**Server**. Every other group starts closed.

Each row is one line: the plugin's name, a short status only when it is stuck,
and a switch named after the row, as in `Enable Git`. Click the name to expand
the row: a sentence about its state, whatever the plugin shows there, its
knobs, its environment readings, and `Saved in`, a link to its node in the
settings file.

A plugin the directory defines carries a link to its own page instead of its
source, and that page is where you read it and turn it on.

At the top of the panel, above every group, is **New plugin**. It shuts the
panel and opens the palette at the levels that ask an agent for a plugin of
your own. The whole of that is [dynamic-plugins.md](dynamic-plugins.md): what
you type, what lands in `plugins/`, and what you read first.

| Status | What it means |
| --- | --- |
| `Failed` | it was asked for and its start failed; the row quotes what the plugin said |
| `Needs approval` | the directory defines it and nobody has turned it on yet |
| `Starting…`, `Starting in this tab` | still coming up |
| `Can't start` | it is waiting on a service nobody provides, named on the row |
| `Failed in this tab` | the browser half did not load; the detail offers **Try again** or **Reload** |
| `Needs setup` | it is running and wants something from you |

A row that is simply running draws no sentence: the switch has said it. Knob
labels come from the setting's own keys and their descriptions are tooltips. A
● marks a value authored in the file, with `set in Settings.olai` on its
tooltip, and ↺ removes the property. `Enter` or a click away saves; `Escape`
reverts a draft without closing the panel.

The **Server** section at the bottom edits Log level and Log format
([running.md](running.md#logging)). Its other lines are read-only: Address,
Machine name, Allowed origins, Access token (`Set` or `Not set`, never the
value), State folder and Saved in.

### When the panel will not let you edit

| What you see | What to do |
| --- | --- |
| frozen knobs, tooltip `Settings can be edited when the configuration reader is running` | switch the settings reader back on with its session switch |
| frozen knobs, tooltip `Repair _olai/Settings.olai before changing settings` | fix the named file; a durable switch cannot write until you do |
| a refusal at the control itself | the value failed the setting's own validation and the file is unchanged |

An invalid value in the file defaults and warns once, and the knob shows the
refused text with the message and the effective default beneath it. A broken
line defaults every plugin and names the broken file on the panel.

## Settings that live in Preferences instead

A plugin may mark one of its settings as a preference, and the Preferences gear
draws it under a heading named after the plugin: `git`'s `commit` and `push`,
and `mail`'s `poll`. Those rows still write `_olai/Settings.olai` for everyone
using the directory, and each run of groups closes with a line saying so.

While the plugin runs, the plugins panel shows one **Set in Preferences** link
in place of those knobs. Switch the plugin off, or disable the preference row,
and the controls come back to the plugins panel.

## The git policy

Whether writes record themselves, and whether commits push, is policy of the
directory. Set it on the `git` node:

```jsonl
{"id":"git","ord":"a0","title":"git","custom":{"commit":"auto","push":"off"}}
```

| Key | Values | Default |
| --- | --- | --- |
| `commit` | `off`, `manual`, `auto` | `manual` |
| `push` | `off`, `auto` | `off` |

They are independent. Auto-commit records everything waiting after fifteen
quiet seconds, including writes made with no browser open. Auto-push follows
every commit olai makes. [git.md](git.md) is what the panel does with them.

Switching the git plugin off removes the ledger, the Commit row and the tools.
Setting `commit: off` keeps a ledger that has been told not to record.

## How soon an edit applies

A few plugins follow the file live, keeping their state: git, kolu and mail.
git's ledger reads the new `commit` and `push` at its next decision, so an open
commit panel stays open. Every other plugin restarts on a settings change: the
server mounts it afresh and every open tab follows.

A plugin that needs a tool the machine lacks stays unavailable with the reason
on its row, and nothing else is affected. Two plugins offering the same service
is a failure for the second, named with both plugins and the service, and the
first keeps running.

## What being off means

A server with a plugin off is not a degraded server, and the health dot stays
green. The plugin's members are not on the wire, its browser half is never
mounted, it hangs no row in the health popover, it probes for nothing, and the
kinds it would have taught the directory validate as ordinary text
([live-properties.md](live-properties.md)). The outline it would have owned is
an ordinary outline.

It is the same nothing whichever door turned it off. A plugin disabled in the
file and one you switched off a minute ago are one state: registrations are
undone as it goes, so what is left is absence rather than a disabled copy.

| Plugin off | What goes | What stays |
| --- | --- | --- |
| git | the ledger, the Commit row, its tools | every write, unrecorded |
| journal | the calendar, `/today`, day pages, Agenda and its badge | the `date` and `repeat` fields in your files |
| search | the index and every ranked answer | the grammar, the box and the `search_nodes` tool, each answering with no hits and the reason |
| chat | the conversation | nothing of its own; its engines, doorbells and the mirror stand `waiting` |
| files | its browser and creation controls | the file metadata other plugins read to open content |

## Plugins the directory itself defines

A plugin can arrive from the served directory, asked for by you and written by
an agent while olai is running. It is a folder under `plugins/`, and the whole
of it is [dynamic-plugins.md](dynamic-plugins.md); what belongs here is what
the panel does with one.

- It sits under **Your plugins**, below the built-in rows, with the same
  switch, the same states and the same containment when its code throws.
- Nothing mounts until you turn it on with the source in front of you, which
  happens on the plugin's own page. Its row here links to that page.
- An approval names a version, a hash of the two code files, so an edit to
  either one pauses the plugin. You approve it, and an agent cannot approve the
  plugin it has just written.
- `on` and `approved` are properties on the plugin's node in this same file, so
  the switch survives a restart and a folder copied in arrives off.
- A folder named after a built-in plugin is a fault, named on the row and the
  page, rather than an override.

## Environment variables

These supply credentials and machine resources. Settings that belong to the
directory, such as identity headers and logging, are in the file instead. The
plugins panel shows a secret as `Set` or `Not set` and never its value.

| Name | What it supplies |
| --- | --- |
| `OLAI_AGENT_PATH` | the engine search path; empty searches nowhere |
| `KOLU_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI` | adapter executables, normally supplied by the packaging |
| `CODEX_CONFIG` | a JSON overlay merged into the Codex session config on every spawn |
| `OLAI_BROWSER_MCP` | the absolute Playwright MCP executable; empty omits the browser tools |
| `OLAI_BROWSER_CHROMIUM` | the absolute Chromium olai runs; empty gives each conversation its own browser |
| `OLAI_BROWSER_CHROMIUM_SANDBOX` | `chromium` (default) or `container`; anything else fails the launch with a sentence |
| `OLAI_ODU_BIN` | a directory put first on the appliance's `PATH`; empty switches the pin off |
| `ODU_WEB_ORIGIN` | the odu service origin to dial; default `http://127.0.0.1:18440` |
| `OLAI_HIMALAYA` | the `himalaya` the mail plugin runs |
| `OLAI_MAIL_OAUTH_CLIENT`, `OLAI_MAIL_OAUTH_SECRET` | the Google OAuth client id and secret for a mailbox |
| `OLAI_MAIL_GOOGLE` | the Google origin this server talks to; loopback only, because the requests carry the secret |
| `OLAI_SPACES_URL`, `OLAI_SPACES_TOKEN` | the Spaces origin and its installed-app token |
| `PADI_SOCKET` | the local kolu socket path |
| `OLAI_ALLOWED_ORIGINS` | browser origins to admit, comma-separated |
| `OLAI_HOSTNAME` | the machine label the page shows |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, other provider keys | secrets the agents inherit |
| `OLAI_TOKEN` | the bearer the terminal client sends ([connecting-agents.md](connecting-agents.md)) |

An explicit path is never guessed from its spelling. In a row's environment
readings, a path the packaging supplied reads `·wrapper` and one you set reads
`·env`.
