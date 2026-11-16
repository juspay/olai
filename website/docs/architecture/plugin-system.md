# The plugin system

olai reaches tools it does not own (kolu, odu, Xyne Spaces, Gmail and the ACP coding agents) and most of its own features through plugins. A plugin is a package the bundle mounts while the server runs. This page is why that is the unit, and what the runtime does with one.

| Page | What it answers |
| --- | --- |
| [plugin-vocabulary.md](plugin-vocabulary.md) | every word a manifest uses |
| [adding-a-plugin.md](adding-a-plugin.md) | the steps to add one |
| [slot-ownership.md](slot-ownership.md) | which capability owns each extension location |
| [cordis.md](cordis.md) | ownership, lifetimes and removal |

## Why a plugin is the unit

A general package may know a plugin's **name**. It may know nothing else about it: not a member, not a property key, not a constructor. Without that rule, reaching an outside tool means editing general packages, and olai's judgement about that tool ends up in files that belong neither to the tool nor to olai.

Three packages carry the arrangement.

| Package | Role |
| --- | --- |
| `@olai/plugin-api` | the interface a plugin is written against. It names no plugin, so a plugin may import it |
| `@olai/bundle` | the registry: which plugins this build has. It imports every plugin |
| `packages/plugins/` | the plugins themselves |

Interface and registry are separate packages because the registry imports every plugin, and a plugin importing the registry would be a cycle.

## The shape of a plugin

Both halves of a plugin, server and browser, have the same form: a `definePlugin` call with a name, the services it needs, and one Effect that installs everything.

The browser half registers components into slots:

```tsx
// packages/plugins/odu/src/browser.tsx  (abridged)
export default definePlugin({
  name,
  needs: [Slots, Bar, Clocks, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", RUN_KIND, CiChip)
    yield* slots.register("outline.row.pane", RUN_KIND, RunMatrix)
    yield* slots.register("app.header", { place: "cluster", body: OduReadout, status })
    yield* slots.register("delivery.mark", OduMark)
  }),
})
```

The server half registers wire members, vocabulary and hooks:

```ts
// packages/plugins/odu/src/server.ts  (abridged)
export default definePlugin({
  name,
  needs: [LocalState, Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  apply: Effect.gen(function*() {
    for (const kind of ours) yield* (yield* Kinds).register(kind)
    yield* (yield* Wakes).register(wake)
    yield* (yield* Surfaces).register({ surface, faces, deps })
    yield* (yield* Vault).revision((revision) => /* re-derive from the directory */)
    yield* (yield* SessionStart).ask(probing(env.vars))
  }),
})
```

| Property of that shape | Detail |
| --- | --- |
| Registrations undo themselves | every `register` acquires on the plugin's own scope. Unloading releases them in reverse, so a plugin writes no teardown |
| `needs` is read twice from one list | the runtime holds the plugin `waiting` until each service exists, and the compiler derives `apply`'s requirements from the same array. A service yielded but not named fails the typecheck |
| The browser half registers rather than declares | a plugin the roster never names registers nothing, so no walk over it needs a permission check beside it |
| A plugin imports `@olai/plugin-api` | the interface names no plugin, so the arrow points one way |

`Surfaces.register` also takes `writes`, `faces`, `resources`, `tools` and `charter`: which tags carry the caller's attribution, which members each caller may reach, which are addressable, the agent verbs this plugin brings, and its paragraph to an agent. All of them belong to the plugin, so switching it off removes its verbs too.

## How the runtime mounts one

Plugin authors write Effect. Cordis, the component engine underneath, is named by one package, `packages/effect-cordis`, which `packages/bundle/src/fence.test.ts` holds as an equality.

Three mechanisms do the work.

| Mechanism | What it means |
| --- | --- |
| A registration is a revertible effect | `kinds.register(kind)` releases when the plugin's scope closes. A plugin whose `apply` fails before a `register` installed nothing |
| `needs` is both a live dependency and a compile-time requirement | the runtime waits, unloads and re-applies as services come and go, and the compiler checks the same list. A plugin that does not name `Deliveries` cannot reach it |
| The runtime stamps each plugin's identity | a keyed service is minted from the name read off the fiber, so `deliveries.deliver(…)` takes no "who", and `kinds.register(…)` takes a bare word and gets the prefix |

A server half can install these hooks.

| Hook | What it does |
| --- | --- |
| `vault.revision(handler)` | run this each time the directory publishes a revision |
| `vault.unloaded(handler)` | the store stopped publishing. What the plugin derived from the directory is stale; what it holds from its own daemon is untouched |
| `sessionStart.ask(probe)` | ask this host once per conversation opening |
| `watching.subscribe(handler)` | be told what happened in a conversation |

Handlers answer with Effects and the publisher waits for them, so every plugin has re-derived a revision before the lines after it write the collections, heads and roster. Each handler is wrapped, so one plugin that fails on a revision costs no other plugin and no directory fiber. The warning names it.

### Work that starts outside Effect

An appliance such as kolu's client or odu's sweep is not written in Effect. When it fires a callback that must start one, the plugin takes `detached` and starts the work through that, which forks under the plugin's own services and onto the plugin's own scope. In-flight work stops when the plugin unloads, and log lines carry the operator's level.

| Form | Use |
| --- | --- |
| `ring(work)` | fire and forget: a doorbell walk, a heartbeat |
| `ring.held(work)` | returns the fiber: an idle timer a scheduler cancels, a boot a shutdown joins |

`ring.held` exists so that a caller needing the handle does not reach for `Effect.runFork`, which makes a fiber with no owner and none of the operator's settings.

## What crosses the wire

The browser and the server talk over one websocket. Core owns the root set of messages, and each running plugin adds its own sibling set under its name.

```
  surface/plugins/get           ← core.  3 segments.  the roster
  surface/outlines/outlines/get ← outlines. 4 segments. declared `outlines`
  surface/kolu/fleet/get        ← kolu.  4 segments.  declared `fleet`
  surface/odu/ci/get            ← odu.   4 segments.  declared `ci`
            ▲     ▲
            │     └── the member's own name, in the plugin's package
            └──────── the plugin's name, and nothing computed it
```

| Fact | Detail |
| --- | --- |
| Core's own members | the roster, the switch that moves a row, a row's configuration, who is looking, and what this deployment is called. All on three-segment tags |
| Tags cannot collide | three segments against four, and the framework forbids `/` inside a name. The composition counts them anyway, since the merge underneath is last-writer-wins |
| The framework owns the mechanics | olai spells no wire mechanic by hand, which `packages/bundle/src/mechanics.test.ts` keeps true |

### When the roster changes

| Event | What happens |
| --- | --- |
| A sibling arrives | only the arriving sibling is mounted. Rebuilding the map over the survivors would fork every survivor's handlers, stores, channels and running sources |
| A sibling leaves | each departing tag is bound to a refusing handler at once, so a call on an older connection fails with `SurfaceSiblingDropped` rather than hanging |
| A sibling arrives after the server is listening | the browser reconnects. It reads the roster cell, loads exactly the named browser halves, redials with their surfaces, then mounts their fibers |

What a browser client may assume across that reconnect:

- The connection object keeps its identity, and a sibling on both rosters whose module is unchanged keeps its exact client. A departing key is deleted from `live.clients`, so a module-scope constant may hold the connection and never a plugin's client.
- Subscriptions return, but are not preserved. Every open subscription fails with a transport error and resubscribes about a second later over a fresh snapshot, reading `pending` meanwhile. A `pending` readout is not a degraded one.
- A snapshot must not scale with what a person has written. A frame larger than the keepalive budget queues the pong behind it and the socket dies, so chat's transcript ships the newest `TRANSCRIPT_WINDOW` rows and answers older pages through `conversation.earlier`.
- A call on a departed plugin is refused, never hangs and never silently succeeds. A fresh `wired.client()` for a departed plugin answers `null`.

## Built, default and running

Three lists say which plugins exist, which run by default, and which are running now.

```
  built      what the binary carries   = every row in packages/bundle/olai.yml
  default    what absent policy runs   = the rows without their own `disabled`
  running    what THIS serve mounted   = the fibers the runtime reports running
```

The build-time default lives in the row itself, as `disabled: true`, which is the same field a person's settings patch writes. Turning an opt-in plugin on is therefore not a special path: policy writes `disabled: false` over the row, the same line that turns another row off. Which rows a serve selects, and the file that selects them, are on [settings.md](../settings.md).

| Rule | Detail |
| --- | --- |
| The settings reader mounts first | under the directory lock. Its first publication becomes the `disabled` and `config` patches before other rows apply |
| Config changes re-apply a row | unless the row declares `configUpdates: "live"` and owns its revision subscription. A re-apply is a remount: the sibling is dropped, a fresh one mounts, the row's `generation` moves and the tab follows it |
| Running is read off the runtime | a requested row may wait on a missing service or fail during `apply`, so configuration is not evidence of activation |
| A row's state is one of four words | `running`, `waiting`, `failed` and `off`. The engine's own states stay inside `@olai/effect-cordis` |

### The switch on a plugins panel row

`plugins.set({ name, enabled })` moves a plugin between running and off while the server runs.

| Claim | Detail |
| --- | --- |
| It writes the loader's own field | the server half flips that row's `disabled` and re-settles the bundle, so a row switched off and a row the settings file disabled are the same absence |
| Off means the fiber unwinds | its kinds, wake, sibling surface, slots and any service it offered come back in reverse. Every plugin that named a service it offered goes `waiting`, naming it |
| The panel says what a flip costs | a running row that offers a service names the rows that would go `waiting` without it, joined from the live table of offers and the needs the runtime derived |
| The roster describes a bundle that stopped moving | one flip fans out into several registry changes. The `plugins` cell is published once the settle is done, so a tab never redials onto a wire that is still coming apart |
| Local state is keyed by name | a plugin that comes back reads the record it left |
| The property vocabulary follows the fibers | a row that leaves takes its words out of the vocabulary, a row that arrives adds them, and the directory is re-judged |

A panel switch is an ordinary write: it puts `on` into the row's namespace in `_olai/Settings.olai`, waits for that revision, and appears in the git ledger, so the choice survives a restart. Core grants the switch to the browser face alone, and the write gate reserves `on` against agents.

> When the settings reader is absent, switches are session-only and the panel foot says so once. A broken settings file refuses durable writes with a repair sentence.

### Which list answers which question

| Question | Judged against | Why |
| --- | --- | --- |
| Is `{"type":"kolu-terminal"}` a legal declaration? | built | a file's verdict may not depend on which rows happen to be running |
| Does this value fit the kind? | running | `admits` is a promise only a plugin that is here can make |
| May this value's dressing draw? | running | the roster has to carry the plugin that owns the dressing |

So `{"type":"kolu-terminal"}` is a clean row on a machine running only the vault and odu, while `{"type":"banana"}` is a broken file either way. The built list is read off every row's module, disabled rows included.

## What a disabled plugin is

A disabled plugin is **absent**: not parked, not half-wired, not degraded, and absent at every moment rather than only at boot.

```
  kolu.on = no   ⇒   kolu's row is patched `disabled` and never applies

                      no sibling surface        no probe run
                      no wire tag               no header readout
                      no handler                no tab half mounted
                      no expose row             no dressing licensed
                      no surface/kolu/ at all   its kinds validate as plain text
                      no claimed key            (so no built-in declaration)
```

| Consequence | Detail |
| --- | --- |
| Nothing degrades | the outline it would have owned is an ordinary outline, and the properties it would have dressed draw as the text they are. The connection indicator stays green |
| It costs no extra mechanism | every registration has its own undo, so a disposed fiber drops its sibling, kinds, wake and listeners in reverse, at any moment |
| A failing `apply` is the same absence | the fiber lands in `failed` having installed nothing, and every other plugin stays running. A missing kolu socket cannot be a server that will not start |
| The degenerate case runs the same code | a runtime with no plugins mounts no sibling, leaving core's own surface byte for byte what it was |
| Minimal profiles use the same path | the `surface` profile selects the directory rows, the formats and `mcp`; `test-minimal` selects no transport at all. Both use the same host and composition as `web` |

## Where the rules are enforced

Every claim on this page is a test, and a broken one names its file.

| File | Holds |
| --- | --- |
| `packages/bundle/src/fence.test.ts` | no plugin reaches past a declared door, no general package spells a plugin's word, no browser graph pulls a `node:` builtin, and no Nix or script file outside `packages/plugins/` names a plugin |
| `scripts/prove-fence.sh` | that the fence and the mechanics lint go red when they should. Run it when the fence changes |
| `packages/bundle/src/knobs.test.ts` | a manifest's `olai.knobs` keys equal the executable resources its server module declares |
| `packages/bundle/src/mechanics.test.ts` | olai hand-writes no wire mechanic the framework performs |
| `packages/bundle/src/report.test.ts` | what became of each row on a real runtime: `off`, `failed` with the plugin's own message, or `waiting` on a named service |
| `packages/bundle/src/kinds.test.ts` | a word is composed from the plugin's own name, leaves the vocabulary when its plugin unloads, and stays in the built list whatever the policy selects |
| `packages/bundle/src/composition.test.ts` | an empty roster composes, core's tags do not move, every module answers to the name its row binds it under, and every declared face has a map behind it |
| `packages/bundle/src/testids.test.ts` | plugin, boot and shared-renderer identifier tables have distinct keys and values |
| `packages/server/src/faces.test.ts` | `chat.scope` is named on the browser face and nowhere else, and the agent face is pinned as an exact set |
| `packages/server/src/runtime.test.ts` | a wake reaches the roster only for a plugin this server mounted, and a requested plugin that nothing mounted draws as off |
| `packages/effect-cordis/src/plugin.test.ts` | a plugin waits for a named service, unwinds in reverse, re-runs when a provider is replaced, and lands `failed` having installed nothing |
| `packages/effect-cordis/src/lifecycle.test.ts` | the ordering against the pin: a dependent's cleanup calls through a live provider, a running handler is cut and joined, a duplicate offer names the first provider |
| `packages/tests/plugin_docs.test.ts` | every plugin's docs page exists, is served, and is linked |

`just cordis-graph` draws the other half of this page: every row's two halves, their components, needs, offers and contributions, read off the sources and served as a graph you can click through.
