/**
 * THE SERVICES A SERVER HALF NAMES — the whole of what core offers a plugin,
 * and the door a plugin's `./server` opens.
 *
 * ## What a plugin is now, in one breath
 *
 * ```ts
 * export default definePlugin({
 *   name,
 *   needs: [Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
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

import type { Engine, Registering } from "@olai/acp/engine"
import {
  type AnyKey,
  broadcast,
  type Host,
  openHost,
  provide,
  type Provision,
  registry,
  roster,
  serviceTag,
  type ServiceKey,
} from "@olai/effect-cordis"
import { Deferred, Effect, Exit, Scope } from "effect"

import {
  type ConversationSeen,
  type Deliveries as DeliveryDoor,
  kindWordOf,
  type MintedTicket,
  NO_TICKET,
  NOWHERE_TO_WRITE,
  type PluginHeld,
  type Probed,
  type PropKind,
  type PropWrite,
  type Refusal,
  type Refused,
  type Seated,
  type Wake,
} from "./contract.ts"

/** WHAT A PLUGIN IS WRITTEN WITH, re-exported so a server half opens ONE door —
 *  {@link ./runtime.ts}, which is the same list `./index.ts` hands the browser
 *  half and which argues there why it is one list. */
export * from "./runtime.ts"

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
  /**
   * A published revision reached the store — for as long as this plugin is
   * loaded.
   *
   * THE PAYLOAD IS THE HANDLER'S TO NAME, and each of the three halves that
   * takes one names a different part of it: a snapshot carries the whole
   * published world, and no plugin wants all of it. So the narrowing is
   * INFERRED from the handler's own signature and written in the plugin's own
   * file, which is where a reader looking for what this half reads would go.
   *
   * ## THE ANNOTATION IS A CLAIM, NOT A CHECK. Say it plainly.
   *
   * `A` is free — the CALLER picks it — so nothing holds a handler's parameter
   * type against what the root actually rings, and the provision below satisfies
   * this signature with one `as`. A half that named a field the snapshot does
   * not carry would compile and read `undefined` at runtime, exactly as it would
   * have through the cast this replaced.
   *
   * What changed is the count and the honesty, not the soundness. It was
   * `unknown`, and all three halves opened with the same `snapshot as
   * VaultRevision` under a paragraph saying the compiler had checked it: three
   * casts and three copies of a false sentence. There is one `as` now, in the
   * provision, and the plugins' paragraphs say what they are doing.
   *
   * A CHECKED version needs a type both ends can spell, and the shape is
   * `@olai/format`'s (`OutlineSet`, `Derived`) — which this package refuses as a
   * dependency for the reason its manifest gives: the kind table travels as
   * DATA, and a floor package importing the vocabulary would be the format
   * learning what a terminal is. Naming the fields structurally instead would
   * not help, because `derived: unknown` is not assignable to `derived: Derived`
   * and every half would be back to a cast. The sound version is a schema the
   * root supplies and each half DECODES, which can fail and so is a behaviour
   * change rather than a signature.
   */
  readonly revision: <A>(
    handler: (snapshot: A) => Effect.Effect<void>,
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
 *
 * ## ...AND IT IS THE ONE REGISTRY WITH A READ SIDE ON THE PLUGIN'S DOOR
 *
 * Every other table on this page is written by plugins and read only by a
 * composition root, and the asymmetry is the fence: a plugin cannot read the
 * vocabulary, cannot enumerate the siblings, cannot list the engines. This one
 * is different because the thing that ASKS the question is moving.
 *
 * `chat.scope` refuses a scope written for a plugin that declared no wake, and
 * the fault walk composes a doorbell's two broken-scope sentences out of the same
 * table. Both are the CHAT's readings, and the chat is becoming a row — so either
 * this door grows a read side or those two procedures stay behind in a
 * composition root that has stopped owning them.
 *
 * READ AFRESH, in the grain of {@link Plugins.sessionStart} and for the same
 * reason: a plugin that unloaded between one scope check and the next has taken
 * its declaration with it, and a caller holding a snapshot would go on offering
 * a doorbell nobody is behind.
 *
 * It is a READ and not a capability. What comes back is what plugins declared
 * about themselves — the sentence the strip draws and the two a broken scope is
 * owed — and there is no arm of it that reaches a conversation, a vault or
 * another plugin's registrations.
 */
export interface Wakes {
  readonly register: (wake: Wake) => Effect.Effect<void, never, Scope.Scope>
  /** What every ringing plugin declared right now, keyed by its name. A name
   *  with no entry is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: Effect.Effect<ReadonlyMap<string, Wake>>
}
export const Wakes = serviceTag<Wakes>("wakes")

/**
 * WHICH ACP ENGINES THIS BUILD CAN SEAT — one registration per engine plugin,
 * and the table `olai-plugin-chat`'s roster is read off.
 *
 * ## What it replaced, and why the shape had to change
 *
 * A hardcoded `KINDS` array in `olai-plugin-chat`, three rows deep, with
 * `@olai/surface`'s `AGENTS` beside it as a closed union so that every table
 * keyed by an agent id — the picker's rows, the install face, the marks, the
 * memory's fallback — was keyed by a type only a core PR could widen. A fourth
 * engine was an edit in two general packages plus a nix patch set; a THIRD
 * engine's adapter bump was an edit in a file the other two share.
 *
 * The engines are plugins now, and the three arguments for that are the same
 * three the tenants make. They share no release clock (the Claude adapter's pin
 * moved five times in a month and opencode's has never moved). `--plugins`
 * enables them one at a time, so `--plugins=opencode,pi` is a serve with no
 * Claude row, no probe of it, and no mark for it anywhere. And each brings its
 * own adapter pin, its own patches and its own install sentence into its own
 * directory, so nothing general spells an engine at all.
 *
 * ## What a registration is, and what it deliberately is NOT
 *
 * {@link Registering} — a name a person reads, the leg that reads this agent's
 * wire, a probe that answers `Adapter | null` for this host, and the channel its
 * standing prompt rides. NOT how a person GETS it: that sentence rode this
 * registration for one revision and was read by nothing, because the face that
 * draws it is the engine's own browser half's (`engine.install`).
 * The ID IS THE FIBER'S WORD and there is no field for one, so a plugin cannot
 * register under another's name.
 *
 * What is NOT here is anything about a CONVERSATION. An engine plugin does not
 * spawn, does not send, does not remember and never sees a transcript: it hands
 * over data and pure functions, and `olai-plugin-chat` does the talking. That is the
 * same wall {@link Deliveries} keeps from the other side.
 *
 * ## Two plugins may not claim one id, which is unreachable and counted anyway
 *
 * The id is the row's, and the loader will not mount two rows under one word —
 * so the reachable case is a plugin registering twice, which is a mistake in
 * that plugin. It DIES out of `register`, landing that fiber in `FAILED` with
 * its siblings untouched, exactly as the three registries above it do.
 */
export interface Agents {
  /**
   * Offer this engine, for as long as the calling plugin is loaded.
   *
   * READ ONCE, WHEN THE CHAT IS BUILT, and the sentence that said otherwise is
   * worth keeping as a warning: it read "unloading it takes the row out of the
   * picker". The registry entry is genuinely scope-held and disappears from
   * `Plugins.engines()` on unload — but `olai-plugin-chat` is handed a LIST at
   * `Chat.make` and holds it for the life of the process, on purpose
   * (`agents/roster.ts`'s "Once, at the start": re-deciding the roster under a
   * reader would flip the panel's whole face while somebody was using it). So
   * an engine plugin that unloads leaves its row in a chat already built, and a
   * promise this door could not keep is worse than the bargain it can: **an
   * engine offered mid-serve is offered by the next start.**
   *
   * The BROWSER half is the half that does unwind — its faces are finalizers on
   * its own scope, so a mark and an install sentence do leave the tab. The
   * asymmetry is real and is the roster's, not this door's.
   */
  readonly register: (engine: Registering) => Effect.Effect<void, never, Scope.Scope>
}
export const Agents = serviceTag<Agents>("agents")

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
 * boot as a digest already posted. THE DOOR IS MINTED ONCE PER PLUGIN NAME, which
 * is what makes that true: the chain that orders the writes lives on the door, so
 * a second door is a second chain and orders nothing against the first.
 *
 * It was minted per CALL — every save started a fresh chain and the ordering this
 * paragraph promised was not happening at all — and then per ACTIVATION, which
 * closed the reachable half and left the other one open: a plugin that unloads
 * and comes back is two fibers writing ONE FILE, and the file does not care which
 * fiber a snapshot came from. Keyed by the NAME, because the name is what the
 * file is keyed by.
 */
export interface Held {
  readonly load: Effect.Effect<Record<string, unknown> | null>
  readonly save: (value: Record<string, unknown>) => Effect.Effect<void>
}
export const Held = serviceTag<Held>("held")

/**
 * WHAT TO ASK THIS HOST WHEN A CONVERSATION OPENS — the door that replaced
 * `probe()`.
 *
 * `probe` had to answer both halves at once, an invariant with an incident
 * behind it: a caller that asked once for the entry to hand over and again for
 * the sentence would start somebody's daemon twice per conversation and could
 * answer the two questions about two different instants. ONE READING per session
 * open is that invariant for free — {@link Probed}'s two fields come off one
 * answer, because there is only one answer in hand to read.
 *
 * ## WHAT IS REGISTERED IS THE ASKING, and not the answer
 *
 * A plugin hands over the Effect it WOULD run rather than what it found, and the
 * reasons are two. The list is collected per SESSION OPEN, so a plugin that
 * unloaded between conversations contributes nothing to the next one without
 * anybody keeping a second list. And the asking is then the caller's to
 * schedule: `olai-plugin-chat` runs them with a bounded concurrency because a probe
 * starts a subprocess on the session-open path, and running them one after
 * another would multiply that window by the number of plugins — the same defect
 * the bound exists to prevent, with a different shape.
 *
 * ## THE TWO THINGS THIS DOOR USED TO HAVE THAT NO OTHER DID
 *
 * A plugin SIGNED ITS OWN NAME here — `start.asking.push({ name, ask })` — where
 * every other keyed door reads the word off the fiber and gives the caller no
 * parameter to put one in. And `ask` answered a PROMISE, where everything else a
 * plugin hands over is an Effect.
 *
 * Both were the same fact about the shape: it was a WATERFALL over a plain
 * record, so what a link put in the record was whatever the record's type said,
 * and neither the stamp nor the effect channel was anything the door could
 * enforce. Both are gone, and what fixed them is that this stopped being a
 * waterfall.
 *
 * ## Why a keyed REGISTRATION rather than a waterfall
 *
 * The waterfall's own powers — transform what the later links see, decline to
 * call through and short-circuit the rest — were never used here and could not
 * honestly be: the order the links run in is the order two dynamic imports came
 * back in, so a link that short-circuited would silence a set of plugins that
 * moved between boots. What this event actually is is a COLLECTION, and a
 * collection keyed by the calling plugin is the shape every other door on this
 * page already has: `Kinds`, `Wakes`, `Watching`, `Surfaces`.
 *
 * So the name is stamped by the provision, out of the word the registry bound
 * the fiber under, and there is no parameter to put one in; the registration is
 * a finalizer on the calling plugin's scope, so a plugin that unloads stops
 * being asked; and `ask` is an Effect because everything a plugin hands core is.
 *
 * The waterfall PRIMITIVE stays where it was (`@olai/effect-cordis`), because it
 * is the translation of a Cordis dispatch mode rather than this event's
 * mechanism — the delivery policy the design names next (`chat/deliver`, whose
 * rules genuinely do short-circuit one another) is what it is for.
 */
export interface SessionStart {
  /**
   * Ask this host, once per conversation opening, for as long as the calling
   * plugin is loaded.
   *
   * IT NEVER FAILS: every way of failing is an ARM of {@link Probed}, which is
   * the whole reason that type has two fields rather than an error channel —
   * "the tool is not here" is an answer and not a fault, and "it is here and
   * would not work" is a SENTENCE somebody has to read.
   *
   * AND NOTHING CONTAINS A PROBE THAT DIES, which is why the type is the whole
   * of the contract rather than a preference. This line used to end "a probe
   * that dies is contained by the caller and costs that plugin its row", and no
   * such containment exists: the chain from here is `askingAt`
   * (`@olai/server`'s `probes.ts`) into `olai-plugin-chat`'s `probed`, which is an
   * `Effect.forEach` with no `catchAllDefect` anywhere on it, and its answer is
   * awaited inside `session/new`. So a defect here does not cost one plugin its
   * row — it fails the conversation open, for every plugin and for the person.
   *
   * Answer the arms. A probe that cannot say what it found says
   * `{ server: null, missing: … }` and describes the failure in `missing.why`,
   * which is the sentence somebody reads; a probe that throws is a bug in that
   * plugin with a blast radius this door cannot shrink for it.
   */
  readonly ask: (probe: Effect.Effect<Probed>) => Effect.Effect<void, never, Scope.Scope>
}
export const SessionStart = serviceTag<SessionStart>("session-start")

/**
 * ONE THING TO ASK, as the collector holds it — the plugin's own word and the
 * Effect it registered.
 *
 * THE NAME IS FOR THE LOG LINE and for the ORDER, and for nothing else. What a
 * roster row is called comes off the ANSWER, where whoever found the server
 * named it.
 *
 * IN NO ORDER, and the line that said otherwise is worth keeping as a warning:
 * it read "pushed in dispatch order, which is registration order, which is the
 * bundle's". The first two clauses were true and the third does not follow — a
 * plugin registers when its `apply` runs, and a row's `apply` runs when the
 * loader's `import()` for that row comes back. Two rows raced, a conversation
 * drew the winner, and the servers a session reported changed between boots of
 * one serve. Nothing that reads {@link Plugins.sessionStart} may take the order
 * it arrives in as meaningful; imposing one is the composition root's, against
 * the build's own list of rows.
 */
export interface Asked {
  readonly name: string
  readonly ask: Effect.Effect<Probed>
}

/**
 * THE FOUR DOORS A ROW MAY STAND BEHIND — a CLOSED table, and the closedness is
 * most of the safety.
 *
 * Only these four are promises a plugin can keep: what engines this build seats,
 * where a doorbell may deliver, what a plugin may be told a conversation did, and
 * what to ask this host when one opens. Every other service on this page is a
 * fact about the process, the vault or the machine, which core knows before any
 * row is mounted — so there is nothing a row could offer that core is not already
 * a better answer for, and everything to lose by letting one try.
 */
export const OFFERABLE = [Agents, Deliveries, SessionStart, Watching] as const

/**
 * THE ONE CAPABILITY A PLUGIN MAY NAME — standing behind a service key that OTHER
 * plugins name, for as long as the offering plugin is loaded.
 *
 * ## Against a written ruling, and narrower than the thing it was written about
 *
 * {@link ./runtime.ts} withholds `openHost` and `provide`, and the argument there
 * is sharper than "a plugin could provide itself what it names": `mountPlugin` IS
 * on that door and its first argument is a `Host`, while the per-plugin stamp is
 * `ctx.fiber.name` read once with no parameter anywhere. A plugin holding a host
 * could mount `{ name: "kolu", … }` and every keyed service in this file would
 * stamp its registrations `kolu`. The forgery the whole keying design exists to
 * prevent is one export away, and is unreachable today only because no plugin can
 * obtain a host.
 *
 * So a plugin gets `offer`, never `provide`, and it is narrower in four ways:
 *
 *   - THE KEY SET IS CLOSED ({@link OFFERABLE}). Core's own tags can never be
 *     shadowed, replaced or raced by a row.
 *   - THERE IS NO HOST. It is closed over in `openPlugins`, in the package the
 *     ruling names as the one that spends the capability.
 *   - IT IS REFUSABLE, IN OLAI'S WORDS. Cordis refuses a second provide on its
 *     own, and its sentence is `service "deliveries" has been registered at
 *     <root>` — which names neither author and points at a fiber no person has
 *     heard of. The claim is taken here FIRST, so a refused offer never reaches
 *     cordis and what a person reads names both rows and the key.
 *   - IT IS IN `needs`. A plugin that stands behind a door SAYS SO in the one
 *     list a reader, the fence and `@olai/bundle`'s table all read — and the
 *     standing unwinds with the plugin, because `provide` is an `acquireRelease`
 *     on the CALLING fiber's scope and inside an `apply` that scope is the
 *     plugin's.
 *
 * ## Why FOUR OVERLOADS and not one generic
 *
 * Because `ServiceKey` and `Provision` are NOT on a plugin's door, and this is
 * the door that would have put them there. A generic `offer<S>(key:
 * ServiceKey<S>, door: Provision<S>)` is spellable only by a caller who can name
 * both, so every offering plugin would import the bridge's own type vocabulary to
 * write one line — which is the arrow {@link ./runtime.ts} exists to be the only
 * one of. Four overloads land the same cast at the provision and let a plugin
 * write `(who) => ({ … })` and nothing else. It is `./browser.ts`'s `Slots`
 * shape, one level up.
 */
export interface Offers {
  /** Stand behind one door, for as long as the calling plugin is loaded. */
  readonly offer: {
    (key: typeof Agents, door: Provision<Agents>): Effect.Effect<void, never, Scope.Scope>
    (
      key: typeof Deliveries,
      door: Provision<DeliveryDoor>,
    ): Effect.Effect<void, never, Scope.Scope>
    (
      key: typeof SessionStart,
      door: Provision<SessionStart>,
    ): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Watching, door: Provision<Watching>): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Offers = serviceTag<Offers>("offers")

/**
 * AN MCP SERVER TO HAND A SESSION, in olai's terms — the vault's own tools, as an
 * address and a bearer token.
 *
 * ## Re-declared here rather than imported, and that is the fence rather than a
 * ## duplication
 *
 * The shape is `olai-plugin-chat`'s (`agent.ts`'s `ToolServer`, which `mcpServersOf`
 * renders into what the protocol wants). This package may not import it and never
 * will: `olai-plugin-chat` is on its way to being a ROW, and a core tag that imported a
 * plugin-to-be would be the registry arrow pointing backwards — the exact cycle
 * `@olai/plugin-api` names no plugin in order to avoid.
 *
 * Three fields, structurally identical, and contravariance makes the agreement
 * the STRONG direction: whoever completes {@link PluginsConfig.tools} hands over
 * a value that has to satisfy both spellings at the composition root, so a drift
 * between them is a type error in the one file that holds both.
 */
export interface ToolServer {
  readonly name: string
  readonly url: string
  /** Presented as a bearer token. The route is on the same loopback listener as
   *  everything else, and a WRITE surface any page could POST at is a different
   *  bargain from a read-only one. */
  readonly token: string
}

/**
 * THE VAULT'S OWN MCP TOOL SERVER, once the listener has bound.
 *
 * AN EFFECT THAT WAITS, and that is the design rather than a convenience. The
 * address is not knowable until `listen` returns, which is long after every
 * plugin fiber was mounted — so the tag is PROVIDED EARLY and RESOLVED LATE.
 *
 * The earliness is load-bearing and it has a defect behind it. A plugin naming a
 * key nobody has provided sits PENDING, and the vocabulary is read two statements
 * after the bundle is mounted — so a `Tools` that only appeared after `listen`
 * would leave every plugin that named it un-applied at exactly the moment the
 * store's codec is built, and the codec holds its answer for the life of the
 * process. A tenant's property kind would go missing from a serve, silently,
 * until the next start.
 *
 * READING IT IS ALSO THE ONE SIGNAL CORE HAS THAT THE SERVE IS UP, which is what
 * a boot conversation wants to be gated on: the composition root's hand-kept
 * "the chat is built, the surface is bound, and only then is the agent started"
 * becomes an Effect dependency that a reader can see rather than a comment
 * guarded by a loud throw.
 */
export interface Tools {
  readonly server: Effect.Effect<ToolServer>
  /**
   * ...AND A CREDENTIAL THAT NARROWS IT TO ONE SUBTREE, for one session.
   *
   * The write fence phase 6 built: a node agent writes strictly inside its own
   * subtree and asks its ancestor for anything above. The ENFORCEMENT is
   * `@olai/ops`', between `plan` and `commit`; the CHANNEL is a bearer the MCP
   * route resolves per request; and what is minted here is the pairing of the
   * two, so a session handed this bearer reaches a door that is the same face
   * with a fence on it.
   *
   * TWO FUNCTIONS AND NOT TWO VALUES, and both are read per request rather than
   * closed over. `seated` is asked because a session's subtree may be re-pointed
   * under it, and `above` because the ancestor a refusal names is a reading of a
   * vault that moves — which is exactly the reading the plugin holding the
   * sessions has and core does not.
   *
   * `release` is the session's own teardown, and it is the whole point of the
   * ticket being a value: reaping a node scope drops its MCP footprint in the
   * same breath rather than leaving a bearer alive for a session that is gone.
   */
  readonly ticket: (
    seated: () => Seated,
    above: (node: string) => string | null,
  ) => MintedTicket
}
export const Tools = serviceTag<Tools>("tools")

/**
 * THE VAULT'S WRITE GATE, as narrow as the gestures that need it.
 *
 * ## What this is, and the door it deliberately is NOT
 *
 * `@olai/server`'s `runtime.ts` composed three things a plugin now owns: the
 * reading a message's armed ids are resolved against, the property write that
 * binds a node to a conversation, and the refusal a person sees in their
 * transcript when a tool call was turned down. All three were composed there
 * because that was the only place both halves were in hand — and a plugin that
 * owns the conversation owns one of the halves.
 *
 * It is NOT `Ops` handed over. {@link PropWrite} is one key on one node, and
 * {@link reading} answers a value rather than the layer that produced it, so
 * nothing behind this door can trash, move or commit. What judges the write is
 * unchanged: the same planner, the same validator, the same ledger commit a
 * keystroke goes through, under the writer the composition root bound.
 *
 * ## THE READING IS OPAQUE, and it is {@link Vault.revision}'s bargain
 *
 * A reading is `@olai/format`'s `Reading`, which this package refuses as a
 * dependency for the reason its manifest gives. So the value travels `unknown`
 * and the plugin narrows it once, at its own edge, in its own file — which is
 * where a reader looking for what a half reads would go. As with the revision
 * door, the narrowing is a CLAIM and not a check, and this sentence is here so
 * nobody has to find that out.
 */
export interface Ops {
  /** THE READING every write is resolved against — one answer to "there is
   *  nothing loaded yet", shared with the tools and with a keystroke. */
  readonly reading: Effect.Effect<unknown>
  /** ONE PROPERTY, WRITTEN — see {@link PropWrite} on why the door is the
   *  gesture's shape rather than the layer's. */
  readonly prop: (write: PropWrite) => Effect.Effect<void, Refusal>
  /** A WRITE THIS SERVE REFUSED, for as long as the calling plugin is loaded.
   *
   *  ON THE WRITE GATE and not on the MCP server, because it is WRITES this is
   *  a property of: a second writer would report nothing. What a plugin makes of
   *  it is its own — the chat draws a row in the transcript, so what the agent
   *  then says about the refusal is prose and the unfinished children are data.
   *
   *  Contained here, like every other bus on this page: a handler that dies
   *  costs its plugin a line rather than the write its answer was about. */
  readonly refused: (
    handler: (refusal: Refused) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Ops = serviceTag<Ops>("ops")

/**
 * WHERE A PLUGIN SITS IN THE BUILD'S OWN LIST OF ROWS.
 *
 * Registration order is the order two dynamic `import()`s came back in — a fact
 * about the filesystem and the module cache on the day rather than about
 * `olai.yml` — and {@link Asked} records what that cost: a person reads these
 * lists, and a list that reshuffles itself between boots is a list nobody can
 * read twice. There is an e2e failure behind that sentence.
 *
 * Imposing the bundle's order was the composition root's job while the root owned
 * the tables. A plugin that owns them owns the readings, and it may not import
 * `@olai/bundle` — the registry imports every plugin, so the arrow cannot point
 * back. So the rank arrives as DATA, the same way the kind vocabulary does.
 *
 * A RANK AND NOT A ROW LIST, deliberately. `rows(): ReadonlyArray<string>` would
 * answer every question this one does and one more — who my siblings are — and
 * nothing in this tree should hand a plugin that. The next reader would key
 * something by it.
 *
 * A stranger ranks LAST rather than first, which is what an out-of-tree plugin
 * will want the day `olai plugin add` lands.
 */
export interface Bundle {
  readonly rank: (plugin: string) => number
}
export const Bundle = serviceTag<Bundle>("bundle")

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
  /** ONE REFUSED WRITE to every subscriber, in subscription order — see
   *  {@link Ops.refused}. Rung by whoever owns the write gate, which is the
   *  composition root; nothing on this page can refuse a write. */
  readonly refused: (refusal: Refused) => Effect.Effect<void>
}

/**
 * WHAT THE ROOT SUPPLIES, which is everything a plugin must not reach for
 * itself.
 *
 * ## Why it is one field per service rather than a shape
 *
 * Because the alternative is the composition root calling `provide(host,
 * Deliveries, plugin => …)` for itself, which puts the PER-PLUGIN KEYING back in
 * the root — and the keying is the fence. One package decides what a plugin's
 * own view of a service is; this interface is the price of that, and the price
 * is a field count.
 *
 * ## The late one is {@link ./runtime.ts}'s `Provision`, spelled
 *
 * `heldFor` is `(plugin: string) => X`, which is the bridge's own name for
 * exactly that. It is typed with it rather than re-described, so a reader who has
 * met the shape once meets it once.
 *
 * ## ONE ANSWER TO "NOT READY YET", and this file no longer holds a second
 *
 * `./browser.ts` answers it with a SECOND PROVIDE — `App.furnish` provides the
 * chrome services later, and a half that beat the call simply sits `waiting` on
 * the runtime.s own PENDING mechanism. This file used to answer it a second way,
 * with a LOOKUP ASKED PER CALL, so `deliveries` was always present and answered
 * `[]` and a no-op where there was no chat.
 *
 * The fear behind that was a provider that might never exist: a machine with no
 * ACP agent builds no chat, and kolu and odu would sit PENDING for ever. What
 * answered it is that a chat is a ROW: the row always mounts, and the emptiness
 * moved inside the door — `scopes()` is the empty list and `deliver` is a no-op,
 * which is the same honest machine-without-the-tool answer, one closure further
 * in. A serve composed with no chat row is a different thing and is a RULING
 * rather than a defect: kolu sits `waiting`, and its row says on whose account.
 *
 * So the lookup is gone, and with it the field that fed it. PENDING is the
 * answer on both faces now.
 */
export interface PluginsConfig {
  /** The variables, as the process was started with them. */
  readonly vars: Record<string, string | undefined>
  /** ISO-8601, now. */
  readonly now: () => string
  /** The directory this serve is about, resolved. */
  readonly served: string
  /** One plugin's machine-local record, by name — minted ONCE per plugin, which
   *  is what orders its writes. Where a machine keeps olai's own files is not a
   *  plugin's business. */
  readonly heldFor?: Provision<PluginHeld>
  /**
   * THE VAULT'S MCP SERVER, COMPLETED AFTER `listen` — see {@link Tools}.
   *
   * A `Deferred` rather than a value or a thunk, because the two facts about it
   * are "not knowable yet" and "knowable exactly once", and that is what a
   * Deferred IS. A thunk answering `ToolServer | null` would put the waiting back
   * on every caller and give each of them a null arm to invent an answer for.
   *
   * OPTIONAL, and absent means NO LISTENER EVER: a root that serves nothing (the
   * headless faces, every bench in this tree) has no address, so {@link
   * Tools.server} never settles and a plugin gated on it stays gated. That is the
   * honest reading rather than a fabricated address, and it is not a failure —
   * nothing in a process with no listener was going to talk to one.
   */
  readonly tools?: Deferred.Deferred<ToolServer>
  /**
   * ...AND THE FENCED CREDENTIAL MINTED OFF IT — see {@link Tools.ticket}.
   *
   * A THUNK rather than a value, and it answers `null` until the listener has
   * bound, for the reason the address above is a `Deferred` and this is not: a
   * ticket is minted per SESSION, at a moment the plugin chooses, and a plugin
   * that spawned one before there was a face to fence would be asking for a
   * bearer onto nothing. `null` is that state said out loud, and the one caller
   * refuses to seat a session on it rather than inventing one.
   *
   * OPTIONAL, and absent means NO FENCE EVER — the headless faces and every
   * bench, which have no MCP face to narrow.
   */
  readonly ticketFor?: (
    seated: () => Seated,
    above: (node: string) => string | null,
  ) => MintedTicket | null
  /**
   * THE VAULT'S WRITE GATE, as narrow as the two gestures that need it — see
   * {@link Ops}.
   *
   * OPTIONAL, and absent means NO VAULT IS BEING WRITTEN: a root with no store
   * behind it (every bench that only wants the table) answers a reading of
   * nothing and refuses a write, which is what a plugin asking one of a process
   * that serves no directory should be told.
   */
  readonly ops?: Pick<Ops, "reading" | "prop">
  /**
   * WHERE EACH PLUGIN SITS IN THE BUILD'S LIST OF ROWS — see {@link Bundle}.
   *
   * OPTIONAL, and absent means ONE RANK FOR EVERYBODY: a root with no bundle
   * behind it has no list to be a position in, and `Array.prototype.sort` is
   * stable, so a plugin sorting by it gets arrival order back. A default of `0`
   * rather than a refusal, because "this root has no opinion" is a real state
   * (every bench here) and not a misconfiguration.
   */
  readonly rank?: (plugin: string) => number
  /** Told after every surface register and every dispose — the composition
   *  root's re-compose. Absent on a runtime nobody is serving from, which is
   *  every test that only wants the table. */
  readonly changed?: () => void
  /** One injectable per plugin, keyed by the plugin's name — a test's, never a
   *  product serve's. */
  readonly dials?: Readonly<Record<string, unknown>>
}

/**
 * OPEN THE PLUGIN RUNTIME — the host, the services on it, and the doors back.
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
      // THE ONE ASSERTION, and it used to be three — one in each plugin, each
      // under a paragraph saying the compiler had checked it. The bus carries a
      // whole published snapshot; what a half names is the part of it that half
      // touches, and that narrowing is inferred from the handler it hands over.
      //
      // THIS IS WHERE THE UNSOUNDNESS LIVES, and the interface says so above it
      // rather than leaving a reader to find this line: `A` is the caller's to
      // pick, so a half's parameter type is a claim about what the root rings
      // and this `as` is what lets the two meet.
      revision: revisions.listen(plugin) as Vault["revision"],
      // The other door takes no value, so a plugin hands over the Effect itself
      // rather than a function of nothing.
      unloaded: (handler) => quieted.listen(plugin)(() => handler),
    }))


    /**
     * ...AND THE FOUR THAT CORE DOES NOT PROVIDE AT ALL, which is the whole of
     * this phase and reads here as an absence.
     *
     * Every one of {@link OFFERABLE} is the chat row's to keep, offered from its
     * own `apply` ({@link Offers}). Core standing behind them was scaffolding
     * with a date on it: a stand-in whose door was `undefined` answered every
     * question with nothing — no scopes, no doorbells, and a delivery that
     * resolved into `Effect.void` — so a serve composed without a chat looked to
     * kolu and odu exactly like a serve with one that never rang. That is the
     * silence this arrangement was meant to prevent, wearing the shape of the
     * thing it prevented.
     *
     * WHAT IS TRUE INSTEAD is what the fibers already say: a plugin that names
     * `deliveries` with no row behind it is `waiting`, the reading names the tag
     * it is waiting on, and the preferences panel says on whose account. Under
     * `--plugins=kolu` alone, kolu is waiting — the paper's rule, and its
     * accepted cost.
     */

    const kinds = registry<string, ComposedKind>()
    yield* provide(host, Kinds, (plugin) => ({
      register: (kind) =>
        Effect.suspend(() => {
          const word = kindWordOf(plugin, kind.kind)
          return kinds.claim(
            word,
            { ...kind, kind: word, claims: word, by: plugin },
            // REFUSED UNCONDITIONALLY, including a plugin claiming its own word
            // twice — which is the reachable half on a well-formed bundle, since
            // the prefix IS the row's id and the loader will not mount two rows
            // under one. A plugin that unloads and comes back is not this case:
            // its finalizer took the word out of the table before its `apply`
            // ran again.
            (already) =>
              `plugins: "${already.by}" and "${plugin}" both contribute the property `
                + `kind "${word}" — a vault declaring it would be judged by whichever `
                + "was composed last, which the assembly resolves silently.",
          )
        }),
    }))

    const siblings = registry<string, Registered>(config.changed)
    yield* provide(host, Surfaces, (plugin) => ({
      register: (sibling) =>
        siblings.claim(
          plugin,
          { ...sibling, name: plugin },
          () =>
            `plugins: "${plugin}" registered a second sibling surface — a plugin is `
              + "one sibling under one key, and the second would silently replace the "
              + "first.",
        ),
    }))

    // KEYED BY THE PLUGIN AND REFUSED THE SAME WAY, which it was not: this table
    // was a bare `set`, so a second declaration replaced the first silently and
    // the FIRST registration's finalizer then deleted the SECOND's entry. Both
    // are unreachable on a well-formed bundle for the reason the sibling above
    // gives — one row, one plugin, one `apply` — and the asymmetry with its three
    // neighbours was the only thing keeping it so.
    const wakes = registry<string, Wake>()
    yield* provide(host, Wakes, (plugin) => ({
      register: (wake) =>
        wakes.claim(
          plugin,
          wake,
          () =>
            `plugins: "${plugin}" declared a second wake — a plugin rings under one `
              + "declaration, and the second would silently replace the first.",
        ),
      // READ AFRESH, and the same `read` a composition root gets: this table has
      // one truth and both ends of the wall are looking at it. A copy is handed
      // over, so a reader that wrote into it would be writing into its own.
      declared: Effect.sync(wakes.read),
    }))


    // WHO STANDS BEHIND WHAT, keyed by the door and refused like its neighbours.
    // Cordis refuses a second provide on its own — but its sentence is `service
    // "deliveries" has been registered at <root>`, which names neither author,
    // and what a person reads on a preferences row is supposed to be this tree's.
    // So the claim is taken FIRST and the provide below it can no longer be the
    // thing that throws; a refused offer never reaches cordis at all, and a
    // revoke takes the claim and the standing down together.
    const offered = registry<string, string>()
    yield* provide(host, Offers, (plugin) => ({
      offer: (key: AnyKey, door: Provision<never>) =>
        Effect.suspend(() => {
          // THE TABLE IS CLOSED AND THE REFUSAL IS A DEATH, not a failure
          // channel: a plugin that offered a key nobody may offer is a mistake in
          // that plugin, and it lands that fiber `failed` having installed
          // nothing while its siblings keep running — the same shape a duplicate
          // kind word gets two registries up.
          if (!OFFERABLE.some((one) => one.cordis === key.cordis)) {
            return Effect.die(
              new Error(
                `plugins: "${plugin}" offered to stand behind "${key.cordis}", which is `
                  + "not one of the doors a row may hold. Core provides every other "
                  + "service before any row is mounted, and a plugin that could stand "
                  + "behind one could stand behind the services it is meant to name.",
              ),
            )
          }
          return offered.claim(
            key.cordis,
            plugin,
            (already) =>
              `plugins: "${already}" and "${plugin}" both offer "${key.cordis}" — a `
                + "service stands behind one row, and the second would leave every "
                + "plugin that named it holding whichever was mounted last.",
          ).pipe(
            // ...AND THE PROVIDE, on the CALLING plugin's scope: the acquire
            // hangs the service on the host's root fiber and the release revokes
            // it, which unloads every fiber that named it — the same finalizer
            // discipline that takes a kind word out of the vocabulary.
            Effect.flatMap(() => provide(host, key as ServiceKey<never>, door)),
          )
        }),
      // THE CAST IS WHAT AN OVERLOAD SET IS. `Offers.offer` declares four call
      // signatures and no implementation signature — because a plugin must never
      // be able to spell a fifth — and the body underneath an overload set is
      // always one wider function that the declarations narrow. TypeScript will
      // not check the two against each other here (the widening runs through
      // `never`, which overlaps nothing), so this is the same unchecked step a
      // `function` declaration with four overloads takes, written where the
      // reader can see it.
    } as unknown as Offers))

    yield* provide(host, Tools, () => ({
      // NEVER, and not a null: a root with no listener has no address, and a
      // plugin gated on one is gated for the life of that process. See
      // {@link PluginsConfig.tools}.
      server: config.tools === undefined ? Effect.never : Deferred.await(config.tools),
      // ...and NULL rather than never for the fence, because this one is asked
      // per session and a caller has somewhere to put the absence: a root with
      // no MCP face seats a session unfenced, which is the state it was already
      // in ({@link PluginsConfig.ticketFor}).
      ticket: (seated, above) => config.ticketFor?.(seated, above) ?? NO_TICKET,
    }))

    // THE WRITE GATE, or a process that is writing nothing. Both arms are real
    // states: a serve has a store behind it, and every bench that only wants the
    // table has none — which answers a reading of nothing and refuses a write in
    // the vocabulary the caller already speaks rather than throwing at it.
    //
    // The REFUSALS half is a bus here rather than a field on the root's door, so
    // it is contained like its three neighbours: a handler that dies is caught
    // with the registering plugin's word on the line, and a mirror that threw on
    // one refusal cannot take down the write whose answer it was about.
    const refusals = broadcast<Refused>("a refused write")
    yield* provide(host, Ops, (plugin) => ({
      reading: config.ops?.reading ?? Effect.succeed(null),
      prop: (write) => config.ops?.prop(write) ?? Effect.fail(NOWHERE_TO_WRITE),
      refused: refusals.listen(plugin),
    }))

    yield* provide(host, Bundle, () => ({ rank: config.rank ?? (() => 0) }))

    // ...AND ONE HELD DOOR PER PLUGIN NAME, not per activation. The write chain
    // that orders a plugin's saves lives on the door, and this provision runs
    // once per ACTIVATION — so a plugin that unloads and comes back used to get a
    // second chain, and a save still in flight could land after a later one, on
    // the same file, with the earlier record winning. That is precisely the
    // defect {@link Held}'s own paragraph says was fixed by minting the door once
    // per plugin; it was fixed per CALL and left open per ACTIVATION.
    //
    // Unreachable while nothing unloaded a server half mid-serve — and a row that
    // stands behind another row's doors is one blip away from making it routine.
    //
    // KEYED BY THE NAME rather than by the fiber, because the name is what the
    // FILE is keyed by: two activations of one plugin are two fibers writing one
    // path, which is the whole of what has to be ordered.
    const holds = new Map<string, PluginHeld | null>()
    yield* provide(host, Held, (plugin) => {
      if (!holds.has(plugin)) holds.set(plugin, config.heldFor?.(plugin) ?? null)
      const door = holds.get(plugin) ?? null
      return {
        load: Effect.sync(() => door?.load() ?? null),
        save: (value) => Effect.sync(() => void door?.save(value)),
      }
    })

    return {
      host,
      kinds: kinds.read,
      composed: () => [...siblings.read().values()],
      declared: wakes.read,
      published: revisions.tell,
      quiet: quieted.tell(undefined),
      refused: refusals.tell,
    }
  })

export type {
  ConversationSeen,
  Deliveries as DeliveryDoor,
  MintedTicket,
  NotHere,
  PluginHeld,
  Probed,
  PropKind,
  PropWrite,
  Refusal,
  Refused,
  Seated,
  StdioServer,
  Wake,
} from "./contract.ts"
export { exposeMapsOf, kindWordOf, NO_TICKET, NOWHERE_TO_WRITE, surfacesOf } from "./contract.ts"

/**
 * WHAT AN ENGINE PLUGIN HANDS {@link Agents} — the one name off
 * `@olai/acp/engine` this door repeats, because it is the argument of a verb
 * declared here.
 *
 * IT WAS FIVE. `Adapter`, `Engine`, `PromptChannel` and `Where` came with it, on
 * the argument that a server half should "open one door for its whole
 * registration" — and none of the four was ever imported from here by anything.
 * The door was not one either: the re-export is types-only and a probe needs
 * VALUES, so three of the four engines go to `@olai/acp/engine` for `adapterFrom`
 * and `AGENT_ENV` regardless. A convenience nobody walked through, arguing a
 * property it did not have.
 */
export type { Registering } from "@olai/acp/engine"
