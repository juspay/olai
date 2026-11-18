# The words a plugin declares itself with

The words a plugin uses to declare itself, in its server code and in its browser code.[^contract]

Each entry says what the word means, what it carries, and what leaving it out costs.

| Word | What it is |
| --- | --- |
| [`name`](#name) | the plugin's one word, such as `kolu` |
| [row](#row) | its line in the list of plugins this build has |
| [fiber](#fiber) | one mounted plugin, and whether it is running |
| [service, `needs`](#service-and-needs) | what olai hands a plugin, and what the plugin asks for |
| [`surface`, member](#surface-and-member) | the calls this plugin answers over the connection |
| [`faces`](#faces) | which callers may make which of those calls |
| [`writes`, `resources`, `tools`, `charter`](#writes-resources-tools-and-charter) | the rest of what a plugin registers with its calls |
| [import subpath](#import-subpath) | what another package may import from this one |
| [`probe`](#probe) | is this plugin's tool installed on this machine? |
| [kind](#kind) | a word the plugin teaches the directory about property values |
| [claim](#claim) | the property key that kind takes for itself |
| [dressing](#dressing) | what the plugin draws beside such a value |
| [row actions](#row-actions) | what it adds to the menu on an outline row |
| [chrome](#chrome) | its component in the header bar at the top of the app |
| [mount](#mount) | its own component in the body of the page |
| [mark](#mark) | its logo |
| [`Deliveries`](#deliveries) | sending a message into a conversation with an agent |
| [`wake`](#wake) | this plugin's wording for the control that turns that on |
| [watching](#watching) | being told what happened in a conversation |
| [local state](#local-state) | one record file and one directory per plugin |
| [offer](#offer) | a service the plugin provides to other plugins |
| [engine](#engine) | a coding agent olai can run |
| [slot](#slot) | a named place in the page the plugin may draw in |
| [`environment`, `config`](#environment-and-config) | the variables and settings it reads |
| [roster, licence](#roster-and-licence) | which plugins run, and what is allowed to draw |

[^contract]: Where the contract lives: the TypeScript types under `packages/plugin-api/src/` are the contract itself, and [plugin-system.md](plugin-system.md) explains why it has this shape.

<details>
<summary>The name, the registry row, and the services a plugin asks for</summary>

### `name`

The plugin's one word, such as `"kolu"`.

The same word is the plugin's `id` in the registry, the prefix every one of its calls answers under, the name of its fiber, the name its settings are kept under, and the address of its page, `website/docs/plugins/<name>.md`. Every service that keys things by plugin reads the name off the fiber, so a plugin can never register something in another plugin's name.

### row

One entry in `packages/bundle/olai.yml`, the file listing every plugin this build has: the plugin's `id`, the module the loader mounts, and the columns that place it on the plugins panel, which is where a person switches plugins on and off. The module is named as a string and only looked up when it mounts, so whether a plugin is present is decided while olai runs. The columns are in [adding-a-plugin.md](adding-a-plugin.md).

### fiber

One mounted plugin. Whoever asks sees one of four words: `running`, `waiting`, `failed` and `off`.

### service and `needs`

A service is something olai hands a plugin, such as the served directory or the clock. A plugin reaches one by yielding an Effect tag for it. `needs` is the array of those tags the plugin declares: the runtime waits until each one is there before the plugin starts, and the compiler refuses a plugin that yields a tag it did not declare.

| Tag | What it gives |
| --- | --- |
| `Vault` | the served directory, its revisions and the inbox registry |
| `Ops` | the write gate and the typed write verbs |
| `Kinds` | teach the directory a word for a kind of property value |
| `Surfaces` | put this plugin's calls on the connection |
| `Wakes` | declare the wording of the control that turns delivery on |
| `Deliveries` | send a message into a conversation |
| `Watching` | be told what a conversation did |
| `SessionStart` | be asked a probe each time a conversation opens |
| `Agents` | offer a coding agent olai can run |
| `LocalState` | one record file and one directory beside the served directory |
| `Offers` | stand behind one of olai's own services, or publish one of this plugin's own |
| `Tools` | the tools this running olai advertises to agents |
| `Env` | the process environment variables, and the test stand-in this plugin was given |
| `Clock` | the time, as an ISO-8601 string |
| `Identity` | the trusted header names, and who a request is from |
| `Served` | the directory a transport is serving, and its write gate |
| `VaultViews` | register a ledger or a matcher with the store |
| `VaultSettings` | the directory's settings, supplied after declarations mount |
| `ConfigurationWatch` | the current configuration, and its changes |
| `BundleModules` | the module declarations of this build, switched-off rows included |
| `Bundle` | this plugin's position in the registry's order |

A plugin's browser code asks for browser services instead: `Slots`, `Faces`, `Wired`, `Clocks`, `Bar`, `Links`, `Edits`, `Landings` and `Offers`.

</details>

<details>
<summary>The calls a plugin answers: <code>surface</code>, <code>faces</code>, import subpaths and the probe</summary>

### `surface` and member

A surface is the set of calls this plugin answers over the connection between the browser and the server, declared with `defineSurface` inside the plugin's own package. A member is one of those calls: a cell, a collection, a stream or a procedure.

```ts
export const surface = defineSurface({ cells: { ci: oduMembers.cells.ci } })
```

The framework puts the surface under the plugin's name, so this member is called as `surface/odu/ci/get`. No olai code builds that string by hand.

### `faces`

The list of which callers may reach which members, written in the plugin's own package against its own surface.

```ts
export const faces = { browser: { ci: "resource", service: "resource" } }
```

A kind of caller the plugin never lists is refused every member, so a plugin with no `agent` entry answers no agent calling in over MCP. The day it wants to answer them, it adds the entry, and nothing in olai's core, the code that is not a plugin, changes.

### `writes`, `resources`, `tools` and `charter`

The other fields a plugin passes to `Surfaces.register`. Each belongs to the plugin, and each goes away when the plugin does.

| Field | What it declares |
| --- | --- |
| `writes` | which of its procedures record who the caller was, named as its own surface spells them |
| `resources` | which members an agent may read as a `surface://` address. A plugin whose agent calls are all actions leaves it out |
| `tools` | the tools this plugin gives an agent, so a plugin that is switched off advertises none |
| `charter` | one paragraph telling an agent what this plugin is, read off the roster whenever an agent connects |

### import subpath

A path inside the plugin's package that another package may import, such as `olai-plugin-vault/contract` or a plugin's own `/slots`. Such a subpath carries types, service tags, descriptions and fixed data, never a running value.

### `probe`

An Effect the plugin registers on `SessionStart`, which answers two questions: is your tool installed on this machine, and if it is not, what do we tell the person?

```ts
interface Probed {
  server: StdioServer | null          // the MCP server to hand a session
  missing: { name, where, why } | null // ...or the sentence about the one it did not get
  at?: string                          // where in this app the work is visible
}
```

- One call answers both questions, because asking twice would start the plugin's background program twice for every conversation.
- `missing.why` is a whole sentence the plugin writes. Core shows it and writes none of it.
- The probes are run again each time a conversation opens, so a plugin that unloaded contributes nothing.
- A plugin need not have a probe. Having none is the ordinary case for a machine that lacks the tool, and that already works.
- The chat plugin limits how many probes run at once, since each one may start a subprocess.

</details>

<details>
<summary>Kinds, claims and dressings</summary>

### kind

A word the plugin teaches the directory about the values a property can hold. The plugin contributes the word bare, and olai stores it with the plugin's name in front.

```ts
export const kinds = [{
  kind: "run",                           // bare: the registry prefixes it
  takes: `\`${RUN_TYPE}\` (an odu run id)`,
  admits: isRunIdShaped,                 // does this value fit
}] as const
// kolu: terminal → kolu-terminal        odu: run → odu-run
```

The file format itself owns seven kinds (`text`, `date`, `int`, `path`, `doc`, `ref` and `node`), and none of them describes a terminal. The prefix means two plugins cannot end up claiming one word, and a collision would fail that plugin's `register` in any case.

### claim

The property key a kind takes for itself: its own prefixed word. Whoever speaks first declares the key, and one function decides who that is.

```
  1. the directory's row     _olai/Properties.olai    ← always wins
  2. the plugin's claim      the kind's own word      ← where the row said nothing
```

Switching a plugin on therefore declares its key for you, with nothing written into the directory, and a row you wrote yourself always wins. Switching the plugin off takes its claims away with its kinds. What this looks like to a reader is on [live-properties.md](../live-properties.md).

### dressing

What a plugin draws beside a property value in an outline row, where an outline is a file of rows and a row is one line of it. A dressing draws beside the value and never instead of it, so the stored text stays searchable and editable.

| Dressing | When it draws |
| --- | --- |
| **block** | always takes a row of its own: a terminal somebody wrote down is worth a row even when nothing is happening |
| **chip** | only while there is something to say. A row with no `odu-run` value looks unchanged |
| **pane** | opens below the row when you click a chip |

</details>

<details>
<summary>What a plugin draws: row actions, header, page body, logo</summary>

### row actions

What a plugin adds to the menu on an outline row, as a single command or as a group of them.

| Field | Means |
| --- | --- |
| `id` | the plugin's own word for the entry, stored beside the plugin's name |
| `label` | the words shown in the menu |
| `writes` | required: does this change the directory? Entries that only read are grouped before entries that write |
| `run(node)` | does the work on that row, and returns a sentence if it refuses |
| `confirm` | a question the menu asks before calling `run` |
| `choices` | an entry that opens a submenu of commands instead of acting itself |

A group of one draws as that single option under the entry's label, and a group of none draws nothing. Cancelling the confirmation, or closing the menu, does not call `run`.

### chrome

A component the plugin puts in the header bar at the top of the app, registered in `app.header` with a word saying where it goes.

| Word | Means |
| --- | --- |
| `lead` | a place in the bar before the health dot, drawn on phones too |
| `cluster` | a status line: one row of the health popover on a desktop |

A `cluster` entry may declare a `status` that updates itself, made of `tone`, `label` and `detail`, read from state the plugin's own activation owns. The tones are `healthy`, `quiet`, `notice` and `alarm`, and the health dot shows the worst tone present.

### mount

The plugin's own component in the body of the page, registered in `app.mount` and mounted once per browser tab. It is where the plugin opens its one subscription, however many rows draw from it.

### mark

The plugin's logo: a small shape beside a message it sent into a conversation, and beside a coding agent's name in the picker and the header. It is not a **To do**, **Doing**, **Done** or **Cancelled** mark on a row.

- It takes no arguments, because it is always drawn at the size of its line of text.
- It returns shapes only: a `<g>` of paths in a `0 0 16 16` box, drawn in `currentColor`. The app owns the `<svg>` around it, so a column of logos stays even.
- A plugin with no logo is drawn with a general-purpose shape and its full name, never with another plugin's shape.

</details>

<details>
<summary>Sending into a conversation: <code>Deliveries</code>, <code>wake</code>, watching</summary>

### `Deliveries`

The service a plugin uses to send a message into a conversation with an agent. It can only send, and every message carries the name of the plugin that called it.

```ts
interface Deliveries {
  scopes: () => ReadonlyArray<{ agent: string; session: string; file: string }>
  deliver: (
    to: { agent: string; session: string },
    body: string,
    options?: { coalesce?: string },
  ) => void
}
```

| Rule | Detail |
| --- | --- |
| `deliver` cannot read | a plugin learns which conversations asked for its messages, and nothing else about them |
| The message arrives the way a person's does | it lands in a `user` row marked with the plugin's name, taken from the registry, so one plugin cannot sign another's words |
| Core decides only when it arrives | an idle agent takes it as its next turn, a busy agent gets it when the turn ends, and a conversation nobody has open keeps it until somebody opens it |

> A person chooses, per conversation, which file this plugin may send about. There is no setting for the whole server and none an agent can change, and a new or cleared conversation starts with it off.

### `wake`

The plugin's own wording for the control that chooses that file.

```ts
readonly wake?: {
  subject: string                          // "wake on terminal activity"
  waiting: { one: string; many: string }   // "fleet event waiting" / "…events waiting"
}
```

Everything around those words belongs to core: the picker, the separator and the number in `3 fleet events waiting`. The declaration sits in the plugin's server code, because `chat.scope` refuses a plugin whose server code declares no `wake`, checked against the plugins this running olai mounted.

### watching

A service that tells the plugin what happened in a conversation: a message of its own that landed, an agent reply that finished, a turn that started or ended. What a person typed is not among those events, and there is no transcript to read. Each handler is run on its own, so a plugin that fails on one event does not bring the turn down.

</details>

<details>
<summary>State, offers, engines, slots and settings</summary>

### local state

One record file per plugin and served directory, kept where olai keeps machine-local state rather than in the served directory. Core owns its path and writes saves one after another, and each save finishes with the result of its write.

`LocalState.directory` is a directory beside that record, for state that is a tree of files another program writes. Olai creates it readable by its owner only, marks it with the served path, refuses it if it belongs to another path, and deletes it with the records when that path stops being served. What goes inside it is the plugin's business. It fails rather than hand back a path it could not keep private.

### offer

A service of the plugin's own, published under `<plugin>.<word>`.

```ts
yield* (yield* Offers).own("agenda", provision)   // reached as journal.agenda
```

- The runtime supplies the plugin's name; the plugin supplies only the word after the dot.
- A plugin that wants it declares `serviceTag<Shape>(key)`, which is both what the compiler requires of it and what it waits for, so it waits while the offering plugin is switched off.
- Both parts of the name take lowercase letters, digits and hyphens and must start with a letter. Dots are refused, so one plugin cannot spell its way into another's names.
- Two plugins offering one key at once are refused, and the message names the first one.
- `Offers.offer` publishes a core service instead, such as `Vault`, `Ops`, `Agents` or `Deliveries`.

Writing one is covered in [dynamic-plugins.md](../dynamic-plugins.md).

### engine

One ACP coding agent olai can run in a conversation, shipped as a plugin. It carries a `Leg` that knows how that agent talks, a probe that finds it on this machine, the channel its standing prompt travels on, plus a logo and a sentence about installing it in its browser code. One directory and one registry row each, and no surface of its own.

The chat plugin detects engines and remembers each machine's answer until that engine unregisters. The roster lists every mounted engine in registry order, each marked `standing: "here"` or `"not-here"`, and only one that is here can start.

### slot

A named place in the page where a plugin draws a component, such as `outline.row.chip` or `app.header`. Which plugin owns each slot, and what each one takes, are in [slot-ownership.md](slot-ownership.md).

### `environment` and `config`

A plugin declares the environment variables it reads and the settings it takes, both on `definePlugin`.

| Field | What it declares |
| --- | --- |
| `environment` | each variable as `key`, `secret` and `says`, so the plugins panel can show what a plugin reads without that list being written anywhere else |
| `config` | the plugin's settings schema, with defaults on the fields. It is read inside the activation, so an invalid value fails that one plugin, with a sentence saying why |
| `configUpdates` | `"reapply"`, the default, remounts the plugin when its settings change; `"live"` leaves it mounted and the plugin follows the change itself |

A single setting in a `config` schema may be marked `preference`, and it then appears in the preferences panel under the plugin's heading, with the plugin's row in the plugins panel linking to it.

### roster and licence

The roster is which plugins this build has and which this running olai is running, published as core's `plugins` cell. A licence is permission for one dressing to draw, answered by the server for each value it sends. Both licences are described below.

</details>

<details>
<summary>The subpaths a plugin package exposes</summary>

Three different programs load a plugin's code, so a package exposes three subpaths of code plus one row of data.

| Subpath | Read by | Contains | May not contain |
| --- | --- | --- | --- |
| `./wire` | the browser, setting up the connection | `name`, `surface`, `faces` | SolidJS, a client for the program the plugin talks to, a `node:` builtin |
| `./server` | the loader, at mount | `name`, `needs`, `apply`. May pull in that client and `node:` builtins | a browser component |
| `./browser` | the browser | dressings, header components, the page component, the logo: SolidJS, in a chunk of its own | — |
| a row in `packages/bundle/olai.yml` | the loader | `id` and the module's name, as data | an import |

A browser component anywhere in the imports of a process that draws nothing kills the start-up with `Cannot find module 'react/jsx-dev-runtime'`, which is why there are three subpaths.

Four more subpaths carry data rather than code. `./all.css` adds the plugin's stylesheet, and `./testids` is its catalogue of the identifiers the browser tests look for. `./assets` contributes markup for the page head and files to preload. `./policy` carries fixed reservations of what the plugin may write, which hold even while the plugin is switched off.

`@olai/plugin-api` is not one of those subpaths. It is the interface a plugin is written against: browser components and slots at its root, server service tags at `./services`. It names no plugin, which is what lets a plugin import it.

</details>

<details>
<summary>How a property value gets the component that draws it</summary>

A directory's property declarations deliberately never travel to the browser, so the browser cannot read `_olai/Properties.olai` and decide anything from it. A plugin still draws a value the browser was never told about, in three steps.

1. The directory declares a key to be a kind. The key may be called anything, such as `pty`, and the kind is the plugin's prefixed word, `kolu-terminal`. Where the directory says nothing, the plugin's claim applies.
2. The server works it out once per value it is about to send. `@olai/format`'s `meaning.ts` maps the value to `{ opens, word }`: what it points at, and which running plugin's kind claims it. Both travel with the page as tables keyed `from·prop·value`.
3. The browser draws it. A chip becomes a link from `opens`, and `dressingFor()` looks `word` up in the table of what plugins registered into their slots.

What travels is an answer about one value being drawn, never the declaration. A value that does not fit its kind gets no word, so switching a plugin on over a directory nobody migrated leaves the text plain, with the validator's finding beside it.

Two permissions are settled before a dressing draws.

| Licence | Asks | Answered by |
| --- | --- | --- |
| the page's | is this value claimed by a kind word? | the three steps above |
| the roster's | is this server running the plugin that owns the dressing? | the `plugins` cell |

For both of today's dressings the answer names the same plugin, and they are still two questions: nothing requires a dressing to be registered by the plugin that taught the directory the word.

The roster arrives on a frame, so there is a moment when the browser does not know which plugins run. The two defaults point opposite ways, because a wrong guess costs differently.

| Before the roster lands | Assume | Why |
| --- | --- | --- |
| drawing a dressing | on | a dressing drawn early and then removed is a flicker |
| mounting a plugin | off | a subscription to another plugin this server did not compose fails for the life of the page, naming a plugin the operator turned off |

</details>
