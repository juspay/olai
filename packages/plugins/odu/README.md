# olai-plugin-odu — the CI tenant

olai's own judgement **about odu**, in the one place that is neither odu nor core. [`olai-plugin-odu/appliance`](src/appliance/README.md) is how olai *reaches* odu — the sweep, the dial, the hold over a live run, the projection into olai's shapes. This package is everything downstream of that which still says the word: what the reading is called on the wire, what a person is shown when a checkout has a run in it, which runs a scoped conversation is woken for, and whether odu's own MCP is here. [`@olai/plugin-api`](../../plugin-api/README.md) is the door both tenants come through; this is the smaller of the two behind it.

## The wall below this one does not move

`@odu/*` is imported in exactly one package and it is not this one. `@olai/odu-client` resolves a `worktree` value into a checkout, dials `.ci/odu.sock`, holds the two cells odu publishes per run, and folds odu's own `STATUS_META` where that table actually lives — so a change to odu's contract is a change **there** and stops. `packages/bundle/src/fence.test.ts` asserts it with zero exceptions, deriving the tenant from the registry rather than carrying a list — which is what admits a plugin package that legitimately names its own appliance. What crosses into here is olai's vocabulary — a `CiRun`, a `RunCell` — and nothing of odu's.

That is worth stating plainly because this package's `solid-js` dependency invites the opposite guess. It is here because this package OWNS its browser faces: odu has no separate face directory the way kolu has [`src/appliance/`](../kolu/src/appliance/), and it needs none — nothing it draws reaches odu's product tier, so there is no second wall for a second package to be. One package, three code doors, and the appliance still confined a floor below.

## One cell, and one cell is a whole surface

[`src/wire.ts`](src/wire.ts) declares a surface with a single member on it:

| declared here | on the wire, composed |
| --- | --- |
| cell `ci` | `surface/odu/ci/get` — every run this server is watching, `verbs: ["get"]`, seeded at `NO_RUNS` |

kolu declares seven behind the same door. **A plugin is not a size**, and the interface says so before this package tests it: everything but `name`, `surface` and `faces` is optional, and the absent arm of each hook is the state a machine without the tool already shows. One cell is all odu's reading needs, because a run is a reading of somebody else's work — there is nothing a browser can write back, which is why the cell declares `get` and no more, and why the whole of *which worktrees have a run, what each node is doing, what the row comes to* arrives as one value rather than as a collection with a stream beside it.

The member keeps its word, and gets it twice over: the framework composes each plugin's surface as a **sibling** under the plugin's own name, so `ci` reads `surface/odu/ci/get` — whose it is and what it holds, in one address that no line of olai computed. Kolu's link cell had to be renamed for the same rule to be kind to it: named `kolu`, it would have composed to `surface/kolu/kolu/get`.

The vocabulary under the cell does not move here either. It stays in `@olai/odu-client/wire`, where the argument for each shape lives beside its schema — and a face reads a `CiRun` from the package that declares it, with no package of odu's on its graph. [`src/wire.ts`](src/wire.ts) also carries this plugin's own `ExposeMap`: the cell is the **browser's alone**, because an agent that wants a run's state has odu's own MCP face and `odu status` besides.

## The name is spelled once

`name = "odu"` sits in [`src/wire.ts`](src/wire.ts) beside the members, and one spelling is meant to serve as the namespace in every member key, the preferences row, the docs slug, and the word `--plugins` takes. Only the first of those is real today; the rest is what the registry is built to hand them, and none of it is wired yet.

What is already settled is what "off" composes to, and it is **absence** rather than a parked cell. A plugin left out of the composition is left out of the record `implementSurfaces` is handed, so there is no `surface/odu/` on the wire at all — no tag, no handler, no expose row. That reverses an earlier reading here, which had the member staying declared because `@olai/server` built its expose map at module scope; the map is built per composition now, from the same list the runtime composed from, and `restrictHandlers` refuses at boot if the two ever disagree.

It costs this tenant less than most to be absent: [`olai-plugin-odu/appliance`](src/appliance/README.md) makes the point that sock-absent is the ordinary answer on nearly every tick, so a browser that never sees the cell sees what a running one shows most of the time anyway. **Disabled is a state the framework's own composition already expresses** — see [`@olai/plugin-api`](../../plugin-api/README.md).

## The reversal this package performs

`packages/web/src/client/live/odu-ci/index.ts` argued, in its own header, that it was *"a folder rather than a package because it imports nothing of odu at all — only surface's own `CiRun` — so a wall there would confine nothing."* Every clause of that is true and the conclusion was wrong, and it is worth saying why rather than quietly deleting it along with the folder.

It measured the wall against **odu's product tier** — against the thing the tenancy claim fences — and by that measure it is unanswerable: the CI chip reads a `CiRun`, the run matrix reads the same, and the folds that genuinely needed odu ran server-side and shipped their answers. But that is not what a wall around a **plugin** confines. A plugin wall confines the NAME: the property key it claims, the registration it makes, the cell it reads, and the words it puts on a screen. Measured that way, the folder confined nothing precisely **because it was inside the package it was supposed to be keeping the name out of** — a directory can import its parent, and the boundary reduces to a comment somebody keeps believing, which is [`olai-plugin-kolu/appliance`](../kolu/src/client/README.md)'s own argument for why it stopped being a directory under `@olai/server`.

And the name did spread, exactly as far as an unwalled name does. `@olai/web` registered the tenant against `WORKTREE_KEY` in its live seam; its `testids.ts` carried `ciChip`, `ciMatrix` and `ciCell` beside the app's own; its `App.tsx` mounted `RunsProvider` and reached the cell by name in the composition root; and its `claims.test.ts` named that folder in a path assertion and twice more in prose, to excuse a CI vocabulary sharing the word `pending` with ACP's. Four sites in the package that is supposed to be the app, for one appliance's face — and the fourth was a *sweep over what the app spells*, which had grown a clause about odu in order to keep passing. **The import was never the thing to count.**

All four are gone now. The seam registers from the registry, the ids are `./testids`, the mount is this package's, and the sweep's clause left with the bench it excused.

`olai-plugin-kolu` needed no such reversal — kolu's faces reach kolu's product tier, so the wall was already argued on the older grounds and the package already existed. Odu is the case that shows the older grounds were the wrong measure, not a weaker version of the same one.

## The direction, and where the fit is proved

This package imports `@olai/plugin-api` — the INTERFACE, which names no plugin — and imports `@olai/bundle` nowhere: THAT is the registry, and it imports every plugin, so a dependency back would be a cycle the manifests cannot express. **Both halves name the interface for real, and both are the same shape:** [`src/server.ts`](src/server.ts) is a Cordis plugin — `name`, `inject`, `apply(ctx)` — naming the services it uses and getting `ctx.vault` typed by declaration merging, and [`src/browser.tsx`](src/browser.tsx) is that shape one process over, injecting `slots`, `clocks` and `wired` and registering this package's faces into the app's declared slots.

It was `src/plugin.ts`: a plain `as const` manifest with **no `: OlaiPlugin` on it**, whose agreement with the interface was proved at the registry's `satisfies`, because a structural agreement checked where both ends are in hand is the stronger claim. That file is gone with the registry that carried it, and the reason is worth keeping: a manifest is present whether or not a serve composed the plugin, so every walk over it had to carry a LICENCE beside it, and the two licences pointed opposite ways — a face drawn early and taken away is a flicker, a subscription opened early latches a `degraded` readout for the life of the page. A fiber the roster never names registers nothing, so there is nothing left to license. What proves the fit now is the runtime rather than a `satisfies`: a face hung in a slot the app does not declare is a type error on the `register` line in this package, and a service named in `inject` that nobody provides is a fiber that stays PENDING and says so — with this plugin's name on it either way.

The three CODE exports are disjoint by **graph** (two more — `./testids` and `./all.css` — are routing rather than graphs, and the browser-half section says why): `./wire` is the declaration everything that composes or reads the surface pulls in statically; `./server` is the runtime half, and every registration on it carries its own undo — [`src/server.ts`](src/server.ts) calls `oduHalf` itself and holds [`src/worktrees.ts`](src/worktrees.ts), the walk that asks which of this vault's keys are DECLARED a `worktree` ([`src/kinds.ts`](src/kinds.ts)) and which nodes carry one; and `./browser` is the browser half, whose graph carries this package's SolidJS faces and which is a CHUNK, fetched only when the roster says odu is running, so a serve without odu never evaluates a line of it. The ROOT is the wire identity and nothing more, now that there is no manifest for it to be. `packages/bundle/src/fence.test.ts` walks each closure.

## The browser half

`src/browser/` is where the argument above stops being an argument. The CI chip a live `worktree` wears, the run matrix its press opens, the words a run comes to, the per-node ink and the one subscription a tab holds are all here, and `@olai/web` no longer spells `odu`, `worktree`, `ci-chip` or `cells.ci` anywhere.

[`src/browser.tsx`](src/browser.tsx) is what hangs them, and it is where the manifest's four declarations became four `ctx.slots.register(...)` calls: the chip in `outline.row.chip` and the matrix in `outline.row.pane`, both against this plugin's own KIND passed BARE — `ctx.slots` composes it with the fiber's name exactly as `ctx.kinds` does on the server, so the word a face is looked up by and the word a vault declares cannot be two spellings — and the tab's own half in `app.mount`, which reads `cells.ci` (a member name the app used to spell in its `App`) off THIS plugin's sibling client through `ctx.wired`. Every one of them is an effect, so a serve that stops naming odu takes the faces down with the fiber. **Odu's MARK** (`Mark.tsx`) is the face over a sentence the doorbell delivered: odu's own `logo.svg`, through the npins odu pin, via [`@olai/plugin-kit`](../../plugin-kit/README.md). The generic plug is the fallback for a plugin that hangs none, not this tenant's face. The claiming node's id rides in the wake's head in backticks (`nodeRef`), so a collapsed line is a link to the lane row.

**Nothing here imports `@olai/web`**, which would be a cycle: the app mounts every plugin. What the faces need of it — the two-speed clock a running node ticks on, and the duration REGISTER it ticks in, which is one ladder for the pomodoro pill, the uptime chip and this — arrives as a VALUE, declared structurally in [`src/browser/app.ts`](src/browser/app.ts) and read through a context the mount puts up. A chip that spelled its own ladder would be a second vocabulary on a page whose whole point is that a ticking number looks the same wherever it appears.

Two doors come with it and neither is a graph: `./testids` is names only, so a scenario asserts on the chip without pulling SolidJS into a cucumber process with no browser in it, and `./all.css` is a `@source` at these faces — Tailwind emits only what it can SEE, and a component that moved out of the app's scan path renders with **no layout at all while nothing errors**.

## What is not here yet

The name, the member, the faces, the doorbell, the probe and the failure sentences have landed: [`src/server.ts`](src/server.ts) calls `oduHalf`, [`src/doorbell.ts`](src/doorbell.ts) joins a scoped file's claims against the watcher's two notices, [`src/probe.ts`](src/probe.ts) asks whether `odu mcp` is here, and [`src/wake.ts`](src/wake.ts) is the two sentences a scope that cannot be watched says. What this package still does not do:

- **Run events reaching the feed.** Odu publishes enough to say a run changed state; no event of odu's reaches the board today, from here or from anywhere.
- **An owned file.** Odu owns no outline in the vault, and nothing here wants one: what a run is doing is odu's to say and olai reads it, so there is no configuration for a directory to carry.

## The kind, and what it licences

Odu contributes ONE property kind ([`src/kinds.ts`](src/kinds.ts)): `worktree`. A vault declares it in `_olai/Properties.olai` like any other type, and that row is what licences the probe.

**It used to ask for `path`, joined to the key name `worktree`, and that could not hold.** `brief` is a `path` too, on the very same lane rows — a shape cannot tell a document from a checkout — so the licence needed a hardcoded name to mean anything, which gave the probe to any vault that happened to use the word and denied it to a board whose column is called `checkout`. The kind is the fact said once, where the vault says everything else about its keys. A board that declared `path` gets no chip now; the repair is the word in that one row.

The shape a value has to be is still the format's `isPathShaped`, not a second predicate spelled here: this kind is a `path` that promises something further, and a value the format calls a path and this refused would be two answers about one string.

The vault WALK that reads it is the sharpest thing in this package: [`src/worktrees.ts`](src/worktrees.ts) was `packages/server/src/worktrees.ts`, and it belongs here because what it decides is whether olai dials a socket in somebody's checkout. It may not live in `@olai/odu-client` — it reads outline records, and that package's interfaces are parametric in the node type so a compiler holds it to never learning what one is — and it has no business in core, which holds the vault but makes no judgement about odu. Between those two is what this package is.
