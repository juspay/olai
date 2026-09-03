/**
 * olai-plugin-kolu/appliance — HOW OLAI REACHES KOLU, and the only place that knows how.
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
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/orchestrator.md` also names are LATER PHASES and are
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
 * better (`https://github.com/juspay/oss.olai/blob/main/projects/olai/lowy-electricity/debate-2026-08-27.md`), on the human's ruling:
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
 *   - **`olai-plugin-kolu`'s `src/appliance/`** — EVERYTHING BROWSER. The Dock row on a
 *     `terminal` property, the live pane, the re-attach policy, the fleet the
 *     tab holds once, and the words the header readout says. Its socket is
 *     `KoluUi` — the app hands over its composed client and a clock, and
 *     nothing else crosses. It was a package of its own (`@olai/kolu-ui`) until
 *     the appliance fold folded it into the tenant beside the judgement.
 *
 * What is left outside them is not kolu implementation but olai's own
 * judgement ABOUT kolu, and it has a package of its own now:
 * `olai-plugin-kolu`. It walks the vault for who OWNS a terminal
 * (`claimants.ts` — outline records, injected into the dial rather than known
 * by it) and for what `_olai/Kolu.olai` says (`config.ts`); it decides what an
 * absent kolu MEANS, in five English sentences, over the probe it reaches
 * through `@olai/kolu-client/detect` (`probe.ts`, which was `@olai/chat`'s
 * until the plugin wall went up); and it owns the padi pill and the feed its
 * press opens. Every one of those used to sit in a general package under a
 * kolu-shaped filename, and none of them names a `@kolu/*` package —
 * everything reaches kolu through this one and `olai-plugin-kolu`, which is what
 * `packages/bundle/src/fence.test.ts` holds as a fact rather than a habit —
 * it absorbed the assertion `scripts/check-kolu-deps.sh` used to make, and the
 * script that kept the name asks about manifests now, not imports. It holds it
 * by DERIVING the tenant from the registry, so the fold that moved kolu's faces
 * into the plugin package moved the wall with them and nothing was edited here.
 */

import { type CellStore, inMemoryStore } from "@kolu/surface/server"
import { type Claimant } from "./fleet.ts"
import { makeMirror, type MirrorOptions } from "./mirror.ts"
import {
  type FleetTerminal,
  KOLU_UNDIALED,
  type KoluEvent,
  type KoluKnobs,
  type KoluLink,
  NO_KNOBS,
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
   *  `_olai/Kolu.olai`'s watch knobs say is read off the same nodes by
   *  `olai-plugin-kolu`'s `config.ts`; what crosses is the derived
   *  intervals plus the malformed lines this package then says. The FILE is
   *  a QUESTION THE CALLER ANSWERED (the served-paths convention,
   *  `koluFileIn`), passed in so the walk reads inside it — a file that
   *  parses to nothing offers no nodes, and the foot's wrench onto it
   *  must still draw, which is why the `knobs` cell is published off THIS
   *  argument rather than off anything the walk hands back. See
   *  `config.ts` for what a malformed value means. */
  readonly config: (nodes: ReadonlyArray<N>, file: string | null) => {
    readonly config: WatchConfig
    readonly malformed: ReadonlyArray<string>
  }
  /**
   * THE DOORBELL'S TAP, injected, and the boundary once more — every event
   * the watcher emits, handed to whoever wants to ring something with it.
   *
   * ONLY THE WIRE'S OWN `KoluEvent` CROSSES, which is the whole of why this
   * is a callback and not a member on {@link KoluHalf}: `olai-plugin-kolu`
   * joins each event against an OUTLINE RECORD — the un-done nodes of a
   * file somebody scoped a conversation to — and an outline record is the
   * one thing this package must never learn. The event is already frozen,
   * already schema'd, and already the thing the events ring carries; what
   * is on the other end of this function is not this package's business.
   *
   * OPTIONAL, like {@link MirrorOptions}' own dial: a face that rings
   * nobody passes nothing and pays nothing, and every existing caller keeps
   * compiling. `heartbeat` events arrive here too — `row` is `null` on them
   * and it is the READER's job to know that means no terminal moved, since
   * filtering here would be this package deciding which of its own events
   * matter to somebody else.
   */
  readonly rang?: (event: KoluEvent) => void
  /**
   * THE HEARTBEAT'S TAP, and the same boundary once more — the watcher's own
   * beat, handed to whoever wants to prove liveness with it.
   *
   * It rides the beat that already exists ({@link ./watch.ts}'s `pulse`,
   * armed at `heartbeatMs`) rather than minting a second one: a second timer
   * would be a second cadence, and the day the two disagreed there would be no
   * way to say which one the vault's `heartbeat` knob had meant. What is on the
   * other end of this — `olai-plugin-kolu`'s doorbell, delivering four derived
   * facts into a conversation that has heard nothing for a window — is not this
   * package's business, exactly as {@link KoluDeps.rang}'s reader is not.
   *
   * ONLY THE CADENCE CROSSES, and the beat's own `at` deliberately does not.
   * `WatchSink.beat` carries the stamp because the PILL draws it — the pill is
   * about the last beat, so the last beat's clock is its subject. The doorbell's
   * words are composed at the moment they enter a conversation, which is a turn
   * or an hour later, and they stamp themselves then; a beat's `at` crossing
   * here would be a time the message it ends up in is not about. What the
   * cadence buys is the one thing the reader cannot derive: how long the silence
   * it is about actually was.
   *
   * OPTIONAL, like {@link KoluDeps.rang} beside it: a face that proves nothing
   * to nobody passes nothing and pays nothing.
   */
  readonly beating?: (everyMs: number) => void
  /** Routine narration, at debug: on a machine with no kolu this is a line
   *  every few seconds and it is not news. */
  readonly say: (line: string) => void
  /** The sentences the OWNER must read — the vault's malformed knob values
   *  (`olai-plugin-kolu`'s `config.ts`) — wired to a level the default
   *  console turns on: a broken spell would stay behind
   *  `OLAI_LOG_LEVEL=debug` otherwise. */
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
   * half is the watcher's CONFIG, re-derived off the one file the caller
   * named — the way `held-for`, `nag` and `heartbeat` move under a live
   * watcher's hands. Both walks are the PLUGIN's
   * (`olai-plugin-kolu`'s `claimants.ts` and `config.ts`); what crosses is
   * four strings per claim and one reading per revision — a `WatchConfig`
   * for the timers — the boundary the header draws, grown one sibling
   * rather than relaxed one jot. The FILE the caller named is the `knobs`
   * cell's whole value, published from this argument rather than echoed
   * back through the walk: the wrench must draw over a config that parses
   * to nothing, and a file that offers no nodes cannot name itself.
   */
  readonly revision: (nodes: ReadonlyArray<N>, file: string | null) => void

  /** The store has NEVER published — the directory's read failed outright.
   *  The wrench's door onto a file the server can no longer see is a page
   *  the store cannot vouch for: the reading resets to nothing. The watch
   *  KNOBS are not touched — their timers hold their last hand-off while
   *  the mirror, equally starved, has nothing new for them to gate. */
  readonly unloaded: () => void
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
    /** WHETHER THERE IS A PADI — named `link` and not `kolu`, which is the
     *  package saying what the cell HOLDS rather than whose package it is in.
     *  A member named for its own appliance reads `surface/kolu/kolu/get` once
     *  core composes this surface as a sibling — the word twice and the thing
     *  once — and the value is a `KoluLink`. */
    readonly link: {
      readonly store: CellStore<KoluLink>
      readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
    }
    /** The watcher's pulse — the whole of what the header's pill reads
     *  beyond the link's own `since`. Read-only on the wire: a beat
     *  never asks for a browser's opinion. */
    readonly pulse: {
      readonly store: CellStore<WatchPulse | null>
    }
    /** WHICH FILE DECIDES THE WATCH — the drawer's foot, and the door its
     *  wrench opens. Read-only on the wire: a knob is an EDIT to the config
     *  outline, never a browser's write. The `connect` is the publish's
     *  household door — the `link` cell's own reasons one member up. */
    readonly knobs: {
      readonly store: CellStore<KoluKnobs>
      readonly connect: (cell: { set: (value: KoluKnobs) => void }) => Effect.Effect<void>
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
  /** THE WATCHER, built for every face — linked or not, though SUBSCRIBING
   *  only when one binds: on a machine with no kolu the collection is not
   *  dead, it is empty, and the pill reads the LINK cell for why (`absent`),
   *  which is the register that was already drawn. The clock is the wall:
   *  the tests that need a vocabulary of their own get it through
   *  `./watch.ts`'s `options.now`, not through here. */
  /** The beat's LAST value, so the cell's snapshot answer is the one the
   *  live broadcast ate: the setter publishes to open subscribers and the
   *  store answers a fresh one — the events collection's two paths, one
   *  member over. */
  let pulse: WatchPulse | null = null
  /** The knobs' LAST reading, for the cell's snapshot — the beat's
   *  arrangement one layer up, with ONE difference that decides whether
   *  the cell can move at all. The pulse's store reads a hoisted `let`
   *  this half writes BEFORE it publishes; the knobs' may not, because
   *  the knobs cell DECLARES `equals` and the framework gates a publish
   *  on `equals(store.get(), next)`: a store reading the value the same
   *  walk just wrote compares the new against the new and EVERY publish
   *  is eaten as a no-op. So the standing value lives IN the store, and
   *  the framework's own write-through (equals → publish → store.set) is
   *  the only writer: the snapshot is answered off the standing value,
   *  never a re-walk of a vault this package cannot see — and the publish
   *  is judged against the reading BEFORE this one.
   *
   * The seed is the defaults' own: before any revision lands, no file
   * has decided anything yet. */
  const knobsStore = inMemoryStore<KoluKnobs>(NO_KNOBS)
  /** The cell's own HANDLE, which may not ride `deps` onto the whole
   *  surface's ctx: a cell's first reading lands INSIDE `implementSurface`,
   *  while that ctx is still being minted — a publish into it there is
   *  silently DROPPED, leaving a config the vault named with no subscriber
   *  at all. The `git` cell across the surface answers the same riddle the
   *  same way: the cell arrives AT this handler's `connect`, and capturing
   *  that handle is the whole of the plumbing. The pulse's cell remains by
   *  its closure for the rule's exceptions: a beat re-answers on the
   *  watcher's own cadence, so the pledge the first-boot edge asks for is
   *  not a publish-that-once-fired one. */
  let knobsCell: { set: (value: KoluKnobs) => void } | undefined
  /** WHICH FILE THE LAST REVISION NAMED, kept apart from the store for the
   *  connector's own settle: the manifest's connector and this cell's
   *  bind run in no promised order, so a revision may land before the
   *  capture above runs — the publish had nowhere to go and the store
   *  holds only the seed. Settling through the FRAMEWORK's `set` is the
   *  point anyway: the `equals` gate turns a no-op settle back into
   *  silence, so the walk is never answered twice.
   *
   *  It is the caller's own `file` ARGUMENT and not anything the config
   *  walk hands back: a `_olai/Kolu.olai` the codec tore apart contributes
   *  no records, and the wrench onto it is exactly the door by which a
   *  person would go and repair it. */
  let deciding: string | null = null
  /** One shaper for the revision AND the settle, so the two can never
   *  drift. */
  const currentKnobs = (): KoluKnobs => ({ file: deciding })
  /** One publisher, so a file arriving, moving or going re-publishes from
   *  here and the equals gate keeps no-op moves silent. */
  const publishKnobs = (): void => {
    knobsCell?.set(currentKnobs())
  }
  /** The BIND hook named in the verbs map: capture the handle, then settle
   *  with the walk's last reading — the framework's gate is what lets this
   *  settle run unconditionally: a boot on defaults publishes nothing. */
  const knobsConnect = (cell: { set: (value: KoluKnobs) => void }): Effect.Effect<void> =>
    Effect.sync(() => {
      knobsCell = cell
      cell.set(currentKnobs())
    })
  const watch: Watch = makeWatch(
    {
      // THE DOORBELL'S TAP RIDES THE RING'S OWN BREATH. `rang` is called
      // on the event the collection just took, in the same statement, so
      // "what a tab reads in the drawer" and "what a conversation was rung
      // with" are one event and can never be two answers. Its absence is
      // the ordinary case (`?.`), and what it does with the event is not
      // this package's business — see `KoluDeps.rang`.
      emit: (event) => {
        deps.events()?.upsert(event.id, event)
        deps.rang?.(event)
      },
      evict: (id) => deps.events()?.remove(id),
      // THE HEARTBEAT'S TAP RIDES THE PILL'S OWN BREATH, which is the `rang`
      // arm's argument one member up: the beat a tab draws its recency from
      // and the beat a conversation's floor-on-silence is measured by are ONE
      // beat, in one statement, and can never be two cadences. Its absence is
      // the ordinary case (`?.`) — see `KoluDeps.beating` for why only the
      // cadence crosses and the stamp does not.
      beat: (at, everyMs) => {
        pulse = { at, everyMs }
        deps.pulse()?.set(pulse)
        deps.beating?.(everyMs)
      },
    },
    { now: () => Date.now(), say: deps.say },
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
  const revision = (nodes: ReadonlyArray<N>, file: string | null): void => {
    mirror?.reclaim(deps.claimants(nodes))
    const next = deps.config(nodes, file)
    // THE DRAWER'S FOOT, off the CALLER'S OWN ARGUMENT: the timers take the
    // walk's answer and the wrench takes the file the convention named, and
    // the two are the same breath so a foot can never point at a file whose
    // knobs are not the ones in force. The publish rides the cell's OWN
    // handle — the manifest connector and this cell's bind run in no
    // promised order, so `deciding` keeps the answer and the cell's
    // `connect` settles it as its first act.
    deciding = file
    watch.reconfigure(next.config)
    publishKnobs()
    const lines = next.malformed.join("\n")
    if (lines !== saidMalformed) {
      saidMalformed = lines
      for (const line of next.malformed) deps.warn(line)
    }
  }
  const unloaded = (): void => {
    deciding = null
    publishKnobs()
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
      unloaded,
      handlers: linklessHandlers(watch, () => pulse, knobsStore, knobsConnect),
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
      // Every row the mirror moves is one the watcher may need when a padi
      // event about that terminal lands: the frozen row a `KoluEvent`
      // carries is this map's latest read, in the same breath (`./watch.ts`).
      // THE LEAVE HALVES KEEP IT: an event about a just-closed terminal
      // still wants its draw, which is why neither remove shape reaches the
      // watcher.
      upsert: (id, row) => {
        deps.fleet()?.upsert(id, row)
        watch.observe(id, row)
      },
      remove: (id) => deps.fleet()?.remove(id),
      clearedRow: (id) => deps.fleet()?.remove(id),
      face: (padi) => watch.attach(padi),
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
    unloaded,
    handlers: handlersOf({
      connect,
      rows: mirror.rows,
      events: watch.events,
      pulse: () => pulse,
      knobs: knobsStore,
      knobsConnect,
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
export {
  DEFAULT_WATCH,
  type HeldState,
  /** THE ONE FOLD, on the root door — see its own block in `./watch.ts` for
   *  why the doorbell one package up is handed the function rather than the
   *  vocabulary behind it. */
  heldStateOf,
  makeWatch,
  WATCH_RING,
  type Watch,
  type WatchConfig,
  type WatchNag,
} from "./watch.ts"
/** KOLU'S OWN DURATION GRAMMAR, re-opened at the root door: the vault walk
 *  (`../../config.ts`) lives in the judgement half, which the repo's fence
 *  keeps from importing an `@kolu` package — so the parsers and nothing
 *  else of the `@kolu` tier cross here. What the walk refuses is said in
 *  kolu's own words. */
export { parseDuration, parseNag } from "@kolu/padi-client/watchDuration"

/**
 * THE HANDLERS, built from the verbs.
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
  /** The knobs' store — NOT the pulse's closure arrangement: the cell
   *  declares `equals`, and the framework's publish gate reads
   *  `store.get()`, so the half may not also hold the value. The
   *  standing reading, the publish gate and a fresh subscriber's
   *  snapshot are therefore all answered off this one store, written
   *  only by the framework's own write-through. */
  readonly knobs: CellStore<KoluKnobs>
  /** The knobs' BIND hook — the `kolu` cell's `connect` arrangement:
   *  where the cell's own handle arrives. The publish may not cross the
   *  surface-wide ctx for the manifest cell's reason spelled the other
   *  way round: the first reading lands while that ctx is still in mint,
   *  and the settle at bind is the cell's own. */
  readonly knobsConnect: (cell: { set: (value: KoluKnobs) => void }) => Effect.Effect<void>
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
    link: {
      // The face's own store, seeded `absent`: the true answer for a headless
      // face that has no business holding a socket open.
      store: inMemoryStore<KoluLink>(SEED),
      connect: verbs.connect,
    },
    pulse: {
      // Wire-read-only, like `link`: a beat is something the server
      // records, never a value a tab could set. The store's getter is the
      // LAST stamped beat; the setter walks a hollow arm on purpose.
      store: { get: verbs.pulse, set: () => {} },
    },
    knobs: {
      // Wire-read-only, the pulse's own argument one cell over: a knob
      // is an EDIT to the vault's config outline, which reaches this
      // cell through the revision walk and no other way. The store is
      // the half's own — the `equals` gate lives OFF it, so it may not
      // be a closure over anything the walk can move first.
      store: verbs.knobs,
      connect: verbs.knobsConnect,
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
 *  collection, the pulse cell and the knobs cell are the one arm that is
 *  ALIVE here: no fleet, no screen, no pane — but the watcher pulses and
 *  its config reads, which is the fresh-install preview its header
 *  argues for. */
const linklessHandlers = (
  watch: Watch,
  beat: () => WatchPulse | null,
  knobs: CellStore<KoluKnobs>,
  knobsConnect: (cell: { set: (value: KoluKnobs) => void }) => Effect.Effect<void>,
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
    knobs,
    knobsConnect,
    screen: () => Effect.fail(NO_LINK),
    attach: () => Stream.make({ kind: "refused", says: NO_LINK.says } as TerminalFrame),
  })
