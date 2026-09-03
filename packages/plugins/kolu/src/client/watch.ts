/**
 * THE WATCHER — olai's end of padi's standing `watchStates` subscription.
 *
 * ## What it reads, and why the mirror reading was given up
 *
 * This module USED to compute the attention events itself: every fleet row
 * the mirror moved was observed here, holds were debounced by one timer
 * apiece, the nag was a second timer, and the heartbeat a third. That was
 * the deliberate #421 choice — *a reading of the mirror, not a subscription
 * to padi's watch member*: the mirror's rows are the mirror's problem, and
 * the day padi's watch member changed shape this module would not move.
 *
 * What the mirror can never give it back is the daemon's own memory of an
 * episode. The nag is FINITE now (`nag: 30m/3` in `_olai/Kolu.olai` — three
 * reminders past the first report, then quiet about that terminal), and
 * which reminder a terminal is on is an answer only the daemon holds: it
 * survives an olai restart, it survives a reconnect, and only a state
 * CHANGE re-arms it. Re-deriving all of that client-side would be a second
 * copy of the one engine, counting from a second clock — and the whole
 * discipline of the member is exactly that no face does that. So the
 * reading was given up for the subscription: the daemon does the holding,
 * the nagging and the counting; this module chooses nothing but the knobs,
 * and it holds NO TIMER of its own.
 *
 * What is consequently ours to keep honest:
 *
 *   - THE RING. Batches translate into `KoluEvent`s, newest kept, capped —
 *     the collection's `readAll` reads this map exactly as it did when the
 *     timers pushed here, so none of the wire moves for its own sake.
 *   - THE FROZEN ROW. A `PadiStateEvent` is thin by contract (the recipient
 *     reads the screen itself) — olai joins the live fleet row at FIRE time
 *     the way `emitHold` always did, frozen with its live flags stamped
 *     out. Rows are remembered as they were last observed and never
 *     evicted: an event about a terminal that has since shut still wants
 *     its draw facts. (A lanes-day's churn is hundreds of rows at two
 *     kilobytes each; eviction would buy nothing.)
 *   - THE BEAT STAMP. There is no interval to pace one on any more, so it
 *     is stamped when the SUBSCRIPTION says something — every batch,
 *     including the arriving frame that found nothing matching, which is
 *     the member's own answer to "is it live". The pulse cell changes
 *     neither shape nor cadence knob: the pill still reads
 *     `age > everyMs * 2` against the vault's `heartbeat` window, which is
 *     why the knob survives with its word. The knob paces nothing remotely
 *     — a healthy watch on a capped, parked fleet WILL read amber two
 *     windows after the last reminder; that is the register's face under
 *     finite nagging, and docs.md says so.
 *
 * ## One knob edit is one re-specification, and padi starts the count fresh
 *
 * `reconfigure` derives the subscription input from the config and re-runs
 * `watchAgentStates` when a knob that reaches the wire MOVED — `held-for`,
 * `nag`'s interval or its count. Resubscribing with a different question
 * is padi's own fresh-episode door: the arriving frame re-reports the
 * standing set as a snapshot, and the cap counts from zero. That is the
 * idempotence the e2e owes its gesture to (`held-for: 0s` answers an
 * already-standing hold at once, with no timer waited out), and it answers
 * why a `held-for` keystroke reload now arrives as a `transition` the
 * doorbell says again where the timers used to re-arm silently.
 *
 * The transparent retry inside `watchAgentStates` (`mirrorRemoteSurface`'s
 * fence, re-snapshot on reconnect) is everything this module needs for a
 * link flap: the re-lead is a fresh snapshot, and the daemon's `since`
 * survives a CLIENT reconnect — so the ring re-ingrafts the standing set
 * and no clock re-dates. `attach(null)`, pushed on the dial's own edges,
 * is the whole of the flap's door: a live subscription for a dead padi
 * cannot sit around.
 *
 * ## What is deliberately not done here
 *
 * THE KNOB READING. `_olai/Kolu.olai` is outline records, and this package
 * has no business knowing what one is: the server walks the vault
 * (`../../config.ts`, beside `claimants.ts`) and hands over the derived
 * config — malformed values already defaulted and named.
 *
 * A FILTER OF ANY KIND. `states`, `ignoreIds` and `id` are padi's knobs
 * and olai names none of them: the fleet is watched whole under the
 * member's own default states — the advertised default, which is the only
 * states answer a face may keep. The doorbell's filter FILE silences
 * conversations, not the watch.
 *
 * RETRY POLICY of its own for a run that fails its fence and settles: said
 * once on the log channel, and the pill goes amber on schedule. That is a
 * gap the mirror answers for its own members by ending the whole dial;
 * wiring the same kill for the watch's run runs through two more sink
 * verbs and is named in the PR's deferrals instead.
 */

import { watchAgentStates } from "@kolu/padi-client/watch"
import type { PadiSurfaceClient } from "@kolu/padi-client/dial"
import type { PadiStateEvent, PadiWatchStatesInput } from "@kolu/padi-client/surface"
import { narrowAgentState } from "@kolu/solid-dockrow/rowValues"
import { agentBucket, WATCH_DEFAULT_STATES } from "@kolu/terminal-vocab/agentProjection"

import type { FleetTerminal, KoluEvent } from "./wire/index.ts"

// ── The config, as the vault walk hands it over ──────────────────────────

/**
 * The nag interval AND its optional reminder cap, as ONE value — exactly
 * the shape kolu's own `parseNag` answers (`nag: 30m/3`): the count rides
 * the interval's own spelling, so the two can never be spelled apart and
 * can never drift. The wire carries them as the separate `nagMs` /
 * `nagCount` fields; this file is the only place they meet.
 */
export interface WatchNag {
  readonly ms: number
  readonly count?: number
}

/**
 * The watcher's knob set, DERIVED ELSEWHERE — see the header for why this
 * shape never names a vault node.
 */
export interface WatchConfig {
  readonly heldForMs: number
  readonly nagMs: WatchNag
  readonly heartbeatMs: number
}

/** The knobs when `_olai/Kolu.olai` is absent, torn or quiet — the brief's
 *  own numbers, one constant, not three defaults remembered in two places.
 *  A bare interval: the nag repeats forever until a vault spells the cap. */
export const DEFAULT_WATCH: WatchConfig = {
  heldForMs: 60_000,
  nagMs: { ms: 600_000 },
  heartbeatMs: 1_800_000,
}

/** The ring's cap — the brief's `~200`. */
export const WATCH_RING = 200

/** What the watcher hands over. The three verbs are exactly what the
 *  timered watcher had — the ring's two, and the beat: same breaths, a new
 *  driver for the third (see the header). Attentive value (`at` + the
 *  cadence it was stamped under) rides beside the beat, which is the
 *  pill's whole read. */
export interface WatchSink {
  readonly emit: (event: KoluEvent) => void
  /** Fired ONLY on a ring eviction: events are never edited, only dropped. */
  readonly evict: (id: string) => void
  /** The subscription answered. Stamped once per BATCH — the frame's own
   *  instant and the vault's heartbeat window beside it. */
  readonly beat: (at: string, everyMs: number) => void
}

export interface Watch {
  /** The live padi face — the dial hands it over on every connect and
   *  takes it back (`null`) on every drop. The subscription runs only
   *  while one is alive. */
  readonly attach: (client: PadiSurfaceClient | null) => void
  /** A fleet row MOVED — remembered for the frozen rows the events join.
   *  An id never leaves the map: a fired event about a long-gone terminal
   *  still draws the row as the event saw it. */
  readonly observe: (id: string, row: FleetTerminal) => void
  /** The config the vault NOW says, freshly derived on every revision. */
  readonly reconfigure: (config: WatchConfig) => void
  /** The ring, oldest first — the collection's `readAll` reads it
   *  verbatim, which is the same typed-mutable life the fleet's rows lead. */
  readonly events: () => Map<string, KoluEvent>
  /** Aborts the standing subscription. Called when the runtime that owns
   *  this watcher closes. */
  readonly stop: () => void
}

/** The subscription's own knob set — what actually crosses the wire. Two
 *  stays home: `states` (the member's default is the one advertised set)
 *  and the scope (`ignoreIds`/`id`) — olai watches the whole fleet. */
const inputOf = (config: WatchConfig): PadiWatchStatesInput => ({
  heldForMs: config.heldForMs,
  nagMs: config.nagMs.ms,
  ...(config.nagMs.count === undefined ? {} : { nagCount: config.nagMs.count }),
})

/** Do two configs ask padi the same question? The heartbeat window is NOT
 *  on the wire — it paces the stamped beat's readout and nothing padi-side,
 *  so moving it re-runs nothing here. */
const sameQuestion = (a: WatchConfig, b: WatchConfig): boolean =>
  a.heldForMs === b.heldForMs && a.nagMs.ms === b.nagMs.ms && a.nagMs.count === b.nagMs.count

/** The buckets a hold may be about: `WATCH_DEFAULT_STATES`, THE set the
 *  fold's home pins for every face (its own doc: read this one constant,
 *  or advertise a default nothing applies). The one exclusion in it —
 *  `working` — is the flood every watch feature was written to replace.
 *  Held as a Set so `heldStateOf`'s membership ask is one hash, not a
 *  scan. */
const HELD_BUCKETS: ReadonlySet<string> = new Set(WATCH_DEFAULT_STATES)

/**
 * What the DOORBELL's standing read needs, folded the exact way the wire's
 * `rows` answer it — EXPORTED FOR THE ONE READER THAT MUST NOT RE-DERIVE IT.
 *
 * A SECOND SPELLING WOULD BE A SECOND ANSWER. The doorbell in
 * `olai-plugin-kolu` composes a sentence naming every claimed terminal that
 * is HELD RIGHT NOW and reads that off the live fleet rows
 * (`KoluHalf.rows()`) rather than off any memory of its own — and the folds
 * it shares with the watcher's gate are kolu's, reached through
 * `narrowAgentState` and `agentBucket`, which the judgement package does
 * not depend on: which words a padi build spells is exactly the knowledge
 * the package wall keeps on this side. So the fold crosses as a FUNCTION,
 * the way {@link ../fleet.ts}'s `Claimant` crosses as four strings — one
 * answer to "is this row held", read by the drawer and read by the
 * doorbell, so a body's facts and a padi event's facts cannot come apart.
 */
export const heldStateOf = (row: FleetTerminal): HeldState | null => {
  const narrowed = narrowAgentState(row.agentState)
  if (narrowed.state === undefined) return null
  const bucket = agentBucket(narrowed.state)
  return HELD_BUCKETS.has(bucket) ? { bucket, spelled: narrowed.state } : null
}

/** One held reading — what {@link heldStateOf} answers when it is not
 *  `null`. */
export interface HeldState {
  /** The bucket the hold is about — one of `HELD_BUCKETS`. */
  readonly bucket: string
  /** The verbatim agent word the row spelled, narrowed rather than
   *  retyped. */
  readonly spelled: string
}

/** One run of the standing subscription, and the token late batches from a
 *  re-specified predecessor die on: an `AbortController` stops the fence's
 *  loop, and a competitor's frame that arrived before the abort is dropped
 *  here rather than ingrafted over the new question's snapshot. */
interface Run {
  readonly input: WatchConfig
  readonly controller: AbortController
}

export const makeWatch = (
  sink: WatchSink,
  options: { readonly now: () => number; readonly say?: (line: string) => void },
): Watch => {
  /** The knob set in force. Defaults until the vault's walk reconfigures —
   *  which is also what an absent `_olai/Kolu.olai` reconfigures TO. */
  let config: WatchConfig = DEFAULT_WATCH
  /** The live padi face, or `null` while the dial is down. */
  let client: PadiSurfaceClient | null = null
  /** The standing subscription, while one is running. */
  let run: Run | null = null
  /** The fleet rows as last observed — the join the frozen event reads off.
   *  Never evicted, for the header's stated reason. */
  const rows = new Map<string, FleetTerminal>()
  /** The ring. Insertion-ordered Map, capped at `WATCH_RING`. */
  const ring = new Map<string, KoluEvent>()
  /** One counter for the whole watcher, so the ring's keys read in fire
   *  order and are unique per shot. */
  let seq = 0

  /** One event onto the ring, evicting the oldest while the cap is full. */
  const push = (event: KoluEvent): void => {
    ring.set(event.id, event)
    sink.emit(event)
    while (ring.size > WATCH_RING) {
      const oldest = ring.keys().next().value
      if (oldest === undefined) break
      ring.delete(oldest)
      sink.evict(oldest)
    }
  }

  /**
   * THE TRANSLATE, one `PadiStateEvent` to one `KoluEvent` — and it is a
   * RELAY, not a computation: padi already decided the kind, the state, the
   * `since` (its own observation clock, which survives OUR client
   * reconnect — a padi restart is the only thing that re-dates it) and the
   * reminder accounting. What olai adds is the frozen row at fire time, the
   * live flags of it stamped out — a log row must not flash motion for a
   * moment that passed.
   *
   * `snapshot` folds onto the wire's `transition` arm: both are a first
   * report of an episode, told apart on padi's side by whether the watch
   * was there for the edge, and olai's wire has no reader for the
   * difference — ring, drawer and doorbell treat a re-lead of standing
   * neglect and a watched edge as one thing to say.
   */
  const translate = (ev: PadiStateEvent): KoluEvent => {
    const row = rows.get(ev.id)
    seq += 1
    return {
      id: `ev-${seq}`,
      kind: ev.kind === "nag" ? "nag" : "transition",
      at: new Date(ev.at).toISOString(),
      row: {
        terminal: ev.id,
        state: ev.state,
        // The agent's VERBATIM word if the mirror has one (a padi event
        // implies an agent, but the mirror row may lag or spell no word);
        // otherwise the bucket the event itself claims (`awaiting_user`
        // where known, else the event's own `state`). Never null — the
        // feed's subline wording reads it.
        agentState: row === undefined ? ev.state : (narrowAgentState(row.agentState).state ?? ev.state),
        pip: row === undefined
          // NO ROW SEEN YET — the subscription's arriving frame named a
          // terminal the mirror has not published in this margin. The draw
          // is the narrowing's quiet face: the pip is the narrowing-fall
          // bag with the same live edits the frozen rows keep.
          ? {
            variant: "idle",
            glyph: "terminal",
            active: false,
            asking: ev.state === "awaiting",
            bytesLive: false,
            hasAgent: true,
            sleeping: false,
            alert: false,
            alertLabel: "",
          }
          : { ...row.pip, active: false, bytesLive: false },
        bucket: row?.bucket ?? ev.state,
        label: row?.label ?? ev.intent ?? "",
        labelColor: row?.labelColor ?? "",
        repo: row?.repo ?? null,
        since: new Date(ev.since).toISOString(),
      },
      ...(ev.nag === undefined ? {} : { nag: ev.nag }),
    }
  }

  /** One BATCH through the ring, then the beat the batch earns. The beat is
   *  stamped LAST so a conversation rung by this frame is already said
   *  before its floor is asked about — the events-first ordering the ledger
   *  reads. */
  const onBatch = (token: Run, batch: readonly PadiStateEvent[]): void => {
    if (run !== token) return
    for (const ev of batch) push(translate(ev))
    sink.beat(new Date(batch[0]?.at ?? options.now()).toISOString(), config.heartbeatMs)
  }

  /** Start (or re-run) the standing subscription against the live face,
   *  under the question the config NOW asks. Old runs of a competitor die
   *  by abort: the helper ends with a cancelled fence rather than a
   *  failure, and the token guards any batch already in flight. */
  const kick = (): void => {
    if (run !== null) run.controller.abort()
    run = null
    if (client === null) return
    const next: Run = { input: config, controller: new AbortController() }
    run = next
    watchAgentStates(
      client,
      inputOf(config),
      (batch) => onBatch(next, batch),
      next.controller.signal,
      (line) => options.say?.(line),
    ).then(
      () => {},
      // THE FENCE'S OWN LAST RESORT. `mirrorRemoteSurface` retries a dead
      // subscription and re-leads with a snapshot, so a promise that settles
      // in our hands has run out of options of its own — one log line, and
      // the pill's amber says the rest: no interval of ours ever re-fires.
      (err) => options.say?.(`kolu watch: the subscription ended (${String(err)})`),
    )
  }

  return {
    attach: (face) => {
      client = face
      kick()
    },
    observe: (id, row) => {
      rows.set(id, row)
    },
    reconfigure: (next) => {
      const moved = !sameQuestion(next, config)
      config = next
      // Only a knob padi ANSWERS TO warrants a run: editing `heartbeat`
      // costs the stamped window and nothing else — the subscription
      // stays, and the next batch stamps the new cadence.
      if (moved) kick()
    },
    events: () => ring,
    stop: () => {
      run?.controller.abort()
      run = null
    },
  }
}
