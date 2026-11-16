# The Cordis rules: what a plugin needs, what it owns, and how it stops

A plugin must be able to stop, or be replaced, without leaving work running, using a service that has stopped, or disturbing any other plugin.

## The question to ask about every value

The question is never "is this code inside a plugin?" It is: who owns this value or this running work,[^terms] who depends on it, and what happens when either of them stops.[^paper]

## Decide who owns a resource before you write the helper

Decide whose departure should release a resource, then build the helper around that decision.[^owners] The plugin using a service holds its value, not the one supplying it.[^hold]

## Importing a module is not depending on a plugin

Importing a module from another plugin gives you its code, not that plugin's current state, and it keeps nothing running.[^imports] Every value one plugin hands another travels on a declared service, never on an exported `let`.[^live]

## Stopping follows a fixed order

Removing a listener from a registry does not stop a dispatcher that already copied the old list.[^gate] The bridge between Cordis and Effect, `@olai/effect-cordis`, runs this order itself rather than leaving it to Effect:[^order]

1. Close every gate of the departing activation, synchronously, so no new call gets in.
2. Start interrupting the calls that are already running, before waiting for services to be withdrawn.
3. Withdraw its services and wait for the plugins that depended on them to clean up, while its own resources still exist.
4. Wait for the running calls to finish before closing the resource scope, including when withdrawal fails.

## Before you accept a refactor

A shorter implementation is better only if the same owners hold the same resources for the same lifetimes.[^refactor] `just cordis-graph` draws the current graph. `@olai/effect-cordis/fence` checks a build's graph against the one it declares.[^fence]

[^terms]: A component is one independently started part of a plugin, with its own needs. An activation is one run of a component, holding what it acquired; restarting makes a new one. A service is a capability one plugin supplies and others receive by declaring they need it.

    A scope is a lifetime object: closing it runs its cleanup and waits for the work it owns. A broker is a service that stays while the things behind it come and go.

[^paper]: The [Cordis paper](https://arxiv.org/abs/2608.25512) splits composition into two questions: what a part needs to start, and what must be undone when it stops. Cordis resolves the dependencies; `@olai/effect-cordis` glues it to Effect, which owns scoped startup, interruption, dispatch and teardown ordering.

    Registering a cleanup function does not prove that it reverses the change, and no runtime can tell whether two pieces of application code are safe to run interleaved. Chat's outline references stop and drop their value when outlines stops, while its conversations keep running.

[^owners]: The owner can be the host, one activation of a component, a browser component, a node session, an open pane or a single operation. The longest-lived owner available is usually the wrong one: an observer watching a terminal, for example, should end when its pane closes.

[^hold]: A factory removes duplicated code; it never looks a service up on its caller's behalf. The hold belongs to an activation: register it on the declaring component's scope with `Effect.acquireRelease`, and clear it by identity, so an activation that has stopped cannot take a replacement's value away.

    `ui-primitives/src/held.ts` stores a fresh token for each hold, because two activations can hold the same object and comparing the values cannot tell them apart. Two consumers never share one holder: navigation's renderer and its palette stop at different times, so sharing one holder would leave the survivor with no value.

[^imports]: A static import can carry a contract, a type or a pure function, but it cannot promise anything about another plugin's running behaviour. The paragraph a plugin writes for an agent travels on that plugin's own declaration and leaves when the plugin leaves. A package's exports say who may import it; declared services say who stays alive for whom, and only the second is a lifetime.

[^live]: A declared service knows who is asking: while no plugin provides it, the consumer waits, and the plugins panel shows that it is waiting and names the service. Declare `vault.files`, receive its value inside the consuming activation, and drop the reference when that activation ends. This holds at every package boundary, including general packages such as `@olai/web`. `Faces` returns contributions in bundle order, which the host ranks once, so every consumer sees the same order.

[^gate]: A new call must not start through an old list of listeners, and catching the resulting error is too late: a handler can act on a resource that was already released and still return normally. A gate admits or refuses new calls, one gate per activation, and cutting a call interrupts the fiber running it.

[^order]: The pinned Effect release runs disposers concurrently, and its own disposer for a provided service waits for dependants to clean up, so a finalizer registered beside it would not run last. A dependant's cleanup may itself be waiting for the handler being interrupted. Only the activation stage gives this ordering: a gate inside a plain scope does not reorder the resources acquired after it.

[^refactor]: List which owners, dependencies and lifetimes change, then check again: optional services that may be absent, cleanup order, keys that allow only one owner, and reconnection. The evidence has to show the promised outcome: a stopped handler cannot act, a consumer that has left cannot clear the value its replacement installed, two hosts stay isolated. A passing test suite shows none of that, so read the source and reproduce the case.

[^fence]: That is a question about imports and text, so the fence answers it by reading the source files. Each of its five claims also checks that it read something, so a scan that came back with too few files fails instead of passing quietly.

<details>
<summary>Which imports are not safe, and why</summary>

| Import | Verdict | Why |
| --- | --- | --- |
| Types and other static contracts | Safe | They describe a shape, and fetch nothing at runtime. |
| Pure functions, service keys, inert tables | Safe | No running activation's state sits behind them. |
| A module variable holding the current directory | Not safe | That is one activation's state, read without declaring that you need it. |
| A "ready" service added beside such a variable | Not safe | Cordis hands the capability itself over, rather than announcing that it exists. |
| A shared mutable table moved into a utility package | Not safe | Moving where state lives gives it no owner. |
| The browser composition's internals, read to see what others mounted | Not safe | What others contributed is read through declared services. |

### Where a live value may live

A module that another package can import holds no live value.

- A live value is withdrawn when its provider stops, and a replacement is a new activation rather than an overwrite of the old value.
- Where work must keep running after the provider leaves, declare the service on one component rather than on the whole plugin. A need declared on the plugin stops the whole plugin with it.
- A read can answer that the service is absent: `undefined` means it is not mounted, and the consumer draws its own version of "not available".
- A helper with no activation of its own takes the operation as an argument, not the thing holding the value.

</details>

<details>
<summary>Who owns what, case by case</summary>

| Case | Rule |
| --- | --- |
| A reusable implementation | A factory may cross a package boundary when each caller gets its own state. |
| Drag-and-drop targets | One `Landings` table of drop targets per browser app. Activation scopes release the registrations, and a target captures the dropped work before `leave` clears the drag. |
| Shared drag gestures | A shared pointer-carry helper shares the mechanics only. Each plugin declares its own `Landings` and holds its own scope. |
| State per browser app | Each browser app gets its own `Edits` registry, never one table at module level. |
| State per vault setup | Each vault setup builds its own ledger and search tables, and never overwrites another host's providers. |

### Optional features

An optional feature takes one of three designs, rather than adding more services to the list a plugin cannot start without. The vault has to work when git is absent, and MCP has to work when the vault is absent.

| Relationship | Design |
| --- | --- |
| The integration cannot run without a service | Declare that service on the component that needs it. Work that does not need it goes on another component. |
| Optional providers add themselves to their consumer | Give the consumer a registration service that it owns, as the vault's views do. |
| The consumer stays usable while what is behind it changes | Use one narrow declared broker that states what it does when the capability is absent, as `Served`, `Wired` and `ConfigurationWatch` do. |

- A broker says what it answers when the capability is missing. `ConfigurationWatch` answers `undefined` when there is no settings reader, so whatever follows the settings keeps its last policy. A component that follows a policy withdraws before the timer it feeds.
- A service that looks any key up on request hides the dependency graph even when it is declared. A broker exposes one capability and owns what happens when that capability is absent; a `current(anyKey)` lookup is not a broker.
- Splitting a plugin into components fixes nothing by itself. Each component's state is folded into the plugin's report, so a component waiting forever for an optional provider changes what the browser loads.
- Work started because another plugin chose something ends when that choice is replaced, cleared or evicted.

### How many owners a key may have

- A key with one owner refuses a second claimant. A bus, or a location several plugins contribute to, accepts many.
- Check the keys and install them all in one step nothing can interrupt: a single synchronous function body.
- A region Effect cannot interrupt is not a lock. It stops cancellation, but other fibers still run between two of its steps.
- A claim that is refused installs nothing, and its cleanup must not delete the winner's entries.

</details>

<details>
<summary>The rules the cut obeys, and what stopping cannot promise</summary>

| Rule | Reason |
| --- | --- |
| Interrupt the call, not the publisher | Each gated call runs in its own fiber. Stopping one listener must not cancel the publisher or the other recipients. |
| Wait for the fiber to exit, not for the interrupt to be sent | A handler's finalizer can finish while its child fibers are still unwinding. |
| Record the call before starting it | A fork runs synchronous code before it returns a handle to the fiber. |
| Honour both lifetimes | A registration belongs to its activation and to its own scope, and when both dispose at once the two join one interruption. |
| Keep later work independent | Work that continues after a step runs outside the fiber being interrupted, so interrupting one step interrupts no other plugin. |

- A tool or a callback that closes over an activation's resources passes through that activation's gate first, so a closure somebody kept cannot restart work after the plugin leaves.
- Logging a timeout and releasing resources while a handler is still running is not a safe shutdown. olai waits for a call it cannot interrupt to unwind, and reports that the stop was slow. Code that never finishes has no time bound.
- A handler may ask for its own plugin to be disposed. That path interrupts and unwinds the call before releasing the resources.

</details>

<details>
<summary>Acquisition, external effects and background work</summary>

Arrange a resource's release in the same step that obtains it, so an interruption cannot leave it with no owner.

- Interrupting an Effect that is waiting on a promise cancels neither the operation nor whatever it produces. An adapter that finishes being built after its fiber was interrupted has nothing left to close it, so obtain it with an acquisition that registers the release in the same step.
- In browser code, register the disposal before awaiting a dynamic import, check that the owner still exists once the import resolves, and release whatever construction allocated if it throws partway through.
- Own the observers, timers and deferred callbacks too, not only the visible control. Disabling a control disposes its token, its position tracking and its listeners, while the control's own markup stays.
- A plugin owns the container its own overlays are rendered into. Drawing the frame around a page does not make layout the owner of what other plugins open inside it.
- An action with a lasting effect outside olai needs recovery from what actually happened, not a blanket undo. Disabling an editor must not erase edits that were saved, and files staged in git for a commit must not stay staged when the commit is cancelled.
- Recovery has to tell a commit that never happened apart from one whose result nobody saw, because an Effect can succeed and still return a value that reports a failure.

### Background work needs an owner

- The bridge's `detached` helper lets a callback from outside Effect start work inside it, under the plugin's own services and scope. Work owned by a shorter-lived session follows that session's rules for cancelling.
- Keeping a timer handle in a variable is not a leak, as long as its owner tracks it and cancels or joins it when stopping.
- Shutdown joins or refuses every operation that can still acquire a resource. Waiting only for startup to finish and then listing what exists misses a session that acquires something later.
- A loop that is neither a component nor a helper is a fiber owned by a scope, forked in the scope whose services it uses. Each pass runs in its own scope and acquires its resources there, so they are released in reverse order: the hold taken first is released last.
- Each pass gives back what it took, because a callback firing days later would run with nothing held and nobody watching it.
- A hold on another plugin's resource says what its absence costs. With no ledger mounted it holds nothing, and a ledger replaced while the hold is open starts out unheld.

</details>

<details>
<summary>Browser state, withdrawal and reconnection</summary>

In the renderer, `root` is the only extension location that lasts as long as the renderer itself.

- A contribution belongs to the code that added it, and its `activate` acquires the resources that location needs in a scope of its own.
- Locations declared under a contribution exist only while that contribution is active. Withdrawing it drains everything mounted below it before releasing its own resources.
- `root` lasting as long as the renderer does not mean the layout contributed into `root` lasts that long ([slot-ownership.md](slot-ownership.md)).
- Once a service is released, its holder stops returning the old value, and rendering checks whether the service may still be used. Otherwise a component can mount after the wire it draws from has been withdrawn.
- The shell is made of plugins too. Code that integrates with the shell belongs on the component that needs it, so changing the layout stops no unrelated work.

### Reconnection

`Wired` is one service that stays the same over a connection that keeps changing, backed by the redial loop in `web/src/client/wire.ts`. A consumer keeps the same client across a reconnect as long as the module it loaded is unchanged.

- The connection object and the table of clients keep their identity. Clients for capabilities that have left are removed, and calls to them are refused.
- Subscriptions do not survive a reconnect. Replacing the connection fails every open subscription, and the client subscribes again for a fresh snapshot, leaving a gap of roughly a second.
- A connection that reports healthy is no evidence that a value started updating again. Events during the gap may be lost, which is not a reason to restart every browser plugin.
- A subscription is handed a snapshot, so a collection that grows with what somebody has written must not send it all at once. A frame of several megabytes starves the keepalive, so a long transcript sends a bounded window of rows.
- A drop of under a second is not an outage. The frozen screen waits for the connection readout to stay down past its grace window, while the plain question "can the server be reached?" is still answered instantly.
- To judge whether a broker is right, trace the real call path. A cache is not a fix until the contract has been shown to be insufficient.

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
| `imports` | a plugin's package imported through anything but a declared subpath; a host naming a plugin outside a root file; a plugin importing the registry |
| `door-graphs` | a `node:` or `bun:` builtin reached from a browser entry point, a browser runtime reached from a server entry point, or an import the walk could not resolve |
| `names` | a plugin's own word written in another package's code, once comments and module specifiers are subtracted |
| `live-state` | a module another package can import holding a value at module scope, beyond the exceptions somebody argued for in writing |
| `registry` | the plugins the host names, the plugins on disk and the plugins the entry points compose disagreeing with each other |

Two of the declaration's four facts are written by hand. `roots` is a claim a person makes: whether a file is the entry point of a browser graph or of a server one. `collisions` is the exact number of places a plugin's word collides with an ordinary word. The rest is derived from the manifests.

- `names` reads only the TypeScript that ships. Comments, stylesheets, data files, prose and benchmarks are not in its corpus, so a word in any of those is not a collision.
- The fence reads text, so the module-scope rules filter rather than prove. A broker or a cache it allows still needs a written argument about ownership. Banning every closure or module-level value would be wrong the other way, and would reject valid contracts.
- The fence knows nothing about bundle chunks. A build whose loader mounts a plugin's module by specifier has to keep that subpath claim itself.
- `prove(declaration)` tests the fence: it plants one typical defect per claim in a copy of the tree, and asserts that the claim named for each defect refuses it. A check that silently stopped matching anything looks exactly like a pass.

</details>
