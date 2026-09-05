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

- **`inspect_plugins`** — what a plugin may name: the three modules, the service keys a server half may put in its `needs`, the slots a browser half may register a face into with what keys each, the node layout above, and the words already taken. Read this before writing code; it is the live registry rather than a description of one. `taken` is every word this serve has — the build's rows **and** every definition in the vault, including ones other agents wrote — because a definition may take neither.
- **`run_plugin`** — ask olai to look at a definition now and say what became of it: the state, the version, and the fault sentence where there is one. A definition nobody has approved answers `pending`, which is the boundary said back to the author.
- **`stop_plugin`** — unmount one, for as long as this serve runs. It reaches **definitions only**: an agent cannot turn off the row that seats it, the row that watches its writes, or the row whose tools it is holding.

(On the wire those are `plugins.inspect`, `plugins.run` and `plugins.stop`; the tool names are the agent-facing words, the way `commit` is `git.commit`.)

Defining a plugin needs no tool of its own — it is `add_node` and `set_desc`. Retracting one is `trash_node`, or removing the `plugin` property: the row goes on the next revision and the fiber unwinds every registration it made. A node in `_olai/Trash.olai` is not a definition — the reader skips what was put away, the way every other live reading of the tree does.

## What happens when it mounts

The server half is compiled, evaluated, and mounted as a fiber on the same registry the bundle's rows are on. Everything downstream follows the way it does for a built row: the kind vocabulary gains its words, a sibling surface reaches the wire, the roster moves, and every open tab redials.

**And the vault is read again.** Approving writes one property; nothing else on disk moved, and the reading every page is drawn from was validated a revision ago — before the fiber existed and so before the word did. So the mount is followed by a re-read of the served directory, which is what puts a face on values that were already there. Without it a plugin would mount, its kind would be in force, its values would be held to it, and its chip would not draw until the next keystroke anywhere in the vault. This is the same re-read the plugins panel's switch has always done, in the other direction: a plugin switched off takes its words with it, and its values have to go back to being plain text on the same press.

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

const Swatch = (context: { readonly entry: { readonly value: string } }) => (
  <span style={{ background: context.entry.value }} class="inline-block h-3 w-3 rounded" />
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

**A face is handed a context, not a value.** `outline.row.chip` takes a `ChipContext` — `entry` (the property's `key`, its `value`, its `values`), `opened`, `onToggle`, `chrome` — so the value you draw is `context.entry.value`. A face that reads `props.value` gets `undefined` and fails silently in the worst way available: it compiles, it mounts, the row says `running`, and the chip is invisible. `inspect_plugins` names the slots and what keys each; the shapes are `@olai/plugin-api`'s `plugin.ts`.

**The kind word is `swatch-hex`, and it is CLAIMED rather than declared.** A plugin contributes the bare word and the registry composes it with the plugin's own name, exactly as for a built plugin — and that composed word is claimed by the registration, so `shade: "#ff8800"` is held to it with no `_olai/Properties.olai` in the vault at all. That is the whole of what a definition's author has to do.

What you cannot do is *declare* it. A `type` in `_olai/Properties.olai` is judged against what the BINARY was built with, and that list is read off the bundle's rows — a definition is in no row and teaches its word by calling `Kinds.register` at mount, so `{"title":"colour","custom":{"type":"swatch-hex"}}` is refused. The asymmetry is real and currently one-way: a compiled-in plugin's kind can be pointed at a key of the vault's own choosing, a definition's cannot. Use the claimed word as the key.

Both halves declare the same `name`, and it has to be the word the node's `plugin` property carries — a half that signed another word would be a fiber bound under a name no row draws.

## Checking a half before you ask

Every edit changes the version, and every version costs a person a decision. So be sure before you ask. Two checks, and one trap.

**Compile it** — the same call the serve makes, so the answer is the answer:

```ts
import { buildHalf } from "@olai/plugin-build"
console.log(await buildHalf("browser", source))   // { ok: true, text } | { ok: false, why }
```

Run it from a package that depends on `@olai/plugin-build` (`packages/server` does). This catches every way a half can fail to become a module: a module olai does not bind, a relative import, a computed `import()`, a syntax error.

**Typecheck it** — drop the two halves into some package's `src/` and `bun x tsc --noEmit`.

**The trap in the second one.** A half writes the bare `@olai/plugin-api` in both files and olai binds each to a different door: a server half to `./services`, a browser half to the root. So typechecking a *server* half exactly as written reports `has no exported member 'Kinds'` — and that error is the **check** being wrong, not your source. Point the import at `@olai/plugin-api/services` for the duration of the typecheck, and put it back.

`run_plugin` is the third check and the only one that is the real thing: it answers the state, the version and the fault sentence off the same row a person is looking at.

## What this is not

- **Not sandboxed.** See above. Approval is the boundary.
- **Not a lock, and the fence has a shape.** olai refuses a session's write of the `approved` property at its own door — that is a real refusal, with a sentence, and it is what stops an agent approving the plugin it just wrote *through olai*. It is not a claim about the file. `approved` is an ordinary property in a `.olai` in the served directory, the store watches that directory, and an approval that simply *appears* there is an ordinary revision. The agents this is about are processes on the same host with their own file and shell tools. The vault is the owner's directory: treating it as an attack surface leads somewhere silly, and olai does not pretend to police what it does not serve. What the fence covers is writes through olai's door (ruled, 2026-09-04).
- **Not a report of what the FACE did.** A half whose `apply` throws lands the row on `failed` with its own sentence, on the server. A face that throws while it is being *drawn* does not: the tab's fault boundary contains it the way it contains a shipped plugin's, the console says which plugin it was, and the row goes on saying `running` — because on the server it is. That is the same gap every built plugin has, and closing it wants a field on the roster row's browser reading rather than a console line, so it is written down here rather than built in this lane.
- **Not persisted enablement.** A `plugins.stop`, or the panel's switch on a definition, lasts as long as the process. What survives a restart is the definition and its approval, which are in the vault.
- **Not a package.** There is no `olai plugin add`, no npins pin and no out-of-tree build. A definition is two notes in a directory olai is already serving.

## Initialization and stopping

A server half stays `waiting` while its `apply` initializes. Services it offers
become available to consumers only after initialization succeeds. If it fails,
its acquired registrations and resources are unwound and the row shows its fault.

The panel's switch and `plugins.stop` can stop a half that is still initializing.
Stopping interrupts its Effect work, waits for background work and cleanup, and
then leaves it switched off. Losing a required service also interrupts
initialization, but leaves the row `waiting`, naming the missing service; when
that service returns, initialization runs again. Host shutdown closes every
plugin, including one with no declared needs. Dependent cleanup finishes before
the provider releases the resources those dependents use.

Cancellation is cooperative: synchronous JavaScript cannot be preempted in this
process, and uninterruptible acquisitions and finalizers must finish themselves.
There is no per-plugin initialization timeout.
