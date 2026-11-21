# Ask an agent for a plugin of your own

Ask for a plugin. An agent writes it into the directory olai serves, and olai compiles it and starts it without a restart, once you approve it.[^built]

## Ask for one

1. Press `Cmd` + `K` (`Ctrl` elsewhere) to open the command palette, and choose **New plugin**. Say in one sentence what it should do.
2. Name it.[^name]
3. Watch it arrive on its own page at `/plugins/hex-swatch`.[^watch][^builder][^fence]
4. Read what the agent wrote, then press **Turn on**. What the plugin draws appears with no reload.

## Three ways to start a new plugin

All three are there before you have any plugin at all.[^sidebar]

| What you click | Where it is |
| --- | --- |
| **New plugin** in the command palette | `Cmd` + `K`, then search for it by name |
| The `+` on the **Plugins** heading | the sidebar, the left column of files |
| **New plugin** at the top of the **Plugins** panel | the health dot, then **Plugins** |

## Read the plugin, then turn it on

The plugin's page describes what it does in plain words first, and shows its source code below.[^page] When you approve a plugin, you approve one exact version of its code.[^version]

> The code runs with the same authority as olai itself. There is no sandbox, and your approval is the only boundary. That is why **Turn on** is a button in the browser, which no agent can press.

## Where your approval is stored

Whether the plugin is on, which version you approved, and its own settings are kept as properties on one row in `_olai/Settings.olai`. That row is titled with the plugin's name, in the file every built-in plugin uses for its own settings.[^reserved][^travels]

Two plugins written out in full are in [dynamic-plugins-examples.md](dynamic-plugins-examples.md).

[^built]: Every page listed under [Plugins](index.md#plugins) describes a plugin olai was built with. The plugins on this page are yours: an agent writes them into the directory olai serves.

[^name]: olai suggests a name from the sentence you wrote, and the line under the box says where the plugin will be kept, `Kept in your vault as plugins/hex-swatch/`. A name another plugin has, or one that is not lower-case letters, digits and hyphens starting with a letter, is refused while you type.

[^watch]: The button opens the plugin's own page, with the conversation building it opened in the pane beside, and the page lists each file as the agent writes it. That conversation is an ordinary one under **Chats**: close the pane, come back tomorrow, and an alert tells you when the agent needs you.

[^sidebar]: The **Plugins** section of the sidebar lists one row per plugin, and a single row reading **Ask for your first plugin…** while you have none. A row carries a mark only when it needs something from you: `Review` for a version nobody has read, `Problem` for one that will not start, and a moving dot while an agent is still writing its files. A plugin switched off is drawn dim.

    All three ask the same two questions: what the plugin should do, and what to call it.

[^page]: The plugin's page opens with the title and first line of its `README.md`, then **What it uses**, read off the code's own imports. The files are below that, one tab each by path, beside the folder they are in, and the status line counts the code files and their lines. Settings it declares sit under **Settings**, and **Ask for a change…** opens the builder chat in the pane beside.

[^version]: A version is a hash of every `.ts` and `.tsx` file in the plugin's folder, with its path. Editing, adding, renaming or removing any of them pauses the plugin, stops it running, and shows what changed in each file since the version you approved. Editing the `README.md` changes nothing, because prose is not code. Every approval carries the version the page showed you, so one made after the source changed is refused.

[^builder]: Asking for a new plugin starts the chat of the plugin's own `README.md`, named after its folder: the chat for `plugins/hex-swatch/README.md` is `hex-swatch`. That chat is the builder: the page reads **Being built** while it works, says when the agent has finished, and carries **Ask for a change…**. A plugin whose `README.md` has no chat offers **Ask about Hex Swatch…**, which starts one.

    The agent is told to keep the `---` block at the top of that `README.md` exactly as it is, because those keys tie the conversation to the file, and olai refuses a write that changes them.

[^fence]: A tool writing the file from outside olai is outside that fence. What the chat's own page then says, and the one press that ties it back, are on [the chat plugin's page](plugins/chat.md).

[^reserved]: You cannot use `on`, `approved` or `checked` as a plugin setting: a `Config` declaring one faults the plugin, and `plugins.configure` refuses to write one. `checked` is the version the building conversation last finished at, and olai writes it when that call comes in. A plugin that could write `checked` itself would declare itself finished.

[^travels]: A plugin folder you copy in from another directory arrives switched off and unapproved, because the code travels and your approval does not. Your answer survives a restart and a stop, because it is a line in a file: `on: no`.

<details>
<summary>The buttons on the plugin's page, and the refusal when the code has changed</summary>

| Button | What it writes |
| --- | --- |
| **Turn on** | `approved: <version>` and `on: yes`, in one write |
| **Always trust changes**, under `•••` | `approved: always`, and nothing else |
| **Stop trusting changes**, in its place | the version that is running |
| **Delete…**, under `•••` | removes the folder's files and the plugin's settings row |

The sentence you see when you approve code that has changed since the page drew it:

```
"hex-swatch" has been edited since this page drew it, so approving it now would
approve source nobody has read. Look again, read what it says, and approve that.
```

</details>

<details>
<summary>When olai notifies you, and when it stays quiet</summary>

You ask for a plugin and then go and do something else, so three events reach you wherever you are: as a system notification, as a mark on the plugin's row in the sidebar, and on the plugin's page.

| Event | What has happened |
| --- | --- |
| **Ready for you** | the agent called `vault-plugins_run` at the version on disk, and got no fault back |
| **Paused** | a plugin that was running stopped, because its code changed |
| **Couldn't start** | the plugin's `apply` threw an error, or one of its code files will not compile |

Nothing else notifies you. A plugin starting is not news, because you pressed the button, and one being built is not news, because you asked for it.

</details>

<details>
<summary>The settings row, and three things a plugin is not</summary>

```
hex-swatch            on: yes
                      approved: 3fa9c1d2b7e45610
                      checked: 3fa9c1d2b7e45610
                      size: large
```

A `builder` property on this row is ordinary text that olai reads nothing from: the chat of `plugins/hex-swatch/README.md` is the builder.

- Not a lock. olai refuses any write of `approved` from an agent session, which stops an agent approving the plugin it just wrote. Otherwise `approved` is an ordinary property, and one that turns up on disk is an ordinary edit to your files.
- Not a report of what the browser file did. A component that throws an error while it is drawn is caught by the tab, the browser console names the plugin, and the plugin still says `running`, because on the server it is.
- Not a package. There is no command to install one, no version to pin and no build step: a plugin is a folder in a directory olai already serves.

</details>

<details>
<summary>The guide an agent follows to write a plugin</summary>

<!-- guide:start -->
## The folder

A plugin your directory defines is a folder under `plugins/`, and the folder's name is the plugin's name:

```
plugins/reader/
  README.md     what it does, for a person
  server.ts     required
  browser.tsx   optional
  pairs.ts      any other .ts or .tsx file, at any depth
  lib/sm2.ts
```

- The name has the same shape a built-in plugin's does, `[a-z][a-z0-9-]*`, and may not be a name this server already uses. A folder named anything else is not compiled, and is shown with a sentence saying so.
- `README.md` is a `# Title`, a blank line, one sentence, then as much prose as the plugin deserves. The heading is the plugin's name on screen, and the first paragraph the line under it.
- `server.ts` is required, and is a whole plugin on its own: it can teach the directory a property kind, or send a message at seven each morning.
- `browser.tsx` is optional. It is the file that draws on screen.
- Every other `.ts` and `.tsx` file in the folder, at any depth, is code the two may import. It is part of the plugin whether anything imports it or not.
- Anything else in the folder is ordinary content, and olai leaves it alone.

The plugin's page shows every code file, and its version is a hash of all of them, so changing any one of them asks you to turn the plugin on again.

olai treats these files as a plugin only under `plugins/`, so a code checkout somebody keeps beside their notes is untouched. They stay plain text: stored like any other file, recorded in the ledger, and listed by path in the commit panel, where you commit changes.

They are not rows in the sidebar's **Reference** tree, because you read them on the plugin's page. A file's path is an address too: `/plugins/reader/lib/sm2.ts` opens the plugin at that file.

## What each file may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the copies inside the running binary, so what a plugin draws uses the same Solid the app does. The directory has no `node_modules`, so any other import is refused when olai reads the plugin, not while it runs:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

A subpath is also refused (`effect/Schema`, `solid-js/web`), and so is an `import()` whose path is computed while the plugin runs. A person approves the source they read, so every module a plugin imports must be visible in it.

A file imports another file of its own folder by a relative path with its suffix, such as `import { splitPair } from "./pairs.ts"`. Each of these is refused with a sentence naming the import:

- a path that leaves the folder, such as `../other/server.ts`, or one starting with `/`;
- a file the folder does not hold;
- a path without `.ts` or `.tsx` at the end;
- two files that import each other, directly or through others;
- a `.tsx` file imported, directly or through others, by `server.ts`;
- `export … from`, which re-exports another file: import what you need, then export it.

A file both entries import is built once for each, so in each it reaches the services of the entry that imported it.

Both files import the bare `@olai/plugin-api`, and olai gives each different services: the server file `Kinds`, `Vault`, `Surfaces` and `Deliveries`, the browser file `Slots`, `Clocks` and `Wired`.

## Give it settings

The server file may expose a `Config` schema, as a built-in plugin does. Give every field a decoding default and a description annotation, then pass it as `config` to `definePlugin`; `apply` receives the decoded object.

```ts
import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"
const Config = Schema.Struct({
  tone: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to draw" })),
})
export default definePlugin({
  name: "hex-swatch", needs: [], config: Config,
  apply: (config) => Effect.logInfo(`tone: ${config.tone}`),
})
```

- Each field is a property on the plugin's row in `_olai/Settings.olai`, beside `on` and `approved`.
- Its control appears under **Settings** on the plugin's page, and in the plugin's row in the **Plugins** panel. A ● marks a value somebody set, and ↺ removes the property.
- Changing a setting re-applies the plugin and asks for no fresh approval, because a setting is not source code.
- A value that does not fit the schema falls back to the default, warns once, and shows the file's text and the schema's message under its control.

## What an agent can do

| Tool | Answers |
| --- | --- |
| `vault-plugins_guide` | this guide, which ships inside the binary |
| `vault-plugins_inspect` | what a plugin may name: the three modules, the service keys, every slot with its key rule and what a face there is handed, the folder layout, and the names in use |
| `vault-plugins_write` | writes one file of one plugin, by its path in the folder, and says whether the plugin compiles with it |
| `vault-plugins_run` | the state of one plugin right now: its state, its version, and the fault sentence if it has one |
| `vault-plugins_stop` | switches one plugin off for good, by writing `on: no` |

- Call `vault-plugins_inspect` before you write code. Each service record says which file it belongs to, and `availability` says whether a server file provides it now or has declared it for the browser.
- Its `taken` list holds every name this server uses, built-in plugins and folders under `plugins/` alike: a new plugin may use neither.
- `vault-plugins_write` creates the folder if it is not there. You name the file by its path in the folder, such as `lib/sm2.ts`; no other paths, no rules about which files olai claims, no guessing.
- `vault-plugins_run` answers `pending` for a plugin nobody has approved. That is the approval boundary answering you: say so and stop.
- `vault-plugins_stop` works on these plugins only. Naming a built-in plugin is answered as no such plugin.

## Check a file before you ask for approval

Every edit changes the version, and every version costs a person a decision, so be sure the file is right before you ask for approval.

Write each file with `vault-plugins_write`, which says in the same reply whether the plugin compiles with that file in it, so the loop is one call rather than a write and a guess. Or compile it yourself, with the call the server makes:

```ts
import { asDataUrl, buildPlugin } from "@olai/plugin-build"
// files: every code file of the folder, by its path in the folder
console.log(await buildPlugin("browser", "browser.tsx", files, (_path, text) => asDataUrl(text)))
// { ok: true, text, modules } | { ok: false, why }
```

Run that from a package that depends on `@olai/plugin-build`; `packages/server` does. It catches every way the folder can fail to become modules: a module olai does not provide, an import of a file the folder does not hold, a computed `import()`, a syntax error. Then typecheck the files with `bun x tsc --noEmit`.

> The typecheck has one trap. Both files import the bare `@olai/plugin-api`, and each gets different services, so typechecking a server file as written reports `has no exported member 'Kinds'`. Point that import at `@olai/plugin-api/services` for the check, then put it back.

## Say when you are finished

`vault-plugins_run` is the last check, and the only one that asks about the real thing: it answers about the same plugin the person is looking at. It is also how you say the build is over.

Until that call comes in, the plugin's page says it is still being built, and nobody is notified. A file arriving cannot mean it is finished, because this guide has you write `browser.tsx` last. Call it once the folder is complete, at the version on disk, and the person is told it is ready.

Call it again after every fix. Each call is about the version it was made at, and only a call with no fault in its answer ends the build. A mistake you fixed yourself notifies nobody. olai writes that version onto the plugin's settings row, so a build finished before a restart is still finished after one.

## Share a service with another plugin

A server file can offer a service to other plugins, with no change to olai's own services. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. olai puts the offering plugin's name in front of the key, so `fleet-source` offers `fleet-source.fleet`. The callback is given the asking plugin's name, so it can return a different view per plugin.

- Both parts of the key start with a lower-case letter and hold only lower-case letters, digits or hyphens. A dot separates them.
- A plugin that wants it writes `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")`, puts `Fleet` in `needs`, and reads it with `yield* Fleet`. Making a tag names a dependency; it grants nothing.
- The two plugins agree between themselves on the service's shape. The string key checks nothing while they run.
- A plugin waits until the service has started up. Replacing a provider unloads the plugin using it and waits for its cleanup while the old service is still alive, then starts it on the new one.
- Offering a key already offered faults the offering plugin and undoes its registrations. Cordis, the registry olai runs plugins on, refuses a second provider for one key and names both.
- `vault-plugins_inspect` lists the keys on offer now, beside olai's own. A stopped provider's keys leave the list, and a plugin may name a key nobody offers yet and wait for it.

### A service the browser file offers

A browser file imports `Offers` the same way, and publishes with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser file that wants it declares `serviceTag<Shape>("provider.palette")` in `needs` and yields it in `apply`.

- In the browser, `Offers` has only `own`, so a plugin cannot replace `Slots`, `Wired` or anything the app's shell provides. These keys live in the tab, apart from server keys of the same name.
- A provider publishes only once it has started up. While it is missing, the plugin waiting for it draws nothing, and when the provider withdraws, what that plugin drew is removed before the provider's own resources are released.
- To make a browser key visible to `vault-plugins_inspect`, the server file names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. Those declarations go when the server file unloads.

## What happens when it starts

The server file is compiled, evaluated and started as a fiber on the registry the built-in plugins run on. Its property kinds become available, a surface it adds reaches the wire, the list of plugins changes, and open tabs reconnect.

Then olai reads the served directory again, which is what draws the plugin on values that were already there. Without that, the plugin's kind would be in force, but its chip would not be drawn until the next keystroke somewhere in your files.

The browser file is compiled to a chunk of JavaScript, served at `/_olai/plugins/<name>-<version>.js`, and each file it imports at `/_olai/plugins/<name>-<version>/<path>.js`. The tab loads it as it loads a built-in plugin's chunk, and what the plugin draws appears with no reload. The version is in the path, so an approved edit has a different address, and no cache can return the code approved before it.

The server keeps the last chunk served for each plugin name, so a tab still fetching one while the plugin stops gets that code rather than a 404.

The plugin ends up `failed` if a file will not compile, exports no plugin, declares a name other than the folder's, or if `apply` throws. The sentence explaining it is on the plugin's page and its row, no other plugin is touched, and **Ask the agent to fix it** hands that sentence to the conversation verbatim.

## Starting and stopping

The server file stays `waiting` while its `apply` starts up, and the services it offers reach other plugins only once that succeeds. If it fails, its registrations and resources are undone, and the page shows the fault.

- The switch and `vault-plugins_stop` can stop a plugin still starting up. Stopping interrupts its work, waits for background work and cleanup, and leaves it switched off.
- Losing a service the plugin requires also interrupts start-up, leaves it `waiting`, and names the missing key. When that service comes back, start-up runs again.
- Shutting the server down closes every plugin, and a plugin's cleanup finishes before the service it depends on releases what it was using.
- Cancellation is cooperative: synchronous JavaScript cannot be interrupted, and acquisitions and cleanups marked uninterruptible run to the end. There is no time limit on start-up.
<!-- guide:end -->

</details>
