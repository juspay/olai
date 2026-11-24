/**
 * THE TAB'S DIARY OF ITS CONNECTION — what happened to each socket it dialled,
 * kept as values ({@link Entry}) in a bounded ring until the server has taken
 * them, and printed to the console as they are said.
 *
 * Every socket the page constructs is a DIAL with an ordinal, and the socket
 * tap (`./socket.ts`) reports into that dial's own facts: when it opened, how
 * much came and went, whether the page closed it, how it closed. Nothing else
 * is per frame. When an opened socket ends, the dial waits one short settle
 * (shorter than kolu's first redial) so that what its calls and subscriptions
 * were told has arrived, then says one `Dropped` with the cause `./cause.ts`
 * picks from those facts.
 *
 * Import-safe: creating a diary dials nothing and starts no timer. A settle
 * timer exists only between a socket's close and its `Dropped`, and
 * {@link Diary.dispose} clears it. `wire.ts` creates the one diary a page
 * has, beside the connection, and owns its lifetime.
 */
import { exceedsFrameLimit } from "@kolu/surface/frame-limit"
import type { SubscriptionLiveness } from "@kolu/surface/subscriptions"
import {
  clip,
  type Described,
  describe,
  type Entry,
  type Heard,
  HEARD_LIMIT,
  type Level,
  type LinkEvent,
  nextStreak,
  STARVED_LIMIT,
  type Cause,
} from "@olai/log/link"
import { causeOf } from "./cause.ts"

/** How many entries wait for the server before the oldest are dropped. */
export const RING_LIMIT = 200
/** How long a closed dial waits before it says why it dropped. Shorter than
 *  kolu's first redial (500 ms), so the drop is said before the next dial
 *  opens. */
export const SETTLE_MS = 200
/** How often a run of dials that never opened is said, after the first. */
export const UNOPENED_EVERY_MS = 30_000

/** Cancel what {@link Timers.set} scheduled. */
type Cancel = () => void
export interface Timers {
  readonly set: (run: () => void, ms: number) => Cancel
}

export interface DiaryDeps {
  readonly tab: string
  /** Wall clock: entries are read beside a server log. */
  readonly now: () => number
  readonly online: () => boolean
  readonly hidden: () => boolean
  /** kolu's subscription registry, read when a dial opens and when it drops. */
  readonly liveness: () => ReadonlyArray<SubscriptionLiveness>
  readonly timers: Timers
  readonly print: (entry: Entry, described: Described) => void
}

/** One socket's reporter, handed to the tap that watches it. */
export interface Dial {
  readonly n: number
  opened(): void
  inbound(size: number): void
  sent(size: number): void
  refused(): void
  /** The page is about to call `close()` on it. */
  closing(): void
  closed(close: { readonly code: number; readonly reason: string; readonly clean: boolean }): void
}

type Intent = "roster-refresh" | "redial"

export interface Diary {
  readonly tab: string
  /** A socket is being constructed. */
  dialled(): Dial
  /** Say an event about the connection as a whole (the card, the readout, the
   *  roster), against the latest dial. */
  say(event: LinkEvent): void
  /** The heartbeat gave up on the open socket. */
  stale(): void
  /** The server retired this tab. */
  retired(): void
  /** olai is about to close the socket itself; closes while the returned
   *  release has not run are said as `intent`. */
  declare(intent: Intent): () => void
  /** The page is going away: every socket still standing is said now. */
  unload(): void
  /** What waits for the server, oldest first, and how many were dropped. */
  pending(): { readonly entries: ReadonlyArray<Entry>; readonly lost: number }
  /** The server took everything through `seq`, and `lost` dropped entries. */
  acknowledge(seq: number, lost: number): void
  /** Hear each entry as it is said. */
  onEntry(listener: (entry: Entry) => void): () => void
  dispose(): void
}

/** One dial's facts. Counters are plain numbers: each frame adds to them. */
interface DialState {
  readonly n: number
  readonly born: number
  openedAt?: number
  closedAt?: number
  lastInbound?: number
  close?: { readonly code: number; readonly reason: string; readonly clean: boolean }
  pageClosed: boolean
  intent?: Intent | "unload"
  overCap: boolean
  stale: boolean
  inFrames: number
  inBytes: number
  largestIn: number
  outFrames: number
  outBytes: number
  refusedSends: number
  /** Each subscription's retries when this dial opened. */
  baseline: Map<string, number>
  settle?: Cancel
  /** Said: its `Dropped` or `Unopened` is in the diary. */
  done: boolean
}

const keyOf = (record: SubscriptionLiveness) => `${record.label}\u0000${record.subscribedAt}`

/** A tab's id: sixteen hex digits from the platform's random source. */
export const mintTab = (): string =>
  [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("")

const CONSOLE: Readonly<Record<Level, (...said: ReadonlyArray<unknown>) => void>> = {
  Debug: console.debug,
  Info: console.info,
  Warn: console.warn,
  Error: console.error,
}

/** The console face of an entry: every entry, at its own level. */
export const printToConsole = (entry: Entry, { level, message, fields }: Described): void =>
  CONSOLE[level](`olai: ${message}`, { dial: entry.dial, ...fields })

export const createDiary = (deps: DiaryDeps): Diary => {
  const { now } = deps
  const ring: Array<Entry> = []
  const listeners = new Set<(entry: Entry) => void>()
  const standing = new Set<DialState>()
  const declared: Array<Intent> = []
  let lost = 0
  let seq = 0
  let dials = 0
  let streak = 0
  let lastDrop: { readonly cause: Cause; readonly streak: number; readonly lived: number } | undefined
  /** The dial calls are on: the latest that opened. */
  let current: DialState | undefined
  /** An end olai did not declare since the last open: the next open is a
   *  recovery. */
  let recovering = false
  let lastCloseCode: number | undefined
  let unopened: { pending: number; saidAt?: number; took: number; code?: number; dial: number } = { pending: 0, took: 0, dial: 0 }
  let unloading = false

  const sayAt = (dial: number, event: LinkEvent, entryStreak = streak): void => {
    const entry: Entry = { seq: ++seq, at: now(), dial, streak: entryStreak, event }
    if (ring.length >= RING_LIMIT) {
      ring.shift()
      lost += 1
    }
    ring.push(entry)
    deps.print(entry, describe(entry))
    for (const listener of listeners) listener(entry)
  }

  const sayUnopened = (): void => {
    sayAt(unopened.dial, {
      _tag: "Unopened",
      took: unopened.took,
      ...(unopened.code === undefined ? {} : { code: unopened.code }),
      attempts: unopened.pending,
      online: deps.online(),
    })
    unopened = { ...unopened, pending: 0, saidAt: now() }
  }

  /** What subscriptions were told on this dial, and which heard nothing. */
  const subscriptionsOn = (state: DialState, openedAt: number) => {
    const records = deps.liveness()
    const heard = new Map<string, number>()
    const starved: Array<string> = []
    for (const record of records) {
      const retries = record.retries - (state.baseline.get(keyOf(record)) ?? 0)
      if (retries > 0 && record.lastError !== undefined) {
        heard.set(record.lastError, (heard.get(record.lastError) ?? 0) + retries)
      }
      if (record.state === "live" && (record.lastFrameAt === undefined || record.lastFrameAt < openedAt)) {
        starved.push(record.label)
      }
    }
    const texts: Array<Heard> = [...heard]
      .sort(([, a], [, b]) => b - a)
      .slice(0, HEARD_LIMIT)
      .map(([text, count]) => ({ text: clip(text, 200), count }))
    return {
      heard: texts,
      starved: starved.slice(0, STARVED_LIMIT).map((label) => clip(label, 200)),
      starvedMore: Math.max(0, starved.length - STARVED_LIMIT),
    }
  }

  const drop = (state: DialState): void => {
    if (state.done || state.openedAt === undefined) return
    state.done = true
    state.settle?.()
    standing.delete(state)
    const endedAt = state.closedAt ?? now()
    const lived = endedAt - state.openedAt
    const cause = causeOf({
      pageClosed: state.pageClosed,
      overCap: state.overCap,
      stale: state.stale,
      intent: state.intent,
    })
    const dropStreak = nextStreak(lastDrop, { cause, lived })
    lastDrop = { cause, streak: dropStreak, lived }
    streak = dropStreak
    const close = state.close
    sayAt(state.n, {
      _tag: "Dropped",
      cause,
      ...(close === undefined ? {} : { code: close.code, reason: clip(close.reason, 200), clean: close.clean }),
      lived,
      silent: endedAt - (state.lastInbound ?? state.openedAt),
      inFrames: state.inFrames,
      inBytes: state.inBytes,
      largestIn: state.largestIn,
      outFrames: state.outFrames,
      outBytes: state.outBytes,
      refusedSends: state.refusedSends,
      ...subscriptionsOn(state, state.openedAt),
      hidden: deps.hidden(),
      online: deps.online(),
    }, dropStreak)
  }

  const dialled = (): Dial => {
    const state: DialState = {
      n: ++dials,
      born: now(),
      pageClosed: false,
      overCap: false,
      stale: false,
      inFrames: 0,
      inBytes: 0,
      largestIn: 0,
      outFrames: 0,
      outBytes: 0,
      refusedSends: 0,
      baseline: new Map(),
      done: false,
    }
    standing.add(state)
    sayAt(state.n, { _tag: "Dialling" })
    return {
      n: state.n,
      opened: () => {
        if (state.done) return
        state.openedAt = now()
        current = state
        state.baseline = new Map(deps.liveness().map((record) => [keyOf(record), record.retries]))
        // Dials that never opened since the last one did are said now, so a
        // run of them is never left unsaid by the one that finally worked.
        if (unopened.pending > 0) sayUnopened()
        unopened = { pending: 0, took: 0, dial: 0 }
        sayAt(state.n, { _tag: "Opened", took: state.openedAt - state.born, recovered: recovering })
        recovering = false
      },
      inbound: (size) => {
        state.inFrames += 1
        state.inBytes += size
        if (size > state.largestIn) state.largestIn = size
        if (exceedsFrameLimit(size)) state.overCap = true
        state.lastInbound = now()
      },
      sent: (size) => {
        state.outFrames += 1
        state.outBytes += size
      },
      refused: () => {
        state.refusedSends += 1
      },
      closing: () => {
        if (state.pageClosed) return
        state.pageClosed = true
        state.intent = unloading ? "unload" : declared.at(-1)
      },
      closed: (close) => {
        if (state.done) return
        state.closedAt = now()
        state.close = close
        lastCloseCode = close.code
        if (!(state.pageClosed && state.intent !== undefined)) recovering = true
        if (state.openedAt === undefined) {
          state.done = true
          standing.delete(state)
          unopened = { ...unopened, pending: unopened.pending + 1, took: state.closedAt - state.born, code: close.code, dial: state.n }
          if (unopened.saidAt === undefined || state.closedAt - unopened.saidAt >= UNOPENED_EVERY_MS) sayUnopened()
          return
        }
        state.settle = deps.timers.set(() => drop(state), SETTLE_MS)
      },
    }
  }

  return {
    tab: deps.tab,
    dialled,
    say: (event) => sayAt(current?.n ?? dials, event),
    stale: () => {
      if (current === undefined) return
      current.stale = true
      const at = now()
      sayAt(current.n, {
        _tag: "Stale",
        silent: at - (current.lastInbound ?? current.openedAt ?? at),
        hidden: deps.hidden(),
      })
    },
    retired: () => sayAt(current?.n ?? dials, { _tag: "Retired", ...(lastCloseCode === undefined ? {} : { code: lastCloseCode }) }),
    declare: (intent) => {
      declared.push(intent)
      return () => {
        const at = declared.lastIndexOf(intent)
        if (at >= 0) declared.splice(at, 1)
      }
    },
    unload: () => {
      unloading = true
      for (const state of [...standing]) {
        if (state.openedAt === undefined) continue
        // A socket still open goes with the page; one that already closed is
        // said for what closed it, without waiting out its settle.
        if (state.closedAt === undefined && !state.pageClosed) {
          state.pageClosed = true
          state.intent = "unload"
        }
        drop(state)
      }
    },
    pending: () => ({ entries: [...ring], lost }),
    acknowledge: (through, taken) => {
      while (ring.length > 0 && ring[0]!.seq <= through) ring.shift()
      lost = Math.max(0, lost - taken)
    },
    onEntry: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: () => {
      for (const state of standing) state.settle?.()
      standing.clear()
      listeners.clear()
    },
  }
}
