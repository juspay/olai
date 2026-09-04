# Plugins the vault defines

Everything else under `docs/plugins/` is a plugin olai was built with. This page is about the other kind: a plugin somebody writes **into the directory olai is serving**, usually a node agent, which olai compiles and mounts while it is running.

A plugin like that is an ordinary row once it is up. It has the same five states on the plugins panel, the same containment when its `apply` throws, the same switch, and the same reach into the app as `kolu` or `journal` — a property kind, a chip on a row, a pane its press opens, a sibling on the wire. What differs is where it came from and that **a person has to say yes to it first**.

## The shape of a definition

A plugin is a node with a `plugin` property, and two children:

```
A swatch for hex colours          plugin: swatch
├── server.ts                     ← the server half, in the node's note
└── browser.tsx                   ← the browser half, in the node's note
```

- the `plugin` property's **value is the plugin's word** — the row's name, the key its wire members are composed under, the word the panel draws. It is the property rather than the title because a title is prose somebody renames, and a row's identity is not.
- the two halves are **notes** on child nodes titled `server.ts` and `browser.tsx`. A note is markdown stored verbatim with embedded newlines, so a whole file lives in one comfortably.
- `browser.tsx` is optional. A plugin that only teaches the vault a property kind, or only rings a doorbell, is a whole plugin.
- any other child is ordinary outline content — notes about the plugin, a to-do — and is passed over.

Nothing about that needs a new write door. An agent writes a definition with `add_node`, `set_desc` and `set_prop`; the subtree fence applies exactly as it does to any other write; and the `.olai` file the nodes live in is committed by the ledger like any other change. There is no `.ts` on the disk, because `.ts` is not a kind of file olai serves — the source is vault content, and it travels, versions and diffs like vault content.

## What a half may import

Three modules, by their bare names:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"
import { createSignal } from "solid-js"
```

olai resolves all three itself, against the modules **inside the running binary** — so a face an agent wrote draws with the same Solid the app does and can read a context a shipped plugin provided. A vault has no `node_modules` and never will, so anything else is refused with a sentence naming it, at the moment the plugin is defined rather than at the moment it dies:

```
olai resolves @olai/plugin-api, effect and solid-js for a plugin it mounts from
a vault, and nothing else — so "left-pad" names nothing this serve can hand
over. A vault has no node_modules.
```

Subpaths are refused too (`effect/Schema`, `solid-js/web`), and so is a computed `import()`: what a person approved is the source they read, so every module a plugin uses has to be visible in it.

The server half's `@olai/plugin-api` is the runtime door (`Kinds`, `Vault`, `Surfaces`, `Deliveries`, …); the browser half's is the app door (`Slots`, `Clocks`, `Wired`, …). One name in the source, and each half gets the door it is written against.

## Approval

Nothing mounts until a person approves it, at the plugins panel, with the source in front of them.

The panel draws a block under the rows for each definition: the two halves in full, and — on a row that is `pending` — two buttons.

- **Approve this version** writes `approved: <content hash>` on the plugin's node.
- **Approve always** writes `approved: always`.

Both are ordinary property writes: they go through the same gate a keystroke does, land on the node beside the source, travel with the vault, and are in the ledger. There is no settings file and nothing per machine.

An approval names a **version**, which is a hash of both halves. So an edit to either half puts the row back to `pending` — which is what stops *approve once* from meaning *approve whatever this becomes*. `always` is the escape for a plugin somebody is iterating on with an agent, where re-approving every edit is a gesture that stops being read after the third time.

The panel sends back the version it drew. If the definition moved while somebody was reading it, the approval is refused rather than applied:

```
"swatch" has been edited since this page drew it, so approving it now would
approve source nobody has read. Look again, read what it says, and approve that.
```

**The code runs with the server's own authority.** There is no sandbox and this is not pretending to be one: approval by the owner is the boundary. That is why the panel shows the source, why the verb is on the browser face only, and why an agent cannot approve its own plugin.

## What an agent can do

Three tools, on the agent face:

- **`plugins.inspect`** — what a plugin may name: the three modules, the service keys a server half may put in its `needs`, the slots a browser half may register a face into, the node layout above, and the words already taken. Read this before writing code; it is the live registry rather than a description of one.
- **`plugins.run`** — ask olai to look at a definition now and say what became of it. A definition nobody has approved answers `pending`, which is the boundary said back to the author.
- **`plugins.stop`** — unmount one, for as long as this serve runs. It reaches **definitions only**: an agent cannot turn off the row that seats it, the row that watches its writes, or the row whose tools it is holding.

Defining a plugin needs no tool of its own — it is `add_node` and `set_desc`. Retracting one is `trash_node`, or removing the `plugin` property: the row goes on the next revision and the fiber unwinds every registration it made.

## What happens when it mounts

The server half is compiled, evaluated, and mounted as a fiber on the same registry the bundle's rows are on. Everything downstream follows the way it does for a built row: the kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

The browser half is compiled to a chunk and served at `/_olai/plugins/<name>-<version>.js`. The roster carries that URL, the tab loads it exactly as it loads a built plugin's chunk, and the faces appear **without a reload**. The version is in the path, so a re-approved edit is a different URL and no cache can hand back code that was approved before the edit.

A half that will not compile, a module that exports no plugin, a half that calls itself a different word, and an `apply` that throws all land the row on `failed` with the sentence that explains it, and touch no sibling.

## A worked example

A dressing for a `hex` property — a swatch beside the value.

`server.ts`:

```ts
import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "swatch",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({ kind: "hex", takes: "text", admits: (value) => /^#[0-9a-f]{6}$/i.test(value) })
  }),
})
```

`browser.tsx`:

```tsx
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

const Swatch = (props: { readonly value: string }) => (
  <span style={{ background: props.value }} class="inline-block h-3 w-3 rounded" />
)

export default definePlugin({
  name: "swatch",
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", "hex", Swatch)
  }),
})
```

The kind word a vault then declares is `swatch-hex`: a plugin contributes the bare word and the registry composes it with the plugin's own name, exactly as it does for a built plugin's kinds. Both halves declare the same `name`, and it has to be the word the node's `plugin` property carries — a half that signed another word would be a fiber bound under a name no row draws.

## What this is not

- **Not sandboxed.** See above. Approval is the boundary.
- **Not persisted enablement.** A `plugins.stop`, or the panel's switch on a definition, lasts as long as the process. What survives a restart is the definition and its approval, which are in the vault.
- **Not a package.** There is no `olai plugin add`, no npins pin and no out-of-tree build. A definition is two notes in a directory olai is already serving.
