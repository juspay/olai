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
 * not know the word. It is here now, whole, and what core does instead is
 * iterate: it hands every enabled plugin the same {@link Services} blob and
 * composes whatever comes back under that plugin's own name.
 *
 * ## Why the SERVER half is its own door
 *
 * Three doors on this package and they are disjoint by GRAPH rather than by
 * taste. `./wire` is what every listener statically pulls in and may carry no
 * UI runtime and no padi. The ROOT is the manifest, and the manifest is where
 * this plugin's browser faces hang — the Dock row, the live pane, the header
 * readout, all of them `@olai/kolu-ui` and all of them SolidJS. A server that
 * reached the runtime half through the manifest would pull a UI runtime and an
 * emulator onto the graph of a process that renders nothing, which is the exact
 * hazard `@olai/kolu-client/wire`'s own fence was written for one floor down.
 * So the runtime half is reached HERE, and `@olai/plugins`' own `./server` door
 * is what a composition root opens (`packages/plugins/src/fence.test.ts` walks
 * that closure and asserts the claim rather than trusting this paragraph).
 *
 * ## What did NOT move, and why the wall is where it is
 *
 * `koluHalf` stays in `@olai/kolu-client`, which is still the only package that
 * speaks padi: the dial, the standing mirror, the projection into olai's own
 * shapes, and the watcher are its, and the sixth sitting's ruling that put them
 * behind a package wall is not reopened here. What moved is the CALL — who
 * assembles the deps, and out of what. That division is the whole of the
 * plugin/appliance split: the appliance knows how to reach the tool, and the
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
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
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
import { type Dial, koluHalf } from "@olai/kolu-client"
import type { KoluEvent } from "@olai/kolu-client/wire"

import { claimantsIn } from "./claimants.ts"
import { koluFileIn, watchConfigIn } from "./config.ts"
import {
  bodyFor,
  claimedIn,
  claimingIn,
  classify,
  type Heartbeat,
  makeHeartbeat,
  type Meaning,
  standingIn,
  terminalsIn,
} from "./doorbell.ts"
import { name, surface } from "./wire.ts"

/** The kinds this plugin teaches a vault, reached on this door — see
 *  {@link ./kinds.ts} for the word, and `@olai/plugins`' `server.ts` for why
 *  the table is assembled here rather than off the manifest. */
export { kinds } from "./kinds.ts"
import { ownKinds } from "./kinds.ts"

/** The wire half, re-exported so a composition root reads ONE entry per plugin
 *  — and so the sibling key the surface is composed under and the key its deps
 *  are filed under are the same word by construction rather than by two lists
 *  agreeing ({@link ./wire.ts} is where it is spelled). */
export { faces, name, surface } from "./wire.ts"

/**
 * WHETHER THIS HOST IS RUNNING KOLU, on the same door and for the same graph
 * reason ({@link ./probe.ts}).
 *
 * It is not part of {@link serve}, and the two are asked at different moments by
 * different callers: the runtime half is made ONCE when the surface binds and
 * keeps a socket for the life of the process, while this is asked FRESH per
 * conversation, on the session-open path, so a padi started after olai is picked
 * up by the next session instead of the next restart. Folding the probe into
 * `serve`'s return would tie a per-session question to a per-process value and
 * would make the answer a session was opened on the answer some earlier session
 * got.
 */
export { probe } from "./probe.ts"

/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS — three strings, on this door for
 * {@link kinds}' reason ({@link ./wake.ts} argues the words themselves).
 *
 * It is DECLARATION and not behaviour, which is why it sits beside those two
 * rather than inside {@link serve}: the member that writes a scope refuses a
 * plugin declaring no wake, and it asks that question of the enabled halves
 * long before any of them has served anything.
 */
export { wake } from "./wake.ts"

/**
 * WHAT THIS HALF ASKS CORE FOR — a subset of what core offers every plugin, and
 * the subset IS the documentation.
 *
 * Core's blob (`@olai/plugins`' `PluginServices`) carries six fields and an
 * injectable; this signature names the five kolu reads and leaves `served` off,
 * because where a relative path resolves is odu's question and not this one's.
 * That is not a courtesy: a parameter is CONTRAVARIANT, so a half that asked for
 * something core does not offer would be a type error at the registry, and a
 * half that stopped needing a field says so by deleting a line here.
 *
 * `dial` arrives as `unknown` and is narrowed BELOW, once. Core cannot type a
 * plugin's own test double without learning what the plugin talks to, which is
 * the one thing the wall exists to prevent — so the narrowing is this package's,
 * at this package's edge, where `Dial` is a word that means something.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly now: () => string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
  readonly deliveries: Deliveries
}

/**
 * THE DOORBELL'S DOOR, re-declared STRUCTURALLY — `@olai/plugins`'
 * `Deliveries`, spelled here because this package must not import that one.
 *
 * The cycle is the whole reason and it is the same one {@link Services} itself
 * is written under: `@olai/plugins` imports THIS package, so a dependency back
 * would be a shape the manifests could not express. What holds the two in step
 * is the registry's `satisfies`, where a parameter's contravariance turns a
 * field this half asked for and core does not offer into a type error with this
 * plugin's name on the line.
 *
 * TWO MEMBERS, AND ONE OF THEM CANNOT READ. `deliver` puts a sentence INTO a
 * conversation and there is no verb here for getting one back out — no
 * transcript, no history, not even whether anybody read it. That is core's
 * fence rather than this plugin's restraint, and re-declaring it faithfully is
 * how this side says it accepts it: a plugin that could both ring a doorbell
 * and read the answers would be the appliance reading the human's mail.
 */
export interface Deliveries {
  /** The conversations somebody scoped to this plugin, each with the file
   *  they picked to filter by. Synchronous, because the caller is a watcher
   *  sink with no Effect around it. Empty forever on a machine nobody scoped,
   *  which is the honest state and needs no failure channel. */
  readonly scopes: () => ReadonlyArray<{
    readonly agent: string
    readonly session: string
    readonly file: string
  }>
  /** One machine-marked message into one conversation. Fire-and-forget, like
   *  {@link Services.say} and {@link Services.warn} beside it and for their
   *  reason. `coalesce` names the slot an UNDELIVERED body may be replaced
   *  in — a slot core files under the PAIR of this plugin and the word, so the
   *  word is chosen among this plugin's own messages and no neighbour's key
   *  can collide with it. See {@link ./doorbell.ts} on why a fixed key per
   *  meaning is lossless here and would not be for a plugin that
   *  accumulated. */
  readonly deliver: (
    to: { readonly agent: string; readonly session: string },
    /** Asked at the moment the words go in, never before — see {@link said}. */
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => void
}

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

/** This surface's own write face, which is what `implementSurfaces` hands back
 *  under this plugin's key. Named here because it is this package's spec that
 *  decides what is on it — core carries the value as `unknown` and could not
 *  spell `collections.fleet` if it wanted to, which is the point. */
type Ctx = SurfaceCtx<typeof surface.spec>

/**
 * THE KOLU HALF, assembled — the padi link, the fleet it keeps, the events ring,
 * the watcher's pulse and the one screen read.
 *
 * MADE EAGERLY, STARTED LAZILY, and that is unchanged by the move. Making it is
 * free and gives the collection and the procedure something to read before
 * anything has dialed, so a page that loads while the link is still coming up
 * draws an empty fleet and a hollow chip rather than crashing on a null.
 * STARTING it is the `link` cell's connector, which the framework runs when the
 * surface BINDS — the same place the git sweep is forked, for the same reason: a
 * standing fact about this machine is the runtime's to keep, not the first
 * subscriber's to pay for. That is the whole of the one-connection claim, and
 * sibling composition does not touch it: `implementSurfaces` starts a sibling's
 * connectors exactly as `implementSurface` starts a standalone surface's.
 *
 * THERE IS NO `null` ARM ANY MORE, and its absence is the composition rather
 * than a capability lost. `KoluDeps.options` still takes one — a face with no
 * business holding a socket open passed `null` and every member answered the way
 * an unreachable padi does — but a face that wants none of this now composes
 * none of this: `@olai/server`'s wiring turns the plugins OFF as a set, so this
 * function is not called at all and there is no `surface/kolu/` on the wire to
 * answer hollowly. The state a reader sees is the stronger of the two: a member
 * that is absent rather than a member that is present and empty.
 */
export const serve = (services: Services): {
  readonly deps: ImplementSurfaceDeps<typeof surface.spec>
  readonly published: (ctx: unknown) => void
  readonly revision: (revision: VaultRevision) => void
  readonly unloaded: () => void
} => {
  /** This sibling's own write face, filled the moment it is implemented. A
   *  FUNCTION reads it below rather than a captured value, because the surface
   *  does not exist while this is being built and the mirror's first row can
   *  move before it does — the arrangement the three read-back closures in
   *  `runtime.ts` were, with core no longer in the middle of it. */
  let ctx: Ctx | undefined

  /**
   * WHETHER THE WATCH HAS BEGUN — one boolean, and it is the boot beat's gate
   * rather than a state machine.
   *
   * The watcher pulses ONCE from inside its own constructor
   * ({@link ../../kolu-client/src/watch.ts}'s `rearmHeartbeat`, which the header
   * there says arms and beats in one breath), so the first beat arrives while
   * `koluHalf` is still returning — before `half`, before `heart`, before every
   * `const` below this line exists. Calling into any of them there is a
   * reference to a binding in its own temporal dead zone, which is a crash in a
   * constructor rather than a bug with a symptom.
   *
   * SWALLOWING IT IS ALSO THE SEMANTICS, which is why this is a gate and not a
   * deferral: the first WINDOW is the first full interval this process watches,
   * and a boot beat is the start of it rather than the end of one. A heartbeat
   * there would report an uptime of nothing and a fleet nobody has mirrored
   * yet — four facts about a watcher that has not watched.
   */
  let begun = false

  const half = koluHalf<Located>({
    options: {
      env: services.env,
      now: services.now,
      // THE ONE NARROWING, and the only cast in this package. Core carries a
      // plugin's test double opaquely because typing it would mean knowing what
      // this plugin dials; `Dial` is that word, and this is the edge that owns
      // it. A test that hands a fake padi through is checked against `Dial` by
      // `makeMirror` on the next line down, so a wrong value is a type error at
      // the harness rather than a silent no-op here.
      dial: services.dial as Dial | undefined,
    },
    fleet: () => ctx?.collections.fleet,
    events: () => ctx?.collections.events,
    pulse: () => ctx?.cells.pulse,
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
    // the answer — is a walk over outline records that `@olai/kolu-client`
    // must not be able to spell. Deferred through `ring` below rather than
    // written inline, because it reads `half` and `half` is what this call
    // returns.
    rang: (event) => ring(event),
    // THE HEARTBEAT'S TAP, and the doorbell's OTHER drive — the same watcher
    // beat the pill draws its recency from, spent on the floor under silence
    // ({@link ./doorbell.ts}'s `makeHeartbeat`). One beat, two readers, no
    // second timer and no second knob: the cadence a person set for the pill
    // is the window a conversation's quiet is measured in, by construction.
    beating: (everyMs) => {
      if (begun) beats(everyMs)
    },
    // Chatter, at debug: on a machine with no kolu this is a line every few
    // seconds and it is not news. What IS news — a connect, a skew, a link that
    // dropped — is the same channel, because the alternative is this module
    // deciding which of padi's sentences matter.
    say: services.say,
    // What the OWNER must read: a malformed `_olai/Kolu.olai` value — the
    // sentences whose promise lives in this package's `docs.md`. Rare by latch
    // (one line per new shape), and the default console level is `info`, so the
    // channel is `warning`, not `debug`.
    warn: services.warn,
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
   *  terminal for a minute inside the boot, which is not a thing that
   *  happens — but the honest answer costs one comparison. */
  let derived: Derived | undefined

    /**
   * THE WORDS, DERIVED AFRESH AT THE MOMENT THEY ENTER A CONVERSATION.
   *
   * ## Why this is not the ring's own answer
   *
   * `ring` composes a body once, to learn whether there is anything to say at
   * all. That body is NOT what goes in: core holds a delivery through a running
   * turn, or until somebody opens the conversation, and the fleet moves while it
   * waits. The human found one arriving about two terminals that had been killed
   * and a lane that had been merged and closed in the gap — a message asserting a
   * world that had closed while it queued.
   *
   * So core is handed a CLOSURE (`@olai/plugins`' `Deliveries.deliver`) and calls
   * it last thing. This reads `derived` and `half.rows()` at CALL time — the
   * store's current revision and the live fleet, never the values the ring tick
   * closed over. It is {@link ./doorbell.ts}'s no-standing-set rule spent on the
   * delivery moment rather than the derivation one, and for the same reason: an
   * answer kept from before is a second copy of a truth that has already changed.
   *
   * A SET THAT HAS ENTIRELY SETTLED ANSWERS `null`, and core drops the message
   * rather than shortening it. Rows that settled individually simply are not in
   * the sentence — `claimedIn` skips a node that is done and `standingIn` skips a
   * terminal the fleet no longer holds, so the drop needs no arm of its own.
   *
   * THE MEANING IS NOT RE-DECIDED. What the event said happened, happened; what
   * is asked again is who it is still true of.
   */
  const said = (file: string, meaning: Meaning): string | null => {
    const at = derived
    if (at === undefined) return null
    const rows = half.rows()
    const claiming = claimingIn(claimedIn(declaring, at, file), [...rows.keys()])
    const standing = standingIn(claiming, rows, meaning)
    return standing.length === 0 ? null : bodyFor(meaning, standing, file, services.now())
  }

/**
   * ONE WATCHER EVENT, RUNG THROUGH — the doorbell's whole drive loop.
   *
   * PER FILE, and delivered PER CONVERSATION, which are not the same count:
   * two seats may filter by two boards and mean two different things by one
   * terminal moving, so the derivation cannot be hoisted out of the loop —
   * but two seats on the SAME board with the SAME meaning are one answer all
   * the way to the sentence, so both the claims walk and the body are memoised
   * for the life of this call and dropped with it. The rows and their id list
   * are one reading of one map however many scopes there are.
   *
   * THE VALUES ARE RESOLVED AGAINST THE LIVE ROSTER (`half.rows()`) and never
   * against the event, which carries padi's whole id: the board writes
   * eight-character prefixes, and a join by string equality would answer
   * `unowned` for almost every row a real vault claims ({@link ./doorbell.ts}
   * argues it where the resolution happens).
   *
   * ONE COALESCE KEY PER MEANING, fixed. Core replaces an undelivered body
   * with the next one under the same key, so a burst while a turn runs
   * arrives as ONE message — and that is lossless only because the body is a
   * fresh derivation of standing state rather than an accumulation, which is
   * the claim `bodyFor` is written to keep. BOTH meanings are keyed, which is
   * the whole of the arm this plugin uses: a wake is a derivation exactly as a
   * digest is, so the newest one already says everything its predecessor said
   * and there is nothing for the un-keyed arm to protect.
   *
   * THE NAME IN THE KEY IS THIS PLUGIN TALKING TO ITSELF, and not a guard
   * against a neighbour. Core files a held slot under the PAIR of the plugin
   * and the key (`@olai/plugins`' `Deliveries.deliver` says so, and
   * `@olai/chat`'s `holding` is where the pair is minted), so `"wake"` on its
   * own could not be swallowed by another plugin saying `"wake"` — the prefix
   * buys legibility in a dump and nothing else. IT USED TO SAY the opposite,
   * that core keyed by conversation alone and the name was what kept two
   * plugins apart; a reader who believed it would have carried the name into a
   * key where it mattered rather than where it merely reads well.
   *
   * AND IT CANNOT THROW INTO A TIMER. This runs from `emitHold`, which is a
   * `setTimeout` callback in the watcher — an exception escaping here would
   * take the process down with no evidence and stop every other hold's timer
   * on the way. So the whole walk is caught once, at this package's edge, and
   * said on the owner's channel: a doorbell that failed is worth a line, and
   * it is worth exactly one.
   */
  const ring = (event: KoluEvent): void => {
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
    if (at === undefined) return
    try {
      const rows = half.rows()
      const fleet = [...rows.keys()]
      // ONE STAMP FOR THE WHOLE EVENT, so two conversations woken by one
      // terminal are not told two different times about it.
      const now = services.now()
      // ...AND ONE WALK PER FILE. The derivation is per FILE and the scope is
      // per CONVERSATION, which are not the same cardinality: a person with
      // three seats on one board would otherwise pay three identical walks
      // per event. Minted per event and dropped with it — this plugin holds
      // nothing between ticks, which is the property the whole coalescing
      // argument rests on.
      const perFile = new Map<string, ReturnType<typeof claimingIn>>()
      const claimingFor = (file: string) => {
        const held = perFile.get(file)
        if (held !== undefined) return held
        const fresh = claimingIn(claimedIn(declaring, at, file), fleet)
        perFile.set(file, fresh)
        return fresh
      }
      // ...AND ONE SENTENCE PER (FILE, MEANING), which is the same argument
      // carried to its end. The walk above is not the only thing two seats on
      // one board share: the standing they derive is a function of the file's
      // claims and the meaning alone, and so is the multi-paragraph body built
      // from it. Keying the memo on the file ALONE closed half the redundancy
      // and left the expensive half open — the string. The pair is the whole
      // key because a `wake` and a `digest` over one file are two different
      // subsets and two different sentences, and nothing else about a scope
      // enters either: the conversation is only ever the ADDRESS the body is
      // sent to.
      //
      // `null` is a MEMOISED SILENCE rather than a miss — a file that has
      // nobody standing for this meaning must not be walked again per seat —
      // and it is why this map is read with `has` rather than by testing the
      // value.
      //
      // Minted per event and dropped with it, exactly as `perFile` is. Neither
      // survives the tick, so nothing here can serve a sentence about a fleet
      // that has moved on, and the plugin still holds nothing between ticks.
      const perSaid = new Map<string, string | null>()
      const bodyIn = (
        file: string,
        meaning: Meaning,
        claiming: ReturnType<typeof claimingIn>,
      ): string | null => {
        const key = `${meaning}:${file}`
        if (perSaid.has(key)) return perSaid.get(key) ?? null
        const standing = standingIn(claiming, rows, meaning)
        // The event's own terminal is held by construction, so this is empty
        // only where the row moved between the emit and this walk. A sentence
        // about nobody is worse than no sentence.
        const fresh = standing.length === 0 ? null : bodyFor(meaning, standing, file, now)
        perSaid.set(key, fresh)
        return fresh
      }
      for (const scope of services.deliveries.scopes()) {
        const claiming = claimingFor(scope.file)
        const meaning = classify(event, claiming)
        // SILENCE IS NO CALL AT ALL. Not a quieter body, not a warning about
        // an unclaimed terminal — the dispatch dropped that arm on purpose.
        if (meaning === null) continue
        // Asked ONCE here, against the revision the event arrived on, so a
        // ring that has nothing to say costs no slot in core and no row.
        if (bodyIn(scope.file, meaning, claiming) === null) continue
        services.deliveries.deliver(
          { agent: scope.agent, session: scope.session },
          // ... AND ASKED AGAIN AT THE MOMENT IT GOES IN, which is what this
          // closure is for. A body can wait through a running turn or until
          // somebody opens the conversation, and the fleet moves while it
          // waits: the human found a delivery arriving about two terminals
          // that had been killed and a lane merged and closed in the gap.
          //
          // It reads `derived` and `half.rows()` AT CALL TIME, never the
          // values this tick closed over — the same no-standing-set rule
          // {@link ./doorbell.ts}'s header states, spent on the delivery
          // moment rather than the derivation one. The per-event memo above is
          // deliberately not consulted here: it is this tick's answer, and
          // this closure's whole job is to not give this tick's answer.
          //
          // The MEANING is the event's and is not re-decided — what the event
          // said happened, happened. What is re-derived is who it is still
          // true of, and a set that has entirely settled answers `null`, which
          // drops the message rather than shortening it.
          () => {
            const body = said(scope.file, meaning)
            // AND THE WINDOW RESETS HERE, where the words actually go in
            // rather than where the delivery was handed over. A body core
            // coalesced away, or one that derived to `null` because the fleet
            // settled while it waited, never reached anybody — and a window it
            // silenced would be a heartbeat lost to a message nobody got
            // ({@link ./doorbell.ts}'s `makeHeartbeat` argues the ledger).
            if (body !== null) heart.delivered(scope)
            return body
          },
          { coalesce: `${name}:${meaning}` },
        )
      }
    } catch (thrown) {
      services.warn(
        `kolu: the doorbell could not ring for this fleet event — ${String(thrown)}`,
      )
    }
  }

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
   * what is composed here is the four seams it needs — core's scope list, core's
   * delivery door, the derivation above, and this half's clock. The key is
   * minted under this plugin's own name for {@link ring}'s stated reason: core
   * files a held slot under the PAIR of the plugin and the word, so the prefix
   * buys legibility in a dump and nothing else.
   */
  const heart: Heartbeat = makeHeartbeat({
    scopes: () => services.deliveries.scopes(),
    deliver: (to, say, options) => services.deliveries.deliver(to, say, options),
    terminals,
    now: services.now,
    coalesce: `${name}:heartbeat`,
  })

  /**
   * ONE BEAT, RUNG THROUGH — and it cannot throw into a timer either.
   *
   * {@link ring}'s last paragraph, applied to the other clock: this runs from
   * `pulse`, which is a `setInterval` callback inside the watcher, so an
   * exception escaping here would take the process down with no evidence and
   * stop every hold's timer on the way out. A heartbeat that failed is worth a
   * line on the owner's channel, and worth exactly one.
   */
  const beats = (everyMs: number): void => {
    try {
      heart.beat(everyMs)
    } catch (thrown) {
      services.warn(
        `kolu: the doorbell could not beat for this watch window — ${String(thrown)}`,
      )
    }
  }

  // THE GATE OPENS LAST, once every binding the beat reaches through exists —
  // see `begun` above for why the watcher's own boot pulse must find it shut.
  begun = true

  return {
    /**
     * THE FIVE MEMBER HANDLERS, straight through — and the annotation on this
     * function's return type is where the agreement between this plugin and the
     * framework is actually proved. `ImplementSurfaceDeps<typeof surface.spec>`
     * is written against THIS package's own surface, so a member the appliance
     * renamed, dropped or re-shaped is a type error in this file with this
     * plugin's name on it. Core carries the value as `unknown` and never opens
     * it, which is why the check has to be here.
     */
    deps: half.handlers,
    /** This sibling's ctx, the moment `implementSurfaces` has minted it. The
     *  cast is this package narrowing an opaque value to its OWN surface's write
     *  face — the mirror image of the `dial` narrowing above, and safe for the
     *  same reason: core addresses it by the only word it knows about this
     *  plugin, which is the key it composed the surface under. */
    published: (bound) => {
      ctx = bound as Ctx
    },
    /**
     * A VAULT REVISION LANDED — re-derive who claims which terminal, and what
     * the watcher's knobs now say.
     *
     * It walks every node and publishes almost nothing: the mirror compares each
     * row's owner before it upserts, so a keystroke that landed in a note costs
     * one walk and zero frames. What it costs on the revision a `terminal`
     * property is actually written is one frame for that terminal's row.
     *
     * The FILE is asked of the SERVED outlines rather than of the records
     * (`served`, not `recorded`): a file the codec tore apart still names itself,
     * and the foot's wrench over it must not fall away WITH the nodes.
     */
    revision: (revision) => {
      file = conventionServed(koluFileIn, revision.value.set, revision, file)
      declaring = declarationsOf(revision.value.derived, ownKinds)
      // ...AND THE READING ITSELF, held for the doorbell. It is the same
      // pointer the two walks above are about, kept because the doorbell's
      // walk runs on the WATCHER's clock rather than on this hook — a fleet
      // event arrives between revisions, and the vault it is joined against
      // has to be the last one that landed.
      derived = revision.value.derived
      half.revision(revision.value.derived.nodes, file.file ?? null)
    },
    /**
     * The store has NEVER published — the vault's kolu verdict goes out with
     * the canvas: yesterday's wrench, aimed at a file this serve can no longer
     * say it read, is a claim the store cannot vouch for. The watch knobs are
     * NOT touched — their timers hold their last hand-off while the mirror,
     * equally starved, has nothing new for them to gate.
     *
     * ## The two `let`s go with it, and the DOORBELL is why
     *
     * {@link ring} runs on the WATCHER's clock rather than on a revision, so
     * `derived` and `file` are exactly the pair a fleet event arriving after a
     * disown would be joined against. Leaving them set means the doorbell
     * keeps walking a vault the store has explicitly stopped vouching for and
     * ringing somebody about claims read out of it — the same stale wrench the
     * paragraph above refuses, arriving by the one door that does not go
     * through the mirror. `undefined` is the doorbell's own first gate
     * ({@link ring} returns on it), so clearing it is how the walk is told.
     *
     * IT USED TO CLEAR NEITHER, and only called through to the half. The
     * comment claimed the verdict went out with the canvas and the code did
     * not: a serve whose store stopped publishing pinned the last whole
     * `Derived` — nodes, `byId`, `byFile`, `children`, `status` — for the life
     * of the process, with the disowned-vault doorbell walk as the only thing
     * that would ever read it again.
     */
    unloaded: () => {
      derived = undefined
      file = undefined
      half.unloaded()
    },
  }
}
