/**
 * KOLU'S SERVER HALF — everything kolu-shaped that a composition root used to
 * have to spell for itself.
 *
 * ## What this module is, in one sentence
 *
 * `@olai/server`'s `runtime.ts` held a `const kolu = koluHalf({…})` — a
 * fourteen-line call naming this appliance's constructor, three of its members
 * by name, two vault walks under kolu-shaped filenames, and two log channels —
 * and beside it a `wiring.kolu` slot on the composition's own interface. Every
 * line of that was olai's judgement ABOUT kolu written into a package that must
 * not know the word. It is here now, whole, and what core does instead is mount
 * a row: a fiber per plugin, each composing whatever it registers under its own
 * name.
 *
 * ## Why the SERVER half is its own door
 *
 * Three doors on this package and they are disjoint by GRAPH rather than by
 * taste. `./wire` is what every listener statically pulls in and may carry no UI
 * runtime and no padi. The ROOT is the wire identity. `./browser` is where this
 * plugin's browser faces hang — the Dock row, the live pane, the header readout,
 * all of them `./appliance`'s and all of them SolidJS. A server that reached
 * them would pull a UI runtime and an emulator onto the graph of a process that
 * renders nothing, which is the exact hazard this package's own appliance fence
 * was written for one floor down. So the runtime half is reached HERE, and it is
 * reached BY NAME: `@olai/bundle`'s `olai.yml` carries the row
 * `olai-plugin-kolu/server` and the loader mounts this module's DEFAULT export
 * as a fiber. What this door imports from `@olai/plugin-api` is the SERVICES
 * half — Effect and a handful of data shapes, no `solid-js`, and no `cordis` —
 * and `packages/bundle/src/fence.test.ts` walks the closure and asserts the
 * claim rather than trusting this paragraph.
 *
 * ## What did NOT move, and why the wall is where it is
 *
 * `koluHalf` stays behind this package's `./appliance` door, which is still the
 * only place that speaks padi: the dial, the standing mirror, the projection
 * into olai's own shapes, and the watcher are its, and the sixth sitting's
 * ruling that put them behind a wall is not reopened here. What moved is the
 * CALL — who assembles the deps, and out of what. That division is the whole of
 * the plugin/appliance split: the appliance knows how to reach the tool, and the
 * plugin knows what olai wants to make of it.
 *
 * The two vault walks are the sharpest instance of it and they came with the
 * call: {@link ./claimants.ts} reads who OWNS a terminal and {@link ./config.ts}
 * reads what `_olai/Kolu.olai` says, both over outline records, which is a thing
 * the package that dials padi must not learn (its interfaces are PARAMETRIC in
 * the node type so a compiler can hold it to that). They were in `@olai/server`
 * under kolu-shaped filenames. They are behind the plugin wall now, and what
 * still crosses into the appliance is four strings per claim and one reading per
 * revision.
 *
 * ## THE ONE SEAM ACROSS THE EFFECT BOUNDARY
 *
 * This plugin is an Effect and every registration below is a finalizer on its
 * scope. The APPLIANCE is not: `koluHalf`'s watcher fires callbacks from a
 * `setTimeout` and its two log channels are plain functions. So every point
 * where one of those has to start an Effect goes through `detached` — one named
 * seam, in the facade, forking under this plugin's own services (so a line
 * carries the level the operator asked for) and onto this plugin's scope (so
 * work in flight when the plugin unloads goes with it). Wrapping `@kolu/*` in
 * Effect instead is the ruling that has already been made the other way.
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import {
  Clock,
  definePlugin,
  Deliveries,
  detached,
  Env,
  Kinds,
  SessionStart,
  Surfaces,
  Vault,
  Wakes,
} from "@olai/plugin-api/services"
import {
  type Convention,
  conventionServed,
  declarationsOf,
  type Derived,
  type Located,
  NO_TYPING,
  type OutlineSet,
  type PropDeclarations,
} from "@olai/format"
import { Effect } from "effect"
import { type Dial, koluHalf } from "olai-plugin-kolu/appliance"
import type { KoluEvent } from "olai-plugin-kolu/appliance/wire"

import { claimantsIn } from "./claimants.ts"
import { koluFileIn, watchConfigIn } from "./config.ts"
import {
  bodyFor,
  classify,
  type Heartbeat,
  makeHeartbeat,
  type Meaning,
  type Ringing,
  ringingIn,
  standingIn,
  terminalsIn,
  whyOut,
} from "./doorbell.ts"
import { probe } from "./probe.ts"
import { listed, type Trace, tracing } from "./trace.ts"
import { wake } from "./wake.ts"
import { faces, name, surface } from "./wire.ts"

/** The kinds this plugin teaches a vault, reached on this door — see
 *  {@link ./kinds.ts} for the word, and `@olai/plugin-api`'s `services.ts` for why
 *  the table is assembled here rather than off the manifest. */
export { kinds } from "./kinds.ts"
import { kinds, ownKinds } from "./kinds.ts"

/** The wire half, re-exported so a composition root reads ONE entry per plugin
 *  — and so the sibling key the surface is composed under and the key its deps
 *  are filed under are the same word by construction rather than by two lists
 *  agreeing ({@link ./wire.ts} is where it is spelled). */
export { faces, name, surface } from "./wire.ts"

/**
 * WHETHER THIS HOST IS RUNNING KOLU, on the same door and for the same graph
 * reason ({@link ./probe.ts}).
 *
 * It is not part of the plugin's own installation, and the two are asked at
 * different moments by different callers: the runtime half is made ONCE when the
 * surface binds and keeps a socket for the life of the process, while this is
 * asked FRESH per conversation, on the session-open path, so a padi started
 * after olai is picked up by the next session instead of the next restart.
 */
export { probe } from "./probe.ts"

/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS — three strings, on this door for
 * {@link kinds}' reason ({@link ./wake.ts} argues the words themselves).
 *
 * It is DECLARATION and not behaviour, which is why it sits beside those two
 * rather than inside the plugin: the member that writes a scope refuses a plugin
 * declaring no wake, and it asks that question of the enabled halves long before
 * any of them has served anything.
 */
export { wake } from "./wake.ts"

/**
 * ONE REVISION OF THE VAULT, as much of it as this half reads.
 *
 * Core passes the whole published snapshot; this type is the part of it kolu
 * touches, and writing it as a structural subset rather than importing the
 * store's `Snapshot<Reading>` is what makes "each plugin takes what it needs" a
 * claim the compiler checks instead of a sentence in a header.
 *
 * THREE PIECES, and each is here for a reason the other two do not share. The
 * NODES are what the claims and the watch knobs are read off. The SET is what
 * the owned file is found among — served paths, not recorded ones, because a
 * config that parses to nothing contributes no records and the drawer's wrench
 * onto it must not fall away with them ({@link ./config.ts}'s `koluFileIn`).
 * And `changed`/`removed` are what makes that finding cheap: `conventionServed`
 * hands back the SAME object while nothing it describes has moved, so the walk
 * over every served path runs on the revisions that could have changed its
 * answer and on no others.
 */
export interface VaultRevision {
  readonly value: {
    readonly set: OutlineSet
    readonly derived: Derived
  }
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

/** This surface's own write face, which is what the runtime hands back under
 *  this plugin's key. Named here because it is this package's spec that decides
 *  what is on it — core carries the value as `unknown` and could not spell
 *  `collections.fleet` if it wanted to, which is the point. */
type Ctx = SurfaceCtx<typeof surface.spec>

/**
 * THE KOLU HALF, assembled — the padi link, the fleet it keeps, the events ring,
 * the watcher's pulse and the one screen read.
 *
 * ## `needs` IS the requirement channel, and the subset IS the documentation
 *
 * It was a `Services` interface: a hand-written subset of core's seven-field
 * blob, and the argument for writing it out was that a parameter is
 * CONTRAVARIANT, so a half that asked for something core does not offer was a
 * type error at the registry. The list below makes the same claim without a
 * shadow type, twice over: the runtime holds this plugin PENDING until every
 * name resolves, and the compiler computes this Effect's `R` from the same list,
 * so a service yielded here and not named there is a `tsc` error in this file.
 *
 * `Vault` is here where the old subset deliberately left `served` OFF: kolu
 * reads the served SET on every revision (`conventionServed`, for the file it
 * owns by convention), and the vault service is where that reading arrives.
 * `Env` carries the injectable too — `env.dial` is THIS plugin's double,
 * resolved from the registry binding rather than from a word this file supplies,
 * and it is narrowed to `Dial` once, below, at this package's own edge.
 *
 * ## What is unchanged by any of it
 *
 * MADE EAGERLY, STARTED LAZILY. Making the half is free and gives the collection
 * and the procedure something to read before anything has dialed, so a page that
 * loads while the link is still coming up draws an empty fleet and a hollow chip
 * rather than crashing on a null. STARTING it is the `link` cell's connector,
 * which the framework runs when the surface BINDS — the same place the git sweep
 * is forked, for the same reason: a standing fact about this machine is the
 * runtime's to keep, not the first subscriber's to pay for.
 *
 * THERE IS NO `null` ARM ANY MORE, and its absence is the composition rather
 * than a capability lost. `KoluDeps.options` still takes one — a face with no
 * business holding a socket open passed `null` and every member answered the way
 * an unreachable padi does — but a face that wants none of this now composes
 * none of this: a serve that turns the plugins off never mounts this row, so
 * this Effect is not run at all and there is no `surface/kolu/` on the wire to
 * answer hollowly. The state a reader sees is the stronger of the two: a member
 * that is absent rather than a member that is present and empty.
 */
export default definePlugin({
  name,
  needs: [Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  apply: Effect.gen(function*() {
    // EVERY SERVICE THIS PLUGIN NAMED, YIELDED ONCE, at the top — the same list
    // `needs` carries, in the same order, so a reader checks the two against each
    // other by looking at one screen.
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const env = yield* Env
    const vocabulary = yield* Kinds
    const opening = yield* SessionStart
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const wakes = yield* Wakes
    /** THE ONE SEAM ACROSS THE BOUNDARY — see this module's header. */
    const run = yield* detached

    /** This sibling's own write face, filled the moment it is implemented. A
     *  FUNCTION reads it below rather than a captured value, because the surface
     *  does not exist while this is being built and the mirror's first row can
     *  move before it does — the arrangement the three read-back closures in
     *  `runtime.ts` were, with core no longer in the middle of it. */
    let mine: Ctx | undefined

    /** THERE IS NO BOOT BEAT TO GATE ON — that was the timered watcher's boot
     *  pulse, and the subscription has none: a beat is stamped when a
     *  `watchStates` BATCH arrives, and one cannot arrive before a dial does,
     *  which is after every binding below exists. */
    const half = koluHalf<Located>({
      options: {
        env: env.vars,
        now: () => clock.now(),
        // THE ONE NARROWING, and the only cast in this package. Core carries a
        // plugin's test double opaquely because typing it would mean knowing what
        // this plugin dials; `Dial` is that word, and this is the edge that owns
        // it. A test that hands a fake padi through is checked against `Dial` by
        // `makeMirror` on the next line down, so a wrong value is a type error at
        // the harness rather than a silent no-op here.
        dial: env.dial as Dial | undefined,
      },
      fleet: () => mine?.collections.fleet,
      events: () => mine?.collections.events,
      pulse: () => mine?.cells.pulse,
      // THE VAULT WALKS, passed in — the appliance's own ruling, and this package
      // is now where both sides of it live. `claimants.ts` reads outline records,
      // which is a thing the package that dials padi must not learn; what crosses
      // is four strings per claim. `config.ts` is the second of the kind, for the
      // watcher's knobs: what crosses is the derived intervals and the malformed
      // lines to say.
      // ...LICENSED BY WHAT THE VAULT DECLARED, which is why the reading is
      // handed over rather than looked up: this walk finds its key by declared
      // KIND now, and `KoluDeps` takes `(nodes) => …` because that package must
      // not learn what a `Derived` is. So the plugin holds the reading beside
      // the convention below — the same `let`, set on the same revision, and read
      // synchronously inside the very call that set it.
      claimants: (nodes) => claimantsIn(declaring, nodes),
      config: watchConfigIn,
      // THE DOORBELL'S TAP, and the THIRD instance of the same boundary: what
      // crosses into this package is the wire's own frozen `KoluEvent`, and what
      // this side does with it — join it against the un-done nodes of a file
      // somebody scoped a conversation to, and compose whole sentences out of
      // the answer — is a walk over outline records that the appliance must not
      // be able to spell. Deferred through `ring` below rather than written
      // inline, because it reads `half` and `half` is what this call returns.
      rang: (event) => run(ring(event)),
      // THE HEARTBEAT'S TAP, and the doorbell's OTHER drive — the same watcher
      // beat the pill draws its recency from, spent on the floor under silence
      // ({@link ./doorbell.ts}'s `makeHeartbeat`). One beat, two readers, no
      // second timer and no second knob: the cadence a person set for the pill
      // is the window a conversation's quiet is measured in, by construction.
      beating: (everyMs) => {
        run(beats(everyMs))
      },
      // Chatter, at debug: on a machine with no kolu this is a line every few
      // seconds and it is not news. What IS news — a connect, a skew, a link that
      // dropped — is the same channel, because the alternative is this module
      // deciding which of padi's sentences matter.
      //
      // A FORK PER LINE, and both channels below are: `run` starts each one on
      // its own fiber, so two lines the same callback said may reach the sink in
      // either order. That is the seam's shape rather than this wiring's (the
      // bridge's `detached` argues it), and it is affordable here because these
      // lines stand alone. A pair that has to be read in order is one Effect
      // saying both, not two calls.
      say: (line) => run(Effect.logDebug(line)),
      // What the OWNER must read: a malformed `_olai/Kolu.olai` value — the
      // sentences whose promise lives in this package's `docs.md`. Rare by latch
      // (one line per new shape), and the default console level is `info`, so the
      // channel is `warning`, not `debug`.
      warn: (line) => run(Effect.logWarning(line)),
    })

    /** WHICH SERVED OUTLINE IS `_olai/Kolu.olai`, carried across revisions.
     *  `conventionServed` hands the same object back while nothing it describes
     *  has moved, so this is a walk over the served paths on the revisions that
     *  could have changed the answer and a pointer comparison on the rest. It is
     *  the plugin's `let` now: core used to hold it beside the inbox's and the
     *  shelf's, which meant a general package holding one plugin's convention. */
    let file: Convention | undefined

    /** ...AND WHAT THAT REVISION DECLARES, for {@link ./claimants.ts}'s licence.
     *  `declarationsOf` is memoised per view one package down, so this is a
     *  pointer read on every revision the declarations file did not move on.
     *  `NO_TYPING` before the first revision is the truth about it: nothing has
     *  been read, so nothing is declared, so nothing claims a terminal. */
    let declaring: PropDeclarations = NO_TYPING

    /** ...AND THE REVISION ITSELF, for the doorbell's walk.
     *
     *  The claims walk is handed NODES because the appliance calls it; this one
     *  is not called by anybody downstairs, and it needs the whole `Derived` —
     *  `byFile` to read one file, `status` to ask what is un-done (already
     *  mirror-resolved), and `byId` for `follow` to reach a mirror's target.
     *
     *  `undefined` BEFORE THE FIRST REVISION is the truth about it and the
     *  doorbell's own first gate: nothing has been read, so no file claims
     *  anything, so a fleet event that arrives before the vault does rings
     *  nobody. A watcher that fires that early would have to have held a
     *  terminal for a minute inside the boot, which is not a thing that happens —
     *  but the honest answer costs one comparison. */
    let derived: Derived | undefined

    /**
     * THE DOORBELL'S OWN ACCOUNT — every seam below says what it did, on the
     * owner's debug channel ({@link ./trace.ts} argues the level and the shape).
     *
     * It is a FIELD OF THE INSTALLATION and not of the module, because the
     * channel is: a tracer minted at module scope would be one process's log for
     * however many serves a test stands up. The line goes out through the
     * detached seam, because a trace is written from inside `said` — a thunk core
     * calls at the delivery moment, from its own fiber and not from this one.
     */
    const trace: Trace = tracing((line) => run(Effect.logDebug(line)))

    /**
     * THE WORDS, DERIVED AFRESH AT THE MOMENT THEY ENTER A CONVERSATION.
     *
     * ## Why this is not the ring's own answer
     *
     * `ring` asks only whether there is anybody to say this to — a COUNT, not a
     * sentence, and it composes none. The words are composed HERE, last thing,
     * because core holds a delivery through a running turn or until somebody
     * opens the conversation, and the fleet moves while it waits. The human found
     * one arriving about two terminals that had been killed and a lane that had
     * been merged and closed in the gap — a message asserting a world that had
     * closed while it queued.
     *
     * So core is handed a CLOSURE (`@olai/plugin-api`'s `Deliveries.deliver`) and
     * calls it last thing. This reads `derived` and `half.rows()` at CALL time —
     * the store's current revision and the live fleet, never the values the ring
     * tick closed over. It is {@link ./doorbell.ts}'s no-standing-set rule spent
     * on the delivery moment rather than the derivation one, and for the same
     * reason: an answer kept from before is a second copy of a truth that has
     * already changed.
     *
     * A SET THAT HAS ENTIRELY SETTLED ANSWERS `null`, and core drops the message
     * rather than shortening it. Rows that settled individually simply are not in
     * the sentence — `claimedIn` skips a node that is done and `standingIn` skips
     * a terminal the fleet no longer holds, so the drop needs no arm of its own.
     *
     * THE MEANING IS NOT RE-DECIDED. What the event said happened, happened; what
     * is asked again is who it is still true of.
     *
     * A PLAIN FUNCTION, because it is a derivation: the only thing in it that is
     * not one is the trace, which goes out through the seam.
     */
    const said = (file: string, meaning: Meaning, nag?: KoluEvent["nag"]): string | null => {
      const at = derived
      if (at === undefined) {
        // The store has never published, or an `unloaded` disowned the last
        // revision while this body waited. Said rather than swallowed: a
        // conversation that stopped being woken because the VAULT went away and
        // one that stopped because nobody claims anything look identical from
        // outside, and they are not the same fault.
        trace("dropped", { file, meaning, why: "no-revision" })
        return null
      }
      const rows = half.rows()
      const ringing = ringingIn(declaring, at, file, [...rows.keys()], trace)
      const standing = standingIn(ringing.claiming, rows, meaning)
      if (standing.length === 0) {
        trace("dropped", { file, meaning, why: "nobody-standing" })
        return null
      }
      trace("said", {
        file,
        meaning,
        standing: standing.length,
        nag: nag?.index ?? null,
        terminals: listed(standing.map((one) => one.terminal)),
      })
      return bodyFor(meaning, standing, file, clock.now(), nag)
    }

    /**
     * ONE WATCHER EVENT, RUNG THROUGH — the doorbell's whole drive loop.
     *
     * PER FILE, and delivered PER CONVERSATION, which are not the same count: two
     * seats may filter by two boards and mean two different things by one
     * terminal moving, so the derivation cannot be hoisted out of the loop — but
     * two seats on the SAME board with the SAME meaning are one answer all the
     * way to the count that decides whether anybody is told at all, so both the
     * claims walk and that count are memoised for the life of this call and
     * dropped with it. The rows and their id list are one reading of one map
     * however many scopes there are. THE SENTENCE is not memoised and is not
     * composed here at all — it is `said`'s, at the delivery moment, off a fresh
     * derivation.
     *
     * THE VALUES ARE RESOLVED AGAINST THE LIVE ROSTER (`half.rows()`) and never
     * against the event, which carries padi's whole id: the board writes
     * eight-character prefixes, and a join by string equality would answer
     * `unowned` for almost every row a real vault claims ({@link ./doorbell.ts}
     * argues it where the resolution happens).
     *
     * ONE COALESCE KEY PER MEANING, fixed. Core replaces an undelivered body with
     * the next one under the same key, so a burst while a turn runs arrives as
     * ONE message — and that is lossless only because the body is a fresh
     * derivation of standing state rather than an accumulation, which is the
     * claim `bodyFor` is written to keep. BOTH meanings are keyed, which is the
     * whole of the arm this plugin uses: a wake is a derivation exactly as a
     * digest is, so the newest one already says everything its predecessor said
     * and there is nothing for the un-keyed arm to protect.
     *
     * THE NAME IN THE KEY IS THIS PLUGIN TALKING TO ITSELF, and not a guard
     * against a neighbour. Core files a held slot under the PAIR of the plugin
     * and the key, so `"wake"` on its own could not be swallowed by another
     * plugin saying `"wake"` — the prefix buys legibility in a dump and nothing
     * else. IT USED TO SAY the opposite, that core keyed by conversation alone
     * and the name was what kept two plugins apart; a reader who believed it
     * would have carried the name into a key where it mattered rather than where
     * it merely reads well.
     *
     * AND IT CANNOT FAIL INTO A LOG'S TEETH. `run` forks it, so the subscription
     * callback that fires it (`watchAgentStates`'s own funnel) never takes the
     * truth of it personally — but a defect escaping on the fork kills a fiber
     * with no evidence either, and a doorbell's failure is the call that does not
     * happen, which is never logged by anybody else. So the whole walk is caught
     * once, at this package's edge, and said on the owner's channel: a doorbell
     * that failed is worth a line, and it is
     * worth exactly one.
     */
    const ring = (event: KoluEvent): Effect.Effect<void> =>
      Effect.gen(function*() {
        // FIRST, AND BEFORE EVERY GATE BELOW: what arrived. This is the line that
        // says a nag fired at all — the watcher emits `transition` once and `nag`
        // every window after it, and neither of them wrote a word anywhere before
        // this. A reader asking "did the fleet ever ask for this terminal" was
        // reading a chat transcript for the answer, which is only a record of the
        // events that RANG.
        trace("event", {
          kind: event.kind,
          at: event.at,
          terminal: event.row?.terminal ?? null,
          state: event.row?.state ?? null,
        })
        // A HEARTBEAT NAMES NO TERMINAL — the watcher is alive, which is the
        // pill's news. Asked here rather than only inside `classify` so that the
        // ordinary case on a quiet machine costs a comparison instead of a walk
        // per scope.
        if (event.row === null) return
        // ...AND THE ONE THING THE HEARTBEAT KEEPS OF IT: when this doorbell last
        // saw the fleet ask for somebody. Stamped BEFORE the vault gate below,
        // because it is a fact about the WATCHER and not about the vault — a
        // process whose store has stopped publishing is still seeing events, and a
        // heartbeat that said otherwise would blame the wrong half. The event's own
        // `at` rather than a fresh clock read: one moment, one stamp.
        heart.saw(event.at)
        const at = derived
        if (at === undefined) {
          trace("dropped", { terminal: event.row.terminal, why: "no-revision" })
          return
        }
        const rows = half.rows()
        const fleet = [...rows.keys()]
        // ONE WALK PER FILE. The derivation is per FILE and the scope is per
        // CONVERSATION, which are not the same cardinality: a person with three
        // seats on one board would otherwise pay three identical walks per event.
        // Minted per event and dropped with it — this plugin holds nothing between
        // ticks, which is the property the whole coalescing argument rests on.
        //
        // THE MEMO IS ALSO WHAT KEEPS THE TRACE HONEST: `ringingIn` says the set
        // out loud, so a `derived` line per seat on one board would report three
        // walks where the plugin did one, and a reader counting lines would be
        // reading the log's own shape rather than the doorbell's.
        const perFile = new Map<string, Ringing>()
        const ringingFor = (file: string): Ringing => {
          const held = perFile.get(file)
          if (held !== undefined) return held
          const fresh = ringingIn(declaring, at, file, fleet, trace)
          perFile.set(file, fresh)
          return fresh
        }
        // ...AND ONE COUNT PER (FILE, MEANING), which is the same argument carried
        // to its end. The walk above is not the only thing two seats on one board
        // share: what STANDS under a meaning is a function of the file's claims
        // and the meaning alone, and nothing else about a scope enters it — the
        // conversation is only ever the ADDRESS the words are sent to.
        //
        // A COUNT, AND NOT A SENTENCE. This asked `bodyFor` for the whole
        // multi-paragraph body and then tested it for `null`, throwing the string
        // away every time: the body that actually goes in is composed by `said` at
        // delivery, off a fresh derivation, which is the entire point of the
        // closure below. So the memo was keyed on "the expensive half" and the
        // expensive half was never used — one composed sentence per (file,
        // meaning) per event, built to be discarded. The question here has always
        // been "is there anybody to say this to", and that is a length.
        const perStanding = new Map<string, number>()
        const standingFor = (
          file: string,
          meaning: Meaning,
          claiming: Ringing["claiming"],
        ): number => {
          const key = `${meaning}:${file}`
          const held = perStanding.get(key)
          if (held !== undefined) return held
          // The event's own terminal is held by construction, so this is zero only
          // where the row moved between the emit and this walk. A sentence about
          // nobody is worse than no sentence.
          const fresh = standingIn(claiming, rows, meaning).length
          perStanding.set(key, fresh)
          return fresh
        }
        const scopes = deliveries.scopes()
        trace("scopes", {
          terminal: event.row.terminal,
          scoped: scopes.length,
          files: listed(new Set(scopes.map((scope) => scope.file))),
        })
        for (const scope of scopes) {
          const ringing = ringingFor(scope.file)
          const meaning = classify(event, ringing.claiming)
          // THE ONE LINE THE P1 WOULD HAVE BEEN FOUND BY, beside `derived` above.
          // SILENCE IS NO CALL AT ALL — not a quieter body, not a warning about an
          // unclaimed terminal; the dispatch dropped that arm on purpose, and it
          // stays dropped. But a silence nobody can SEE is what made a lane that
          // had fallen out of the set indistinguishable from a lane nobody scoped,
          // and that distinction is the whole diagnosis. So the silence is said
          // HERE, on the debug channel, and not to the conversation.
          //
          // ...AND IT SAYS WHICH GATE, which is the half that was missing. The RCA
          // this feature carries was "absent from the set"; the next one of its
          // shape would have been "absent, and I still do not know why", and the
          // reason is the readable fact. `why` rides only on the silent arm — a
          // wake and a digest are already their own explanation.
          trace("classified", {
            terminal: event.row.terminal,
            file: scope.file,
            agent: scope.agent,
            session: scope.session,
            meaning: meaning ?? "none",
            why: meaning === null ? whyOut(event.row.terminal, ringing) : null,
          })
          if (meaning === null) continue
          // Asked ONCE here, against the revision the event arrived on, so a ring
          // that has nothing to say costs no slot in core and no row.
          //
          // `dropped`, THE SAME WORD THE DELIVERY MOMENT USES, because it is the
          // same fact — nobody is standing — and the only difference is WHEN it
          // was asked. This said `withheld` here and `dropped` there, which is two
          // names for one thing and a reader left wondering which of the two they
          // were looking at. The seam a line came from is already in the line.
          if (standingFor(scope.file, meaning, ringing.claiming) === 0) {
            trace("dropped", { file: scope.file, meaning, why: "nobody-standing" })
            continue
          }
          trace("delivering", {
            file: scope.file,
            meaning,
            agent: scope.agent,
            session: scope.session,
            coalesce: `${name}:${meaning}`,
          })
          yield* deliveries.deliver(
            { agent: scope.agent, session: scope.session },
            // ... AND ASKED AGAIN AT THE MOMENT IT GOES IN, which is what this
            // closure is for. A body can wait through a running turn or until
            // somebody opens the conversation, and the fleet moves while it
            // waits: the human found a delivery arriving about two terminals that
            // had been killed and a lane merged and closed in the gap.
            //
            // It reads `derived` and `half.rows()` AT CALL TIME, never the values
            // this tick closed over — the same no-standing-set rule
            // {@link ./doorbell.ts}'s header states, spent on the delivery moment
            // rather than the derivation one. The per-event memo above is
            // deliberately not consulted here: it is this tick's answer, and this
            // closure's whole job is to not give this tick's answer.
            //
            // The MEANING is the event's and is not re-decided — what the event
            // said happened, happened. What is re-derived is who it is still true
            // of, and a set that has entirely settled answers `null`, which drops
            // the message rather than shortening it.
            //
            // THE GAP BETWEEN `delivering` AND `delivered` IS THE HOLD, and it is
            // worth two lines rather than one for exactly that reason: a body
            // handed over and never said is core coalescing it away or a fleet
            // that settled while it waited, and neither is visible from either end
            // alone.
            () => {
              // The REMINDER ACCOUNTING rides the event verbatim at delivery
              // time exactly as the meaning does: it is the event's own fact
              // (padi counted it, not us) — what is re-derived is who it is
              // still true of, never the counting (`./doorbell.ts`'s
              // `reminderOf` spells it).
              const body = said(scope.file, meaning, event.nag)
              // AND THE WINDOW RESETS HERE, where the words actually go in rather
              // than where the delivery was handed over. A body core coalesced
              // away, or one that derived to `null` because the fleet settled
              // while it waited, never reached anybody — and a window it silenced
              // would be a heartbeat lost to a message nobody got
              // ({@link ./doorbell.ts}'s `makeHeartbeat` argues the ledger).
              if (body !== null) heart.delivered(scope)
              trace("delivered", {
                file: scope.file,
                meaning,
                agent: scope.agent,
                session: scope.session,
                said: body !== null,
              })
              return body
            },
            { coalesce: `${name}:${meaning}` },
          )
        }
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("kolu: the doorbell could not ring for this fleet event", cause)
        ),
      )

    /**
     * HOW MANY TERMINALS ONE SCOPED FILE DERIVES, against the revision in force —
     * the heartbeat's one derived fact, and the only thing that module is handed
     * about the vault.
     *
     * `null` where there is no revision to derive off: before the first one, and
     * after an `unloaded` disowned the last. It is {@link ring}'s own first gate
     * in the shape a number-returning closure can spell it, and it is why a
     * heartbeat cannot go out with a hole where its count belongs.
     */
    const terminals = (file: string): number | null => {
      const at = derived
      return at === undefined ? null : terminalsIn(declaring, at, file)
    }

    /**
     * THE FLOOR UNDER SILENCE — the doorbell's second drive, and the reason the
     * orchestrator can retire its own hand-run fleet watch.
     *
     * Everything it decides is {@link ./doorbell.ts}'s ({@link makeHeartbeat});
     * what is composed here is the four seams it needs — core's scope list,
     * core's delivery door, the derivation above, and this half's clock. The key
     * is minted under this plugin's own name for {@link ring}'s stated reason:
     * core files a held slot under the PAIR of the plugin and the word, so the
     * prefix buys legibility in a dump and nothing else.
     *
     * `deliver` goes out through the detached seam because the heartbeat is
     * driven from the watcher's own interval and composes its sentence there.
     */
    const heart: Heartbeat = makeHeartbeat({
      scopes: () => deliveries.scopes(),
      deliver: (to, say, options) => run(deliveries.deliver(to, say, options)),
      terminals,
      now: () => clock.now(),
      coalesce: `${name}:heartbeat`,
      trace,
    })

    /**
     * ONE BEAT, RUNG THROUGH — and it cannot fail into a log's teeth either.
     *
     * {@link ring}'s last paragraph, applied to the second drive: the beat that
     * forks this is the subscription's per-batch stamp, so the same funnel
     * argument holds and the same evidence argument stands. A heartbeat that
     * failed is worth a line on the owner's channel, and worth exactly one.
     */
    const beats = (everyMs: number): Effect.Effect<void> =>
      Effect.sync(() => heart.beat(everyMs)).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("kolu: the doorbell could not beat for this watch window", cause)
        ),
      )

    /** THE KINDS THIS PLUGIN TEACHES THE VAULT, as registrations. The service
     *  composes each word from this plugin's own — the registry binding — so what
     *  this file hands over is the BARE word and the prefix is never this file's
     *  to spell. Its own built-in declaration can therefore claim `kolu-terminal`
     *  and nothing else, which is what makes a person's own `terminal` column
     *  untouchable by a flag on the machine. */
    for (const kind of kinds) yield* vocabulary.register(kind)

    /** ...AND THE SENTENCE THE STRIP DRAWS. It was a field on the server door; it
     *  is a registration now, so a scope written for a plugin that has since
     *  unloaded is refused by the same check that refuses one for a plugin that
     *  never declared a wake. */
    yield* wakes.register(wake)

    /**
     * THE SIBLING SURFACE, and the two things that ride with it.
     *
     * `deps` is THE FIVE MEMBER HANDLERS, straight through, and the `satisfies`
     * is where the agreement between this plugin and the framework is actually
     * proved: `ImplementSurfaceDeps<typeof surface.spec>` is written against THIS
     * package's own surface, so a member the appliance renamed, dropped or
     * re-shaped is a type error in this file with this plugin's name on it. Core
     * carries the value as `unknown` and never opens it, which is why the check
     * has to be here.
     *
     * `published` is this sibling's ctx, the moment the runtime has minted it.
     * The cast is this package narrowing an opaque value to its OWN surface's
     * write face — the mirror image of the `dial` narrowing above, and safe for
     * the same reason: core addresses it by the only word it knows about this
     * plugin, which is the key it composed the surface under.
     *
     * NO NAME. The sibling key is the plugin's own word, read by the service off
     * the registry binding, so this half cannot register under a name that is not
     * the one it was mounted as — and there is no line anywhere for the two to
     * drift apart on.
     */
    yield* surfaces.register({
      surface,
      faces,
      deps: half.handlers satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
      },
    })

    /**
     * A VAULT REVISION LANDED — re-derive who claims which terminal, and what the
     * watcher's knobs now say.
     *
     * It walks every node and publishes almost nothing: the mirror compares each
     * row's owner before it upserts, so a keystroke that landed in a note costs
     * one walk and zero frames. What it costs on the revision a `terminal`
     * property is actually written is one frame for that terminal's row.
     *
     * The FILE is asked of the SERVED outlines rather than of the records
     * (`served`, not `recorded`): a file the codec tore apart still names itself,
     * and the foot's wrench over it must not fall away WITH the nodes.
     *
     * THE PAYLOAD IS NARROWED HERE, in this plugin's own signature: core rings
     * the whole published snapshot and {@link VaultRevision} names the parts kolu
     * touches. The door is generic in its payload, so that signature IS the
     * narrowing — inferred from the handler rather than asserted inside it.
     *
     * IT IS A CLAIM AND NOT A CHECK, which the door says at length: the payload
     * type is the caller's to pick, so nothing holds this line against what the
     * root actually publishes. A field named here that the snapshot does not
     * carry compiles and reads `undefined`. What the move bought is one `as` in
     * the door instead of one in each of three halves, not a check that was
     * never there.
     */
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        file = conventionServed(koluFileIn, revision.value.set, revision, file)
        declaring = declarationsOf(revision.value.derived, ownKinds)
        // ...AND THE READING ITSELF, held for the doorbell. It is the same pointer
        // the two walks above are about, kept because the doorbell's walk runs on
        // the WATCHER's clock rather than on this listener — a fleet event arrives
        // between revisions, and the vault it is joined against has to be the last
        // one that landed.
        derived = revision.value.derived
        half.revision(revision.value.derived.nodes, file.file ?? null)
      })
    )

    /**
     * THE STORE HAS NEVER PUBLISHED — and this is NOT teardown.
     *
     * The vault's kolu verdict goes out with the canvas: yesterday's wrench,
     * aimed at a file this serve can no longer say it read, is a claim the store
     * cannot vouch for. The watch knobs are NOT touched — their timers hold their
     * last hand-off while the mirror, equally starved, has nothing new for them
     * to gate.
     *
     * ## The two `let`s go with it, and the DOORBELL is why
     *
     * {@link ring} runs on the WATCHER's clock rather than on a revision, so
     * `derived` and `file` are exactly the pair a fleet event arriving after a
     * disown would be joined against. Leaving them set means the doorbell keeps
     * walking a vault the store has explicitly stopped vouching for and ringing
     * somebody about claims read out of it. `undefined` is the doorbell's own
     * first gate ({@link ring} returns on it), so clearing it is how the walk is
     * told.
     *
     * UNLOADING THIS PLUGIN IS A DIFFERENT THING, and the door's name is what
     * keeps them apart. A disposed plugin unwinds every registration above — the
     * sibling surface, the kinds, the wake, these listeners — and what this
     * listener does is none of that: it says the DISK went away, not that kolu
     * did.
     */
    yield* vault.unloaded(Effect.sync(() => {
      derived = undefined
      file = undefined
      half.unloaded()
    }))

    /** IS KOLU'S MCP SERVER HERE, asked once per conversation opening — the
     *  `chat/session-start` door, and what is registered is the ASKING rather
     *  than an answer, so the asking stays `@olai/chat`'s to schedule and the
     *  list is read per session rather than once per boot. THE PLUGIN'S NAME IS
     *  NOT WRITTEN HERE: the door stamps it off the fiber, like every other
     *  keyed registration. `env.vars` and not `process.env`: a probe that read
     *  the environment itself would answer a different question than the one a
     *  session's spawn will ask. */
    yield* opening.ask(Effect.promise(() => probe(env.vars)))
  }),
})
