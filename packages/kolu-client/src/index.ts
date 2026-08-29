/**
 * @olai/kolu-client — HOW OLAI REACHES KOLU, and the only place that knows how.
 *
 * One package holds the dial, the standing mirror, the projection into olai's
 * own vocabulary, and the one screen read. What leaves is `@olai/surface`'s
 * shapes — a `KoluLink`, a `FleetTerminal`, a `Snapshot` — so a
 * change to padi's contract is a change HERE and stops.
 *
 * ## Why a PACKAGE and not a directory under the server
 *
 * It began as `packages/server/src/kolu/`, and the argument against that is
 * about direction rather than tidiness. A directory can import its parent: one
 * convenient reach into `@olai/server`'s `runtime.ts` for a type, and the
 * boundary is a comment somebody has to keep believing. A PACKAGE WALL MAKES
 * THE DIRECTION PHYSICS — `@olai/kolu-client` cannot depend on `@olai/server`,
 * because a cycle does not resolve. Nothing has to be remembered and nothing
 * has to be swept for.
 *
 * That is also why the boundary check this repo briefly grew — a grep for padi
 * imports outside one directory — was deleted rather than kept: it was a
 * substitute for a wall, and the wall is here. The manifest is `@olai/surface`
 * and `effect`, and that is the whole olai half of it: the vocabulary
 * everything here produces, and nothing that can reach back.
 *
 * `@olai/format` is deliberately NOT in it. The walk over the vault that
 * decides who OWNS a terminal reads outline records, so it belongs to whoever
 * holds the vault (`@olai/server`'s `claimants.ts`); what crosses into this
 * package is four strings per claim ({@link ./fleet.ts}'s `Claimant`). Keeping
 * that edge out is what stops "how olai reaches kolu" from also knowing what an
 * outline node is — two subjects in one package, and a dependency with nothing
 * to do with padi.
 *
 * ## What is here, and what deliberately is not
 *
 * Phase 1a's half: the dial and its standing mirror ({@link ./link.ts}), the
 * projection and the ownership overlay ({@link ./fleet.ts}), the dot's fold
 * the rendezvous ({@link ./socket.ts}) and the snapshot
 * read ({@link ./screen.ts}). {@link ./index.ts}'s `koluHalf` is what a server
 * composes: three surface members and one revision hook.
 *
 * The driver, the gate predicates and the procedure registry
 * `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/orchestrator.md` also names are LATER PHASES and are
 * deliberately absent — a registry with one entry is a shape arguing for itself
 * before anything needs it. When they land they land here, which is the other
 * half of what the wall buys: there is somewhere for them to go that is not the
 * composition root.
 *
 * ## `null` is a setting, and it is most of the faces
 *
 * `olai web` dials. Every other face — `/mcp`, `olai surface`, a test — passes
 * `null`, and {@link koluHalf} answers each member the way an unreachable padi
 * does: the cell stays `absent`, the fleet is empty, the snapshot refuses in
 * words. ONE code path rather than two, which is the point — "this process has
 * no business holding a socket open" and "this laptop is not running kolu" are
 * the same thing to a reader, so they should be the same thing to the code.
 *
 * ## The two packages — the map, so a grep for `kolu` is not a reconstruction
 *
 * It was FIVE homes, and the list lived in five headers because a reader who
 * grepped `kolu` landed on whichever came first and had to assemble the rest.
 * The sixth Löwy sitting ended that arrangement rather than documenting it
 * better (`https://github.com/juspay/oss.olai/blob/main/olai/lowy-electricity/debate-2026-08-27.md`), on the human's ruling:
 * *"all of Kolu stuff should be encapsulated out, as a package or more
 * packages, so the non-kolu packages part of Olai doesn't contain Kolu
 * implementation"* — and *"a directory wall can be broken easily by importing;
 * package walls cannot."*
 *
 *   - **`@olai/kolu-client`** — THE DIAL and the wire. The only package that
 *     speaks padi: one socket per server, the standing mirror, the projection
 *     into olai's own shapes. Four doors beside the root — `./wire` (the
 *     vocabulary and the members — the events ring and the `pulse` cell are
 *     the newest — which `@olai/surface` spreads into its spec and re-exports),
 *     `./detect` (the spawn-time probe's
 *     surface), `./testlib` (the fake padi and its lifecycle) and `./drivers`
 *     (the two padi-dialing evidence scripts).
 *   - **`@olai/kolu-ui`** — EVERYTHING BROWSER. The Dock row on a `terminal`
 *     property, the live pane, the re-attach policy, the fleet the tab holds
 *     once, and the words the header readout says. Its socket is `KoluUi` —
 *     the app hands over its composed client and a clock, and nothing else
 *     crosses.
 *
 * What is left outside them is not kolu implementation but olai's own
 * judgement ABOUT kolu, and it is worth naming so the distinction survives:
 * `@olai/server`'s `claimants.ts` walks the vault for who OWNS a terminal
 * (outline records, injected into the dial rather than known by it);
 * `@olai/chat`'s `kolu.ts` decides what an absent kolu MEANS, in five English
 * sentences only chat can write, over the probe it reaches through
 * `@olai/kolu-client/detect`; `@olai/web` owns the pill, the block table and
 * the cadence. None of those import kolu, and `scripts/check-kolu-deps.sh`'s
 * fourth assertion is what makes that a fact rather than a habit.
 */

import { type CellStore, inMemoryStore } from "@kolu/surface/server"
import { type Claimant } from "./fleet.ts"
import { makeMirror, type MirrorOptions } from "./mirror.ts"
import {
  type FleetTerminal,
  KOLU_UNDIALED,
  type KoluEvent,
  type KoluLink,
  type Snapshot,
  type TerminalFrame,
  SnapshotRefused,
  type WatchPulse,
} from "./wire/index.ts"
import { makeWatch, type Watch, type WatchConfig } from "./watch.ts"
import { Effect, Stream } from "effect"

/**
 * What this half is handed.
 *
 * `fleet` is a FUNCTION rather than a face, and that is not indirection for its
 * own sake: the surface does not exist yet when this is built, and the first
 * rows can move before any socket is subscribed. Reading it at the moment a row
 * moves is the same arrangement `@olai/server`'s `bodies.ts` has, for its reason.
 */
export interface KoluDeps<N> {
  /** The link's environment and clock, or `null` for a face that is not to have
   *  one (see the header). */
  readonly options: MirrorOptions | null
  readonly fleet: () => {
    readonly upsert: (key: string, value: FleetTerminal) => void
    readonly remove: (key: string) => void
  } | undefined
  /** The events ring's writer verbs, as a FUNCTION for `fleet`'s reason: the
   *  surface may not exist yet when the first event fires. */
  readonly events: () => {
    readonly upsert: (key: string, value: KoluEvent) => void
    readonly remove: (key: string) => void
  } | undefined
  /** The pulse cell's setter, as a FUNCTION for `events`' reason: the
   *  surface may not exist yet when the first beat lands. */
  readonly pulse: () => {
    readonly set: (value: WatchPulse) => void
  } | undefined
  /** THE FIRST VAULT WALK, injected. Who claims which terminal is read off
   *  outline records, and an outline record is a thing this package must not
   *  know —
   *  so the server passes its own walk in (`@olai/server`'s `claimants.ts`,
   *  which stays there whole) and what comes back is four strings per claim.
   *  The ruling's words: "the server passes the vault-walk in". */
  readonly claimants: (nodes: ReadonlyArray<N>) => Iterable<Claimant>
  /** THE SECOND VAULT WALK, injected, and the same boundary again. What
   *  `_olai/Kolu.olai`'s watch knobs and mutes say is read off the same
   *  nodes by `@olai/server`'s `koluConfig.ts`; what crosses is the derived
   *  intervals and the MUTE VALUES, plus the malformed lines this package
   *  then says. See `koluConfig.ts` for what a malformed value means. */
  readonly config: (nodes: ReadonlyArray<N>) => {
    readonly config: WatchConfig
    readonly malformed: ReadonlyArray<string>
  }
  /** Routine narration, at debug: on a machine with no kolu this is a line
   *  every few seconds and it is not news. */
  readonly say: (line: string) => void
  /** The sentences the OWNER must read — the vault's malformed knob values
   *  (`@olai/server`'s `koluConfig.ts`) and the watcher's ambiguous-mute
   *  (`./watch.ts`) — wired to a level the default console turns on: a
   *  broken spell would stay behind `OLAI_LOG_LEVEL=debug` otherwise. */
  readonly warn: (line: string) => void
}

/** The three bindings, plus the one hook a revision pulls. */
export interface KoluHalf<N> {
  /** `cells.kolu`'s connector — where the standing link is FORKED, once, when
   *  the surface binds. Not when a browser subscribes: that is the whole of the
   *  one-connection claim, and it is the git sweep's own arrangement applied to
   *  a socket instead of a repository. */
  readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
  /** `collections.fleet`'s `readAll` — the mirror's own map rather than a copy
   *  of it, for the two directory collections' reason: a fresh subscription's
   *  snapshot and the deltas an open one is watching are two readings of one
   *  map. */
  readonly rows: () => Map<string, FleetTerminal>
  /** `procedures.screen.text`. */
  readonly screen: (
    terminal: string,
    lines: number | undefined,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  /** ONE OPEN PANE'S TERMINAL, live — the mirror's own attach, relayed. A
   *  face with no link answers the way every other member here does: in
   *  words, on a failing stream, rather than with a window on nothing. */
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
  /** A vault revision landed — re-derive who claims which terminal.
   *
   *  It takes CLAIMS rather than nodes, which is this package's boundary in one
   *  signature: the walk over the vault belongs to whoever holds the vault
   *  (`@olai/server`'s `claimants.ts`), and what arrives here is four strings
   *  per claim. See {@link Claimant}. */
  /**
   * THE FIVE MEMBER HANDLERS, as `@olai/server` spreads them.
   *
   * They used to be four clumps written out in `runtime.ts` — a store and a
   * connector for the cell, a `readAll` and two no-op writers for the
   * collection, a stream `source`, a procedure `text` — each one naming a verb
   * of this package's. Four clumps is not much code, but it is four places the
   * server had to know what a kolu member is SHAPED like, and every one of them
   * moved the day this package's surface moved.
   *
   * So the package returns them. The server spreads the slice into its own
   * sections and names no kolu verb at all.
   *
   * THE COLLECTION IS READ-ONLY ON THE WIRE and the two writers are no-ops on
   * purpose: creating and killing terminals are padi verbs, and the day olai
   * calls them it is the driver calling them, not a tab. That sentence was in
   * `runtime.ts` and travels with the handler it is about.
   */
  readonly handlers: KoluHandlers
  /**
   * A VAULT REVISION LANDED. The server drives it; what it hands over is the
   * nodes, and the WALKS are this package's to run through the TWO it was
   * given — one for the claims, one for the watcher's config.
   *
   * The claims are re-derived and the mirror told, as before; the second
   * half is the watcher's CONFIG, re-derived on the same revision — the way
   * `held-for`, `nag`, `heartbeat` and the mutes move under a live watcher's
   * hands. Both walks are the SERVER's (`@olai/server`'s `claimants.ts` and
   * `koluConfig.ts`); what crosses is four strings per claim and one
   * `WatchConfig` per revision — the boundary the header draws, grown one
   * sibling rather than relaxed one jot.
   */
  readonly revision: (nodes: ReadonlyArray<N>) => void
}

/**
 * ONE VAULT NODE, as this package needs to see it — which is not at all.
 *
 * The walk over the vault is the server's ({@link KoluDeps.claimants}), so what
 * crosses is whatever that walk takes. Typed as `unknown` deliberately: this
 * package must not learn what an outline record is, and a structural shape here
 * would be exactly that learning, written down.
 */
export type VaultNode = unknown

// (kept as the documentation of the intent; the interfaces below are PARAMETRIC
// in the node type, which is the same claim the compiler can check: a package
// generic in N cannot read an N.)

/** The five member handlers, in the shape `defineSurface`'s sections take. */
export interface KoluHandlers {
  readonly cells: {
    readonly kolu: {
      readonly store: CellStore<KoluLink>
      readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
    }
    /** The watcher's pulse — the whole of what the header's pill reads
     *  beyond the link's own `since`. Read-only on the wire: a beat
     *  never asks for a browser's opinion. */
    readonly pulse: {
      readonly store: CellStore<WatchPulse | null>
    }
  }
  readonly collections: {
    readonly fleet: {
      readonly readAll: () => Map<string, FleetTerminal>
      readonly upsert: () => void
      readonly remove: () => void
    }
    /** The events ring — `readAll` is the watcher's own map for `fleet`'s
     *  own reason, and the writers are no-ops for `fleet`'s too. */
    readonly events: {
      readonly readAll: () => Map<string, KoluEvent>
      readonly upsert: () => void
      readonly remove: () => void
    }
  }
  readonly streams: {
    readonly terminal: {
      readonly source: (
        input: { readonly terminal: string; readonly grid?: { cols: number; rows: number } },
      ) => Stream.Stream<TerminalFrame>
    }
  }
  readonly procedures: {
    readonly screen: {
      readonly text: (
        args: { readonly input: { readonly terminal: string; readonly lines?: number } },
      ) => Effect.Effect<Snapshot, SnapshotRefused>
    }
  }
}

/** The seed every face starts at, kolu or not — see `@olai/surface`'s
 *  `KOLU_UNDIALED`, which argues why it is spelled `absent` rather than given a
 *  fourth arm. */
export const SEED: KoluLink = KOLU_UNDIALED

/** What a face with no kolu answers a snapshot with — a refusal in words, like
 *  every other one here. "This olai has no link" is a thing a reader can act
 *  on; a fault is not. */
const NO_LINK = new SnapshotRefused({
  reason: "no-padi",
  says: "this olai has no kolu link, so there is no screen to read.",
})

/** Minted once: the empty fleet a linkless face reads, which nothing writes. */
const NO_ROWS = new Map<string, FleetTerminal>()

export const koluHalf = <N,>(deps: KoluDeps<N>): KoluHalf<N> => {
  /** THE WATCHER, built for every face — linked or not. On a machine with
   *  no kolu the collection is not dead, it is heartbeating, and a UI
   *  stating recently in that case is a healthy fresh-install preview. The
   *  clock is the wall: the tests that need a vocabulary of their own get
   *  it through `./watch.ts`'s `options.now`, not through here. */
  /** The beat's LAST value, so the cell's snapshot answer is the one the
   *  live broadcast ate: the setter publishes to open subscribers and the
   *  store answers a fresh one — the events collection's two paths, one
   *  member over. */
  let pulse: WatchPulse | null = null
  const watch: Watch = makeWatch(
    {
      emit: (event) => deps.events()?.upsert(event.id, event),
      evict: (id) => deps.events()?.remove(id),
      beat: (at, everyMs) => {
        pulse = { at, everyMs }
        deps.pulse()?.set(pulse)
      },
      say: deps.warn,
    },
    { now: () => Date.now() },
  )
  /** The malformed-set last said, joined for a one-line compare: the vault
   *  re-derives on every keystroke, and saying the same malformed value on
   *  each one is the noise this exists against. */
  let saidMalformed = ""
  /** A VAULT REVISION, as both walks. `mirror` may not exist (a linkless
   *  face), which is why the claims walk sits behind the optional call and
   *  the vault walk's `ReadonlyArray<N>` is satisfied by the surface-driven
   *  walk on the server's side. */
  let mirror: ReturnType<typeof makeMirror> | undefined
  const revision = (nodes: ReadonlyArray<N>): void => {
    mirror?.reclaim(deps.claimants(nodes))
    const next = deps.config(nodes)
    watch.reconfigure(next.config)
    const lines = next.malformed.join("\n")
    if (lines !== saidMalformed) {
      saidMalformed = lines
      for (const line of next.malformed) deps.warn(line)
    }
  }
  if (deps.options === null) {
    return {
      // A connector that PARKS rather than returns. A connector that returns
      // has FINISHED, and a finished connector is a member the framework may
      // consider settled; parking is what "this cell has one value and will
      // never move" looks like from inside the contract.
      connect: () => Effect.never,
      rows: () => NO_ROWS,
      screen: () => Effect.fail(NO_LINK),
      // A WINDOW ON NOTHING IS A SENTENCE, not an empty stream: see the
      // header on why `null` is a setting rather than a failure, and
      // `./mirror.ts` on why a refusal here fails rather than ends.
      attach: () =>
        Stream.make({ kind: "refused", says: NO_LINK.says } as TerminalFrame),
      revision,
      handlers: linklessHandlers(watch, () => pulse),
    }
  }
  const { now } = deps.options
  /** The cell's own handle, which arrives with the connector rather than with
   *  the rest of the sink — there is exactly one connector and it runs for the
   *  life of the runtime, so a closure is the whole of the plumbing. */
  let cell: { set: (value: KoluLink) => void } | undefined
  mirror = makeMirror(
    {
      link: (state) => cell?.set(state),
      // Every row the mirror moves is an observation, in the same breath
      // — that is the whole of the watcher's economy, and it is why the
      // watcher is sure its view is what the fleet tabs see. The two
      // leave-shapes are kept apart on the same breath: a row CLOSING is
      // `remove`, a fleet emptied by the link dying is `suspend` — the
      // difference a restart's `since` would re-date, which `./watch.ts`'s
      // header argues.
      upsert: (id, row) => {
        deps.fleet()?.upsert(id, row)
        watch.observe(id, row)
      },
      remove: (id) => {
        deps.fleet()?.remove(id)
        watch.remove(id)
      },
      clearedRow: (id) => {
        deps.fleet()?.remove(id)
        watch.suspend(id)
      },
      say: deps.say,
    },
    deps.options,
  )
  const connect = (handle: { set: (value: KoluLink) => void }): Effect.Effect<void> =>
    Effect.suspend(() => {
      cell = handle
      // The watcher's death is ordinary closure machinery: the connector
      // runs for the runtime's life (see `@anyforge/surface`'s
      // `driver.conn`), and an interruption of it is its stop.
      return Effect.ensuring(mirror.run, Effect.sync(() => watch.stop()))
    })
  const screen = (terminal: string, lines: number | undefined) =>
    mirror.screen(terminal, lines, now)
  return {
    connect,
    rows: mirror.rows,
    screen,
    attach: mirror.attach,
    revision,
    handlers: handlersOf({
      connect,
      rows: mirror.rows,
      events: watch.events,
      pulse: () => pulse,
      screen,
      attach: mirror.attach,
    }),
  }
}

export { type Dial } from "./link.ts"
export { DEFAULT_LINES } from "./screen.ts"
export { PADI_SOCKET, type Rendezvous, rendezvousIn } from "./socket.ts"
export { type Claimant } from "./fleet.ts"
export { type MirrorOptions } from "./mirror.ts"
export { DEFAULT_WATCH, makeWatch, WATCH_RING, type Watch, type WatchConfig } from "./watch.ts"

/**
 * THE FIVE HANDLERS, built from the verbs.
 *
 * One function so the SHAPE lives once. `runtime.ts` used to spell it one
 * clump a member and this package used to spell the verbs; now the package
 * spells both and the server spreads the result. The doc sentences travelled
 * with the handlers they are about, which is why they read as answers to
 * questions nobody asks in this file — they are answers a reader of the
 * SURFACE asks.
 */
const handlersOf = (verbs: {
  readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
  readonly rows: () => Map<string, FleetTerminal>
  readonly events: () => Map<string, KoluEvent>
  /** The pulse's LAST beat, for the cell's snapshot — the column the
   *  dep fold reads as the standing value, beside the broadcast the
   *  setter walks. */
  readonly pulse: () => WatchPulse | null
  readonly screen: (
    terminal: string,
    lines: number | undefined,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
}): KoluHandlers => ({
  cells: {
    kolu: {
      // The face's own store, seeded `absent`: the true answer for a headless
      // face that has no business holding a socket open.
      store: inMemoryStore<KoluLink>(SEED),
      connect: verbs.connect,
    },
    pulse: {
      // Wire-read-only, like `kolu`: a beat is something the server
      // records, never a value a tab could set. The store's getter is the
      // LAST stamped beat; the setter walks a hollow arm on purpose.
      store: { get: verbs.pulse, set: () => {} },
    },
  },
  collections: {
    fleet: {
      // The mirror's own map rather than a copy of it, for the two directory
      // collections' reason: a fresh subscription's snapshot and the deltas an
      // open one is watching are two readings of one map.
      readAll: verbs.rows,
      // READ-ONLY ON THE WIRE. Creating and killing terminals are padi verbs,
      // and the day olai calls them it is the driver calling them, not a tab.
      upsert: () => {},
      remove: () => {},
    },
    events: {
      // The ring's own map — snapshot-then-deltas against a LIVE source,
      // for `fleet`'s same reason. No writers: the watcher alone writes it.
      readAll: verbs.events,
      upsert: () => {},
      remove: () => {},
    },
  },
  streams: {
    terminal: {
      source: (input) => verbs.attach(input.terminal, input.grid),
    },
  },
  procedures: {
    screen: {
      text: ({ input }) => verbs.screen(input.terminal, input.lines),
    },
  },
})

/** What a face with no link answers on the whole surface — the same refusal
 *  the verbs above give, in the shape the surface takes. The events
 *  collection and the pulse cell are the one arm that is ALIVE here: no
 *  fleet, no screen, no pane — but the watcher pulses, which is the
 *  fresh-install preview its header argues for. */
const linklessHandlers = (
  watch: Watch,
  beat: () => WatchPulse | null,
): KoluHandlers =>
  handlersOf({
    // The connector beholds forever, and the RUNTIME's interrupt of it is
    // the same death the linked half plans: `ensuring`'s second arm is not
    // irrelevance — a connector that merely never-ends is where the
    // watcher's heartbeat has to be allowed to stop with the runtime.
    connect: () => Effect.ensuring(Effect.never, Effect.sync(() => watch.stop())),
    rows: () => NO_ROWS,
    events: watch.events,
    pulse: beat,
    screen: () => Effect.fail(NO_LINK),
    attach: () => Stream.make({ kind: "refused", says: NO_LINK.says } as TerminalFrame),
  })
