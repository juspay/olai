/**
 * What a browser tab's connection to the server says about itself — the
 * vocabulary both ends of that connection share.
 *
 * A tab keeps a diary of its socket (dialled, opened, dropped and why, the
 * connection-lost card going up and down) and posts it to the server, which
 * logs each entry beside its own account of the same socket. So the entry is a
 * VALUE that crosses HTTP ({@link Entry}, an Effect `Schema`), and how a value
 * reads is decided once, here ({@link describe}), rather than at each call site
 * that has something to say. A new event nobody described is a compile error:
 * `describe` is total over {@link LinkEvent}, with no default arm.
 *
 * Effect only, and no `process`: the browser imports this door, and the root
 * door pulls in the sinks, which read `process.stdout` when they load.
 *
 * Fields are sizes, codes, counts, tags and subscription labels. No frame's
 * content is ever an entry.
 */

import { Schema } from "effect"

// ── The stamp ───────────────────────────────────────────────────────────────

/** The query parameters a tab stamps on every socket it dials. The server reads
 *  them back off the upgrade's URL, so the tab's account of a socket and the
 *  server's can be joined by `tab` and `dial`. Written by {@link stamped} and
 *  read by {@link stampOf}, and by nothing else. */
const TAB_PARAM = "tab"
const DIAL_PARAM = "dial"

/** A tab's id: sixteen lowercase hex digits, minted once per page load. */
export const Tab = Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/))

/** A dial's ordinal: the tab's 1st, 2nd, … socket. */
const Dial = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000_000 }))

const isTab = Schema.is(Tab)
const isDial = Schema.is(Dial)

/** `url` with this tab's stamp on its query. A query already there is kept. */
export const stamped = (url: string, stamp: { readonly tab: string; readonly dial: number }): string => {
  const at = new URL(url)
  at.searchParams.set(TAB_PARAM, stamp.tab)
  at.searchParams.set(DIAL_PARAM, String(stamp.dial))
  return at.toString()
}

/** The `tab` and `dial` a socket URL carries, each only when it has the shape a
 *  tab mints. Anything else is absent rather than echoed: the URL is whatever
 *  the peer sent. */
export const stampOf = (url: URL): { readonly tab?: string; readonly dial?: number } => {
  const tab = url.searchParams.get(TAB_PARAM) ?? undefined
  const dialText = url.searchParams.get(DIAL_PARAM)
  const dial = dialText !== null && /^[0-9]{1,10}$/.test(dialText) ? Number(dialText) : undefined
  return {
    ...(tab !== undefined && isTab(tab) ? { tab } : {}),
    ...(dial !== undefined && isDial(dial) ? { dial } : {}),
  }
}

// ── Close codes ─────────────────────────────────────────────────────────────

/** What a WebSocket close code means, in a word or two. One table for both
 *  ends: RFC 6455's codes olai's sockets actually see, and 4001, the code the
 *  server closes a tab bound to a previous process with. */
const CLOSE_CODES: Readonly<Record<number, string>> = {
  1000: "normal",
  1001: "going away",
  1005: "no status",
  1006: "abnormal",
  1009: "too big",
  1011: "internal",
  4001: "stale process",
}

export const closeMeans = (code: number): string => CLOSE_CODES[code] ?? "unlisted"

// ── Causes ──────────────────────────────────────────────────────────────────

/**
 * Why a socket that had opened ended. Closed, picked by the browser from typed
 * facts (never from an error's text):
 *
 * | cause | when |
 * | --- | --- |
 * | `peer-closed` | the page never called `close()`: the server or the network ended it |
 * | `frame-over-cap` | the page closed it after a frame larger than the wire's cap arrived |
 * | `half-open` | the page closed it because the heartbeat heard nothing back |
 * | `roster-refresh` | olai refreshed an open socket after the plugin roster moved |
 * | `redial` | olai dialled again with a new set of plugins |
 * | `unload` | the page was going away |
 * | `severed` | the page closed it and none of the above holds |
 */
export const Cause = Schema.Literals([
  "peer-closed",
  "frame-over-cap",
  "half-open",
  "roster-refresh",
  "redial",
  "unload",
  "severed",
])
export type Cause = typeof Cause.Type

/** The causes olai itself declares before it closes a socket. They are the
 *  ordinary life of a page, so they read at `debug`, and the dial after one is
 *  not a recovery. */
export const isDeclared = (cause: Cause): boolean => cause === "roster-refresh" || cause === "redial" || cause === "unload"

// ── Events ──────────────────────────────────────────────────────────────────

/** Bounded text: what a browser says can never be longer than this, so a
 *  refused or decoded body cannot grow a log line without limit. */
const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max))
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
/** Milliseconds. */
const Ms = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

/** A failure text heard on one dial, and how many times. */
export const Heard = Schema.Struct({ text: Text(200), count: Count })
export type Heard = typeof Heard.Type

/** How many failure texts and how many subscription labels a drop carries. */
export const HEARD_LIMIT = 5
export const STARVED_LIMIT = 10

/**
 * Every event the browser's diary records. One case per thing that happens to
 * the link, each with only the facts that event has.
 */
export const LinkEvent = Schema.TaggedUnion({
  /** A socket was constructed. */
  Dialling: {},
  /** It opened. `recovered` is true when the dial before it ended by itself
   *  (not by olai's own redial) or never opened. */
  Opened: { took: Ms, recovered: Schema.Boolean },
  /** An opened socket ended. `code`, `reason` and `clean` are the close
   *  event's; absent when the page went away before one arrived. `silent` is
   *  how long nothing had arrived; `heard` the failure texts its
   *  subscriptions were told on this dial; `starved` the subscriptions that
   *  received nothing on it, and how many more there were. */
  Dropped: {
    cause: Cause,
    code: Schema.optionalKey(Count),
    reason: Schema.optionalKey(Text(200)),
    clean: Schema.optionalKey(Schema.Boolean),
    lived: Ms,
    silent: Ms,
    inFrames: Count,
    inBytes: Count,
    largestIn: Count,
    outFrames: Count,
    outBytes: Count,
    refusedSends: Count,
    heard: Schema.Array(Heard).check(Schema.isMaxLength(HEARD_LIMIT)),
    starved: Schema.Array(Text(200)).check(Schema.isMaxLength(STARVED_LIMIT)),
    starvedMore: Count,
    hidden: Schema.Boolean,
    online: Schema.Boolean,
  },
  /** Sockets ended without opening; `attempts` is how many since the last time
   *  this was said. */
  Unopened: { took: Ms, code: Schema.optionalKey(Count), attempts: Count, online: Schema.Boolean },
  /** The heartbeat's probe went unanswered, so the page is about to close an
   *  open socket. */
  Stale: { silent: Ms, hidden: Schema.Boolean },
  /** The server retired this tab: it was replaced by a newer process. */
  Retired: { code: Schema.optionalKey(Count) },
  /** The connection-lost card went up or came down. `after` is how long it was
   *  up, on the way down. */
  Card: { shown: Schema.Boolean, status: Text(32), urged: Schema.Boolean, after: Schema.optionalKey(Ms) },
  /** The connection readout changed status. */
  Readout: { from: Text(32), to: Text(32), stopped: Schema.Array(Text(200)).check(Schema.isMaxLength(STARVED_LIMIT)) },
  /** olai redialled for a plugin roster change. */
  Roster: { restarting: Schema.Array(Text(64)).check(Schema.isMaxLength(64)) },
  /** …and could not follow it. */
  RosterRefused: { why: Text(200) },
  /** The page could not read which plugins to start before its socket
   *  answered. */
  BootFailed: { why: Text(200) },
})
export type LinkEvent = typeof LinkEvent.Type

/**
 * One diary line. `seq` orders a tab's entries; `at` is the browser's wall
 * clock (comparable to a server log); `dial` the socket it is about (0 before
 * the first); `streak` how many dials in a row have dropped the same way (0
 * when there is none).
 */
export const Entry = Schema.Struct({
  seq: Count,
  at: Ms,
  dial: Count,
  streak: Count,
  event: LinkEvent,
})
export type Entry = typeof Entry.Type

/** What a tab posts: its id, a run of its entries, and how many entries its
 *  diary had to drop since the last post because nobody was taking them. */
export const Batch = Schema.Struct({
  tab: Tab,
  entries: Schema.Array(Entry).check(Schema.isMaxLength(500)),
  lost: Count,
})
export type Batch = typeof Batch.Type

// ── Loops ───────────────────────────────────────────────────────────────────

/** A dial that lived less than this and dropped the same way as the one before
 *  it continues a streak. */
export const STREAK_LIVED_MS = 60_000

/** The next streak, given the last drop's and this one's. A drop that lived a
 *  minute or more, or ended differently, starts again at 1. */
export const nextStreak = (
  last: { readonly cause: Cause; readonly streak: number; readonly lived: number } | undefined,
  now: { readonly cause: Cause; readonly lived: number },
): number =>
  last !== undefined && last.cause === now.cause && last.lived < STREAK_LIVED_MS && now.lived < STREAK_LIVED_MS
    ? last.streak + 1
    : 1

/** Is this streak said at full level? The first three, then every tenth: a loop
 *  is visible as `streak=10`, `streak=20` and does not bury the log. */
export const loudAt = (streak: number): boolean => streak <= 3 || streak % 10 === 0

// ── Reading ─────────────────────────────────────────────────────────────────

export type Field = string | number | boolean
/** The four levels a link line is ever said at: Effect's own names. */
export type Level = "Debug" | "Info" | "Warn" | "Error"
export interface Described {
  readonly level: Level
  readonly message: string
  readonly fields: Readonly<Record<string, Field>>
}

/** Milliseconds as a person reads them in a log: `850ms`, `1.9s`, `64s`. */
export const duration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`

/** Text cut to `max` characters, so it fits the field it is said in. */
export const clip = (text: string, max: number): string => text.length > max ? `${text.slice(0, max - 1)}…` : text

const quieted = (level: Level, streak: number): Level => loudAt(streak) ? level : "Debug"

/** How one entry reads: its level, its sentence, its fields. Total over
 *  {@link LinkEvent}; the fields that place an entry (`tab`, `dial`, `seq`,
 *  `at`) are the caller's to add. */
export const describe = (entry: Entry): Described => {
  const { event, streak } = entry
  switch (event._tag) {
    case "Dialling":
      return { level: "Debug", message: "wire dialling", fields: {} }
    case "Opened":
      return {
        level: event.recovered ? quieted("Info", streak) : "Debug",
        message: "wire opened",
        fields: { took: duration(event.took) },
      }
    case "Dropped":
      return {
        level: isDeclared(event.cause) ? "Debug" : quieted("Warn", streak),
        message: "wire dropped",
        fields: {
          cause: event.cause,
          by: event.cause === "peer-closed" ? "peer" : "page",
          ...(event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) }),
          ...(event.reason ? { reason: event.reason } : {}),
          ...(event.clean === undefined ? {} : { clean: event.clean }),
          lived: duration(event.lived),
          silent: duration(event.silent),
          inFrames: event.inFrames,
          inBytes: event.inBytes,
          largestIn: event.largestIn,
          outFrames: event.outFrames,
          outBytes: event.outBytes,
          refusedSends: event.refusedSends,
          ...(event.heard.length === 0
            ? {}
            : { heard: event.heard.map(({ text, count }) => count > 1 ? `${text} ×${count}` : text).join("; ") }),
          ...(event.starved.length === 0
            ? {}
            : { starved: event.starved.join(", ") + (event.starvedMore > 0 ? ` +${event.starvedMore}` : "") }),
          hidden: event.hidden,
          online: event.online,
          streak,
        },
      }
    case "Unopened":
      return {
        level: "Warn",
        message: "dial did not open",
        fields: {
          took: duration(event.took),
          ...(event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) }),
          attempts: event.attempts,
          online: event.online,
        },
      }
    case "Stale":
      return { level: "Warn", message: "heartbeat gave up", fields: { silent: duration(event.silent), hidden: event.hidden } }
    case "Retired":
      return {
        level: "Warn",
        message: "wire retired",
        fields: event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) },
      }
    case "Card":
      return {
        level: quieted("Info", streak),
        message: event.shown ? "connection-lost card shown" : "connection-lost card lifted",
        fields: {
          status: event.status,
          urged: event.urged,
          ...(event.after === undefined ? {} : { after: duration(event.after) }),
        },
      }
    case "Readout":
      return {
        level: event.to === "degraded" ? "Warn" : event.from === "degraded" ? "Info" : "Debug",
        message: "readout changed",
        fields: {
          from: event.from,
          to: event.to,
          ...(event.stopped.length === 0 ? {} : { stopped: event.stopped.join(", ") }),
        },
      }
    case "Roster":
      return {
        level: "Debug",
        message: "roster redial",
        fields: event.restarting.length === 0 ? {} : { restarting: event.restarting.join(", ") },
      }
    case "RosterRefused":
      return { level: "Error", message: "roster redial refused", fields: { why: event.why } }
    case "BootFailed":
      return { level: "Warn", message: "browser bootstrap could not be read", fields: { why: event.why } }
  }
}
