# @olai/plugin-api — what a plugin is written against

olai integrates with things that are not olai, and every one of them is a PLUGIN written against this interface. They come in two kinds and the system tells them apart nowhere.

**TENANTS** are olai's own judgement about an appliance: [kolu](https://kolu.dev), which runs coding agents in terminals and serves them over MCP; [odu](https://github.com/juspay/odu), which runs CI; and [Xyne Spaces](https://github.com/xynehq/xyne), the org.s team chat. What an absent padi means, which vault file is kolu's by convention, which property wears which face — none of that belongs to the appliance or to core.

**ENGINES** are the ACP agents the chat panel can seat: `claude`, `opencode`, `pi`. Each is one directory and one row, because they share no release clock — the Claude adapter's pin moved five times in a month and opencode's has never moved — and because `--plugins` then enables them one at a time: `--plugins=opencode,pi` is a serve with no Claude row, no probe of one, and no mark for one anywhere. What an engine hands over is DATA and pure functions (`agents.register` below); it never spawns, sends or sees a transcript, which is `@olai/chat`'s.

**This package names no plugin.** That is the whole of why a plugin may import it, and it is a reversal: for several rounds this package was the interface AND the registry, so a plugin importing it back was a cycle the manifests could not express and a manifest was therefore a plain `as const` object proved by the registry's `satisfies`. The registry is [`@olai/bundle`](../bundle/README.md) now, and what the reversal buys is that both halves can name the services they need. The `satisfies` did not survive the second move: there is no compiled-in list left to check a plugin against — the rows name MODULES and the loader resolves them at mount — so a half that does not export what the runtime believes it does fails where the runtime would fail, by the row's own name (`@olai/bundle`'s `tree.testlib.ts` imports exactly as the loader does), rather than on a line in a list nobody maintains.

## Two doors, because two processes

| door | who opens it | what it carries |
| --- | --- | --- |
| `.` | a plugin's BROWSER half, and `@olai/web` | the seven SLOTS a face hangs in and the service TAGS a half names in its `needs` ([`src/browser.ts`](src/browser.ts)), plus the face TYPES that say what each of those faces is handed ([`src/plugin.ts`](src/plugin.ts)). It was `OlaiPlugin` — a manifest VALUE carrying `dressings`, `chrome`, `mount` and `mark` — beside `AppFurniture`, the one record the app handed every face as a prop; **neither is exported any more**, and the section below says what retired them. Every face returns `JSX.Element`, so this door names `solid-js`; it also carries `definePlugin`, because a browser half is a plugin exactly as a server half is |
| `./services` | a plugin's SERVER half, and `@olai/server`'s composition root | the Effect service TAGS a plugin's `needs` lists, the one waterfall it may add a link to, `definePlugin` and `detached` — and, for a composition root, `openPlugins`, which is the other end of every door on it. This door names `effect` and no browser face |

A server that reached the first door would evaluate a `.tsx` and die on `Cannot find module 'react/jsx-dev-runtime'` before it served anything. `@olai/bundle`'s [`fence.test.ts`](../bundle/src/fence.test.ts) walks the services door and holds it to the same list a server door is held to.

**Neither door names the plugin runtime.** olai is written in Effect, and the runtime under a plugin is Cordis; the translation between them is one package, [`@olai/effect-cordis`](../effect-cordis/README.md), and **this package is the door onto it** — for a plugin, and for a composition root too. [`src/runtime.ts`](src/runtime.ts) is that one list, re-exported verbatim by both doors above. What a plugin gets is olai's tags and olai's `definePlugin`; that there is an engine at all is this package's business.

Two of the bridge's exports are deliberately not on that list, and they are the only two that could not be: `openHost` and `provide`. The mild version of the argument is that a plugin which could open a host could provide itself the services it is meant to name. The sharp version is **name forgery**: `mountPlugin` IS on the list and takes a `Host`, and the per-plugin stamp is `ctx.fiber.name` read once with no parameter anywhere — so a plugin holding a host calls `mountPlugin(host, {name: "kolu", inject: [], apply})` and every registration that fiber makes is stamped `kolu`. The fence the whole keying design exists to be would be one export away, and it is unreachable today only because no plugin can obtain a host to hand it. This package spends both on the caller's behalf, in `openPlugins` and `openApp`.

A plugin that genuinely has to stand behind a service gets neither. It gets `Offers` ([`src/services.ts`](src/services.ts)), the vocabulary form of the same capability: the key set is **closed** (four doors, so core's own tags can never be shadowed), the offer is **refusable** in olai's words naming both rows and the key, it is **declared** in `needs` like any other tag, and it **never holds a host** — the host is closed over inside `openPlugins`. Four overloads rather than one generic, so a plugin writes `(who) => ({ … })` and never spells `ServiceKey` or `Provision`, neither of which is on its door.

Everything else the bridge re-exports is either what a plugin writes with or what a root reads afterwards. `broadcast`, `registry` and `roster` joined that list, and they are the same kind of thing as `detached` rather than the same kind of thing as `provide`: a table of scope-held entries reaches no host, provides nothing and names nobody. Handing them over is the argument `openPlugins` already makes about itself — *the three buses, and they are one primitive rather than three hand-rolled copies of it* — applied on the other side of the same seam, because a plugin standing behind a door holds exactly those tables. Hand-rolling one is how a registration stops unwinding with its writer, how a collision starts resolving silently in favour of whoever registered last, and how a handler that dies takes the dispatch down with it.

One thing is reached past this door, by `@olai/bundle` and nobody else: `@olai/effect-cordis/loader`, to mount the rows. That is a GRAPH and not an exemption — the loader carries `node:url`, `node:fs` and a YAML parser, so re-exporting it from here would put all of it on the door a tab opens, and that does not fail at a boundary claim, it fails at `bun build`. The ruling being kept is about **`cordis`**, not about the bridge — `@olai/bundle`'s [`fence.test.ts`](../bundle/src/fence.test.ts) holds *Cordis is an engine nobody outside one package sees* as an equality over every package in the tree, and `scripts/prove-fence.sh`'s mutation 16 is a plugin importing the engine directly.

[`src/contract.ts`](src/contract.ts) is what both halves share — `PropKind`, `Probed`, `NotHere`, `StdioServer`, `Deliveries`, `Wake`, `PluginWire`, and the word a kind is composed into. Data shapes with no runtime behind them, so neither process pays for the other's graph.

An ENGINE.s registration is NOT among them: `Leg`, `Adapter`, `Where`, `Registering` and `PromptChannel` are [`@olai/acp`](../acp/README.md).s `./engine` door, and they are there rather than here for a reason this package could not solve — an engine plugin writes them and `@olai/chat` reads them, and neither may import the other. The shape both spell had to live under both, which is the protocol package: an engine is an ACP agent and how to reach one. `NotHere` went there too for one revision, on the theory that an engine.s install sentence and an absent MCP server were one shape two walls needed. They were not: the sentence is drawn by the engine.s own BROWSER half out of a slot, so no server-side registration ever carried it anywhere, and `@olai/chat` had gone on declaring its own copy throughout. It is back here, beside `Probed`, which is its one reader.

## The server half is an Effect

```ts
export default definePlugin({
  name,
  needs: [Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  apply: Effect.gen(function*() { … }),
})
```

`definePlugin` is re-exported from this package rather than reached for in
[`@olai/effect-cordis`](../effect-cordis/README.md), and that is deliberate: a
plugin that had to name the bridge would be a plugin that knows there is one.
What it imports is olai's interface; that the interface is built on a
translation of a plugin runtime is this package's business and nobody else's.

Three properties fall out of that, and none of them is a convenience.

**A registration carries its own undo.** Every `register` is an `Effect.acquireRelease` on the calling plugin's own `Scope`. Unloading a plugin closes that scope, which unregisters exactly what it registered, in reverse; a plugin whose `apply` failed before it reached a `register` installed nothing at all, and its siblings stay running. There is no teardown to write and none to forget — and where a half genuinely holds something the runtime cannot see, it writes one `Effect.addFinalizer` and nothing else (`olai-plugin-xyne-spaces` does, for its mirrors). It replaced a `serve(services)` that returned a blob core took apart — a `deps`, a `published` hand-back, and two hooks a revision drove.

**`needs` is a reactive dependency AND the requirement channel.** The runtime holds the plugin `waiting` until every named service exists, unloads it when one leaves, and re-applies it when one returns; and the compiler computes the `R` of `apply` from the SAME array, so a service yielded and not named is a `tsc` error at the `definePlugin` call. A plugin that does not name `Deliveries` cannot reach the doorbell — which is the part `PluginServices` could not express, because every plugin received every field whether it had a use for one or not, and two hand-written declarations could disagree about.

**The per-plugin STAMP is not an argument and cannot be spelled.** A keyed service is a *provision* — a function from the plugin's own word to that plugin's view of it — which the facade calls once, with the name it read off the fiber. So `deliveries.deliver(...)` has no parameter for "who", `env.dial` is already this plugin's double, and `kinds.register(...)` takes the bare word and composes the prefix itself. The composition root used to close over a name to build `doorFor(plugin.name)` and `dials[plugin.name]`, which put a fence's keying in a file that must not know what it was keying. Same guarantee, and now nowhere to put it wrong.

| service | what it is |
| --- | --- |
| `env` | what the process can see, plus `dial()` — a test's injectable for THIS fiber |
| `clock` | `now()`, as ISO-8601 |
| `vault` | the served directory, and the two doors its revisions ring |
| `deliveries` | the doorbell — `scopes()` and `deliver(...)`, minted from the calling plugin's own word |
| `kinds` | `register(kind)`, composing the word from the plugin's own name |
| `surfaces` | `register({surface, faces, deps, published?})` — one sibling per plugin |
| `wakes` | `register(wake)` — the sentence the strip draws, and the two a broken scope is owed — and `declared`, the one READ side on this door: a plugin that refuses a conversation scope written for a plugin nobody mounted has to be able to ask which plugins ring, and the table is read afresh so a plugin that unloaded between two checks has taken its declaration with it |
| `watching` | `subscribe(handler)` — conversation events, PUSHED: a doorbell that landed, an orchestrator reply that settled, a turn that started or ended. Never a human message, and never a read |
| `held` | `load` / `save(record)` — a small opaque record this plugin keeps about this serve, in the state home rather than the vault, minted from the calling plugin's own word |
| `agents` | `register(engine)` — one ACP engine this build can seat: a `Leg` that reads its wire, a probe that answers `Adapter | null` for this host, and the channel the standing prompt rides. The ID is the fiber.s word and there is no field to spell one in. How a person GETS the engine is NOT here: that sentence is drawn by the engine.s own browser half out of `chat.agent.install`, and a copy on this registration was read by nothing |
| `offers` | `offer(key, door)` — stand behind one of FOUR doors (`agents`, `deliveries`, `chat/session-start`, `watching`) for as long as this plugin is loaded. Closed, refusable, declared, and holding no host; see above |
| `tools` | `server` — the vault's own MCP server, as an address and a bearer token, once the listener has bound. An Effect that WAITS: the tag is provided before any row is mounted (a plugin left PENDING through the vocabulary read would lose its property kind from the store's codec for the life of the process) and resolved after `listen` returns, so reading it is also the one signal core has that the serve is up |
| `bundle` | `rank(plugin)` — where a row sits in this build's own list. Registration order is the order two dynamic `import()`s came back in, and a person reads these lists; a RANK and not a row list, so nothing gains the ability to enumerate its siblings |

**There is no `log` service, and its absence is the phase.** It was `say` and `warn`, wired by the composition root to `ring(Effect.logDebug(line))` and `ring(Effect.logWarning(line))` — an Effect run from a callback, per line, because the plugin had no fiber to emit from. A plugin's `apply` IS a fiber, so `Effect.logDebug` and `Effect.logWarning` are what a plugin says its lines with and they arrive with the level the operator asked for, the annotations the serve set and the span it was inside. WHICH level a sentence goes at is still the plugin's decision and still the same one.

**And one seam is named rather than reinvented.** An appliance is not written in Effect and is not wrapped, so where one fires a callback that has to start an Effect, a plugin takes `detached` once: it forks under the plugin's own services and onto the plugin's own scope, so a line carries the operator's level and work in flight when the plugin unloads goes with it.

## The hooks

| hook | mode | what it replaced |
| --- | --- | --- |
| `vault.revision(handler)` | door | `PluginServer.revision(snapshot)`. The whole published snapshot; every listener narrows it in its own signature to the part it reads — a CLAIM about what the root rings rather than a check, because the door's payload is the handler's to name (one `as` in the provision, where three casts in three plugins used to be; `src/services.ts` argues what a checked one would cost) |
| `vault.unloaded(handler)` | door | `PluginServer.unloaded()`. **Not teardown** — it means the STORE has never published, so a reading derived from the vault is yesterday's while what a plugin holds from its own daemon is untouched. Unloading the PLUGIN is its scope closing, which unwinds every registration above |
| `SessionStart.ask(probe)` | keyed registration | `PluginServerHalf.probe`, and then a `chat/session-start` waterfall a listener pushed a THUNK onto. It is a registration now, keyed by the fiber like every other door: the plugin hands over the Effect it would run and nothing else — no name to sign, no promise to wrap — and the list is READ per session open, so a plugin that unloaded between conversations contributes nothing to the next one. The waterfall.s own powers (transform, short-circuit) were never used here and could not honestly be, since the order its links ran in was the order two dynamic imports came back in |

Both vault doors are registrations on the calling plugin's scope, so a plugin the
roster stops naming stops hearing revisions without remembering to say so. Both
take a handler that answers an Effect, and the publisher AWAITS every one of
them: the root rings a revision from inside the directory binding's own
connector, and the statements after it write a world every plugin has already
re-derived. That is why they are not `Stream`s — a stream subscriber is a fiber
of its own, and the publisher could only offer and walk on.

**Why they are doors rather than events.** They were `ctx.on("vault/revision")`
and `ctx.on("vault/unloaded")` on the engine's own bus, defended by a sentence
that turned out to be
wrong: *both are emits, so a listener that throws is one listener's problem —
the dispatcher contains it.* Cordis's `emit` is a bare `Reflect.apply` loop with
no `try`. A plugin throwing on a revision silenced every plugin after it on that
revision and failed the owned directory fiber that published it. Every listener
is wrapped once inside the door now, warned with the calling plugin's name;
the two events are removed from `Events` rather than kept beside the doors as an
uncontained second way in. `surfaces/published` was declared and never emitted,
so it is gone rather than implemented.

## The browser half is an Effect too

```tsx
export default definePlugin({
  name,
  needs: [Slots, Clocks, Wired],
  apply: Effect.gen(function*() {
    yield* (yield* Slots).register("outline.row.chip", WORKTREE_KIND, CiChip)
  }),
})
```

**It was a VALUE.** An `OlaiPlugin` manifest — `dressings`, `chrome`, `mount` and `mark` on one object — listed in a compiled-in registry and walked by four modules inside `@olai/web`. That shape was right while a browser half was a thing the tab HAD, and it stopped being right the day the tab followed the ROSTER. A manifest is present whether or not this serve composed the plugin, so every one of those four walks had to carry a LICENCE argument beside it — and the two licences pointed opposite ways, because a face drawn early and taken away is a flicker while a subscription opened early **latches** a `degraded` readout for the life of the page. Four walks, two licences, one `undefined`-means-wait, and a module of prose arguing the asymmetry, all because the tab held things it had no licence to use. A fiber the roster never named registers nothing, so there is nothing left to license: *no fiber, no surface, no handler* has an exact twin in the tab, which is *no fiber, no slot entry*.

The three properties the server half gets fall out here unchanged. Every `slots.register(...)` is an `Effect.acquireRelease` on the plugin's scope, so a plugin the roster stops naming unwinds its own faces on the way out and the app re-reads what is left; `needs` holds it `waiting` until the app's services exist, so a half that names `Bar` cannot draw before there is one; and the key a face is hung under comes from the plugin's own word rather than from an argument, so one plugin cannot sign a registration with another's name. A half whose `apply` fails lands in `failed` having installed nothing, and its siblings keep drawing.

**A face hangs in a DECLARED slot.** There are seven ([`src/browser.ts`](src/browser.ts)'s `SLOTS`), and they are a table of DATA rather than four optional fields on an interface, because a registration has to be checkable against something: a plugin hanging a chip in the header is a mistake somebody should be told about at the moment they make it, and an optional field per hook can only be wrong silently.

| slot | keyed by | what hangs there |
| --- | --- | --- |
| `outline.row.chip` | kind | a face beside the value in the property run, drawn only while the plugin has something to say about it |
| `outline.row.pane` | kind | ...and what that chip's press opens, under the run |
| `outline.row.block` | kind | a face that OWNS the property's row, whether or not anything is happening. A block wins where a plugin registers both |
| `app.header` | plugin | a readout in the app's bar. WHERE it sits in the cluster is the app's decision and always was; what a plugin gets is a seat |
| `app.mount` | plugin | the tab's own half of this plugin, wrapped ONCE around the page — one subscription however many leaves draw. These NEST; the app folds them |
| `chat.speaker.mark` | plugin | the shapes drawn over a sentence this plugin delivered into somebody's conversation — a `<g>` in a sixteen-unit box, never a whole `<svg>` |
| `chat.agent.install` | plugin | an ENGINE plugin's row on the face the chat panel draws when this machine has NO agent at all: how a person gets it, as a `NotHere` and NOT a drawing — the one row on this table that carries a value. Core owns every stroke (the list, the mark, whether the name is a link); the plugin owns every word, and core composes no clause of them |

**A slot is for what core CANNOT compose,** and two are gone for the two ways of failing that. `chat.agent.row` — the words inside an engine's row in the *which agent?* question — lasted one revision: all three engines hung the same markup around the same string the server was already sending as `AgentChoice.name`, which is one word with two authored sources and a picker that can come to disagree with the header beside it. A name the wire carries is core's to draw.

`app.drawer` — the panel a header readout's press opens — failed the other way, and was declared and read by NOBODY: the chrome walk draws `app.header`, and the one plugin with a panel hangs it on `Bar`'s `popover()`, which is the app's whole portalled panel rather than a slot. A slot nobody reads is a face registered into silence — the failure the app's own dressings walk names about this very table — so it is gone until something wants it and comes back as a walk beside `PluginHeaders` on the day one does.

Two key rules, which is why there are two register doors and not seven. A **plugin**-keyed slot holds one face per plugin, under the plugin's own name. A **kind**-keyed one holds one face per property KIND, under the word this plugin's bare kind composes to — composed by `Slots` with `kindWordOf`, the same function `Kinds` uses on the server, so the word a face is looked up by and the word a vault declares cannot be two spellings. A second face in one slot under one key is refused inside `acquire`, which fails that plugin and leaves every other plugin's faces untouched.

## What is deliberately not here

Interception on the `vault` service — the subtree write fence a node agent runs under — arrives with node-agent scopes. So does HMR: no Bun cache bust exists. **Browser slots were on this list and have left it** — they are [`src/browser.ts`](src/browser.ts) now, and the entry is kept rather than deleted because what moved them is worth reading: the tab following the roster is what made a manifest unholdable, so the slots did not arrive as the next convenience on a queue, they arrived as the only shape a browser half could have once a plugin could stop being here. The Cordis proposal's §6 has the order for the rest.

---

## One probe, and what it answers

A plugin's tool is not necessarily on the machine olai is serving from, so a plugin may declare a **probe**: one call, per chat session, answering *is it here* and *what is a person owed if it is not* — **at the same time, off one reading**. That is an invariant with an incident behind it ([`@olai/chat`](../chat/README.md)'s `agent.ts`): a caller that asked once for the entry to hand over and again for the sentence to say would start somebody's daemon twice per conversation and could answer the two questions about two different instants.

It replaces three fields. A `probe` beside an `mcpServer` was those two readings; and a `failures` table — `Record<tag, string>` — **cannot hold the sentences that exist**, because three of kolu's five carry a deadline, a cause or the daemon's own refusal, none of which is knowable before the failing. A table core looked a tag up in would leave core composing what it must not compose. So the sentence rides on the answer, whole, and core displays it.

The probe takes **what the process can see** — `Env`'s `vars`, and nothing else. Finding an executable depends on the environment and on nothing else, and a probe that read `process.env` itself would answer a different question than the one a session.s own spawn will ask.

`@olai/chat` declares the shape of the question and each plugin declares its own answer, and **neither imports this package**: a plugin may not (the registry imports every plugin), and chat is a general package a floor below the plugin system that is handed a list. The two spellings meet in one expression at the composition root, where a drift between them is a type error.

## One doorbell, and what it may say

A plugin may put a **sentence into a conversation**, and that is the whole of the capability: [`Deliveries`](src/contract.ts) is `scopes()` — which conversations opted into *this* plugin's wakes, each with the file a person picked to filter by — and `deliver(to, body, options?)`. There is no terminal here, no fleet, no board and no watcher; the door is generic or it does not land.

**Write-only, and that is the load-bearing half.** There is no `read`, no `transcript`, no `history`, and no arm of the interface where one could be added without saying so in the type. A plugin can put words INTO a conversation and can never learn what is in one — not what a person typed, not what the agent answered, not whether anybody read it. A capability that could do both would be the appliance reading the human's mail, and no amount of care at the call site takes that back afterwards.

**Minted from the calling plugin's own word**, beside `dial` and by the same rule: the provision is called once with the name the registry bound the plugin under, so neither verb has a parameter a caller could spell. An unkeyed door would hand one plugin the conversations a person scoped to another, and a door keyed by an argument would let one plugin sign another.s name onto a row that reaches an agent. The composition root used to close over the name; it does not any more, which takes a fence.s keying out of a file that must not know what it is keying. It is **required** rather than optional, unlike `dial`: a real serve legitimately dials nothing, and there is no serve where the door is missing — a machine with no ACP agent answers `scopes()` with the empty list forever, which is the honest machine-without-the-tool state and needs no failure channel on a verb that cannot fail.

What core does with a body is three arms, and which one it took is never reported back — there is no arm a plugin would answer differently. A conversation whose agent is **idle** takes it as a turn of its own, on a row marked with the plugin's name (`@olai/surface`'s `rang`, stamped by core from the registry binding, never by the caller). A conversation whose agent is **mid-turn** HOLDS it until the turn boundary, because a message that arrived alongside a running turn would spend the human's interruption with nobody having typed anything ([`@olai/chat`](../chat/README.md)'s `queuedHere`). A conversation **nobody is in** holds it until somebody opens it. Bodies sharing a `coalesce` key replace each other in place while they are still held, which is what lets a plugin send a fresh whole sentence per event and have a person read one message rather than five.

**THE BODY MUST OPEN WITH ITS OWN ATTRIBUTION**, and it is the one obligation this door places on the plugin's words. The `rang` mark is a LIVE affordance: it is what a browser draws the machine face off, and it does not survive a replay — a conversation resumed from the agent's own store is rebuilt out of message chunks, which carry text and nothing else, so the mark is not among them. A sentence that did not say who was speaking would come back in the person's own rows, which is a plugin's words in a human's mouth. So the durable account is the sentence, and a plugin writes its own name and the time into the first line of every body it delivers ([`src/contract.ts`](src/contract.ts)'s `Deliveries.deliver`; kolu's `bodyFor` is the worked example). Core cannot do it for them without composing part of the sentence, which is the one thing the whole shape refuses.

**Manual, per conversation, and off until a person picks.** `chat.scope` is on the browser face and deliberately nowhere else, so there is no serve-level default and nothing an agent can call to wake itself.

**WHICH FILES A WAKE MAY BE POINTED AT IS THE PLUGIN'S ANSWER.** `Wake.kinds` is `@olai/format`'s own file-kind words, and the picker offers those and no others. A scope is a FILTER, and only the thing filtering knows what it reads out of a file: kolu derives its claimed set from the values on a file's un-done NODES, so a document derives the empty set for ever. The picker used to offer every served file — the human's screenshot, 2026-09-01, has a `.md` between two outlines — and a conversation scoped to one heard nothing while the heartbeat went on reporting a live watcher, which is the exact confusion the heartbeat exists to prevent. Core did not have to learn what a wake file means to close that; it had to be told which kinds could be one. The words cross as DATA rather than as a predicate, because the picker is in a browser, and they are compared there against the same registry the store walked the directory with. **The bound is the declaring plugin's**, and it has to be: core cannot know whether a doorbell can WALK a kind, so it takes the list as given — while a plugin that derives from a file's records annotates its own list with `@olai/format`'s `NodeKind` (the complement of `BodyKind`, off the same `holds` column), which makes naming `"document"` there the same class of error as naming a word the table never had. `FileKind` alone is NOT that guard: it admits every bodied kind, so it catches `"hologram"` and passes the one word that rebuilds the whole defect.

**AND THE SCOPE ITSELF CAN BREAK, so the plugin declares the sentences for that too.** `wake.faults` is a whole sentence per WAY this doorbell can stop watching, keyed by the way's own word: `gone` for the file that stops being served, `unwatchable` for the file that is right there and is not a kind this wake can read. A TABLE and not two fields, because core indexes it by the cause its own walk recorded — so a third way goes red in every plugin that rings, naming the sentence it now owes, where a ternary at the composition root would fall through and tell somebody their file had been renamed while it sat in front of them. The defect both close is a silence — a doorbell that derives nothing derives nothing forever, and quiet-because-broken looks exactly like quiet-and-fine on every channel there is. Core DETECTS both, because core owns the served set, the declaration and the picks and the plugin owns none of them once its doorbell has stopped watching ([`@olai/chat`](../chat/README.md)'s `Chat.faults`), and core SAYS nothing: it carries whichever string the cause names through the same door, whole, naming no file and joining nothing to it. That is why each is one string where the drawn three are pieces — nothing is drawn between their halves. TWO of them and not one with an *or* in it: the consequence is identical and what happened is not, and a single sentence would say *renamed, or moved, or deleted, or not an outline* on every rename for ever. Both are REQUIRED wherever `wake` is present, because a plugin that rings has scoped conversations, every one of them can be renamed out from under it, and a stored pick can name any path at all. A scope in either state also leaves `scopes()` entirely, so a doorbell cannot ring for it and nothing else a plugin does per scope can either.

## One hold, and it is core's file

A plugin may keep a **small record about this serve** — thread ids, a queue — and that record lives in the state home, not the vault. `Held` ([`src/services.ts`](src/services.ts)) is `load` and `save(value)`: core owns the file ([`@olai/state`](../state/README.md), minted per plugin the way `Deliveries` is), the plugin parses what it wrote. `save` is fire-and-forget and **ordered**, so successive snapshots of one in-memory state land in the order they were handed over. `@olai/state` stays out of every tenant: a plugin that imported it would become the sole reacher and the package would silently join that tenant's exemption set.

Required like `deliveries`. A machine that cannot write the file warns; the plugin is not asked to care.

## One kind, and both doors ask it

A plugin's face used to follow a hardcoded property KEY — a value was a terminal because somebody called the column `terminal`. That is name-matching, and `brief` and `worktree` are the proof it cannot hold: both are declared `path`, on the same rows, and only one of them names a checkout to dial a socket in. So a plugin contributes a **kind** ([`src/contract.ts`](src/contract.ts)'s `PropKind`), a vault declares it in `_olai/Properties.olai` like any other type, and the server's walks, the value gate AND the tab's three kind-keyed slots all follow the DECLARATION. The browser follows it at one remove and that remove is the point: a vault's declarations do not travel to a tab, so the page carries the licence as an ANSWER per drawn value (`/format`'s `Licence`) — the same consult that answers what a value NAMES answers what claims it. Keying the tab's table on the property key was the last surviving half of the name-matching defect, and it is gone.

**[`@olai/format`](../format/README.md) imports no plugin** — the registry imports every plugin, so the arrow cannot point back. Its kind vocabulary is a PARAMETER: the format's union grows exactly ONE arm (`{kind: "contributed", word}`), so the five type-coupled places that enumerate kinds stay exhaustive and a contributed kind cannot silently stop being handled, and the table of words is assembled at the composition root and handed down. It is the same move the vault walks already make.

**One entry, not two tables.** The same `PropKind` says what a refusal calls the kind and whether a value fits, and both arms of the consult ask it — the gate, and the reading that decides what a value NAMES. Two opinions about one value is the bug family [`@olai/format`](../format/README.md)'s `meaning.ts` header is a list of, and this is where the second one would have been born.

**BUILT and ENABLED are two questions.** A DECLARATION is refused against every kind this binary was built with, so `{"type":"kolu-terminal"}` is a clean row on a serve running `--plugins=odu` and `{"type":"banana"}` is a broken file either way — a file's verdict may not depend on a flag it cannot see. A VALUE is held to the kinds this serve is RUNNING, because `admits` is a promise only a plugin that is here can make. A kind whose plugin is off validates as plain text, wears no face, and leaves the vault in the state it was in before it ever heard of the plugin.

**What it costs a vault is NOTHING.** Each kind claims the key of its own composed word, so an enabled plugin declares `kolu-terminal` / `odu-worktree` for a vault that has said nothing about them — and olai never writes anybody's vault to do it. Precedence lives in one function (`@olai/format`'s `withClaims`): **the vault always wins**, so a row moves a kind onto a short key and a row can take a face away. The claim rides the ENABLED table, so a disabled plugin's claims vanish with its kinds and a `--plugins=odu` serve is byte-identical to a vault that never heard of kolu. There is still deliberately no fallback to the key's NAME: a fallback is the defect kept alive under a second name, and prefixing is what makes a built-in claim safe instead — a plugin can only ever auto-declare a key carrying its own name.

## What the app hands a plugin

A plugin's browser half draws a chip that TICKS, a pill in the app's bar, a panel that hangs off it and a link into the served set — four of the app's own contracts, and every one of them breaks **silently** when it is spelled twice. So the app hands them across rather than letting a plugin reach for them, and what crosses is four SERVICES a half NAMES in its `inject` ([`src/browser.ts`](src/browser.ts)):

| service | what it carries |
| --- | --- |
| `slots` | where every face hangs, and the only one whose registrations move the page |
| `clocks` | the app's own duration arithmetic — the two-speed live clock, the ladder a settled span is said in, and the register a running one ticks in |
| `bar` | the chrome pill's classes, the desktop breakpoint, and a popover already wearing the bar's portal, layer, anchor and one focus cycle |
| `links` | a door onto a served file: the app's router and its address grammar as the one thing a plugin wants out of them |
| `wired` | this plugin's OWN sibling client, minted from its own word so it cannot be asked for under another plugin's name. Not furniture — the browser twin of `Surfaces` |

**It was ONE record.** `AppFurniture`, five fields, handed to every face as a prop — and the blob was right while a plugin's faces were values the app CALLED, because there was nothing to give them to. A plugin has a `needs`, so a half now names what it wants and the runtime holds it `waiting` until it exists, which is the same guarantee its server half has had since the bundle became rows. That is `PluginServices`' argument arriving on the browser side one round later: a plugin that draws no chrome names no `bar`, exactly as a plugin that cannot ring names no `deliveries`. Four rather than five because the blob's `desktop` is the BAR's own fact and travels with the bar's geometry.

**A face is handed less than it was, and closes over the rest.** A header readout is `() => JSX.Element` now, because everything it used to be given as a prop is on the context its own `apply` was handed. The three `outline.row.*` faces still take the drawer's context, and that is structural rather than a leftover: a chip is drawn per value and cannot close over WHICH value.

**Every function a plugin may HOLD is holdable**, and that is a bug this shape caused once. A record's fields are values, so `clocks.tickingOf` was a function a face could pass to a helper; when the record became service CLASSES it became a prototype method, and a method detached from its receiver reads `this.config` off `undefined`. The same expression that had been correct for the life of the feature started throwing deep inside a render, on a page that happened to draw a live CI chip, because the seam changed underneath it — and every function had to be re-declared as a bound `=` property to get back what the record already was.

There are no classes left: a tag's shape IS the record, provided as one. `Wired.client` was the exception that had to stay unbound — it read the CALLING fiber through a tracker proxy, so a bound copy would have handed every plugin one plugin's client, quietly and forever — and it is not an exception any more either: this plugin's client was resolved from this plugin's own word before the plugin ever ran. [`src/browser.test.ts`](src/browser.test.ts) holds both halves anyway, because what they are about is the SEAM's promise rather than the mechanism that happened to keep it.

That whole arrangement is `@olai/web`'s own `BlockChrome` scaled up — the drawer already hands a face its fact line rather than letting the face spell `"prop"` — and it is the only shape available: the app mounts every plugin, so a plugin that imported the app for those names would be a cycle. Each plugin still re-declares the part it reads, structurally, and contravariance makes that the **stronger** agreement: a plugin asking for something the app does not hand over is a type error with that plugin's name on the file. What moved is WHERE that error lands — it was the registry's `satisfies` over a manifest, and it is now the line in the plugin's own `apply` that composes its reading out of the services it injected ([`olai-plugin-kolu`](../plugins/kolu/README.md)'s `src/browser/app.ts`).


## One watching bus, and what it is not

A plugin that MIRRORS a conversation — into team chat, into a log, into anything — needs to know what happened in one. `Watching`'s `subscribe(handler)` is that, and the shape of it is the whole argument: core **pushes**, in three kinds (`delivered`, `replied`, `turn`), and **a human message is not among them**.

That keeps `deliveries`' write-only promise exactly where it was. A plugin can put words into a conversation and be told what the MACHINE did in one; it still cannot learn what a person typed. Two doors, opposite directions, and neither is a transcript — which is a stronger claim than "we chose not to expose it", because there is no arm of either interface where the person's words could be added without saying so in the type.

The subscription is an **effect**: it returns a disposer attached to the calling fiber, so a plugin that unloads stops being told without remembering to unsubscribe. The handler is a **sink**: fire-and-forget, and an exception in it is contained and said on the owner's channel, because a mirror that threw on one event must not take a conversation's turn down with it.

## One held record, and core does not open it

`Held` is a small opaque record per plugin per vault, in the **state home** rather than the vault — `@olai/state`'s file, which no plugin imports. Core owns the file and mints the door from the calling plugin's own word, the way the doorbell's door is minted and for the same reason: a record keyed by nobody would let one plugin read and overwrite another's. The door is minted ONCE per plugin, which is what makes the ordering below true — it was minted per CALL, and the chain that orders the writes lives on the door.

`save` is fire-and-forget and **ordered**. Successive snapshots of one in-memory state land in the order they were handed over, so a drain that persisted `queue:[B]` and then `queue:[]` cannot have the empty lose the rename race to the earlier one and come back on the next boot as a digest already posted.
