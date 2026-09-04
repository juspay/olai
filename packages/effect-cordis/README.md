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

This ownership has one explicit pin coupling in `src/lifecycle.ts`: the bridge
removes `ctx.provide`'s disposer from the fiber's `_disposables` and becomes its
only caller. Leaving it in that set would run revocation concurrently with scope
close; calling its guarded wrapper twice cannot join the first revocation. The
ordering tests use the provider's resource from asynchronous dependent cleanup,
not just the fibers' state words. A checked disposer handoff fails immediately
if the pin stops registering that disposer in the expected set. The activation
handle owns this ordering and cancellation; plugin configuration and service
resolution cannot mutate its lifecycle bookkeeping.

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

Three couplings are worth a reviewer's eye at a bump, and each is spelled where
it is made: the module-resolution seam `mountRows` fills
([`src/loader.ts`](src/loader.ts) — verified against
`@cordisjs/plugin-loader@1.0.0-rc.6`, and a cast, so a moved slot fails at RUNTIME
rather than at typecheck); the `FiberState` reading `rowReport` collapses into
four words ([`src/host.ts`](src/host.ts)); and `settled`'s reading of a fiber's
`inertia` as the runtime's own record of movement, which is a claim that the
field is CLEARED when a transition finishes. That last one is bounded rather than
trusted — a revision that left a settled promise on the field turns the loop into
a warning and a slow boot instead of a hang at every start — and the bound is
argued beside it.
