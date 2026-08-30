# @olai/plugin-kolu — everything that says kolu, on this side of the wall

kolu was extracted into two packages long before there was a plugin system, and neither of them moves. [`@olai/kolu-client`](../kolu-client/README.md) is THE DIAL and the wire — the only package that opens padi's socket, and where a change to padi's contract stops. [`@olai/kolu-ui`](../kolu-ui/README.md) is everything browser — the Dock row a `terminal` property wears, the live pane it opens, the fleet a tab holds once, the words the readout says. This package is the **third thing**, which had no package of its own and was therefore living in packages that have no business knowing the word: `packages/chat/src/kolu.ts`, `packages/server/src/koluConfig.ts`, `packages/server/src/claimants.ts`, `packages/web/src/client/padi/`.

That third thing is not kolu implementation. It is **olai's own JUDGEMENT about kolu** — what an absent padi means in whole English sentences, which vault file is kolu's by convention, who owns a terminal, which property kind wears the terminal door, which chrome slot the padi pill hangs in. [`@olai/plugins`](../plugins/README.md) argues why that judgement is neither the appliance's nor core's; this package is where kolu's share of it lands, and the reason nothing here re-implements anything is that the two packages above already did.

## The seven, as a surface of their own

[`src/wire.ts`](src/wire.ts) declares a **whole surface** — `defineSurface`, exactly as `@olai/surface` calls it — out of the declarations, schemas, `equals` and doc blocks that stay in `@olai/kolu-client/wire`. Core composes it as a **sibling** under this plugin's `name`, so the framework mints every address and olai computes none of them:

| declared here | on the wire, composed |
| --- | --- |
| cell `link` | `surface/kolu/link/get` |
| cells `pulse`, `mutes` | `surface/kolu/pulse/get`, `surface/kolu/mutes/get` |
| collections `fleet`, `events` | `surface/kolu/fleet/…` |
| stream `terminal` | `surface/kolu/terminal/…` |
| procedure `screen.text` | `surface/kolu/screen/text` |

The one rename in the set is the cell that was called `kolu`, which became **`link`** — and it went into `@olai/kolu-client`, where the member is declared, rather than being papered over here: a cell named for its own appliance composes to `surface/kolu/kolu/get`, which says the word twice and the thing once. What it holds is a `KoluLink`.

The doc blocks did not travel. They argue what a member IS — what a `fleet` row carries, what the pulse is off — and they stayed beside each schema in `@olai/kolu-client/wire`, where a reader asking that question is already standing. What lives here is which members this plugin puts on the wire and which face may see each.

[`src/wire.ts`](src/wire.ts) also carries this plugin's own **`ExposeMap`**, which used to be a row per member in `@olai/server`'s expose map — a general package holding a per-appliance decision, edited every time an appliance grew a member and silently forgettable: a member absent from that map is a member no face serves, and it reaches a person as a chip that never fills with nothing red anywhere. All seven are the **browser's alone**, and the reason is one sentence said seven times: every member here is a reading of somebody else's daemon, and an agent that wants padi has padi's own MCP face.

## Three doors, and the graph behind each

`package.json` exports exactly three entries, disjoint by **graph** rather than by taste. The split is [`@olai/kolu-client`](../kolu-client/README.md)'s own, one floor down, grown a door.

- **`./wire`** is what everything that composes or reads the surface reaches, through `@olai/plugins/wire` — the server's composition root today, the browser bundle's composed client next. So its graph is `effect` and `@olai/kolu-client/wire`, and it stops there. No `solid-js`, which would put a UI runtime on the server's graph; no `@kolu/padi-client`, which would put the daemon's whole contract on the browser's; no `@olai/format`.
- **`./server`** is the RUNTIME HALF: [`src/server.ts`](src/server.ts) calls `koluHalf` itself, holds the two vault walks, and hands back the `ImplementSurfaceDeps` a composition root gives `implementSurfaces`. Its own door because a server must not pull a plugin's browser faces onto the graph of a process that renders nothing.
- **the root** is the MANIFEST — the probe, the failure sentences, the owned file, the dressings and the chrome as they arrive, and the chrome is `@olai/kolu-ui`, which is SolidJS and an emulator behind it.

One door for all three would carry a component onto the server's static graph and padi's contract into the browser bundle. [`@olai/plugins`](../plugins/README.md)'s [`fence.test.ts`](../plugins/src/fence.test.ts) walks each closure rather than trusting this list.

## The two vault walks, and where the wall actually runs

[`src/claimants.ts`](src/claimants.ts) reads which nodes carry a `terminal` property; [`src/config.ts`](src/config.ts) reads what `_olai/Kolu.olai` says about the watcher's knobs and its mutes, and which served outline that file is. Both were `packages/server/src/`'s, under kolu-shaped filenames, and both walk **outline records** — which is exactly why they may not live in `@olai/kolu-client`: that package's interfaces are parametric in the node type so a compiler can hold it to never reading one, and what crosses into it is four strings per claim and one reading per revision.

So the wall runs between three things and not two. The appliance knows how to reach the tool; core holds the vault; and the judgement about what the vault SAYS about the tool is this package's. `config.ts` is not called `koluConfig.ts` any more for the reason the `link` cell is not called `kolu`: inside `@olai/plugin-kolu` the prefix says the word twice and the thing once.

## The manifest is structural, and that is the direction

[`src/plugin.ts`](src/plugin.ts) is a plain `as const` object with **no `: OlaiPlugin` annotation on it**, and there must not be one: `@olai/plugins` imports this package, so an import back would be a cycle the manifests could not express. The fit is proved at the registry's `satisfies` — the same structural agreement `@olai/ops` keeps with the surface's `Status`, and the one `@olai/kolu-ui` already keeps with the drawer's entry. A manifest that stopped fitting is a type error on the registry's line, with this plugin's name on it.

The same physics runs the other way too. [`@olai/kolu-ui`](../kolu-ui/README.md) used to read its wire types from `@olai/surface`; it reads them from `@olai/kolu-client/wire` now, which is where they live — because the surface sits ABOVE this package and a dependency back would be a cycle `bun install` cannot describe.

`name` is spelled once, in [`src/wire.ts`](src/wire.ts), and it is the **sibling key** — so the wire prefix, the preferences row, the docs slug and the word `--plugins` takes cannot drift apart.

## kolu off is a state kolu has always had

Nothing about what these members answer when there is no padi changed: an `absent` link, an empty fleet, a quiet pulse, no events, no terminal, a screen read that refuses in words. That is what a machine without kolu shows, and [`@olai/kolu-client`](../kolu-client/README.md) settled it under its own heading.

What DID change is what "this process runs no kolu" means. `@olai/server` used to pass `wiring.kolu: null` and serve every member present-and-hollow; a plugin that is not composed now contributes **no sibling at all** — no tag, no handler, no expose row, no `surface/kolu/` on the wire. Absence is the sharper of the two answers, because a member that is not there cannot be read as a member that is there and empty, and the framework's own composition expresses it for free.

## The browser half

`src/browser/` is this package's third face, and it is the one that stopped `@olai/web` spelling `kolu`:

- **The padi pill** (`Padi.tsx`) and the feed its press opens (`Feed.tsx`) — the header readout that says whether this olai can see kolu's terminals, the third standing promise beside the connection and the Commit pill. It is on the manifest's `chrome.Header`, and the app draws every manifest's header where the padi pill used to be spelled out.
- **The tab's mount** (`mount.tsx`) — `@olai/kolu-ui`'s `KoluUi` bound to THIS plugin's sibling client. That line lived in the app's composition root as `<KoluUi client={olai}>`, and the day kolu's members composed as a sibling it would have had to read `olai.clients.kolu`, which is a general package writing a plugin's name in its own `App`.
- **The terminal DRESSING**, declared on the manifest against `TERMINAL_KEY` and registered by the app from there. The component is still `@olai/kolu-ui`'s `TerminalBlock`, behind its own wall, because it renders kolu's row and mounts kolu's emulator; what is decided here is the one thing that is olai's, which is that this key wears that face.

**None of it imports `@olai/web`**, and that is a wall rather than an omission — the app mounts every plugin, so an import back would be a cycle, and `@olai/plugins`' fence refuses it before a reviewer has to notice. What the pill needs of the app — the bar's pill geometry, the desktop breakpoint, the popover that shares the bar's one focus cycle, a door onto a served file — arrives as a VALUE, declared structurally in [`src/browser/app.ts`](src/browser/app.ts). That is `@olai/kolu-ui`'s own `block.ts` pin one floor down, and its argument scales exactly: a face that spelled the app's contract itself would be a second spelling, free to drift the day the app changed it, with the app's own suite green because the face it broke is in another package.

Two doors come with it and neither is a graph. `./testids` is names only, so a scenario asserts on the pill without pulling SolidJS and an emulator into a cucumber process with no browser in it; `./all.css` chains `@olai/kolu-ui`'s sheet and adds a `@source` at these faces, because Tailwind emits only what it can SEE and a component that moved out of the app's scan path renders with **no layout at all while nothing errors**.

## What is not here yet

- **The probe and the failure sentences.** What an absent padi means still reads as `@olai/kolu-client`'s three-armed `KoluLink` and whatever each face says about it.
- **The kinds.** The `terminal` property's KIND is not declared anywhere yet, so the dressing above is looked up by the property KEY — see [`@olai/plugins`](../plugins/README.md)'s `Dressing`, which says plainly what the word is today and what has to travel before it becomes a kind.

Each arrives in a later commit of this same PR, at which point the general packages stop spelling a name they have no reason to know.

The other tenant is `@olai/plugin-odu`, which composes [`@olai/odu-client`](../odu-client/README.md)'s one `ci` cell at `surface/odu/ci/get`. A plugin is not a size.
