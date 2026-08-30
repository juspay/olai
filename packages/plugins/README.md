# @olai/plugins — the only place core meets an appliance

olai integrates with two things that are not olai. [kolu](https://kolu.dev) runs coding agents in terminals and serves them to an agent over MCP; [odu](https://github.com/juspay/odu) runs CI. Both were extracted into packages of their own once — [`@olai/kolu-client`](../kolu-client/README.md), [`@olai/kolu-ui`](../kolu-ui/README.md), [`@olai/odu-client`](../odu-client/README.md) — and both left a residue behind in the packages that are supposed to know nothing about them: a `kolu.ts` in `@olai/chat`, a `koluConfig.ts` and a `claimants.ts` in `@olai/server`, a named `wiring.kolu` slot with a `koluHalf(…)` call beside it, four `...koluMembers` spreads in the middle of the wire spec, a row per plugin member in the server's expose map, a `padi/` folder in `@olai/web`, and one property key spelled at seven sites across four packages.

That residue is not sloppiness. It is the part that genuinely was **olai's own judgement about an appliance** — what an absent padi means, which vault file is kolu's by convention, which property wears which face. What was missing is a place to put a judgement about an appliance that is neither the appliance nor the core. **This is that place, and it is the only one.**

## A plugin is a value

[`src/plugin.ts`](src/plugin.ts) is the whole interface. A plugin contributes:

| | what it is |
| --- | --- |
| `name` | the namespace, the preferences row, the docs slug, and the word `--plugins` takes — one spelling |
| `surface` | a **whole surface of its own**, declared in its own package with its own member names — core composes it as a SIBLING under `name` |
| `faces` | which face may see which of its members, its own `ExposeMap` per face, written against its own spec |
| `kinds` | property KINDS the vault may declare, handed to [`@olai/format`](../format/README.md) as data — the format imports no plugin |
| `probe` | find the tool. Absence is a **state**, not an error |
| `failures` | **whole sentences**, one per way of failing. Core displays them and never composes one |
| `runtimeHalf` | the subscription machinery the server forks, with the vault walks injected — reached through the plugin's own `./server` door, never through the manifest |
| `mcpServer` | what a chat session is handed when the probe says yes |
| `ownedFile` | the file in the vault this plugin owns by convention |
| `dressings` | what a live property wears in the browser — a chip beside the value, the pane it opens, or a block that owns a row. Looked up today by the property KEY; `Dressing`'s own doc says plainly what has to travel before it is the declared **kind** |
| `chrome` | a header readout in the app's bar, and the drawer its press opens |
| `mount` | the tab's own half, wrapped around the page once — one subscription however many leaves draw |
| `docs` | the page the docs index assembles |

Everything but the name, the surface and its faces is optional, and the absent arm of each is the state a machine without the tool already shows.

## One generic door

Core's API does not carry *list the terminals*. Each plugin hands over a **whole surface**, declared in its own package with its own member names on it, and the framework composes it as a **sibling** under the plugin's name:

```
core       surface/outlines/get        ← byte-unchanged
kolu       surface/kolu/fleet/get      ← declared `fleet`, in @olai/plugin-kolu
odu        surface/odu/ci/get          ← declared `ci`, in @olai/plugin-odu
```

**No general package computes any of those addresses.** `composeSurfaceContracts` re-walks each sibling's spec at `surface/<key>/`, and the key is the plugin's own `name` — so the name and every tag it appears in cannot drift apart, and core knows a plugin's name and nothing else about what is behind it.

Core does **not** become a sibling, which is the reading that would have moved an address an MCP client already writes. It keeps `implementSurface` and its three-segment tags; the plugins go through `implementSurfaces` and get four; and the two are **fused** ([`src/compose.ts`](src/compose.ts)). The fusion is safe by construction — the framework forbids a `/` inside a name, so a three-segment set and a four-segment set cannot intersect — and it is counted anyway, because the merge underneath is a last-writer-wins `Map.set` and a silently dropped tag is a member that answers nothing with nobody told.

A first attempt put a separator inside **member names** instead, and the way it was wrong is worth keeping: a member name is not a namespace. `@kolu/surface` mints channel names, MCP resource paths and tool names out of one, so a punctuated member aliases another member's channel, has to be percent-encoded to be read as a resource, and produces a tool name outside the character set a strict MCP host accepts. `/` is refused loudly by `assertTagSegment`; `.` is refused **quietly**, which is worse — a dotted member compiles, mounts and serves, and then `classifyExpose` reads every dotted key as `<namespace>.<verb>` and the server dies at boot with *"expose names procedure … but the spec has no such procedure"*. The framework already owned the axis; taking the offer is the whole of this design.

## The registry is a source file

[`src/registry.ts`](src/registry.ts) lists the manifests, [`src/surfaces.ts`](src/surfaces.ts) lists the wire halves and [`src/server.ts`](src/server.ts) lists the server halves, all with static imports and `as const` literals. It has to be a source file: the framework infers a surface spec as a **literal**, and a registry assembled at runtime widens every member to its base type and takes with it the `arrayKey` a browser's merge reads, the `equals` a quiet frame rests on, the read-only narrowing of `verbs`, and every typed accessor a client has.

A third party adding a plugin therefore rebuilds olai. Accepted: the boundary is the value, not the loading.

## Three doors by graph, and two by name

Three lists because three **graphs**, and a third plugin is three lines rather than one. That is a real cost and it buys the only thing that matters here: nothing lands on a graph that has no use for it.

| door | who opens it | what it may carry |
| --- | --- | --- |
| `./wire` | [`@olai/server`](../server/README.md)'s composition root and [`@olai/web`](../web/README.md)'s `client/wire.ts` — both fuse with the same `fuseGroups` | each plugin's own `./wire` — the sibling map, the filters, the fusion helpers — and it stops there |
| `./server` | [`@olai/server`](../server/README.md)'s composition root | each plugin's server half: its appliance client, its vault walks, the deps `implementSurfaces` takes |
| `.` | the browser: `client/plugins/` mounts each tab half, hangs each chrome readout, and registers each dressing | the manifests whole — probes, dressings, chrome, mounts, which are SolidJS components and, behind kolu's, a terminal emulator |

One door for all three would put a component on the graph of a process that renders nothing and a daemon's whole contract on the browser's, which is exactly what [`@olai/kolu-client`](../kolu-client/README.md)'s own fence exists to prevent one floor down. [`src/fence.test.ts`](src/fence.test.ts) walks each closure rather than trusting the table.

Two more doors exist and neither is a graph. They are here because the fence is about a **name in any grammar**, and a general package may spell none:

| door | why it routes through here |
| --- | --- |
| `./all.css` | each plugin's stylesheet, chained. A CSS `@import` is a door a plugin's name can be spelled through — the fence reads a `.css` file's imports for exactly that reason — so `@olai/web`'s `styles.css` names this and no tenant. Each sheet carries a `@source` at its own faces, because Tailwind emits only what it can SEE and a component outside the app's scan path renders with **no layout while nothing errors** |
| `./testids` | each plugin's names-only testid table, merged and asserted **disjoint** ([`src/testids.test.ts`](src/testids.test.ts)) — a spread would resolve a collision silently, and a scenario asserting on the wrong package's element is green about nothing. `@olai/tests` may not name a plugin either, and the door carries no component, so a suite with no browser in it never pulls SolidJS or an emulator |

## What the app hands a plugin

A plugin's browser half draws a chip that TICKS, a pill in the app's bar, a panel that hangs off it and a link into the served set — four of the app's own contracts, and every one of them breaks **silently** when it is spelled twice. So the app hands them across as a value ([`src/plugin.ts`](src/plugin.ts)'s `AppFurniture`): the clock and its duration register, the chrome pill's geometry, the desktop breakpoint, a popover already wearing the bar's portal, layer and anchor, and a door onto a served file.

That is `@olai/web`'s own `BlockChrome` scaled up — the drawer already hands a face its fact line rather than letting the face spell `"prop"` — and it is the only shape available: the app mounts every plugin, so a plugin that imported the app for those names would be a cycle. Each plugin re-declares the part it reads, structurally, and contravariance makes that the **stronger** agreement: a plugin asking for something the app does not hand over is a type error at the registry's `satisfies`, with that plugin's name on the line.

## The direction is physics

`@olai/plugins` imports every plugin. **No plugin imports it back** — a plugin declares its manifest as a plain `as const` object and the fit is proved here, by `satisfies`, which is the same structural agreement `@olai/ops` keeps with the surface's `Status`. So the dependency is a DAG the manifests express, and a cycle is not a rule a reviewer remembers but a thing `bun install` cannot describe.

[`src/fence.test.ts`](src/fence.test.ts) holds the rest as claims: no package outside this one imports or declares a plugin (an **equality** per package, never a filtered list asserted empty — a rotted pattern reports nothing and passes); no plugin imports another; every plugin composes under its own name and no two share one; and each door carries what it may and nothing else.

It does **not** claim that no file spells the word. Prose that names a package is not a dependency, and a fence that failed on a comment is one people learn to work around — `scripts/check-kolu-deps.sh`'s own ruling, kept. The sweep over what a general package spells in *code* lives in [`@olai/tests`](../tests/README.md), which is the only package above all the others.

## What a disabled plugin is

**Absent from the record**, and that costs no mechanism. `composeSurfaceContracts`, `implementSurfaces` and `surfaceClients` all take a plain keyed object of surfaces, so `--plugins` is a filter over that object and nothing else: no sibling, no tag, no handler, no expose row, no `surface/<name>/` on the wire at all. A plugin that is off never probes, unmounts its chrome, registers no dressing, validates its kinds as plain text, and leaves the outline it would have owned an ordinary outline.

`--plugins` is CLI/nix only — the git-policy shape, no settings file and no browser toggle — and preferences draws the rows read-only, naming where to change them.

The same is true one step further out: a runtime composed with **no plugins at all** hands `implementSurfaces` an empty record, which composes to a group with no requests and a handler record with none, and fusing that onto olai's own surface leaves it byte for byte what it was. That is what `@olai/server`'s `wiring.plugins: null` means, and it is the state every `olai surface`, every headless face and every server test runs in. [`src/compose.test.ts`](src/compose.test.ts) asserts it rather than leaving it to be discovered.
