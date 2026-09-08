# Cordis in Olai: dependencies, ownership and removal

Olai should let a plugin stop or be replaced without leaving its work running,
using a departed service, or disturbing unrelated plugins. Cordis provides the
composition model; Olai's Effect bridge, services and plugin implementations
must make that promise real.

This guide explains the architecture established through [PR #554](https://github.com/juspay/olai/pull/554)
and [PR #557](https://github.com/juspay/olai/pull/557), including the mistakes
caught during review. It describes the merged design, not a claim of formal
verification or a plan for future routing and layout changes.

- [The principle, in ordinary terms](#the-principle-in-ordinary-terms)
- [Imports are not live dependencies](#imports-are-not-live-dependencies)
- [Choose the owner before the helper](#choose-the-owner-before-the-helper)
- [Optional features need an explicit design](#optional-features-need-an-explicit-design)
- [Stopping is a protocol](#stopping-is-a-protocol)
- [Acquisition and external effects](#acquisition-and-external-effects)
- [Browser state and reconnection](#browser-state-and-reconnection)
- [Refactors, enforcement and evidence](#refactors-enforcement-and-evidence)

## The principle, in ordinary terms

The [Cordis paper](https://arxiv.org/abs/2608.25512) separates two concerns:
**spatial composability**, declaring and reactively managing dependencies, and
**temporal composability**, undoing a component's effects when it leaves.
An effect registers a change and its inverse; a coeffect describes what a
component needs from its context. Together they explain when a component may
run and what must happen when it stops.

In Olai, imagine chat using outline references. Chat's reference integration
needs the outline-reference service. If outlines leaves, that integration
stops and releases its reading. Chat's unrelated conversations need not stop.
When the service returns, the integration acquires the new value.

The useful question is therefore not just “is this code in a plugin?” It is:
**who owns this value or work, who depends on it, and what happens when either
side leaves?**

Some vocabulary used in the code:

| Term | Meaning in Olai |
| --- | --- |
| Plugin row | A selectable bundle entry, potentially containing several components. |
| Component | A separately activated integration with its own declared needs. |
| Activation | One run of that component, with its acquired values and cleanup. A restart creates a new one. |
| Service | A named capability supplied by an owner and acquired through declared dependencies. |
| Scope | The lifetime that records cleanup and joins its owned work. |
| Contract door | A public package export permitted for other packages to import. Export permission alone does not establish ownership. |
| Broker | An owned service whose contract deliberately handles changing availability behind it. |

The layers have different jobs:

| Layer | Responsibility |
| --- | --- |
| [Cordis](https://github.com/cordiverse/cordis) | Dependency resolution, readiness and reactive component activation. |
| [Effect bridge](../../packages/effect-cordis/README.md) | Olai's scoped initialization, interruption, dispatch and teardown coordination. |
| [Plugin API](../../packages/plugin-api/README.md) | Olai's capability contracts and composition interfaces. |
| Bundle and hosts | Select implementations and provide host-owned capabilities. |
| Plugins | Implement features, declare their needs and supply correct cleanup. |

A recorded cleanup action is not proof that it correctly reverses the change.
Neither Cordis nor the bridge can establish that arbitrary application writes
are safe to interleave. Those remain obligations of the implementation.

## Imports are not live dependencies

A plugin may import another plugin's **static contract**. For example:

```ts
import type { Directory } from "olai-plugin-vault/file-state"
```

This describes a value; it neither obtains the current directory nor keeps the
vault alive. Pure functions, service keys and inert lookup tables can also be
valid imports. A runtime import is not automatically a lifecycle dependency.

By contrast, exporting a module variable containing the current directory
would let consumers read an activation's state without declaring that they
need its owner. A separate “ready” service does not repair this: Cordis must
mediate access to the actual capability, not merely its announcement.

Olai's pattern is to declare `vault.files`, receive its value in the consuming
activation, and release any retained reference with that activation. See
[capture's browser integration](../../packages/plugins/capture/src/browser.tsx)
and the [vault contract](../../packages/plugins/vault/src/contract.ts).

This rule applies across **package boundaries**, including general packages
such as `@olai/web`; it is not confined to plugin-to-plugin imports. Moving a
shared mutable table into a utility package does not give it an owner.

Likewise, consumers read contributions through declared `Faces` or renderer
services. They do not import private browser composition machinery to discover
what other plugins mounted. Package exports restrict access, while declared
services establish the lifetime relationship.

## Choose the owner before the helper

The owner is the entity whose departure should end the resource or work. It
might be a host, plugin activation, integration component, node session,
rendered pane or individual operation. The broadest available scope is often
the wrong one: a terminal observer should end when its pane closes, not merely
when its entire plugin eventually stops.

Two examples distinguish reusable implementation from shared live state:

- Each browser app receives its own `Edits` registry. Two apps must not route
  edits through one module-global table. See [the browser host](../../packages/plugin-api/src/browser.ts).
- Each vault setup creates its own optional ledger/search table through
  `openViews()`. Starting a second host must not replace the first host's
  providers. See [VaultViews](../../packages/plugins/vault/src/views.ts).

A factory can safely cross a package boundary while allocating independent
state for each caller. The shared [heldWrites](../../packages/web/src/client/writes.ts)
and [heldFiles](../../packages/plugins/vault/src/browser/state.ts) factories
replace duplicated algorithms; their private consumers still create separate
holders. Neither factory locates a service on the caller's behalf.

A holder is a convenience for reaching a value already acquired by an
activation, not an alternative to declaring that dependency. Its release must
remove **its own installation**, without clearing a later installation. Olai's
[heldService](../../packages/ui-primitives/src/held.ts) uses a fresh token per
hold: comparing service values alone is insufficient when two activations can
hold the same object.

Tokens also do not make one slot suitable for two independent consumers.
Navigation's renderer and palette needed separate `heldFaces` holders because
they stop independently. Correct cleanup of one shared slot could still leave
the surviving consumer with nothing. See [navigation's holders](../../packages/plugins/navigation/src/faces.ts).

## Optional features need an explicit design

Adding every reachable service to a row's mandatory `needs` is not the goal.
The vault must work without git; MCP must work without a vault. Three designs
cover different relationships:

| Relationship | Design |
| --- | --- |
| An integration cannot run without a service | Declare it on that component. Keep independent work outside that component. |
| Optional providers can register into their consumer | Give the consumer an owned registration service, as with `VaultViews`. |
| The consumer must stay available while backing providers change | Use a narrow, declared broker with explicit absence and replacement behavior, as with `Served` or `Wired`. |

An unrestricted service locator hides the real graph, even if the locator
itself is declared. A broker earns its boundary by exposing a specific
capability and owning its availability policy; it is not a renamed
`current(anyKey)` escape hatch.

Components are not a mechanical solution either. Olai folds component status
into row reports. A component waiting forever for an optional provider can
change the row's reported readiness and what clients load. `VaultViews`
registration avoids making the vault wait for git or search, both of which
already depend on the vault. MCP's narrow [`Served` contract](../../packages/plugin-api/src/services.ts)
handles the case where that dependency cannot simply be reversed.

Registries also need a cardinality policy. A key with one owner must refuse a
second claimant; a bus or multi-contributor location intentionally permits
several. For exclusive claims, **check and install all entries in one
indivisible operation**. In Olai's in-process Effect registries, this is one
synchronous body. An uninterruptible region is not a lock: it prevents
cancellation, not every scheduler yield between separate steps.

A refused multi-key claim installs nothing. Its cleanup must not remove the
winner's entries. These are ownership guarantees, not just error-message
preferences. `Edits` and `VaultViews` implement them at the write point.

## Stopping is a protocol

Removing a listener from a registry does not prevent a dispatcher from calling
an old snapshot. Catching the resulting exception is too late: a handler may
already have acted on a released resource without throwing.

Olai's [activation lifecycle](../../packages/effect-cordis/src/lifecycle.ts)
and [dispatch gate](../../packages/effect-cordis/src/gate.ts) coordinate stopping:

1. Shut every gate of the departing activation synchronously, so no new
   invocation can start through an old snapshot.
2. Start cutting its running invocations before awaiting service revocation.
3. Revoke its offers and join dependent cleanup while its resources still exist.
4. Await invocation completion before closing the resource scope, including on
   the exceptional path out of revocation.

Starting the cut before awaiting revocation matters: a dependent's finalizer
may itself be waiting for that handler. Waiting for the dependent first would
prevent the action that lets it finish.

Several details are necessary to make this ordering true:

- **Cut the invocation, not the publisher.** Each gated call has its own fiber,
  with the publisher's services. Stopping one listener must not cancel the
  publisher or unrelated recipients.
- **Join completion, not just an interruption signal.** A handler body's
  finalizer can finish before its child fibers unwind. Gate bookkeeping uses
  fiber exit, not merely the body's finalizer, as completion.
- **Enroll before execution.** A fork can run a synchronous prefix before
  returning its handle. The gate records the invocation before starting it and
  protects the handoff to the waiting continuation against interruption and
  failure.
- **Respect both lifetimes.** A registration belongs to its activation and its
  own scope. Closing a child scope withdraws its registration while the plugin
  remains active. Concurrent owners join the same cut; a second disposal must
  not mistake “already started” for “finished.” Ended registrations are pruned.
- **Keep downstream work independent.** Waterfall continuation runs through the
  dispatcher, outside the departing link's fiber. Cutting that link must
  neither dispatch the rest twice nor interrupt another plugin's work.

A timeout that logs and releases resources under a still-running handler is
not safe shutdown. Olai waits for uninterruptible invocations to unwind and
reports a slow cut. This gives no finite shutdown bound for code that refuses
to finish. Self-removal also needs to work through the real plugin disposer,
not just through an isolated gate.

The activation stage provides the ordering above; an ordinary child or bare
scope still has its own finalizer ordering. Registering a gate in a scope does
not magically order all resources acquired later in that scope before it.

## Acquisition and external effects

Cleanup must be secured as part of acquiring a resource. If a promise finishes
creating an adapter after its waiting fiber has been interrupted, the value can
otherwise be abandoned before a disposer is installed. Use an acquisition
protocol that either prevents that handoff gap or explicitly releases a late
result. Stopping an Effect waiting on a promise does not itself cancel the
underlying operation or close its result.

The same issue appears in UI code. Register disposal synchronously, before
awaiting a dynamic import. After loading, check whether the owner still exists
before allocating. Release partial allocations if construction throws, and own
observers, timers and deferred callbacks as well as the visible widget.
[LivePane](../../packages/plugins/kolu/src/appliance/props/LivePane.tsx) is the
concrete terminal example. Outlines' [overlay owner](../../packages/plugins/outlines/src/browser/overlay.ts)
likewise owns the DOM container its menus use; drawing a frame does not make
layout the owner of every overlay.

Background work needs an owner too. The bridge's `detached` helper enters
Effect from an external callback under the plugin's services and scope. Work
belonging to a shorter-lived session needs that session's cancellation/join
policy. A manually retained and cleaned-up timer is not a leak merely because
it uses a fork API.

Shutdown must join or refuse **every operation capable of acquiring more
resources**, including ones started after boot. Waiting for startup alone, then
snapshotting a node map, can miss a later session acquisition. See [chat's node
operations](../../packages/plugins/chat/src/scoped.ts) and [chat-owned work](../../packages/plugins/chat/src/chat.ts).

Durable actions require outcome-aware recovery rather than a literal undo of
everything a plugin ever did. Disabling an editor does not erase the user's
saved edits. During a git commit, however, Olai's temporary staging must not
remain accidentally after cancellation. Recovery must distinguish “commit did
not happen” from “commit happened but its result was not observed,” and account
for concurrent external changes. Effect success alone is insufficient when a
normal return value can describe failure. The [git operation](../../packages/plugins/git/src/git/git.ts)
contains the staging and outcome-reconciliation policy; the same principle
applies to subprocesses and remote writes.

## Browser state and reconnection

Service absence is a state the UI must handle. A released holder must stop
returning the old service; rendering must also respect when that service can
be used. Git's banner exposed the difference: clearing a component's reading
could mount a fresh face after its row-owned wire had withdrawn. Its faces now
draw behind the activation's availability gate. Correct cleanup alone does not
make every reactive mount order safe.

A stable service may legitimately manage a changing connection. Olai's
[`Wired` broker](../../packages/web/src/client/wire.ts) lets surviving consumers
retain a client while the transport redials. Its contract includes new calls
and subscriptions following the connection, and unavailable capabilities being
refused. This does not promise delivery of every event during a disconnected
gap. Reconnection does not inherently require restarting every browser plugin.

When evaluating such a broker, follow the actual subscription and call path.
An extra cache or blanket restart is not a repair until the existing contract
has been shown insufficient. Phase 1's reconnection work verified the contract;
it did not establish a defect requiring a new architecture.

The shell is itself plugin-owned application behavior. Navigation owns
addresses, history and its page outlet; layout consumes navigation and renderer
services to arrange the application; content plugins supply their pages. Shell
integration belongs on the component that needs the shell, so changing layout
does not unnecessarily stop a feature's independent work. This is the current
boundary, not a mandate for one plugin per face or for any particular tabs,
panes or mobile design. See [navigation](../plugins/navigation.md) and
[layout](../plugins/layout.md).

## Refactors, enforcement and evidence

A shorter implementation is an improvement only if it preserves its ownership
relationships. Before accepting a refactor, identify which owners, dependencies
and lifetimes change. Check optional availability, cleanup order, atomic claims
and reconnection behavior. Extracting a factory can preserve them; extracting
a singleton or merging holders with different lifetimes can erase them.

The dependency fence supports this discipline by checking package access and
known forms of live state behind public contracts, including aliases and
implementation reached through re-exports. It must distinguish module-owned
state from genuinely local bindings and mutable activation state from inert
data. `const` and a `ReadonlyMap` annotation do not establish those facts.

The fence is not a proof about arbitrary JavaScript. An allowed broker or cache
needs a concrete ownership argument, not an exception added merely to keep a
migration small. Conversely, a syntactic ban on every class, closure, `Map` or
module-level value would reject legitimate contracts without proving safety.

Evidence should establish the promised outcome: a stopped handler cannot act,
a departed consumer cannot clear its replacement, two hosts remain isolated,
and unrelated work survives provider replacement. Source inspection, focused
reproductions and checks that distinguish a broken mechanism provide different
parts of that evidence. A passing suite alone is not a proof; an alarming
screenshot alone does not establish a product defect or its cause. Distinguish
reproduced failures, source-supported risks and hypotheses, and retain failing
evidence before rerunning a check.

Do not turn one preferred technique into the architectural requirement. A
source-count check, a particular holder helper or a forced refactor is not the
outcome. Nor does explaining an unmet outcome make it complete.

Finally, Olai's initialization cancellation and teardown coordination are
Effect-backed adaptations, not guarantees borrowed wholesale from the paper.
The bridge depends on pinned Cordis behavior, including provision-disposer
handoff and duplicate-owner error wording. Its [assumption inventory](../../packages/effect-cordis/README.md#where-the-pins-instability-lives)
and [pin configuration](../../nix/cordis.nix) distinguish these dependencies and
their limits. Keep that inventory current when the bridge or upstream pin
changes; do not spread private runtime assumptions into feature plugins.
