# @olai/plugin-odu — the CI tenant

olai's own judgement **about odu**, in the one place that is neither odu nor core. [`@olai/odu-client`](../odu-client/README.md) is how olai *reaches* odu — the sweep, the dial, the hold over a live run, the projection into olai's shapes. This package is everything downstream of that which still says the word: what the reading is called on the wire, what a person is shown when a checkout has a run in it, and — as the rest of this PR lands — where the remaining judgements about odu are made. [`@olai/plugins`](../plugins/README.md) is the door both tenants come through; this is the smaller of the two behind it.

## The wall below this one does not move

`@odu/*` is imported in exactly one package and it is not this one. `@olai/odu-client` resolves a `worktree` value into a checkout, dials `.ci/odu.sock`, holds the two cells odu publishes per run, and folds odu's own `STATUS_META` where that table actually lives — so a change to odu's contract is a change **there** and stops. `scripts/check-odu-deps.sh` asserts it with zero exceptions, and its second arm has no clause for a plugin package. What crosses into here is olai's vocabulary — a `CiRun`, a `RunCell` — and nothing of odu's.

That is worth stating plainly because this package's `solid-js` dependency invites the opposite guess. It is here because this package OWNS its browser faces: odu has no `-ui` sibling the way kolu has [`@olai/kolu-ui`](../kolu-ui/README.md), and it needs none — nothing it draws reaches odu's product tier, so there is no second wall for a second package to be. One package, three code doors, and the appliance still confined a floor below.

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

It costs this tenant less than most to be absent: [`@olai/odu-client`](../odu-client/README.md) makes the point that sock-absent is the ordinary answer on nearly every tick, so a browser that never sees the cell sees what a running one shows most of the time anyway. **Disabled is a state the framework's own composition already expresses** — see [`@olai/plugins`](../plugins/README.md).

## The reversal this package performs

`packages/web/src/client/live/odu-ci/index.ts` argued, in its own header, that it was *"a folder rather than a package because it imports nothing of odu at all — only surface's own `CiRun` — so a wall there would confine nothing."* Every clause of that is true and the conclusion was wrong, and it is worth saying why rather than quietly deleting it along with the folder.

It measured the wall against **odu's product tier** — against the thing `check-odu-deps.sh` fences — and by that measure it is unanswerable: the CI chip reads a `CiRun`, the run matrix reads the same, and the folds that genuinely needed odu ran server-side and shipped their answers. But that is not what a wall around a **plugin** confines. A plugin wall confines the NAME: the property key it claims, the registration it makes, the cell it reads, and the words it puts on a screen. Measured that way, the folder confined nothing precisely **because it was inside the package it was supposed to be keeping the name out of** — a directory can import its parent, and the boundary reduces to a comment somebody keeps believing, which is [`@olai/kolu-client`](../kolu-client/README.md)'s own argument for why it stopped being a directory under `@olai/server`.

And the name did spread, exactly as far as an unwalled name does. `@olai/web` registered the tenant against `WORKTREE_KEY` in its live seam; its `testids.ts` carried `ciChip`, `ciMatrix` and `ciCell` beside the app's own; its `App.tsx` mounted `RunsProvider` and reached the cell by name in the composition root; and its `claims.test.ts` named that folder in a path assertion and twice more in prose, to excuse a CI vocabulary sharing the word `pending` with ACP's. Four sites in the package that is supposed to be the app, for one appliance's face — and the fourth was a *sweep over what the app spells*, which had grown a clause about odu in order to keep passing. **The import was never the thing to count.**

All four are gone now. The seam registers from the registry, the ids are `./testids`, the mount is this package's, and the sweep's clause left with the bench it excused.

`@olai/plugin-kolu` needed no such reversal — kolu's faces reach kolu's product tier, so the wall was already argued on the older grounds and the package already existed. Odu is the case that shows the older grounds were the wrong measure, not a weaker version of the same one.

## The direction, and where the fit is proved

This package imports `@olai/plugins` nowhere. The manifest in [`src/plugin.ts`](src/plugin.ts) is a plain `as const` object with no `: OlaiPlugin` on it, and the agreement is proved at the registry's `satisfies` — the registry imports every plugin, so a dependency back would be a cycle the manifests cannot express. The three CODE exports are disjoint by **graph** (two more — `./testids` and `./all.css` — are routing rather than graphs, and the browser-half section says why): `./wire` is the declaration everything that composes or reads the surface pulls in statically; `./server` is the runtime half — [`src/server.ts`](src/server.ts) calls `oduHalf` itself and holds [`src/worktrees.ts`](src/worktrees.ts), the walk that asks which of this vault's keys are DECLARED a `worktree` ([`src/kinds.ts`](src/kinds.ts)) and which nodes carry one; and the root is the manifest, whose graph carries this package's browser faces. `packages/plugins/src/fence.test.ts` walks each closure.

## The browser half

`src/browser/` is where the argument above stops being an argument. The CI chip a live `worktree` wears, the run matrix its press opens, the words a run comes to, the per-node ink and the one subscription a tab holds are all here, and `@olai/web` no longer spells `odu`, `worktree`, `ci-chip` or `cells.ci` anywhere.

The chip and the matrix are the manifest's `dressings`, registered by the app from the registry rather than by a folder that reached into the app's table; `mount.tsx` is the tab's own half, which reads `cells.ci` — a member name the app used to spell in its `App` — off THIS plugin's sibling client.

**Nothing here imports `@olai/web`**, which would be a cycle: the app mounts every plugin. What the faces need of it — the two-speed clock a running node ticks on, and the duration REGISTER it ticks in, which is one ladder for the pomodoro pill, the uptime chip and this — arrives as a VALUE, declared structurally in [`src/browser/app.ts`](src/browser/app.ts) and read through a context the mount puts up. A chip that spelled its own ladder would be a second vocabulary on a page whose whole point is that a ticking number looks the same wherever it appears.

Two doors come with it and neither is a graph: `./testids` is names only, so a scenario asserts on the chip without pulling SolidJS into a cucumber process with no browser in it, and `./all.css` is a `@source` at these faces — Tailwind emits only what it can SEE, and a component that moved out of the app's scan path renders with **no layout at all while nothing errors**.

## What is not here yet

This commit lands the **name, the member and the faces**. The rest of the tenant arrives in later commits of this same PR:

- **The probe and the failure sentences.** Nothing in this package yet answers *is odu here* or *what do I say when it is not*. The runtime half has landed: [`src/server.ts`](src/server.ts) calls `oduHalf` and `@olai/server` names neither it nor odu.
- **Run events reaching the feed.** Odu publishes enough to say a run changed state; no event of odu's reaches the board today, from here or from anywhere.
- **An owned file.** Odu owns no outline in the vault, and nothing here wants one: what a run is doing is odu's to say and olai reads it, so there is no configuration for a directory to carry.

## The kind, and what it licences

Odu contributes ONE property kind ([`src/kinds.ts`](src/kinds.ts)): `worktree`. A vault declares it in `_olai/Properties.olai` like any other type, and that row is what licences the probe.

**It used to ask for `path`, joined to the key name `worktree`, and that could not hold.** `brief` is a `path` too, on the very same lane rows — a shape cannot tell a document from a checkout — so the licence needed a hardcoded name to mean anything, which gave the probe to any vault that happened to use the word and denied it to a board whose column is called `checkout`. The kind is the fact said once, where the vault says everything else about its keys. A board that declared `path` gets no chip now; the repair is the word in that one row.

The shape a value has to be is still the format's `isPathShaped`, not a second predicate spelled here: this kind is a `path` that promises something further, and a value the format calls a path and this refused would be two answers about one string.

The vault WALK that reads it is the sharpest thing in this package: [`src/worktrees.ts`](src/worktrees.ts) was `packages/server/src/worktrees.ts`, and it belongs here because what it decides is whether olai dials a socket in somebody's checkout. It may not live in `@olai/odu-client` — it reads outline records, and that package's interfaces are parametric in the node type so a compiler holds it to never learning what one is — and it has no business in core, which holds the vault but makes no judgement about odu. Between those two is what this package is.
