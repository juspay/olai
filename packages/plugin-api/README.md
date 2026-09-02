# @olai/plugin-api — what a plugin is written against

olai integrates with two things that are not olai: [kolu](https://kolu.dev), which runs coding agents in terminals and serves them over MCP, and [odu](https://github.com/juspay/odu), which runs CI. The part of that integration which is genuinely **olai's own judgement about an appliance** — what an absent padi means, which vault file is kolu's by convention, which property wears which face — belongs neither to the appliance nor to core, and this is the interface it is written against.

**This package names no plugin.** That is the whole of why a plugin may import it, and it is a reversal: for several rounds this package was the interface AND the registry, so a plugin importing it back was a cycle the manifests could not express and a manifest was therefore a plain `as const` object proved by the registry's `satisfies`. The registry is [`@olai/bundle`](../bundle/README.md) now. The `satisfies` stays, because a structural agreement checked where both ends are in hand is the stronger claim; what the reversal buys is that a server half can name the services it needs.

## Two doors, because two processes

| door | who opens it | what it carries |
| --- | --- | --- |
| `.` | a plugin's BROWSER half, and `@olai/web` | `OlaiPlugin` and the face types under it — dressings, chrome slots, marks — plus what the app hands a browser half (`AppFurniture`). Every field returns `JSX.Element`, so this door names `solid-js` |
| `./services` | a plugin's SERVER half, and `@olai/server`'s composition root | the Cordis `Service` classes a plugin's `inject` names, the events it listens on, and the declaration merging that types `ctx.vault`. This door names `cordis` and no browser face |

A server that reached the first door would evaluate a `.tsx` and die on `Cannot find module 'react/jsx-dev-runtime'` before it served anything. `@olai/bundle`'s [`fence.test.ts`](../bundle/src/fence.test.ts) walks the services door and holds it to the same list a server door is held to.

[`src/contract.ts`](src/contract.ts) is what both halves share — `PropKind`, `Probed`, `NotHere`, `StdioServer`, `Deliveries`, `Wake`, `PluginWire`, and the word a kind is composed into. Data shapes with no runtime behind them, so neither process pays for the other's graph.

## The server half is a Cordis plugin

```ts
export const name = "odu"
export const inject = ["clock", "deliveries", "env", "kinds", "log", "surfaces", "vault", "wakes"]

export function apply(ctx: Context) { … }
```

Three properties fall out of that, and none of them is a convenience.

**A registration carries its own undo.** Every `register` method returns a disposer, attached by the service to the CALLING fiber with `ctx.effect`. Unloading a plugin unregisters exactly what it registered, in reverse; a plugin whose `apply` throws before it reached a `register` installed nothing at all, and its siblings stay ACTIVE. There is no teardown to write and none to forget. It replaced a `serve(services)` that returned a blob core took apart — a `deps`, a `published` hand-back, and two hooks a revision drove.

**`inject` is a reactive dependency.** The runtime holds the fiber `PENDING` until every named service exists, unloads it when one leaves, and re-applies it when one returns. A plugin that does not name `deliveries` cannot reach the doorbell — which is the part `PluginServices` could not express, because every plugin received every field whether it had a use for one or not.

**The per-plugin STAMP is read inside the service.** `ctx.deliveries.deliver(...)`, `ctx.env.dial()`, `ctx.kinds.register(...)` and `ctx.surfaces.register(...)` all read `ctx.fiber.name` — the word the loader bound the row under, never an argument the caller supplied. The composition root used to close over a name to build `doorFor(plugin.name)` and `dials[plugin.name]`, which put a fence's keying in a file that must not know what it was keying. Same guarantee; nobody threads it.

| service | what it is |
| --- | --- |
| `env` | what the process can see, plus `dial()` — a test's injectable for THIS fiber |
| `clock` | `now()`, as ISO-8601 |
| `log` | `say` (routine, at debug) and `warn` (what the owner must read). Which of its own sentences goes where is the plugin's; which channel each level IS is the root's |
| `vault` | the served directory, and the two events its revisions raise |
| `deliveries` | the doorbell — `scopes()` and `deliver(...)`, keyed by the calling fiber |
| `kinds` | `register(kind)`, composing the word from the fiber's name |
| `surfaces` | `register({surface, faces, deps, published?})` — one sibling per plugin |
| `wakes` | `register(wake)` — the sentence the strip draws, and the two a broken scope is owed |

## The events

| event | mode | what it replaced |
| --- | --- | --- |
| `vault/revision` | emit | `PluginServer.revision(snapshot)`. The whole published snapshot; every listener narrows it in its own signature to the part it reads |
| `vault/unloaded` | emit | `PluginServer.unloaded()`. **Not teardown** — it means the STORE has never published, so a reading derived from the vault is yesterday's while what a plugin holds from its own daemon is untouched. Unloading the PLUGIN is the fiber being disposed, which unwinds every effect above |
| `surfaces/published` | emit | nothing; the roster could not move |
| `chat/session-start` | waterfall | `PluginServerHalf.probe`. A listener pushes a THUNK — its name and what it would ask — and the list is collected per session open, so a plugin that unloaded between conversations contributes nothing to the next one |

## What is deliberately not here

Interception on the `vault` service — the subtree write fence a node agent runs under — arrives with node-agent scopes. So do HMR (no Bun cache bust exists) and browser slots. The Cordis proposal's §6 has the order.

---

## One probe, and what it answers

A plugin's tool is not necessarily on the machine olai is serving from, so a plugin may declare a **probe**: one call, per chat session, answering *is it here* and *what is a person owed if it is not* — **at the same time, off one reading**. That is an invariant with an incident behind it ([`@olai/chat`](../chat/README.md)'s `agent.ts`): a caller that asked once for the entry to hand over and again for the sentence to say would start somebody's daemon twice per conversation and could answer the two questions about two different instants.

It replaces three fields. A `probe` beside an `mcpServer` was those two readings; and a `failures` table — `Record<tag, string>` — **cannot hold the sentences that exist**, because three of kolu's five carry a deadline, a cause or the daemon's own refusal, none of which is knowable before the failing. A table core looked a tag up in would leave core composing what it must not compose. So the sentence rides on the answer, whole, and core displays it.

The probe takes **what the process can see** — `ctx.env.vars`, and nothing else. Finding an executable depends on the environment and on nothing else, and a probe that read `process.env` itself would answer a different question than the one a session.s own spawn will ask.

`@olai/chat` declares the shape of the question and each plugin declares its own answer, and **neither imports this package**: a plugin may not (the registry imports every plugin), and chat is a general package a floor below the plugin system that is handed a list. The two spellings meet in one expression at the composition root, where a drift between them is a type error.

## One doorbell, and what it may say

A plugin may put a **sentence into a conversation**, and that is the whole of the capability: [`ctx.deliveries`](src/plugin.ts) is `scopes()` — which conversations opted into *this* plugin's wakes, each with the file a person picked to filter by — and `deliver(to, body, options?)`. There is no terminal here, no fleet, no board and no watcher; the door is generic or it does not land.

**Write-only, and that is the load-bearing half.** There is no `read`, no `transcript`, no `history`, and no arm of the interface where one could be added without saying so in the type. A plugin can put words INTO a conversation and can never learn what is in one — not what a person typed, not what the agent answered, not whether anybody read it. A capability that could do both would be the appliance reading the human's mail, and no amount of care at the call site takes that back afterwards.

**Keyed by the CALLING FIBER**, beside `dial` and by the same rule: the service reads `this.ctx.fiber.name`, which is the word the loader bound the row under and not something a caller can spell. An unkeyed door would hand one plugin the conversations a person scoped to another, and a door keyed by an argument would let one plugin sign another.s name onto a row that reaches an agent. The composition root used to close over the name; it does not any more, which takes a fence.s keying out of a file that must not know what it is keying. It is **required** rather than optional, unlike `dial`: a real serve legitimately dials nothing, and there is no serve where the door is missing — a machine with no ACP agent answers `scopes()` with the empty list forever, which is the honest machine-without-the-tool state and needs no failure channel on a verb that cannot fail.

What core does with a body is three arms, and which one it took is never reported back — there is no arm a plugin would answer differently. A conversation whose agent is **idle** takes it as a turn of its own, on a row marked with the plugin's name (`@olai/surface`'s `rang`, stamped by core from the registry binding, never by the caller). A conversation whose agent is **mid-turn** HOLDS it until the turn boundary, because a message that arrived alongside a running turn would spend the human's interruption with nobody having typed anything ([`@olai/chat`](../chat/README.md)'s `queuedHere`). A conversation **nobody is in** holds it until somebody opens it. Bodies sharing a `coalesce` key replace each other in place while they are still held, which is what lets a plugin send a fresh whole sentence per event and have a person read one message rather than five.

**THE BODY MUST OPEN WITH ITS OWN ATTRIBUTION**, and it is the one obligation this door places on the plugin's words. The `rang` mark is a LIVE affordance: it is what a browser draws the machine face off, and it does not survive a replay — a conversation resumed from the agent's own store is rebuilt out of message chunks, which carry text and nothing else, so the mark is not among them. A sentence that did not say who was speaking would come back in the person's own rows, which is a plugin's words in a human's mouth. So the durable account is the sentence, and a plugin writes its own name and the time into the first line of every body it delivers ([`src/plugin.ts`](src/plugin.ts)'s `Deliveries.deliver`; kolu's `bodyFor` is the worked example). Core cannot do it for them without composing part of the sentence, which is the one thing the whole shape refuses.

**Manual, per conversation, and off until a person picks.** `chat.scope` is on the browser face and deliberately nowhere else, so there is no serve-level default and nothing an agent can call to wake itself.

**WHICH FILES A WAKE MAY BE POINTED AT IS THE PLUGIN'S ANSWER.** `Wake.kinds` is `@olai/format`'s own file-kind words, and the picker offers those and no others. A scope is a FILTER, and only the thing filtering knows what it reads out of a file: kolu derives its claimed set from the values on a file's un-done NODES, so a document derives the empty set for ever. The picker used to offer every served file — the human's screenshot, 2026-09-01, has a `.md` between two outlines — and a conversation scoped to one heard nothing while the heartbeat went on reporting a live watcher, which is the exact confusion the heartbeat exists to prevent. Core did not have to learn what a wake file means to close that; it had to be told which kinds could be one. The words cross as DATA rather than as a predicate, because the picker is in a browser, and they are compared there against the same registry the store walked the directory with. **The bound is the declaring plugin's**, and it has to be: core cannot know whether a doorbell can WALK a kind, so it takes the list as given — while a plugin that derives from a file's records annotates its own list with `@olai/format`'s `NodeKind` (the complement of `BodyKind`, off the same `holds` column), which makes naming `"document"` there the same class of error as naming a word the table never had. `FileKind` alone is NOT that guard: it admits every bodied kind, so it catches `"hologram"` and passes the one word that rebuilds the whole defect.

**AND THE SCOPE ITSELF CAN BREAK, so the plugin declares the sentences for that too.** `wake.faults` is a whole sentence per WAY this doorbell can stop watching, keyed by the way's own word: `gone` for the file that stops being served, `unwatchable` for the file that is right there and is not a kind this wake can read. A TABLE and not two fields, because core indexes it by the cause its own walk recorded — so a third way goes red in every plugin that rings, naming the sentence it now owes, where a ternary at the composition root would fall through and tell somebody their file had been renamed while it sat in front of them. The defect both close is a silence — a doorbell that derives nothing derives nothing forever, and quiet-because-broken looks exactly like quiet-and-fine on every channel there is. Core DETECTS both, because core owns the served set, the declaration and the picks and the plugin owns none of them once its doorbell has stopped watching ([`@olai/chat`](../chat/README.md)'s `Chat.faults`), and core SAYS nothing: it carries whichever string the cause names through the same door, whole, naming no file and joining nothing to it. That is why each is one string where the drawn three are pieces — nothing is drawn between their halves. TWO of them and not one with an *or* in it: the consequence is identical and what happened is not, and a single sentence would say *renamed, or moved, or deleted, or not an outline* on every rename for ever. Both are REQUIRED wherever `wake` is present, because a plugin that rings has scoped conversations, every one of them can be renamed out from under it, and a stored pick can name any path at all. A scope in either state also leaves `scopes()` entirely, so a doorbell cannot ring for it and nothing else a plugin does per scope can either.

## One kind, and both doors ask it

A plugin's face used to follow a hardcoded property KEY — a value was a terminal because somebody called the column `terminal`. That is name-matching, and `brief` and `worktree` are the proof it cannot hold: both are declared `path`, on the same rows, and only one of them names a checkout to dial a socket in. So a plugin contributes a **kind** ([`src/plugin.ts`](src/plugin.ts)'s `PropKind`), a vault declares it in `_olai/Properties.olai` like any other type, and the server's walks, the value gate AND the browser's dressing table all follow the DECLARATION. The browser follows it at one remove and that remove is the point: a vault's declarations do not travel to a tab, so the page carries the licence as an ANSWER per drawn value (`/format`'s `Licence`) — the same consult that answers what a value NAMES answers what claims it. Keying the tab's table on the property key was the last surviving half of the name-matching defect, and it is gone.

**[`@olai/format`](../format/README.md) imports no plugin** — the registry imports every plugin, so the arrow cannot point back. Its kind vocabulary is a PARAMETER: the format's union grows exactly ONE arm (`{kind: "contributed", word}`), so the five type-coupled places that enumerate kinds stay exhaustive and a contributed kind cannot silently stop being handled, and the table of words is assembled at the composition root and handed down. It is the same move the vault walks already make.

**One entry, not two tables.** The same `PropKind` says what a refusal calls the kind and whether a value fits, and both arms of the consult ask it — the gate, and the reading that decides what a value NAMES. Two opinions about one value is the bug family [`@olai/format`](../format/README.md)'s `meaning.ts` header is a list of, and this is where the second one would have been born.

**BUILT and ENABLED are two questions.** A DECLARATION is refused against every kind this binary was built with, so `{"type":"kolu-terminal"}` is a clean row on a serve running `--plugins=odu` and `{"type":"banana"}` is a broken file either way — a file's verdict may not depend on a flag it cannot see. A VALUE is held to the kinds this serve is RUNNING, because `admits` is a promise only a plugin that is here can make. A kind whose plugin is off validates as plain text, wears no face, and leaves the vault in the state it was in before it ever heard of the plugin.

**What it costs a vault is NOTHING.** Each kind claims the key of its own composed word, so an enabled plugin declares `kolu-terminal` / `odu-worktree` for a vault that has said nothing about them — and olai never writes anybody's vault to do it. Precedence lives in one function (`@olai/format`'s `withClaims`): **the vault always wins**, so a row moves a kind onto a short key and a row can take a face away. The claim rides the ENABLED table, so a disabled plugin's claims vanish with its kinds and a `--plugins=odu` serve is byte-identical to a vault that never heard of kolu. There is still deliberately no fallback to the key's NAME: a fallback is the defect kept alive under a second name, and prefixing is what makes a built-in claim safe instead — a plugin can only ever auto-declare a key carrying its own name.

## What the app hands a plugin

A plugin's browser half draws a chip that TICKS, a pill in the app's bar, a panel that hangs off it and a link into the served set — four of the app's own contracts, and every one of them breaks **silently** when it is spelled twice. So the app hands them across as a value ([`src/plugin.ts`](src/plugin.ts)'s `AppFurniture`): the clock and its duration register, the chrome pill's geometry, the desktop breakpoint, a popover already wearing the bar's portal, layer and anchor, and a door onto a served file.

That is `@olai/web`'s own `BlockChrome` scaled up — the drawer already hands a face its fact line rather than letting the face spell `"prop"` — and it is the only shape available: the app mounts every plugin, so a plugin that imported the app for those names would be a cycle. Each plugin re-declares the part it reads, structurally, and contravariance makes that the **stronger** agreement: a plugin asking for something the app does not hand over is a type error at the registry's `satisfies`, with that plugin's name on the line.

