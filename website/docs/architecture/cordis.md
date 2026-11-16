# Cordis: dependencies, ownership and removal

A plugin must stop, or be replaced, without leaving work running, using a service that has left, or disturbing anything else.

## The principle

The question is never "is this code inside a plugin?" It is: who owns this value or this work,[^terms] who depends on it, and what happens when either side stops.[^paper]

## Choose the owner before the helper

Decide whose departure should end a resource, then build the helper around that decision.[^owners] An owner can be a host, an activation, a component, a node session, an open pane or one operation. The widest lifetime available is usually wrong: a terminal observer ends when its pane closes.

## Imports are not live dependencies

Importing a module from another plugin gives you its code, not that plugin's current state, and keeps nothing running.[^imports] Every reading one plugin hands another travels on a declared service, never an exported `let`.[^live]

## Stopping is a protocol

Taking a listener out of a registry does not stop a dispatcher that already copied the old list.[^gate] The bridge owns this order rather than leaving it to Effect:[^order]

1. Close every gate of the departing activation synchronously.
2. Begin cutting the calls already running, before waiting for services to be revoked.
3. Revoke its services and wait for dependent cleanup, while its resources still exist.
4. Wait for running calls to finish before closing the resource scope, including when revocation fails.

## Before you accept a refactor

A shorter implementation is better only if the same things own the same resources for the same lifetimes.[^refactor] `just cordis-graph` draws the current graph; `@olai/effect-cordis/fence` checks a build's graph against the one it declares.[^fence]

[^terms]: A component is one independently started part of a plugin, with its own needs. An activation is one run of a component, holding what it acquired; restarting makes a new one. A service is a capability one plugin supplies and others receive by declaring they need it.

    A scope is a lifetime object: closing it runs its cleanup and waits for the work it owns. A broker is a service that stays while the things behind it come and go.

[^paper]: The [Cordis paper](https://arxiv.org/abs/2608.25512) splits composition into two questions: what a part needs to start, and what must be undone when it stops. Cordis resolves the dependencies; `@olai/effect-cordis` glues it to Effect, which owns scoped startup, interruption, dispatch and teardown ordering.

    Registering a cleanup function does not prove it reverses the change, and no runtime can tell whether two pieces of application code are safe to interleave. Chat's outline references stop and drop their value when outlines stops, while its conversations keep running.

[^owners]: The consumer holds, never the provider. A factory removes duplicated code; it never looks a service up for its caller. The hold belongs to an activation: register it on the declaring component's scope with `Effect.acquireRelease`, and clear it by identity, so a stopped activation cannot take a replacement's value away.

    `ui-primitives/src/held.ts` stores a fresh token per hold, because two activations can hold the same object and comparing values cannot tell them apart. Two consumers never share one holder: navigation's renderer and palette stop at different times, so sharing one leaves the survivor with no value.

[^imports]: A static import may carry a contract, but not an assertion about another plugin's live behaviour. A plugin's sentence to an agent rides its own declaration and leaves with it. Package exports say who may import; declared services say who stays alive for whom, and only the second is a lifetime.

[^live]: A declared service knows who is asking: the consumer waits while nobody stands behind the key, and the plugins panel says so. Declare `vault.files`, receive its value inside the consuming activation, and drop the reference when that activation ends. This holds at every package boundary, including general packages such as `@olai/web`. `Faces` returns contributions in bundle order, ranked once by the host, so every consumer sees the same order.

[^gate]: A new call must not start through an old listener list, and catching the resulting error is too late: a handler can act on a released resource and return normally. A gate admits or refuses new calls per activation, and cutting a call interrupts the fiber running it.

[^order]: The pinned engine runs disposers concurrently, and its provision disposer waits for dependent cleanup, so a finalizer registered beside it would not run last. A dependent's cleanup may also be waiting for the handler being cut. Only the activation stage gives this ordering: a gate inside a bare scope does not reorder resources acquired after it.

[^refactor]: List which owners, dependencies and lifetimes change, then re-check optional availability, cleanup order, single-owner claims and reconnection. Evidence must demonstrate the outcome promised: a stopped handler cannot act, a departed consumer cannot clear the value its replacement installed, two hosts stay isolated. A passing suite establishes none of that, so source inspection and reproductions address the ownership claim.

[^fence]: That is a question about imports and text, so the fence answers it by reading sources. Each of its five claims carries a non-vacuity check, so a corpus that came back short fails rather than passing quietly.

<details>
<summary>Which imports are not safe, and why</summary>

| Import | Verdict | Why |
| --- | --- | --- |
| Types and other static contracts | Safe | They describe a shape, and fetch nothing. |
| Pure functions, service keys, inert tables | Safe | No live activation state sits behind them. |
| A module variable holding the current directory | Not safe | One activation's state, read without declaring the need. |
| A "ready" service added beside it | Not safe | Cordis hands the capability over, rather than announcing it. |
| A shared mutable table moved to a utility package | Not safe | Moving where state lives gives it no owner. |
| Browser composition internals, read for what others mounted | Not safe | Contributions are read through declared services. |

### Where a live value may live

A module another package can open holds no live value.

- The value is withdrawn when the provider stops, and a replacement is a fresh activation, not an overwrite.
- Declare the key on a component, not the whole plugin, wherever work must survive the provider leaving: a need on the plugin takes the plugin with it.
- A read answers absence: `undefined` means the service is not mounted, and the consumer draws its own absent arm.
- A helper with no activation of its own takes the operation, not the holder.

</details>

<details>
<summary>Who owns what, case by case</summary>

| Case | Rule |
| --- | --- |
| Reusable implementation | A factory may cross a package boundary when each caller gets its own state. |
| Carry landings | One `Landings` table per app. Activation scopes release them, and a receiver captures the work before `leave` clears the visit. |
| Shared gestures | A shared pointer-carry helper shares mechanics only. Each plugin declares its own `Landings` and holds its own scope. |
| Per-app state | Each browser app gets its own `Edits` registry, never one module-level table. |
| Per-setup state | Each vault setup builds its own ledger and search tables, and never overwrites another host's providers. |

### Optional features

An optional feature takes one of three designs, never a longer list of mandatory needs. The vault must work when git is absent, and MCP when the vault is absent.

| Relationship | Design |
| --- | --- |
| The integration cannot run without a service | Declare it on that component. Work that does not need it goes elsewhere. |
| Optional providers add themselves to their consumer | Give the consumer a registration service it owns, as the vault's views do. |
| The consumer stays usable while what is behind it changes | Use a narrow declared broker stating its absence behaviour, as `Served`, `Wired` and `ConfigurationWatch` do. |

- A broker says what it answers when the capability is missing: `ConfigurationWatch` answers `undefined` with no settings reader, so a follower keeps its last policy. A component following a policy withdraws before the timer it feeds.
- A locator hides the dependency graph even when declared. A broker exposes one capability and owns the policy for its absence; `current(anyKey)` is not one.
- Splitting into components is no mechanical fix. Component status folds into the plugin's report, so one waiting forever for an optional provider changes what clients load.
- Work started on another plugin's choice ends when that choice is replaced, cleared or evicted.

### How many owners a key may have

- A single-owner key refuses a second claimant. A bus or a multi-contributor location accepts several.
- Check the keys and install them all in one indivisible step: one synchronous function body.
- An uninterruptible region is not a lock: it stops cancellation, but other fibers still run between two steps.
- A refused claim installs nothing, and its cleanup must not delete the winner's entries.

</details>

<details>
<summary>The rules the cut obeys, and what stopping cannot promise</summary>

| Rule | Reason |
| --- | --- |
| Cut the call, not the publisher | Each gated call runs in its own fiber. Stopping one listener must not cancel the publisher or other recipients. |
| Wait for fiber exit, not an interrupt | A handler's finalizer can complete while its child fibers unwind. |
| Record the call before starting it | A fork runs synchronous code before returning a handle. |
| Honour both lifetimes | A registration belongs to its activation and to its own scope, and two owners disposing at once join one cut. |
| Keep later work independent | Waterfall continuation runs outside the fiber being cut, so cutting one link interrupts no other plugin. |

- A tool or callback closing over activation resources enters that activation's gate first, so a retained closure cannot restart work after the plugin leaves.
- Logging a timeout and releasing resources under a running handler is not safe shutdown: olai waits for an uninterruptible call to unwind and reports a slow cut, so code that never finishes has no bound.
- A handler may ask for its own plugin to be disposed. That path cuts and unwinds the call before releasing resources.

</details>

<details>
<summary>Acquisition, external effects and background work</summary>

Arrange a resource's release in the same step that obtains it, so an interruption cannot leave it with no owner.

- Interrupting an Effect waiting on a promise cancels neither the operation nor what it produces. An adapter built after its fiber was interrupted has nothing to close it, so use an acquisition closing that gap.
- In interface code, register disposal before awaiting a dynamic import, check the owner still exists once it resolves, and release what construction allocated if it throws partway.
- Own observers, timers and deferred callbacks, not only the visible widget. Disabling a control disposes its token, position and listeners while the control keeps its markup.
- A plugin owns the container its own overlays render into. Drawing the frame around a page makes layout no owner of what others open inside it.
- An action with a lasting external result needs recovery from what happened, not a blanket undo: disabling an editor must not erase saved edits, and temporary git staging must not survive a cancelled commit.
- Recovery tells a commit that did not happen apart from one whose result nobody saw, because a successful Effect can return a value that reports failure.

### Background work needs an owner

- The bridge's `detached` helper lets an external callback enter Effect under the plugin's services and scope. Work owned by a shorter-lived session follows that session's cancelling rules.
- Keeping a timer handle by hand is no leak, if its owner tracks it and cancels or joins it on stop.
- Shutdown joins or refuses every operation that can still acquire resources. Waiting only for startup, then snapshotting what exists, misses a session that acquires later.
- A loop that is neither a component nor a helper is a scope-owned fiber, forked in the scope whose doors it uses. Each pass runs in its own scope and acquires so release runs backwards: a hold taken first is released last.
- A pass takes back what it handed out, because a body that fired days later would run with no hold and nobody watching.
- A hold on another plugin's resource states what its absence costs. With no ledger mounted it holds nothing, and a ledger replaced mid-hold starts unheld.

</details>

<details>
<summary>Browser state, withdrawal and reconnection</summary>

In the renderer, `root` is the only location that lasts as long as the renderer itself.

- A contribution belongs to the code that added it, and its `activate` acquires location-dependent resources in a separate scope.
- Locations declared under it exist only while it is active. Withdrawing it drains what is mounted below before releasing its own resources.
- `root` lasting forever does not mean the layout contributed into `root` lasts forever ([slot-ownership.md](slot-ownership.md)).
- Once released, a holder stops returning the old service, and rendering checks whether the service may still be used. A face can otherwise mount after its wire withdrew.
- The shell is itself plugins. Code that integrates with it belongs on the component that needs it, so changing layout stops no unrelated work.

### Reconnection

`Wired`, backed by the redial loop in `web/src/client/wire.ts`, is one stable service over a connection that keeps changing. A consumer keeps its client across a reconnect when the module it loaded is unchanged.

- The connection object and client table keep their identity. Clients for departed capabilities are removed, and calls to them are refused.
- Subscriptions do not survive a reconnect. Replacing the connection fails every open one, and the client resubscribes for a fresh snapshot, leaving a gap of roughly a second.
- A connection reporting healthy is no evidence that a value resumed updating. Events during the gap may be lost, which is no reason to restart every browser plugin.
- A subscription is handed a snapshot, so a collection that scales with somebody's content must not ship it all at once: a several-megabyte frame starves the keepalive, so a long transcript ships a bounded window.
- A sub-second drop is not an outage. The freeze is gated on the readout's grace-windowed down state, while reachability stays instant for the doors that ask questions.
- To judge a broker, trace the real call path. A cache is not a fix until the contract is shown insufficient.

</details>

<details>
<summary>What a refactor costs, and what the pin assumes</summary>

| Change | Effect on ownership |
| --- | --- |
| Extracting a factory that gives each caller its own state | Preserved. |
| Extracting a singleton | Lost: the state outlives every caller. |
| Merging holders with different lifetimes | Lost: one consumer's release affects the other. |

The teardown ordering is built on Effect rather than taken from the paper, and the bridge relies on pinned behaviour. `packages/effect-cordis/README.md` and `nix/cordis.nix` record those assumptions; update them when the pin moves.

</details>

<details>
<summary>The static fence: its five claims, and what it cannot do</summary>

| Claim | What it refuses |
| --- | --- |
| `imports` | a plugin's package reached outside a declared door; a host naming a plugin outside a root file; a plugin reaching the roster back |
| `door-graphs` | a `node:` or `bun:` builtin on a browser root's walk, an interface runtime on a server root's, an edge the walk could not resolve |
| `names` | a plugin's word in another package's code, after comments and module specifiers are subtracted |
| `live-state` | a module another package can open holding a module-scope value, beyond the allowances somebody argued for |
| `registry` | the plugins the host names, the plugins on disk and the plugins the roots compose disagreeing |

Two of the declaration's four facts are written by hand. `roots` is a claim a person makes: whether a file opens a browser graph or a server one. `collisions` is the exact count of lexical collisions a plugin's word is recorded in. The rest is derived from the manifests.

- `names` reads shipping TypeScript only. Comments, stylesheets, data files, prose and benches are out of its corpus, so a word in any of those is not a collision.
- It reads text, so the module-scope rules filter rather than prove. A broker or cache it allows needs a written ownership argument. Banning every closure or module-level value would be wrong the other way, rejecting valid contracts.
- It knows nothing about a bundle chunk. A build whose loader mounts a plugin's module by a specifier keeps that door claim itself.
- `prove(declaration)` is the falsifier: it plants one canonical defect per claim in a copy of the tree and asserts the claim naming each defect refuses it. A sweep that stopped matching looks exactly like a pass.

</details>
