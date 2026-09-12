# The plugin system

olai integrates with tools it does not own — kolu, odu, xyne-spaces, ACP coding
agents — and with most of its own features, through **plugins**. A plugin is a
package the bundle mounts at runtime. General olai packages may know a plugin's
name and nothing else about it.

Detail lives in [`packages/plugin-api/src/plugin.ts`](../../packages/plugin-api/src/plugin.ts),
[`services.ts`](../../packages/plugin-api/src/services.ts) beside it, and
`@olai/bundle`'s [README](../../packages/bundle/README.md). Ownership and
lifecycle rules are in [cordis.md](cordis.md); renderer location ownership is in
[slot-ownership.md](slot-ownership.md). This page does not repeat either.

Terms used before the glossary in §4:

| Term | Plain meaning |
| --- | --- |
| **door** | a package subpath another package may import, such as `olai-plugin-vault/contract` or `/slots`. A door carries types, service tags and static data, never a live value |
| **wire** | the websocket protocol between browser and server. Every request and subscription is a tagged message such as `surface/odu/ci/get` |
| **surface** | one plugin's section of the wire: a named group of **members** (cells, collections, streams, procedures) declared with `defineSurface` |
| **face** | an access list naming which caller (`browser` or `agent`) may reach which members. Anything unlisted is denied |
| **slot** | a named place in the UI where a plugin hangs a component, such as `outline.row.chip` or `app.header` |
| **row** | one entry in `packages/bundle/olai.yml`: a plugin id and the module to mount |
| **fiber** | one mounted plugin instance, with a lifecycle the runtime reports |
| **roster** | which plugins the build contains, and which ones this server is running |
| **service** | a named capability one plugin provides and another declares it needs, e.g. `Vault`, `Kinds`, `Surfaces` |

---

## 1. The problem

Before `plugin-api` existed, integrating an outside tool meant editing general
olai packages.

| Appliance | What it does |
| --- | --- |
| **kolu** | runs coding agents in terminals, serves them over MCP |
| **odu** | runs CI |
| **xyne-spaces** | mirrors a conversation into a bound channel |

kolu and odu were once "extracted into their own packages" and still left this
behind:

| Where | What was there |
| --- | --- |
| `olai-plugin-chat` | a `kolu.ts` |
| `@olai/server` | a `koluConfig.ts`, a `wiring.kolu` slot, a `koluHalf(…)` call |
| `@olai/surface` | four `...koluMembers` spreads inside core's wire spec |
| `@olai/server`'s expose map | a row per plugin member |
| `@olai/web` | a `padi/` folder |
| four packages | one property key spelled at seven sites |

That code was olai's judgement *about* an appliance — what an absent padi means,
which vault file is kolu's, which property gets which UI — with no home that was
neither the appliance nor core. Three packages are that home:

| Package | Role |
| --- | --- |
| [`packages/plugin-api/`](../../packages/plugin-api/README.md) | the interface a plugin is written against. Names no plugin, so plugins may import it |
| [`packages/bundle/`](../../packages/bundle/README.md) | the registry: which plugins this build has. Imports every plugin |
| [`packages/plugins/`](../../packages/plugins/README.md) | the plugins themselves |

Interface and registry are separate packages because the registry imports every
plugin; a plugin importing the registry would be a cycle.

> **The rule:** a general package may know a plugin's **name**. It may not know
> anything else about it — not a member, not a key, not a constructor.

---

## 2. The shape of a plugin

Both halves of a plugin, server and browser, have the same form: a
`definePlugin` call with a name, the services it needs, and one Effect that
installs everything.

The browser half registers components into UI slots:

```ts
// packages/plugins/odu/src/browser.tsx  (abridged)
export { name, surface } from "./wire.ts"

export default definePlugin({
  name,
  needs: [Slots, Clocks, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", RUN_KIND, CiChip)
    yield* slots.register("outline.row.pane", RUN_KIND, RunMatrix)
    yield* slots.register("delivery.mark", OduMark)
    // Outlines similarly registers tool.reply: { fileOf, story }, owned by chat.
    yield* slots.register("app.mount", (props) => /* one subscription per tab */)
  }),
})
```

The server half registers wire members, vocabulary and hooks:

```ts
// packages/plugins/odu/src/server.ts  (abridged)
export default definePlugin({
  name,
  needs: [Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  apply: Effect.gen(function*() {
    const env = yield* Env
    const vault = yield* Vault
    const half = oduHalf({ options: { env: env.vars, served: vault.served }, … })
    for (const kind of kinds) yield* (yield* Kinds).register(kind)
    yield* (yield* Wakes).register(wake)
    yield* (yield* Surfaces).register({ surface, faces, deps: half.handlers })
    yield* vault.revision((snapshot) => Effect.sync(() => half.revision(…)))
    yield* (yield* SessionStart).ask(Effect.promise(() => probe(env.vars)))
  }),
})
```

| Property of that shape | Detail |
| --- | --- |
| Registrations undo themselves | every `register` is an `Effect.acquireRelease` on the plugin's own `Scope`. Unloading runs those releases in reverse; the plugin writes no teardown |
| `needs` is read twice from one list | the runtime keeps the plugin `waiting` until each service exists; the compiler derives `apply`'s requirement channel from the same array. A service yielded but not named is a `tsc` error at the `definePlugin` call |
| `Surfaces.register` also takes `writes`, `faces`, `tools` | which tags carry the caller's attribution; which members each caller may reach; the agent verbs the plugin brings. All three belong to the plugin, so switching it off removes its verbs too. `tools` used to be thirty entries in `@olai/ops`' one closed table, filtered in `olai-plugin-mcp`, so a switched-off plugin left its verbs advertised |
| The browser half uses slots, not a manifest object | a manifest value exists whether or not this server composed the plugin, so every read needed a permission check, and the two checks point opposite ways (§8, *Drawing versus subscribing*). A plugin the roster never names registers nothing |
| A plugin imports `@olai/plugin-api` | it could not while that package was also the registry |

---

## 3. The runtime underneath

Plugin authors write Effect; Cordis, the component engine underneath, is confined
to one package.

| Fact | Detail |
| --- | --- |
| Only one package names `cordis` | `packages/effect-cordis`. `packages/bundle/src/fence.test.ts` asserts it as an equality; `scripts/prove-fence.sh`'s mutation 16 proves the assertion still fails when it should |
| Pin assumptions are inventoried, not repeated here | [`packages/effect-cordis/README.md`](../../packages/effect-cordis/README.md), *Where the pin's instability lives*; `nix/cordis.nix` carries the upstream asks |

Three mechanisms do the work:

| Mechanism | What it means | What it replaced |
| --- | --- | --- |
| **A registration is a revertible effect** | `kinds.register(kind)` acquires a registration and releases it when the plugin's scope closes. A plugin whose `apply` fails before a `register` installed nothing | hand-written teardown. A plugin author never sees `ctx.effect` |
| **`needs` is both a live dependency and a compile-time requirement** | the runtime waits, unloads and re-applies on service changes; the compiler checks the same list. A plugin that does not name `Deliveries` cannot reach it | a services object handed to every plugin |
| **The runtime stamps each plugin's identity; it is never an argument** | a keyed service is a function from the plugin's name to that plugin's view of it, called once with the name read off the fiber. So `deliveries.deliver(…)` has no "who" parameter, `env.dial` is already this plugin's, and `kinds.register(…)` takes a bare word and gets the prefix added | a composition root building `doorFor(plugin.name)` and `dials[plugin.name]`, putting the keying in a file that must not know what it keys |

Hooks a server half can install:

| Hook | Kind | Replaced |
| --- | --- | --- |
| `vault.revision(handler)` | callback registration | `PluginServer.revision(snapshot)` |
| `vault.unloaded(handler)` | callback registration | `PluginServer.unloaded()`. Not teardown: it means the store stopped publishing, so what the plugin derived from the vault is stale while what it holds from its own daemon is untouched |
| `SessionStart.ask(probe)` | keyed registration | `PluginServerHalf.probe`, then a `chat/session-start` waterfall |
| `watching.subscribe(handler)` | callback registration | `PluginServices.watching`'s hand-rolled `Set` and a manual unsubscribe |

**Handlers return Effects, and the publisher waits for them.**

- Streams were rejected because a stream subscriber runs on its own fiber. The
  vault publishes a revision from inside the directory binding's connector, and
  the lines after it write the collections, heads and roster over a world every
  plugin has already re-derived. With a stream the publisher could only hand off
  and continue.
- Returning an Effect also contains failures. Cordis's `emit` is a plain call
  loop with no `try`, so one plugin throwing on a revision took down every later
  plugin's handling of it and the directory fiber that published it. The hook
  wraps each handler and warns with the plugin's name.

**One boundary is left, and it is named `detached`.** An appliance (`koluHalf`,
the odu sweep, a Spaces mirror) is not written in Effect and is not wrapped. When
such code fires a callback that must start an Effect, the plugin uses `detached`,
a facade helper. It forks the work under the plugin's own services, so log lines
carry the operator's level, and onto the plugin's own scope, so in-flight work
stops when the plugin unloads.

| Form | Use |
| --- | --- |
| `ring(work)` | fire and forget: a doorbell walk, a heartbeat |
| `ring.held(work)` | returns the fiber handle: an idle timer a scheduler cancels, a boot a shutdown joins before reading what the boot wrote |

`ring.held` exists so a caller needing the handle does not fall back to
`Effect.runFork`, which creates a fiber with no owner and none of the operator's
settings — a second, unnamed boundary.

**Phases.** The bundle's rows and browser slots are the composition model of the
Cordis proposal's §6. The Effect API above is phase 4, node agents as scopes
phase 6, the chat row phase 7, and the enable/disable switch (§7) phase 8. Not
built, deliberately: HMR (no Bun cache bust exists), interception on the vault,
and out-of-tree plugins.

---

## 4. Vocabulary

This section defines the words the rest of the page uses; subsections follow for
terms that need an example.

| Word | What it means |
| --- | --- |
| **plugin** | one integration: two halves, one shape, each a `definePlugin` over an Effect. Two kinds exist — a **tenant** (olai's judgement about an outside appliance: kolu, odu, xyne-spaces) and an **engine** (an ACP coding agent the chat panel can seat: claude, codex, opencode, pi). The system does not distinguish them |
| **name** | the plugin's one word, e.g. `"kolu"`. Also its row id, wire prefix, fiber name, settings namespace and docs address |
| **row** | one entry in `packages/bundle/olai.yml`: an `id` and the module the loader mounts. Profiles apply `disabled` patches over that catalogue |
| **fiber** | one mounted plugin. Callers see four words — `running`, `waiting`, `failed`, `off`; the engine's six internal states stay inside `@olai/effect-cordis` |
| **service** | a named capability reached through an Effect tag a plugin yields: `Vault`, `Kinds`, `Ops`, `Surfaces`. What the old `PluginServices` object dissolved into; the tag carries the engine's key, so `needs` and the requirement channel are one declaration |
| **needs** | the services a plugin declares. Drives both the runtime wait and the compiler check |
| **effect** | here: a registration that carries its own undo |
| **surface** | one plugin's section of the wire, declared with `defineSurface` inside the plugin's package |
| **member** | one item on a surface: a cell, a collection, a stream or a procedure |
| **face** | which caller (`browser`, `agent`) may reach which members. Default-deny |
| **door** | a package subpath other packages may import (`/contract`, `/slots`, `/testids`). Types, service tags and static data only |
| **probe** | a check answering "is this tool installed on this host?", registered on `SessionStart` and run once per conversation |
| **engine** | one ACP agent olai can seat, shipped as a plugin: a `Leg` that reads the agent's wire, a probe that finds it here, the channel its standing prompt rides, plus a logo and an install sentence on its browser half. One directory and one row each |
| **kind** | a word a plugin adds to the vault's property vocabulary. Contributed bare (`terminal`), stored prefixed (`kolu-terminal`) |
| **claim** | the property key a kind declares for itself by convention — its own prefixed word — so enabling a plugin turns its UI on with no file to edit |
| **dressing** | the UI a live property value wears in an outline row: a chip, a pane or a block |
| **chrome** | a component a plugin hangs in the app's header bar |
| **mount** | the plugin's own component in the page, mounted once per tab, where it opens its single subscription |
| **mark** | the plugin's logo: a small glyph beside a message it delivered into a conversation, and beside an engine's name in the picker and header |
| **engine install row** | one engine's line on the screen shown when the machine has no coding agent. The plugin supplies a `NotHere` value (the words); core draws every stroke, including whether the name is a link |
| **watching** (`Watching`) | a push service: core tells a plugin what happened in a conversation — a delivery that landed, an orchestrator reply that settled, a turn that started or ended. Human messages are not included |
| **local state** (`LocalState`) | one opaque document per plugin and served directory, in the state home rather than the vault. Core owns its path and ordered write chain; each save settles with the write's outcome |
| **doorbell** (`Deliveries`) | the write-only service a plugin uses to post a message into a conversation, keyed to the calling plugin's name |
| **wake** | the plugin's own wording for the control a person uses to point that doorbell at a file |
| **roster** | which plugins this build has, and which this server is running |
| **built vs running** | what the rows list, versus which of them actually mounted |
| **licence** | permission for a dressing to draw, answered per value the server sends |

### name

One word doing four jobs: the settings row, the policy namespace, the docs
address (`docs/plugins/<name>.md`) and the wire prefix. Because the name *is* the
prefix, the two cannot drift apart.

### surface and member

A plugin declares a surface exactly as core does. odu declares one member:

```ts
export const surface = defineSurface({ cells: { ci: { /* … */ } } })
```

The framework composes it under the plugin's name, so it reaches the wire as
`surface/odu/ci/get`. No olai code builds that string. See §6.

### face

A face is the access list for a surface, written in the plugin's own package
against its own spec:

```ts
export const faces = { browser: { ci: "resource" } }
```

A caller kind the plugin never lists is denied every member. Neither tenant
writes an `agent` map today, so an MCP client can call none of their members —
data, not a hardcoded rule. The day a plugin wants otherwise it writes the map,
and nothing in core changes.

### probe

A probe answers "is your tool installed here, and if not, what should I tell the
person?" It is asked before a chat session starts and answers both halves in one
reading:

```ts
interface Probed {
  server: StdioServer | null   // the MCP server to hand a session
  missing: NotHere | null      // ...or the whole sentence about the one it did not get
}
```

```ts
yield* (yield* SessionStart).ask(Effect.promise(() => probe(env.vars)))
```

| Rule | Reason |
| --- | --- |
| One reading, two fields | asking separately would start the plugin's daemon twice per conversation, and the two answers could describe two different moments |
| `missing.why` is a complete sentence written by the plugin | core displays it and composes none of it: the four ways a padi fails and the four ways a coordinator fails have nothing in common but failing |
| A plugin may have no probe | the absent case is a machine that simply lacks the tool, which already had to work. Both tenants have one; no engine does |
| It is a registration, not a manifest field | the list is read fresh per session open, so a plugin that unloaded between conversations contributes nothing and no second list is kept |
| A plugin registers the question, not an answer | scheduling belongs to `olai-plugin-chat`: a probe starts a subprocess while a session opens, and running probes serially would multiply that delay by the number of plugins. Chat runs them with bounded concurrency |

This was the last hook where a plugin passed its own name and the last that
returned a promise instead of an Effect. Both came from the payload being a plain
record in a waterfall, which could enforce neither the per-fiber stamp nor the
effect channel. A waterfall's own powers — transform what later links see,
short-circuit the rest — were never used here and could not be, because link
order was the order two dynamic imports resolved. The event is really a
collection keyed by plugin, the shape `Kinds`, `Wakes` and `Watching` already
use. The waterfall primitive stays in `@olai/effect-cordis` for the delivery
policy.

### kind

`@olai/format` owns seven property kinds — `text`, `date`, `int`, `path`, `doc`,
`ref`, `node` — and none describes a terminal. A plugin contributes one as a bare
word, and the registry prefixes it with the plugin's name:

```ts
export const kinds = [{
  kind: "run",                           // BARE — the registry prefixes it
  takes: `\`${RUN_TYPE}\` (an odu run id)`,
  admits: isRunIdShaped,                 // does this value fit
}] as const
// kolu: terminal → kolu-terminal        odu: run → odu-run
```

- The prefix stops two plugins colliding on a word, and limits a plugin's
  built-in claim to a key carrying its own name, so enabling a plugin cannot take
  over a column you use for something else.
- **Why a kind and not the key's name.** A `brief` column and a checkout column
  are both declared `path`, often on the same rows, and only one names a checkout
  to dial a socket in. A value's shape cannot tell them apart; a declaration can.
- `@olai/format` imports no plugin: the kind table is passed to it as data by the
  composition root, and the format's union grows one arm,
  `{ kind: "contributed"; word: string }`, which keeps its five
  kind-enumerating switches exhaustive.

### the two layers of a declaration

A property key is declared by whichever of these speaks first:

```
  1. THE VAULT'S ROW        _olai/Properties.olai       ← always wins
  2. THE PLUGIN'S CLAIM     the kind's own word         ← where the vault said nothing
```

- An enabled plugin therefore declares its own key for you: a lane holding
  `kolu-terminal 303dc985` works with nothing declared anywhere, and olai never
  writes to your vault to achieve it.
- Your own row always wins, which is how you move a kind onto a shorter key and
  how you take the UI away again:
  `{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}`
  in `_olai/Properties.olai`.
- The fold is one function, `@olai/format`'s `withClaims`, and precedence exists
  nowhere else. It reads the enabled-plugin table, so a disabled plugin's claims
  disappear with its kinds and row selection needs no new rule.
- No consumer learns there are two sources: the validator, the write gate, the
  licence check and the dressing table all take *the declarations* as one value.

### dressing

A dressing is the UI drawn for a live property value in an outline row. It draws
*beside* the value, never instead of it, so the stored text stays greppable and
editable.

| Dressing | When it draws |
| --- | --- |
| **block** | always owns a row: a terminal somebody wrote down is worth a row when nothing is happening |
| **chip** | only while there is something to say: a worktree with no CI running looks unchanged |
| **pane** | opens below the row when a chip is pressed |

### row actions

A row action (`outline.row.action`) is a menu item a plugin adds to an outline
row. Its `run(node)` may return a refusal sentence, which the menu shows beside
the originating row; a successful action returns nothing. A plugin can therefore
explain an expected failure, such as a full node-agent pool, without depending on
core's presentation types.

### chrome and mount

`chrome` is a component in the header bar (kolu's padi pill). `mount` is the
plugin's component in the page body, mounted once per tab, where it opens its
single subscription however many rows draw.

- The app hands both its own furniture — the clock, the pill's geometry, a
  popover, a link to a served file — rather than each plugin building its own.
- `@olai/web` is the package a plugin may import for boot, build and shared
  primitives. No production module under `@olai/web` names a plugin, so the host
  never learns what hangs in a slot in order to draw it.
- `app.header`, the slot `chrome` became, takes a placement word as well as a
  component. What each word means belongs to the shell
  (`plugins/layout/src/Header.tsx` spends it, `plugins/layout/src/Chrome.tsx`
  reads the slot twice); a plugin cannot spell an ordering of its own. The
  vocabulary arrived with the search box (`olai-plugin-search`) and matches what
  `sidebar.entry` takes.

| Word | Meaning |
| --- | --- |
| `cluster` | the standing row of pills, desktop only, after the connection state |
| `lead` | the single seat ahead of them, drawn on phones too, which may shrink to nothing before any pill loses a character |

### mark

A mark is the plugin's logo, drawn beside a message it delivered into somebody's
conversation. The chat panel names the speaker of every run of messages and looks
the logo up by the name core stamped on the row.

- It takes no arguments, unlike `chrome`: a mark is a glyph at the size of its
  line, so the app has nothing to hand it.
- It returns shapes only — a `<g>` of paths in a `0 0 16 16` box, in
  `currentColor`. The app owns the surrounding `<svg>`, because marks are read as
  a column and a plugin owning the size could make its row look unlike the rest.
- It is a plugin-side registration rather than a table in the chat panel because
  no general package may spell a plugin's name in code (`fence.test.ts`, claim
  8). A plugin with no mark is drawn with a generic glyph and named in full,
  never with another plugin's shape.

### doorbell and wake

The doorbell is how a plugin posts a message into a conversation somebody is
having with an agent, unprompted:

```ts
interface Deliveries {
  scopes: () => ReadonlyArray<{ agent: string; session: string; file: string }>
  deliver: (
    to: { agent: string; session: string },
    body: string,
    options?: { coalesce?: string },
  ) => void
}
```

| Rule | Detail |
| --- | --- |
| `deliver` cannot read | a plugin learns which conversations opted in to *it* and nothing else: not who is in them, not what is in them, not whether its last message landed |
| The body travels a person's path | it lands in a `user` row, marked with the plugin's name taken from the registry binding rather than from the caller, so one plugin cannot sign another's words |
| Core decides only *when* | an idle agent takes it as a turn; a busy agent holds it until the turn ends, so a machine never spends an interruption a person did not type; a conversation nobody has open holds it until somebody opens it. Which case applied is never reported back, because no plugin would answer differently |

> Scope is MANUAL per conversation. No serve-level default, no agent-settable op.
> A fresh or cleared conversation starts with the doorbell off until a person
> picks a file. *(ruled human, 2026-08-31)*

The control is a strip the app draws and the plugin words. The plugin supplies
three pieces:

```ts
readonly wake?: {
  subject: string                          // "wake on terminal activity"
  from: string                             // "terminals from"
  waiting: { one: string; many: string }   // "fleet event waiting" / "…events waiting"
}
```

The strip reads `wake on terminal activity · terminals from [ lanes.olai ▾ ]`.
The picker, the separator and the numeral in `3 fleet events waiting` are core's;
nothing core owns is a claim about the plugin's subject.

- Three pieces rather than one string with a placeholder, because a placeholder
  would make core the author of everything around it.
- The declaration lives on the server half, beside `probe` and `kinds`, because
  the browser is not the only reader: `chat.scope` refuses a plugin whose server
  half declares no wake, checked server-side against the enabled plugins.

---

## 5. Three code entry points, and one row of data

A plugin package exposes three code doors, because three different programs load
them, plus one row of data that names the plugin to the loader.

| Door | Read by | Contains | May not contain |
| --- | --- | --- | --- |
| `./wire` (via `@olai/bundle/wire`) | the browser's wire setup | `name`, `surface`, `faces` | SolidJS, an appliance client, `node:` builtins |
| `./server` | the loader, at mount | `name`, `needs`, `apply` — one Effect. May pull the appliance's client, `@olai/format`, `node:` builtins | a browser component |
| `./browser` (via `@olai/bundle` root) | the browser | dressings, chrome, mount, mark — SolidJS, and behind one face a terminal emulator | — |
| a row in `packages/bundle/olai.yml` | the loader | `id` and the module specifier. Data only: no import graph, the specifier resolves at mount | — |

One door for all three would put a UI component on the import graph of a process
that renders nothing. Not theoretical: importing the browser door from the server
kills the boot with `Cannot find module 'react/jsx-dev-runtime'`.

Two more subpaths are routing rather than code graphs:

- `./all.css` chains each plugin's stylesheet.
- `./testids` is that plugin's catalogue of browser-test identifiers. Every
  renderer owns a pure identifier table: plugins export `./testids`, shared
  rendering libraries own their widget IDs, and the permanent web host keeps only
  boot identifiers. The generated aggregate and the shared tables are checked
  together for duplicate keys and values. `selector` and `AnyTestId` live in UI
  primitives, whose type-only `TestIdTables` interface each owner augments. No
  runtime catalogue or plugin import enters a generic widget.

**`@olai/plugin-api` is not one of those doors**, and that is the point. It is
the interface a plugin is written against: browser-face types and slots at its
root, server service tags at `./services`. It names no plugin, which is what lets
a plugin import it.

- `@olai/effect-cordis` is absent for the mirror reason: it is the engine and
  names no feature. `@olai/plugin-api` re-exports its plugin authoring
  primitives.
- Generic host adapters may use engine operations directly: the browser's scoped
  service reader resolves an offered key without importing the provider or its
  contract.
- The bundle opens `@olai/effect-cordis/loader` to mount rows. That door carries
  `node:fs` and a YAML parser, so it cannot travel through a package a tab
  imports.

**Adding a plugin is one row, because the rest is generated.**

| Fact | Detail |
| --- | --- |
| What is generated | [`generate.ts`](../../packages/bundle/generate.ts) writes, from the rows: the browser's row table with a dynamic `import()` per plugin, the stylesheet chain, and the merged testid table with its pairwise disjointness proof |
| Where it lives | all three are gitignored and produced by `just install` and by the nix build in its own sandbox, beside the tenants' marks, so a packaged build cannot ship a stale copy |
| What it replaced | the browser kept two hand-written `as const` arrays for one release, held equal to the rows by a `rosters.test.ts`. That test recorded the duplication rather than removing it, and it is deleted with the lists |
| Why the specifier is a literal | it makes each plugin its own JS chunk: a plugin the roster does not name is never fetched, never evaluated and registers nothing. kolu's terminal emulator is 336 KB a machine not running kolu never downloads |

---

## 6. The wire: one root, N siblings

The browser and server talk over one websocket. Core owns the root set of
messages, and each running plugin adds its own sibling set under its name.

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
| Core's four members | the plugin roster, the enable/disable switch, who is looking, and what this deployment is called. All on three-segment tags |
| Tags cannot collide | three segments versus four, and the framework forbids `/` inside a name. The composition counts them anyway, because the merge underneath is last-writer-wins and a silently dropped tag is a member that answers nothing with nobody told |
| Nine rows kept a three-segment alias until #546 | `outlines`, `markdown`, `files`, `trash`, `pins`, `capture`, `search`, `vault`, `vault-plugins` registered `root: true`, so each member also answered on a bare tag (`surface/edit/apply` beside `surface/outlines/edit/apply`), inherited from the monolith those rows were cut out of |
| Six of them then shared two tags | `surface/edit/apply` and `surface/ops/run` needed an envelope in the composition root picking an owner by payload field, five mount-time refusals, and a hand-written face table in `@olai/bundle` granting the bare names — one permission typed in two packages, so a member added to a row's own `faces` was refused under its short name until somebody edited the bundle |
| All of it is gone | `surface/outlines/outlines/get` reads oddly and is correct: row name, then member name, like `surface/kolu/fleet/get`. Same for `surface/pins/pins/get`, `surface/search/search/nodes` and `surface/vault-plugins/plugins/inspect` |

The mechanics belong to the framework, end to end (juspay/kolu#2222, #2223).
olai spelled all of them by hand for two PR windows and now spells none;
[`mechanics.test.ts`](../../packages/bundle/src/mechanics.test.ts) keeps it that
way.

| Where | Call |
| --- | --- |
| server composes | `implementRootedSurfaces(core, base, deps)` |
| server mounts a sibling | `runtime.mount(key, surface, deps)`, which returns its own undo |
| server gates access | `exposeRootedFaces(core, coreMap, siblings, siblingMaps)` |
| browser connects | `connectSurfaces({ core, surfaces })` — one call, watchdog included |

### When the roster changes

A plugin can fail or be switched off, and its sibling messages leave the wire
with it.

| Event | What happens |
| --- | --- |
| A sibling arrives | `mount` touches the arriving sibling only. Rebuilding the whole map over the survivors would fork every survivor's handler values, cell stores, channels and running sources, leaving an open connection answering out of the previous copy |
| A sibling is removed | each departing tag is bound to a refusing handler at once, so an older connection gets a `SurfaceSiblingDropped` defect on its next call and an in-flight subscription fails with the same defect rather than hanging on a producer nobody drives |
| A sibling arrives after the server started listening | the browser must reconnect. `serveSurfaceApp` takes its group and handlers when it listens, and `connectSurfaces` bakes its own at dial time; the roster cell moving is the browser's cue to call `SurfacesConnection.redial(surfaces)` |
| The browser reacts | [`wire.ts`](../../packages/web/src/client/wire.ts) holds the loop: dial with no siblings, read the roster cell, load exactly the named browser halves, redial with their surfaces, then mount their fibers — so a fiber never starts over a wire that does not carry its sibling. A second roster frame arriving mid-redial queues behind the first |

olai pins kolu through npins on `master`, unfrozen, and `npins/sources.json` is
the only place the revision is written. The behaviour below depends on
[Kolu PR #2228](https://github.com/juspay/kolu/pull/2228), which `nix/kolu.nix`
names as a property of the pin rather than a revision that goes stale.

### What a browser client promises across a reconnect

Established by reading the pinned sources and proved by
`packages/tests/features/filter_live_recovery.feature` and
`content_capabilities.feature`.

- **Object identity holds.** `redial` returns the same connection object, and
  `live.clients` is one object mutated in place for the life of the tab. A
  sibling on both rosters whose loaded module is unchanged keeps its exact
  client, and the core client and connection readout never move. So a
  module-scope constant holding the *connection* is safe; one holding a plugin's
  client is not, because a departing key is deleted from that object — which is
  what the holder pattern in each plugin's `browser/wire.ts` is for.
- **Subscriptions return, but are not preserved.** Superseding the connection
  fails every open subscription with a transport error; each resubscribes about a
  second later and takes a fresh snapshot. A surviving subscription therefore
  reads `pending` for roughly that second on every roster change, and `pending`
  does not mark the readout degraded. So "nothing on this page has gone silent"
  cannot prove frames are arriving again; only a test watching a value change
  after the toggle can, which is what `filter_live_recovery` does. The gap is
  part of the contract: any broker replacing or wrapping `Wired` owes consumers
  the same statement, and owes a decision about whether a consumer is told the
  gap is open rather than left to infer it.
- **A call on a departed plugin is refused three ways, never hangs, never
  silently succeeds.** Before the tab redials the server raises
  `SurfaceSiblingDropped`; a call in flight on the superseded connection is
  interrupted; a client a component still holds fails with kolu's own worded
  error. All three land in `packages/web/src/client/run.ts` and reach a person as
  a `BusyFailure`. A fresh `wired.client()` for a departed plugin returns `null`.

### One connection, one app render

| Behaviour | Detail |
| --- | --- |
| One connection, one render | roster changes no longer recreate the component tree or the roster subscription. The core client and connection readout are exported directly, with no proxy and no synthetic reconnecting state |
| Identity refreshes on its own | it uses kolu's `connectionEpoch` accessor to refresh the answer derived from the socket's upgrade headers. Kolu skips an unchanged surface map |
| olai still refreshes an unchanged open socket on roster change | plugins without a surface can change which headers the next upgrade may retain (identity's first activation). The refresh waits for the next usable socket before mounting arriving providers, or their first requests target the closing socket; that wait releases its listener on success, retirement or timeout, so it cannot block the roster queue indefinitely |
| The router keeps its app lifetime | it reinterprets the current URL when plugin route claims change, preserving unchanged pane identities and browser history. Undo history belongs to App again and needs no module-level store |
| Provider changes still update the provider tree | removing chat must remove its context and faces together. Pane and conversation draft stores remain needed for those changes and for navigation between panes and sessions |

---

## 7. Built, default and running

Three lists describe which plugins exist, which run by default, and which are
running now.

```
  BUILT      what the binary carries   = every row in packages/bundle/olai.yml
  DEFAULT    what absent policy runs   = the rows without their own `disabled`
  RUNNING    what THIS serve mounted   = the fibers that reached ACTIVE
```

| Rule | Detail |
| --- | --- |
| The settings reader mounts first | under the vault lock. Its first publication becomes the `disabled` and `config` patches before other rows can apply |
| `on` in the settings file selects rows | a top-level `kolu` node with `on: no` leaves that row absent from the first activation onward; an absent `on` uses the profile or build default; `on: yes` enables a row shipped with `disabled: true` |
| One settings file, two kinds of server | it travels between hand-started and Nix-managed servers. Nix supplies machine resources (`dataDir`, `host`, `port`, `environmentFile`), not a second policy declaration. Only the composition root patches loader rows |
| Config changes re-apply a row | unless it declares `configUpdates: "live"`, in which case it owns its revision subscription through declared services; the composition root leaves its activation config alone and still applies enablement. The static choice grants no loader capability |
| RUNNING is read off the runtime | a requested row may wait on a missing service or fail during `apply`, so configuration is not evidence of activation. The roster carries actual state beside per-leaf values and `setBy` readings, so defaults and authored values stay distinguishable even when equal. Unknown namespaces have no row to patch and leave existing rows unchanged |

The build-time default lives in the row itself:

```yaml
- id: xyne-spaces
  name: olai-plugin-xyne-spaces/server
  disabled: true
```

The alternative was a `defaultOn: false` field on the wire half. The row wins
because it is the same field the settings patch writes: one mechanism, two
writers, no second spelling to disagree across. Turning an opt-in plugin on is
therefore not a special path — a policy enabling xyne-spaces writes
`disabled: false` over a row the file set `true`, the same line that turns
another row off. [`rows.test.ts`](../../packages/bundle/src/rows.test.ts) holds
both directions.

### The enable/disable switch

`plugins.set({ name, enabled })` on core's surface moves a plugin between running
and off while the server runs. It is drawn as a switch on each row of the plugins
panel.

| Claim | Detail |
| --- | --- |
| It writes the loader's own field | the server half flips that entry's `disabled` — the field `olai.yml` carries and the settings file patches — and re-settles the bundle. A row somebody switched off and a row the file disabled are the same absence, which is what keeps the runtime's confluence argument true |
| Off means the fiber unwinds | every registration is an `acquireRelease` on the plugin's scope, so off takes back its kinds, wake, sibling surface, slots and any service it provided, in reverse. The sibling leaves the wire, the `plugins` cell moves, the tab redials, and every plugin that named a service this one provided goes `waiting`, naming it. On is the reverse, and dependants re-apply themselves |
| `LocalState` is keyed by name, not by fiber | a plugin that comes back reads the record it left |
| The property vocabulary follows the fibers | `propKinds` was read once at boot and held by the store's codec for the process's life; it is a live reading now, so a row that leaves removes its words, a row that arrives adds them, and the vault is re-judged. A value under a kind whose plugin is off is plain text, like any undeclared key, and produces no finding. BUILT is unaffected, read off every row's module including disabled ones |
| The panel says what a flip costs before it is pressed | a running row that provides a service names the rows that would go `waiting` without it (`BuiltPlugin.carrying`, the other end of `missing`). It is a join of two live readings — core's table of provided services, filled by each plugin's `offer` and released by its scope, and the injections the runtime derived from each row's `needs` — and the composition root is the only place both are in hand. A hand-written "I carry these" list beside `needs` would be free to be wrong about the one sentence a person reads before turning something off |
| The roster describes a bundle that has stopped moving | a flip fans out into several registry changes, each driving a re-compose. Siblings mount and drop as they move, but the `plugins` cell is published once the settle is done; otherwise the tab would redial onto a wire still coming apart. It is the promise `mountBundle` makes at boot, kept for a press |

**The listener serves the generation live at each accept**, which took a kolu
change.

- `serveSurfaceApp` used to read the served `{group, handlers, expose}` once when
  the port bound. A re-mounted sibling was then unreachable for the life of the
  process: its tags still resolved to the retired mount's refusing handler on
  every later socket, a reloaded page's included.
- Sub-phase 8a made the served set a source rather than a value: a caller with a
  fixed surface passes the generation, one whose served set moves passes a
  function returning the current generation. olai's listener passes that function
  over the getters the rooted runtime already exposes. The restriction is
  re-applied at every accept, which is what an accept costs and is not something
  a consumer can shorten.
- All three parts move together: the group is what a per-connection `RpcServer`
  is built over, the handler record is what it dispatches through, and the face
  is a default-deny allowlist derived from the sibling set. Two re-read with the
  third stale is the mismatch `restrictHandlers` refuses. A facade over the
  handlers alone was declined because a row absent at boot has no tags in the
  group to route to.
- A connection accepted before a flip keeps its generation until the client
  redials, because Effect RPC bakes a group into each `RpcServer` at
  construction. Nothing closes those sockets server-side: the removal already
  bound their tags to refusing handlers, and the tab's redial is the client half
  of the same revert.

**A panel switch is an ordinary vault write.** It writes `on` into the row's
namespace in `_olai/Settings.olai`, waits for that revision to be reconciled, and
appears in the git ledger, so the choice survives a restart.

- The two providers that make this possible keep session-only switches, so the
  panel cannot lock its own recovery door. When the settings reader is absent,
  the panel foot says once that switches are session-only. A broken settings file
  refuses durable writes with a repair sentence.
- Core grants the switch to the browser face only. The write gate reserves `on`
  in the settings file against agents, including moves, deletion and shadowing
  that would change its effect; other behaviour properties stay agent-writable.
  `faces.test.ts` and the write-door tests pin both sides.

### Which vocabulary answers which question

| Question | Judged against | Why |
| --- | --- | --- |
| Is `{"type":"kolu-terminal"}` a legal declaration? | **BUILT** | a file's verdict may not depend on which rows happen to be running |
| Does this value fit the kind? | **RUNNING** | `admits` is a promise only a plugin that is present can make |
| May this value's dressing draw? | **RUNNING** | see §8 |

So `{"type":"kolu-terminal"}` is a clean row on a machine running only vault and
odu, while `{"type":"banana"}` is a broken file either way. BUILT is read off
every row's module, including rows this server disabled, because a disabled row
never mounts and its words must still be reachable. RUNNING is the live `Kinds`
registry, holding exactly what mounted plugins registered.

---

## 8. How a live property gets its UI

This is the subtlest path in the system: how a value in a vault file ends up
drawn as a chip by a plugin the browser was never told about.

The constraint: a vault's property declarations deliberately never travel to the
browser (juspay/olai#395 — the tab receives answers, not rules), so the browser
cannot read `_olai/Properties.olai` and decide anything.

1. **The vault declares a key to be a kind.** The key may be called anything
   (`pty`); the kind is the plugin's prefixed word (`kolu-terminal`). Where the
   vault says nothing, the plugin's own claim applies.
2. **The server consults once per value it is about to send.** `@olai/format`'s
   `meaning.ts` maps `(from, prop, value)` to `{ opens, word }`: what door this
   value names, and which running plugin's kind claims it. One consult, because
   one declaration decides both. The answers ride the page stream as a doors
   table and a licences table, both keyed `from·prop·value`.
3. **The browser draws.** A chip becomes a link from `opens`; `dressingFor()`
   looks `word` up in the table plugins registered into their slots.

What travels is an answer about one drawn value, never the declaration. A page
says which word claims each value it draws, and nothing about which keys the
vault declares or what a value on another page would answer. #395 is intact.

### Why this needs saying

It was wrong for one PR window in a way nothing could catch. The dressing table
was keyed on the property **key**, because the key was all the tab had, while the
server's walk and value gate followed the declared **kind**. The two agreed only
when a vault named its key after the kind. A vault declaring `terminal` on a
column called `pty` was walked, probed and gated, and drew nothing.

> **The rule:** the declaration licenses the dressing, and a declaration is the
> vault's row, or the enabled plugin's claim where the vault said nothing, in
> that order. Never the key's spelling, and deliberately no fallback to it: a
> fallback would keep the same defect alive under another name. The claim is not
> a fallback, because it is a declaration like any other and can only ever take a
> key carrying the plugin's own name.

The consult also refuses a value that does not **fit** the kind: it gets no word.
That is what makes a built-in claim safe to switch on, since enabling a plugin
declares keys in vaults nobody migrated, some holding prose written before the
plugin existed. Those stay plain — no door, no dressing — with the validator's
finding beside them, and with no guess from the value's shape.

### The two permissions

| Licence | Asks | Answered by |
| --- | --- | --- |
| the page's | is **this value** claimed by a kind word? | the consult above |
| the roster's | is this server running the plugin that owns the **dressing**? | the `plugins` cell |

They resolve to the same plugin for both of today's dressings, so the second
looks redundant. It is not: nothing requires a dressing to be registered by the
plugin that taught the vault the word. A plugin may dress another's kind, and
then the word is claimed while the dressing's owner is off.

### Drawing versus subscribing

The roster arrives on a frame, so there is a moment when the browser does not yet
know which plugins run. The two defaults point opposite ways, because a wrong
guess costs differently.

| | Before the roster lands | Why |
| --- | --- | --- |
| **draw** a dressing | assume ON | a dressing drawn early and removed is a flicker |
| **mount** a plugin | assume OFF | a subscription to a sibling this server did not compose fails permanently: the readout latches at `degraded`, naming a plugin the operator turned off, for the life of the page |

---

## 9. What a disabled plugin is

A disabled plugin is **absent** — not parked, not half-wired, not degraded — and
absent at every moment, not only at boot.

```
  kolu.on = no   ⇒   kolu's row is patched `disabled` and never applies

                      no sibling surface        no probe run
                      no wire tag               no chrome pill
                      no handler                no tab half mounted
                      no expose row             no dressing licensed
                      no surface/kolu/ at all   its kinds validate as plain text
                      no claimed key            (so no built-in declaration)
```

| Consequence | Detail |
| --- | --- |
| Nothing degrades | the outline it would have owned is an ordinary outline; the properties it would have dressed draw as the text they always were, still stored, greppable and editable. The connection indicator stays green |
| It costs no extra mechanism | it used to hold because every composition function takes a plain keyed object of surfaces, so row selection was a filter applied once at boot. It now holds for a stronger reason: every registration has its own undo, so a disposed fiber drops its sibling, kinds, wake declaration and listeners in reverse, at any moment |
| A failing `apply` is the same absence | the fiber lands in `FAILED` having installed nothing, and every other plugin stays active. A missing padi socket can no longer be a server that will not start |
| The degenerate case runs the same code | a runtime with no plugins mounts no sibling, leaving core's own surface byte for byte what it was |
| Minimal profiles use the same path | the `surface` server profile selects the `vault` row over the host kind registry plus the `mcp` row and no other bundle plugins; `test-minimal` selects no transports. Both use the same plugin host and composition as the `web` profile, and `olai surface` itself remains a client of the running server |

---

## 10. Adding a plugin

The complete checklist. Two artifacts live outside `packages/` (a symlink and a
docs line, step 4), and no general package changes at all.

### 0. `packages/plugins/<name>/package.json`

- The package is `olai-plugin-<name>`, unscoped, and the directory is the plugin
  word. `@olai/*` is the scope for packages that *are* olai; a plugin is named
  the way an out-of-tree one would be.
- It goes in `packages/plugins/` and nowhere else, held to the registry's roster
  in both directions by `fence.test.ts`'s ninth claim.
- Copy a tenant's manifest: `main`, `types`, a `typecheck` script, and an
  `exports` map of the five subpaths every plugin has — `.`, `./server`,
  `./browser`, `./testids`, `./all.css` — plus `./wire` if you compose a surface.
  An engine has no `./wire` (step 6).
- `./browser` is the one to get right: it is the subpath
  `packages/bundle/generate.ts` emits the tab's dynamic `import()` against, so a
  manifest without it generates a browser row that will not resolve.
- Declare `@olai/plugin-api`, `effect`, your appliance's client, `@olai/format`
  if you read the vault, `solid-js` if you draw, **and everything else your own
  sources import**: the isolated linker gives a package exactly what its manifest
  names, and `effect` resolving by walking up to the repo root is a hole, not a
  shortcut.
- Never declare `@olai/bundle` (it imports you), or `@olai/effect-cordis` and
  `cordis` (the engine, one package's business).

### 1. `src/wire.ts`

- Exports `name`, a `defineSurface` and the `faces` map.
- May not import SolidJS, an appliance client or a `node:` builtin.
- **An engine has no such file.** What an engine contributes to a tab already
  travels on the chat cell, which is core's, so it composes no surface and puts
  its `name` in `src/index.ts`. See step 6.

### 2. `src/server.ts`

- A `default` export of `definePlugin({ name, needs, apply })` where `apply` is
  one Effect. Yield each service you named; the compiler refuses one you did not.
- This is where the appliance's client is called, `Surfaces.register(...)` puts
  your surface on the wire, `Kinds.register(...)` teaches the vault a word, and
  `Deliveries` posts into a conversation.
- Register a `wake` or the strip draws no picker for you and `chat.scope` refuses
  your name — the gate working, not a bug.
- Register on `SessionStart` if you have a tool to probe for, and on `Agents` if
  you are adding an ACP engine (step 6).
- Log with `Effect.logDebug` and `Effect.logWarning`, which arrive at the level
  the operator asked for.
- If your appliance calls you back from a timer or a socket, take `detached` once
  and start Effects through it: `ring(work)` where nobody needs the fiber,
  `ring.held(work)` where something of yours must interrupt or await it by name.
- Everything you register comes back out on unload, so write no teardown — unless
  you hold something the runtime cannot see, which is an `Effect.addFinalizer`
  and is what `xyne-spaces` does for its mirrors.
- **Use `addFinalizer` only when nothing was awaited** to obtain the thing it
  releases. A fiber parked in `Effect.promise` is interruptible and unwinds where
  it stands, so a plugin stopped between `const it = yield*
  Effect.promise(open)` and the `addFinalizer` on the next line has opened
  something with no release registered. Anything you waited for belongs in
  `Effect.acquireRelease`, which registers the release as part of the acquisition
  and cannot be interrupted between the two.

### 3. `src/browser.tsx`, if the plugin draws UI

- Same shape: `name` and `surface` re-exported from `./wire.ts`, and a `default`
  `definePlugin` whose Effect registers your components into `Slots`. Browser
  import graph, own chunk.
- **The SolidJS twin of step 2's rule:** an `onCleanup` registered after an
  `await` inside `onMount` runs with a null owner, which Solid's production build
  compiles to nothing. `await` always yields, so the cleanup is *always* dropped,
  not merely raced.
- Anything you must load before you can build (an `import()`ed chunk) registers
  its cleanup before the load, over an empty slot, and guards the continuation
  against an owner that has already gone.
  `packages/plugins/kolu/src/appliance/props/mounting.ts` is that pattern written
  out, with the reason a `runWithOwner` rescue does not cover it.
- An engine re-exports only its `name` and registers two components: its mark and
  its install sentence (step 6).
- A server-only plugin omits `./browser` and `./all.css` from its exports; no
  empty modules are needed, and the generator emits neither a chunk nor a
  stylesheet import.

### 4. `packages/plugins/<name>/docs.md`

The user page, plus a symlink at `docs/plugins/<name>.md` and a line in
`docs/index.md`. `packages/tests/plugin_docs.test.ts` fails if you skip either.

### 5. One row in `packages/bundle/olai.yml`

- `id: <name>`, `name: olai-plugin-<name>/server`, and `disabled: true` if your
  plugin needs a secret this machine may not have.
- That is all: the browser's row table, the stylesheet chain and the merged
  testid table are generated from that row by `generate.ts`.
- You still write your package's own `exports` — the generator derives all four
  subpaths from the row's module name — and one line in
  `packages/bundle/package.json`'s `dependencies`, without which the generated
  `import()` does not resolve.

### 6. If it is an engine

An engine is an ACP coding agent the chat panel can seat, rather than an
appliance olai has a judgement about. Smaller shape, same rules.

- No `./wire`, no surface, no `faces`: `src/index.ts` holds the plugin's word and
  nothing else.
- `src/leg.ts` is a `Leg` (`@olai/acp/engine`): every assumption about that
  agent's wire, each a pure function with a unit test, each safe to lose in one
  direction — an agent matching none of them means the person is asked.
- `src/server.ts` registers `{ name, leg, at, prompt }` on `Agents`: what a
  person reads, the leg, a probe answering `Adapter | null` for this host, and
  the channel the standing prompt rides. Not the install sentence: it rode this
  registration once and nothing read it, because the component that draws it is
  the browser half's.
- `src/browser.tsx` registers two components, both drawings about this engine:
  its mark (`delivery.mark`) and its sentence on the screen shown when the
  machine has no agent at all (`engine.install`, which takes a `NotHere` value
  rather than a drawing). Core keeps the shape of each — the sixteen-unit box,
  the list, the order — and neither crosses the wire, so a row selection naming
  other engines draws a panel with nothing of yours in it. Chat also owns
  `tool.reply`: outlines supplies `{ fileOf, story }` through that slot,
  registered after its resources so the face withdraws first. The face owns
  its interactions; the slot does not require chat to supply node navigation. Display ownership
  comes from the optional MCP catalogue through `Tools`, resolved per call.
- Put the install sentence in a `src/install.ts` your browser half opens: a
  `NotHere` (`@olai/plugin-api`) whose `why` is a whole sentence core composes no
  clause of.
- **There is no slot for the picker's row**, and the omission is deliberate:
  those words are your engine's `name`, which the server already sends per
  installed agent on the chat cell, so a slot would give one string two authored
  sources. A slot is for what core cannot compose — a `<g>`, a sentence about
  installing your tool — not a name it was handed.
- Its `testids` table is legitimately empty: an engine draws inside core's own
  elements, under core's ids, with `data-agent` carrying its word.
- If olai ships an adapter for it, the volatile packaging belongs in
  `packages/plugins/<name>/acp/`: patches and their rigs always, plus a
  standalone lock and derivation when the adapter has its own release and
  platform clock (Codex). The older Claude/Pi pair still shares the root `acp/`
  shim and the rows in `nix/acp-agent.nix`; that directory's README says why.
- **The order of the engine rows is load-bearing**, unlike a tenant's: it is the
  order the picker draws and the install screen lists, and the first row is what
  a conversation note naming no agent is read as being about.

Then run `bun test packages/bundle` and let the fence tell you what you got
wrong. It will be specific.

Everything in steps 1–3 except the name and the surface is optional. A plugin
contributing one cell is a whole plugin — odu is. The absent case of every hook
is the state a machine without the tool already shows.

---

## 11. Where the rules are enforced

Every claim on this page is a test. If you break one, the failure names the file.

| File | Holds |
| --- | --- |
| `packages/bundle/src/fence.test.ts` | no general package **imports** a plugin (four grammars: imports, `scanImports`, CSS `@import`, manifests); no general package **spells** a plugin name in production code; a plugin imports the interface, never the registry, and does import the interface; the services door pulls in no browser component; `packages/plugins/` holds the plugins and nothing else, both directions; and **no module another package can open holds a live value** — no module-scope `let`, no Solid signal or `heldService`/`heldFaces` created at module load, no state-bearing IIFE or instance of a locally declared class, no `const` the module writes into. It walks every cross-package subpath, and for general packages the implementation behind them too, since a `let` one import away is state the door does not show. A plugin's contract doors get the same walk; its `./browser` does not, because the bundle opens that to mount the plugin rather than to read values out of it. Allowed exceptions are named with a reason each (the audit's §12). Fixtures hold every prohibited shape beside the legitimate one it is easiest to confuse with, aliases and namespace imports included |
| `scripts/prove-fence.sh` | that the fence and the mechanics lint go red when they should. Not a `just check` leg: it mutates tracked files and restores them, and `check` runs its legs in parallel. Run it when the fence changes — a fence that stopped running looks exactly like a fence that is passing |
| `packages/bundle/src/mechanics.test.ts` | olai hand-writes no wire mechanic the framework performs |
| `packages/bundle/src/tree.testlib.ts` | not a claim: the shared reading the two files above stand on (workspace members, manifests, sources, module graph), written once |
| `packages/bundle/src/report.test.ts` | what became of each row on a real runtime — a row nothing mounted reads `off`, a failed `apply` reads `failed` and carries the plugin's own message verbatim, a row short of a named service reads `waiting`. These are the words the panel's five are composed from |
| `packages/bundle/src/kinds.test.ts` | a declared word is composed from the plugin's own name; a word leaves the vocabulary when its plugin unloads; the BUILT half carries every row's words whatever the policy selects |
| `packages/bundle/src/composition.test.ts` | an empty roster composes, core's tags do not move, and — with modules loaded — every module answers to the name its row binds it under, and every face a plugin declares has a map behind it. No `rosters.test.ts` any more: two of its three hand-written lists are generated from the third |
| `packages/bundle/src/testids.test.ts` | all plugin, boot and shared-renderer ID tables have distinct keys and values; the permanent web table contains only boot overlay IDs |
| `packages/plugins/kolu/src/testids.ts` | a tenant's two testid halves share no key and no value — a type-level assertion, so a collision is a `tsc` error naming the offender rather than a test somebody keeps green |
| `packages/plugins/kolu/src/faces.test.ts` | the tenant's two UI directories stay apart: `src/browser/` names no part of the appliance's tier, `src/appliance/` names none of the vault's vocabulary — the wall `@olai/kolu-ui`'s manifest kept before the fold. Enforced in the tenant, not the fence, because a per-directory rule up there would be the fence enforcing a layout convention it invented |
| `packages/tests/plugin_docs.test.ts` | every plugin's docs page exists, is served, and is linked |
| `packages/server/src/faces.test.ts` | `chat.scope` is named on the browser face and nowhere else; the agent face is pinned as an exact set, so an agent-settable doorbell is a failing suite rather than a rule to remember |
| `packages/server/src/runtime.test.ts` | a `wake` sentence reaches the roster only for a plugin this server mounted, so no picker is offered for a doorbell nothing would ring; and a requested plugin that nothing mounted draws as off |
| `packages/plugins/chat/src/deliveries.test.ts` | a message delivered mid-turn is held, and the conversation keeps its interruption |
| `scripts/check-hydrated-deps.sh` | the appliance dependency walls, per pin: kolu, odu and cordis |
| `packages/effect-cordis/src/lifecycle.test.ts` | the bridge's ordering against the pin — a dependent's asynchronous cleanup calls through a still-live provider on removal, replacement and host close; a running bus handler is cut and joined before a resource released either side of its `listen`; a handler stopping its own plugin is cut rather than waited for; a loading initializer is cancelled by a stop, a withdrawal and a host close; a loader flip cancels without rewriting its file; a duplicate offer is an `OfferConflict` naming the first provider, with the pin's wording asserted verbatim; `offer` takes its Cordis disposer out of the concurrently-unloaded set. Plus the claims a bare scope cannot make: a child-scope registration stops with that child while its plugin stays mounted, pending and running alike; a gate's two owners join one cut rather than the second finding an empty set; a stop waits for a handler's child fibers, not merely its body; a registration whose scope ends stops being one of the activation's records |
| `packages/effect-cordis/src/upstream.test.ts` | the pinned engine's own behaviour with no bridge in the way: a fiber's disposers unload concurrently, the reproduction behind `nix/cordis.nix`'s fourth ask and the reason `lifecycle.ts` takes the ordering itself |
| `packages/effect-cordis/src/gate.test.ts` | a call arriving after a registration stopped is never started; one already inside is cut and the stop does not return until it has unwound; cutting it leaves the publisher untouched; a publisher interrupted first takes its call with it |
| `packages/effect-cordis/src/plugin.test.ts` | the bridge itself on toy services, with no olai noun in the file: a plugin waits until a named service is provided, its finalizers run in reverse on unload, a replaced provider re-runs it, a plugin whose Effect dies lands `failed` having installed nothing with its siblings untouched, and the stamp a keyed service is minted with is the word the registry bound it under |

---

## 12. Plugin-owned service keys

A plugin can provide a service of its own, and another plugin can declare that it
needs it, with no core edit in between.

The vault also offers `vault.outline-row`, the configured mint row id, to server consumers. It is owned by the vault configuration activation; the browser receives the same id in the file-kinds cell. Non-Markdown page metadata (`bodyPage`: head, revision and referrers) travels through `vault.files`, independently of Markdown's own `documentPage` stream. `bodies.get` is browser-only and refuses kept or fetched files. Claims carry the serving policy: hypertext declares `serving: "sealed-frame"`; image declares `picture` and its per-suffix `inert` policy. The media handler consumes those declarations, never a MIME-to-kind lookup.

### The mechanism (12b)

| Fact | Detail |
| --- | --- |
| How a key is made | `Offers.own(word, provision)` registers the service under `<fiber name>.<word>`; the runtime supplies the fiber name |
| How a key is consumed | `serviceTag<Shape>(key)` is both the consumer's Effect requirement and its Cordis dependency |
| Key grammar | both segments allow lowercase letters, digits and hyphens, starting with a letter. Dots cannot appear in either, so one plugin cannot spell another's namespace |
| Who owns lifecycle | the bridge: readiness, rollback and dependent-before-provider cleanup, for plugin-owned and core offers alike |
| Reporting | `Plugins.offers()` tracks ownership for cascade reporting; `Plugins.serviceKeys()` adds only plugin-owned keys to the public catalog for `plugins.inspect`. Internal core offers stay ownership facts and do not enter that catalog |
| Provider selection | core's seven row-provided keys form a closed set, but any row may provide one while it is free. Cordis refuses two simultaneous providers, and core never names the provider |
| Scope | browser services are unchanged; these are server-half dependencies |

See [the authoring contract](../dynamic-plugins.md#sharing-a-plugin-owned-service)
and the two-definition lifecycle scenario in
`a_plugin_the_vault_defines.feature`.

### `journal.agenda`, a key whose consumer cannot be recompiled (12d)

12b built the mechanism with two vault-defined fixtures behind it, and 12c gave
it its first shipped user, `chat.seating`, between two rows this build compiles
together. This case is the one the mechanism was built for: the consumer is a
plugin somebody wrote into a vault, which olai never rebuilds.

- `olai-plugin-journal`'s `agenda.ts` declares the door and `server.ts` provides
  it with `offers.own("agenda", …)` — the bare word, since the runtime adds the
  fiber name.
- It is stateless: the caller passes in the vault reading the answer is about, so
  there is nothing to acquire or release beyond the offer, which the row's scope
  revokes.
- **The reading travels in.** Same argument as `Search` one plugin over: a
  service that read the vault for itself would answer about a revision of its own
  choosing, and a caller building a sentence out of the answer could not say
  which revision it meant.
- **The request is `unknown` and the answer is typed.** Vault-defined plugins may
  import `@olai/plugin-api`, `effect` and `solid-js` and nothing else, so they
  cannot name a `Reading` — they pass one through — but they can read fields off
  an answer the provider spells with the format's own types. Both ends agree
  structurally; the string key names a dependency and checks no shape.

`the_morning_agenda.feature` covers the lifecycle end to end: a definition
approved on the panel, waiting on the key while the journal row is switched off,
running when it returns, and one delivery reaching a node agent's own
conversation through `Deliveries` — with the key appearing in and disappearing
from `plugins.inspect` as the journal moves. The worked example it near-copies is
in [plugins the vault defines](../dynamic-plugins.md#a-worked-example-the-morning-agenda),
compiled from that page by `olai-plugin-vault-plugins`' `worked.test.ts`.

---

### File-kind ownership

`vault.file-kinds` is minted in vault setup, before the store opens. A row
registers one atomic claim; the registry stamps its fiber binding as `kind`.
All suffix collisions are checked before publication. Failure installs nothing,
and cleanup withdraws only the departing owner's claim. Revalidation brings
new claims into the set and removes withdrawn claims; published readings retain
the immutable Claims value used for validation. Claim policy fields are defined
once by the inert `ClaimData` schema; the server claim adds its parser, and the
registration input omits the registry-owned id. Cleanup tokens remain separate
from snapshots, because snapshot construction copies claims.

The browser consumes the vault's `file-kinds` cell, containing serializable
claims and `outlineRow`. Reconnection resubscribes for a fresh snapshot.
`files.kinds` and `navigation.pages` belong to their readers and accept scoped
contributions keyed by row id or by `holds`, with the row id taking priority.
Glyph and page are independent components. Outlines contributes both once for
`holds: "nodes"`; a format row requires no browser half. A body page declares
every live service its moved face reads. Their static helpers own no registry.
Glyph contribution lists are derived under the sidebar activation, once per
location change, and released with it; individual glyph lookups do not copy the
list. Page contribution lists likewise change with the location rather than
with the selected address.


The file-kind lifecycle is checked at these boundaries:

| Guarantee | Enforcement | Evidence |
|---|---|---|
| The registry stamps the owner | vault `file-kinds.ts`, provision bound to the registering fiber | vault `file-kinds.test.ts`: forged kind ignored |
| A refused claim installs nothing | synchronous construction before publication | same test: nine-suffix loser and winner cleanup |
| Departed claims remove files and media access | registration finalizer and vault revalidation | `file_kinds.feature`: PDF off/on |
| A later probe cannot keep a withdrawn claim | codec reads the table per call | ops `codec.test.ts`: withdrawal between probes |
| A Reading retains its validating table | immutable Claims on Reading | ops `codec.test.ts`: old snapshot unchanged |
| Formats cannot fetch their own registry | pure three-argument parse | bundle `fence.test.ts`: format has no FileKinds access |
| Git and chat use the selected format | Ops parser door and vault outlineDiff | git `committed.test.ts`, bundle import fence |
| An absent vault leaves an unreadable diff | scoped browser request and cancellation | chat `outline-diff.browsertest.ts` |
| Reconnect takes fresh claims | file-kinds cell and directory memo | vault `directory.browsertest.ts`, offline scenario in `file_kinds.feature` |
| Glyph and page degrade independently | separate row components | bundle `file-kind-component.test.ts`, Files/Navigation scenarios |
| Withdrawing a location releases its acquisitions | scoped contributions | bundle `file-kind-locations.test.ts` |
| An absent mint row writes nothing | planner refuses before staging | mint scenario in `file_kinds.feature` |
| Callers receive no implicit Claims table | required codec argument, test-only empty table | typecheck and suffix sweep |
| Two hosts own separate tables | table created inside vault setup | server `vault.test.ts`: two hosts, separate claims |
| Only claiming rows spell suffix literals | census of server registrations | tests `kinds.test.ts` |

The registry-driven generated-record round trip in server
`file-kind-formats.test.ts` discovers every registering row; future formats
inherit record identity and canonical-byte checks.

## Phase 18: shell and content capabilities

The application shell itself is built from plugins. The permanent host only
starts plugins, supplies generic loading and transport facilities, and publishes
management.

| Rule | Detail |
| --- | --- |
| The bundle supplies the shell | layout, navigation, sidebar, outlines, Markdown and the other feature rows |
| Server capabilities need no renderer or workspace | browser-only rows report host selection separately from actual activation in each tab |
| Fixtures prove the separation | `test-counter` exercises the same host without `Vault`, `Directory` or `Ops`; `test-layout` uses unchanged content plugins in an alternate shell |
| General production packages name no plugin package | not even through a static contract; only the bundle chooses providers. Test and testlib readers may import explicit static contracts. This is an equality with an empty production import set, not an allowlist of exceptions |
| Cross-plugin imports go through explicit static doors | `/contract`, `/slots`, `/testids`, carrying service tags, descriptors, types and static data. A rendering API taking its data as props may contain JSX, but its closure must not acquire provider resources or reach private browser or server implementations. Declare the provider as a package dependency and express runtime availability through `needs`; importing a contract does not activate its provider. Fences check direct imports and the resolved transitive graph |

### Locations and compatibility

A renderer location is a named place a component can be contributed to. Only
`root` is permanent; every other location belongs to some contribution's
lifetime.

- A contribution registers with `contribute(location, value, { children,
  activate })`. The registration belongs to the caller; `activate` acquires
  location-dependent resources in a separate scope, and its children exist only
  while that entry is active.
- Withdrawal drains dependents before releasing the owner's resources. Returning
  owners acquire fresh integrations; surviving siblings keep their identities.
- Reservations, key policies, duplicate ownership, cycles and failed acquisition
  are checked while entries wait as well as when they activate.
- `Slots.register` and `Faces` are adapters over that same registry; a name-only
  reference cannot declare an owner or choose cardinality.
- Outlines, navigation, layout, sidebar and chat own their static slot
  descriptors, types and consuming renderers; the API has no fixed catalog of
  application slots. Inspection reads immutable metadata from the supplied bundle
  modules. See [slot ownership](slot-ownership.md) for the owner table.
- Providers do independent work outside their location integrations: theme state
  survives removal of its preferences UI, inspector reading history survives
  shell replacement, and Outlines retains editor state across unrelated Chat
  changes — though leaving Outlines discards its own pending drafts. Separate
  components name extra services only where they use them, so an unavailable
  integration does not stop the rest of its plugin.

### The vault provider

The vault is an ordinary plugin row, not a host facility.

| Fact | Detail |
| --- | --- |
| Selection | `olai-plugin-vault/server` lives in `packages/bundle/olai.yml` and is selected by every default profile. Its session switch can stop it; file enablement is ignored for the settings-reader owners |
| Startup order | it waits on `VaultSettings`, supplied once the bundle's declared vocabulary is available, and acquires the one-brain lock before opening the store |
| What it owns and provides | its watcher and revision publisher; it provides `Vault`, `Directory` and `Ops`, while `Kinds` stays core-provided. Late revision subscribers receive the current snapshot, and plugins naming `Vault` wait while it is absent and reactivate when it returns |
| Consumers | capability providers acquire `Directory` and `Ops` through their declared needs; `makeOps` runs inside the vault row after the store is acquired |
| The write gate | owns its caches and accepted-write count; its finalizer rejects fresh calls and drains accepted writes before releasing the watcher and lock. A server without the vault has no domain gate. Domain surface handlers leave with their providers, while permanent management stays available |
| Boundary | vault owns file-access projection and publishes revisions to dependents. Content providers register their own readings and operations through `Surfaces`; the host routes those declarations without importing the store or a domain projection. Machine-local facilities arrive through generic host services, runtime path configuration is passed to the vault capability, and the provider owns lock-file sweeping and resource release |
| Config | the row's `Config` schema declares `format` with default `outline-olai`, and `olai.yml` selects the row without a `config:` block. Further formats register their own claims and codecs through `vault.file-kinds`; there is no codec catalogue. The Effect bridge decodes row config before user `apply`, inside the same contained activation as every other initializer, avoiding the pinned Cordis constructor-validation path that could leave an invalid row pending and reject an unobserved loader promise |
| Failure and disabling | the switch stays available and explains its cost: disabling clears served collections and removes vault-defined plugins, while transports remain. A lock conflict or non-directory root lands as a failed row carrying its own failure sentence, so the panel can retry once the cause is fixed. `runtime.test.ts` opens the test-minimal profile and reads its store through `Directory` |

### Transport plugins and profiles

The websocket, MCP and web-app transports are ordinary bundle plugins, not server
flags.

| Plugin | Owns |
| --- | --- |
| `ws` | origin checks, header admission, stale-tab checks, heartbeat enrollment and connection cleanup, over the framework's socket primitives |
| `web-app` | static routes, the service worker, the manifest |
| `mcp` | its route, carrier, protocol server, tool projection and scoped ticket registry |

- Transport providers wait on the composed surface before registering routes.
  Browser exports are independent: web-app supplies browser integration, and
  vault supplies scoped file access without owning a layout.
- `TransportSurface.register` accepts scoped HTTP route layers and upgrade
  handlers. Core's `listener.ts` owns one port and rebuilds HTTP dispatch from
  those contributions, with no transport flags and no transport-specific branch;
  each registration owns only its own contribution.
- MCP applies request attribution to the host's composed agent generation, and
  domain providers enforce the supplied session rule.
- Static write reservations come from the bundle's owner declarations and stay
  active while their owner is disabled. Route changes preserve existing websocket
  connections. With only MCP registered, the same listener serves only its HTTP
  route.
- `mountBundle` resolves only the modules in `olai.yml`; profiles cannot insert
  rows or supply a special resolver. The `web` profile keeps the catalogue
  defaults, while `surface` and `test-minimal` disable rows outside their
  `profiles` membership.
- Explicit file enablement overrides profile defaults for ordinary rows,
  transports included. Settings-reader owners ignore file `on`, and disabling
  every transport opens no listener.
- The browser test harness explicitly composes its socket, assets and MCP carrier
  for nonempty test tags. `BUNDLE_NAMES` includes every transport, so dynamic
  definitions cannot replace those reserved names.
- The generator reads package exports: only a declared `./browser` gets a
  browser-table entry and a chunk, and only a declared `./all.css` enters the
  style chain. Server-only packages need neither stub.
- The plugins panel holds its switches while the browser reconciles a roster. A
  server-only row can change without remounting that panel, and its state may
  arrive before the socket replacement finishes; waiting for the whole queued
  reconciliation prevents a second press being sent on a connection about to
  close. The browser-asset scenario covers two consecutive off/on cycles.
- Profile policy has one interpreter, `profilePatch`, and every served route has
  a registration owner. Websocket admission uses the framework's
  `restrictServedGeneration` over its narrow generation contract. An accepted
  HTTP response survives another route provider's arrival and withdrawal: the
  platform protects that response, while the routing scope controls which
  handlers new requests reach. Shutdown rejects new connections and upgrades
  during the drain and waits for observed socket closes before closing the port.

### Who owns a live value

Phase 2 of the Cordis audit applied one rule: a module another package can open
holds no live value.

| Finding | Detail |
| --- | --- |
| A service carries a value; a module variable does not | twenty modules used to pass one activation's live state across a package wall through an exported `let`, a module-scope Solid signal or a `const` the module wrote into: the served directory and its per-file revisions, the shell's geometry and panel handle, the URL grammar's roster-dependent half, the mounted page behind a plugin route, what day it is, the pinned shelf, the file controls, the outline's naming of a node, where a new document opens, the walk over a location, the palette's control, the matcher, and each row's sibling client |
| Cordis could see none of it | no consumer declared a dependency, nobody was held `waiting`, the panel had nothing to report, and a consumer kept reading a provider that had stopped. Each value now travels on the service that names it, provided by the row that owns it and named in `needs` by the row that uses it |
| Two doors stopped being doors | eight rows' `./client` and the renderer's `readLocation` published a live value with no reader outside their own package. One generic capability went with them: `HostServices`, whose whole shape was "give me whatever stands behind this key", was named by two rows and used on five keys neither had declared. One of the five was dead — MCP asked whether a ledger was mounted and never read the answer |
| **A registry instance is owned too, not only a holder** | the table saying where a verb's write goes was a `Map` at `@olai/edit-history`'s module scope: five plugin activations claimed verbs in it and four packages used them, with nothing declared. Scoped entries and a refused double claim are lifetime discipline; ownership is a separate question, answered by `Edits` — a browser service `openApp` supplies, one table per attached app, the twin of `Kinds` and `Surfaces` on the server. Dispatch and both its answers are unchanged |
| **Optional access is declared, and a component is the wrong way to declare it** | MCP works without a vault and the vault without git. Putting each optional reach on a component naming its key is wrong: a row's report folds its components, so a component `waiting` for a provider that never arrives makes the whole row read `waiting`, and `@olai/server`'s runtime reports a row `running` only when it is not waiting. A vault without git would then stop being loaded by the tab at all. A component is for a half that is optional to *have*, never for a provider that is optional to *exist* |

| Design that is right | Example | Why it works |
| --- | --- | --- |
| **The provider registers into the consumer** | the vault's `VaultViews`, where git and search tell the store about their ledger and matcher | both already name `Vault`, so neither gains a wait, the dependency edge is at the end that can carry it, and the registration is a finalizer on the provider's scope. Same shape as `Kinds.register`, `Surfaces.register`, `Wakes.register`. The default answer |
| **A narrow broker** | MCP's `host.served`, two readings about one provider | for when the arrow cannot be inverted: a vault registering its gate with the transport would mean the directory knowing what an MCP endpoint is. Legitimate where `HostServices` was not, because it is closed — two readings, named in the type, about one provider — rather than `current<A>(key)` |

- **A private holder is still how a value reaches a component**, and its rules
  are in [the authoring contract](../dynamic-plugins.md#where-a-live-value-may-live):
  the consumer holds rather than the provider, the hold belongs to an activation
  and clears by identity, and the read answers the absence. What changed is which
  side of the package wall the holder is on.
- The fence names what may keep module state, with a reason each, because none of
  it belongs to an activation: the process's signal handlers, a per-process nonce
  for staged filenames, two warn-once flags, the page's layer stack and its one
  open tip, a re-entrancy guard held across one call, a dozen `WeakMap` memos
  keyed by the immutable value they fold, the engine's bookkeeping keyed by the
  host or fiber it is about, a sticky regex's cursor, one slot a suite installs a
  listener in, `wire.ts` (the `Wired` broker of §6, whose readers name the
  service), and the fence's own corpus reader, which one benchmark opens.
- Two entries are worth knowing. `edit-history`'s verb-keyed writer table was
  allowed for one commit and should not have been: its entries each belonged to
  one activation and a second claimant was refused, which is lifetime discipline
  rather than ownership — the table itself was a general package's `Map` five
  plugin activations wrote into and four packages read. It is the app's now,
  behind `Edits`, and the allowance is gone. Most of the rest appeared when the
  check started walking behind a general package's doors rather than reading the
  door file; none was introduced by that widening, and all fall into the three
  classes the list already had.

### Server composition and source policy

Wire schemas belong to the plugins that implement them, not to one core spec.

- The permanent `@olai/surface/core` declaration serves process identity and
  management; `@olai/surface` exports inert shared wire types. No feature
  descriptor is selected from a monolithic core spec.
- Each server activation registers its own surface through `Surfaces`; its
  browser activation receives the matching `Wired` client and installs an
  accessor for that scope. Disposal revokes the accessor, so a stale consumer
  cannot keep authority by holding an old client. Shared edit algorithms receive
  the owner's write operation as a value.
- Outlines, Markdown, files, pins, capture and trash bind their own server
  readings and operations, and scoped surface mounts preserve the established
  public tags.
- Shared discriminated procedures dispatch disjoint owner-declared cases;
  conflicting variants, write authority and face grants are rejected. Retained
  handlers are revoked when their provider leaves, and an absent branch reports
  the same lifecycle refusal as a departed sibling without killing unrelated
  calls.
- Markdown's metadata stream rejects outline and node addresses, so it works when
  Outlines was never enabled.
- MCP owns its adapters and tickets. Its advertised tools and resources follow
  current capability availability, and retained clients resolve current handlers
  and write authority. Supplemental vault and plugin-chunk HTTP routes do not
  open a listener without an actual transport, and a failed or absent vault
  leaves the host control plane usable.
- `vault-plugins` owns discovery, version approval, compilation and chunk
  delivery through a generic owned loader: acquired children, catalogs and
  pending starts leave with their owner, while accepted vault writes stay
  durable. The host knows module declarations and lifecycle reports, not source
  approval policy. Approval writes stay reserved from agent access even when the
  policy provider is absent. Catalog changes refresh host reports, including
  definitions waiting for another definition's service.

### Presentation resources and recovery

Build-time `/assets` exports contribute head markup, styles, module preloads and
stable files through a generated catalog.

| Owner | Presentation resource |
| --- | --- |
| theme | first-paint appearance, fonts, title and favicon presentation |
| web-app | install metadata and icons |
| Markdown | its renderer preload |
| layout | viewport, geometry, deployment naming |
| alerts | notification channel and permission listeners, audio, badge and tab-attention writer |
| chat | question attention state; consumes `alerts.channel` on its attention component |
| journal | daily reminder record, owed subscription and `due` press claim; consumes `alerts.channel` on its reminders component |

- The runtime does not import this build graph. Clock factories belong to the
  renderer and timers to their consuming scopes. Late asynchronous completions
  cannot publish after those owners leave.
- Browser loading retries a failed entry under a fresh entry URL. If that also
  fails it offers **Reload page**, because Chromium may keep a failed static
  dependency in its module map. Successful shared runtimes keep their identities.
- Both the inspector and the renderer-free startup diagnostics explain recovery,
  and neither silently discards the document. The live roster stays authoritative
  over a late bootstrap response or failure.

---

## See also

- `just cordis-graph` — every row's two halves, their components, needs, offers
  and location contributions, read off the sources and served as a clickable
  graph. An edge from A to B means a component of A needs a service or location
  B owns; the side panel names which, per component.
- [`packages/bundle/README.md`](../../packages/bundle/README.md) — the same
  subject at implementation depth.
- [architecture.md](overview.md) — how every package fits, plugins included.
- [cordis.md](cordis.md) — ownership, lifetimes and removal.
- [slot-ownership.md](slot-ownership.md) — renderer location owners.
- [live-properties.md](../live-properties.md) — the user-facing half of §8.
- [running.md](../running.md) — row selection as an operator sees it.
