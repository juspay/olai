# @olai/effect-cordis — Cordis, in Effect's words

olai is written in [Effect](https://effect.website). The plugin runtime under it
is [Cordis](https://github.com/cordiverse/cordis). **This is the only package in
the tree that names Cordis**, and `@olai/bundle`'s
[`fence.test.ts`](../bundle/src/fence.test.ts) holds that as an equality —
`scripts/prove-fence.sh`'s mutation 16 is what proves the claim is not asleep.

## Why there is a package here at all

The reactive half of a plugin system — a plugin held `waiting` until the services
it names exist, unloaded when one leaves, re-applied when it comes back, mounted
from a config row a loader reads — is a large, proved thing that is not worth
writing again over `Scope`. So Cordis stays.

What that left, for one phase, was two runtimes meeting in the open: the
composition root wrapped runtime calls in `Effect.promise`, the services called
back into Effect through captured emitters (`ring(Effect.logWarning(line))`), and
plugin bodies were plain TypeScript that reached into Effect by hand. Each of
those is an escape hatch, and every new plugin copies the ones it can see.

So the meeting happens once, here.

## The translation, in four pieces

**`serviceTag(key)`** — one value that is both an Effect `Context` tag and the
Cordis key it is provided from. That is what makes `needs` and the requirement
channel ONE declaration: `definePlugin` derives the `inject` array from the same
list the compiler derives `R` from, so a plugin that yields a tag it did not name
is a `tsc` error at its own definition rather than a `PENDING` fiber at runtime.

What sits behind a key is a **`Provision`** — a function from the plugin's own
word to that plugin's view of the service — which the facade calls once, with the
name it read off the fiber. A service with a per-plugin fence closes over the word
there and can then have no method that takes it as a parameter, which is what
makes "a plugin cannot sign another plugin's registration" a shape rather than a
rule.

**`definePlugin({ name, needs, apply })`** — `apply` is one Effect. The facade
opens a `Scope` when the plugin activates, runs the Effect inside it, and hands
the runtime a disposer that closes it. Effect's `Scope` and the paper's
accumulator are the same idea, spelled twice; there is one of them here, and a
plugin author never sees `ctx.effect`. A plugin whose Effect DIES has its scope
closed with that exit — every finalizer it had already installed runs, in reverse
— and the failure is re-thrown into the runtime, which lands it `failed` with its
siblings running.

Initialization runs on an Effect fiber kept by the bridge. `apply` still awaits
it, so Cordis marks the plugin ACTIVE only after initialization succeeds. A
stop, a loader flip, host close, or withdrawal of a required service interrupts
that work and closes its scope. Interruption alone is not a failure: explicit
stop reads `off`; dependency withdrawal reads `waiting` with the missing key,
and the plugin initializes again when that service returns. Cancellation is
cooperative: it reaches interruptible Effect yields, cannot preempt synchronous
JavaScript, and waits for uninterruptible acquisition and finalizers.

**`offer(key, provision)`** provides on the calling plugin's fiber, carried in
its Effect environment. Consumers cannot see the provision until the provider
is ACTIVE; failed initialization activates none. Cordis owns duplicate refusal
and identifies the existing provider. The bridge recognizes the pinned
runtime's duplicate error as `OfferConflict`, so the API supplies its own
sentence without relabeling unrelated lifecycle defects. The bridge revokes every offer and joins
dependent cleanup **before** closing any of the provider's resource finalizers,
including finalizers registered after the offer. During host shutdown it also
joins departing activations already removed from Cordis's registry.

This ownership has two explicit pin couplings in `src/lifecycle.ts`. The first:
the bridge removes `ctx.provide`'s disposer from the fiber's `_disposables` and
becomes its only caller. Leaving it in that set would run revocation
concurrently with scope close; calling its guarded wrapper twice cannot join the
first revocation. The ordering tests use the provider's resource from
asynchronous dependent cleanup, not just the fibers' state words. A checked
disposer handoff fails immediately if the pin stops registering that disposer in
the expected set. The second: the pinned runtime carries the existing provider's
identity in the PROSE of its refusal, so the bridge matches that sentence and
slices the owner out of it. `src/lifecycle.test.ts` asserts the wording verbatim
beside the owner it yields, so a reworded refusal fails in this package rather
than as a composed sentence losing a name one package over; `nix/cordis.nix`
carries the upstream ask for a typed error. The activation handle owns this
ordering and cancellation; plugin configuration and service resolution cannot
mutate its lifecycle bookkeeping.

**`openHost` / `closeHost(host)`** own the whole registry. Opening is scoped;
closing is idempotent and waits for loading initializers, background work and
asynchronous cleanup, including plugins with empty `needs`. Cordis implements
root disposal as a restart, leaving an empty ACTIVE root; the bridge remembers
closure and refuses subsequent mounts. The server and tab
inherit this lifetime through `openPlugins` and `openApp`. Direct mounting
normally waits for initialization; `mountPlugin(host, plugin, { wait: false })`
returns the stop handle immediately. Dynamic plugins use that form so a hung
initializer cannot block the stop command. `hostChanges` emits an initial
notification and subsequent status transitions, allowing the host to publish
readiness or failure when initialization finishes later.

**`broadcast(what)` and `waterfall(key)`** — the two dispatch modes. A BROADCAST
tells every handler, in subscription order, and AWAITS all of them: the caller
rings it from inside a statement whose next lines assume every plugin has already
re-derived. A WATERFALL threads the payload through with a `next`, so a link may
transform what the ones after it see or decline to call through. Either way a
link that DIES is contained, said on the owner's channel with the plugin's own
word on the line and the same sentence for both modes (`failed`), and the rest
carry on — which the engine's own dispatcher could not do, because its `emit` is
a bare `Reflect.apply` loop with no `try` in it.

"The rest carry on" is exact in the waterfall, and turns on whether the dying
link had called through. One that died BEFORE `next` has not consulted the ones
after it, so the chain resumes at the next link with the value this one was
handed: one plugin's broken listener is one plugin's absence, and not also
everybody registered behind it — which would otherwise depend on a registration
order that races. One that died AFTER `next` has already had its answer and the
rest have already run, so they are not asked again; the value comes back as the
dying link was handed it, because a half-transformed value is not something to
pass on.

**`detached`** — the one seam across the boundary, named once so it is not
re-invented per plugin. What drives a plugin at runtime is frequently not Effect:
an appliance's watcher fires a callback, a timer beats, a socket says something,
and those libraries are not olai's and are not wrapped. This is where an Effect is
started from a plain function — under the plugin's own services, so a line carries
the level the operator asked for, and forked onto the plugin's own scope, so work
in flight when it unloads goes with it.

One fiber per call, so two calls are not ordered: the caller has no fiber for a
second one to be a continuation of. That is what the appliances spend it on —
chatter, where each line stands alone — and where an order is load-bearing the
answer is one Effect that does both things rather than two calls.

## ...and one verb that translates nothing

**`settled(host, rows)`** is a composition root's, not a plugin author's, and it
is here because it reads a fiber's `inertia` — the runtime's own record that a
row is mid-reload or mid-unload — which no other package may name. Mounting a
bundle awaits each row's module and the creation of its fiber; it does not await
the fiber, and the loader's own `await()` walks a tree the rows were never linked
into. That was harmless while every row's `apply` finished inside the mount's own
microtask chain, and stops being harmless the moment one ROW provides a service
another row names: the second row is woken a turn later, so a caller reading the
kind registry on the next line reads it a plugin short, silently and for the life
of the process.

So `settled` waits out MOVEMENT, with bounded passes between transitions, and
decides nothing. The bound is not an initialization timeout: a caller still
waits for each transition until it finishes or is cancelled. A row still `waiting` when it returns is waiting
on a key nothing in this build offers, which is a legitimate resting state and is
what `rowReport` is about to say.

## Two doors, because two graphs

| door | what it carries |
| --- | --- |
| `.` | the RUNTIME: a scoped host, `closeHost`, `hostChanges`, `provide`, `offer`, `mountPlugin`, `settled`, `rowReport`, `definePlugin`, `serviceTag`, `broadcast`, `waterfall`, `detached` |
| `./loader` | `mountRows` — a declarative bundle, through `@cordisjs/plugin-loader` and `-include` |

The split is not tidiness. The loader reads a file off a disk and resolves module
specifiers, so it carries `node:url`, `node:fs` and a YAML parser. Behind one door
a tab's chunk would carry all of it, and it does not fail at a boundary claim — it
fails at `bun build`, on `Browser polyfill for module "node:url" doesn't have a
matching export named "pathToFileURL"`.

**Who opens them.** The root door's importer is
[`@olai/plugin-api`](../plugin-api/README.md), whose `src/runtime.ts` re-exports
the runtime list verbatim onto both of its own doors — so a plugin, a tab and a
composition root all spend the same names from the same place, and what the
bridge keeps back (`openHost`, `closeHost`, `provide`, `offer`, `hostChanges`, `settled`) is what could mint a host,
mint a service, or make a plugin wait on its own siblings. `@olai/bundle` opens
both doors directly: `./loader` for the graph reason above, and the root door for
`settled` alone, which it spends beside `mountRows` in one function
(`src/bundle.ts`'s `mountBundle`) because the two of them are one promise.

## What is deliberately NOT here

**An opinion about what a plugin is.** This package knows about scopes, keys, rows
and a waterfall; it has never heard of a vault, a surface or a doorbell.
[`src/plugin.test.ts`](src/plugin.test.ts) is written with toy services and has no
olai noun in it. The moment something here grows one, it belongs in
[`@olai/plugin-api`](../plugin-api/README.md), which is the package on the other
side of exactly that line.

**Nothing, now that `broadcast` has landed.** The phase's design listed
`eventStream` beside `waterfall`, and this package shipped the waterfall and
declined the emit, on the stated grounds that olai had no fire-and-forget plugin
event left to translate. That was wrong in the way a survey is wrong:
`@olai/plugin-api` had three of them — a vault revision, the store going quiet, a
conversation event — each hand-rolled beside the others, so the count came out at
zero because nobody had a name to count. `broadcast` is that name, and the three
doors are declarations now.

## Where the pin's instability lives

Here, and nowhere else. `cordis` and `@cordisjs/plugin-*` are hydrated from an
npins pin (`nix/cordis.nix`) into the ROOT `node_modules` the way every `@kolu/*`
member is; `scripts/check-hydrated-deps.sh` holds their versions, and the fence
holds the fact that this package is the only one allowed to name them. A pin bump
that moves the API changes this package and nothing else.

### The three kinds, because "private" is the wrong axis

The pin declares its API unstable outright and ships no reference documentation,
so "public" and "private" do not sort these. What sorts them is WHAT WOULD
NOTICE a change:

1. **Exported and typed** — `Context`, `FiberState`, `ctx.provide`,
   `fiber.await`, the loader's config shapes. A revision that moved one of these
   is red in this package's own `tsc`, which is the cheapest possible failure
   and needs no list.
2. **Reachable but underscored, or absent from the index** — `fiber._disposables`,
   `fiber.uid`, `Impl`. Legal to touch, unlisted, and typed only by accident.
3. **Behaviour with no type at all** — the concurrency of an unload, an ordering,
   the wording of an error, when an event fires relative to a field being set.
   THESE ARE THE ONLY ONES THAT CAN DRIFT GREEN, and they are why this section
   is a table rather than a paragraph.

Each coupling is argued where it is MADE; this is the index, not a second copy.

### The inventory

| what the bridge assumes | where it assumes it | what the pin does | how drift shows |
| --- | --- | --- | --- |
| a fiber's disposers are unloaded CONCURRENTLY, so a disposer that joins dependents may not sit beside the one closing their resources | [`src/lifecycle.ts`](src/lifecycle.ts)'s `close` | `Fiber._unload` is one `Promise.all` over the set | [`src/upstream.test.ts`](src/upstream.test.ts) asks the runtime directly; [`src/lifecycle.test.ts`](src/lifecycle.test.ts)'s dependent-cleanup cases go red |
| ...and the same fact is why a bus registration's STOP is the activation's rather than the scope's: a scope orders finalizers by registration and a `listen` has no say in where a plugin acquires its resources | [`src/lifecycle.ts`](src/lifecycle.ts)'s `Quieting`, [`src/gate.ts`](src/gate.ts) | nothing upstream; this is olai's own staging | [`src/lifecycle.test.ts`](src/lifecycle.test.ts) asks it with a resource registered on either side of the `listen` |
| `ctx.provide` answers with the very disposer it pushed, so the bridge can take it out of that set and become its only caller | [`src/lifecycle.ts`](src/lifecycle.ts)'s `offer` | pushes an epoch-guarded wrapper and returns it; a second call through the wrapper joins nothing | CHECKED — the offer throws, naming the pin, rather than failing later inside a dependent's cleanup |
| the duplicate-provider refusal carries the owning fiber's name in its PROSE | [`src/lifecycle.ts`](src/lifecycle.ts)'s `offer` | a plain `Error`: `service "x" has been registered at <owner>` | [`src/lifecycle.test.ts`](src/lifecycle.test.ts) asserts the wording verbatim beside the owner it yields |
| a fiber's `store` is the impls it injects, snapshot-able at activation | [`src/lifecycle.ts`](src/lifecycle.ts)'s `activate` | `Impl` is not exported from the index | SILENT — dependents stop being joined |
| the registry entry is removed BEFORE asynchronous cleanup ends | [`src/lifecycle.ts`](src/lifecycle.ts)'s live table, [`src/host.ts`](src/host.ts)'s `closeHost` | a disposing fiber leaves the registry first | [`src/lifecycle.test.ts`](src/lifecycle.test.ts) — "host close joins cleanup that already left the registry" |
| `uid === null` means disposed | [`src/plugin.ts`](src/plugin.ts), [`src/lifecycle.ts`](src/lifecycle.ts), [`src/host.ts`](src/host.ts) | set when the fiber leaves | interruption stops reaching a disposing fiber |
| `inertia` is set across a transition and CLEARED when it ends | [`src/host.ts`](src/host.ts)'s `settled`, [`src/loader.ts`](src/loader.ts)'s flip | a promise on the fiber while it moves | BOUNDED — a pass limit turns a hang into a warning and a slow boot, argued beside it |
| `FiberState`'s six states collapse into four honest words | [`src/host.ts`](src/host.ts)'s `rowReport` | an enum | HALF RED — renaming or removing one of the four handled members is a type error; a state ADDED falls into the reading's `default` and draws that row as `off` in silence |
| `loader.internal` is a slot with exactly one method called on it | [`src/loader.ts`](src/loader.ts) — verified against `@cordisjs/plugin-loader@1.0.0-rc.6` | upstream's slot for Node's own `ModuleLoader`, left `undefined` under bun; only `.import` is ever called, never the `version` beside it | RUNTIME, not typecheck — the cast is what makes the assignment legal at all |
| `loader/entry-init` fires from the `Entry` constructor, before its options exist | [`src/loader.ts`](src/loader.ts) | the event is emitted by the constructor | rows collected with no id; a flip answers `false` |
| disabling a row before disposing it keeps the loader from rewriting the bundle file | [`src/loader.ts`](src/loader.ts)'s `flipRow` | the update arm reads `disabled` first | [`src/lifecycle.test.ts`](src/lifecycle.test.ts) asserts the file's bytes are unchanged |
| `ctx.loader.await()` walks the LOADER's tree, which the include's rows were never linked into | [`src/loader.ts`](src/loader.ts)'s header, [`src/host.ts`](src/host.ts)'s `fibersOf` | the include is an `EntryTree` mounted as an ordinary plugin | SILENT — `settled` is the real guarantee, and is why it exists |
| a symbol key on the reflect proxy passes straight through to the object | [`src/host.ts`](src/host.ts), [`src/loader.ts`](src/loader.ts), [`src/module.ts`](src/module.ts) | the proxy routes strings, not symbols | a host, or a row list, becomes a service a plugin could name |
| the root fiber's `dispose()` is a RESTART, leaving an empty ACTIVE root | [`src/host.ts`](src/host.ts)'s `closeHost` | disposal of the root re-enters it | a mount after close succeeds, which `mountPlugin` refuses by remembering |

Three of the four upstream ASKS in `nix/cordis.nix` come from this list — the
resolver seam, the untyped duplicate error and the concurrent unload — so a bump
has one place to look for what olai wants the pin to grow. The fourth, the
strictness delta behind the `@ts-nocheck` stamp, is about how the pin is
HYDRATED rather than about anything the bridge assumes at runtime, and is
argued there alone.

### Two things this package does NOT claim

**Initialization cancellation is olai's, not the paper's.** A plugin whose start
is stopped mid-flight — by a switch, by a withdrawal, by host close — has its
Effect fiber interrupted and its scope closed with that exit. That is an
Effect-backed adaptation this bridge adds; it is not a property the paper's
inertial asynchronous model hands over, and the pin has no equivalent. What the
pin owns is readiness and reactive reload; what this owns is that stopping
mid-start unwinds exactly what had been installed.

**A recorded inverse is not a proved one.** The bridge holds an author's cleanup
actions and runs them in reverse, on the right occasion, in the right order
relative to dependents. It cannot check that a release is genuinely the inverse
of its acquisition, and it cannot establish that two plugins' shared operations
commute. Those are properties of what authors wrote; the accumulator is a place
to put them, not a proof about them.

A loaded module may export `components`, a record of independently injected
plugins beside its default plugin. The loader creates one scoped container and
mounts the default as `main` plus each named component. Components retain the
row's service authority, can supply dependencies to one another, and are disposed
with the row. Names use lowercase words separated by hyphens; `main` is reserved.
Reports and settling include every child, so a missing or failed component cannot
be concealed by a running container. Asynchronous cleanup is joined on row
withdrawal, including interrupted initializers.
