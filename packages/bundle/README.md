# @olai/bundle — which plugins this build has

olai integrates with two things that are not olai. [kolu](https://kolu.dev) runs coding agents in terminals and serves them to an agent over MCP; [odu](https://github.com/juspay/odu) runs CI. Both were extracted into packages of their own once — [`@olai/kolu-client`](../kolu-client/README.md), `@olai/kolu-ui` and [`@olai/odu-client`](../odu-client/README.md) — and both left a residue behind in the packages that are supposed to know nothing about them: a `kolu.ts` in `@olai/chat`, a `koluConfig.ts` and a `claimants.ts` in `@olai/server`, a named `wiring.kolu` slot with a `koluHalf(…)` call beside it, four `...koluMembers` spreads in the middle of the wire spec, a row per plugin member in the server's expose map, a `padi/` folder in `@olai/web`, and one property key spelled at seven sites across four packages.

That residue is not sloppiness. It is the part that genuinely was **olai's own judgement about an appliance** — what an absent padi means, which vault file is kolu's by convention, which property wears which face. What was missing is a place to put a judgement about an appliance that is neither the appliance nor the core. **`packages/plugin-api/` is that place** — the INTERFACE a plugin is written against — and **this package is the list of which plugins there are**. The two were one for several rounds and split when a server half became a Cordis plugin: it imports the interface for the services it injects, and a package that both names every plugin and is named by every plugin is a cycle the manifests cannot express. The tenants that stand on both — [`olai-plugin-kolu`](../plugins/olai-plugin-kolu/README.md) and [`olai-plugin-odu`](../plugins/olai-plugin-odu/README.md) — live one directory over, in `packages/plugins/`, and `@olai/kolu-ui` is not a package any more: the appliance fold made it `src/appliance/` inside the kolu tenant, so an appliance is TWO packages (its dial, and everything olai says and draws about it) rather than three.

## A plugin is two halves

BOTH HALVES ARE CORDIS PLUGINS — `name`, `inject`, `apply(ctx)` — named by one row in [`olai.yml`](olai.yml): the server's is mounted by the loader, the browser's is fetched as its own chunk when the roster names it. The browser half used to be a VALUE, an `OlaiPlugin` manifest listed in a compiled-in registry. The object could not survive the tab following the roster: a manifest is present whether or not the serve composed the plugin, so every walk over it carried a LICENCE beside it — and the two licences pointed opposite ways (a face drawn early and taken away is a flicker; a subscription opened early latches a `degraded` readout for the life of the page). A fiber the roster never named registers nothing, so there is nothing left to license. Between them a plugin contributes:

| | what it is | where |
| --- | --- | --- |
| `name` | the namespace, the preferences row, the docs page's address, the row's `id`, the fiber's name, and the word `--plugins` takes — one spelling | both |
| `surface` | a **whole surface of its own**, declared in its own package with its own member names — core composes it as a SIBLING under `name` | `./wire` |
| `faces` | which face may see which of its members, its own `ExposeMap` per face, written against its own spec | `./wire` |
| `inject` | the services this plugin's server half needs. The runtime holds its fiber `PENDING` until they exist | `./server` |
| `apply(ctx)` | where every registration below is made, and where the appliance's client is called. Each one carries its own undo | `./server` |
| `ctx.kinds.register` | property KINDS the vault may declare, handed to [`@olai/format`](../format/README.md) as data — the format imports no plugin. The word is composed from the fiber's name | `./server` |
| `ctx.surfaces.register` | the sibling, its faces, the deps that implement it, and an optional hand-back for its own write face | `./server` |
| `ctx.wakes.register` | what the strip's doorbell control says, and the two sentences a broken scope is owed | `./server` |
| `chat/session-start` | find the tool, and say in **whole sentences** what a chat session is owed when it is not here. Absence is a **state**, not an error. On the server half for a sharp reason: a probe starts a subprocess | `./server` |
| `ctx.slots.register` | WHERE A FACE HANGS: six declared slots, keyed by the plugin (`app.header`, `app.mount`, `chat.speaker.mark`) or by a property KIND (`outline.row.chip`, `.pane`, `.block`). Each registration is an `ctx.effect`, so a plugin the roster stops naming unwinds its own faces | `./browser` |
| the DRESSINGS | what a live property wears in the browser — a chip beside the value, the pane it opens, or a block that owns a row — registered into the three kind-keyed slots. Looked up by the declared **kind**, the same word `PropKind` contributes: the page carries the licence as an answer per drawn value, so the browser follows the declaration without one ever travelling | `./browser` |
| the CHROME | a header readout in the app's bar, and the drawer its press opens | `./browser` |
| the MOUNT | the tab's own half, wrapped around the page once — one subscription however many leaves draw | `./browser` |
| the MARK | the plugin's FACE: the shapes drawn over a sentence it delivered into a conversation. The chat panel names the speaker of every run of messages and looks this up by the name core stamped on the row, so a plugin arrives wearing its own face and no general package holds a table of them. Takes no argument at all — a mark is a glyph at the size of the line it sits on — and answers with a `<g>` in a `0 0 16 16` box, because the marks are read as a column and the app owns the size | `./browser` |

Everything but the name and the surface is optional, and the absent arm of each is the state a machine without the tool already shows.

## One generic door

Core's API does not carry *list the terminals*. Each plugin hands over a **whole surface**, declared in its own package with its own member names on it, and the framework composes it as a **sibling** under the plugin's name:

```
core       surface/outlines/get        ← byte-unchanged
kolu       surface/kolu/fleet/get      ← declared `fleet`, in olai-plugin-kolu
odu        surface/odu/ci/get          ← declared `ci`, in olai-plugin-odu
```

**No general package computes any of those addresses.** `composeSurfaceContracts` re-walks each sibling's spec at `surface/<key>/`, and the key is the plugin's own `name` — so the name and every tag it appears in cannot drift apart, and core knows a plugin's name and nothing else about what is behind it.

Core does **not** become a sibling, which is the reading that would have moved an address an MCP client already writes. Its tags keep three segments and a sibling.s have four, and the two ride ONE WIRE as a **rooted bundle** — the framework.s own shape end to end (juspay/kolu#2222, #2223): `implementRootedSurfaces` where a server composes, `mount(key, surface, deps)` when a sibling arrives, `exposeRootedFaces` where it gates, `connectSurfaces`. `core` slot where a browser dials. The serve side needed a door of its own because the roster MOVES: a plugin is a fiber, and re-implementing the whole map over the survivors — the shape a consumer reaches for when the framework has no door — silently forks every survivor.s handler values, cell stores, channels and running sources. The fusion is safe by construction — the framework forbids a `/` inside a name, so a three-segment set and a four-segment set cannot intersect — and it is counted anyway, because the merge underneath is a last-writer-wins `Map.set` and a silently dropped tag is a member that answers nothing with nobody told. This package spelled the merge and the face union for itself for one PR window and the composition root spelled five more for another; [`src/mechanics.test.ts`](src/mechanics.test.ts) is the standing lint that neither spells any of them now.

A first attempt put a separator inside **member names** instead, and the way it was wrong is worth keeping: a member name is not a namespace. `@kolu/surface` mints channel names, MCP resource paths and tool names out of one, so a punctuated member aliases another member's channel, has to be percent-encoded to be read as a resource, and produces a tool name outside the character set a strict MCP host accepts. `/` is refused loudly by `assertTagSegment`; `.` is refused **quietly**, which is worse — a dotted member compiles, mounts and serves, and then `classifyExpose` reads every dotted key as `<namespace>.<verb>` and the server dies at boot with *"expose names procedure … but the spec has no such procedure"*. The framework already owned the axis; taking the offer is the whole of this design.

## The registry is a row, and the browser's lists are WRITTEN from it

[`olai.yml`](olai.yml) is the SERVER's list: one row per plugin, an `id` and the module the loader mounts. It is DATA, and that is what makes `--plugins` a `disabled` **patch** over rows — through `@cordisjs/plugin-include`, the loader's own overlay mechanism — rather than a `.filter` somewhere in code. [`src/bundle.ts`](src/bundle.ts) mounts it and supplies the module-resolution seam the loader needs, because a bare `import()` from inside `node_modules/@cordisjs/plugin-loader` cannot see a workspace member under the isolated linker.

The browser had two lists of its own for several rounds — a `src/registry.ts` listing the manifests and a `src/surfaces.ts` listing the wire halves, both hand-written, both static imports under an `as const` literal, both obliged to name every plugin `olai.yml` named, and a `src/rosters.test.ts` holding the three equal. The argument written on them was that they HAD to be source files: the framework infers a surface spec as a **literal**, and a list assembled at runtime widens every member to its base type and takes with it the `arrayKey` a browser's merge reads, the `equals` a quiet frame rests on, the read-only narrowing of `verbs`, and every typed accessor a client has — and a browser bundle is built ahead of time, with no loader in the tab to resolve a name at mount. Every clause of that is still true. What was wrong is what it argued FOR. A test whose whole job is to notice that somebody edited two lists of three is a monument to the duplication and not a fix for it, and the bar this repo holds is that olai is one app: a change that finishes the server half and covers the seam with a test does not merge.

What the tab genuinely cannot do is resolve a specifier it COMPUTES — a bundler splits on a literal `import()` and nothing else, so `` import(`olai-plugin-${id}`) `` would neither split nor resolve. That is a reason to WRITE the literal rather than to keep writing it by hand, at the one moment a program can still emit one: [`generate.ts`](generate.ts) reads the rows and emits three files, because a plugin's name is spellable in three grammars — `src/rows.generated.ts` (one row per plugin with a dynamic `import()` of its browser half), `src/all.generated.css` (the stylesheet chain, because a CSS `@import` is a door a name can be spelled through) and `src/testids.generated.ts` (the merged testid table, keeping the pairwise disjointness proof the hand-written merge carried). All three are gitignored and produced beside the hydrated sources — `just install` runs the generator and so does the nix build's `postBunNodeModulesInstallPhase` — so a packaged build is structurally incapable of shipping a stale one. `src/registry.ts`, `src/surfaces.ts` and `src/rosters.test.ts` are gone with the lists they were about.

The literal that survives is a specifier and not a type, and that is the price paid: the compiled-in tuple used to recover a per-key surface type, so each sibling's client was typed by its own spec, and a chunk loaded by a name that is DATA cannot carry that. Nothing downstream wanted it — `ctx.wired.client()` is `unknown` by design, because core cannot type a plugin's client without learning its members, and every plugin narrows it once at its own edge against a shape it declares itself (`@olai/web`'s `client/wire.ts` is where the one cast is spelled, and says so).

A third party adding a plugin therefore still rebuilds olai, and the browser is why: chunks are built ahead of time. In-tree it is now ONE ROW and nothing else a person edits, and the seam an out-of-tree `olai plugin add` lands on is already there — a row's `name` is a specifier the loader resolves at mount, so the remaining work is writing a row into a profile rather than anything in this package.

## Two doors by graph, and two by name

Two doors because two **graphs** — and it was three. What is behind them is no longer three arrays and not even one: the SERVER's list is `olai.yml`, and the BROWSER's is [`generated from it`](generate.ts) at build time. So a third plugin is **one row**, and the lid that used to hold three lists equal (`src/rosters.test.ts`) is gone with the lists it was a monument to.

The root door is where the collapse happened, and the graph got EMPTIER rather than fuller: it is one row per plugin carrying a dynamic `import()` of that plugin's browser half, so nothing behind it statically imports a plugin, each plugin is its own **chunk**, and a chunk is fetched only when the roster names it. That is the browser's exact twin of *no fiber, no surface, no handler*: a plugin this serve did not compose is not merely undrawn — it is never fetched, never evaluated and registers nothing. [`src/fence.test.ts`](src/fence.test.ts) holds both halves: the door names every plugin (in a literal specifier a bundler can split on) and crosses into none of them. What that buys is measurable — kolu's terminal emulator is a 344 KB chunk that a machine not running kolu never downloads.

| door | who opens it | what it may carry |
| --- | --- | --- |
| `.` | [`@olai/web`](../web/README.md)'s `client/wire.ts`, which loads the chunks the roster names, dials them and composes them; and `@olai/server`'s `pluginPolicy.ts` for the one question a flag asks before anything mounts | the ROWS — an `id` and a thunk each — and the names off them. NO plugin's code is on this graph: the thunk's specifier is a string until somebody calls it, so a face, the SolidJS it is written in and the terminal emulator behind kolu's are all on a chunk this door merely NAMES. It used to be `./wire` and `.` — the browser-safe wire half and the manifests whole — and they collapsed into one because the graph got EMPTIER |
| `./bundle` | [`@olai/server`](../server/README.md)'s composition root | the rows, the loader, the `--plugins` patch and the resolver. NO plugin's code is on this graph either: a row's `name` is a specifier the loader resolves at mount |

The plugin's own `./server` is the fourth graph and it is not a door of THIS package: the row names it and the loader mounts it. The fence walks it anyway, as each row's module, and holds it to the same rule it always did — a server may pull an appliance's client, the vault's format and `node:` builtins, and may never pull a browser face.

One door for all of them would put a component on the graph of a process that renders nothing and a daemon's whole contract on the browser's, which is exactly what [`@olai/kolu-client`](../kolu-client/README.md)'s own fence exists to prevent one floor down. [`src/fence.test.ts`](src/fence.test.ts) walks each closure rather than trusting the table.

Two more doors exist and neither is a graph. They are here because the fence is about a **name in any grammar**, and a general package may spell none:

| door | why it routes through here |
| --- | --- |
| `./all.css` | each plugin's stylesheet, chained. A CSS `@import` is a door a plugin's name can be spelled through — the fence reads a `.css` file's imports for exactly that reason — so `@olai/web`'s `styles.css` names this and no tenant. Each sheet carries a `@source` at its own faces, because Tailwind emits only what it can SEE and a component outside the app's scan path renders with **no layout while nothing errors** |
| `./testids` | each plugin's names-only testid table, merged and asserted **disjoint** ([`src/testids.test.ts`](src/testids.test.ts)) — a spread would resolve a collision silently, and a scenario asserting on the wrong package's element is green about nothing. `@olai/tests` may not name a plugin either, and the door carries no component, so a suite with no browser in it never pulls SolidJS or an emulator |

## The direction is physics

`@olai/bundle` imports every plugin. **No plugin imports it back** — which is a claim the manifests express, so a cycle is not a rule a reviewer remembers but a thing `bun install` cannot describe. What a plugin DOES import is [`@olai/plugin-api`](../plugin-api/README.md), the interface, which names no plugin: that arrow runs one way, and it is why the two are separate packages at all.

The browser manifest is still a plain `as const` object proved HERE, by `satisfies`, which is the same structural agreement `@olai/ops` keeps with the surface's `Status`.

[`src/fence.test.ts`](src/fence.test.ts) holds the rest as claims: no package outside this one imports or declares a plugin (an **equality** per package, never a filtered list asserted empty — a rotted pattern reports nothing and passes); no plugin imports another, and every plugin DOES import the interface; every plugin composes under its own name and no two share one; and each door carries what it may and nothing else.

It does **not** claim that no file spells the word. Prose that names a package is not a dependency, and a fence that failed on a comment is one people learn to work around — the ruling the old `check-kolu-deps.sh` made before this file absorbed it, kept. The sweep over what a general package spells in *code* is claim 8 of that same file: it reads what a source COMPILES TO rather than what it says, so a `koluHalf(…)` call or a `wiring.kolu` slot in a general package is red and a comment naming kolu is not.

## What a disabled plugin is

**Absent from the record** — and now at every moment rather than only at boot.

`--plugins` is a `disabled` PATCH over the rows, applied on the way in, so a row that is off never mounts: no sibling surface, no tag, no handler, no expose row, no `surface/<name>/` on the wire at all. A plugin that is off never probes, unmounts its chrome, registers no dressing, validates its kinds as plain text, and leaves the outline it would have owned an ordinary outline.

What is new is the *at every moment*. It used to be true because every composition door takes a plain keyed object of surfaces, so the filter ran once and nothing could move afterwards. It is true for a stronger reason now: every registration a plugin makes is an EFFECT with its own undo, so a fiber that is disposed drops its sibling, its kinds, its wake declaration and its listeners in reverse — and a fiber that lands in `FAILED` because its `apply` threw installed none of them, with its siblings untouched.

`--plugins` is still CLI/nix only — the git-policy shape, no settings file and no browser toggle — and preferences draws the rows read-only, naming where to change them. A toggle that writes `disabled` onto a row is what the loader makes possible and it is a later phase, not this one.

`reportBundle(ctx)` is what the panel's row is written out of, and it is here rather than in the composition root because it reads the ROWS. A plugin is a fiber, so "not running" is four different mornings — the loader declined to load the row, its `apply` threw, it is short of a service it injects, or it loaded and registered nothing — and `running: false` on the wire said only that one of them happened. The reading is off `ctx.registry` and not `ctx.loader.entries()`: `@cordisjs/plugin-include` is an `EntryTree` of its own mounted with `ctx.plugin`, so the subtree link the loader would walk is never drawn, where the registry has every row either way, keyed by the module's own `name` export — which every row's server half exports as the row's `id`. It is async because Cordis keeps a failed fiber's error PRIVATE and re-throws it from `await()`, and that message crosses to the panel verbatim: the failure prose is the plugin's, and core's job is to carry it. What this reading deliberately cannot answer is `optIn` — the row's own `disabled` and the flag's patch are the same field by the time the loader sees them, which is exactly what makes the patch a patch, so `@olai/server`'s `rosterOf` splits `off` from `optIn` off `--plugins` and nothing here re-reads the flag.

The degenerate case is the same code as every other: a runtime with **no** plugins mounts no sibling on the rooted bundle, which leaves core's own surface byte for byte what it was. That is what `@olai/server`'s `wiring.plugins: null` means, and it is the state every `olai surface`, every headless face and every server test runs in. [`src/composition.test.ts`](src/composition.test.ts) asserts it rather than leaving it to be discovered.

## See also

- [`@olai/plugin-api`](../plugin-api/README.md) — the interface every plugin here is written against, and the Cordis services its server half installs itself into.
- [docs/internal/plugin-system.md](../../docs/internal/plugin-system.md) — the same subject as a tour.
