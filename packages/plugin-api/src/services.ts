/**
 * THE SERVICES A SERVER HALF NAMES — the whole of what core offers a plugin,
 * and the door a plugin's `./server` opens.
 *
 * ## What this replaces, and what the replacement removes
 *
 * It was `PluginServices`: one blob of seven fields, built per plugin by the
 * composition root and pushed in whole, so every plugin received everything
 * whether or not it had any use for it. Under Cordis each field is a SERVICE
 * hanging off a context, and a plugin declares which of them it needs:
 *
 * ```ts
 * export const name = "odu"
 * export const inject = ["clock", "deliveries", "env", "kinds", "log", "surfaces", "vault", "wakes"]
 * export function apply(ctx: Context) { … }
 * ```
 *
 * Three things fall out of that, and none of them is a convenience:
 *
 *   - **A plugin that does not name `deliveries` never sees it.** The blob had
 *     no way to express that; `inject` is the declaration, and the runtime
 *     holds the fiber PENDING until every named service exists, unloads it when
 *     one leaves, and re-applies it when one returns.
 *   - **The per-plugin STAMP stops being threaded.** The root used to close
 *     over a name to build `doorFor(plugin.name)` and `dials[plugin.name]`,
 *     which put a fence's keying in a file that must not know what it is
 *     keying. A service method reached as `ctx.deliveries.deliver(…)` runs with
 *     `this.ctx` bound to the CALLING fiber's context (Cordis's `Service`
 *     tracker — `createShadow` in the runtime's `utils.ts`), so the stamp is
 *     `this.ctx.fiber.name`, read at the call, off the registry binding rather
 *     than off an argument the caller supplied. The guarantee the threading
 *     bought is the same one; nobody is threading it.
 *   - **A registration carries its own undo.** Every `register` here returns a
 *     disposer and attaches it to the calling fiber with `this.ctx.effect`, so
 *     unloading a plugin unregisters exactly what it registered, in reverse,
 *     and a plugin whose `apply` threw before it reached a `register` installed
 *     nothing at all.
 *
 * ## Why the services take their behaviour as CONFIG
 *
 * Each class below is constructed by the composition root with the same values
 * it used to put on the blob — the environment, the clock, the two log
 * channels, the served directory, the chat's delivery doors. That keeps the
 * rule every seam in this tree is built on: a plugin that read `process.env` or
 * called `new Date()` would be a plugin a test cannot drive. What changed is
 * only that the values arrive once, at the service, instead of once per plugin.
 *
 * ## What is NOT here
 *
 * No browser face, and the door's whole discipline is that: this module names
 * `cordis` and `./contract.ts` and nothing else, so a process that renders
 * nothing can reach it. `./plugin.ts` — the manifest a browser half is written
 * against — returns `JSX.Element` from every field and is deliberately on the
 * other side of the package.
 *
 * No `intercept` on the vault, either, and that is a phase and not an
 * oversight: the subtree write fence belongs on {@link Vault} as interception
 * metadata read through `Service.resolveConfig`, and it arrives with node-agent
 * scopes rather than here (the proposal's §6, phase 4).
 */

import { Context, Service } from "cordis"

import { type Deliveries, kindWordOf, type PropKind, type Wake } from "./contract.ts"

/**
 * ONE SIBLING SURFACE, as its plugin hands it over.
 *
 * The three fields that are a plugin's wire identity, plus what a composition
 * root needs to IMPLEMENT it: the deps (opaque here — the plugin annotates them
 * against its own spec inside its own package) and an optional hand-back for
 * the sibling's own write face.
 *
 * NO `name`. It used to be the first field of every one of these shapes and it
 * was always the same word twice: the plugin's manifest said it, the registry
 * keyed by it, and the composition root re-read it off the value it had already
 * filed. {@link Surfaces.register} reads it off the FIBER instead, which is the
 * registry binding — so a half cannot register under a name that is not the one
 * it was mounted as, and there is no line anywhere for the two to drift apart on.
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
   *  Absent on a half that writes to its members from inside the framework's
   *  own connectors and so has nothing to be handed. */
  readonly published?: (ctx: unknown) => void
}

/**
 * ...AND ONE AS THE COMPOSITION ROOT HOLDS IT — the sibling with the name the
 * fiber stamped on it.
 *
 * A separate type from {@link Sibling} rather than an optional field, because
 * the two are read by different people: a plugin writes the first and can never
 * write the second, and a root reads the second and never has to trust the
 * first about who it belongs to.
 */
export interface Registered extends Sibling {
  readonly name: string
}

/** WHAT THE PROCESS CAN SEE, plus the one seam a test fills.
 *
 *  `vars` is what a plugin's rendezvous is decided from — `$PADI_SOCKET`,
 *  `$OLAI_REPOS_DIR` — handed in so a composition root is the one place a real
 *  environment is reached for. */
export class Env extends Service {
  constructor(ctx: Context, public config: Env.Config) {
    super(ctx, "env")
  }

  /** The variables, as the process was started with them. */
  get vars(): Record<string, string | undefined> {
    return this.config.vars
  }

  /**
   * THE INJECTABLE, for a test — a fake padi, a fake coordinator, whatever the
   * CALLING plugin dials.
   *
   * `unknown`, and the honesty of that is the point rather than a gap: core
   * cannot type a plugin's own test double without learning what the plugin
   * talks to, which is the one thing this whole arrangement exists to prevent.
   * It travels opaque and is NARROWED by the plugin, once, at its own edge.
   *
   * KEYED BY THE FIBER and not by an argument. The root used to close over
   * `dials[plugin.name]` when it built the blob; the key is read here off
   * `this.ctx.fiber`, which is the registry binding — so a plugin cannot ask
   * for another's double by spelling its name.
   *
   * A fiber with no entry gets `undefined`, which is every real serve.
   */
  dial(): unknown {
    return this.config.dials?.[this.ctx.fiber.name]
  }
}

export namespace Env {
  export interface Config {
    readonly vars: Record<string, string | undefined>
    /** One injectable per plugin, keyed by the plugin's name — a test's, never
     *  a product serve's. */
    readonly dials?: Readonly<Record<string, unknown>>
  }
}

/** THE CLOCK, as ISO-8601 — what a link's `since` is stamped from, and the
 *  reason a test that asserts "connected · just now" can own the instant it
 *  was rendered from. */
export class Clock extends Service {
  constructor(ctx: Context, public config: Clock.Config) {
    super(ctx, "clock")
  }

  now(): string {
    return this.config.now()
  }
}

export namespace Clock {
  export interface Config {
    readonly now: () => string
  }
}

/**
 * THE TWO CHANNELS, and which of its own sentences goes on which is the
 * PLUGIN's decision.
 *
 * `say` is routine narration, at debug: on a machine that is not running the
 * tool this is a line every few seconds and it is not news. `warn` is what the
 * OWNER must read — a malformed value in the vault, a socket that IS being
 * served and refused us — wired to a level the default console turns on,
 * because a broken spell behind `OLAI_LOG_LEVEL=debug` is a sentence nobody is
 * told. WHICH LEVEL each channel IS, is the composition root's.
 */
export class Log extends Service {
  constructor(ctx: Context, public config: Log.Config) {
    super(ctx, "log")
  }

  say(line: string): void {
    this.config.say(line)
  }

  warn(line: string): void {
    this.config.warn(line)
  }
}

export namespace Log {
  export interface Config {
    readonly say: (line: string) => void
    readonly warn: (line: string) => void
  }
}

/**
 * THE DIRECTORY THIS SERVE IS ABOUT, and the two events its revisions raise.
 *
 * ## Why the served path is the vault's and not the environment's
 *
 * It is half of where a relative path in a property resolves to, and it is a
 * fact about the SERVE rather than about whoever asked — a plugin that read it
 * off the store would be a second answer to a question the composition root
 * already holds.
 *
 * ## The events, and the one that is NOT teardown
 *
 * `vault/revision` replaces `PluginServer.revision`: an emit, once per
 * published revision, carrying the whole snapshot, and every listener narrows
 * it in its own signature to the part it reads. `vault/unloaded` replaces
 * `PluginServer.unloaded`, and the name is load-bearing — it does NOT mean the
 * plugin is going away. It means the STORE HAS NEVER PUBLISHED: a directory the
 * server can no longer see, so whatever a plugin derived FROM the vault is
 * yesterday's reading and says so, while what it holds from its own daemon is
 * untouched. A half that has teardown beyond its own registrations puts it in
 * an `apply` disposer, which is where the runtime looks for one; reading
 * `vault/unloaded` as a teardown hook would disown a live daemon every time a
 * disk went away for a beat.
 */
export class Vault extends Service {
  constructor(ctx: Context, public config: Vault.Config) {
    super(ctx, "vault")
  }

  /** The directory, resolved — what every path answer downstream is relative
   *  to. */
  get served(): string {
    return this.config.served
  }
}

export namespace Vault {
  export interface Config {
    readonly served: string
  }
}

/**
 * THE DOORBELL'S DOOR — which conversations opted into the CALLING plugin's
 * wakes, and the one write-only verb that reaches them.
 *
 * ## The keying is the fence, and it moved off the caller
 *
 * A door keyed by nobody would hand one plugin the conversations a person
 * scoped to another, and would let one plugin sign another's name onto a row
 * that reaches an agent. The root used to build one door per plugin and close
 * over the name; both methods here read `this.ctx.fiber.name` instead, which is
 * the word the REGISTRY bound this fiber under and is not something the caller
 * can spell. Same guarantee, one fewer place to get it wrong.
 *
 * ## Still write-only, and that is the load-bearing half
 *
 * There is no `read`, no `transcript`, no `history`, and there is no arm of
 * this service where one could be added without saying so in the type. A plugin
 * can put a sentence INTO a conversation and can never learn what is in one.
 *
 * ## The chat arrives LATE, and that is why the config is a thunk
 *
 * The plugin fibers mount before the store opens — they have to, because a
 * plugin teaches the vault its vocabulary and the store validates through it —
 * and the chat is built after. A serve with no ACP agent installed has no chat
 * at all and never will. Both are the same answer: `doors()` returns `null`,
 * `scopes()` is the empty list forever and `deliver` is a no-op, which is the
 * honest machine-without-the-tool state and needs no failure channel on a verb
 * that cannot fail.
 */
export class DeliveryDoors extends Service {
  constructor(ctx: Context, public config: DeliveryDoors.Config) {
    super(ctx, "deliveries")
  }

  /** The conversations somebody scoped to the calling plugin, each with the
   *  file they picked to filter by. Synchronous, because the caller is a
   *  watcher sink with no Effect around it. */
  scopes(): ReturnType<Deliveries["scopes"]> {
    return this.config.doorFor(this.ctx.fiber.name)?.scopes() ?? []
  }

  /** One machine-marked message into one conversation, stamped with the calling
   *  plugin's name. Fire-and-forget. */
  deliver(...args: Parameters<Deliveries["deliver"]>): void {
    this.config.doorFor(this.ctx.fiber.name)?.deliver(...args)
  }
}

export namespace DeliveryDoors {
  export interface Config {
    /** The chat's own door for one plugin, or `null` where there is no chat —
     *  asked per call rather than captured, because the chat is built after the
     *  fibers are mounted. */
    readonly doorFor: (plugin: string) => Deliveries | null
  }
}

/**
 * WHAT THE PLUGINS TEACH THE VAULT'S VOCABULARY — a table the format takes as
 * data and never imports.
 *
 * ## The word is composed HERE, from the fiber
 *
 * A plugin contributes the bare kind `terminal` and a vault declares
 * `kolu-terminal`. The prefix is the plugin's name read off the registry
 * binding (`this.ctx.fiber.name`), never off the row the caller handed over —
 * which is what makes a plugin's built-in declaration claim the key equal to
 * its own composed word and nothing else, and is why a person's own `terminal`
 * column is not something a flag on the machine can take over.
 *
 * ## Two plugins may not claim one word
 *
 * Prefixing makes that unreachable and it is counted anyway, because the
 * assembly underneath is a `Map.set` and a collision would resolve silently in
 * favour of whichever registered last — one plugin's `admits` quietly judging
 * another plugin's values, with nothing red anywhere. A collision throws out of
 * `register`, which lands the offending fiber in `FAILED` with its siblings
 * untouched rather than killing the boot.
 */
export class Kinds extends Service {
  private readonly claimed = new Map<string, ComposedKind>()

  constructor(ctx: Context) {
    super(ctx, "kinds")
  }

  /**
   * Teach one word, for as long as the calling fiber is loaded.
   *
   * The disposer is attached to that fiber, so unloading the plugin takes its
   * words out of the vocabulary with it.
   */
  register(kind: PropKind): () => void {
    const plugin = this.ctx.fiber.name
    const word = kindWordOf(plugin, kind.kind)
    // UNCONDITIONALLY, including a plugin claiming its own word twice — which
    // is the reachable half on a well-formed bundle, since the prefix IS the
    // row's id and the loader will not mount two rows under one. A plugin that
    // unloads and comes back is not this case: its disposer took the word out
    // of the table before its `apply` ran again.
    const already = this.claimed.get(word)
    if (already !== undefined) {
      throw new Error(
        `plugins: "${already.by}" and "${plugin}" both contribute the property `
          + `kind "${word}" — a vault declaring it would be judged by whichever `
          + `was composed last, which the assembly resolves silently.`,
      )
    }
    return this.ctx.effect(() => {
      this.claimed.set(word, { ...kind, kind: word, claims: word, by: plugin })
      return () => {
        this.claimed.delete(word)
      }
    })
  }

  /** Every word registered right now, composed. */
  table(): ReadonlyMap<string, ComposedKind> {
    return new Map(this.claimed)
  }
}

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
 * EVERY SIBLING SURFACE THIS SERVE COMPOSES — the registry a composition root
 * re-composes from, and the one service whose registrations move the wire.
 *
 * ## The re-composition is the ROOT's and not this service's
 *
 * The spike put it here, and its own review said why that was wrong: a
 * `recompose` inside the service re-implemented every SURVIVING sibling on
 * every register, so a plugin that had been serving since boot got a new
 * runtime, new connectors and new channels because a different plugin arrived.
 * What this service does is hold the table and say when it moved; the root
 * composes existing runtimes with the new one and swaps what is served
 * (`@olai/server`'s `runtime.ts`).
 *
 * ## What a live change reaches, and what it does not
 *
 * The roster cell moves and the fused group and handler record are replaced, so
 * nothing downstream is left holding the previous fusion. A CONNECTION that is
 * already open is a different matter: `serveSurfaceApp` takes a group and a
 * handler record at the moment it listens, and `connectSurfaces` takes its
 * sibling map at the call, so a socket opened before the change keeps serving
 * the roster it dialed. That is the framework ask this phase filed
 * (live add/drop on a rooted bundle, and `update(surfaces)` on a live
 * connection); until it lands the documented contract is
 * RECONNECT-PER-ROSTER-CHANGE, and the roster cell moving is what tells a
 * browser to.
 */
export class Surfaces extends Service {
  private readonly table = new Map<string, Registered>()

  constructor(ctx: Context, public config: Surfaces.Config = {}) {
    super(ctx, "surfaces")
  }

  /**
   * Compose one sibling under the CALLING plugin's name, for as long as that
   * fiber is loaded.
   *
   * Disposing the fiber drops the sibling and re-composes, which is what makes
   * `disabled` mean absent at every moment rather than only at boot: no tag, no
   * handler, no expose row, and no `surface/<name>/` on the wire at all.
   */
  register(sibling: Sibling): () => void {
    const name = this.ctx.fiber.name
    const already = this.table.get(name)
    if (already !== undefined) {
      throw new Error(
        `plugins: "${name}" registered a second sibling surface — a plugin is one `
          + "sibling under one key, and the second would silently replace the first.",
      )
    }
    return this.ctx.effect(() => {
      this.table.set(name, { ...sibling, name })
      this.config.changed?.()
      return () => {
        this.table.delete(name)
        this.config.changed?.()
      }
    })
  }

  /** Every sibling composed right now, in registration order. */
  composed(): ReadonlyArray<Registered> {
    return [...this.table.values()]
  }
}

export namespace Surfaces {
  export interface Config {
    /** Told after every register and every dispose — the composition root's
     *  re-compose. Absent on a context nobody is serving from, which is every
     *  test that only wants the table. */
    readonly changed?: () => void
  }
}

/**
 * WHICH PLUGINS RING AT ALL, and what each says when its doorbell stops
 * watching — the declaration `chat.scope` refuses a plugin for not having.
 *
 * It was a field on the server door (`PluginServerHalf.wake`) read off the
 * enabled halves at composition. It is a registration now, for the reason every
 * other one here is: a plugin that unloads takes its declaration with it, so a
 * scope written for a plugin that is no longer mounted is refused by the same
 * check that refuses one for a plugin that never declared a wake — rather than
 * by a second list somebody remembered to update.
 */
export class Wakes extends Service {
  private readonly table = new Map<string, Wake>()

  constructor(ctx: Context) {
    super(ctx, "wakes")
  }

  register(wake: Wake): () => void {
    const name = this.ctx.fiber.name
    return this.ctx.effect(() => {
      this.table.set(name, wake)
      return () => {
        this.table.delete(name)
      }
    })
  }

  /** What each ringing plugin declared, keyed by its name. A name with no entry
   *  is a plugin that wakes nobody, which is a whole plugin. */
  declared(): ReadonlyMap<string, Wake> {
    return new Map(this.table)
  }
}

/**
 * ONE CONVERSATION OPENING, as the plugins fill it in — the waterfall that
 * replaces `probe()`.
 *
 * `probe` had to answer both halves at once, an invariant with an incident
 * behind it: a caller that asked once for the entry to hand over and again for
 * the sentence would start somebody's daemon twice per conversation and could
 * answer the two questions about two different instants. One dispatch per
 * session open is that invariant for free.
 *
 * ## THUNKS, and not answers
 *
 * A listener pushes what it would ask rather than what it found, and the
 * reasons are two. The list is collected per SESSION OPEN, so a plugin that
 * unloaded between conversations contributes nothing to the next one without
 * anybody keeping a second list. And the asking is then the caller's to
 * schedule: `@olai/chat` runs them with a bounded concurrency because a probe
 * starts a subprocess on the session-open path, and a waterfall that awaited
 * each listener in turn would multiply that window by the number of plugins —
 * the same defect the bound exists to prevent, with a different shape.
 */
export interface SessionStart {
  /** What to ask this host, one thunk per plugin that has something to ask.
   *  Pushed in dispatch order, which is registration order, which is the
   *  bundle's. */
  readonly asking: Array<{
    readonly name: string
    readonly ask: () => Promise<import("./contract.ts").Probed>
  }>
}

declare module "cordis" {
  interface Context {
    clock: Clock
    deliveries: DeliveryDoors
    env: Env
    kinds: Kinds
    log: Log
    surfaces: Surfaces
    vault: Vault
    wakes: Wakes
  }

  interface Events {
    /** A published revision landed. The whole snapshot; every listener narrows
     *  it in its own signature to the part it reads. */
    "vault/revision"(snapshot: unknown): void
    /** The store has NEVER published — see {@link Vault}. NOT teardown. */
    "vault/unloaded"(): void
    /** The composed roster moved: a sibling arrived or left, and the fused
     *  group a socket dialed is no longer the one being served. */
    "surfaces/published"(roster: ReadonlyArray<string>): void
    /** A conversation is opening — see {@link SessionStart}. */
    "chat/session-start"(
      start: SessionStart,
      next: () => Promise<SessionStart>,
    ): Promise<SessionStart>
  }
}

export type { Deliveries, NotHere, Probed, PropKind, StdioServer, Wake } from "./contract.ts"
export { enabled, isEnabled, kindWordOf } from "./contract.ts"
