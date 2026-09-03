/**
 * THE SERVICES A SERVER HALF NAMES — the whole of what core offers a plugin,
 * and the door a plugin's `./server` opens.
 *
 * ## What a plugin is now, in one breath
 *
 * ```ts
 * export default definePlugin({
 *   name,
 *   needs: [Clock, Deliveries, Env, Kinds, SessionStart.key, Surfaces, Vault, Wakes],
 *   apply: Effect.gen(function*() {
 *     const kinds = yield* Kinds
 *     for (const kind of ours) yield* kinds.register(kind)
 *   }),
 * })
 * ```
 *
 * `needs` is the list; the `R` of `apply` is computed from the SAME list, so a
 * plugin that yields a tag it did not name is a `tsc` error at its own
 * `definePlugin` call. `register` returns an Effect whose undo is a finalizer on
 * the plugin's `Scope`, so unloading the plugin takes the registration with it
 * and nothing on either side of the wall remembers to say so. Nobody calls
 * `ctx.effect`, and nothing here imports `cordis` — `@olai/effect-cordis` is the
 * one package that does.
 *
 * ## What replaced what
 *
 * It was `PluginServices`: one blob of seven fields, built per plugin by the
 * composition root and pushed in whole, so every plugin received everything
 * whether or not it had any use for it. Then it was ten `Service`
 * classes, which fixed the blob and left two runtimes meeting in the open —
 * `Effect.promise` around the mount, `ring(Effect.logWarning(line))` callbacks
 * back out of every service, and plugin bodies that were plain TypeScript
 * reaching into Effect by hand. Each of those was an escape hatch and each new
 * plugin copied them.
 *
 * Three things fall out of the tags, and none of them is a convenience:
 *
 *   - **A plugin that does not name `Deliveries` never sees it.** The runtime
 *     holds the fiber PENDING until every named service exists, unloads it when
 *     one leaves, and re-applies it when one returns. The compiler holds the
 *     same line one step earlier.
 *   - **The per-plugin STAMP is not threaded and cannot be spelled.** A keyed
 *     service is a {@link Provision} — a function from the plugin's word to that
 *     plugin's own view of it — and the facade calls it once, with the name it
 *     read off the fiber. So `deliveries.deliver(...)` has no parameter for
 *     "who", and there is no arm of this file where one could be added.
 *   - **A registration carries its own undo.** Every `register` here is an
 *     `Effect.acquireRelease` on the calling plugin's scope, so a plugin whose
 *     `apply` died before it reached one installed nothing at all, and one that
 *     unloads unregisters exactly what it registered, in reverse.
 *
 * ## `log` is gone, and its absence is the phase
 *
 * There was a `Log` service with a `say` and a `warn`, wired by the composition
 * root to `ring(Effect.logDebug(line))` and `ring(Effect.logWarning(line))` — an
 * Effect run from a callback, per line, because the plugin had no fiber to emit
 * from. A plugin's `apply` IS a fiber now, so `Effect.logDebug` and
 * `Effect.logWarning` are what a plugin says its lines with, and they arrive
 * with the level the operator asked for, the annotations the serve set and the
 * span it was inside. WHICH LEVEL a sentence goes at is still the plugin's
 * decision and still the same one: routine narration at debug, because on a
 * machine that is not running the tool it is a line every few seconds and it is
 * not news; what the OWNER must read at warning, because the default console
 * level is `info`.
 *
 * ## What is NOT here
 *
 * No browser face, and the door's whole discipline is that: this module names
 * `@olai/effect-cordis`, `effect` and `./contract.ts`, so a process that renders
 * nothing can reach it. `./plugin.ts` — what a browser half is written against —
 * returns `JSX.Element` from every field and is deliberately on the other side
 * of the package.
 *
 * No `intercept` on the vault, either, and that is a phase and not an oversight:
 * the subtree write fence belongs on {@link Vault} as interception metadata, and
 * it arrives with node-agent scopes.
 */

import {
  broadcast,
  definePlugin,
  type Detach,
  detached,
  type Host,
  type Middleware,
  mountPlugin,
  openHost,
  type Plugin,
  PluginName,
  provide,
  serviceTag,
  waterfall,
} from "@olai/effect-cordis"
import { Effect, Scope } from "effect"

import {
  type ConversationSeen,
  type Deliveries as DeliveryDoor,
  kindWordOf,
  type PluginHeld,
  type Probed,
  type PropKind,
  type Wake,
} from "./contract.ts"

/** WHAT A PLUGIN IS WRITTEN WITH, re-exported so a server half opens ONE door.
 *
 *  A plugin that had to name `@olai/effect-cordis` for `definePlugin` and this
 *  package for its tags would be a plugin that knows there is a bridge — which
 *  is the one thing the bridge exists to stop being true. What it imports is
 *  olai's interface; that the interface is built on a translation of Cordis is
 *  this file's business and nobody else's. */
export { definePlugin, type Detach, detached, type Plugin, PluginName, serviceTag }

/**
 * WHAT THE PROCESS CAN SEE, plus the one seam a test fills.
 *
 * `vars` is what a plugin's rendezvous is decided from — `$PADI_SOCKET`,
 * `$OLAI_REPOS_DIR` — read here so a composition root is the one place a real
 * environment is reached for. A plugin that read `process.env` itself would be a
 * plugin a test cannot drive.
 *
 * `dial` is THE INJECTABLE, for a test: a fake padi, a fake coordinator,
 * whatever the calling plugin talks to. `unknown`, and the honesty of that is
 * the point rather than a gap — core cannot type a plugin's own test double
 * without learning what the plugin talks to, which is the one thing this whole
 * arrangement exists to prevent. It travels opaque and is narrowed by the
 * plugin, once, at its own edge.
 *
 * IT IS A VALUE AND NOT A LOOKUP, which is the stamp doing its job: the root
 * used to close over `dials[plugin.name]` and then a service read
 * `this.ctx.fiber.name` off a shadow. The provision resolves it once, from the
 * word the registry bound the fiber under, so a plugin cannot ask for another's
 * double by spelling its name — there is no name to spell. A fiber with no entry
 * gets `undefined`, which is every real serve.
 */
export interface Env {
  readonly vars: Record<string, string | undefined>
  readonly dial: unknown
}
export const Env = serviceTag<Env>("env")

/** THE CLOCK, as ISO-8601 — what a link's `since` is stamped from, and the
 *  reason a test that asserts "connected · just now" can own the instant it was
 *  rendered from.
 *
 *  SYNCHRONOUS, and deliberately not an Effect: a plugin hands `() =>
 *  clock.now()` to an appliance that is not written in Effect, and a clock that
 *  had to be run would put a fiber inside somebody else's callback for a value
 *  that is one function call. */
export interface Clock {
  readonly now: () => string
}
export const Clock = serviceTag<Clock>("clock")

/**
 * THE DIRECTORY THIS SERVE IS ABOUT, and the two doors its revisions ring.
 *
 * ## Why the served path is the vault's and not the environment's
 *
 * It is half of where a relative path in a property resolves to, and it is a
 * fact about the SERVE rather than about whoever asked — a plugin that read it
 * off the store would be a second answer to a question the composition root
 * already holds.
 *
 * ## The doors, and the one that is NOT teardown
 *
 * {@link revision} is rung once per published revision, carrying the whole
 * snapshot, and every listener narrows it in its own signature to the part it
 * reads. {@link unloaded} means THE STORE HAS NEVER PUBLISHED: a directory the
 * server can no longer see, so whatever a plugin derived FROM the vault is
 * yesterday's reading and says so, while what it holds from its own daemon is
 * untouched. A half that has teardown beyond its own registrations puts it in a
 * finalizer on its own scope, which is where the runtime looks for one; reading
 * `unloaded` as a teardown hook would disown a live daemon every time a disk
 * went away for a beat.
 *
 * ## HANDLERS, and not a `Stream`
 *
 * The phase's design says these two become `Stream`s, and they are not, for one
 * reason that outranks the shape: the root publishes a revision from inside the
 * directory binding's own connector, and the statements AFTER that line write
 * the collections, the heads and the roster off a world every plugin has
 * already re-derived. A `Stream` subscriber is a fiber of its own, so the
 * publisher could only offer and walk on — and "the vault moved, and every
 * reading of it has moved with it" would stop being one statement. So the door
 * takes a handler that answers an Effect and the publisher AWAITS every one of
 * them, in subscription order, which is exactly what the synchronous loop it
 * replaces did.
 *
 * What the Effect buys instead is the containment that loop never had: a
 * handler that dies is caught HERE, with the calling plugin's word on the line,
 * so one plugin throwing on a revision cannot take the later ones down with it
 * — nor the owned fiber that published it.
 */
export interface Vault {
  /** The directory, resolved — what every path answer downstream is relative
   *  to. */
  readonly served: string
  /** A published revision reached the store — for as long as this plugin is
   *  loaded. */
  readonly revision: (
    handler: (snapshot: unknown) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** ...and the store has never published. NOT teardown — see the header. */
  readonly unloaded: (
    handler: Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Vault = serviceTag<Vault>("vault")

/**
 * THE DOORBELL'S DOOR — which conversations opted into the CALLING plugin's
 * wakes, and the one write-only verb that reaches them.
 *
 * ## The keying is the fence, and there is no argument for it
 *
 * A door keyed by nobody would hand one plugin the conversations a person
 * scoped to another, and would let one plugin sign another's name onto a row
 * that reaches an agent. Neither verb here takes a plugin: the door was minted
 * from the word the registry bound this fiber under.
 *
 * ## Still write-only, and that is the load-bearing half
 *
 * There is no `read`, no `transcript`, no `history`, and there is no arm of this
 * service where one could be added without saying so in the type. A plugin can
 * put a sentence INTO a conversation and can never learn what is in one.
 *
 * ## `scopes` is synchronous and `deliver` is not
 *
 * The list is an in-memory table core mirrors, read from inside a doorbell's own
 * derivation — often from a heartbeat that is counting rows. The delivery is a
 * real effect on a conversation and answers an Effect, which is also what
 * carries a plugin's log lines and the chat's own fiber settings with it.
 *
 * ## The chat arrives LATE, and the door is asked for per call
 *
 * The plugin fibers mount before the store opens — they have to, because a
 * plugin teaches the vault its vocabulary and the store validates through it —
 * and the chat is built after. A serve with no ACP agent installed has no chat
 * at all and never will. Both are the same answer: `scopes()` is the empty list
 * and `deliver` is a no-op, which is the honest machine-without-the-tool state
 * and needs no failure channel on a verb that cannot fail.
 */
export interface Deliveries extends DeliveryDoor {}
export const Deliveries = serviceTag<Deliveries>("deliveries")

/**
 * WHAT THE PLUGINS TEACH THE VAULT'S VOCABULARY — a table the format takes as
 * data and never imports.
 *
 * ## The word is composed HERE, from the fiber
 *
 * A plugin contributes the bare kind `terminal` and a vault declares
 * `kolu-terminal`. The prefix is the plugin's word, read off the registry
 * binding and closed over by the provision, never off the row the caller handed
 * over — which is what makes a plugin's built-in declaration claim the key equal
 * to its own composed word and nothing else, and is why a person's own
 * `terminal` column is not something a flag on the machine can take over.
 *
 * ## Two plugins may not claim one word
 *
 * Prefixing makes that unreachable and it is counted anyway, because the
 * assembly underneath is a `Map.set` and a collision would resolve silently in
 * favour of whichever registered last — one plugin's `admits` quietly judging
 * another plugin's values, with nothing red anywhere. A collision DIES out of
 * `register`, which lands the offending fiber in `FAILED` with its siblings
 * untouched rather than killing the boot.
 */
export interface Kinds {
  /** Teach one word, for as long as the calling plugin is loaded. */
  readonly register: (kind: PropKind) => Effect.Effect<void, never, Scope.Scope>
}
export const Kinds = serviceTag<Kinds>("kinds")

/** ONE PLUGIN'S KIND, COMPOSED — its word prefixed with the plugin's name, and
 *  the KEY it claims by convention, which is that same word. What the format
 *  reads is this rather than the bare row a plugin wrote. */
export interface ComposedKind extends PropKind {
  readonly claims: string
  /** Which plugin taught it — read by the collision message and by nothing
   *  else. */
  readonly by: string
}

/**
 * ONE SIBLING SURFACE, as its plugin hands it over.
 *
 * The three fields that are a plugin's wire identity, plus what a composition
 * root needs to IMPLEMENT it: the deps (opaque here — the plugin annotates them
 * against its own spec inside its own package) and an optional hand-back for the
 * sibling's own write face.
 *
 * NO `name`. It used to be the first field of every one of these shapes and it
 * was always the same word twice: the plugin's manifest said it, the registry
 * keyed by it, and the composition root re-read it off the value it had already
 * filed. {@link Surfaces.register} takes it off the FIBER instead — so a half
 * cannot register under a name that is not the one it was mounted as, and there
 * is no line anywhere for the two to drift apart on.
 */
export interface Sibling {
  /** The plugin's own surface — a `Surface<Spec>`, opaque on this side of the
   *  wall for the reason `deps` is. */
  readonly surface: { readonly spec: unknown }
  /** Which of its members each face may see — its own `ExposeMap` per face,
   *  written against its own spec. */
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** This plugin's `ImplementSurfaceDeps`, against its own spec. */
  readonly deps: unknown
  /** This plugin's OWN ctx, handed back the moment its sibling is implemented.
   *  Absent on a half that writes to its members from inside the framework's own
   *  connectors and so has nothing to be handed. */
  readonly published?: (ctx: unknown) => void
}

/**
 * ...AND ONE AS THE COMPOSITION ROOT HOLDS IT — the sibling with the name the
 * fiber stamped on it.
 *
 * A separate type from {@link Sibling} rather than an optional field, because
 * the two are read by different people: a plugin writes the first and can never
 * write the second, and a root reads the second and never has to trust the first
 * about who it belongs to.
 */
export interface Registered extends Sibling {
  readonly name: string
}

/**
 * EVERY SIBLING SURFACE THIS SERVE COMPOSES — the registry a composition root
 * re-composes from, and the one service whose registrations move the wire.
 *
 * ## The re-composition is the ROOT's and not this service's
 *
 * A `recompose` inside the service would re-implement every SURVIVING sibling on
 * every register, so a plugin that had been serving since boot would get a new
 * runtime, new connectors and new channels because a different plugin arrived.
 * What this service does is hold the table and say when it moved; the root
 * composes existing runtimes with the new one and swaps what is served.
 *
 * ## What a live change reaches, and what it does not
 *
 * The roster cell moves and the fused group and handler record are replaced, so
 * nothing downstream is left holding the previous fusion. A CONNECTION that is
 * already open is a different matter: the framework takes a group and a handler
 * record at the moment it listens, and takes its sibling map at the call, so a
 * socket opened before the change keeps serving the roster it dialed. Until the
 * framework ask lands the documented contract is RECONNECT-PER-ROSTER-CHANGE,
 * and the roster cell moving is what tells a browser to.
 */
export interface Surfaces {
  /** Compose one sibling under the CALLING plugin's name, for as long as that
   *  plugin is loaded. Unloading it drops the sibling and re-composes, which is
   *  what makes `disabled` mean absent at every moment rather than only at boot:
   *  no tag, no handler, no expose row, and no `surface/<name>/` on the wire at
   *  all. */
  readonly register: (sibling: Sibling) => Effect.Effect<void, never, Scope.Scope>
}
export const Surfaces = serviceTag<Surfaces>("surfaces")

/**
 * WHICH PLUGINS RING AT ALL, and what each says when its doorbell stops
 * watching — the declaration `chat.scope` refuses a plugin for not having.
 *
 * It was a field on the server door read off the enabled halves at composition.
 * It is a registration now, for the reason every other one here is: a plugin
 * that unloads takes its declaration with it, so a scope written for a plugin
 * that is no longer mounted is refused by the same check that refuses one for a
 * plugin that never declared a wake — rather than by a second list somebody
 * remembered to update.
 */
export interface Wakes {
  readonly register: (wake: Wake) => Effect.Effect<void, never, Scope.Scope>
}
export const Wakes = serviceTag<Wakes>("wakes")

/**
 * CONVERSATION EVENTS, PUSHED — doorbells that landed, agent replies that
 * settled, turns that started or ended ({@link ConversationSeen}).
 *
 * A plugin that mirrors a conversation never READS one. Core pushes what
 * happened, and human messages are simply not among the events. `deliveries`
 * stays write-only; this is a second door, the other direction, and still not a
 * transcript.
 *
 * `subscribe` is a registration on the calling plugin's scope, so a plugin that
 * unloads stops being told — which is the part a hand-rolled bus gets wrong. The
 * handler is contained here rather than at every call, because a mirror that
 * died on one event must not take a conversation's turn down with it.
 */
export interface Watching {
  readonly subscribe: (
    handler: (event: ConversationSeen) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Watching = serviceTag<Watching>("watching")

/**
 * A SMALL RECORD THIS PLUGIN KEEPS about this serve, in the state home — not the
 * vault.
 *
 * Core owns the file and keys it by the calling plugin's word, the way the
 * doorbell's door is keyed and for the same reason: a record keyed by nobody
 * would let one plugin read and overwrite another's. What the record SAYS is the
 * plugin's; core does not open it.
 *
 * `load` is the last snapshot that landed, or `null` on a first serve and on a
 * file that would not parse (core has already warned). `save` is ORDERED:
 * successive snapshots of one in-memory state land in the order they were handed
 * over, so a drain that persisted `queue:[B]` and then `queue:[]` cannot have
 * the empty lose the rename race to the earlier one and come back on the next
 * boot as a digest already posted. THE DOOR IS MINTED ONCE per plugin, which is
 * what makes that true: it was minted per CALL, and the chain that orders the
 * writes lives on the door, so every save was starting a fresh chain and the
 * ordering the paragraph promised was not happening.
 */
export interface Held {
  readonly load: Effect.Effect<Record<string, unknown> | null>
  readonly save: (value: Record<string, unknown>) => Effect.Effect<void>
}
export const Held = serviceTag<Held>("held")

/**
 * ONE CONVERSATION OPENING, as the plugins fill it in — the waterfall that
 * replaced `probe()`.
 *
 * `probe` had to answer both halves at once, an invariant with an incident
 * behind it: a caller that asked once for the entry to hand over and again for
 * the sentence would start somebody's daemon twice per conversation and could
 * answer the two questions about two different instants. One dispatch per
 * session open is that invariant for free.
 *
 * ## THUNKS, and not answers
 *
 * A listener pushes what it would ask rather than what it found, and the reasons
 * are two. The list is collected per SESSION OPEN, so a plugin that unloaded
 * between conversations contributes nothing to the next one without anybody
 * keeping a second list. And the asking is then the caller's to schedule:
 * `@olai/chat` runs them with a bounded concurrency because a probe starts a
 * subprocess on the session-open path, and a waterfall that awaited each
 * listener in turn would multiply that window by the number of plugins — the
 * same defect the bound exists to prevent, with a different shape.
 */
export interface SessionStart {
  /** What to ask this host, one thunk per plugin that has something to ask.
   *
   *  IN NO ORDER, and the line that said otherwise is worth keeping as a
   *  warning: it read "pushed in dispatch order, which is registration order,
   *  which is the bundle's". The first two clauses are true and the third does
   *  not follow — a listener registers when its plugin's `apply` runs, and a
   *  row's `apply` runs when the loader's `import()` for that row comes back.
   *  Two rows raced, a conversation drew the winner, and the servers a session
   *  reported changed between boots of one serve.
   *
   *  A plugin pushing here may not assume where it lands, and nothing that READS
   *  this list may take the order it arrives in as meaningful. Ordering it is the
   *  composition root's, against the build's own list of rows, because that list
   *  is the one place a plugin's position is written down. */
  readonly asking: Array<{
    readonly name: string
    readonly ask: () => Promise<Probed>
  }>
}

/** THE WATERFALL ITSELF — `SessionStart.key` is what a plugin puts in its
 *  `needs`, and `SessionStart.open` is what the composition root holds. */
export const SessionStart = waterfall<SessionStart>("chat/session-start")

/** ONE LINK of it, for a plugin that wants to name the type. */
export type SessionStarting = Middleware<SessionStart>

/**
 * WHAT A COMPOSITION ROOT HOLDS — the other end of every door above, plus the
 * host the bundle is mounted on.
 *
 * The registries are READ here and WRITTEN by the plugins, which is why they are
 * two different shapes rather than one: `Kinds` has a `register` and no `table`,
 * and this has a `table` and no `register`. A plugin cannot read the vocabulary
 * and a root cannot teach it a word.
 */
export interface Plugins {
  /** Where the fibers hang — handed to `@olai/bundle` to mount the rows on, and
   *  opaque to everybody. */
  readonly host: Host
  /** Every word registered right now, composed. */
  readonly kinds: () => ReadonlyMap<string, ComposedKind>
  /** Every sibling composed right now, in registration order. */
  readonly composed: () => ReadonlyArray<Registered>
  /** What each ringing plugin declared, keyed by its name. A name with no entry
   *  is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: () => ReadonlyMap<string, Wake>
  /** TELL EVERY PLUGIN A REVISION LANDED, and wait for each of them — see
   *  {@link Vault}. */
  readonly published: (snapshot: unknown) => Effect.Effect<void>
  /** ...and that the store has none. */
  readonly quiet: Effect.Effect<void>
  /** One conversation event to every subscriber, in subscription order. */
  readonly saw: (event: ConversationSeen) => Effect.Effect<void>
  /** ONE DISPATCH of the session-start waterfall — see {@link SessionStart}. */
  readonly sessionStart: Effect.Effect<SessionStart>
}

/** WHAT THE ROOT SUPPLIES, which is everything a plugin must not reach for
 *  itself. */
export interface PluginsConfig {
  /** The variables, as the process was started with them. */
  readonly vars: Record<string, string | undefined>
  /** ISO-8601, now. */
  readonly now: () => string
  /** The directory this serve is about, resolved. */
  readonly served: string
  /** The chat's own door for one plugin, or `null` where there is no chat —
   *  asked PER CALL rather than captured, because the chat is built after the
   *  fibers are mounted. */
  readonly doorFor?: (plugin: string) => DeliveryDoor | null
  /** One plugin's machine-local record, by name — minted ONCE per plugin, which
   *  is what orders its writes. Where a machine keeps olai's own files is not a
   *  plugin's business. */
  readonly heldFor?: (plugin: string) => PluginHeld
  /** Told after every surface register and every dispose — the composition
   *  root's re-compose. Absent on a runtime nobody is serving from, which is
   *  every test that only wants the table. */
  readonly changed?: () => void
  /** One injectable per plugin, keyed by the plugin's name — a test's, never a
   *  product serve's. */
  readonly dials?: Readonly<Record<string, unknown>>
}

/**
 * OPEN THE PLUGIN RUNTIME — the host, the nine services on it, and the doors
 * back.
 *
 * SCOPED, because every `provide` is: the services stand for as long as the
 * enclosing scope is open, and a plugin whose service is revoked unloads. In a
 * serve that scope is the serve's, which is the whole process.
 *
 * NOTHING IS MOUNTED HERE. What plugins this build has is `@olai/bundle`'s
 * question, and it is asked of {@link Plugins.host} on the next line up — this
 * function has never heard of a row.
 */
export const openPlugins = (
  config: PluginsConfig,
): Effect.Effect<Plugins, never, Scope.Scope> =>
  Effect.gen(function*() {
    const host = yield* openHost

    yield* provide(host, Env, (plugin) => ({
      vars: config.vars,
      dial: config.dials?.[plugin],
    }))
    yield* provide(host, Clock, () => ({ now: config.now }))

    // THE THREE BUSES, and they are one primitive rather than three hand-rolled
    // copies of it ({@link @olai/effect-cordis}'s `broadcast`). Each holds its
    // handlers in subscription order, wraps every one of them ONCE with the
    // registering plugin's word, and AWAITS all of them when it is rung —
    // containment as a property of the bus rather than a discipline every plugin
    // is asked to keep, and one sentence rather than three.
    const revisions = broadcast<unknown>("a vault revision")
    const quieted = broadcast<void>("the vault going quiet")
    const seen = broadcast<ConversationSeen>("a conversation event")

    yield* provide(host, Vault, (plugin) => ({
      served: config.served,
      revision: revisions.listen(plugin),
      // The other door takes no value, so a plugin hands over the Effect itself
      // rather than a function of nothing.
      unloaded: (handler) => quieted.listen(plugin)(() => handler),
    }))

    yield* provide(host, Deliveries, (plugin) => ({
      scopes: () => config.doorFor?.(plugin)?.scopes() ?? [],
      // ASKED PER CALL and not captured — the chat is built after the plugins
      // are mounted, and a machine with no ACP agent never builds one at all.
      // What comes back is the chat's OWN Effect, straight through: there is no
      // bridge here, because both ends of this are Effects.
      deliver: (...args) =>
        Effect.suspend(() => config.doorFor?.(plugin)?.deliver(...args) ?? Effect.void),
    }))

    const kinds = new Map<string, ComposedKind>()
    yield* provide(host, Kinds, (plugin) => ({
      register: (kind) =>
        Effect.acquireRelease(
          Effect.suspend(() => {
            const word = kindWordOf(plugin, kind.kind)
            // UNCONDITIONALLY, including a plugin claiming its own word twice —
            // which is the reachable half on a well-formed bundle, since the
            // prefix IS the row's id and the loader will not mount two rows
            // under one. A plugin that unloads and comes back is not this case:
            // its finalizer took the word out of the table before its `apply`
            // ran again.
            const already = kinds.get(word)
            if (already !== undefined) {
              return Effect.die(
                new Error(
                  `plugins: "${already.by}" and "${plugin}" both contribute the property `
                    + `kind "${word}" — a vault declaring it would be judged by whichever `
                    + "was composed last, which the assembly resolves silently.",
                ),
              )
            }
            kinds.set(word, { ...kind, kind: word, claims: word, by: plugin })
            return Effect.succeed(word)
          }),
          (word) => Effect.sync(() => void kinds.delete(word)),
        ).pipe(Effect.asVoid),
    }))

    const siblings = new Map<string, Registered>()
    yield* provide(host, Surfaces, (plugin) => ({
      register: (sibling) =>
        Effect.acquireRelease(
          Effect.suspend(() => {
            if (siblings.has(plugin)) {
              return Effect.die(
                new Error(
                  `plugins: "${plugin}" registered a second sibling surface — a plugin is `
                    + "one sibling under one key, and the second would silently replace the "
                    + "first.",
                ),
              )
            }
            siblings.set(plugin, { ...sibling, name: plugin })
            try {
              config.changed?.()
            } catch (refused) {
              // THE ENTRY GOES BEFORE THE THROW DOES, and this is the one place
              // it can: a failure in `acquire` is a resource that was never
              // acquired, so the release below never runs and the entry would
              // stay.
              //
              // What that cost is worth spelling out, because it is not the
              // obvious one. The refusing plugin lands `FAILED`, which is what
              // the containment claim says — and its sibling was still in the
              // table, so the NEXT plugin to register re-ran the composition
              // root's re-compose, which retried the same refused mount and
              // threw inside THAT plugin's `apply`. One mis-shaped surface took
              // down every plugin that arrived after it, each failing on
              // somebody else's refusal, and the table went on reporting the
              // refused one as composed to a roster that draws it.
              //
              // NOT re-notified on the way out: the root never mounted this
              // sibling, so deleting it puts the table back exactly where the
              // last successful composition left it and there is nothing for a
              // re-compose to do.
              siblings.delete(plugin)
              return Effect.die(refused)
            }
            return Effect.void
          }),
          () =>
            Effect.sync(() => {
              siblings.delete(plugin)
              config.changed?.()
            }),
        ).pipe(Effect.asVoid),
    }))

    const wakes = new Map<string, Wake>()
    yield* provide(host, Wakes, (plugin) => ({
      register: (wake) =>
        Effect.acquireRelease(
          Effect.sync(() => void wakes.set(plugin, wake)),
          () => Effect.sync(() => void wakes.delete(plugin)),
        ),
    }))

    yield* provide(host, Watching, (plugin) => ({ subscribe: seen.listen(plugin) }))

    yield* provide(host, Held, (plugin) => {
      // ONCE PER PLUGIN, not once per call — the write chain that orders the
      // saves lives on the door, so a door minted per call is a door that orders
      // nothing.
      const door = config.heldFor?.(plugin) ?? null
      return {
        load: Effect.sync(() => door?.load() ?? null),
        save: (value) => Effect.sync(() => void door?.save(value)),
      }
    })

    const sessionStart = yield* SessionStart.open(host)

    return {
      host,
      kinds: () => new Map(kinds),
      composed: () => [...siblings.values()],
      declared: () => new Map(wakes),
      published: revisions.tell,
      quiet: quieted.tell(undefined),
      saw: seen.tell,
      sessionStart: Effect.suspend(() => sessionStart({ asking: [] })),
    }
  })

/** MOUNTING ONE PLUGIN DIRECTLY, which is what a plugin's own BENCH does — the
 *  bundle's rows are `@olai/bundle`'s business and it opens the bridge itself.
 *  Re-exported here so a plugin package can drive its own half without declaring
 *  the bridge: a plugin that had to name `@olai/effect-cordis` to test itself
 *  would be a plugin that knows there is one. */
export { mountPlugin }
export type { Host }

export type {
  ConversationSeen,
  Deliveries as DeliveryDoor,
  NotHere,
  PluginHeld,
  Probed,
  PropKind,
  StdioServer,
  Wake,
} from "./contract.ts"
export { exposeMapsOf, kindWordOf, surfacesOf } from "./contract.ts"
