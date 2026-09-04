# The plugin system

*How olai integrates with tools that are not olai — and how it does that without
core learning any of their names.*

This page is for people working on olai. It is a tour, not a specification: the
authoritative arguments live in the code, mostly in
[`packages/plugin-api/src/plugin.ts`](../../packages/plugin-api/src/plugin.ts) and
[`services.ts`](../../packages/plugin-api/src/services.ts) beside it, plus
`@olai/bundle`.s [README](../../packages/bundle/README.md). If you only read one thing, read
**Vocabulary** and **How a live property gets its face**.

---

## 1. The problem

olai talks to things that are not olai:

- **kolu** — runs coding agents in terminals, and serves them over MCP.
- **odu** — runs CI.
- **xyne-spaces** — mirrors a conversation outward into a bound channel.

The first two were once "extracted into their own packages", and both left a
residue behind in the general ones:

| Where | What was there |
| --- | --- |
| `olai-plugin-chat` | a `kolu.ts` |
| `@olai/server` | a `koluConfig.ts`, a `wiring.kolu` slot, a `koluHalf(…)` call |
| `@olai/surface` | four `...koluMembers` spreads in the middle of core's wire spec |
| `@olai/server`'s expose map | a row per plugin member |
| `@olai/web` | a `padi/` folder |
| four packages | one property key spelled at seven sites |

None of that was sloppy. It was olai's own **judgement about an appliance** —
what an absent padi means, which vault file is kolu's, which property wears which
face. What was missing was a *place to put a judgement about an appliance that is
neither the appliance nor the core*.

`packages/plugin-api/` is that place, and it is the only one. `packages/bundle/`
is the second half of what that package used to be — the list of which plugins
this build has — and it moved out the day a plugin started importing the
interface. The tenants that stand on both live one directory over, in
[`packages/plugins/`](../../packages/plugins/README.md).

> **The bar:** a general package may know a plugin's **name**. It may not know
> anything else about it — not a member, not a key, not a constructor.

---

## 2. The shape, in two breaths

A plugin has two halves, written against two different things — the browser's
faces and the server's services — and ONE shape.

**BOTH HALVES ARE EFFECTS** — a `name`, a list of the services it `needs`, and an
`apply` that is one `Effect` — and the browser one registers into declared SLOTS
where it used to be a manifest object a compiled-in registry held:

```ts
// packages/plugins/odu/src/browser.tsx  (abridged)
export { name, surface } from "./wire.ts"

export default definePlugin({
  name,
  needs: [Slots, Clocks, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("outline.row.chip", WORKTREE_KIND, CiChip)
    yield* slots.register("outline.row.pane", WORKTREE_KIND, RunMatrix)
    yield* slots.register("delivery.mark", OduMark)
    yield* slots.register("app.mount", (props) => /* one subscription per tab */)
  }),
})
```

The manifest could not survive the tab following the roster: a value is present
whether or not this serve composed the plugin, so every walk over it carried a
LICENCE beside it — and the two licences pointed opposite ways, because a face
drawn early and taken away is a flicker while a subscription opened early
latches a `degraded` readout for the life of the page. A plugin the roster never
named registers nothing, so there is nothing left to license.

`needs` is the same narrowness the old structural `OduApp` record declared, said
TWICE and to two different readers out of one list: the runtime holds the plugin
`waiting` until every one of them is provided, and the compiler computes this
Effect's requirement channel from the same array — so a service yielded here and
not named there is a `tsc` error at the `definePlugin` call, in the plugin's own
file.

**The server half is the same shape** — an Effect that installs *revertible
effects* onto its own `Scope`, and declares which services it needs:

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

Every one of those `register` calls is an `Effect.acquireRelease` on the plugin's
own scope, so unloading the plugin unregisters exactly what it registered, in
reverse. It used to be a `serve(services)` that returned a blob core took apart,
and then a plain function reaching into Effect by hand.

**The plugin imports `@olai/plugin-api`,** which reverses an earlier ruling. It
could not, while that package was also the registry — the registry imports every
plugin, so a dependency back was a cycle the manifests could not express. The
registry is `@olai/bundle` now and the interface names no plugin, so the arrow
runs one way and a server half can name the services it needs.

---

---

## 3. The runtime under all of it

**A plugin is written in Effect, and Cordis is an engine nobody outside one
package sees.** That is the ruling this layer is shaped by, and it is checkable:
`packages/effect-cordis` is the only package in the tree that names `cordis` at
all, and `packages/bundle/src/fence.test.ts` holds that as an equality
(`scripts/prove-fence.sh`'s mutation 16 is what proves the claim is not asleep).

Three ideas do all the work, and each replaced something olai used to hand-write.

**A registration is a revertible effect.** `kinds.register(kind)` is an
`Effect.acquireRelease` on the plugin's own `Scope`. Unloading a plugin closes
that scope, which runs every finalizer it accrued, in reverse. There is no
teardown to write and none to forget, and a plugin whose `apply` failed before it
reached a `register` installed nothing at all. Effect's `Scope` and the paper's
accumulator are the same thing, which is why there is only one of them here: a
plugin author never sees `ctx.effect`.

**`needs` is a reactive dependency AND the requirement channel.** A plugin lists
the services it needs, once; the runtime holds it `waiting` until they exist,
unloads it when one leaves, and re-applies it when one returns, and the compiler
computes the `R` of `apply` from the same list. A plugin that does not name
`Deliveries` cannot reach the doorbell — which is the part a blob handed to
everyone could not express, and the part two declarations could disagree about.

**The per-plugin STAMP is not an argument and cannot be spelled.** A keyed
service is a *provision* — a function from the plugin's own word to that plugin's
view of the service — which the facade calls ONCE, with the name it read off the
fiber. So `deliveries.deliver(...)` has no parameter for "who", `env.dial` is
already this plugin's double, and `kinds.register(...)` takes the bare word and
composes the prefix itself. The composition root used to close over a name to
build `doorFor(plugin.name)` and `dials[plugin.name]`, which put a fence's keying
in a file that must not know what it was keying. Same guarantee, and now nowhere
to put it wrong.

The hooks, and what each replaced:

| Hook | Mode | Was |
| --- | --- | --- |
| `vault.revision(handler)` | door | `PluginServer.revision(snapshot)` |
| `vault.unloaded(handler)` | door | `PluginServer.unloaded()` — and it is **not teardown**: it means the STORE has never published, so what a plugin derived from the vault is yesterday's reading, while what it holds from its own daemon is untouched |
| `SessionStart.ask(probe)` | keyed registration | `PluginServerHalf.probe`, then a `chat/session-start` waterfall |
| `watching.subscribe(handler)` | door | `PluginServices.watching`'s hand-rolled `Set` and the unsubscribe a plugin had to remember to call |

**The doors take handlers that answer Effects, and the publisher awaits them.**
The design for this phase said `Stream`; they are not, and the reason outranks
the shape. The root publishes a revision from inside the directory binding's own
connector, and the statements after that line write the collections, the heads
and the roster over a world every plugin has already re-derived. A `Stream`
subscriber is a fiber of its own, so the publisher could only offer and walk on —
and *"the vault moved, and every reading of it has moved with it"* would stop
being one statement.

What the Effect buys instead is the containment the synchronous loop never had.
They were Cordis **emits**, under a claim this page made in as many words: *both
are emits, so a listener that throws is one listener's problem — the dispatcher
contains it.* Cordis's `emit` is a bare `Reflect.apply` loop with no `try`, so it
contained nothing: one plugin throwing on a revision took down every LATER
plugin's reading of that revision, and the owned directory fiber that published
it. The door wraps each handler once and warns with the plugin's own name on the
line.

**There is one seam left, and it is named.** An appliance — `koluHalf`, the odu
sweep, a Spaces mirror — is not written in Effect and is not wrapped (§7's
standing ruling). Where one of those fires a callback that has to start an
Effect, the plugin uses `detached`: one helper, in the facade, forking under the
plugin's own services (so a line carries the level the operator asked for) and
onto the plugin's own scope (so work in flight when it unloads goes with it). It
is the boundary made visible rather than an escape hatch copied per plugin.

`--plugins`, the bundle's rows and the browser slots are **phase 2** of a longer
plan (the Cordis proposal's §6); the Effect API above is **phase 4**. What is
deliberately NOT here: HMR (no Bun cache bust exists), interception on the vault,
and node-agent scopes.


## 4. Vocabulary

Skim the table; the sections after it give one example each.

| Word | What it means |
| --- | --- |
| **plugin** | one integration, two halves, one shape: each is a `definePlugin` over an Effect. TWO KINDS of them today — a **tenant** (olai's judgement about somebody else's appliance: kolu, odu, xyne-spaces) and an **engine** (an ACP agent the chat panel can seat: claude, codex, opencode, pi) — and nothing in the system tells them apart |
| **name** | the plugin's one word — `"kolu"`, `"claude"`. Also the **sibling key**, the **row id**, the **fiber's name** and the address of its docs page |
| **row** | one line of `packages/bundle/olai.yml`: an `id` and the module the loader mounts. The build's list, as data |
| **fiber** | one mounted plugin, with a lifecycle. A composition root sees four words for it — `running`, `waiting`, `failed`, `off` — and the engine's six states are `@olai/effect-cordis`'s business |
| **service** | an Effect tag a plugin yields — `Vault`, `Kinds`, `Vocabulary`, `Surfaces`. What `PluginServices` dissolved into. The tag carries the engine's key, so `needs` and the requirement channel are one declaration |
| **needs** | the services a plugin names. The runtime holds it `waiting` until they exist and unloads it when one leaves; the compiler computes `apply`'s requirements from the same list |
| **effect** | a registration that carries its own undo. Every `register` is an `Effect.acquireRelease` on the calling plugin's `Scope` |
| **surface** | a whole `defineSurface(...)` contract, declared inside the plugin's package |
| **member** | one thing on a surface: a cell, a collection, a stream, a procedure |
| **face** | *who* may see which members — `browser`, `agent`. Default-deny |
| **probe** | "is this tool on this host?" — an Effect registered on `SessionStart`, read afresh and asked once per conversation. The plugin's NAME is stamped off the fiber, like every other keyed door |
| **engine** | one ACP agent olai can seat, as a plugin: a `Leg` that reads its wire, a probe that finds it on this host, and the channel its standing prompt rides — plus, on its browser half, the mark it wears and the sentence about how to get it. `claude`, `codex`, `opencode`, `pi` — one directory and one row each |
| **kind** | a word a plugin teaches the vault's vocabulary. Contributed BARE (`terminal`) and composed by `Kinds` with the plugin's own name (`kolu-terminal`) |
| **claim** | the key a kind declares by convention — its own composed word, so mounting a plugin turns its faces on with no file to edit |
| **dressing** | what a live property *wears* in the browser: a chip, a pane, a block |
| **chrome** | what a plugin hangs in the app's header bar |
| **mount** | the plugin's own half of the tab — one subscription per tab |
| **mark** | the plugin's FACE — the glyph over a sentence it delivered into a conversation, and the one an ENGINE wears in the picker and the header |
| **engine install row** | an engine's line on the face drawn when this machine has no agent at all: how a person gets it. A `NotHere` VALUE in `engine.install`, not a drawing — core owns every stroke (the list, the mark, whether the name is a link) and the plugin owns every word. Its row in the panel's *which agent?* question is NOT one of these: those words are the engine's `name`, which the server already sends per installed agent, so core draws a string it was handed rather than a face it was hung |
| **watching** (`Watching`) | the read-shaped door that is not a read: core PUSHES what happened in a conversation — a doorbell that landed, an orchestrator reply that settled, a turn that started or ended — and a human message is not among them |
| **held** (`Held`) | a small opaque record a plugin keeps about this serve, in the state home rather than the vault |
| **doorbell** (`Deliveries`) | the write-only door a plugin speaks INTO a conversation through: which conversations opted in to it, and one verb that puts a whole sentence in one. Minted from the calling plugin's own word |
| **wake** | the plugin's own words for the control a person points that doorbell with — three pieces, and core composes none of them |
| **roster** | which plugins this build has, and which this serve is running |
| **built vs running** | what the bundle's rows list vs which of them mounted |
| **licence** | permission for a face to draw, answered per drawn value |

### name

One word, and it does four jobs: the preferences row, the `--plugins` value, the
docs address (`docs/plugins/<name>.md`), and — the load-bearing one — the **wire
prefix**. Because the name *is* the prefix, the two cannot drift apart.

### surface and member

A plugin declares a surface the same way core does. odu declares one member:

```ts
export const surface = defineSurface({ cells: { ci: { /* … */ } } })
```

Core composes it as a **sibling** under the plugin's name, so it reaches the wire
as `surface/odu/ci/get`. Nothing in olai computed that string — the framework did,
out of the plugin's own name. See §6.

### face

Which members a caller may reach, written in the plugin's own package against its
own spec:

```ts
export const faces = { browser: { ci: "resource" } }
```

A face a plugin never mentions is **denied in full**. Neither plugin writes an
`agent` map today, so an MCP client can call none of their members — and that is
data, not a hardcoded rule. The day a plugin wants otherwise, it writes the map
and nothing in core changes.

### probe

*"Is your tool here, and if not, what should I tell the person?"* Asked before a
chat session starts, answered with **both halves at once**:

```ts
interface Probed {
  server: StdioServer | null   // the MCP server to hand a session
  missing: NotHere | null      // ...or the whole sentence about the one it did not get
}
```

Two fields, one reading, and that is an invariant with an incident behind it: a
caller that asked once for the server and again for the sentence would start
somebody's daemon **twice per conversation**, and could answer the two questions
about two different moments.

`missing.why` is a **whole sentence, written by the plugin**. Core displays it and
never composes it — the four ways a padi fails and the four ways a coordinator
does have nothing in common but that they failed, and a sentence built out of that
shared nothing is a debug line on a screen.

A plugin with no probe is a whole plugin: the absent arm is a machine that
simply does not have the tool, and that state already had to work. Both
tenants here have one; no engine does.

It is not a FIELD any more. A plugin REGISTERS what it would ask:

```ts
yield* (yield* SessionStart).ask(Effect.promise(() => probe(env.vars)))
```

The list is read afresh per session open, so a plugin that unloaded between
conversations contributes nothing to the next one and nobody keeps a second
list. The ASKING rather than an answer, because the SCHEDULING is
`olai-plugin-chat`.s: a probe starts a subprocess on the session-open path, and
running them one after another would multiply that window by the number of
plugins — the same defect the bound concurrency exists to prevent, wearing a
different shape. `Probed`.s two halves still come off ONE reading.

**It was the last door where a plugin signed its own name, and the last thing a
plugin handed over that was a promise.** Both came from the payload being a
plain record: it was a WATERFALL, so what a link put in the record was whatever
the record.s type said, and neither the per-fiber stamp every keyed door has nor
the effect channel everything else uses was anything the door could enforce. The
agents phase took both, and what fixed them is that this stopped being a
waterfall: the waterfall.s own powers — transform what the later links see,
short-circuit the rest — were never used here and could not honestly be, since
the order the links ran in was the order two dynamic imports came back in. What
the event IS is a collection, and a collection keyed by the calling plugin is
the shape `Kinds`, `Wakes` and `Watching` already had. The waterfall PRIMITIVE
stays in `@olai/effect-cordis` for the delivery policy the design names next.

### kind

`@olai/format` owns seven property kinds — `text`, `date`, `int`, `path`, `doc`,
`ref`, `node` — and none of them is a terminal. So a plugin **contributes** one,
as a **bare word**:

```ts
export const kinds = [{
  kind: "worktree",                      // BARE — the registry prefixes it
  takes: `\`${WORKTREE_TYPE}\` (a path to a checkout, no whitespace)`,
  admits: isPathShaped,                  // does this value fit
}] as const
```

**The registry composes it with the plugin's name**, exactly as the framework
composes a member into a wire tag:

```
  a plugin contributes …    a vault declares …
  ─────────────────────     ────────────────────
  kolu:  terminal      →    kolu-terminal
  odu:   worktree      →    odu-worktree
```

That prefix buys two things. Two plugins cannot collide on a word, because two
plugin names cannot. And — the reason the human ruled it — **a plugin's built-in
declaration can only ever claim a key carrying its own name**, so enabling one
can never take over a column you have been using for something of your own.

### the two layers of a declaration

A key is declared by whichever of these speaks, and the first one wins:

```
  1. THE VAULT'S ROW        _olai/Properties.olai       ← always wins
  2. THE PLUGIN'S CLAIM     the kind's own word          ← where the vault said nothing
```

So an **enabled plugin declares its own key for you**. A lane carrying
`kolu-terminal 303dc985` gets the door with nothing declared anywhere, and
**olai never writes your vault** to make that true. Turning the plugin on is the
whole of turning the face on.

And a row of yours always beats it — which is how you move a kind onto a short
key, and how you take a face away again:

```jsonl
_olai/Properties.olai
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"kolu-terminal"}}
```

Your key, the plugin's kind, your file.

The fold is **one function** (`@olai/format`'s `withClaims`) and precedence
exists nowhere else. It rides the **enabled** table, so a disabled plugin's
claims vanish with its kinds — no new rule needed for `--plugins`. And no
consumer learns there are two sources: the validator, the write gate, the
licence consult and the dressing table all keep taking *the declarations* as one
value.

**Why a kind and not the key's name.** `brief` and a checkout column are both
declared `path`, on the very same rows, and only one of them names a checkout to
dial a socket in. A shape cannot tell them apart. A declaration can.

`@olai/format` imports no plugin. The kind table travels **as data**, handed down
from the composition root, and the format's own union grows exactly one arm:

```ts
type PropType = … | { kind: "contributed"; word: string }
```

which keeps its five kind-enumerating places exhaustive. A contributed kind cannot
quietly stop being handled, because it is an arm the compiler counts.

### dressing

What a live property wears. Three optional faces, and each keeps its honest name:

```
        ┌─ a row of the outline ────────────────────────────────────┐
        │  implement + open PR                                      │
        │  ┌────────────┐ ┌───────────────────────┐                 │
  CHIP  │  │ agent grok │ │ worktree .worktrees/x │ ci · e2e 2:10 ◀─┼── draws in the
        │  └────────────┘ └───────────────────────┘                 │   run, beside
        │                                                           │   the value
  BLOCK │  ▸ ● claude · thinking · the terminal door  ◀──────────────┼── owns a row
        │                                                           │
  PANE  │  ┌───────────────────────────────────────┐                │
        │  │ (what the chip's press opened)        │  ◀─────────────┼── below the run
        │  └───────────────────────────────────────┘                │
        └───────────────────────────────────────────────────────────┘
```

A **block** owns a row always (a terminal somebody wrote down is worth a row even
when nothing is happening). A **chip** appears only while there is something to
say (a worktree with no CI running looks exactly as it did). A **pane** is what a
chip's press opens.

Crucially, a dressing draws **beside** the property's value and never instead of
it. The stored value is still a fact somebody greps and edits.

### chrome and mount

`chrome` is a slot in the header bar — kolu's padi pill. `mount` is the plugin's
own half of the tab: **one** subscription however many rows draw. Both are
components the plugin owns; the app hands them its own *furniture* (the clock, the
pill's geometry, a popover, a link to a served file) so a plugin never imports
`@olai/web`, which would be a cycle.

### mark

`mark` is the third browser hook and the smallest: the shapes drawn over a sentence
this plugin delivered into somebody's conversation. The chat panel names the
speaker of every run of messages — the person, the agent, or a plugin — and looks a
plugin's face up by the `rang` name core already stamped on the row.

It takes **no argument at all**, where `chrome` takes the furniture: a mark is a
glyph at the size of the line it sits on, so there is nothing for the app to hand
over. It answers with the SHAPES — a `<g>` of paths in a `0 0 16 16` box, drawn in
`currentColor` — and the app owns the `<svg>` around them, because the marks are
read as a column and a plugin that owned the size could make its row look unlike
every row around it.

It is a manifest field rather than a table in the panel for the fence's reason: no
general package spells a plugin's name in code (`fence.test.ts`, claim 8), so the
day a third tenant delivers a sentence it arrives wearing its own face and core is
not edited. A plugin that hangs none is drawn with a plain generic and named in
full — never another plugin's shape.

### doorbell and wake

The other direction. `probe` and `chrome` are the app asking a plugin something;
this is a plugin **saying something**, unprompted, into a conversation somebody is
having with an agent:

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

Two members, and **`deliver` cannot read**. A plugin learns which conversations
opted in to *it* and nothing else — not who is in them, not what is in them, not
whether its own last sentence landed. The body goes down the same lane a person's
message goes down, so the row it lands in is a `user` row; core marks that row
with the plugin's name, stamped **from the registry binding and never from the
caller**, which is the difference between a mark and a signature one plugin could
put on another's words.

Core decides only *when*. An idle agent takes the sentence as a turn; a busy one
**holds** it until the turn ends, so that a machine can never spend the
interruption a person has not typed; a conversation nobody is in holds it until
somebody opens it. Which arm a body took is never reported back, because there is
no arm a plugin would answer differently.

**Who may be rung is a person's answer, and the strip is where they give it.**

> Scope is MANUAL per conversation. No serve-level default, no agent-settable op.
> A fresh or cleared conversation starts with the doorbell OFF until a person
> picks a file. *(ruled human, 2026-08-31)*

That control is `chrome`'s arrangement one floor along — a slot the app owns whose
CONTENT is the plugin's:

```ts
readonly wake?: {
  subject: string                          // "wake on terminal activity"
  from: string                             // "terminals from"
  waiting: { one: string; many: string }   // "fleet event waiting" / "…events waiting"
}
```

```
   ┌─ the wake strip ──────────────────────────────────────────────┐
   │  wake on terminal activity · terminals from [ lanes.olai ▾ ]  │
   │  └──────── subject ───────┘ ↑└─ from ─┘ └── core's picker ─┘  │
   │                             core's punctuation                │
   └───────────────────────────────────────────────────────────────┘
```

Three pieces and not one string with a hole in it, for `missing.why`'s reason
sharpened: a hole would make core the author of everything around it. Core owns
the arrangement, the punctuation, the numeral in `3 fleet events waiting`, and the
picker — nothing that is a claim about the plugin's subject.

Why not a member on the plugin's own surface instead? Because the browser is not
the only reader. `chat.scope` **refuses a plugin whose composed half declares no
wake**, and that check runs server-side against the enabled halves — so the
declaration belongs on the server door beside `probe` and `kinds`, where a serve
can read it without dialling anything.

---

## 5. Three doors, because three graphs — and the fourth thing, which is data

A plugin has three code entry points, and there are two packages behind them.

```
                        ┌──────────────────────────────────────────┐
   @olai/bundle/wire    │  name · surface · faces                  │
   ─────────────────▶   │  no SolidJS, no appliance client         │
   read by: the         │  no node: builtins                       │
   browser's wire       └──────────────────────────────────────────┘

                        ┌──────────────────────────────────────────┐
   packages/bundle/     │  a ROW: id · the module to mount         │
   olai.yml             │  DATA. No import graph at all — the      │
   ─────────────────▶   │  loader resolves the specifier at mount  │
   read by: the loader  └──────────────────────────────────────────┘
                                       │
                                       ▼  olai-plugin-<name>/server
                        ┌──────────────────────────────────────────┐
   the plugin's ./server│  name · needs · apply (an Effect)         │
                        │  MAY pull the appliance's client,        │
                        │  @olai/format, node: builtins            │
                        │  may NOT pull a browser face             │
                        └──────────────────────────────────────────┘

                        ┌──────────────────────────────────────────┐
   @olai/bundle (root)  │  + dressings · chrome · mount · mark     │
   ─────────────────▶   │  SolidJS, and behind one face            │
   read by: the browser │  a terminal emulator                     │
                        └──────────────────────────────────────────┘
```

One door for all three would put a component on the graph of a process that
renders nothing, and a daemon's whole contract in the browser bundle. It is not
theoretical: importing the manifest door from the server **kills the boot** with
`Cannot find module 'react/jsx-dev-runtime'`.

Two more entries are routing rather than graphs: `./all.css` chains each plugin's
stylesheet, and `./testids` merges each plugin's names-only testid table.

**`@olai/plugin-api` is not on that picture, and that is the point.** It is the
INTERFACE a plugin is written against — the browser-face types and slots at its
root, and the server's service tags at `./services` — and it names no plugin at
all. That is what lets a plugin import it, which the registry could never allow
while the two were one package. `/effect-cordis` is not on it either, and
for the mirror reason: it is the ENGINE, it has never heard of a vault, and its
runtime door has exactly one importer — `@olai/plugin-api`, which re-exports
that list onto both of its own doors, so a plugin, a tab and a composition root
all spend it from the same place. The one reach past that door is
`@olai/bundle` opening `/effect-cordis/loader` to mount the rows, because the
loader carries `node:fs` and a YAML parser and cannot travel through a package
a tab imports.

**`olai.yml` is the whole list, and a fourth plugin is ONE ROW.** The browser
kept two `as const` arrays for one round — a browser bundle is built ahead of
time and there is no loader in the tab — held equal to the rows by a
`rosters.test.ts`. That test was a monument to the duplication rather than a fix
for it, and it is deleted with the lists.

What the tab reads instead is WRITTEN from the rows at build time
([`generate.ts`](../../packages/bundle/generate.ts)): the browser's rows with a
dynamic `import()` per plugin, the stylesheet chain, and the merged testid table
with its pairwise disjointness proof. All three are gitignored and produced by
`just install` and by the nix build in its own sandbox, beside the tenants'
marks and for the same reason — a generated file is never in the store copy of
the tree, so a packaged build cannot ship a stale one.

The literal specifier is what makes each plugin its own **chunk**, which is the
browser's exact twin of *no fiber, no surface, no handler*: a plugin the roster
does not name is never fetched, never evaluated, and registers nothing. kolu's
terminal emulator is 336 KB a machine that does not run kolu never downloads.

---

## 6. The wire: one root, N siblings

Core does **not** become a sibling. Its tags are byte-unchanged, because an MCP
client already writes `surface://collections/documents` and the suite asserts
those addresses.

```
  surface/outlines/get          ← core.  3 segments.  unchanged, forever
  surface/kolu/fleet/get        ← kolu.  4 segments.  declared `fleet`
  surface/odu/ci/get            ← odu.   4 segments.  declared `ci`
            ▲     ▲
            │     └── the member's own name, in the plugin's package
            └──────── the plugin's name, and nothing computed it
```

The two sets **cannot** intersect: a core tag has three segments, a sibling's has
four, and the framework forbids a `/` inside any name. That is a proof, and it is
counted anyway — the merge underneath is last-writer-wins, and a silently dropped
tag is a member that answers nothing with nobody told.

This whole shape is the framework's, end to end (juspay/kolu#2222, #2223):

| Where | What does it |
| --- | --- |
| server composes | `implementRootedSurfaces(core, base, deps)` — one call |
| server mounts a sibling | `runtime.mount(key, surface, deps)`, which hands back its own undo |
| server gates | `exposeRootedFaces(core, coreMap, siblings, siblingMaps)` |
| browser dials | `connectSurfaces({ core, surfaces })` — **one call**, watchdog included |

olai spelled all of it by hand for two PR windows and now spells none of it.
[`mechanics.test.ts`](../../packages/bundle/src/mechanics.test.ts) is the standing
lint that it stays that way.

**The roster MOVES**, which is why the serve side needed a door of its own. A
plugin is a fiber: it can fail, or be disposed, and its sibling goes with it. The
shape a consumer reaches for when the framework has no door — re-implement the
whole map over the survivors — silently forks every survivor's handler values,
cell stores, channels and running sources, and leaves an already-open connection
answering out of the previous copy. `mount` walks the ARRIVING sibling only.

A DROP is live all the way down: each of a sibling's tags is bound to a handler
that refuses from the instant of the drop, so a connection accepted before it
gets a `SurfaceSiblingDropped` defect on a new call and an in-flight subscription
dies with the same defect rather than hanging on a producer nobody drives. A
sibling ARRIVING after the listener has bound is the other half, and it is a
**reconnect**: `serveSurfaceApp` takes the group and the handlers at the moment it
listens, and `connectSurfaces` bakes its own at the dial. The roster cell moving
is what tells a browser to; `SurfacesConnection.redial(surfaces)` is what the
browser calls when it moves. `packages/web/src/client/wire.ts` holds that loop:
it dials with no siblings, reads the roster cell, loads exactly the named
browser halves, redials with their surfaces, and only then mounts their fibers —
so a fiber is never started over a wire that does not carry its sibling. A
second roster frame arriving mid-redial is queued behind the first rather than
starting a second redial on one connection.

---

## 7. Built vs default vs running

THREE lists, and the distance between them is the whole of what `--plugins` means.

```
  BUILT      what the binary carries      = every row in packages/bundle/olai.yml
  DEFAULT    what omitting the flag runs  = the rows without their own `disabled`
  RUNNING    what THIS serve mounted      = the fibers that reached ACTIVE
```

```
olai web ~/outlines                    # the built-in default
olai web ~/outlines --plugins=odu      # odu only
olai web ~/outlines --plugins=         # none — said out loud
```

...and the same three answers in nix, because a policy set by hand is a policy set
once and forgotten:

```nix
  services.olai.plugins = [ "odu" ];   # odu only
  services.olai.plugins = [ ];         # none
  # omit it                            — the built-in default
```

**The flag is a PATCH now, not a filter.** It writes a `disabled` onto every row
on the way in, through the loader's own include, so what an operator said and
what the build has stay two readable things rather than one list already
narrowed. A disabled row never mounts, which is the same absence `--plugins`
always meant — reached by the loader declining to load rather than by a
`.filter` in a general package.

**And that is also where the built-in DEFAULT lives.** A plugin that needs a
secret this machine may not have is off until somebody asks for it, and it says
so in its own row:

```yaml
- id: xyne-spaces
  name: olai-plugin-xyne-spaces/server
  disabled: true
```

The alternative was a `defaultOn: false` on the wire half — a field core reads to
build a default list — and the row wins because it is the SAME FIELD the patch
writes. One mechanism, two writers: the file says what the build does by
default, the patch says what the operator asked for, and there is no second
spelling for the two to disagree across. It also means turning an opt-in plugin
ON is not a special path: `--plugins=xyne-spaces` writes `disabled: false` over a
row the file set `true`, which is the same line that turns another row off.
[`rows.test.ts`](../../packages/bundle/src/rows.test.ts) holds both directions.

**RUNNING is read off the runtime, not off the flag.** It used to be
`isEnabled(pin, name)`, a second reading of what the operator typed, which was
exact while the filter ran once and nothing could move. A fiber can sit `PENDING`
on a service that never arrived, or land in `FAILED` because its `apply` threw,
and in both the flag still says yes while the wire carries no `surface/<name>/` at
all. The roster reports what is composed, and the cell is republished whenever
that changes.

**Omitting is not the same as listing everything.** Preferences draws a row per
built plugin and says either *the flag you gave* or *the built-in default* — a
value that had already expanded "nobody said" into the full list could not tell a
reader which of the two they were looking at. It is the git policy's shape, one
setting over.

An unknown name is refused **once**, at startup, with the legal words beside it. A
typo is never a silently disabled integration.

### Which vocabulary answers which question

This split matters and is easy to get backwards:

| Question | Judged against | Why |
| --- | --- | --- |
| Is `{"type":"kolu-terminal"}` a legal declaration? | **BUILT** | a file's verdict may not depend on a flag it cannot see |
| Does this value fit the kind? | **RUNNING** | `admits` is a promise only a plugin that is *here* can make |
| May this value's face draw? | **RUNNING** | see §8 |

So `{"type":"kolu-terminal"}` is a clean row on a machine running `--plugins=odu`, and
`{"type":"banana"}` is a broken file either way.

The two halves come from two places, and that is the shape rather than an
asymmetry to tidy: BUILT is read off every ROW's module — including the rows this
serve disabled, because a disabled row never mounts and its words have to be
reachable some other way — and RUNNING is the live `Kinds` registry, which holds
exactly what the plugins that mounted registered.

---

## 8. How a live property gets its face

This is the subtlest path in the system, and it is worth following end to end.

The difficulty: **a vault's declarations deliberately never travel to a browser**
(juspay/olai#395 — the tab receives *answers*, not rules). So the browser cannot
look at `_olai/Properties.olai` and decide anything.

```
  ┌─ THE DECLARATIONS, FOLDED ─────────────────────────────────────────┐
  │ the plugin's claim   kolu-terminal → kolu-terminal   (a default)   │
  │ the vault's row      pty           → kolu-terminal   (and it wins) │
  │ ── the record ─────────────────────────────────────────────────────│
  │ lanes.olai   {"title":"implement","custom":{"pty":"c56b6183"}}     │
  └────────────────────────────┬───────────────────────────────────────┘
                               │
  ┌─ THE SERVER ───────────────▼───────────────────────────────────────┐
  │  ONE consult, per drawn value  (@olai/format's meaning.ts)          │
  │                                                                     │
  │    (from, prop, value)  ──▶  { opens, word }                        │
  │                               │       │                             │
  │        what it NAMES ◀────────┘       └──▶ which running plugin's   │
  │        (a door)                            KIND claims it           │
  └────────────┬────────────────────────────────────┬──────────────────┘
               │                                    │
      ┌────────▼────────┐                  ┌────────▼────────┐
      │  doors  table   │                  │ licences table  │   ← both ride the
      │ from·prop·value │                  │ from·prop·value │     page stream
      │      → opens    │                  │      → word     │
      └────────┬────────┘                  └────────┬────────┘
               │                                    │
  ┌─ THE BROWSER ───────┴────────────────────────────┴──────────────────┐
  │  a chip becomes a link            dressingFor() looks the WORD up    │
  │                                   in the table plugins registered    │
  └─────────────────────────────────────────────────────────────────────┘
```

Read the flow as three sentences:

1. The vault declares a **key** to be a **kind**. The key may be called anything.
2. The server answers, per value it is about to send: *what does this name*, and
   *what word claims it*. One consult, because the same declaration decides both.
3. The browser looks the **word** up in the dressing table each plugin registered
   from its manifest.

**What travels is an answer about one drawn value** — never the declaration. A page
says which word claims each value it draws, and nothing about which keys the vault
declares or what a value on another page would answer. #395 is intact.

### Why this is worth a diagram

Because it was wrong for one PR window, in a way nothing could see. The dressing
table used to be keyed on the property **key**, because the key was all a tab had,
while the server's walk and value gate followed the declared **kind**. The two
agreed only while a vault happened to name its key after the kind. A vault
declaring `terminal` on a column called `pty` was walked, probed, gated — and drew
nothing at all.

> **The rule, stated once:** the declaration licenses the face — and a
> declaration is *the vault's row, or the enabled plugin's claim where the vault
> said nothing*, in that order. Never the key's spelling, and there is
> deliberately **no fallback** to it: a fallback would be the same defect kept
> alive under a second name. The claim is not one, because it is a declaration
> like any other and because a plugin can only ever claim a key carrying its own
> name.

One more thing the consult refuses: a value that does not **fit** the kind gets
no word. That is what makes a built-in claim safe to switch on — enabling a
plugin declares keys in vaults nobody migrated, and some of them hold prose
written before the plugin existed. Those stay exactly what they were: plain, no
door, no face, with the validator's own finding beside them. And no shape guess
either, which is this arm agreeing with every other declared one rather than a
second rule.

### The other licence

There are two, and they ask about two different plugins:

| Licence | Asks | Answered by |
| --- | --- | --- |
| the page's | is **this value** claimed by a kind word? | the consult above |
| the roster's | is this serve running the plugin that owns the **face**? | the `plugins` cell |

They are the same plugin for both of today's dressings, so the second looks
redundant. It is not, by one step: nothing says a dressing is registered by the
plugin that *taught* the vault the word. A plugin may dress another's kind, and
then the word is claimed while the face's owner is off.

### Drawing vs subscribing

The roster arrives on a frame, so there is a moment where the browser does not yet
know. The two answers point **opposite ways**, and the reason is what a wrong
guess costs:

| | Before the roster lands | Why |
| --- | --- | --- |
| **draw** a face | assume ON | a face drawn early and removed is a flicker |
| **mount** a plugin | assume OFF | a subscription to a sibling this serve did not compose fails **terminally** — the readout latches at `degraded` naming a plugin the operator turned off, for the life of the page |

---

## 9. What a disabled plugin is

**Absent.** Not parked, not half-wired, not degraded — and now at every moment
rather than only at boot.

```
  --plugins=odu   ⇒   kolu's row is patched `disabled` and never mounts

                      no sibling surface        no probe run
                      no wire tag               no chrome pill
                      no handler                no tab half mounted
                      no expose row             no dressing licensed
                      no surface/kolu/ at all   its kinds validate as plain text
                      no claimed key            (so no built-in declaration)
```

The outline it would have owned is an ordinary outline. The properties it would
have dressed draw as the text they always were — still stored, still greppable,
still editable. **The connection indicator stays green.**

This costs no mechanism, and that is the design's best property. It used to be
true because every composition door in the framework takes a plain keyed object
of surfaces, so `--plugins` was a filter over that object and nothing else. It is
true for a stronger reason now: **every registration a plugin makes is an effect
with its own undo**, so a fiber that is disposed drops its sibling, its kinds, its
wake declaration and its listeners in reverse, and the sentence above is as true
after the boot as during it. The old arrangement could only claim it at boot,
because the filter ran once.

A plugin whose `apply` THROWS is the same absence reached from the other side: the
fiber lands in `FAILED` having installed nothing, and every sibling stays ACTIVE.
A padi socket that is not there at boot can no longer be a server that will not
start.

And the degenerate case is the same code as every other: a runtime with **no**
plugins mounts no sibling on the rooted bundle, which leaves core's own surface
byte for byte what it was. That is what every `olai surface`, every headless MCP
face and every server test already runs as.

---

## 10. Adding a plugin

The whole checklist. Two of its artifacts live outside `packages/` (a symlink and
a docs line, step 4) and no GENERAL package changes at all, which is the claim
that matters.

0. **`packages/plugins/<name>/package.json`** — the package is called
   `olai-plugin-<name>`, unscoped, and the directory is the plugin word.
   `@olai/*` is the scope for the packages that ARE olai; a tenant is olai's
   judgement about somebody else's appliance, which is the closest thing in this
   tree to a plugin written outside it, so it is named the way one would be. It
   goes in `packages/plugins/` and nowhere else — that directory is the tenant
   container, held to the registry's roster in both directions by
   `fence.test.ts`'s ninth claim. Copy either tenant's manifest for the shape:
   `main`, `types`, a `typecheck` script, and an `exports` map of the five
   doors EVERY plugin has — `.`, `./server`, `./browser`, `./testids`,
   `./all.css` — plus `./wire` if you compose a sibling surface. An ENGINE does
   not (step 6). `./browser` is the one to get right: it is the subpath
   `packages/bundle/generate.ts` emits the tab's dynamic `import()` against, so a
   manifest without it generates a browser row that will not resolve. Declare
   `@olai/plugin-api` — the interface, which both halves import for the tags they
   name and the `definePlugin` that turns an Effect into a plugin — `effect`,
   your appliance's client, `@olai/format` if you walk the vault, `solid-js` if
   you draw, and **everything else your own sources import**: the isolated linker
   gives a member exactly what its manifest names, and `effect` resolving by
   walking up to the root is a hole rather than a shortcut. Never declare
   `@olai/bundle`, which imports you; never declare `@olai/effect-cordis` or
   `cordis`, which are the engine and are one package's business.
1. **`packages/plugins/<name>/src/wire.ts`** — `name`, a
   `defineSurface`, and the `faces` map. This file may not import SolidJS, an
   appliance client, or a `node:` builtin.

   AN ENGINE HAS NO SUCH FILE. What an engine contributes to a tab — a row of
   the picker, a name in the header, a sentence on the no-agent face — already
   travels on the chat cell, which is core's, so it composes no sibling surface
   at all and puts its `name` in `src/index.ts` instead. See step 6.
2. **`packages/plugins/<name>/src/server.ts`** — a `default` export of
   `definePlugin({ name, needs, apply })`, where `apply` is one Effect. This is
   where the appliance's client is called, where `Surfaces.register(...)` puts
   your sibling on the wire, where `Kinds.register(...)` teaches the vault a
   word, and where `Deliveries` is rung if the plugin has anything to say into a
   conversation. Yield each service you named; the compiler refuses one you did
   not. Register a `wake` or the strip draws no picker for you and `chat.scope`
   refuses your name — which is the gate working, not a bug. Add a link to
   `SessionStart` if you have a tool to probe for; register on `Agents` if what
   you are adding is an ACP ENGINE (step 6). Say your lines with
   `Effect.logDebug` and `Effect.logWarning`, which arrive with the level the
   operator asked for. If your appliance calls you back from a timer or a socket,
   take `detached` once and start your Effects through it. Everything you
   register comes back out when your plugin unloads, and you write no teardown
   for any of it — unless you hold something the runtime cannot see, which is an
   `Effect.addFinalizer` and is what `xyne-spaces` does for its mirrors.
3. **`packages/plugins/<name>/src/browser.tsx`** — the browser half, the same
   shape: a `name` and a `surface` re-exported off `./wire.ts`, and a `default`
   `definePlugin` whose Effect registers your faces into `Slots`. Browser graph,
   and its own chunk. An ENGINE re-exports only its `name` and registers TWO
   faces: its mark and its install sentence (step 6).
4. **`packages/plugins/<name>/docs.md`** — the user page, plus a
   symlink at `docs/plugins/<name>.md` and a line in `docs/index.md`.
   `packages/tests/plugin_docs.test.ts` fails if you skip either.
5. **ONE ROW in `packages/bundle/olai.yml`** — `id: <name>`, `name:
   olai-plugin-<name>/server`, and a `disabled: true` if your plugin needs a
   secret this machine may not have and should be off until `--plugins` names
   it. That is the whole of it: the browser's rows, the stylesheet chain and the
   merged testid table are WRITTEN from that row by `generate.ts`, so the four
   hand-edits this step used to list are gone. What you do still write is your
   own package's `exports` (`./wire`, `./server`, `./browser`, `./testids`,
   `./all.css` — the generator derives all four subpaths from the row's module
   name) and one line in `packages/bundle/package.json`'s `dependencies`,
   without which the generated `import()` does not resolve.

6. **IF IT IS AN ENGINE** — an ACP agent the chat panel can seat rather than an
   appliance olai has a judgement about — the shape is smaller and the rules are
   the same. There is no `./wire`, no surface and no `faces`: `src/index.ts` is
   the plugin's word and nothing else. `src/leg.ts` is a `Leg`
   (`@olai/acp/engine`) — every bet about that agent's wire, each a pure function
   with a unit test, each safe to lose in ONE direction: an agent that says none
   of it matches nothing, and what happens then is that a person is asked.
   `src/server.ts` registers `{ name, leg, at, prompt }` on `Agents`: what a
   person reads, the leg, a probe that answers `Adapter | null` for this host,
   and the channel the standing prompt rides. NOT the install sentence — it rode
   this registration once, read by nothing, because the face that draws it is
   your BROWSER half's. `src/browser.tsx` hangs TWO faces, and both are
   drawings ABOUT this engine rather than data about it: its MARK
   (`delivery.mark`) and its SENTENCE on the face drawn when the machine has
   no agent at all (`engine.install`, which takes a `NotHere` VALUE rather
   than a drawing: core owns every stroke of that row and you own every word).
   Core keeps the shape of each — the
   sixteen-unit box, the list, the order — and neither drawing crosses the wire,
   so `--plugins` naming other engines draws a panel with nothing of yours
   anywhere in it. Spell the install sentence in a `src/install.ts` your browser
   half opens — a `NotHere` (`@olai/plugin-api`), whose `why` is a WHOLE SENTENCE
   core composes no clause of.

   THERE IS NO FACE FOR THE PICKER'S ROW, and the omission is a ruling. The
   words in that row are your engine's `name`, which the server already sends
   per installed agent on the chat cell — so a slot for them would be one string
   with two authored sources. A slot is for what core CANNOT compose: a `<g>`,
   a sentence about getting your tool. Not a name it was handed.

   Its `testids` table is legitimately empty — an engine
   draws inside core's own elements, under core's own ids, with `data-agent`
   carrying its word. And if olai SHIPS an
   adapter for it, its volatile packaging belongs in
   `packages/plugins/<name>/acp/`: patches and their rigs in every case, and a
   standalone lock and derivation when the adapter has its own release and
   platform clock (Codex). The older Claude/Pi pair still shares the root
   `acp/` shim and the rows in `nix/acp-agent.nix`; that directory's README
   states the shared reason.

   THE ORDER OF THE ENGINE ROWS IS LOAD-BEARING, unlike a tenant's: it is the
   order the picker draws and the order the install face lists, and the FIRST
   row is what a conversation note that names no agent at all is read as being
   about.

Then run `bun test packages/bundle` and let the fence tell you what you got
wrong. It will be specific.

Everything in steps 1–3 but the name and the surface is **optional**. A plugin
that contributes one cell is a whole plugin — odu is. The absent arm of every hook
is the state a machine without the tool already shows, and that state already had
to work.

---

## 11. Where the rules are actually enforced

Every claim on this page is a test, not a paragraph. If you break one, the failure
names the file.

| File | Holds |
| --- | --- |
| `packages/bundle/src/fence.test.ts` | no general package **imports** a plugin (four grammars: imports, `scanImports`, CSS `@import`, manifests) — no general package **spells** one in production code — a plugin imports the INTERFACE and never the REGISTRY, and does import the interface — the services door pulls no browser face — and `packages/plugins/` holds the tenants and nothing else, both directions |
| `scripts/prove-fence.sh` | the fence and the mechanics lint go RED when they should. Not a `just check` leg: it mutates tracked files and puts them back, and `check` runs its legs in parallel. Run it when the fence CHANGES — a sweep's one failure mode is going quiet, and a fence that stopped running looks exactly like a fence that is holding |
| `packages/bundle/src/mechanics.test.ts` | olai names no wire mechanic the framework performs |
| `packages/bundle/src/tree.testlib.ts` | not a claim — the READING both of the above stand on (workspace members, manifests, sources, the module graph). Split out so the two files above are their claims and nothing else, and so the source walk is written once |
| `packages/bundle/src/report.test.ts` | what became of each row, off a real runtime: a row nothing mounted reads `off`, one whose `apply` failed reads `failed` and carries the plugin's own message verbatim, one short of a service it names reads `waiting` — the words the preferences row's five are composed from |
| `packages/bundle/src/kinds.test.ts` | the word a vault declares is composed from the PLUGIN's own name; a word leaves the vocabulary when its plugin unloads; the BUILT half carries every row's words whatever the flag said |
| `packages/bundle/src/composition.test.ts` | an empty roster composes, core's tags do not move, and — the two claims that need the modules LOADED — every module answers to the name its row binds it under, and every face a plugin declares is a face it wrote a map for. There is no `rosters.test.ts` any more: it held three hand-written lists equal, and two of the three are generated from the third |
| `packages/bundle/src/testids.test.ts` | the plugins’ testid tables are disjoint — and one layer further out, `packages/web/src/client/testids.test.ts` holds the app’s own table disjoint from theirs, which is the seam `selector()` actually spends |
| `packages/plugins/kolu/src/testids.ts` | a tenant’s two testid halves share no key and no value — a TYPE-level assertion, so a collision is a `tsc` error naming the offender rather than a test somebody keeps green |
| `packages/plugins/kolu/src/faces.test.ts` | the tenant’s own two face directories stay apart — `src/browser/` names no part of the appliance’s tier, and `src/appliance/` names none of the vault’s vocabulary, which is the wall `@olai/kolu-ui`’s manifest kept before the fold. In the TENANT, not in the fence: a per-directory rule up there would be the fence inventing a layout convention and enforcing its own invention |
| `packages/tests/plugin_docs.test.ts` | every plugin's docs page exists, is served, and is linked |
| `packages/server/src/faces.test.ts` | `chat.scope` is named on the **browser** face and nowhere else — the agent face is pinned as an exact set, so an agent-settable doorbell is a red suite rather than a rule somebody has to remember |
| `packages/server/src/runtime.test.ts` | a `wake` sentence reaches the roster only for a plugin this serve MOUNTED, so no picker is offered for a doorbell nothing would ring — and a plugin the flag left on that nothing mounted draws as off, which is the row the old derivation could not express |
| `packages/plugins/chat/src/deliveries.test.ts` | a body delivered mid-turn is HELD and the conversation keeps its interruption — the one claim a machine speaking into a person's lane could quietly cost them |
| `scripts/check-hydrated-deps.sh` | the appliance dependency walls, per pin — kolu, odu, and cordis |
| `packages/effect-cordis/src/plugin.test.ts` | the bridge itself, on TOY services and with no olai noun in the file: a plugin sits `waiting` until the service it names is provided, its finalizers run in reverse when it unloads, a REPLACED provider re-runs it, a plugin whose Effect dies lands `failed` having installed nothing with its siblings untouched, and the stamp a keyed service is minted with is the word the registry bound it under |

---

## See also

- [`packages/bundle/README.md`](../../packages/bundle/README.md) — the same
  subject at implementation depth.
- [architecture.md](../architecture.md) — how every package fits, plugins included.
- [live-properties.md](../live-properties.md) — the user-facing half of §8.
- [running.md](../running.md) — `--plugins` as an operator sees it.
