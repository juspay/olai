# Plugins the directory defines

Ask for a plugin of your own. An agent writes it into the directory olai serves, and olai compiles and mounts it while it runs, once you approve it.[^built]

## Ask for one

1. Press `Cmd` + `K` (`Ctrl` elsewhere) and choose **New plugin**. Say in one sentence what it should do.
2. Name it.[^name]
3. Watch it arrive on its own page at `/plugins/hex-swatch`.[^watch]
4. Read it and press **Turn on**. The faces appear with no reload.

## Find your way to one

Three doors open the same two levels, and all three are there before you have any plugin at all.[^sidebar]

| Door | Where |
| --- | --- |
| **New plugin** in the palette | `Cmd` + `K`, by name |
| The `+` on the **Plugins** heading | the sidebar |
| **New plugin** at the top of the panel | the health dot, then **Plugins** |

## Read it, then turn it on

The plugin's page says what it is in words before code, and shows you the source.[^page] An approval names a version.[^version]

> The code runs with the server's own authority. There is no sandbox, and your approval is the boundary. That is why the verb is on the browser face alone.

## Where your answer is kept

`on`, `approved`, the conversation building it and the plugin's own knobs are properties on a root node titled with the plugin's word in `_olai/Settings.olai`, the file every built plugin keeps its settings in.[^reserved][^travels]

Two worked plugins, start to finish, are in [dynamic-plugins-examples.md](dynamic-plugins-examples.md).

[^built]: Every page under [Plugins](index.md#plugins) is a plugin olai was built with. The ones here are yours, written into the directory by an agent.

[^name]: Naming a new plugin: olai suggests one from your sentence, and the level under the box says where it is kept, `Kept in your vault as plugins/hex-swatch/`. A name another plugin has, or one that is not a word, is refused while you type.

[^watch]: The press lands on the plugin's own page, the conversation building it in the agent panel beside, and the page lists the files as they arrive. On a phone, and on a serve with no agent panel, the page links to the conversation's own page instead. The conversation is an ordinary one under **Chats**: close the panel, come back tomorrow, and an alert tells you when it wants you.

[^sidebar]: The **Plugins** section of the sidebar lists one row per plugin once you have one, and a single row reading **Ask for your first plugin…** while you have none. A row carries a mark only when it wants something from you: `Review` for a version nobody has read, `Problem` for one that will not start, and a moving dot while an agent is still writing the folder. A plugin that is switched off is drawn dim.

[^page]: The plugin's page opens with the title and first line of its `README.md`, then **What it uses**, read off the code's own imports. The files are under that, one tab each, beside the folder they are in. The knobs it declares sit under **Settings**, and **Ask for a change** opens the conversation that built it.

[^version]: A version is a hash of the two code files. An edit to either one pauses the plugin, unmounts it, and shows you a diff against what you approved. Editing the `README.md` changes nothing, because prose is not code. All three approvals carry the version the page drew, so one made over source that moved is refused rather than applied.

[^reserved]: `on`, `approved`, `builder` and `checked` are reserved. A `Config` declaring one faults the plugin, and `plugins.configure` refuses to write one. `checked` is the version the building conversation last finished at, written by olai when that call comes in. A plugin that could write it would be a plugin that declares itself finished.

[^travels]: A folder copied in from another directory arrives off and unapproved, because the code travels and your answer does not. The switch survives a restart, and so does a stop: `on: no` is a line in a file.

<details>
<summary>The verbs on the plugin's page, and an approval that is refused</summary>

| Verb | What it writes |
| --- | --- |
| **Turn on** | `approved: <version>` and `on: yes`, in one write |
| **Always trust changes**, under `•••` | `approved: always`, and nothing else |
| **Stop trusting changes**, in its place | the version that is running |
| **Delete…**, under `•••` | removes the folder's files and the plugin's settings node |

The refusal:

```
"hex-swatch" has been edited since this page drew it, so approving it now would
approve source nobody has read. Look again, read what it says, and approve that.
```

</details>

<details>
<summary>What olai tells you, and what it keeps quiet</summary>

A plugin is a thing you ask for and walk away from, so three moments reach you wherever you are: as a system notification, as the sidebar's mark, and on the page.

| Moment | What has happened |
| --- | --- |
| **Ready for you** | the agent called `vault-plugins_run` at the version on disk and got no fault back |
| **Paused** | a plugin that was running stopped, because its code changed |
| **Couldn't start** | an `apply` that threw, or a half that will not compile |

Nothing else rings. A plugin going on is not news, because you pressed the button, and one being built is not news, because you asked for it a minute ago.

</details>

<details>
<summary>The settings node, and what a plugin is not</summary>

```
hex-swatch            on: yes
                      approved: 3fa9c1d2b7e45610
                      builder: n-7f3a
                      checked: 3fa9c1d2b7e45610
                      size: large
```

- Not a lock. olai refuses a session's write of `approved` at its own door, which is what stops an agent approving the plugin it has just written. `approved` is an ordinary property, and one that appears on disk is an ordinary revision.
- Not a report of what a face did. A face that throws while it is drawn is contained by the tab's fault boundary, the console says which plugin it was, and the plugin goes on saying `running`, because on the server it is.
- Not a package. There is no command to add one, no pin and no build outside the tree: a plugin is a folder in a directory olai is already serving.

</details>

<details>
<summary>The guide an agent follows to write a plugin</summary>

<!-- guide:start -->
## The folder

A plugin the directory defines is a folder under `plugins/`, and the folder's name is the plugin's word:

```
plugins/hex-swatch/
  README.md     what it does, for a person
  server.ts     required
  browser.tsx   optional
```

- The word takes the same shape a built plugin's name does, `[a-z][a-z0-9-]*`, and may not be a word this serve already has. A folder named anything else is drawn with a sentence saying so rather than compiled.
- `README.md` is a `# Title`, a blank line, one sentence, then as much prose as the plugin deserves. The heading is what the plugin is called on screen and the first paragraph is the line under it.
- `server.ts` is required. A plugin that teaches the directory a property kind, or rings a doorbell at seven, is a whole plugin.
- `browser.tsx` is optional, and is the half that draws.
- Anything else in the folder is ordinary content and is passed over.

The two code files are claimed by olai only under `plugins/`, so a checkout somebody keeps beside their notes is untouched. They are kept text: the revision holds them, the ledger records them, and the commit panel lists them by path. They are not rows in the sidebar's **Reference** tree, because the plugin's page is where they are read. The path of one is an address onto that page: `/plugins/hex-swatch/server.ts` opens the plugin at that file.

## What a half may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the modules inside the running binary, so a face an agent wrote draws with the same Solid the app does. The directory has no `node_modules`, so anything else is refused when the plugin is read rather than when it dies:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

Subpaths are also refused (`effect/Schema`, `solid-js/web`), and so is a computed `import()`: what a person approved is the source they read, so every module a plugin uses is visible in it. A relative import is refused with its own sentence, since a plugin is two halves and nothing else.

The server half's `@olai/plugin-api` is the runtime door (`Kinds`, `Vault`, `Surfaces`, `Deliveries`), and the browser half's is the app door (`Slots`, `Clocks`, `Wired`). One name in the source, and each half gets the door it is written against.

## Give it knobs

A server half may expose a `Config` schema just as a built plugin does. Give every field a decoding default and a description annotation, then pass it as `config` to `definePlugin`; `apply` receives the decoded object.

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

- The leaves are properties on the plugin's node in `_olai/Settings.olai`, beside `on` and `approved`.
- The controls appear under **Settings** on the plugin's page and in its row on the plugins panel. A ● marks an authored value and ↺ removes the property.
- A knob edit re-applies the plugin and asks nobody for a fresh approval, because a setting is not source.
- An invalid leaf uses its default, warns once, and shows the file text and the schema message under its control.

## What an agent can do

| Tool | Answers |
| --- | --- |
| `vault-plugins_guide` | this guide, shipped inside the binary |
| `vault-plugins_inspect` | what a plugin may name: the three modules, the service keys, the slots and their keys, the folder layout, and the words already taken |
| `vault-plugins_write` | writes one file of one plugin, and says whether that half compiles |
| `vault-plugins_run` | what became of one plugin now: its state, its version, and the fault sentence where there is one |
| `vault-plugins_stop` | switches one off for good, by writing `on: no` |

- Read `vault-plugins_inspect` before writing code. Service records are marked by half, and `availability` tells a server provision from a browser declaration.
- Its `taken` list is every word this serve has, the built plugins and every folder under `plugins/` alike, because a new plugin may take neither.
- `vault-plugins_write` creates the folder if it is not there. It is the whole vocabulary needed to write a plugin: no paths, no claim rules, no guessing which file is which.
- A plugin nobody has approved answers `pending` from `vault-plugins_run`. That is the boundary said back to its author, and the right thing to do with it is to say so and stop.
- `vault-plugins_stop` reaches these plugins only. Naming a built one is answered as no such plugin.

## Check a half before you ask

Every edit changes the version, and every version costs a person a decision, so be sure before you ask.

Write it with `vault-plugins_write`, which answers that half's compile result in the same reply. That makes the loop one call rather than a write and a guess. Or compile it by hand with the call the serve itself makes:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run that from a package that depends on `@olai/plugin-build`; `packages/server` does. It catches every way a half can fail to become a module: a module olai does not bind, a relative import, a computed `import()`, a syntax error. Then typecheck the two files with `bun x tsc --noEmit`.

> The typecheck has one trap. A half writes the bare `@olai/plugin-api` and olai binds each half to a different door, so typechecking a server half as written reports `has no exported member 'Kinds'`. Point that import at `@olai/plugin-api/services` for the duration of the check, and put it back.

## Say when you are finished

`vault-plugins_run` is the last check and the only one that is the real thing: it answers off the same plugin a person is looking at. It is also how you say the build is over.

Until that call comes in, the plugin's page says it is being built and nothing wakes anybody. A file landing cannot mean finished, because this guide has you write `browser.tsx` last. Call it when the folder is whole, at the version on disk, and the person is told the plugin is ready for them.

Call it again after every fix. Each call is about the version it was made at, and only a call with no fault in its answer ends the build. A mistake you found and fixed wakes nobody. olai writes that version onto the plugin's settings node, so a build that finished before a restart is still finished after one.

## Share a service with another plugin

A server half can provide a service without changing core's catalogue. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. olai stamps the key with the offering plugin's name, so a plugin named `fleet-source` offers `fleet-source.fleet`. The callback receives the consumer's own name, so it can return a view per consumer.

- Both segments start with a lower-case letter and hold only lower-case letters, digits or hyphens. Dots are the separator.
- A consumer writes `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")`, puts `Fleet` in `needs`, and reads it with `yield* Fleet`. Minting a tag names a dependency and grants nothing.
- Provider and consumer agree on the shape themselves. The string key checks none at runtime.
- The consumer waits until the provider has finished initializing. Replacing a provider unloads the consumer, awaits its cleanup while the old resource is still alive, and starts it again on the new one.
- A duplicate offer fails the offering plugin and unwinds its registrations. Cordis refuses a second provider for a contested key and names both.
- `vault-plugins_inspect` lists the keys offered now beside the core catalogue. A stopped provider's keys disappear, and a consumer may name a missing key and wait for it.

### A service a browser half offers

Browser halves import `Offers` the same way and publish with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser consumer declares `serviceTag<Shape>("provider.palette")` in `needs` and yields it in `apply`.

- Browser `Offers` has only `own`, so a plugin cannot replace `Slots`, `Wired` or the shell's furniture. These keys live in the tab, apart from server keys of the same name.
- A provider publishes only after it has initialized. A missing one keeps the consumer waiting with no faces, and withdrawal releases those faces before the provider's resources.
- To make a browser key discoverable, the server half names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. Those declarations leave when the server provider unloads.

## What happens when it mounts

The server half is compiled, evaluated and mounted as a fiber on the same registry the built plugins are on. The kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

Then the served directory is read again, which is what puts a face on values that were already there. Without it the plugin would mount, its kind would be in force, and its chip would not draw until the next keystroke anywhere in your files.

The browser half is compiled to a chunk and served at `/_olai/plugins/<word>-<version>.js`. The tab loads it as it loads a built plugin's chunk and the faces appear without a reload. The version is in the path, so a re-approved edit is a different address and no cache can hand back the code approved before the edit.

The serve keeps the last chunk each word served, so a tab still fetching one while the plugin stops gets the bytes that path named rather than a 404.

A half that will not compile, a module that exports no plugin, a half that calls itself a different word, and an `apply` that throws each land the plugin on `failed`. The sentence that explains it is on the page and on the row, no sibling is touched, and **Ask the agent to fix it** hands that sentence to the conversation verbatim.

## Starting and stopping

A server half stays `waiting` while its `apply` initializes, and the services it offers reach consumers only after that succeeds. If it fails, its registrations and resources are unwound and the page shows its fault.

- The switch and `vault-plugins_stop` can stop a half that is still initializing. Stopping interrupts its work, waits for background work and cleanup, and leaves it switched off.
- Losing a required service also interrupts initialization, leaves the plugin `waiting` and names the missing key. When that service returns, initialization runs again.
- Shutting the host down closes every plugin, and a dependent's cleanup finishes before the provider releases what it was using.
- Cancellation is cooperative: synchronous JavaScript cannot be preempted, and uninterruptible acquisitions and finalizers finish themselves. There is no per-plugin initialization timeout.
<!-- guide:end -->

</details>
