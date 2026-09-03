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

**`waterfall(key)`** — around-middleware as Effects. A link is handed the value
and a `next`; returning without calling through short-circuits, which is the half
a plain event bus cannot express. A link that DIES is contained here, said on the
owner's channel with the plugin's own word on the line, and the chain carries on —
which the engine's own dispatcher could not do, because its `emit` is a bare
`Reflect.apply` loop with no `try` in it.

**`detached`** — the one seam across the boundary, named once so it is not
re-invented per plugin. What drives a plugin at runtime is frequently not Effect:
an appliance's watcher fires a callback, a timer beats, a socket says something,
and those libraries are not olai's and are not wrapped. This is where an Effect is
started from a plain function — under the plugin's own services, so a line carries
the level the operator asked for, and forked onto the plugin's own scope, so work
in flight when it unloads goes with it.

## Two doors, because two graphs

| door | what it carries |
| --- | --- |
| `.` | the RUNTIME: a host, `provide`, `mountPlugin`, `rowReport`, `definePlugin`, `serviceTag`, `waterfall`, `detached`. This is what the TAB opens too, because a browser half is a plugin exactly as a server half is |
| `./loader` | `mountRows` — a declarative bundle, through `@cordisjs/plugin-loader` and `-include` |

The split is not tidiness. The loader reads a file off a disk and resolves module
specifiers, so it carries `node:url`, `node:fs` and a YAML parser. Behind one door
a tab's chunk would carry all of it, and it does not fail at a boundary claim — it
fails at `bun build`, on `Browser polyfill for module "node:url" doesn't have a
matching export named "pathToFileURL"`.

## What is deliberately NOT here

**An opinion about what a plugin is.** This package knows about scopes, keys, rows
and a waterfall; it has never heard of a vault, a surface or a doorbell.
[`src/plugin.test.ts`](src/plugin.test.ts) is written with toy services and has no
olai noun in it. The moment something here grows one, it belongs in
[`@olai/plugin-api`](../plugin-api/README.md), which is the package on the other
side of exactly that line.

**`eventStream`.** The phase's design lists it beside `waterfall`, and it is not
built: olai has no fire-and-forget plugin event left to translate. The two vault
emits became doors, `surfaces/published` was declared and never fired and is gone,
and the one event that remains is a waterfall. It arrives the day something needs
it, rather than as an unused arm with a test written to keep it alive.

## Where the pin's instability lives

Here, and nowhere else. `cordis` and `@cordisjs/plugin-*` are hydrated from an
npins pin (`nix/cordis.nix`) into the ROOT `node_modules` the way every `@kolu/*`
member is; `scripts/check-hydrated-deps.sh` holds their versions, and the fence
holds the fact that this package is the only one allowed to name them. A pin bump
that moves the API changes this package and nothing else.

Two couplings are worth a reviewer's eye at a bump, and both are spelled where
they are made: the module-resolution seam `mountRows` fills
([`src/loader.ts`](src/loader.ts) — verified against
`@cordisjs/plugin-loader@1.0.0-rc.6`, and a cast, so a moved slot fails at RUNTIME
rather than at typecheck), and the `FiberState` reading `rowReport` collapses into
four words ([`src/host.ts`](src/host.ts)).
