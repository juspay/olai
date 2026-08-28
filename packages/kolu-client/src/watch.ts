/**
 * THE WATCHER — olai's own computation of the attention events the
 * orchestrator today gets from a hand-armed `kolu watch`.
 *
 * ## What it reads, and why that is the whole economy
 *
 * It reads the MIRROR — the rows `./mirror.ts` already publishes to the
 * `fleet` collection — and nothing else. No second subscription and no
 * second dial: `koluHalf`'s sink hands every row the mirror moves to this
 * beside the collection, so the events are computed over exactly what ten
 * tabs on a lanes page already see, in the same breath.
 *
 * That is a deliberate difference from padi's own `watchStates` member,
 * which computes the same events DAEMON-side from its own records. What
 * olai computes here is deliberately a READING of the mirror rather than a
 * subscription to that member: the mirror's rows are the mirror's problem,
 * and the day padi's watch member changes shape this module does not move.
 * What is lost is the daemon's `since` clock — the daemon has watched the
 * state since IT saw it enter, and olai restarting re-dates every standing
 * hold. `KoluEvent.row.since` says so on its own doc.
 *
 * ## The semantics, in one breath
 *
 * For every un-muted terminal whose row enters a held bucket — `awaiting`
 * or `waiting`, the two that need a person
 * (`@kolu/terminal-vocab`'s WATCH_DEFAULT_STATES, spelled out so that the
 * fold's home need not be imported for one set) — start a hold clocked from
 * the first observation of it. Held past `heldForMs`: emit a `transition`.
 * Still held another `nagMs`: emit a `nag`, and keep re-emitting until the
 * row says otherwise. A terminal that leaves the bucket inside the window
 * is never said at all — that is the debounce padi's `heldForMs` documents
 * and the soak runs beside.
 *
 * A `heartbeat` fires every `heartbeatMs` (immediately once, at boot), so a
 * quiet feed and a dead watcher do not look alike.
 *
 * ## What is deliberately not computed here
 *
 * The KNOB reading. `_olai/Kolu.olai` is outline records, and this package
 * has no business knowing what one is (`./index.ts`'s header): the server
 * walks the vault (`@olai/server`'s `koluConfig.ts`, beside `claimants.ts`)
 * and hands over the derived config — malformed values already defaulted
 * and named. This module takes intervals and mute values, compares them,
 * reconfigures, and owns the timers.
 *
 * PERSISTENCE. The ring is a standing thing per server — `WATCH_RING`
 * events, newest kept, snapshot-then-deltas on the wire. A server restart
 * re-sees the fleet cold: no memory of last night's holds, and a terminal
 * still `waiting` at dawn fires as a fresh hold under the same rules as a
 * fresh transition.
 *
 * ## The timers, and how they die
 *
 * Every timer a terminal owns lives on its hold; every release path —
 * bucket left, muted, row removed, watcher stopped — runs through
 * `releaseHold`, so a nag cannot fire into a state that already ended. The
 * one timer that is not a hold's is the heartbeat's interval, and
 * `stop` clears it.
 */

import { narrowAgentState } from "@kolu/solid-dockrow/rowValues"
import { agentBucket } from "@kolu/terminal-vocab/agentProjection"

import { type FleetTerminal, type KoluEvent, resolveTerminal } from "./wire/index.ts"

// ── The config, as the vault walk hands it over ──────────────────────────

/**
 * The watcher's knob set, DERIVED ELSEWHERE — see the header for why this
 * shape never names a vault node.
 */
export interface WatchConfig {
  readonly heldForMs: number
  readonly nagMs: number
  readonly heartbeatMs: number
  /** Mute values, VERBATIM from the `mutes` node's children — full ids or
   *  the prefix spelling the board actually writes. Resolution is this
   *  module's to do per observation, against the fleet's CURRENT id set,
   *  because the roster only exists here. */
  readonly muted: ReadonlyArray<string>
}

/** The knobs when `_olai/Kolu.olai` is absent, torn or quiet — the brief's
 *  own numbers, one constant, not three defaults remembered in two places. */
export const DEFAULT_WATCH: WatchConfig = {
  heldForMs: 60_000,
  nagMs: 600_000,
  heartbeatMs: 1_800_000,
  muted: [],
}

/** The ring's cap — the brief's `~200`. */
export const WATCH_RING = 200

/** The buckets a hold may be about — kolu's own `WATCH_DEFAULT_STATES`,
 *  written out rather than imported: the day the default changes on kolu's
 *  side, this set is a decision the brief owns, not a re-pin. The one
 *  exclusion is `working`, which is the flood every watch feature was
 *  written to replace. */
const HELD_BUCKETS: ReadonlySet<string> = new Set(["awaiting", "waiting"])

/** What the watcher emits. `emit`/`evict` are the events collection's two
 *  verbs — a fresh row, and the row the ring dropped — so `./index.ts`
 *  closes over this and nothing else. */
export interface WatchSink {
  readonly emit: (event: KoluEvent) => void
  /** Fired ONLY on a ring eviction: events are never edited, only dropped. */
  readonly evict: (id: string) => void
  readonly say: (line: string) => void
}

export interface Watch {
  /** A fleet row MOVED — start, refresh or kill a hold, according to its
   *  bucket. */
  readonly observe: (id: string, row: FleetTerminal) => void
  /** A row left the fleet — the terminal shut, or the link dropped and
   *  every row went. Its hold goes with it, silently: a terminal that left
   *  is not waiting for anything. */
  readonly remove: (id: string) => void
  /** The config the vault NOW says, freshly derived on every revision. */
  readonly reconfigure: (config: WatchConfig) => void
  /** The ring, oldest first — the collection's `readAll` reads it
   *  verbatim, which is the same typed-mutable life the fleet's rows lead. */
  readonly events: () => Map<string, KoluEvent>
  /** Stops every timer. Called when the runtime that owns this watcher
   *  closes. */
  readonly stop: () => void
}

/**
 * One terminal's in-flight hold.
 *
 * `row` is the LAST observed row, refreshed on every observe: the event
 * freezes facts at FIRE time, so an intent the terminal was handed after
 * the state began is on the event that names it.
 *
 * `holdTimer` and `nagTimer` are disjoint by construction — the debounce
 * arms until the transition fires, the nag from then on — and `fired` is
 * the line between them. Keeping the two arms separate is what lets a
 * config edit re-pace the nag without re-debouncing a state already said.
 */
interface Hold {
  readonly id: string
  /** The held bucket — `awaiting` | `waiting`. */
  readonly state: string
  /** The verbatim agent state the row spelled when the hold began. */
  agentState: string
  /** Epoch ms of the FIRST observation in this hold. */
  readonly since: number
  /** The draw facts, refreshed per observation, frozen into the event at
   *  fire time. */
  row: FleetTerminal
  /** Whether the `transition` has been said. */
  fired: boolean
  holdTimer: ReturnType<typeof setTimeout> | undefined
  nagTimer: ReturnType<typeof setTimeout> | undefined
}

/**
 * The bucket a row's agent state folds to, or `null` when there is none to
 * hold: no agent, or a state this build's vocabulary does not know (a
 * newer padi — `narrowAgentState` keeps the word verbatim and marks it
 * unknown, and an unknown here is the same `other` padi's own engine's
 * default arm would arrive at).
 *
 * The ONE fold in this file, and there is exactly one of it.
 */
const bucketOf = (row: FleetTerminal): string | null => {
  const narrowed = narrowAgentState(row.agentState)
  if (narrowed.state === undefined) return null
  const bucket = agentBucket(narrowed.state)
  return bucket === "other" ? null : bucket
}

export const makeWatch = (
  sink: WatchSink,
  options: { readonly now: () => number },
): Watch => {
  /** The knob set in force. Defaults until the vault's walk reconfigures —
   *  which is also what an absent `_olai/Kolu.olai` reconfigures TO. */
  let config: WatchConfig = DEFAULT_WATCH
  /** The holds, keyed by fleet id. */
  const holds = new Map<string, Hold>()
  /** The fleet's id SET as the mirror knows it, kept for one job: prefix
   *  resolution of the mute values. */
  const seen = new Set<string>()
  /** The ring. Insertion-ordered Map, capped at `WATCH_RING` — a Map key
   *  iteration order is insertion order, and the eviction asks the first
   *  key. */
  const ring = new Map<string, KoluEvent>()
  /** One counter for the whole watcher, so the ring's keys read in fire
   *  order and are unique per shot. */
  let seq = 0
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  /** Which currently-live ids the mute list silences, computed per use: a
   *  `mutes × fleet` walk, which on a running machine is four times thirty
   *  — against the row walk it rode in on, nothing. The ids it can name
   *  are only those the mirror has ever handed over this observation life;
   *  a muted prefix naming nothing stays inert, which is the fail-open
   *  rule, and a value naming MORE than one is inert and said — see
   *  `sayAmbiguous`. */
  const mutedSetOf = (): Set<string> => {
    const silenced = new Set<string>()
    for (const value of config.muted) {
      const resolved = resolveTerminal(value, seen)
      if (resolved.kind === "one") silenced.add(resolved.id)
    }
    return silenced
  }

  /** The mute values that name more than one live terminal, said ONCE per
   *  value rather than per observation. An ambiguous mute silences nobody
   *  (the events keep coming), and the only door the owner has to know is
   *  this line — the CLI's refusal, made a sentence. */
  const saidAmbiguous = new Set<string>()
  const sayAmbiguousMutes = (): void => {
    for (const value of config.muted) {
      const resolved = resolveTerminal(value, seen)
      if (resolved.kind === "many" && !saidAmbiguous.has(value)) {
        saidAmbiguous.add(value)
        sink.say(
          `kolu: the mute \`${value}\` names ${resolved.count} terminals — write more of the id.`,
        )
      }
    }
  }

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

  /** One hold's event row, stamped at fire time — see `Hold.row` for why
   *  the facts are read NOW rather than held from the first observation. */
  const emitHold = (hold: Hold, kind: "transition" | "nag"): void => {
    const at = options.now()
    seq += 1
    push({
      id: `ev-${seq}`,
      kind,
      at: new Date(at).toISOString(),
      row: {
        terminal: hold.id,
        state: hold.state,
        agentState: hold.agentState,
        // The LIVE flags stamped out: an event that went on for hours
        // would otherwise flash motion for a moment that passed long ago.
        // Variant, glyph, asking, ink and the label are the whole of what
        // the past is allowed to say.
        pip: { ...hold.row.pip, active: false, bytesLive: false },
        bucket: hold.row.bucket,
        label: hold.row.label,
        labelColor: hold.row.labelColor,
        since: new Date(hold.since).toISOString(),
      },
    })
  }

  /** The heartbeat: no row, no terminal, no nag — the watcher is alive. */
  const pulse = (): void => {
    const at = options.now()
    seq += 1
    push({ id: `ev-${seq}`, kind: "heartbeat", at: new Date(at).toISOString(), row: null })
  }

  /** Re-arm the heartbeat under the config in force. The interval is
   *  cleared even on an unchanged knob, so a config edit re-times the
   *  cadence cleanly rather than inheriting a staggered one. */
  const rearmHeartbeat = (): void => {
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(pulse, config.heartbeatMs)
  }

  // ARM IT AT CONSTRUCTION: the one immediate pulse, for the reader who
  // sees a feed come up empty and wants to know it is not dead.
  pulse()
  rearmHeartbeat()

  /** Cancel ONE hold's timers and forget it. Idempotent, and the ONLY
   *  door out of `holds`. */
  const releaseHold = (hold: Hold): void => {
    if (hold.holdTimer !== undefined) clearTimeout(hold.holdTimer)
    if (hold.nagTimer !== undefined) clearTimeout(hold.nagTimer)
    hold.holdTimer = undefined
    hold.nagTimer = undefined
    if (holds.get(hold.id) === hold) holds.delete(hold.id)
  }

  /** What a fired timer must first ask: is this hold still live? A nag
   *  the microsecond after a `releaseHold` is the bug this single line
   *  exists against. */
  const liveHold = (hold: Hold): boolean => holds.get(hold.id) === hold

  const fireTransition = (hold: Hold): void => {
    if (!liveHold(hold)) return
    hold.fired = true
    hold.holdTimer = undefined
    emitHold(hold, "transition")
    hold.nagTimer = setTimeout(() => fireNag(hold), config.nagMs)
  }

  const fireNag = (hold: Hold): void => {
    if (!liveHold(hold)) return
    hold.nagTimer = undefined
    emitHold(hold, "nag")
    hold.nagTimer = setTimeout(() => fireNag(hold), config.nagMs)
  }

  return {
    observe: (id, row) => {
      seen.add(id)
      // The prefix table moves when the FLEET moves, not only when the file
      // does — a terminal ARRIVING can be what makes one prefix ambiguous.
      // `sayAmbiguousMutes` holds the once-per-value half itself.
      sayAmbiguousMutes()
      const bucket = bucketOf(row)
      const previous = holds.get(id)
      if (bucket === null || !HELD_BUCKETS.has(bucket) || mutedSetOf().has(id)) {
        if (previous !== undefined) releaseHold(previous)
        return
      }
      if (previous !== undefined && previous.state === bucket) {
        // Still the same hold — refresh the facts and let the timers run.
        previous.row = row
        return
      }
      // A DIFFERENT held bucket is a new hold, not a continuation:
      // `waiting` → `awaiting` is the terminal asking either way, but the
      // states are spelled two ways for a reason, and the event says
      // which one.
      if (previous !== undefined) releaseHold(previous)
      const hold: Hold = {
        id,
        state: bucket,
        agentState: row.agentState ?? bucket,
        since: options.now(),
        row,
        fired: false,
        holdTimer: undefined,
        nagTimer: undefined,
      }
      holds.set(id, hold)
      hold.holdTimer = config.heldForMs === 0
        ? setTimeout(() => fireTransition(hold), 0)
        : setTimeout(() => fireTransition(hold), config.heldForMs)
    },
    remove: (id) => {
      seen.delete(id)
      const hold = holds.get(id)
      if (hold !== undefined) releaseHold(hold)
    },
    reconfigure: (next) => {
      // WHICH KNOBS MOVED, asked BEFORE the swap - load-bearing in exactly
      // this shape: `revision` calls this on every keystroke that lands in
      // the vault, and a pacing reset per keystroke under a busy vault is
      // a nag (and a heartbeat) that never fires. A moved KNOB re-paces;
      // a keystroke does not.
      const intervalsMoved = next.heldForMs !== config.heldForMs
        || next.nagMs !== config.nagMs
      const heartbeatMoved = next.heartbeatMs !== config.heartbeatMs
      config = next
      // A terminal muted under the NEW list loses its hold NOW — the
      // event it was about to fire is exactly the event the vault just
      // said nobody wants.
      const silenced = mutedSetOf()
      for (const hold of [...holds.values()]) {
        if (silenced.has(hold.id)) releaseHold(hold)
      }
      sayAmbiguousMutes()
      if (heartbeatMoved) rearmHeartbeat()
      if (!intervalsMoved) return
      // Re-pace the holds under the moved knob. The nag re-seeds - the
      // interval is measured from the last emission, so a re-arm IS
      // that - and the debounce keeps its clock: the hold did not move,
      // so a raised `held-for` fires at once and a lowered one sits out
      // its time. Both honest answers.
      for (const hold of holds.values()) {
        if (hold.holdTimer !== undefined) clearTimeout(hold.holdTimer)
        if (hold.nagTimer !== undefined) clearTimeout(hold.nagTimer)
        hold.holdTimer = undefined
        hold.nagTimer = undefined
      }
      for (const hold of holds.values()) {
        if (hold.fired) {
          hold.nagTimer = setTimeout(() => fireNag(hold), config.nagMs)
        } else {
          const remaining = config.heldForMs - (options.now() - hold.since)
          hold.holdTimer = setTimeout(() => fireTransition(hold), Math.max(0, remaining))
        }
      }
    },
    events: () => ring,
    stop: () => {
      if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
      for (const hold of [...holds.values()]) releaseHold(hold)
    },
  }
}
