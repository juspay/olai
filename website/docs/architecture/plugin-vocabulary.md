# The words a plugin manifest uses

A plugin's two halves declare themselves with the words below.[^contract] Each entry says what a word means, what it carries, and what an absent one costs.

| Word | What it is |
| --- | --- |
| [`name`](#name) | the plugin's one word |
| [row](#row) | its line in the registry |
| [fiber](#fiber) | one mounted plugin |
| [service, `needs`](#service-and-needs) | a capability, and the list naming it |
| [`surface`, member](#surface-and-member) | the plugin's section of the wire |
| [`faces`](#faces) | who may call what |
| [`writes`, `resources`, `tools`, `charter`](#writes-resources-tools-and-charter) | the rest of a registration |
| [door](#door) | an importable subpath |
| [`probe`](#probe) | is this tool installed here? |
| [kind](#kind) | a property vocabulary word |
| [claim](#claim) | the key a kind takes |
| [dressing](#dressing) | the face a value wears |
| [row actions](#row-actions) | the row menu's verbs |
| [chrome](#chrome) | a seat in the header |
| [mount](#mount) | the plugin's own component |
| [mark](#mark) | the plugin's logo |
| [doorbell](#doorbell) | posting into a conversation |
| [`wake`](#wake) | the doorbell control's wording |
| [watching](#watching) | being told what happened |
| [local state](#local-state) | a record and a directory |
| [offer](#offer) | a service of its own |
| [engine](#engine) | an agent chat can seat |
| [slot](#slot) | where a face hangs |
| [`environment`, `config`](#environment-and-config) | variables and settings |
| [roster, licence](#roster-and-licence) | what runs, what may draw |

[^contract]: Where the contract lives: the types under `packages/plugin-api/src/` are it, and [plugin-system.md](plugin-system.md) is why the shape is this one.

<details>
<summary>A plugin, its row, and the services it names</summary>

### `name`

The plugin's one word, such as `"kolu"`.

It is also the row's `id`, the wire prefix every member answers under, the fiber name, the settings namespace, and the address of the plugin's page, `website/docs/plugins/<name>.md`. Every keyed service reads it off the fiber, so a plugin can never sign another's registration.

### row

One entry in `packages/bundle/olai.yml`: the plugin's `id` and the module the loader mounts, plus the columns that place it on the plugins panel. The specifier resolves at mount, so a plugin's presence is a runtime fact. The columns are in [adding-a-plugin.md](adding-a-plugin.md).

### fiber

One mounted plugin. Callers see four words: `running`, `waiting`, `failed` and `off`.

### service and `needs`

A service is a named capability reached through an Effect tag a plugin yields. `needs` is the array of tags the plugin declares, and it drives both the runtime wait and the compiler's requirement check.

| Tag | What it gives |
| --- | --- |
| `Vault` | the served directory, its revisions and the inbox registry |
| `Ops` | the write gate and the typed write verbs |
| `Kinds` | teach the property vocabulary a word |
| `Surfaces` | put a sibling surface on the wire |
| `Wakes` | declare the doorbell's wording |
| `Deliveries` | post into a conversation |
| `Watching` | be told what a conversation did |
| `SessionStart` | be asked a probe per conversation opening |
| `Agents` | offer an ACP engine |
| `LocalState` | one record and one directory beside the directory |
| `Offers` | stand behind a door, or offer one of this plugin's own |
| `Tools` | the agent verbs this serve advertises |
| `Env` | the process variables, and this plugin's dial |
| `Clock` | the time, as an ISO-8601 string |
| `Identity` | the trusted header names, and who a request is |
| `Served` | the directory a transport is serving, and its gate |
| `VaultViews` | register a ledger or a matcher with the store |
| `VaultSettings` | the directory settings, supplied after declarations mount |
| `ConfigurationWatch` | the current configuration, and its changes |
| `BundleModules` | the module declarations of this build, disabled rows included |
| `Bundle` | this plugin's rank in the registry's order |

The browser half names browser services instead: `Slots`, `Faces`, `Wired`, `Clocks`, `Bar`, `Links`, `Edits`, `Landings` and `Offers`.

</details>

<details>
<summary>The wire: <code>surface</code>, <code>faces</code>, doors and the probe</summary>

### `surface` and member

A surface is the plugin's section of the wire, declared with `defineSurface` inside the plugin's own package. A member is one item on it: a cell, a collection, a stream or a procedure.

```ts
export const surface = defineSurface({ cells: { ci: oduMembers.cells.ci } })
```

The framework composes it under the plugin's name, so the member reaches the wire as `surface/odu/ci/get`. No olai code builds that string.

### `faces`

The access list for a surface, written in the plugin's package against its own spec.

```ts
export const faces = { browser: { ci: "resource", service: "resource" } }
```

A caller kind the plugin never lists is denied every member, so a plugin with no `agent` map answers no MCP client. The day it wants otherwise it writes the map, and nothing in core changes.

### `writes`, `resources`, `tools` and `charter`

The other fields of `Surfaces.register`, each of them the plugin's own and each leaving with it.

| Field | What it declares |
| --- | --- |
| `writes` | which of its procedures use the caller's attribution, named as its own surface spells them |
| `resources` | which members an agent may address as a `surface://` resource. Absent on a row whose agent face is all verbs |
| `tools` | the agent verbs this row brings, so a row that is off advertises none |
| `charter` | one paragraph of what this row is to an agent, read off the roster at each host connection |

### door

A package subpath another package may import, such as `olai-plugin-vault/contract` or a plugin's `/slots`. A door carries types, service tags, descriptors and static data, never a live value.

### `probe`

An Effect registered on `SessionStart` that answers "is your tool installed here, and if not, what do I tell the person?".

```ts
interface Probed {
  server: StdioServer | null          // the MCP server to hand a session
  missing: { name, where, why } | null // ...or the sentence about the one it did not get
  at?: string                          // where in this app the work is visible
}
```

- One reading answers both halves, because asking separately would start the plugin's daemon twice per conversation.
- `missing.why` is a whole sentence the plugin writes. Core displays it and composes none of it.
- The list is read fresh per session open, so a plugin that unloaded contributes nothing.
- A plugin may have no probe. The absent case is a machine that lacks the tool, which already works.
- Chat schedules the asking with bounded concurrency, since each probe may start a subprocess.

</details>

<details>
<summary>Kinds, claims and dressings</summary>

### kind

A word the plugin adds to the directory's property vocabulary, contributed bare and stored prefixed with the plugin's name.

```ts
export const kinds = [{
  kind: "run",                           // bare: the registry prefixes it
  takes: `\`${RUN_TYPE}\` (an odu run id)`,
  admits: isRunIdShaped,                 // does this value fit
}] as const
// kolu: terminal → kolu-terminal        odu: run → odu-run
```

The format owns seven kinds (`text`, `date`, `int`, `path`, `doc`, `ref` and `node`), and none of them describes a terminal. Two plugins claiming one word is unreachable through the prefix, and a collision fails that plugin's `register` anyway.

### claim

The property key a kind declares for itself by convention: its own prefixed word. A key is declared by whichever speaks first, and precedence lives in one function.

```
  1. the directory's row     _olai/Properties.olai    ← always wins
  2. the plugin's claim      the kind's own word      ← where the row said nothing
```

Enabling a plugin therefore declares its key for you, with nothing written into the directory, and your own row always wins. A disabled plugin's claims disappear with its kinds. The reader's half of this is on [live-properties.md](../live-properties.md).

### dressing

The face drawn for a live property value in an outline row. It draws beside the value and never instead of it, so the stored text stays greppable and editable.

| Dressing | When it draws |
| --- | --- |
| **block** | always owns a row: a terminal somebody wrote down is worth a row when nothing is happening |
| **chip** | only while there is something to say. A row with no `odu-run` looks unchanged |
| **pane** | opens below the row when a chip is clicked |

</details>

<details>
<summary>What a plugin draws: row actions, chrome, mount, mark</summary>

### row actions

What a plugin hangs on an outline row's menu, as a verb or a choice of verbs.

| Field | Means |
| --- | --- |
| `id` | the plugin's own word for the entry, keyed beside the plugin's name |
| `label` | the words on the row |
| `writes` | required: does this change the directory? Reads are grouped before writes |
| `run(node)` | acts on the node, and returns a sentence when the action is refused |
| `confirm` | a question the menu asks before calling `run` |
| `choices` | an entry that opens a submenu of verbs rather than acting |

A choice of one draws as that option under the entry's label, and a choice of none draws nothing. Cancelling a confirmation, or dismissing the menu, does not call `run`.

### chrome

A component the plugin hangs in the header bar, registered in `app.header` with a placement word.

| Word | Means |
| --- | --- |
| `lead` | the seat in the bar ahead of the health dot, drawn on phones too |
| `cluster` | a status readout: one row of the desktop health popover |

A `cluster` seat may declare a reactive `status` of `tone`, `label` and `detail`, read from state its own activation owns. The tones are `healthy`, `quiet`, `notice` and `alarm`, and the dot wears the worst tone present.

### mount

The plugin's own component in the page body, registered in `app.mount` and mounted once per tab. It is where the plugin opens its single subscription, however many rows draw from it.

### mark

The plugin's logo: a small glyph beside a message it delivered into a conversation, and beside an engine's name in the picker and header.

- It takes no arguments, because a mark is a glyph at the size of its line.
- It returns shapes only: a `<g>` of paths in a `0 0 16 16` box, in `currentColor`. The app owns the surrounding `<svg>`, so one column of marks stays even.
- A plugin with no mark is drawn with a generic glyph and named in full, never with another plugin's shape.

</details>

<details>
<summary>Posting into a conversation: the doorbell, <code>wake</code>, watching</summary>

### doorbell

The write-only service a plugin uses to post a message into a conversation, keyed to the calling plugin.

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
| `deliver` cannot read | a plugin learns which conversations opted in to it, and nothing else about them |
| The body travels a person's path | it lands in a `user` row marked with the plugin's name, taken from the registry binding, so one plugin cannot sign another's words |
| Core decides only when | an idle agent takes it as a turn, a busy agent holds it until the turn ends, and a conversation nobody has open holds it until somebody opens it |

> A person points the doorbell at a file per conversation. There is no serve-level default and no agent-settable one, and a fresh or cleared conversation starts with it off.

### `wake`

The plugin's own wording for the control that points the doorbell at a file.

```ts
readonly wake?: {
  subject: string                          // "wake on terminal activity"
  waiting: { one: string; many: string }   // "fleet event waiting" / "…events waiting"
}
```

The strip around those words is core's: the picker, the separator and the numeral in `3 fleet events waiting`. The declaration sits on the server half, because `chat.scope` refuses a plugin whose server half declares no wake, checked against the plugins this serve mounted.

### watching

A push service: core tells the plugin what happened in a conversation — a delivery that landed, an agent reply that settled, a turn that started or ended. Human messages are not among the events, and there is no transcript to read. The handler is contained, so a mirror that fails on one event does not take a turn down with it.

</details>

<details>
<summary>State, offers, engines, slots and settings</summary>

### local state

One record per plugin and served directory, kept in the state home rather than in the directory. Core owns its path and its ordered write chain, and each save settles with the write's outcome.

`LocalState.directory` is the record's sibling, for state that is a tree of files another program writes. It is created owner-only, marked with the served path, refused if it belongs to another one, and swept with the records when that path stops being served. What goes inside it is the plugin's. It fails rather than answer a path it could not make private.

### offer

A service of the plugin's own, published under `<plugin>.<word>`.

```ts
yield* (yield* Offers).own("agenda", provision)   // reached as journal.agenda
```

- The runtime supplies the plugin's name; the plugin supplies only the local word.
- A consumer declares `serviceTag<Shape>(key)`, which is both its Effect requirement and its dependency, so it waits while the offering row is off.
- Both segments take lowercase letters, digits and hyphens and must start with a letter. Dots are refused, so one plugin cannot spell another's namespace.
- Two simultaneous providers for one key are refused, naming the first.
- `Offers.offer` stands behind a core door instead, such as `Vault`, `Ops`, `Agents` or `Deliveries`.

The authoring half is in [dynamic-plugins.md](../dynamic-plugins.md).

### engine

One ACP coding agent olai can seat, shipped as a plugin. It carries a `Leg` that reads the agent's wire, a probe that finds it on this host, the channel its standing prompt rides, plus a logo and an install sentence on its browser half. One directory and one row each, and no surface of its own.

Chat owns detection and caches each machine's answer until that engine unregisters. The roster keeps every mounted engine in registry order, with `standing: "here"` or `"not-here"`; only a row that is here can start.

### slot

A named place in the page where a plugin hangs a face, such as `outline.row.chip` or `app.header`. The owner of each slot, and the shape each contribution takes, are in [slot-ownership.md](slot-ownership.md).

### `environment` and `config`

A row declares the environment variables it reads and the settings it takes, both on `definePlugin`.

| Field | What it declares |
| --- | --- |
| `environment` | each variable as `key`, `secret` and `says`, so the panel can show what a row reads without naming it elsewhere |
| `config` | the row's settings schema, with defaults on the fields. It is decoded inside the activation, so an invalid value fails that row with a sentence |
| `configUpdates` | `"reapply"` (the default) remounts the row on a config change; `"live"` leaves its activation alone and the row follows the change itself |

A leaf of a `config` schema may be annotated `preference`, and it then draws in the preferences panel under the plugin's heading, with the inspector row linking to it.

### roster and licence

The roster is which plugins this build has and which this serve is running, published as core's `plugins` cell. A licence is permission for one dressing to draw, answered per value the server sends, and both licences are below.

</details>

<details>
<summary>The doors a plugin package exposes</summary>

Three different programs load a plugin's code, so a package exposes three code doors plus one row of data.

| Door | Read by | Contains | May not contain |
| --- | --- | --- | --- |
| `./wire` | the browser's wire setup | `name`, `surface`, `faces` | SolidJS, an appliance client, a `node:` builtin |
| `./server` | the loader, at mount | `name`, `needs`, `apply`. May pull the appliance's client and `node:` builtins | a browser component |
| `./browser` | the browser | dressings, chrome, mount, mark: SolidJS, and its own chunk | — |
| a row in `packages/bundle/olai.yml` | the loader | `id` and the module specifier, as data | an import |

A browser component on the import graph of a process that renders nothing kills the boot with `Cannot find module 'react/jsx-dev-runtime'`, which is why there are three doors.

Four more subpaths are routing rather than code graphs. `./all.css` chains the plugin's stylesheet and `./testids` is its catalogue of browser-test identifiers. `./assets` contributes head markup and preloads, and `./policy` carries static write reservations, which stay in force while their owner is off.

`@olai/plugin-api` is not one of those doors. It is the interface a plugin is written against: browser faces and slots at its root, server service tags at `./services`. It names no plugin, which is what lets a plugin import it.

</details>

<details>
<summary>How a live property gets its UI</summary>

A directory's property declarations deliberately never travel to the browser, so the browser cannot read `_olai/Properties.olai` and decide anything. A value is nonetheless drawn by a plugin the browser was never told about, in three steps.

1. The directory declares a key to be a kind. The key may be called anything, such as `pty`, and the kind is the plugin's prefixed word, `kolu-terminal`. Where the directory says nothing, the plugin's claim applies.
2. The server consults once per value it is about to send. `@olai/format`'s `meaning.ts` maps the value to `{ opens, word }`: what it names, and which running plugin's kind claims it. Both ride the page stream as tables keyed `from·prop·value`.
3. The browser draws. A chip becomes a link from `opens`, and `dressingFor()` looks `word` up in the table plugins registered into their slots.

What travels is an answer about one drawn value, never the declaration. A value that does not fit its kind gets no word, so enabling a plugin over a directory nobody migrated leaves prose plain, with the validator's finding beside it.

Two permissions resolve before a dressing draws.

| Licence | Asks | Answered by |
| --- | --- | --- |
| the page's | is this value claimed by a kind word? | the consult above |
| the roster's | is this server running the plugin that owns the dressing? | the `plugins` cell |

They resolve to the same plugin for both of today's dressings, and they are still two questions: nothing requires a dressing to be registered by the plugin that taught the directory the word.

The roster arrives on a frame, so there is a moment when the browser does not know which plugins run. The two defaults point opposite ways, because a wrong guess costs differently.

| Before the roster lands | Assume | Why |
| --- | --- | --- |
| drawing a dressing | on | a dressing drawn early and removed is a flicker |
| mounting a plugin | off | a subscription to a sibling this server did not compose fails for the life of the page, naming a plugin the operator turned off |

</details>
