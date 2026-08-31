# @olai/plugins — the only place core meets an appliance

olai integrates with two things that are not olai. [kolu](https://kolu.dev) runs coding agents in terminals and serves them to an agent over MCP; [odu](https://github.com/juspay/odu) runs CI. Both were extracted into packages of their own once — [`@olai/kolu-client`](../kolu-client/README.md), [`@olai/kolu-ui`](../kolu-ui/README.md), [`@olai/odu-client`](../odu-client/README.md) — and both left a residue behind in the packages that are supposed to know nothing about them: a `kolu.ts` in `@olai/chat`, a `koluConfig.ts` and a `claimants.ts` in `@olai/server`, a named `wiring.kolu` slot with a `koluHalf(…)` call beside it, four `...koluMembers` spreads in the middle of the wire spec, a row per plugin member in the server's expose map, a `padi/` folder in `@olai/web`, and one property key spelled at seven sites across four packages.

That residue is not sloppiness. It is the part that genuinely was **olai's own judgement about an appliance** — what an absent padi means, which vault file is kolu's by convention, which property wears which face. What was missing is a place to put a judgement about an appliance that is neither the appliance nor the core. **This is that place, and it is the only one.**

## A plugin is a value

[`src/plugin.ts`](src/plugin.ts) is the whole interface. A plugin contributes:

| | what it is |
| --- | --- |
| `name` | the namespace, the preferences row, the docs page's address, and the word `--plugins` takes — one spelling |
| `surface` | a **whole surface of its own**, declared in its own package with its own member names — core composes it as a SIBLING under `name` |
| `faces` | which face may see which of its members, its own `ExposeMap` per face, written against its own spec |
| `kinds` | property KINDS the vault may declare, handed to [`@olai/format`](../format/README.md) as data — the format imports no plugin. Reached through `./server`, where the validator and the write planner are |
| `runtimeHalf` | the subscription machinery the server forks, with the vault walks injected — reached through the plugin's own `./server` door, never through the manifest |
| `probe` | find the tool, and say in **whole sentences** what a chat session is owed when it is not here. Absence is a **state**, not an error. Reached through `./server` too, and for a sharper version of the same reason: a probe starts a subprocess |
| `ownedFile` | the file in the vault this plugin owns by convention |
| `dressings` | what a live property wears in the browser — a chip beside the value, the pane it opens, or a block that owns a row. Looked up by the declared **kind**, the same word `PropKind` contributes: the page carries the licence as an answer per drawn value, so the browser follows the declaration without one ever travelling |
| `chrome` | a header readout in the app's bar, and the drawer its press opens |
| `mount` | the tab's own half, wrapped around the page once — one subscription however many leaves draw |

Everything but the name, the surface and its faces is optional, and the absent arm of each is the state a machine without the tool already shows.

## One generic door

Core's API does not carry *list the terminals*. Each plugin hands over a **whole surface**, declared in its own package with its own member names on it, and the framework composes it as a **sibling** under the plugin's name:

```
core       surface/outlines/get        ← byte-unchanged
kolu       surface/kolu/fleet/get      ← declared `fleet`, in @olai/plugin-kolu
odu        surface/odu/ci/get          ← declared `ci`, in @olai/plugin-odu
```

**No general package computes any of those addresses.** `composeSurfaceContracts` re-walks each sibling's spec at `surface/<key>/`, and the key is the plugin's own `name` — so the name and every tag it appears in cannot drift apart, and core knows a plugin's name and nothing else about what is behind it.

Core does **not** become a sibling, which is the reading that would have moved an address an MCP client already writes. It keeps `implementSurface` and its three-segment tags; the plugins go through `implementSurfaces` and get four; and the two ride ONE WIRE as a **rooted bundle**, which is the framework's own shape end to end (juspay/kolu#2222): `mergeDisjointGroups` where a server composes, `exposeRootedFaces` where it gates, `connectSurfaces`' `core` slot where a browser dials. The fusion is safe by construction — the framework forbids a `/` inside a name, so a three-segment set and a four-segment set cannot intersect — and it is counted anyway, because the merge underneath is a last-writer-wins `Map.set` and a silently dropped tag is a member that answers nothing with nobody told. This package spelled that merge and the face union for itself for one PR window; [`src/mechanics.test.ts`](src/mechanics.test.ts) is the standing lint that it spells neither now.

A first attempt put a separator inside **member names** instead, and the way it was wrong is worth keeping: a member name is not a namespace. `@kolu/surface` mints channel names, MCP resource paths and tool names out of one, so a punctuated member aliases another member's channel, has to be percent-encoded to be read as a resource, and produces a tool name outside the character set a strict MCP host accepts. `/` is refused loudly by `assertTagSegment`; `.` is refused **quietly**, which is worse — a dotted member compiles, mounts and serves, and then `classifyExpose` reads every dotted key as `<namespace>.<verb>` and the server dies at boot with *"expose names procedure … but the spec has no such procedure"*. The framework already owned the axis; taking the offer is the whole of this design.

## The registry is a source file

[`src/registry.ts`](src/registry.ts) lists the manifests, [`src/surfaces.ts`](src/surfaces.ts) lists the wire halves and [`src/server.ts`](src/server.ts) lists the server halves, all with static imports and `as const` literals. It has to be a source file: the framework infers a surface spec as a **literal**, and a registry assembled at runtime widens every member to its base type and takes with it the `arrayKey` a browser's merge reads, the `equals` a quiet frame rests on, the read-only narrowing of `verbs`, and every typed accessor a client has.

A third party adding a plugin therefore rebuilds olai. Accepted: the boundary is the value, not the loading.

## Three doors by graph, and two by name

Three lists because three **graphs**, and a third plugin is three lines rather than one. That is a real cost and it buys the only thing that matters here: nothing lands on a graph that has no use for it. The cost has a **lid** ([`src/rosters.test.ts`](src/rosters.test.ts)): the three lists must hold the same plugins in the same order, because a plugin added to two of them is a compile error nowhere — each walk spends ONE list, so what you get is a surface that composes whose kinds never reach the validator, or a probe that runs on a serve that never dialled it.

| door | who opens it | what it may carry |
| --- | --- | --- |
| `./wire` | [`@olai/server`](../server/README.md)'s composition root and [`@olai/web`](../web/README.md)'s `client/wire.ts` — the fusion at both ends is the framework's one counted merge | each plugin's own `./wire` — the sibling map and the filters — and it stops there |
| `./server` | [`@olai/server`](../server/README.md)'s composition root | each plugin's server half: its appliance client, its vault walks, the deps `implementSurfaces` takes — and its PROBE, which starts a subprocess and so may never be reachable from a tab |
| `.` | the browser: `client/plugins/` mounts each tab half, hangs each chrome readout, and registers each dressing | the manifests whole — probes, dressings, chrome, mounts, which are SolidJS components and, behind kolu's, a terminal emulator |

One door for all three would put a component on the graph of a process that renders nothing and a daemon's whole contract on the browser's, which is exactly what [`@olai/kolu-client`](../kolu-client/README.md)'s own fence exists to prevent one floor down. [`src/fence.test.ts`](src/fence.test.ts) walks each closure rather than trusting the table.

Two more doors exist and neither is a graph. They are here because the fence is about a **name in any grammar**, and a general package may spell none:

| door | why it routes through here |
| --- | --- |
| `./all.css` | each plugin's stylesheet, chained. A CSS `@import` is a door a plugin's name can be spelled through — the fence reads a `.css` file's imports for exactly that reason — so `@olai/web`'s `styles.css` names this and no tenant. Each sheet carries a `@source` at its own faces, because Tailwind emits only what it can SEE and a component outside the app's scan path renders with **no layout while nothing errors** |
| `./testids` | each plugin's names-only testid table, merged and asserted **disjoint** ([`src/testids.test.ts`](src/testids.test.ts)) — a spread would resolve a collision silently, and a scenario asserting on the wrong package's element is green about nothing. `@olai/tests` may not name a plugin either, and the door carries no component, so a suite with no browser in it never pulls SolidJS or an emulator |

## One probe, and what it answers

A plugin's tool is not necessarily on the machine olai is serving from, so a plugin may declare a **probe**: one call, per chat session, answering *is it here* and *what is a person owed if it is not* — **at the same time, off one reading**. That is an invariant with an incident behind it ([`@olai/chat`](../chat/README.md)'s `agent.ts`): a caller that asked once for the entry to hand over and again for the sentence to say would start somebody's daemon twice per conversation and could answer the two questions about two different instants.

It replaces three fields. A `probe` beside an `mcpServer` was those two readings; and a `failures` table — `Record<tag, string>` — **cannot hold the sentences that exist**, because three of kolu's five carry a deadline, a cause or the daemon's own refusal, none of which is knowable before the failing. A table core looked a tag up in would leave core composing what it must not compose. So the sentence rides on the answer, whole, and core displays it.

The probe takes **what the process can see** and not the [`PluginServices`](src/plugin.ts) blob the runtime half gets, which is the one place this package narrows what it offers. That is a fact about WHEN rather than a second vocabulary: a runtime half is made once, when the surface binds, with a clock and two log channels the bound runtime owns; a probe is asked before any of that exists, because the composition root builds the chat before it binds the surface. Finding an executable depends on the environment and on nothing else.

`@olai/chat` declares the shape of the question and each plugin declares its own answer, and **neither imports this package**: a plugin may not (the registry imports every plugin), and chat is a general package a floor below the plugin system that is handed a list. The two spellings meet in one expression at the composition root, where a drift between them is a type error.

## One doorbell, and what it may say

A plugin may put a **sentence into a conversation**, and that is the whole of the capability: [`PluginServices.deliveries`](src/plugin.ts) is `scopes()` — which conversations opted into *this* plugin's wakes, each with the file a person picked to filter by — and `deliver(to, body, options?)`. There is no terminal here, no fleet, no board and no watcher; the door is generic or it does not land.

**Write-only, and that is the load-bearing half.** There is no `read`, no `transcript`, no `history`, and no arm of the interface where one could be added without saying so in the type. A plugin can put words INTO a conversation and can never learn what is in one — not what a person typed, not what the agent answered, not whether anybody read it. A capability that could do both would be the appliance reading the human's mail, and no amount of care at the call site takes that back afterwards.

**Built per plugin**, beside `dial` and keyed the same way — the plugin's own `name`, as runtime data the composition root closes over. An unkeyed door would hand one plugin the conversations a person scoped to another. It is **required** rather than optional, unlike `dial`: a real serve legitimately dials nothing, and there is no serve where the door is missing — a machine with no ACP agent answers `scopes()` with the empty list forever, which is the honest machine-without-the-tool state and needs no failure channel on a verb that cannot fail.

What core does with a body is three arms, and which one it took is never reported back — there is no arm a plugin would answer differently. A conversation whose agent is **idle** takes it as a turn of its own, on a row marked with the plugin's name (`@olai/surface`'s `rang`, stamped by core from the registry binding, never by the caller). A conversation whose agent is **mid-turn** HOLDS it until the turn boundary, because a message that arrived alongside a running turn would spend the human's interruption with nobody having typed anything ([`@olai/chat`](../chat/README.md)'s `queuedHere`). A conversation **nobody is in** holds it until somebody opens it. Bodies sharing a `coalesce` key replace each other in place while they are still held, which is what lets a plugin send a fresh whole sentence per event and have a person read one message rather than five.

**Manual, per conversation, and off until a person picks.** `chat.scope` is on the browser face and deliberately nowhere else, so there is no serve-level default and nothing an agent can call to wake itself.

## One kind, and both doors ask it

A plugin's face used to follow a hardcoded property KEY — a value was a terminal because somebody called the column `terminal`. That is name-matching, and `brief` and `worktree` are the proof it cannot hold: both are declared `path`, on the same rows, and only one of them names a checkout to dial a socket in. So a plugin contributes a **kind** ([`src/plugin.ts`](src/plugin.ts)'s `PropKind`), a vault declares it in `_olai/Properties.olai` like any other type, and the server's walks, the value gate AND the browser's dressing table all follow the DECLARATION. The browser follows it at one remove and that remove is the point: a vault's declarations do not travel to a tab, so the page carries the licence as an ANSWER per drawn value (`/format`'s `Licence`) — the same consult that answers what a value NAMES answers what claims it. Keying the tab's table on the property key was the last surviving half of the name-matching defect, and it is gone.

**[`@olai/format`](../format/README.md) imports no plugin** — the registry imports every plugin, so the arrow cannot point back. Its kind vocabulary is a PARAMETER: the format's union grows exactly ONE arm (`{kind: "contributed", word}`), so the five type-coupled places that enumerate kinds stay exhaustive and a contributed kind cannot silently stop being handled, and the table of words is assembled at the composition root and handed down. It is the same move the vault walks already make.

**One entry, not two tables.** The same `PropKind` says what a refusal calls the kind and whether a value fits, and both arms of the consult ask it — the gate, and the reading that decides what a value NAMES. Two opinions about one value is the bug family [`@olai/format`](../format/README.md)'s `meaning.ts` header is a list of, and this is where the second one would have been born.

**BUILT and ENABLED are two questions.** A DECLARATION is refused against every kind this binary was built with, so `{"type":"kolu-terminal"}` is a clean row on a serve running `--plugins=odu` and `{"type":"banana"}` is a broken file either way — a file's verdict may not depend on a flag it cannot see. A VALUE is held to the kinds this serve is RUNNING, because `admits` is a promise only a plugin that is here can make. A kind whose plugin is off validates as plain text, wears no face, and leaves the vault in the state it was in before it ever heard of the plugin.

**What it costs a vault is NOTHING.** Each kind claims the key of its own composed word, so an enabled plugin declares `kolu-terminal` / `odu-worktree` for a vault that has said nothing about them — and olai never writes anybody's vault to do it. Precedence lives in one function (`@olai/format`'s `withClaims`): **the vault always wins**, so a row moves a kind onto a short key and a row can take a face away. The claim rides the ENABLED table, so a disabled plugin's claims vanish with its kinds and a `--plugins=odu` serve is byte-identical to a vault that never heard of kolu. There is still deliberately no fallback to the key's NAME: a fallback is the defect kept alive under a second name, and prefixing is what makes a built-in claim safe instead — a plugin can only ever auto-declare a key carrying its own name.

## What the app hands a plugin

A plugin's browser half draws a chip that TICKS, a pill in the app's bar, a panel that hangs off it and a link into the served set — four of the app's own contracts, and every one of them breaks **silently** when it is spelled twice. So the app hands them across as a value ([`src/plugin.ts`](src/plugin.ts)'s `AppFurniture`): the clock and its duration register, the chrome pill's geometry, the desktop breakpoint, a popover already wearing the bar's portal, layer and anchor, and a door onto a served file.

That is `@olai/web`'s own `BlockChrome` scaled up — the drawer already hands a face its fact line rather than letting the face spell `"prop"` — and it is the only shape available: the app mounts every plugin, so a plugin that imported the app for those names would be a cycle. Each plugin re-declares the part it reads, structurally, and contravariance makes that the **stronger** agreement: a plugin asking for something the app does not hand over is a type error at the registry's `satisfies`, with that plugin's name on the line.

## The direction is physics

`@olai/plugins` imports every plugin. **No plugin imports it back** — a plugin declares its manifest as a plain `as const` object and the fit is proved here, by `satisfies`, which is the same structural agreement `@olai/ops` keeps with the surface's `Status`. So the dependency is a DAG the manifests express, and a cycle is not a rule a reviewer remembers but a thing `bun install` cannot describe.

[`src/fence.test.ts`](src/fence.test.ts) holds the rest as claims: no package outside this one imports or declares a plugin (an **equality** per package, never a filtered list asserted empty — a rotted pattern reports nothing and passes); no plugin imports another; every plugin composes under its own name and no two share one; and each door carries what it may and nothing else.

It does **not** claim that no file spells the word. Prose that names a package is not a dependency, and a fence that failed on a comment is one people learn to work around — `scripts/check-kolu-deps.sh`'s own ruling, kept. The sweep over what a general package spells in *code* is claim 8 of that same file: it reads what a source COMPILES TO rather than what it says, so a `koluHalf(…)` call or a `wiring.kolu` slot in a general package is red and a comment naming kolu is not. It used to be a POINTER at a sweep in `@olai/tests` that nobody had written; the reason for the exile ("a sweep here reading the browser would be the floor reading the roof") overstated the direction, since `fence.test.ts` already reads every package's sources as text.

## What a disabled plugin is

**Absent from the record**, and that costs no mechanism. `composeSurfaceContracts`, `implementSurfaces` and `surfaceClients` all take a plain keyed object of surfaces, so `--plugins` is a filter over that object and nothing else: no sibling, no tag, no handler, no expose row, no `surface/<name>/` on the wire at all. A plugin that is off never probes, unmounts its chrome, registers no dressing, validates its kinds as plain text, and leaves the outline it would have owned an ordinary outline.

`--plugins` is CLI/nix only — the git-policy shape, no settings file and no browser toggle — and preferences draws the rows read-only, naming where to change them.

The same is true one step further out: a runtime composed with **no plugins at all** hands `implementSurfaces` an empty record, which composes to a group with no requests and a handler record with none, and fusing that onto olai's own surface leaves it byte for byte what it was. That is what `@olai/server`'s `wiring.plugins: null` means, and it is the state every `olai surface`, every headless face and every server test runs in. [`src/composition.test.ts`](src/composition.test.ts) asserts it rather than leaving it to be discovered.
