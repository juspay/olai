# Plugins the directory defines

Everything under `docs/plugins/` is a plugin olai was built with. You can also write one into the directory olai serves, usually a node agent: olai compiles it and mounts it while it is running, once a person approves it with the source in front of them.

Once it is up it is an ordinary row on the plugins panel, with the same states, the same switch and the same reach into the app as a built one.

## Write the definition

A plugin is a node with a `plugin` property and two children:

```
A swatch for hex colours          plugin: swatch
├── server.ts                     ← the server half, in the node's note
└── browser.tsx                   ← the browser half, in the node's note
```

- The `plugin` property's value is the plugin's word: the row's name, the key its wire members are composed under, and what the panel draws. It is a property rather than the title, because a title is prose somebody renames.
- The two halves are notes on child nodes titled `server.ts` and `browser.tsx`. A note is markdown stored verbatim with its newlines, so a whole file lives in one comfortably.
- `browser.tsx` is optional. A plugin that only teaches the directory a property kind, or only rings a doorbell, is a whole plugin.
- Any other child is ordinary outline content, such as notes about the plugin or a to-do, and is passed over.
- An agent writes a definition with `outlines_add`, `outlines_desc` and `outlines_prop`. There is no `.ts` on disk: the source is content in your directory, and it travels, versions and diffs like the rest of it.

## What a half may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the modules inside the running binary, so a face an agent wrote draws with the same Solid the app does. Your directory has no `node_modules`, so anything else is refused when the plugin is defined rather than when it dies:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

Subpaths are also refused (`effect/Schema`, `solid-js/web`), and so is a computed `import()`: what a person approved is the source they read, so every module a plugin uses has to be visible in it. A relative import is refused with its own sentence, since a plugin is two halves and nothing else.

The server half's `@olai/plugin-api` is the runtime door (`Kinds`, `Vault`, `Surfaces`, `Deliveries`); the browser half's is the app door (`Slots`, `Clocks`, `Wired`). One name in the source, and each half gets the door it is written against.

## Give it knobs

A server half may expose a `Config` schema just like a built row. Give every field a decoding default and a description annotation, then pass it as `config` to `definePlugin`; `apply` receives the decoded object.

```ts
import { definePlugin } from "@olai/plugin-api"
import { Effect, Schema } from "effect"
const Config = Schema.Struct({
  tone: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("blue")),
    Schema.annotate({ description: "the colour to draw" })),
})
export default definePlugin({
  name: "swatch", needs: [], config: Config,
  apply: (config) => Effect.logInfo(`swatch tone: ${config.tone}`),
})
```

- Properties on the definition node supply its leaves, and children may supply schema sections. These values belong on this node, not in the shared settings file.
- `plugin` and `approved` are reserved: declaring either in `Config` faults the row, and the panel refuses them as configuration keys.
- The schema's controls appear in the row's detail on the plugins panel (press the chevron beside its name). A ● marks an authored value, ↺ removes the property, and **Saved in** links to the definition.
- A knob edit re-applies the row. An invalid leaf uses its default, warns once, and shows the file text and the schema message beneath its control; an invalid schema fails only that definition.

## Get it approved

Nothing mounts until a person approves it at the plugins panel. The panel draws the definition on its own row, under **Your plugins** once it is running and under **Needs attention** while it is `pending`, with both halves in full and two buttons.

| Button | Writes |
| --- | --- |
| **Approve this version** | `approved: <content hash>` on the plugin's node |
| **Approve always** | `approved: always` |

Both are ordinary property writes: they go through the gate a keystroke does, land on the node beside the source, travel with your files and are in the ledger. There is no settings file and nothing per machine.

An approval names a version, which is a hash of both halves, so an edit to either half puts the row back to `pending`. That is what stops approving once from meaning approving whatever this becomes. `always` is the escape for a plugin somebody is iterating on with an agent.

The panel sends back the version it drew, so an approval of source that moved while you were reading it is refused rather than applied:

```
"swatch" has been edited since this page drew it, so approving it now would
approve source nobody has read. Look again, read what it says, and approve that.
```

> The code runs with the server's own authority. There is no sandbox, and approval by the owner is the boundary — which is why the panel shows you the source, the verb is on the browser face only, and an agent cannot approve its own plugin.

## What happens when it mounts

The server half is compiled, evaluated and mounted as a fiber on the same registry the built rows are on. The kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

Then the served directory is read again, which is what puts a face on values that were already there. Without it the plugin would mount, its kind would be in force, and its chip would not draw until the next keystroke anywhere in your files.

The browser half is compiled to a chunk and served at `/_olai/plugins/<name>-<version>.js`. The tab loads it as it loads a built plugin's chunk and the faces appear without a reload. The version is in the path, so a re-approved edit is a different address and no cache can hand back the code that was approved before the edit.

A half that will not compile, a module that exports no plugin, a half that calls itself a different word, and an `apply` that throws each land the row on `failed`. The sentence that explains it is on the row, and no sibling is touched.

## Check a half before you ask

Every edit changes the version, and every version costs a person a decision, so be sure before you ask. Compile it with the same call the serve makes:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run that from a package that depends on `@olai/plugin-build`; `packages/server` does. It catches every way a half can fail to become a module: a module olai does not bind, a relative import, a computed `import()`, a syntax error.

Then typecheck it: drop the two halves into some package's `src/` and run `bun x tsc --noEmit`.

> The typecheck has one trap. A half writes the bare `@olai/plugin-api` and olai binds each half to a different door, so typechecking a server half as written reports `has no exported member 'Kinds'`. Point that import at `@olai/plugin-api/services` for the duration of the check, and put it back.

`vault-plugins_run` is the third check and the only one that is the real thing: it answers the state, the version and the fault sentence off the same row a person is looking at.

## What an agent can do

| Tool | Answers |
| --- | --- |
| `vault-plugins_inspect` | what a plugin may name: the three modules, the service keys, the slots and their keys, the node layout, and the words already taken |
| `vault-plugins_run` | what became of one definition now: its state, its version, and the fault sentence where there is one |
| `vault-plugins_stop` | unmounts one definition for as long as this serve runs |

- Read `vault-plugins_inspect` before writing code. Service records are marked by half, and `availability` tells a server provision from a browser declaration.
- Its `taken` list is every word this serve has, the build's rows and every definition in the directory alike, because a definition may take neither.
- A definition nobody has approved answers `pending` from `vault-plugins_run`, which is the boundary said back to the author.
- `vault-plugins_stop` reaches definitions only: an agent cannot turn off the row that seats it, the row that watches its writes, or the row whose tools it is holding. Naming a built plugin is answered as no such plugin.
- Defining a plugin needs no tool of its own, and retracting one is `outlines_trash` or removing the `plugin` property. A node in `_olai/Trash.olai` is not a definition.

## Starting and stopping

A server half stays `waiting` while its `apply` initializes, and the services it offers reach consumers only after that succeeds. If it fails, its registrations and resources are unwound and the row shows its fault.

- The panel's switch and `vault-plugins_stop` can stop a half that is still initializing. Stopping interrupts its work, waits for background work and cleanup, and leaves it switched off.
- Losing a required service also interrupts initialization, but leaves the row `waiting` and names the missing key; when that service returns, initialization runs again.
- Shutting the host down closes every plugin, including one with no declared needs, and a dependent's cleanup finishes before the provider releases what it was using.
- Cancellation is cooperative: synchronous JavaScript cannot be preempted, and uninterruptible acquisitions and finalizers finish themselves. There is no per-plugin initialization timeout.
- A switch or a stop lasts as long as the process. What survives a restart is the definition and its approval, which are in your files.

## Share a service with another plugin

A server half can provide a service without changing core's catalogue. Name `Offers` in `needs`, then yield `offers.own("fleet", consumer => ({ ... }))`. olai stamps the key with the offering fiber's name, so a plugin named `fleet-source` offers `fleet-source.fleet`. The callback receives the consumer's own runtime name, so it can return a per-consumer view.

- Both segments must start with a lower-case letter and hold only lower-case letters, digits or hyphens; dots are reserved for the separator.
- A consumer writes `const Fleet = serviceTag<FleetShape>("fleet-source.fleet")`, puts `Fleet` in `needs`, and reads it with `yield* Fleet`. Minting a tag names a dependency; it grants nothing.
- Provider and consumer must agree on the shape themselves. The string key does not check one at runtime.
- The consumer waits until the provider has finished initializing. Removing or replacing a provider unloads the consumer, awaits its cleanup while the old resource is still alive, and reactivates it with the new provision.
- A duplicate offer fails the offering activation and unwinds its registrations. Cordis refuses a second provider for a contested key and names both rows.
- `Offers.own` accepts only the core-defined offerable keys, and the stamp keeps core's own closed: `own("vault", …)` means `your-plugin.vault`.
- `vault-plugins_inspect` lists the keys currently offered beside the core catalogue. A stopped provider's keys disappear, and a consumer may still name a missing key and wait for it.

### A service a browser half offers

Browser halves import `Offers` the same way and publish with `yield* (yield* Offers).own("palette", consumer => ({ ... }))`. A browser consumer declares `serviceTag<Shape>("provider.palette")` in `needs` and yields it in `apply`.

- Browser `Offers` has only `own`, so a plugin cannot replace `Slots`, `Wired` or the shell's furniture. These keys live in the tab, independently of server keys with the same name.
- A provider publishes only after it has initialized. A missing one keeps the consumer waiting with no faces; withdrawal releases those faces before the provider's resources.
- To make a browser key discoverable, the server half names `Offers` in `needs` and calls `yield* (yield* Offers).browser(["palette"])`. Those declarations leave when the server provider unloads, and the call runs no browser code on the server.
- `vault-plugins_inspect` returns each service record with its `key`, its `half`, and an `availability` of `core`, `provided` or `declared`. The panel reports browser waiting and failed states beside the server's, naming the missing key.

## What this is not

- Not a lock. olai refuses a session's write of the `approved` property at its own door, which is what stops an agent approving through olai the plugin it just wrote. It is not a claim about the file: `approved` is an ordinary property, and an approval that appears on disk is an ordinary revision.
- Not a report of what a face did. A face that throws while it is being drawn is contained by the tab's fault boundary, the console says which plugin it was, and the row goes on saying `running`, because on the server it is.
- Not a package. There is no command to add one, no pin and no out-of-tree build: a definition is two notes in a directory olai is already serving.

Two worked definitions, start to finish, are in [dynamic-plugins-examples.md](dynamic-plugins-examples.md).
