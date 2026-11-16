# The plugin system

olai reaches tools it does not own, and draws most of its own features, through plugins. A plugin is a package the bundle mounts while the server runs.[^reach]

## Why the plugin is the unit

A general package may know a plugin's **name**. It may know nothing else about it: not a member of its surface, not a property key, not a constructor.[^why] Three packages hold this arrangement together.[^packages]

## What a plugin looks like

Both halves of a plugin, the server half and the browser half, have the same shape: a `definePlugin` call with a name, the services it needs, and one Effect that installs everything.[^shape]

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

To mount a plugin, the runtime waits until every service it needs exists, stamps the plugin's identity on it, and undoes every registration when it leaves.[^runtime] Each running plugin adds its own set of wire members under its own name.[^wire]

## Three lists: built, default and running

Three lists say which plugins the binary carries, which run when nobody says otherwise, and which are running right now.

```
  built      what the binary carries   = every row in packages/bundle/olai.yml
  default    what absent policy runs   = the rows without their own `disabled`
  running    what THIS serve mounted   = the fibers the runtime reports running
```

The build-time default lives in the row itself, as `disabled: true`. A person's settings patch writes that same field.[^policy] While the server runs, `plugins.set({ name, enabled })` moves a plugin between running and off.[^switch]

## What it means for a plugin to be off

A plugin that is off is **absent**: not parked, not half-wired, not running in a reduced form. It is absent at every moment, not only at boot.[^absent]

```
  kolu.on = no   ⇒   kolu's row is patched `disabled`, and never applies

        no surface of its own        no probe is run
        no wire tag                  no readout in the header
        no handler                   no browser half loaded
        no tool offered to agents    no face drawn for its property values
        no surface/kolu/ at all      its property words validate as plain text
        no property key claimed      (so nothing declares that key)
```

## Where the rest lives

| Page | What it answers |
| --- | --- |
| [plugin-vocabulary.md](plugin-vocabulary.md) | every word a manifest uses |
| [adding-a-plugin.md](adding-a-plugin.md) | the steps to add one |
| [slot-ownership.md](slot-ownership.md) | which capability owns each extension location |
| [cordis.md](cordis.md) | ownership, lifetimes and removal |
| [settings.md](../settings.md) | which rows a serve selects, and the file that selects them |

[^reach]: The outside tools are kolu, odu, Xyne Spaces, Gmail and the ACP coding agents. A plugin is the unit for reaching one of those, and for most of what olai draws itself.

[^why]: Without that rule, reaching an outside tool means editing general packages, and everything olai decides about that tool ends up in files that belong neither to the tool nor to olai.

[^packages]: `@olai/plugin-api` is the interface a plugin is written against: it names no plugin, so a plugin may import it. `@olai/bundle` is the registry, which plugins this build has, and it imports every plugin. `packages/plugins/` holds the plugins themselves. Interface and registry are separate packages because the registry imports every plugin, and a plugin importing the registry would be a cycle.

[^shape]: The browser half registers components into extension locations, and the server half registers wire members, property words and hooks. The server half's example, and what this shape buys, are in the closed block below.

    `Surfaces.register` also takes `writes`, `faces`, `resources`, `tools` and `charter`, each of which [plugin-vocabulary.md](plugin-vocabulary.md) describes. All of them belong to the plugin, so switching it off removes its agent verbs too.

[^runtime]: Plugin authors write Effect. Cordis, the component engine underneath, is named by one package, `packages/effect-cordis`, and `packages/bundle/src/fence.test.ts` checks that no other package names it. The three mechanisms that do the work, and the hooks a server half can install, are in the closed block below.

[^wire]: The browser and the server talk over one websocket, and core owns the root set of messages. Core's own members are the roster of plugins, the switch that turns a row on or off, a row's configuration, who is looking and what this deployment is called. Those sit on tags of three segments, and a plugin's members take four. The tags, and what a roster change costs, are in the closed block below.

[^policy]: Turning on a plugin that is off by default is therefore not a special path: the settings write `disabled: false` over the row, the same line that turns another row off.

[^switch]: The switch on a plugins panel row is an ordinary write: it puts `on` into the row's own namespace in `_olai/Settings.olai`, waits for that revision, and appears in the git ledger, so the choice survives a restart. Only the browser may call that switch, and the write gate reserves the `on` property against agents.

    When no settings reader is mounted, a switch lasts for this session only, and the foot of the panel says so once. A settings file that does not parse refuses lasting writes, with a sentence saying how to repair it.

[^absent]: Nothing runs in a reduced form: an outline the plugin would have owned is an ordinary outline, the properties it would have drawn a face for appear as the plain text they are, and the connection indicator stays green. This costs no extra mechanism, because every registration carries its own undo, so a disposed fiber drops its surface, its property words, its wake and its listeners in reverse order, at any moment.

<details>
<summary>The server half, and what the shape buys</summary>

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
| Registrations undo themselves | every `register` acquires on the plugin's own scope. Unloading releases them in reverse order, so a plugin writes no teardown code |
| `needs` is read twice from one list | the runtime keeps the plugin `waiting` until each named service exists, and the compiler derives `apply`'s requirements from the same array. Yielding a service the list does not name fails the typecheck |
| The browser half registers rather than declares | a plugin the roster never names registers nothing, so nothing that walks the registrations needs a permission check beside it |
| A plugin imports `@olai/plugin-api` | that interface names no plugin, so the dependency points one way only |

</details>

<details>
<summary>How the runtime mounts one, its hooks, and work that starts outside Effect</summary>

| Mechanism | What it means |
| --- | --- |
| A registration can be reverted | `kinds.register(kind)` releases its word when the plugin's scope closes. A plugin whose `apply` fails before a `register` has installed nothing |
| `needs` is both a live dependency and a compile-time requirement | the runtime waits, unloads and applies again as services come and go, and the compiler checks the same list. A plugin that does not name `Deliveries` cannot reach it |
| The runtime stamps each plugin's identity | each keyed service is made from the name read off the running fiber, so `deliveries.deliver(…)` takes no "who", and `kinds.register(…)` takes a bare word and gets the plugin's prefix added |

A server half can install these hooks.

| Hook | What it does |
| --- | --- |
| `vault.revision(handler)` | run this each time the directory publishes a revision |
| `vault.unloaded(handler)` | the store stopped publishing. Whatever the plugin worked out from the directory is now out of date; what it holds from its own daemon is untouched |
| `sessionStart.ask(probe)` | ask this host once per conversation opening |
| `watching.subscribe(handler)` | be told what happened in a conversation |

A handler answers with an Effect and the publisher waits for it, so every plugin has worked out its part of a revision before the code after it writes the collections, the heads and the roster. Each handler is wrapped, so one plugin failing on a revision costs no other plugin and does not stop the directory's fiber. The warning names the plugin that failed.

### Work that starts outside Effect

An appliance, such as kolu's client or odu's sweep, is not written in Effect. When it fires a callback that has to start an Effect, the plugin takes `detached` and starts the work through that, which forks the work under the plugin's own services and onto the plugin's own scope. Work still in flight stops when the plugin unloads, and its log lines are written at the level the operator asked for.

| Form | Use |
| --- | --- |
| `ring(work)` | start it and forget it: a doorbell walk, a heartbeat |
| `ring.held(work)` | returns the fiber: an idle timer a scheduler cancels, or a boot that shutdown waits for |

`ring.held` exists so that a caller who needs the fiber handle does not reach for `Effect.runFork`, which makes a fiber with no owner and none of the operator's settings.

</details>

<details>
<summary>What crosses the wire, and what a roster change costs</summary>

```
  surface/plugins/get           ← core.  3 segments.  the roster
  surface/outlines/outlines/get ← outlines. 4 segments. declared `outlines`
  surface/kolu/fleet/get        ← kolu.  4 segments.  declared `fleet`
  surface/odu/ci/get            ← odu.   4 segments.  declared `ci`
            ▲     ▲
            │     └── the member's own name, in the plugin's package
            └──────── the plugin's name, and nothing computed it
```

- Tags cannot collide: core's have three segments and a plugin's have four, and the framework forbids `/` inside a name. The composition counts them anyway, because the merge underneath keeps the last writer's entry.
- The framework owns the mechanics. olai writes no wire mechanic by hand, which `packages/bundle/src/mechanics.test.ts` keeps true.

| Event | What happens |
| --- | --- |
| A plugin's surface arrives | only the arriving surface is mounted. Rebuilding the map over the surfaces already there would restart every one of their handlers, stores, channels and running sources |
| A plugin's surface leaves | each departing tag is bound to a refusing handler at once, so a call on an older connection fails with `SurfaceSiblingDropped` rather than hanging |
| A surface arrives after the server is listening | the browser reconnects. It reads the roster cell, loads exactly the browser halves it names, dials again with their surfaces, then mounts their fibers |

What a browser client may assume across that reconnect:

- The connection object keeps its identity, and a plugin on both rosters whose module is unchanged keeps the exact client it had. A departing key is deleted from `live.clients`, so a constant at module scope may hold the connection, but never a plugin's client.
- Subscriptions come back, but are not preserved. Every open subscription fails with a transport error and subscribes again about a second later, over a fresh snapshot, reading `pending` in the meantime. `pending` does not mean anything is degraded.
- A snapshot must not grow with what a person has written. A frame larger than the keepalive budget puts the pong behind it in the queue and the socket dies, so chat's transcript sends the newest `TRANSCRIPT_WINDOW` rows and answers requests for older ones through `conversation.earlier`.
- A call on a plugin that has left is refused: it never hangs and never quietly succeeds. A fresh `wired.client()` for such a plugin answers `null`.

</details>

<details>
<summary>What the three lists rule on, and what a switch costs</summary>

| Rule | Detail |
| --- | --- |
| The settings reader mounts first | it mounts under the directory lock, and its first publication supplies the `disabled` and `config` patches before any other row applies |
| A config change applies the row again | unless the row declares `configUpdates: "live"` and subscribes to revisions itself. Applying again is a remount: the plugin's surface is dropped, a fresh one mounts, the row's `generation` moves, and the tab follows it |
| Running is read off the runtime | a row that was asked for may be waiting on a missing service, or may have failed during `apply`, so the configuration does not tell you a plugin is running |
| A row's state is one of four words | `running`, `waiting`, `failed` and `off`. The engine's own states stay inside `@olai/effect-cordis` |

### The switch on a plugins panel row

| Claim | Detail |
| --- | --- |
| It writes the same field the loader reads | the server half flips that row's `disabled` and settles the bundle again, so a row switched off here and a row the settings file disabled are the same absence |
| Off means the fiber unwinds | its property words, its wake, its surface, its contributed faces and any service it offered are all undone in reverse order. Every plugin that named a service it offered goes `waiting`, and says which service it is waiting for |
| The panel says what a flip costs | a running row that offers a service names the rows that would go `waiting` without it, joined from the live table of offers and the needs the runtime derived |
| The roster describes a bundle that has stopped changing | one flip causes several registry changes. The `plugins` cell is published once the bundle has settled, so a tab never dials onto a wire that is still coming apart |
| Local state is keyed by plugin name | a plugin that comes back reads the record it left behind |
| The property vocabulary follows the fibers | a row that leaves takes its words out of the vocabulary, a row that arrives adds them, and the directory is validated again |

### Which list answers which question

| Question | Judged against | Why |
| --- | --- | --- |
| Is `{"type":"kolu-terminal"}` a legal declaration? | built | whether a file is valid may not depend on which rows happen to be running |
| Does this value fit the kind? | running | `admits` is a promise only a plugin that is mounted can make |
| May a face be drawn for this value? | running | the roster has to carry the plugin that owns that face |

So `{"type":"kolu-terminal"}` is a clean row on a machine running only the vault and odu, while `{"type":"banana"}` is a broken file either way. The built list is read off every row's module, rows that are off included.

</details>

<details>
<summary>What else absence costs, and where the rules are enforced</summary>

| Consequence | Detail |
| --- | --- |
| A failing `apply` is the same absence | the fiber lands in `failed` having installed nothing, and every other plugin stays running. A missing kolu socket cannot turn into a server that will not start |
| The case with nothing mounted runs the same code | a runtime with no plugins mounts no plugin surface, and core's own surface is byte for byte what it was |
| Minimal profiles use the same path | the `surface` profile selects the directory rows, the file formats and `mcp`; `test-minimal` selects no transport at all. Both use the same host and the same composition as `web` |

Every claim on this page is a test, and a broken one names its file.

| File | Holds |
| --- | --- |
| `packages/bundle/src/fence.test.ts` | no plugin is imported except through a declared subpath, no general package writes a plugin's word, no browser graph pulls in a `node:` builtin, and no Nix or script file outside `packages/plugins/` names a plugin |
| `scripts/prove-fence.sh` | that the fence and the mechanics lint go red when they should. Run it when the fence changes |
| `packages/bundle/src/knobs.test.ts` | a manifest's `olai.knobs` keys are exactly the executable resources its server module declares |
| `packages/bundle/src/mechanics.test.ts` | olai hand-writes no wire mechanic that the framework already performs |
| `packages/bundle/src/report.test.ts` | what became of each row on a real runtime: `off`, `failed` with the plugin's own message, or `waiting` on a named service |
| `packages/bundle/src/kinds.test.ts` | a property word is composed from the plugin's own name, leaves the vocabulary when its plugin unloads, and stays in the built list whichever rows the policy selects |
| `packages/bundle/src/composition.test.ts` | an empty roster still composes, core's tags do not move, every module answers to the name its row binds it under, and every declared face has a map behind it |
| `packages/bundle/src/testids.test.ts` | plugin, boot and shared-renderer identifier tables have distinct keys and values |
| `packages/server/src/faces.test.ts` | `chat.scope` is named on the browser face and nowhere else, and the agent face is pinned as an exact set |
| `packages/server/src/runtime.test.ts` | a wake reaches the roster only for a plugin this server mounted, and a requested plugin that nothing mounted draws as off |
| `packages/effect-cordis/src/plugin.test.ts` | a plugin waits for a named service, unwinds in reverse, re-runs when a provider is replaced, and lands `failed` having installed nothing |
| `packages/effect-cordis/src/lifecycle.test.ts` | the ordering against the pinned Effect release: a dependant's cleanup calls through a provider that is still live, a running handler is interrupted and joined, and a duplicate offer is refused naming the first provider |
| `packages/tests/plugin_docs.test.ts` | every plugin's docs page exists, is served, and is linked |

`just cordis-graph` draws the other half of this page: every row's two halves, with their components, needs, offers and contributions, read off the sources and served as a graph you can click through.

</details>
