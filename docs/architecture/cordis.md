# Cordis in Olai: dependencies, ownership and removal

A plugin must be able to stop or be replaced without leaving work running, without using a service that has already left, and without disturbing unrelated plugins.

- Expands the Cordis adherence rule in [CLAUDE.md](../../CLAUDE.md), also exposed through the `AGENTS.md` symlink.
- Describes the merged design of [PR #554](https://github.com/juspay/olai/pull/554) and [PR #557](https://github.com/juspay/olai/pull/557), including mistakes caught in review.
- Not a claim of formal verification, and not a plan for future routing or layout changes.

Sections: [principle](#the-principle) · [imports](#imports-are-not-live-dependencies) · [owners](#choose-the-owner-before-the-helper) · [optional features](#optional-features) · [stopping](#stopping-is-a-protocol) · [acquisition](#acquisition-and-external-effects) · [browser state](#browser-state-and-reconnection) · [refactors](#refactors-enforcement-and-evidence) · [the static fence](#the-static-fence)

## The principle

The [Cordis paper](https://arxiv.org/abs/2608.25512) splits composition into two questions: what a component needs to start, and what must be undone when it stops.

| Concept | Plain meaning |
| --- | --- |
| Spatial composability | Declaring what a component needs, and starting or stopping it as those things appear and disappear. |
| Temporal composability | Undoing a component's changes when it stops. |
| Effect | A change plus the function that reverses it, registered together. |
| Coeffect | Something the component needs from its surroundings in order to run. |

Worked example. Chat can show references to outline items, and that part of chat needs the outline-reference service. When outlines stops, chat's reference feature stops and drops the value it held, while chat's normal conversations keep running because they never needed outlines. When outlines starts again, the reference feature starts again and takes the new value.

So the question is not "is this code inside a plugin?" It is: who owns this value or this running work, who depends on it, and what happens when either side stops?

Words used here and in the code:

| Term | Plain meaning |
| --- | --- |
| Plugin row | One selectable entry in the bundle, such as "vault". It may contain several components. |
| Component | One independently started part of a row, with its own list of things it needs. |
| Activation | One run of a component, holding the values it acquired and their cleanup. Restarting makes a new activation. |
| Service | A named capability one plugin supplies and others receive by declaring they need it, such as `vault.files`. |
| Scope | A lifetime object. Cleanup is registered on it; closing it runs that cleanup and waits for the work it owns. |
| Acquire | Take hold of a value for a stated lifetime and arrange its release in the same step. |
| Owner | The thing whose departure should end a resource or a piece of work, such as an activation or an open pane. |
| Helper | Shared code that is not an owner: a factory, a registry, or a holder that stores a value for a component. |
| Contract door | A public package subpath others may import, such as `olai-plugin-vault/file-state`. Being importable is not owning. |
| Broker | A service that stays available while the things behind it come and go, and states what happens when they are absent or replaced. |
| Face | A piece of UI a plugin contributes to a named place in the app. |
| Location | A named place in the UI where contributions mount, such as `app.banner`. Also called a slot. |
| Withdrawal | Removing a contribution from a location and releasing everything it acquired. |

| Layer | Responsibility |
| --- | --- |
| [Cordis](https://github.com/cordiverse/cordis) | Resolves dependencies, decides readiness, starts and stops components as dependencies change. |
| [Effect bridge](../../packages/effect-cordis/README.md) | Olai's glue to Effect: scoped startup, interruption, dispatch, teardown ordering. |
| [Plugin API](../../packages/plugin-api/README.md) | The capability contracts and composition interfaces plugins program against. |
| Bundle and hosts | Pick which implementations run, and supply host-owned capabilities. |
| Plugins | Implement features, declare what they need, provide correct cleanup. |

Registering a cleanup function does not prove it reverses the change. Neither Cordis nor the bridge can decide whether two pieces of application code are safe to interleave. Both stay the implementer's job.

## Imports are not live dependencies

Importing a module from another plugin gives you its code. It does not give you that plugin's current state and does not keep it running.

```ts
import type { Directory } from "olai-plugin-vault/file-state"
```

| Import | Verdict | Why |
| --- | --- | --- |
| Types and other static contracts | Safe | They describe a value's shape. Importing one fetches nothing and keeps nothing alive. |
| Pure functions, service keys, inert lookup tables | Safe | No live activation state sits behind them. |
| A module-level variable holding the current directory | Not safe | A consumer could read one activation's state without declaring it needs the vault. |
| Adding a separate "ready" service to compensate | Not safe | Cordis must hand over the capability itself, not just announce it exists. |
| Moving a shared mutable table into a utility package | Not safe | Changing where state lives does not give it an owner. |
| Importing browser composition internals to see what others mounted | Not safe | Contributions are read through the declared `Faces` or renderer services. |

Rules:

- Declare `vault.files`, receive its value inside the consuming activation, drop the reference when that activation ends. See [capture's browser integration](../../packages/plugins/capture/src/browser.tsx) and the [vault contract](../../packages/plugins/vault/src/contract.ts).
- This applies at every package boundary, including general packages such as `@olai/web`, not only plugin-to-plugin imports.
- `Faces` returns contributions in bundle order. The host supplies the rank once, so every consumer sees the same order.
- Package exports control who may import; declared services control who stays alive for whom. Only the second is a lifetime relationship.

## Choose the owner before the helper

Decide whose departure should end a resource, then build the shared helper around that decision.

- An owner can be a host, an activation, one component, a node session, an open pane, or a single operation.
- The widest available lifetime is usually wrong. A terminal observer should end when its pane closes, not when the plugin stops much later.

| Case | Rule | Example |
| --- | --- | --- |
| Reusable implementation | A factory may cross a package boundary if each caller gets its own independent state. | [heldWrites](../../packages/web/src/client/writes.ts), [heldFiles](../../packages/plugins/vault/src/browser/state.ts) |
| Carry landings | The host supplies one `Landings` table per app; activation scopes release component-owned receiver registrations, and carries recheck snapshot membership before release. A receiver captures the indicated work before `leave` clears the visit; cleanup does not wait for its asynchronous write. | [carry contracts](../../packages/plugin-api/src/carry.ts) |
| Per-app state | Each browser app gets its own `Edits` registry. Two apps must not route edits through one module-level table. | [browser host](../../packages/plugin-api/src/browser.ts) |
| Per-setup state | Each vault setup builds its own optional ledger and search tables with `openViews()`. A second host must not overwrite the first host's providers. | [VaultViews](../../packages/plugins/vault/src/views.ts) |

Holders, meaning small objects that store an acquired service for a component:

- Those factories remove duplicated code only. Each private consumer still creates its own holder, and no factory looks up a service for the caller.
- A consumer stores what it acquired in its own holder. It never reads a holder belonging to the provider.
- A holder is a convenient place to keep a value, not a substitute for declaring that you need the service.
- Releasing a holder must remove only the value that hold installed, never a later one. [heldService](../../packages/ui-primitives/src/held.ts) stores a fresh token per hold, because two activations can hold the same object and comparing values cannot tell them apart.
- Tokens still do not let two independent consumers share one holder. Navigation's renderer and palette stop at different times, so each needs its own `heldFaces` holder; sharing one would leave the survivor with no value even though cleanup ran correctly. See [navigation's holders](../../packages/plugins/navigation/src/faces.ts).

## Optional features

When a feature is optional, pick one of three designs instead of adding every reachable service to a row's mandatory `needs`.

The vault must work when git is absent. MCP must work when the vault is absent.

| Relationship | Design |
| --- | --- |
| An integration cannot run without a service | Declare it on that component. Put work that does not need it in a different component. |
| Optional providers add themselves to their consumer | Give the consumer a registration service it owns, as `VaultViews` does. |
| The consumer must stay usable while the things behind it change | Use a narrow declared broker that states its absence and replacement behavior, as `Served`, `Wired` and `ConfigurationWatch` do. `ConfigurationWatch` answers `undefined` when no settings reader exists, so a follower keeps its last policy instead of unloading with the reader. |

- If a row must stay useful without an integration, put that integration in its own component so the rest can start without it.
- If the row must keep running while optional providers come and go, use registration or a broker, not mandatory needs.
- A general service locator hides the real dependency graph even when the locator is declared. A broker is acceptable because it exposes one specific capability and owns the policy for when that capability is missing. A locator renamed to `current(anyKey)` is not a broker.
- Splitting into components is not a mechanical fix. Olai folds component status into the row's report, so a component waiting forever for an optional provider changes the row's reported readiness and what clients load.
- `VaultViews` registration keeps the vault from waiting on git or search, which already depend on the vault. MCP cannot reverse its dependency, so it uses the narrow [`Served` contract](../../packages/plugin-api/src/services.ts).

How many owners a registry key may have:

- A single-owner key must refuse a second claimant. A bus or multi-contributor location is meant to accept several.
- For single-owner claims, check the keys and install all of them in one indivisible step: one synchronous function body in Olai's in-process Effect registries.
- An uninterruptible region is not a lock. It stops cancellation, but the scheduler can still run other fibers between two separate steps.
- A refused multi-key claim must install nothing, and its cleanup must not delete the winner's entries. This is about who owns what, not about nicer error messages. `Edits` and `VaultViews` enforce it where the write happens.

## Stopping is a protocol

Taking a listener out of a registry does not stop a dispatcher that already copied the old listener list.

Catching the resulting error is too late, because a handler can act on a released resource and return normally. The [activation lifecycle](../../packages/effect-cordis/src/lifecycle.ts) and [dispatch gate](../../packages/effect-cordis/src/gate.ts) stop things in a fixed order. A gate is a per-activation switch that admits or refuses new handler calls; cutting a call means interrupting the fiber running it.

1. Close every gate of the departing activation synchronously, so no new call starts through an old listener list.
2. Begin cutting the calls already running, before waiting for services to be revoked.
3. Revoke its services and wait for dependent cleanup, while its resources still exist.
4. Wait for running calls to finish before closing the resource scope, including when revocation fails.

Why the bridge owns this order rather than leaving it to Effect:

- The pinned Cordis engine runs its disposers concurrently, and its provision disposer waits for dependent cleanup, so a plain resource finalizer registered beside that disposer would not run after the dependents.
- A dependent's cleanup may be waiting for the very handler being cut, so waiting for the dependent first would block the action that lets it finish.

Details the order depends on:

| Rule | Reason |
| --- | --- |
| Cut the call, not the publisher | Each gated call runs in its own fiber using the publisher's services. Stopping one listener must not cancel the publisher or other recipients. |
| Wait for fiber exit, not an interrupt signal | A handler's own finalizer can complete while its child fibers are still unwinding, so the gate treats fiber exit as completion. |
| Record the call before starting it | A fork can run synchronous code before returning a handle. The gate registers the call first and protects the handoff to the waiting continuation against interruption and failure. |
| Honour both lifetimes | A registration belongs to its activation and to its own scope. Closing a child scope removes it while the plugin keeps running. Two owners disposing at once join the same cut, and the second must not read "already started" as "finished". Finished registrations are pruned. |
| Keep later work independent | Waterfall continuation runs through the dispatcher, outside the fiber of the link being cut, so cutting a link neither dispatches the rest twice nor interrupts another plugin's work. |

Limits:

- Logging a timeout and releasing resources under a still-running handler is not safe shutdown. Olai waits for uninterruptible calls to unwind and reports a slow cut, so there is no finite shutdown bound for code that never finishes.
- A handler may ask for its own plugin to be disposed. That path must cut and unwind the call before releasing the plugin's resources, without deadlocking. It is a property of the whole disposer path, not of the gate alone.
- Only the activation stage gives this ordering. A plain child or bare scope keeps ordinary finalizer ordering, and putting a gate in a scope does not make resources acquired later in that scope close before it.

## Acquisition and external effects

Arrange a resource's release in the same step that obtains it, so an interruption cannot leave it with no owner.

- If a promise finishes building an adapter after the waiting fiber was interrupted, the adapter exists but no disposer was registered, so nothing closes it.
- Use an acquisition that closes that gap or explicitly releases a late result. Interrupting an Effect waiting on a promise does not cancel the underlying operation or close what it produces.
- MCP's [adapter acquisition](../../packages/plugins/mcp/src/endpoint.ts) wraps creation and release in `Effect.acquireRelease`; cancellation during acquisition waits for the adapter, then closes it.

The same problem appears in UI code:

- Register disposal synchronously, before awaiting a dynamic import.
- After the import resolves, check the owner still exists before allocating.
- If construction throws partway, release what was already allocated.
- Own observers, timers and deferred callbacks, not only the visible widget. See [LivePane](../../packages/plugins/kolu/src/appliance/props/LivePane.tsx).
- A tooltip's enabled child owns its token, position and event listeners; disabling it disposes those resources while the wrapped control retains its DOM and focus.
- Outlines owns the DOM container its menus render into, via its [overlay owner](../../packages/plugins/outlines/src/browser/overlay.ts). Layout draws the frame around the page, which does not make it the owner of overlays other plugins open inside it.

Background work needs an owner too:

- The bridge's `detached` helper lets an external callback enter Effect under the plugin's services and scope.
- Work belonging to a shorter-lived session must follow that session's rules for cancelling or joining it.
- Keeping a timer handle by hand is not a leak just because a fork API created it, as long as its owner tracks it and cancels or joins it on stop.
- Shutdown must join or refuse every operation that can still acquire resources, including ones started long after boot. Waiting only for startup and then snapshotting the node map misses a session that acquires something afterwards. See [chat's node operations](../../packages/plugins/chat/src/scoped.ts) and [chat-owned work](../../packages/plugins/chat/src/chat.ts).

Chat's [sleep pass](../../packages/plugins/chat/src/server/sleep.ts) is the shape to copy when work is neither a component nor a helper. It is a **scope-owned fiber**, forked with `Effect.forkScoped` in the same fork as chat's filer, because it needs chat's own doors — the roster, a conversation's reading, the scheduler's deliver and the write gate — and a row that declared them would be declaring chat. It registers nothing and declares nothing on the row. Its loop dies with that scope, and each pass runs in **its own** `Effect.scoped`, which acquires three things in an order that is the whole design: the hold on git's quiet window (first, so it is released last), the reading of the node's conversation (which is also what keeps that node's process alive), and the cancellation of the turn it started (last, so it runs first — a pass that is stopped stops its turn rather than walking away from it, and writes no memo). **It also takes its own words back.** A machine turn handed to a conversation that could not be woken waits in a queue (`Panel.doorFor`'s `withdraw`, `Chat.withdraw`), and a body that fired days later would be a turn with no hold, nobody observing it, no memo and no commit — so the pass's scope closes by withdrawing the delivery it made, which is a no-op on a turn the agent has already been given. That is the whole of the "background work needs an owner" rule read from the other end: it is not enough for the pass to stop; the work it started has to stop with it. A pass's state is one map of nodes it has given up on, in memory, so a restart forgets it; nothing else is remembered anywhere.

**The hold is the one resource here whose owner is another row's, and it says what that costs.** `Ledger.hold` is an acquisition on the git row's ledger, counted per LEDGER rather than per directory: where no ledger is mounted it succeeds and holds nothing, and a ledger REPLACED while a hold is out starts unheld, because the count was state on the ledger that left. So a git row reloaded mid-sleep may leave one `auto` commit beside the pass's own — visible in the log, and the reason the hold is a ledger fact rather than a global. It closes the TIMER and never the door: the Commit button, the commit tool and `resume` are untouched by one.

Actions with lasting external results need recovery based on what happened, not a blanket undo:

- Disabling an editor must not erase edits the user already saved.
- Olai's temporary git staging must not be left behind when a commit is cancelled.
- Recovery must tell "the commit did not happen" apart from "the commit happened but we never saw the result", and allow for changes made outside Olai meanwhile.
- A successful Effect is not enough when the returned value can itself report failure. The [git operation](../../packages/plugins/git/src/git/git.ts) holds the staging and reconciliation policy; subprocesses and remote writes need the same treatment.

## Browser state and reconnection

In the renderer, `root` is the only location that lasts as long as the renderer itself.

- A contribution belongs to the code that added it, and its `activate` function acquires location-dependent resources in a separate scope.
- Locations declared under that contribution exist only while it is active. Withdrawing it drains everything mounted below before releasing its own resources.
- `root` lasting forever does not mean the layout contributed into `root` lasts forever. See [location ownership](slot-ownership.md).

The UI must handle a service being absent:

- Once released, a holder must stop returning the old service, and rendering must also check whether the service may still be used.
- Git's banner showed why both are needed: clearing the component's stored value could still mount a fresh face after the row-owned wire had withdrawn. Its faces now render behind the activation's availability gate.
- Correct cleanup alone does not make every reactive mount order safe.

One stable service can manage a connection that keeps changing:

- [`Wired`](../../packages/plugin-api/src/browser.ts), backed by the [redial loop](../../packages/web/src/client/wire.ts), lets consumers that survive a reconnect keep their client when the module they loaded is unchanged.
- The connection object and client table keep their identity. Clients for departed capabilities are removed, and calls to those capabilities are refused.
- Subscriptions do not survive a reconnect. Replacing the connection fails every open subscription with a transport error; the client resubscribes and takes a fresh snapshot, leaving a roughly one-second `pending` gap under the current retry policy.
- A connection reporting healthy is not evidence that a value resumed updating. Events during the gap are not guaranteed to be delivered, and the gap is not a reason to restart every browser plugin. See the [reconnection contract](plugin-system.md#6-the-wire-one-root-n-siblings).
- A snapshot is what a subscription is handed, so a collection that scales with user content must not ship its whole self on one: chat's transcript ships a bounded window and pulls older rows on demand (`docs/chat.md` § [A long conversation arrives at its end](#a-long-conversation-arrives-at-its-end)), because a several-megabyte frame starves the keepalive that would have kept the socket up.
- A sub-second drop is not an outage. The overlay and its inertness are gated on the readout's `presentingDown` — the framework's grace-windowed down-state, derived once on the readout — so a forced reconnect that heals in well under a second never freezes the page; `reachable` stays instantaneous for the doors that ask questions, because a call wants a different patience than a full-screen alarm. See [`connection/status.ts`](../../packages/web/src/client/connection/status.ts) and [`connection/Offline.tsx`](../../packages/web/src/client/connection/Offline.tsx).

- To evaluate such a broker, trace the real subscription and call path. Adding a cache or restarting everything is not a fix until the existing contract is shown insufficient. Phase 1's reconnection work confirmed the contract; it found no defect needing a new architecture.

The application shell is itself built from plugins:

- Navigation owns addresses, history and the outlet pages render into. See [navigation](../plugins/navigation.md).
- Layout consumes navigation and renderer services to arrange the application. See [layout](../plugins/layout.md).
- Content plugins supply the pages.
- Code that integrates with the shell belongs on the component that needs the shell, so changing layout does not stop a feature's unrelated work.
- This is where the boundary sits today, not a rule that each face needs its own plugin, nor a commitment to particular tabs, panes or mobile designs.

## Refactors, enforcement and evidence

A shorter implementation is better only if the same things still own the same resources for the same lifetimes.

Before accepting a refactor, list which owners, dependencies and lifetimes change, then re-check optional availability, cleanup order, single-owner claims and reconnection behavior. `just cordis-graph` draws the current graph of rows, needs and owners from the sources, so the before and after can be compared by eye.

| Change | Effect on ownership |
| --- | --- |
| Extracting a factory that gives each caller its own state | Preserved. |
| Extracting a singleton | Lost: the state now outlives every caller. |
| Merging holders with different lifetimes | Lost: one consumer's release affects the other. |

### The static fence

The static half of spatial composability — whether the graph a build actually has agrees with the one it declares — is [`@olai/effect-cordis/fence`](../../packages/effect-cordis/src/fence.ts). It is the one package on this page that reads no runtime, because none of these questions is about a fiber: every one is a fact about imports and text.

Five claims, each with its own non-vacuity check so a corpus that came back short is RED rather than quiet:

| claim | what it refuses |
| --- | --- |
| `imports` | a row's package reached outside a door its manifest declares; a host naming a row outside a root file; a row reaching the roster back |
| `door-graphs` | a `node:`/`bun:` builtin on a browser root's walk, a UI runtime on a node root's, an edge the walk could not resolve |
| `names` | a row's word in another package's code, after comments are stripped and module specifiers subtracted |
| `live-state` | a module another package can open holding a module-scope value, beyond the allowances somebody argued for |
| `registry` | the rows the host names, the rows on disk and the rows the roots compose disagreeing |

The declaration is **four facts**, and three of them are hand-written because no reading of the tree can produce them:

- `repo` — the workspace root, which is derived by definition (it is where the `workspaces` globs are).
- `rows` — supplied from the one place a host already names them (here: the generated registry), or read from each package's own `cordis` field. The fence must not name them twice.
- `roots` — `{ entry, graph }` per entry file. That a file may name more than one row, and whether the graph it opens is a browser's or a node's, is a CLAIM a person makes.
- `collisions` — `{ row: { file: count } }`, the lexical collisions a row's word is recorded in. Exact counts, granting no import and no lifetime exemption: claims one and four do not read this table.

Everything else is derived: a package's doors from its manifest `exports`, a package's row from the same manifest, and a door's graph kind from which roots reach it. Three records hold what a person argued and what the claims cannot know: `allowances` (a module's ownership argument, in prose), `holders` (this tree's own slot factories, which mint state under a `const`), and `runtimes` (what a node graph may not evaluate, which is this build's list and not the door's default).

What it cannot do:

- It reads TEXT. It cannot prove things about arbitrary JavaScript, and three rules about module scope — a rebindable binding, a cell or holder minted at load, a `const` the module writes — are a filter rather than a proof. A broker or cache it allows needs a written ownership argument, not an exception added to keep a migration small.
- It would be wrong in the other direction too: banning every class, closure, `Map` or module-level value would reject valid contracts without proving anything safe.
- It knows nothing about a CHUNK or a mounted module. A build whose loader mounts a row's module by a specifier (this one's `olai.yml`) keeps that per-row door claim itself, beside the two entry roots the fence weighs.

`prove(declaration)` is the falsifier for the claims: it plants one canonical defect per claim in a COPY of the tree — a cross-row import, a `node:` builtin on a browser root, a row's word in a host's code, a module-scope `let` behind a door, a package declaring a row nobody named — and asserts the claim that names each defect refuses it. `scripts/prove-fence.sh` runs that, plus this build's own mutations. A sweep that stopped matching looks exactly like `0 fail`, and it is the one failure mode a reviewer cannot see.

Evidence must demonstrate the promised outcome:

- A handler that has been stopped cannot act.
- A departed consumer cannot clear the value its replacement installed.
- Two hosts stay isolated.
- Work that did not depend on a provider survives that provider being replaced.

A passing test suite establishes none of those on its own. Source inspection and reproductions must address the ownership claim itself. Preferring a helper, counting sources or forcing a refactor are techniques, not the requirement.

Assumptions pinned to the current Cordis version:

- Olai's startup cancellation and teardown ordering are adaptations built on Effect, not guarantees taken directly from the paper.
- The bridge relies on specific pinned behavior, including how the provision disposer hands over and the exact wording of the duplicate-owner error.
- The [assumption inventory](../../packages/effect-cordis/README.md#where-the-pins-instability-lives) and [pin configuration](../../nix/cordis.nix) record these dependencies and their limits.
- Update the inventory when the bridge or upstream pin changes, and keep these private runtime assumptions out of feature plugins.

Pointer carries share the component-owned gesture in
[`lifting.ts`](../../packages/web/src/client/lifting.ts): travel/hold recognition,
scroll claims, cancellation, and click suppression have one lifetime. Carriers
supply the work begun at lift; receiver routing remains in `carry.ts`, and outline
placement rules remain in outlines. Each plugin still declares `Landings` and
holds its own activation scope. This shares static mechanics, not live plugin
state or a new global gesture owner.

### Mail tool calls

Mail's MCP tools close over activation-local resources instead of calling sibling procedures. They enter the Effect bridge's exported `gate` before touching the runner, label cache or attachment directory. Withdrawal closes that gate and joins interrupted calls before resource cleanup. The runner's interruption finalizer kills and joins its child process; the attachment directory closes before the generated token config. A retained tool closure therefore cannot restart work after the row leaves. Account refresh calls share the runner but do not spend the tools' four spawn permits.

The mail implementation separates invocation policy (`tools.ts`: schemas,
activation gate, logging and reply decoration) from mailbox operations
(`mailbox.ts`: account checks, Himalaya commands, label cache and serialized
writes). This is an internal boundary within one activation, not a new service
or owner. The mailbox is acquired before the gate; closing the activation still
cuts and joins calls before removing attachments and token configuration.
Account readiness has one definition, checked again before each spawn. Command
failures are translated where the command is known, so an attachment 404 does
not become a missing-thread refusal.

Text-only agent adapters share `@olai/surface`'s pure `refusalIn` decoder. Each
engine retains its own SDK envelope extraction. The server's MCP tests parse
real formatted refusals and compare them with structured details, tying the
compatibility check to the formatter's release cycle.

### Mail inbox watcher

Mail acquires `Deliveries` and registers its words with `Wakes`. It hangs a `conversation.wake` switch in chat's strip; chat stores an opaque JSON pick, writes it only through the browser face, and hands back a recipient whose authority ends when the choice is replaced, cleared or evicted. Mail re-reads recipients at delivery time. No vault property can opt a conversation in.

The watcher, OAuth refresh and mailbox operations belong to the mail activation. The poll fiber stops before the shared mailbox's attachment directory and Himalaya config close. History calls have their own sequential cadence; thread metadata uses the mailbox's four spawn permits. The persisted history cursor advances only after delivery thunks have been accepted. A separate cadence component depends on `ConfigurationWatch` and the activation's `mail.poll` service; `undefined` keeps the last cadence, and the component withdraws before the timer owner.

Chat owns the wake strip location, persistence and queue counts. Each plugin owns its face and the meaning of its pick. Kolu and odu acquire `vault.files` for their picker faces and use their own server vault readings to filter recipients. The static `file-wakes` helper supplies nearest-ancestor precedence and file-fault accounting without sharing live state between plugins. Their local-state doors retain which broken picks have already been announced, so a restart does not repeat the warning.

### Agent charter at MCP `initialize`

A row's sentence to an agent rides its own `Sibling.charter`, beside the `tools` it brings, and leaves with the row. The MCP row composes `initialize`'s `instructions` at each host connection from the rows standing then — its own transport and address-grammar paragraphs first, then every standing row's charter in roster order — over the same reading the tool list and `surface://` resources come from. Core keeps no self-description of plugin behaviour: "a person reads your answer in olai's chat panel" is chat's paragraph, absent on a serve that runs MCP without chat and to an external host that has no panel. It was a static string in `@olai/surface` for one PR, imported by the MCP row; a static import may carry a contract, but this one asserted another row's live behaviour, which is the tools table in `@olai/ops` again in words.

The limit is the wire's and is stated: MCP has `tools/list_changed` and no `instructions_changed`, so a host already connected keeps what its own `initialize` said, and a host connecting after a roster move is told the roster it gets. `@kolu/surface-mcp` reads `instructions` as a function per `initialize` (juspay/kolu#2253); `reroster` carries no text of its own. The composed whole with every row standing stays under Claude Code's silent 2 KB truncation, held by `@olai/server`'s `profiles.test.ts`, which also reads both states of chat's paragraph.
