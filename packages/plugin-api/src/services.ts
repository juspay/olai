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
import type { AgentItem } from "@olai/format"
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

/** Inert module declarations from the selected bundle, including disabled rows. */
export interface BundleModules {
  readonly read: Effect.Effect<ReadonlyArray<{ readonly name: string; readonly exports: unknown }>>
}
export const BundleModules = serviceTag<BundleModules>("host.bundle-modules")

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

/** One scoped owner publishes the Inbox convention; absence never waits on a plugin.
 * The vault owns the registry, while the registering scope owns its entry. */
export interface InboxRegistry {
  readonly current: () => string | null
  readonly register: (file: string | null) => Effect.Effect<
    (file: string | null) => Effect.Effect<void>, never, Scope.Scope>
  readonly changed: (handler: (file: string | null) => Effect.Effect<void>) =>
    Effect.Effect<void, never, Scope.Scope>
}

export interface Vault {
  readonly inbox: InboxRegistry
  /** The directory, resolved — what every path answer downstream is relative
   *  to. */
  readonly served: string
  /**
   * A published revision reached the store — for as long as this plugin is
   * loaded.
   *
   * THE PAYLOAD IS THE HANDLER'S TO NAME: a snapshot carries the whole
   * published world, and the narrowing is INFERRED from the handler's own
   * signature.
   *
   * THE ANNOTATION IS A CLAIM, NOT A CHECK. `A` is free — the CALLER picks it
   * — so nothing holds a handler's parameter type against what the root
   * actually rings, and a half that named a field the snapshot does not carry
   * would compile and read `undefined` at runtime.
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

/** Core's directory seam. The composition root checks the store's concrete
 * type against the floor; the plugin API does not import the vault grammar. */
export interface Directory {
  readonly root: string
  readonly store: unknown
}
export const Directory = serviceTag<Directory>("directory")

/** Core supplies these after mounting declarations. Floor-specific values are
 * opaque here; the provider checks them against @olai/ops’s typed half. */
export interface VaultSettings {
  readonly claims: unknown
  readonly runtime: unknown
  readonly root: string
  readonly kinds: unknown
  readonly ledger: unknown
  readonly search: unknown
}
export const VaultSettings = serviceTag<VaultSettings>("vault-settings")

/** A provider owns both buses. Registration replays its current reading so a
 * tenant activated after the first disk read still receives the vault. */
export const vaultEvents = (served: string) => {
  const delivery = Semaphore.makeUnsafe(1)
  let latest: unknown | null = null
  const revisions = broadcast<unknown>("a vault revision")
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
      revision: ((handler: (snapshot: unknown) => Effect.Effect<void>) => delivery.withPermit(Effect.gen(function*() {
        yield* revisions.listen(plugin)(handler)
        if (latest !== null) {
          yield* contained(plugin, "a vault revision", Effect.suspend(() => handler(latest)))
        }
      }))) as Vault["revision"],
      unloaded: (handler) => quieted.listen(plugin)(() => handler),
    }),
    published: (snapshot: unknown) => delivery.withPermit(Effect.andThen(
      Effect.sync(() => { latest = snapshot }), revisions.tell(snapshot))),
    quiet: delivery.withPermit(Effect.andThen(
      Effect.sync(() => { latest = null }), quieted.tell(undefined))),
  }
}

export interface Deliveries extends DeliveryDoor {}
export const Deliveries = serviceTag<Deliveries>("deliveries")

export interface Conversations {
  /** Open the chat OF AN ITEM — a node or a note that already exists — start
   *  it on `engine`, and send `say` as its first message with `teach` riding
   *  the provider's teaching seam. An item has one chat, so one that already
   *  has a started chat is refused in words; an item whose earlier start was
   *  refused is started again on the same item rather than given a second
   *  chat.
   *
   *  NOTHING IS MINTED, which is why only a refusal comes back: the item is
   *  the caller's own, so there is no new address for this door to report.
   *
   *  THAT PROMISE HOLDS WHEN THE PROVIDER GOES AWAY MID-CALL: the acts stop
   *  where they got to, a tie already written to the vault STAYS written, and
   *  the call answers with the refusal rather than failing whole. */
  readonly open: (input: {
    readonly about: AgentItem
    readonly engine: string
    readonly say: string
    readonly teach: ReadonlyArray<string>
  }) => Effect.Effect<{ readonly refusal: string | null }, Refusal>
  /** Say something into the chat OF AN ITEM — the same conversation a person
   *  sees on that note or that node. `false` is one of FOUR ordinary absences:
   *  the asking activation has left, the item is gone, it has no chat, or the
   *  chat it has was never started. The first of them is the gate the
   *  broker's forwarded lifetime closes ({@link ConversationsWatch}), and it is
   *  why this is an answer rather than a failure: none of the four is anything
   *  going wrong. */
  readonly say: (input: { readonly about: AgentItem; readonly text: string }) => Effect.Effect<boolean>
  /** WHICH OF THESE ITEMS HAS A CHAT — the KEYS of the ones that do
   *  (`@olai/format`'s `itemKey`), and nothing about what any of them said:
   *  the door stays write-only. A list and one answer because that is the
   *  question a caller holding a roster asks, and because every item is then
   *  read off ONE reading of the vault: no two of them can come back from two
   *  different revisions. Asked of the vault as it stands when the call runs,
   *  so a caller following a revision is answered about that revision or a
   *  later one, never an earlier. */
  readonly here: (input: {
    readonly about: ReadonlyArray<AgentItem>
  }) => Effect.Effect<ReadonlySet<string>>
  /** The engines this machine can actually start, best first — the MACHINE's
   *  answer rather than the vault's, because a caller that has to choose one
   *  needs the list the panel's own picker draws from. An empty list is a serve
   *  with nothing to talk to, on which {@link Conversations.open} refuses in
   *  the provider's own words. */
  readonly engines: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}
export const Conversations = serviceTag<Conversations>("conversations")

export interface ConversationsWatch {
  /** The door while a provider stands behind it, gated on the asking
   *  activation, and `undefined` while none does. */
  readonly current: () => Conversations | undefined
}
export const ConversationsWatch = serviceTag<ConversationsWatch>("conversations-watch")

export interface Kinds {
  readonly current: () => ReadonlyMap<string, ComposedKind>
  readonly changes: Stream.Stream<void>
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

export interface Sibling {
  /** Public procedure tags whose calls use transport-supplied attribution,
   * named as this plugin's OWN surface spells them. The composition root is
   * what puts them under `surface/<name>/`, so four rows declaring
   * `["surface/ops/run"]` is four rows each naming their own member. */
  readonly writes?: ReadonlyArray<string>
  /** The plugin's own surface — a `Surface<Spec>`, opaque on this side of the
   *  wall for the reason `deps` is. */
  readonly surface: { readonly spec: unknown }
  /** Which of its members each face may see — its own `ExposeMap` per face,
   *  written against its own spec. ONE GRANT, NOT TWO: a member has one name
   *  and this is the map that says who may reach it. */
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /**
   * WHICH OF ITS MEMBERS AN AGENT MAY ADDRESS AS A `surface://` RESOURCE — this
   * row's OWN `ExposeMap`, written against its own spec, opaque here for the
   * reason `faces` is.
   *
   * A SECOND MAP RATHER THAN A READING OF `faces.agent`: `faces.agent` is what
   * a caller may CALL, and a procedure is not a thing with an address.
   *
   * ABSENT ON MOST ROWS: a row whose whole agent face is verbs publishes
   * nothing addressable, and is a sibling of the served bundle anyway.
   */
  readonly resources?: Readonly<Record<string, unknown>>
  /**
   * THIS ROW'S AGENT VERBS — the tools an MCP host is offered while this row is
   * standing, opaque here for the reason `deps` and `faces` are. A tool leaves
   * with its row, because the row is what brought it.
   */
  readonly tools?: ReadonlyArray<unknown>
  /**
   * THIS ROW'S SENTENCE TO AN AGENT — one paragraph of what the row IS to a
   * caller as an application rather than as a set of verbs, and, like
   * {@link tools}, present only while the row is standing.
   *
   * ABSENT ON MOST ROWS: only a row that owns a fact about where an agent's
   * words LAND has a paragraph to add, and it is one paragraph — Claude Code
   * truncates server instructions at 2 KB, silently, and the composed whole is
   * held under that by `@olai/server`'s `profiles.test.ts`.
   */
  readonly charter?: string
  /** This plugin's `ImplementSurfaceDeps`, against its own spec. */
  readonly deps: unknown
  /** This plugin's OWN ctx, handed back the moment its sibling is implemented.
   *  Absent on a half that writes to its members from inside the framework's own
   *  connectors and so has nothing to be handed. */
  readonly published?: (ctx: unknown) => void
}

export interface Registered extends Sibling {
  readonly name: string
}

export interface Surfaces {
  /** Compose one sibling under the CALLING plugin's name, for as long as that
   *  plugin is loaded. Unloading it drops the sibling and re-composes, which is
   *  what makes `disabled` mean absent at every moment rather than only at boot:
   *  no tag, no handler, no expose row, and no `surface/<name>/` on the wire at
   *  all. */
  readonly register: (sibling: Sibling) => Effect.Effect<void, never, Scope.Scope>
}
export const Surfaces = serviceTag<Surfaces>("surfaces")

export interface Wakes {
  readonly register: (wake: Wake) => Effect.Effect<void, never, Scope.Scope>
  /** The same live declarations for synchronous delivery-scope readers. */
  readonly current: () => ReadonlyMap<string, Wake>
  /** What every ringing plugin declared right now, keyed by its name. A name
   *  with no entry is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: Effect.Effect<ReadonlyMap<string, Wake>>
}
export const Wakes = serviceTag<Wakes>("wakes")

export interface Agents {
  /**
   * Offer this engine, for as long as the calling plugin is loaded.
   *
   * The entry is scope-held and leaves the engines table on unload. What stays
   * frozen is the MACHINE's half: which engines are installed is asked once
   * per id and held, because re-deciding it under a reader would flip the
   * panel's whole face while somebody was using it.
   */
  readonly register: (engine: Registering) => Effect.Effect<void, never, Scope.Scope>
}
export const Agents = serviceTag<Agents>("agents")

/**
 * CONVERSATION EVENTS, PUSHED — doorbells that landed, agent replies that
 * settled, turns that started or ended ({@link ConversationSeen}).
 *
 * A plugin that mirrors a conversation never READS one: human messages are not
 * among the events. `subscribe` is a registration on the calling plugin's
 * scope, so a plugin that unloads stops being told, and the handler is
 * contained here rather than at every call.
 */
export interface Watching {
  readonly subscribe: (
    handler: (event: ConversationSeen) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>
}
export const Watching = serviceTag<Watching>("watching")

/**
 * A SMALL RECORD THIS PLUGIN KEEPS about this serve, in the state home — not the
 * vault. Core owns the file and keys it by the calling plugin's word; what the
 * record SAYS is the plugin's.
 *
 * `load` is the last snapshot that landed, or `null` on a first serve and on a
 * file that would not parse. `save` is ORDERED: successive snapshots of one
 * in-memory state land in the order they were handed over. THE DOOR IS MINTED
 * ONCE PER PLUGIN NAME, which is what makes that true: the chain that orders
 * the writes lives on the door, so a second door is a second chain and orders
 * nothing against the first. The save effect settles only when its own write
 * lands and returns the core refusal when it does not; a gesture can never be
 * told success for queued IO.
 */
export interface LocalState {
  readonly load: Effect.Effect<Record<string, unknown> | null>
  readonly save: (value: Record<string, unknown>) => Effect.Effect<void, Refusal>
  /**
   * ...AND A DIRECTORY BESIDE THE RECORD, for state that is a tree of files
   * another program writes rather than a note this plugin keeps — a browser
   * profile is the one tenant. Created on first read, owner-only, and the
   * same path on every serve of this directory; core sweeps it with the record
   * once the served directory is gone. What goes inside is the plugin's.
   *
   * It FAILS rather than answering a path it could not make private, and it
   * fails on a serve that keeps no machine-local state at all: a plugin that
   * needs a directory is a plugin that must say it has none.
   */
  readonly directory: Effect.Effect<string, LocalRefusal>
}
/** Why {@link LocalState.directory} has no directory to give, in a sentence. */
export interface LocalRefusal extends Refusal {
  readonly why: string
}
export const LocalState = serviceTag<LocalState>("localState")

export interface SessionStart {
  /**
   * Ask this host, once per conversation opening, for as long as the calling
   * plugin is loaded.
   *
   * IT NEVER FAILS: every way of failing is an ARM of {@link Probed} — "the
   * tool is not here" is an answer and not a fault, and "it is here and would
   * not work" is a SENTENCE somebody has to read.
   *
   * AND NOTHING CONTAINS A PROBE THAT DIES: a defect here fails the
   * conversation open, for every plugin and for the person. A probe that
   * cannot say what it found says `{ server: null, missing: … }` and describes
   * the failure in `missing.why`.
   */
  readonly ask: (probe: Effect.Effect<Probed>) => Effect.Effect<void, never, Scope.Scope>
}
export const SessionStart = serviceTag<SessionStart>("session-start")

/**
 * ONE THING TO ASK, as the collector holds it — the plugin's own word and the
 * Effect it registered. THE NAME IS FOR THE LOG LINE and for the ORDER, and
 * for nothing else.
 *
 * IN NO ORDER: nothing that reads {@link Plugins.sessionStart} may take the
 * order it arrives in as meaningful; imposing one is the composition root's,
 * against the build's own list of rows.
 */
export interface Asked {
  readonly name: string
  readonly ask: Effect.Effect<Probed>
}

/** One waiting outline, in the two names it has — see {@link Ledger.waiting}. */
export interface WaitingOutline {
  /** Served-root-relative: the store's own key, and what a plugin knows a file
   *  by. */
  readonly file: string
  /** Repository-root-relative: what a commit request names. */
  readonly path: string
}

/**
 * THE LEDGER — what is waiting, record these with this writer, push. Core
 * defines the door and does not stand behind it: the git row offers it, and
 * `ops.commit` / `ops.push` refuse in words when nobody is mounted.
 *
 * Types are structural rather than `@olai/format`'s: this package does not
 * import the floor.
 */
export interface Ledger {
  /** A write landed and is waiting. No-op when the ledger has not yet opened. */
  readonly wrote: (writer: string) => void
  /** Why that write is not in the history — always a sentence. */
  readonly whyWaiting: (writer: string) => Effect.Effect<string>
  /**
   * WHAT IS WAITING, IN BOTH NAMES EVERY OUTLINE HAS — the name olai's own set
   * uses (served-root-relative, which is the only name a plugin knows its files
   * by) and the name git and a commit request use (repository-root-relative).
   *
   * UNFAILING and empty where nobody records anything.
   */
  readonly waiting: Effect.Effect<ReadonlyArray<WaitingOutline>>
  /** Record what is waiting, or exactly these paths, signed by this writer. */
  readonly record: (
    request: { readonly message?: string; readonly paths?: ReadonlyArray<string> },
    writer: string,
  ) => Effect.Effect<unknown>
  readonly push: Effect.Effect<unknown>
  readonly resume: Effect.Effect<void>
  /**
   * KEEP THE QUIET WINDOW SHUT for as long as the caller's scope is open, so a
   * caller that is about to write several times and then commit them itself does
   * not have the window commit half of it in between — under `commit: auto`.
   *
   * AN ACQUISITION, released by the ordinary scope rules, HELD PER LEDGER — a
   * count rather than a flag, so a second holder cannot release the first's.
   *
   * TWO FACTS A CALLER MUST KNOW. Where nobody stands behind {@link Ledger} the
   * acquisition succeeds and holds nothing; and a ledger REPLACED while a hold
   * is out starts unheld, so a git restart mid-hold may produce one `auto`
   * commit beside the caller's own.
   *
   * A person's Commit button is never blocked by one: this closes the TIMER,
   * not the door.
   */
  readonly hold: Effect.Effect<void, never, Scope.Scope>
}
export const Ledger = serviceTag<Ledger>("ledger")

/** The headers a request arrived with, as a server hands them over — one
 *  value, a repeated name's values, or nothing. Structural for {@link Ledger}'s
 *  reason: this package imports neither a platform's HTTP types nor the
 *  surface's. */
export interface RequestHeaders {
  readonly [name: string]: string | ReadonlyArray<string> | undefined
}

/** WHO A REQUEST IS, already resolved — a login, what to call them, and the
 *  picture whoever stands behind {@link Identity} settled on (`null` being the
 *  silhouette a chip draws itself). The same three fields the surface's `Who`
 *  carries, spelled here because this package does not import the surface. */
export interface Person {
  readonly login: string
  readonly name: string | null
  readonly picture: string | null
}

export interface Search {
  readonly nodes: (ask: {
    /** The `Reading` this answer is about — both halves, because a query
     *  answers with records and documents. */
    readonly at: unknown
    /** The `SearchRequest`: the query text, the scope, the cap, the arm. */
    readonly query: unknown
    /** When it is being asked, as the format's own stamp — what the grammar's
     *  relative words count from (`date:yesterday`). */
    readonly now: string
    /** The `KindVocabulary` this serve runs, because `prop:` reads what a key
     *  is declared as to decide between a span and an equality. */
    readonly kinds: unknown
  }) => Effect.Effect<unknown>
}
export const Search = serviceTag<Search>("search")

export interface VaultViews {
  /** Record writes through this ledger, for as long as the calling plugin is
   *  loaded. */
  readonly ledger: (door: Ledger) => Effect.Effect<void, never, Scope.Scope>
  /** ...and answer queries with this matcher, the same way. */
  readonly search: (door: Search) => Effect.Effect<void, never, Scope.Scope>
}
export const VaultViews = serviceTag<VaultViews>("vault-views")

/**
 * THE SERVED DIRECTORY, AS A ROW THAT MAY BE WITHOUT ONE READS IT — TWO
 * readings about ONE provider, named in the type. MCP's protocol server, its
 * carrier, its route and its ticket mint stand up on a serve with no vault at
 * all.
 *
 * BOTH ARE READ PER CALL, because the roster moves under a standing
 * connection: a vault switched off mid-session must refuse the NEXT tool call
 * rather than the one after the next reconnect.
 */
export interface Served {
  /** The directory this serve opened, or nothing. Opaque here for
   *  {@link Directory}'s reason — the vocabulary belongs to the floor. */
  readonly directory: () => unknown | undefined
  /** ...and its write gate, as {@link Ops.gate} carries it. */
  readonly gate: () => unknown | undefined
}
export const Served = serviceTag<Served>("host.served")

export interface Identity {
  /** The header names this deployment trusts, unique — the allowlist the
   *  upgrade takes, in whatever order the offering row lists them. */
  readonly headers: ReadonlyArray<string>
  /** Who this request is, or nobody. A function of the headers it is handed,
   *  so one reading answers a socket's upgrade, an HTTP door and an MCP
   *  dispatch. */
  readonly who: (headers: RequestHeaders) => Person | null
}
export const Identity = serviceTag<Identity>("identity")

/**
 * PROVIDING A SERVICE WITHOUT HANDING OVER THE HOST.
 *
 * A plugin gets Offers, never provide or openHost. A host would let it mount
 * a fiber under another name, forging the identity that keyed services use
 * for registrations. The bridge reads that identity from the calling fiber;
 * this door exposes neither a host nor a provider-name argument.
 *
 * Two independent choices meet here: offer selects a core-defined key from
 * OFFERABLE; own composes a new key from the fiber name and a local word.
 * Any row may provide a core door. Cordis refuses a second provider.
 */
export interface Offers extends OwnServices {
  /**
   * A browser contract discoverable without running browser code on the server.
   * The declaration promises that this plugin authors these local words; the
   * same namespace grammar and owner stamp apply as for own. It does not
   * provide a server dependency, validate the browser implementation's shape,
   * or prove that any tab loaded or activated that implementation — which is
   * why inspect says `declared`, not `provided`. Unloading the declaring scope
   * withdraws its entries.
   */
  readonly browser: (words: ReadonlyArray<string>) => Effect.Effect<void, never, Scope.Scope>
  /** Stand behind one door, for as long as the calling plugin is loaded. */
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
  /** Presented as a bearer token. The route is on the same loopback listener as
   *  everything else, and a WRITE surface any page could POST at is a different
   *  bargain from a read-only one. */
  readonly token: string
}

/** Static display contract; the catalogue provider owns the live lookup. */
export interface Advertised { readonly title: string; readonly owner: string }

/**
 * THE VAULT'S OWN MCP TOOL SERVER, once the listener has bound.
 *
 * AN EFFECT THAT WAITS: the address is not knowable until `listen` returns,
 * which is long after every plugin fiber was mounted — so the tag is PROVIDED
 * EARLY and RESOLVED LATE. A `Tools` that only appeared after `listen` would
 * leave every plugin that named it un-applied at the moment the store's codec
 * is built.
 */
export interface Tools {
  /** Deliberately carried by Tools rather than a second optional broker.
   * Null means no catalogue is serving, or the server/tool is not ours.
   * Resolve per call so withdrawal and replacement take effect immediately. */
  readonly advertised: (server: string, tool: string) => Advertised | null
  readonly server: Effect.Effect<ToolServer>
  /**
   * ...AND A CREDENTIAL FOR ONE SESSION.
   *
   * A node agent's door is the same write door loopback MCP has, under the
   * node's credential, with the keys on {@link Forbidden} refused. The
   * ENFORCEMENT is `@olai/ops`', between `plan` and `commit`; the CHANNEL is a
   * bearer the MCP route resolves per request.
   *
   * `forbidden` is A FUNCTION AND NOT A VALUE, read per request: the keys a
   * vault declares this kind on may move mid-conversation.
   *
   * `writer` is the session provider's attribution, validated by the host's
   * ledger vocabulary. `release` is the session's own teardown, so reaping a
   * node scope drops its MCP footprint in the same breath.
   */
  readonly ticket: (
    forbidden: () => ReadonlyArray<Forbidden>,
    writer: string,
    /** WHERE THIS SESSION'S WRITES MAY LAND, read per call: absent is the
     *  ordinary rule — the whole vault — and a value is a fence somebody raised
     *  for the span of their own work. Structurally `@olai/ops`' `Confinement`,
     *  which is where the fence is enforced and the argument for it is written;
     *  spelled out here because this package does not depend on that one. The
     *  caller that owns the sessions is the one that knows; core does not. */
    confined?: () => { readonly under: string; readonly says: string } | null,
  ) => MintedTicket
}
export const Tools = serviceTag<Tools>("tools")

/**
 * THE VAULT'S WRITE GATE, as narrow as the gestures that need it.
 *
 * The complete gate is carried opaquely; the convenience methods retain the
 * gestures plugins already use. {@link PropWrite} is one key on one node, and
 * {@link reading} answers a value rather than the layer that produced it. What
 * judges the write is unchanged: the same planner, the same validator, the same
 * ledger commit a keystroke goes through.
 *
 * THE READING IS OPAQUE, and it is {@link Vault.revision}'s bargain: the value
 * travels `unknown` and the plugin narrows it once, at its own edge. The
 * narrowing is a CLAIM and not a check.
 */
export interface Ops {
  /** The complete gate, opaque here because its vocabulary belongs to the
   * floor. Core checks this against @olai/ops; plugin gestures use the typed
   * convenience methods below. Absence is no gate, never a replacement gate. */
  readonly gate: unknown

  /** THE READING every write is resolved against — one answer to "there is
   *  nothing loaded yet", shared with the tools and with a keystroke. */
  readonly reading: Effect.Effect<unknown>
  /** Read one page through core's standing cache. The request and answer are
   * opaque for the same dependency-direction reason as {@link reading}; a
   * plugin narrows both at its format boundary. */
  readonly page: (request: unknown) => Effect.Effect<unknown, Refusal>
  /** ONE PROPERTY, WRITTEN — see {@link PropWrite} on why the door is the
   *  gesture's shape rather than the layer's. */
  readonly prop: (write: PropWrite) => Effect.Effect<void, Refusal>
  /** Mint one document at a path the calling plugin derived from the current
   * reading. This is the second deliberately narrow write shape: it cannot
   * edit rows, properties, or an existing file. */
  readonly document: (file: string) => Effect.Effect<void, Refusal>
  /** A WRITE THIS SERVE REFUSED, for as long as the calling plugin is loaded.
   *
   *  ON THE WRITE GATE and not on the MCP server, because it is WRITES this is
   *  a property of: a second writer would report nothing. What a plugin makes of
   *  it is its own — the writer attribution lets chat leave web refusals at
   *  their requesting surface while drawing agent refusals in the transcript.
   *
   *  Contained here, like every other bus on this page: a handler that dies
   *  costs its plugin a line rather than the write its answer was about. */
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

/** The vault row owns refusal subscriptions with its gate. */
export const opsEvents = () => broadcast<Refused>("a refused write")

export interface Bundle {
  readonly rank: (plugin: string) => number
}
export const Bundle = serviceTag<Bundle>("bundle")

export interface Plugins {
  /** Where the fibers hang — handed to `@olai/bundle` to mount the rows on, and
   *  opaque to everybody. */
  readonly host: Host
  /** Runtime transitions, including asynchronous initialization completing. */
  readonly changes: Stream.Stream<void>
  /** Drain plugins before the composition root releases their host resources. */
  readonly close: Effect.Effect<void>
  /** Every word registered right now, composed. */
  readonly kinds: () => ReadonlyMap<string, ComposedKind>
  /** Every sibling composed right now, in registration order. */
  readonly composed: () => ReadonlyArray<Registered>
  /** What each ringing plugin declared, keyed by its name. A name with no entry
   *  is a plugin that wakes nobody, which is a whole plugin. */
  readonly declared: () => ReadonlyMap<string, Wake>
  readonly offers: () => ReadonlyMap<string, string>
  /** Public discovery: the stable authoring catalog plus currently offered
   * plugin-owned keys. Ownership also tracks internal core doors, which this
   * catalog deliberately does not expose. */
  readonly serviceKeys: () => ReadonlyArray<string>
  /** Browser declarations owned by running server providers. */
  readonly browserKeys: () => ReadonlyArray<string>
}

export interface PluginsConfig {
  /** The variables, as the process was started with them. */
  readonly vars: Record<string, string | undefined>
  /** ISO-8601, now. */
  readonly now: () => string
  /** One plugin's machine-local record, by name — minted ONCE per plugin, which
   *  is what orders its writes. Where a machine keeps olai's own files is not a
   *  plugin's business. */
  readonly localStateFor?: Provision<LocalState>
  /**
   * THE VAULT'S MCP SERVER, COMPLETED AFTER `listen` — see {@link Tools}.
   *
   * OPTIONAL, and absent means NO LISTENER EVER: a root that serves nothing has
   * no address, so {@link Tools.server} never settles and a plugin gated on it
   * stays gated.
   */
  readonly tools?: Deferred.Deferred<ToolServer>
  /**
   * ...AND THE SESSION CREDENTIAL MINTED OFF IT — see {@link Tools.ticket}. A
   * THUNK, answering `null` until the listener has bound, because a ticket is
   * minted per SESSION at a moment the plugin chooses.
   *
   * OPTIONAL, and absent means NO CREDENTIAL EVER.
   */
  readonly ticketFor?: (
    forbidden: () => ReadonlyArray<Forbidden>,
    writer: string,
    confined?: () => { readonly under: string; readonly says: string } | null,
  ) => MintedTicket | null
  /** Optional live display lookup; absence means no tool is recognized as ours. */
  readonly advertisedFor?: Tools["advertised"]
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
 * enclosing scope is open, and a plugin whose service is revoked unloads.
 *
 * NOTHING IS MOUNTED HERE.
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
      ticket: (forbidden, writer, confined) => config.ticketFor?.(forbidden, writer, confined) ?? NO_TICKET,
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

/** ...as the words a `needs` is written with. */
export const SERVICE_KEYS: ReadonlyArray<string> = SERVICES.map((one) => one.cordis)

/** THE SLOT CATALOG, from the one module both processes may open — see
 *  `./slots.ts` on why it is not `./browser.ts`'s any more. */
export type { SlotKey } from "./slots.ts"

export { HostLoading, openLoading, type Catalog, type OwnedLoader } from "./loading.ts"

/** Rows supply policy and (for nodes) a pure parser, never the identity stamped
 * by the registry. The policy is the same inert contract format and wire readers use. */
export type FileClaim = Omit<import("@olai/format").Claim, "kind">
export type ComposedClaim = import("@olai/format").Claim

/** Owned by vault setup. Each row may acquire one claim for its scope. A
 * conflicting kind or overlapping suffix defects without installing anything. */
export interface FileKinds {
  readonly current: () => ReadonlyMap<string, ComposedClaim>
  readonly changes: Stream.Stream<void>
  readonly register: (claim: FileClaim) => Effect.Effect<void, never, Scope.Scope>
}
export const FileKinds = serviceTag<FileKinds>("vault.file-kinds")
