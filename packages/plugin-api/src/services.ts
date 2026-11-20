import type { Engine, Registering } from "@kolu/acp/engine"
import {
  broadcast,
  contained,
  type Host,
  openHost,
  offered as readOffered,
  hostChanges,
  closeHost,
  offer,
  OfferConflict,
  provide,
  type Provision,
  registry,
  roster,
  serviceChanges,
  serviceTag,
  type ServiceKey,
} from "@olai/effect-cordis"
import type { AgentItem, Reading } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { ConfigurationSource, ConfigurationWatch } from "./configuration.ts"
export { ConfigurationSource, ConfigurationWatch } from "./configuration.ts"
import { Deferred, Effect, Exit, Scope, Semaphore, Queue, Stream } from "effect"

import { ownedKey, ownService, type OwnServices } from "./owned.ts"
import {
  type ConversationSeen,
  type Deliveries as DeliveryDoor,
  type Forbidden,
  kindWordOf,
  type MintedTicket,
  NO_TICKET,
  NOWHERE_TO_WRITE,
  type Probed,
  type PropKind,
  type PropWrite,
  type Refusal,
  type Refused,
  type Wake,
} from "./contract.ts"

export * from "./runtime.ts"

export interface Env {
  readonly vars: Record<string, string | undefined>
  readonly dial: unknown
}
export const Env = serviceTag<Env>("env")

/** `@olai/ops`' write gate, narrowed by its holder. */
export type GateHandle = object

export type VaultSnapshot = Snapshot<Reading>

/** Inert module declarations from the selected bundle, including disabled rows. */
export interface BundleModules {
  readonly read: Effect.Effect<ReadonlyArray<{ readonly name: string; readonly exports: unknown }>>
}
export const BundleModules = serviceTag<BundleModules>("host.bundle-modules")

/** The clock, as ISO-8601. */
export interface Clock {
  readonly now: () => string
}
export const Clock = serviceTag<Clock>("clock")

export interface InboxRegistry {
  readonly current: () => string | null
  readonly register: (file: string | null) => Effect.Effect<
    (file: string | null) => Effect.Effect<void>, never, Scope.Scope>
  readonly changed: (handler: (file: string | null) => Effect.Effect<void>) =>
    Effect.Effect<void, never, Scope.Scope>
}

export interface Vault {
  readonly inbox: InboxRegistry
  /** The directory, resolved: every path answer downstream is relative to it. */
  readonly served: string
  readonly revision: (
    handler: (snapshot: VaultSnapshot) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** ...and the store went quiet. Not teardown. */
  readonly unloaded: (
    handler: Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Vault = serviceTag<Vault>("vault")

export interface Directory {
  readonly root: string
  readonly store: unknown
}
export const Directory = serviceTag<Directory>("directory")

export interface VaultSettings {
  readonly claims: unknown
  readonly runtime: unknown
  readonly root: string
  readonly kinds: unknown
  readonly ledger: unknown
  readonly search: unknown
}
export const VaultSettings = serviceTag<VaultSettings>("vault-settings")

/** Registration replays the current reading, so a plugin activated after the
 * first disk read still receives it. */
export const vaultEvents = (served: string) => {
  const delivery = Semaphore.makeUnsafe(1)
  let latest: VaultSnapshot | null = null
  const revisions = broadcast<VaultSnapshot>("a vault revision")
  const quieted = broadcast<void>("the vault going quiet")
  const inboxChanges = broadcast<string | null>("the Inbox path changing")
  const inboxGate = Semaphore.makeUnsafe(1)
  let inbox: { readonly owner: symbol; file: string | null } | null = null
  const inboxFor = (plugin: string): InboxRegistry => ({
    current: () => inbox?.file ?? null,
    register: (file) => Effect.gen(function*() {
      const owner = Symbol(plugin)
      yield* Effect.acquireRelease(
        inboxGate.withPermit(Effect.gen(function*() {
          if (inbox !== null) return yield* Effect.die(new Error("The Inbox already has an owner"))
          inbox = { owner, file }
          yield* inboxChanges.tell(file)
        })),
        () => inboxGate.withPermit(Effect.gen(function*() {
          if (inbox?.owner !== owner) return
          inbox = null
          yield* inboxChanges.tell(null)
        })),
      )
      return (next: string | null) => inboxGate.withPermit(Effect.gen(function*() {
        if (inbox?.owner !== owner || inbox.file === next) return
        inbox.file = next
        yield* inboxChanges.tell(next)
      }))
    }),
    changed: (handler) => inboxGate.withPermit(Effect.gen(function*() {
      yield* inboxChanges.listen(plugin)(handler)
      yield* contained(plugin, "the Inbox path", Effect.suspend(() => handler(inbox?.file ?? null)))
    })),
  })
  return {
    door: (plugin: string): Vault => ({
      served,
      inbox: inboxFor(plugin),
      revision: (handler) => delivery.withPermit(Effect.gen(function*() {
        yield* revisions.listen(plugin)(handler)
        if (latest !== null) {
          const snapshot = latest
          yield* contained(plugin, "a vault revision", Effect.suspend(() => handler(snapshot)))
        }
      })),
      unloaded: (handler) => quieted.listen(plugin)(() => handler),
    }),
    published: (snapshot: VaultSnapshot) => delivery.withPermit(Effect.andThen(
      Effect.sync(() => { latest = snapshot }), revisions.tell(snapshot))),
    quiet: delivery.withPermit(Effect.andThen(
      Effect.sync(() => { latest = null }), quieted.tell(undefined))),
  }
}

export interface Deliveries extends DeliveryDoor {}
export const Deliveries = serviceTag<Deliveries>("deliveries")

export interface Conversations {
  /** Open the chat OF AN ITEM — a node or a note that already exists — start it
   *  on `engine`, and send `say` as its first message with `teach` riding the
   *  provider's teaching seam. An item has one chat, so one that already has a
   *  started chat is refused in words; an item whose earlier start was refused is
   *  started again on the same item rather than given a second chat. A provider
   *  that goes away mid-call leaves what it already wrote written and answers
   *  with the refusal. */
  readonly open: (input: {
    readonly about: AgentItem
    readonly engine: string
    readonly say: string
    readonly teach: ReadonlyArray<string>
  }) => Effect.Effect<{ readonly refusal: string | null }, Refusal>
  /** Say something into the chat OF AN ITEM. `false` is one of four ordinary
   *  absences: the asking activation has left, the item is gone, it has no chat,
   *  or the chat it has was never started. */
  readonly say: (input: { readonly about: AgentItem; readonly text: string }) => Effect.Effect<boolean>
  /** Which of these items has a chat — the KEYS of the ones that do
   *  (`@olai/format`'s `itemKey`), read off ONE reading of the vault as it stands
   *  when the call runs. */
  readonly here: (input: {
    readonly about: ReadonlyArray<AgentItem>
  }) => Effect.Effect<ReadonlySet<string>>
  /** The engines this machine can actually start, best first. An empty list is a
   *  serve with nothing to talk to, on which {@link Conversations.open} refuses in
   *  the provider's own words. */
  readonly engines: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}
export const Conversations = serviceTag<Conversations>("conversations")

export interface ConversationsWatch {
  /** The door while a provider stands behind it and the asking activation lives;
   *  `undefined` while none does. */
  readonly current: () => Conversations | undefined
}
export const ConversationsWatch = serviceTag<ConversationsWatch>("conversations-watch")

export interface Kinds {
  readonly current: () => ReadonlyMap<string, ComposedKind>
  readonly changes: Stream.Stream<void>
  readonly register: (kind: PropKind) => Effect.Effect<void, never, Scope.Scope>
}
export const Kinds = serviceTag<Kinds>("kinds")

/** One plugin's kind, composed: its word prefixed with the plugin's name, and
 *  the key it claims by convention, which is that same word. */
export interface ComposedKind extends PropKind {
  readonly claims: string
  readonly by: string
}

export interface Sibling {
  /** Public procedure tags whose calls use transport-supplied attribution, named
   * as this plugin's OWN surface spells them: the composition root is what puts
   * them under `surface/<name>/`. */
  readonly writes?: ReadonlyArray<string>
  /** The plugin's own `Surface<Spec>`. */
  readonly surface: { readonly spec: unknown }
  /** Which of its members each face may see — its own `ExposeMap` per face,
   *  written against its own spec. */
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /**
   * Which of its members an agent may address as a `surface://` resource — this
   * row's own `ExposeMap`, and not a reading of `faces.agent`, which is what a
   * caller may CALL. Absent on a row that publishes nothing addressable.
   */
  readonly resources?: Readonly<Record<string, unknown>>
  /** This row's agent verbs — the tools an MCP host is offered while this row is
   *  standing. A tool leaves with its row. */
  readonly tools?: ReadonlyArray<unknown>
  /**
   * This row's sentence to an agent — one paragraph of what the row IS to a
   * caller as an application rather than as a set of verbs, present only while
   * the row is standing. ONE paragraph, because Claude Code truncates an MCP
   * server's instructions: 4,096 characters since v2.1.296 and 2,048 before it,
   * both overridden by `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`
   * (https://code.claude.com/docs/en/mcp). `@olai/server`'s `profiles.test.ts`
   * holds the composed whole under 2 KB.
   */
  readonly charter?: string
  /** This plugin's `ImplementSurfaceDeps`, against its own spec. */
  readonly deps: unknown
  /** This plugin's OWN ctx, handed back the moment its sibling is implemented.
   *  Absent on a half that has nothing to be handed. */
  readonly published?: (ctx: unknown) => void
}

export interface Registered extends Sibling {
  readonly name: string
}

export interface Surfaces {
  /** Compose one sibling under the CALLING plugin's name. Unloading it drops the
   *  sibling and re-composes, so `disabled` means absent at every moment rather
   *  than only at boot. */
  readonly register: (sibling: Sibling) => Effect.Effect<void, never, Scope.Scope>
}
export const Surfaces = serviceTag<Surfaces>("surfaces")

export interface Wakes {
  readonly register: (wake: Wake) => Effect.Effect<void, never, Scope.Scope>
  readonly current: () => ReadonlyMap<string, Wake>
  /** What every ringing plugin declared right now, keyed by its name. A name
   *  with no entry is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: Effect.Effect<ReadonlyMap<string, Wake>>
}
export const Wakes = serviceTag<Wakes>("wakes")

export interface Agents {
  /** Offer this engine. Which engines are INSTALLED is asked once per id and
   *  held. */
  readonly register: (engine: Registering) => Effect.Effect<void, never, Scope.Scope>
}
export const Agents = serviceTag<Agents>("agents")

/**
 * Conversation events, pushed — doorbells that landed, agent replies that
 * settled, turns that started or ended ({@link ConversationSeen}). A plugin that
 * mirrors a conversation never READS one: human messages are not among the
 * events.
 */
export interface Watching {
  readonly subscribe: (
    handler: (event: ConversationSeen) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Watching = serviceTag<Watching>("watching")

/**
 * A small record this plugin keeps about this serve, in the state home — not the
 * vault. Core owns the file and keys it by the calling plugin's word; what the
 * record SAYS is the plugin's.
 *
 * `load` is the last snapshot that landed, or `null` on a first serve and on a
 * file that would not parse. The save effect settles only when its own write
 * lands and returns the core refusal when it does not.
 */
export interface LocalState {
  readonly load: Effect.Effect<Record<string, unknown> | null>
  readonly save: (value: Record<string, unknown>) => Effect.Effect<void, Refusal>
  /**
   * ...AND A DIRECTORY BESIDE THE RECORD, for state that is a tree of files
   * another program writes. Created on first read, owner-only, and the same path
   * on every serve of this directory; core sweeps it with the record once the
   * served directory is gone.
   *
   * It FAILS rather than answering a path it could not make private, and on a
   * serve that keeps no machine-local state at all.
   */
  readonly directory: Effect.Effect<string, LocalRefusal>
}
/** Why {@link LocalState.directory} has no directory to give, in a sentence. */
export interface LocalRefusal extends Refusal {
  readonly why: string
}
export const LocalState = serviceTag<LocalState>("localState")

export interface SessionStart {
  /** Ask this host, once per conversation opening. */
  readonly ask: (probe: Effect.Effect<Probed>) => Effect.Effect<void, never, Scope.Scope>
}
export const SessionStart = serviceTag<SessionStart>("session-start")

export interface WaitingOutline {
  /** Served-root-relative: the store's own key, and what a plugin knows a file
   *  by. */
  readonly file: string
  /** Repository-root-relative: what a commit request names. */
  readonly path: string
}

/**
 * The ledger — what is waiting, record these with this writer, push. Core
 * defines the door and does not stand behind it: `ops.commit` / `ops.push`
 * refuse in words when nobody is mounted.
 */
export interface Ledger {
  /** A write landed and is waiting. No-op when the ledger has not yet opened. */
  readonly wrote: (writer: string) => void
  /** Why that write is not in the history — always a sentence. */
  readonly whyWaiting: (writer: string) => Effect.Effect<string>
  /** What is waiting, in both names every outline has. Unfailing, and empty
   *  where nobody records anything. */
  readonly waiting: Effect.Effect<ReadonlyArray<WaitingOutline>>
  /** Record what is waiting, or exactly these paths, signed by this writer. */
  readonly record: (
    request: { readonly message?: string; readonly paths?: ReadonlyArray<string> },
    writer: string,
  ) => Effect.Effect<unknown>
  readonly push: Effect.Effect<unknown>
  readonly resume: Effect.Effect<void>
  /**
   * Keep the quiet window shut for as long as the caller's scope is open, under
   * `commit: auto`. A count rather than a flag, so a second holder cannot
   * release the first's.
   *
   * Where nobody stands behind {@link Ledger} the acquisition succeeds and holds
   * nothing; a ledger REPLACED while a hold is out starts unheld. It closes the
   * TIMER, never a person's Commit button.
   */
  readonly hold: Effect.Effect<void, never, Scope.Scope>
}
export const Ledger = serviceTag<Ledger>("ledger")

export interface RequestHeaders {
  readonly [name: string]: string | ReadonlyArray<string> | undefined
}

export interface Person {
  readonly login: string
  readonly name: string | null
  readonly picture: string | null
}

export interface Search {
  readonly nodes: (ask: {
    readonly at: Reading
    /** The `SearchRequest`: the query text, the scope, the cap, the arm. */
    readonly query: unknown
    /** When it is being asked, as the format's own stamp — what the grammar's
     *  relative words count from (`date:yesterday`). */
    readonly now: string
    /** The `KindVocabulary` this serve runs. */
    readonly kinds: unknown
  }) => Effect.Effect<unknown>
}
export const Search = serviceTag<Search>("search")

export interface VaultViews {
  readonly ledger: (door: Ledger) => Effect.Effect<void, never, Scope.Scope>
  readonly search: (door: Search) => Effect.Effect<void, never, Scope.Scope>
}
export const VaultViews = serviceTag<VaultViews>("vault-views")

/**
 * The served directory, as a row that may be without one reads it. BOTH ARE
 * READ PER CALL: a vault switched off mid-session refuses the NEXT tool call
 * rather than the one after the next reconnect.
 */
export interface Served {
  readonly directory: () => unknown | undefined
  readonly gate: () => GateHandle | undefined
}
export const Served = serviceTag<Served>("host.served")

export interface Identity {
  /** The header names this deployment trusts, unique. */
  readonly headers: ReadonlyArray<string>
  readonly who: (headers: RequestHeaders) => Person | null
}
export const Identity = serviceTag<Identity>("identity")

/**
 * `offer` selects a core-defined key from {@link OFFERABLE}; `own` composes a
 * new key from the calling fiber's name and a local word. Any row may stand
 * behind a core door, and Cordis refuses a second provider.
 */
export interface Offers extends OwnServices {
  /**
   * A browser contract discoverable without running browser code on the server.
   * The declaration promises that this plugin authors these local words; it
   * provides no server dependency and proves no tab loaded them, which is why
   * inspect says `declared`, not `provided`.
   */
  readonly browser: (words: ReadonlyArray<string>) => Effect.Effect<void, never, Scope.Scope>
  readonly offer: {
    (key: typeof ConfigurationSource, door: Provision<ConfigurationSource>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Conversations, door: Provision<Conversations>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof VaultSettings, door: Provision<VaultSettings>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Ops, door: Provision<Ops>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Vault, door: Provision<Vault>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Directory, door: Provision<Directory>): Effect.Effect<void, never, Scope.Scope>
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
    (key: typeof Ledger, door: Provision<Ledger>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Search, door: Provision<Search>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof VaultViews, door: Provision<VaultViews>): Effect.Effect<void, never, Scope.Scope>
    (key: typeof Identity, door: Provision<Identity>): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Offers = serviceTag<Offers>("offers")

export interface ToolServer {
  readonly name: string
  readonly url: string
  /** Presented as a bearer token. */
  readonly token: string
}

export interface Advertised { readonly title: string; readonly owner: string }

/**
 * The vault's own MCP tool server. {@link Tools.server} WAITS: the address is
 * not knowable until `listen` returns, so the tag is provided early and
 * resolves late.
 */
export interface Tools {
  /** `null` where no catalogue is serving, or the server/tool is not ours.
   *  Resolved per call, so withdrawal and replacement take effect at once. */
  readonly advertised: (server: string, tool: string) => Advertised | null
  readonly server: Effect.Effect<ToolServer>
  readonly ticket: (options: {
    readonly forbidden: () => ReadonlyArray<Forbidden>
    readonly writer: string
    readonly confined?: () => { readonly under: string; readonly says: string } | null
  }) => MintedTicket
}
export const Tools = serviceTag<Tools>("tools")

export interface Ops {
  readonly gate: GateHandle | undefined

  readonly reading: Effect.Effect<Reading | null>
  /** Read one page through core's standing cache. */
  readonly page: (request: unknown) => Effect.Effect<unknown, Refusal>
  readonly prop: (write: PropWrite) => Effect.Effect<void, Refusal>
  /** Mint one document at a path the calling plugin derived from the current
   * reading. It cannot edit rows, properties, or an existing file. */
  readonly document: (file: string) => Effect.Effect<void, Refusal>
  readonly refused: (
    handler: (refusal: Refused) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Ops = serviceTag<Ops>("ops")

export const OFFERABLE = [
  ConfigurationSource,
  Conversations,
  VaultSettings,
  VaultViews,
  Ops,
  Vault,
  Directory,
  Agents,
  Deliveries,
  SessionStart,
  Watching,
  Ledger,
  Search,
  Identity,
] as const

export const opsEvents = () => broadcast<Refused>("a refused write")

export interface Bundle {
  readonly rank: (plugin: string) => number
}
export const Bundle = serviceTag<Bundle>("bundle")

export interface Plugins {
  readonly host: Host
  readonly changes: Stream.Stream<void>
  readonly close: Effect.Effect<void>
  readonly kinds: () => ReadonlyMap<string, ComposedKind>
  /** Every sibling composed right now, in registration order. */
  readonly composed: () => ReadonlyArray<Registered>
  /** What each ringing plugin declared, keyed by its name. A name with no entry
   *  is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: () => ReadonlyMap<string, Wake>
  readonly offers: () => ReadonlyMap<string, string>
  /** Public discovery: the stable authoring catalog plus currently offered
   * plugin-owned keys. */
  readonly serviceKeys: () => ReadonlyArray<string>
  /** Browser declarations owned by running server providers. */
  readonly browserKeys: () => ReadonlyArray<string>
}

export interface PluginsConfig {
  /** The variables, as the process was started with them. */
  readonly vars: Record<string, string | undefined>
  /** ISO-8601, now. */
  readonly now: () => string
  readonly localStateFor?: Provision<LocalState>
  /**
   * The vault's MCP server, completed after `listen` — see {@link Tools}. Absent
   * means NO LISTENER EVER, so {@link Tools.server} never settles and a plugin
   * gated on it stays gated.
   */
  readonly tools?: Deferred.Deferred<ToolServer>
  /**
   * ...and the session credential minted off it — see {@link Tools.ticket}. A
   * THUNK, answering `null` until the listener has bound. Absent means no
   * credential ever.
   */
  readonly ticketFor?: (options: {
    readonly forbidden: () => ReadonlyArray<Forbidden>
    readonly writer: string
    readonly confined?: () => { readonly under: string; readonly says: string } | null
  }) => MintedTicket | null
  /** Optional live display lookup; absence means no tool is recognized as ours. */
  readonly advertisedFor?: Tools["advertised"]
  readonly rank?: (plugin: string) => number
  /** Told after every surface register and every dispose. */
  readonly changed?: () => void
  /** One injectable per plugin, keyed by the plugin's name — a test's, never a
   *  product serve's. */
  readonly dials?: Readonly<Record<string, unknown>>
}

/**
 * Open the plugin runtime — the host, the services on it, and the doors back.
 * Nothing is mounted here.
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

    const kindListeners = new Set<() => void>()
    const kinds = registry<string, ComposedKind>(() => { for (const notify of kindListeners) notify() })
    const kindChanges = Stream.callback<void>((queue) => Effect.acquireRelease(
      Effect.sync(() => {
        const notify = () => { Queue.offerUnsafe(queue, undefined) }
        kindListeners.add(notify)
        notify()
        return notify
      }),
      (notify) => Effect.sync(() => { kindListeners.delete(notify) }),
    ), { bufferSize: 1, strategy: "sliding" })
    yield* provide(host, Kinds, (plugin) => ({
      current: kinds.read,
      changes: kindChanges,
      register: (kind) =>
        Effect.suspend(() => {
          const word = kindWordOf(plugin, kind.kind)
          return kinds.claim(
            word,
            { ...kind, kind: word, claims: word, by: plugin },
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

    const wakes = registry<string, Wake>()
    yield* provide(host, Wakes, (plugin) => ({
      register: (wake) =>
        wakes.claim(
          plugin,
          { ...wake },
          () =>
            `plugins: "${plugin}" declared a second wake — a plugin rings under one `
              + "declaration, and the second would silently replace the first.",
        ),
      declared: Effect.sync(wakes.read),
      current: wakes.read,
    }))


    const offered = new Map<string, { readonly plugin: string }>()
    const browserKeys = registry<string, string>()
    yield* provide(host, Offers, (plugin) => {
      const stand = <Shape>(key: ServiceKey<Shape>, door: Provision<Shape>) =>
        Effect.suspend(() => {
          const owner = { plugin }
          return offer(key, door).pipe(
            Effect.catchDefect((defect) => {
              return Effect.die(!(defect instanceof OfferConflict) ? defect : new Error(
                `plugins: "${defect.owner}" and "${plugin}" both offer "${key.cordis}" — a `
                  + "service stands behind one row, and the second would leave every "
                  + "plugin that named it holding whichever was mounted last.",
              ))
            }),
            Effect.andThen(Effect.acquireRelease(
              Effect.sync(() => { offered.set(key.cordis, owner) }),
              () => Effect.sync(() => { if (offered.get(key.cordis) === owner) offered.delete(key.cordis) }),
            )),
          )
        })
      return {
        own: ownService(plugin, stand),
        browser: (words) => Effect.forEach(words, (word) =>
          Effect.flatMap(ownedKey(plugin, word), (key) => browserKeys.claim(key, plugin, () =>
            `plugins: "${plugin}" declared browser service "${key}" twice`,
          )),
          { discard: true },
        ),
        offer: <Shape>(key: ServiceKey<Shape>, door: Provision<Shape>) => Effect.suspend(() => {
          if (!OFFERABLE.some((one) => one.cordis === key.cordis)) {
            return Effect.die(new Error(
              `plugins: "${plugin}" offered to stand behind "${key.cordis}", which is `
                + "not one of the doors a row may hold. Use own for a plugin-owned key; "
                + "host services cannot be replaced by a plugin.",
            ))
          }
          return stand(key, door)
        }),
      }
    })

    yield* provide(host, Tools, () => ({
      server: config.tools === undefined ? Effect.never : Deferred.await(config.tools),
      advertised: (server, tool) => config.advertisedFor?.(server, tool) ?? null,
      ticket: (options) => config.ticketFor?.(options) ?? NO_TICKET,
    }))

    yield* provide(host, Bundle, () => ({ rank: config.rank ?? (() => 0) }))

    yield* provide(host, Served, (plugin) => ({
      directory: () => readOffered(host, Directory, plugin),
      gate: () => readOffered(host, Ops, plugin)?.gate,
    }))

    yield* provide(host, ConfigurationWatch, (plugin) => ({
      current: () => readOffered(host, ConfigurationSource, plugin)?.current(),
      changes: Stream.switchMap(serviceChanges(host, ConfigurationSource), (source) =>
        source === undefined ? Stream.succeed(undefined) : source.changes),
    }))

    yield* provide(host, ConversationsWatch, (plugin, lifetime) => ({
      current: () => readOffered(host, Conversations, plugin, lifetime),
    }))

    const localStates = new Map<string, LocalState | null>()
    yield* provide(host, LocalState, (plugin) => {
      if (!localStates.has(plugin)) {
        localStates.set(plugin, config.localStateFor?.(plugin) ?? null)
      }
      return localStates.get(plugin) ?? {
        load: Effect.succeed(null),
        save: () => Effect.void,
        directory: Effect.fail({ _tag: "StateFailure", why: "this serve keeps no machine-local state" }),
      }
    })

    return {
      host,
      kinds: kinds.read,
      composed: () => [...siblings.read().values()],
      declared: wakes.read,
      offers: () => new Map([...offered].map(([key, owner]) => [key, owner.plugin])),
      serviceKeys: () => [...SERVICE_KEYS, ...[...offered.keys()].filter((key) => key.includes("."))].sort(),
      browserKeys: () => [...browserKeys.read().keys()].sort(),
      changes: hostChanges(host),
      close: closeHost(host),
    }
  })

export type {
  ConversationSeen,
  Deliveries as DeliveryDoor,
  MintedTicket,
  Probed,
  PropKind,
  PropWrite,
  Refusal,
  Refused,
  Forbidden,
  StdioServer,
  Wake,
} from "./contract.ts"
export { exposeMapsOf, kindWordOf, NO_TICKET, NOWHERE_TO_WRITE, surfacesOf } from "./contract.ts"

export type { Registering } from "@kolu/acp/engine"

export const SERVICES = [
  BundleModules,
  Served,
  ConfigurationWatch,
  ConversationsWatch,
  VaultViews,
  VaultSettings,
  Env,
  Clock,
  Vault,
  Deliveries,
  Kinds,
  Surfaces,
  Wakes,
  Agents,
  Watching,
  Identity,
  LocalState,
  SessionStart,
  Offers,
  Tools,
  Ops,
  Bundle,
] as const

export const SERVICE_KEYS: ReadonlyArray<string> = SERVICES.map((one) => one.cordis)

export type { SlotKey } from "./slots.ts"

export { HostLoading, openLoading, type Catalog, type OwnedLoader } from "./loading.ts"

export type FileClaim = Omit<import("@olai/format").Claim, "kind">
export type ComposedClaim = import("@olai/format").Claim

/** Owned by vault setup. A conflicting kind or overlapping suffix defects
 * without installing anything. */
export interface FileKinds {
  readonly current: () => ReadonlyMap<string, ComposedClaim>
  readonly changes: Stream.Stream<void>
  readonly register: (claim: FileClaim) => Effect.Effect<void, never, Scope.Scope>
}
export const FileKinds = serviceTag<FileKinds>("vault.file-kinds")
